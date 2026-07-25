package entities

import "time"

type EventStatus string

const (
	StatusIngested    EventStatus = "INGESTED"
	StatusQueued      EventStatus = "QUEUED"
	StatusDispatching EventStatus = "DISPATCHING"
	StatusSuccess     EventStatus = "SUCCESS"
	StatusFailed      EventStatus = "FAILED"
	StatusDeadLetter  EventStatus = "DEAD_LETTER"
)

// DeliveryAttempt represents a single dispatch attempt (PRD FR9)
type DeliveryAttempt struct {
	ID            string
	EventID       string
	AttemptNumber int
	StatusCode    int
	ErrorMessage  *string // Pointer to allow null on success
	DurationMs    int64
	Timestamp     time.Time
}

type WebhookEvent struct {
	ID               string
	IdempotencyKey   string
	TargetURL        string
	Status           EventStatus
	TraceID          string
	Payload          []byte
	Headers          map[string]string
	AttemptCount     int
	DeliveryAttempts []DeliveryAttempt
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// AddDeliveryAttempt safely appends an attempt and updates the counter
func (e *WebhookEvent) AddDeliveryAttempt(attempt DeliveryAttempt) {
	e.DeliveryAttempts = append(e.DeliveryAttempts, attempt)
	e.AttemptCount = attempt.AttemptNumber
}