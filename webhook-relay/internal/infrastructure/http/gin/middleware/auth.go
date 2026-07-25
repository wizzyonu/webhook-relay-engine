package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware(requiredRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			// If you see this error in Postman/Node, Auth is blocking you.
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization header format"})
			c.Abort()
			return
		}

		token := parts[1]
		expectedToken := os.Getenv("API_AUTH_TOKEN")
		if expectedToken == "" {
			expectedToken = "dev-e2e-test-token-123" 
		}

		if token != expectedToken {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid authorization token"})
			c.Abort()
			return
		}

		c.Next()
	}
}