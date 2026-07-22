package ports

import (
	"time"
	"context"
	"github.com/elite-engineering/webhook-relay/internal/domain/entities"
)

// WebhookRepository defines how we persist events (Implemented by Postgres)
type WebhookRepository interface {
	Save(ctx context.Context, event *entities.WebhookEvent) error
	FindByID(ctx context.Context, id string) (*entities.WebhookEvent, error)
	ListByCursor(ctx context.Context, cursor string, limit int, status *entities.EventStatus) ([]*entities.WebhookEvent, string, error)
	UpdateStatus(ctx context.Context, id string, status entities.EventStatus) error
	SaveDeliveryAttempt(ctx context.Context, attempt *entities.DeliveryAttempt) error
}

// IdempotencyCache defines how we prevent duplicate ingestion (Implemented by Redis)
type IdempotencyCache interface {
	Get(ctx context.Context, key string) (eventID string, exists bool, err error)
	Set(ctx context.Context, key string, eventID string) error
}

// Dispatcher defines how we send the webhook to the 3rd party (Implemented by HTTP Client)
type Dispatcher interface {
	Dispatch(ctx context.Context, event *entities.WebhookEvent) (*entities.DeliveryAttempt, error)
}

// MessageQueue defines how we queue events for async processing (Implemented by Redis ZSET/Kafka)
type MessageQueue interface {
	Enqueue(ctx context.Context, eventID string) error
	Dequeue(ctx context.Context) (eventID string, err error)
}

// UUIDGenerator prevents the github.com/google/uuid package from leaking into the Application layer.
// Implemented by a simple wrapper in the infrastructure layer.
type UUIDGenerator interface {
	New() string
}

// DelayedMessageQueue defines how we schedule delayed retries (Implemented by Redis ZSET)
type DelayedMessageQueue interface {
	EnqueueWithDelay(ctx context.Context, eventID string, delay time.Duration) error
}