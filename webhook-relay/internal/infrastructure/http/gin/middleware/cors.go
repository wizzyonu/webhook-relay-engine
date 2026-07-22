package middleware

import (
	"net/http"
	"github.com/gin-gonic/gin"
)

// CORSMiddleware handles Cross-Origin Resource Sharing for the frontend.
// It satisfies backend_skills.md §4.A (Strict CORS Configuration) and 
// integration_skills.md §4 (W3C Trace Propagation).
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Allow the frontend development server origin
		// In production, this should be restricted to the actual deployed frontend domain (e.g., "https://app.example.com")
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		
		// 2. Allow credentials (required if frontend sends cookies or auth headers)
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		
		// 3. Allow the HTTP methods the frontend uses
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		
		// 4. Allow the headers the frontend sends. 
		// CRITICAL: Must include 'traceparent' for observability, and our custom API headers.
		c.Writer.Header().Set("Access-Control-Allow-Headers", 
			"Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, "+
			"traceparent, X-Webhook-Signature, X-Target-URL, X-Idempotency-Key")
		
		// 5. Handle the preflight OPTIONS request immediately
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusOK)
			return
		}
		
		c.Next()
	}
}