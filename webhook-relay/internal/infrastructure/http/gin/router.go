package gin

import (
	"net/http"

	"github.com/elite-engineering/webhook-relay/internal/infrastructure/http/gin/handlers"
	"github.com/elite-engineering/webhook-relay/internal/infrastructure/http/gin/middleware"
	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate"
)

func SetupRouter(
	ingestHandler *handlers.IngestHandler,
	eventHandler *handlers.EventHandler,
	limiter *rate.Limiter,
) *gin.Engine {
	r := gin.New()

	// 1. Global Middleware
	// CRITICAL: CORS must be the FIRST middleware to catch preflight OPTIONS requests
	r.Use(middleware.CORSMiddleware())
	
	// Observability: Extracts W3C Trace Context from incoming headers
	r.Use(middleware.OTelMiddleware())
	
	// Resilience: Recovers from panics in handlers
	r.Use(gin.Recovery())

	// 2. Health Checks
	r.GET("/health/live", func(c *gin.Context) { c.Status(http.StatusOK) })
	r.GET("/health/ready", func(c *gin.Context) { c.Status(http.StatusOK) })

	// 3. API Routes
	v1 := r.Group("/api/v1")
	{
		webhooks := v1.Group("/webhooks")
		{
			// INGESTION (Public / 3rd Party)
			webhooks.POST("/ingest", middleware.RateLimitMiddleware(limiter), ingestHandler.IngestWebhook)

			// MANAGEMENT (Dashboard / Internal)
			management := webhooks.Group("")
			management.Use(middleware.AuthMiddleware("admin"))
			{
				management.GET("/events", eventHandler.ListEvents)
				management.GET("/events/:eventId", eventHandler.GetEvent)
				management.POST("/events/:eventId/replay", eventHandler.ReplayEvent)
			}
		}
	}

	return r
}