package middleware

import (
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/propagation"
)

// OTelMiddleware extracts the W3C Trace Context from incoming headers 
// and injects it into the Gin context for full-stack observability (integration_skills.md §4).
func OTelMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		
		// Extract traceparent and tracestate from incoming HTTP headers
		ctx = otel.GetTextMapPropagator().Extract(ctx, propagation.HeaderCarrier(c.Request.Header))
		
		// Update the request context so downstream use-cases can access the trace
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}