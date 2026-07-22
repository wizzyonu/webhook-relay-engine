package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware enforces RBAC for the Management Dashboard endpoints.
// In production, this validates a JWT against an Identity Provider (OIDC).
func AuthMiddleware(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			return
		}

		// Extract Bearer token
		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization format"})
			return
		}

		token := parts[1]
		
		// ELITE PRACTICE: Validate JWT signature, expiry, and claims here.
		// For this blueprint, we simulate a successful validation and inject the role.
		if token == "invalid_token" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}

		// Inject user context for downstream audit logging
		c.Set("user_role", "admin") // Mocked role
		c.Next()
	}
}