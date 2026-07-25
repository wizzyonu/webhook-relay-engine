package ports

import (
	"context"
	"github.com/elite-engineering/webhook-relay/internal/domain/entities"
)

// --- Ingestion Use Case ---

type IngestWebhookInput struct {
	TargetURL string
	Payload   []byte
	Headers   map[string]string
	Signature string
}

type IngestWebhookOutput struct {
	EventID        string               `json:"event_id"`
	IdempotencyKey string               `json:"idempotency_key"`
	Status         entities.EventStatus `json:"status"`
}

type IngestWebhookUseCase interface {
	Execute(ctx context.Context, input IngestWebhookInput) (*IngestWebhookOutput, error)
}

// --- Replay Use Case ---

type ReplayEventUseCase interface {
	Execute(ctx context.Context, eventID string) error
}

// --- List Use Case (Cursor Pagination) ---

type ListEventsInput struct {
	Cursor string
	Limit  int
	Status *entities.EventStatus // Optional filter
}

type ListEventsOutput struct {
	Items      []*entities.WebhookEvent
	NextCursor string
	HasMore    bool
}

type ListEventsUseCase interface {
	Execute(ctx context.Context, input ListEventsInput) (*ListEventsOutput, error)
}