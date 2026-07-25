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
	r.Use(middleware.CORSMiddleware())
	r.Use(middleware.OTelMiddleware())
	r.Use(gin.Recovery())

	// 2. Health Checks
	r.GET("/health/live", func(c *gin.Context) { c.Status(http.StatusOK) })
	r.GET("/health/ready", func(c *gin.Context) { c.Status(http.StatusOK) })

	// 3. API Routes
	v1 := r.Group("/api/v1")
	{
		webhooks := v1.Group("/webhooks")
		{
			// 🚨 CRITICAL: /ingest is STRICTLY ISOLATED. NO AUTH MIDDLEWARE.
			webhooks.POST("/ingest", middleware.RateLimitMiddleware(limiter), ingestHandler.IngestWebhook)

			// Management routes (Dashboard/E2E) require Auth
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