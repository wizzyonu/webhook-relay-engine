package gin

import (
	"net/http"

	"github.com/elite-engineering/webhook-relay/internal/infrastructure/http/gin/handlers"
	"github.com/elite-engineering/webhook-relay/internal/infrastructure/http/gin/middleware"
	"github.com/gin-gonic/gin"
	"golang.org/x/time/rate" // Correctly imported here
)

// SetupRouter configures the Gin engine, applies global middleware, 
// and maps routes to the specific Hexagonal Handlers.
func SetupRouter(
	ingestHandler *handlers.IngestHandler,
	eventHandler *handlers.EventHandler,
	limiter *rate.Limiter, // Updated to use the optimized standard library limiter
) *gin.Engine {
	r := gin.New()

	// 1. Global Middleware
	// Observability: Extracts W3C Trace Context from incoming headers (integration_skills.md §4)
	r.Use(middleware.OTelMiddleware())
	// Resilience: Recovers from panics in handlers to prevent server crashes (backend_skills.md §4.C)
	r.Use(gin.Recovery())

	// 2. Health Checks (backend_skills.md §4.C)
	r.GET("/health/live", func(c *gin.Context) { c.Status(http.StatusOK) })
	r.GET("/health/ready", func(c *gin.Context) { c.Status(http.StatusOK) })

	// 3. API Routes
	v1 := r.Group("/api/v1")
	{
		webhooks := v1.Group("/webhooks")
		{
			// --- INGESTION (Public / 3rd Party) ---
			// Protected by Rate Limiting to prevent abuse (backend_skills.md §4.A)
			// The optimized rate.Limiter prevents the mutex contention we saw in the k6 test.
			webhooks.POST("/ingest", middleware.RateLimitMiddleware(limiter), ingestHandler.IngestWebhook)

			// --- MANAGEMENT (Dashboard / Internal) ---
			// Protected by RBAC / Auth Middleware (backend_skills.md §4.A)
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