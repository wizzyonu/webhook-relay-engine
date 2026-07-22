package entities

import (
	"encoding/json"
	"time"
)

// EventStatus represents the strict Finite State Machine (FSM) states.
// Mapped directly to the OpenAPI contract.
type EventStatus string

const (
	StatusIngested    EventStatus = "INGESTED"
	StatusQueued      EventStatus = "QUEUED"
	StatusDispatching EventStatus = "DISPATCHING"
	StatusSuccess     EventStatus = "SUCCESS"
	StatusFailed      EventStatus = "FAILED"
	StatusDeadLetter  EventStatus = "DEAD_LETTER"
)

// WebhookEvent is the core aggregate root.
// Notice: ZERO imports from Gin, Postgres, Redis, or UUID libraries.
type WebhookEvent struct {
	ID             string
	IdempotencyKey string
	TargetURL      string
	Status         EventStatus
	TraceID        string
	
	// RawMessage preserves the exact bytes for signature verification and replay
	Payload        json.RawMessage 
	Headers        map[string]string
	
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// DeliveryAttempt records the outcome of a single dispatch attempt.
type DeliveryAttempt struct {
	ID           string
	EventID      string
	AttemptNumber int
	StatusCode   *int // Pointer to allow NULL (e.g., network timeout)
	ErrorMessage *string
	DurationMs   int
	Timestamp    time.Time
}