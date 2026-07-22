package handlers

import (
	"io"
	"net/http"

	"github.com/elite-engineering/webhook-relay/internal/domain/ports"
	"github.com/elite-engineering/webhook-relay/internal/infrastructure/http/gin/handlers/dto"
	"github.com/gin-gonic/gin"
)

type IngestHandler struct {
	ingestUC ports.IngestWebhookUseCase
}

// NewIngestHandler is the constructor the test is looking for
func NewIngestHandler(ingestUC ports.IngestWebhookUseCase) *IngestHandler {
	return &IngestHandler{ingestUC: ingestUC}
}

func (h *IngestHandler) IngestWebhook(c *gin.Context) {
	// 1. Bind and Validate Headers
	var headers dto.IngestHeaders
	if err := c.ShouldBindHeader(&headers); err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "missing or invalid required headers"})
		return
	}

	// 2. Read raw body to preserve exact bytes for signature verification
	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.ErrorResponse{Error: "invalid request body"})
		return
	}

	// 3. Extract non-hop-by-hop headers for forwarding
	forwardedHeaders := make(map[string]string)
	for k, v := range c.Request.Header {
		if len(v) > 0 && k != "X-Webhook-Signature" && k != "X-Target-URL" {
			forwardedHeaders[k] = v[0]
		}
	}

	input := ports.IngestWebhookInput{
		TargetURL: headers.TargetURL,
		Payload:   payload,
		Headers:   forwardedHeaders,
		Signature: headers.Signature,
	}

	output, err := h.ingestUC.Execute(c.Request.Context(), input)
	if err != nil {
		if err.Error() == "invalid webhook signature" {
			c.JSON(http.StatusUnauthorized, dto.ErrorResponse{Error: "unauthorized"})
			return
		}
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "internal server error"})
		return
	}

	c.JSON(http.StatusAccepted, dto.IngestResponse{
		EventID:        output.EventID,
		IdempotencyKey: output.IdempotencyKey,
		Status:         string(output.Status),
	})
}