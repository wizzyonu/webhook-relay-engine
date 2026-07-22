package handlers

import (
	"net/http"

	"github.com/elite-engineering/webhook-relay/internal/application/usecases"
	"github.com/elite-engineering/webhook-relay/internal/domain/entities"
	"github.com/elite-engineering/webhook-relay/internal/domain/ports"
	"github.com/elite-engineering/webhook-relay/internal/infrastructure/http/gin/handlers/dto"
	"github.com/gin-gonic/gin"
)

type EventHandler struct {
	listUC   ports.ListEventsUseCase
	replayUC ports.ReplayEventUseCase
	repo     ports.WebhookRepository
}

func NewEventHandler(listUC ports.ListEventsUseCase, replayUC ports.ReplayEventUseCase, repo ports.WebhookRepository) *EventHandler {
	return &EventHandler{listUC: listUC, replayUC: replayUC, repo: repo}
}

func (h *EventHandler) ListEvents(c *gin.Context) {
	// Simplified for brevity; add query binding as needed
	input := ports.ListEventsInput{
		Cursor: c.Query("cursor"),
		Limit:  50, // Default
	}
	
	// (Add status filter logic here if needed)

	output, err := h.listUC.Execute(c.Request.Context(), input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "failed to list events"})
		return
	}

	items := make([]*dto.WebhookEventResponse, len(output.Items))
	for i, e := range output.Items {
		items[i] = mapEventToDTO(e, nil)
	}

	resp := dto.PaginatedEventResponse{
		Items:   items,
		HasMore: output.HasMore,
	}
	if output.NextCursor != "" {
		resp.NextCursor = &output.NextCursor
	}

	c.JSON(http.StatusOK, resp)
}

func (h *EventHandler) GetEvent(c *gin.Context) {
	eventID := c.Param("eventId")
	event, err := h.repo.FindByID(c.Request.Context(), eventID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "internal error"})
		return
	}
	if event == nil {
		c.JSON(http.StatusNotFound, dto.ErrorResponse{Error: "event not found"})
		return
	}

	c.JSON(http.StatusOK, mapEventToDTO(event, nil))
}

func (h *EventHandler) ReplayEvent(c *gin.Context) {
	eventID := c.Param("eventId")

	err := h.replayUC.Execute(c.Request.Context(), eventID)
	if err != nil {
		if err == entities.ErrInvalidTransition {
			c.JSON(http.StatusConflict, dto.ErrorResponse{Error: "event cannot be replayed in current state"})
			return
		}
		if err == usecases.ErrEventNotFound {
			c.JSON(http.StatusNotFound, dto.ErrorResponse{Error: "event not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, dto.ErrorResponse{Error: "internal error"})
		return
	}

	c.JSON(http.StatusAccepted, dto.ErrorResponse{Error: "replay queued"})
}

// Helper
func mapEventToDTO(e *entities.WebhookEvent, attempts []*entities.DeliveryAttempt) *dto.WebhookEventResponse {
	return &dto.WebhookEventResponse{
		ID:             e.ID,
		IdempotencyKey: e.IdempotencyKey,
		TargetURL:      e.TargetURL,
		Status:         string(e.Status),
		TraceID:        e.TraceID,
		Payload:        e.Payload,
		Headers:        e.Headers,
		CreatedAt:      e.CreatedAt,
		UpdatedAt:      e.UpdatedAt,
	}
}