package handlers

import (
	"io"
	"net/http"

	"github.com/elite-engineering/webhook-relay/internal/domain/ports"
	"github.com/gin-gonic/gin"
)

type IngestHandler struct {
	uc ports.IngestWebhookUseCase
}

func NewIngestHandler(uc ports.IngestWebhookUseCase) *IngestHandler {
	return &IngestHandler{uc: uc}
}

type IngestHeaders struct {
	Signature string `header:"X-Webhook-Signature"`
	TargetURL string `header:"X-Target-URL"`
}

func (h *IngestHandler) IngestWebhook(c *gin.Context) {
	// 1. Bind Required Headers
	var headers IngestHeaders
	if err := c.ShouldBindHeader(&headers); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing required headers: " + err.Error()})
		return
	}

	// 2. Read Raw Body EXACTLY ONCE
	// CRITICAL: Do not use c.ShouldBindJSON before this, or it will consume the body stream.
	rawPayload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return
	}

	// 3. Execute Use Case
	output, err := h.uc.Execute(c.Request.Context(), ports.IngestWebhookInput{
		TargetURL: headers.TargetURL,
		Payload:   rawPayload,
		Headers:   extractHeaders(c.Request.Header),
		Signature: headers.Signature,
	})

	if err != nil {
		// Map domain cryptographic validation errors to 401 Unauthorized
		if err.Error() == "invalid webhook signature" ||
			err.Error() == "invalid signature format: must be sha256=<hex>" ||
			err.Error() == "invalid signature hex encoding" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		
		// All other domain errors map to 500 Internal Server Error
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 4. Return 202 Accepted
	c.JSON(http.StatusAccepted, output)
}

// extractHeaders converts the standard http.Header map to a flat map[string]string
func extractHeaders(h http.Header) map[string]string {
	headers := make(map[string]string)
	for k, v := range h {
		if len(v) > 0 {
			headers[k] = v[0]
		}
	}
	return headers
}