package dto

import "time"

type IngestResponse struct {
	EventID        string `json:"event_id"`
	IdempotencyKey string `json:"idempotency_key"`
	Status         string `json:"status"`
}

type PaginatedEventResponse struct {
	Items      []*WebhookEventResponse `json:"items"`
	NextCursor *string                 `json:"next_cursor"` // Pointer to allow null in JSON
	HasMore    bool                    `json:"has_more"`
}

type WebhookEventResponse struct {
	ID               string                 `json:"id"`
	IdempotencyKey   string                 `json:"idempotency_key"`
	TargetURL        string                 `json:"target_url"`
	Status           string                 `json:"status"`
	TraceID          string                 `json:"trace_id"`
	Payload          interface{}            `json:"payload"`
	Headers          map[string]string      `json:"headers"`
	DeliveryAttempts []*DeliveryAttemptResp `json:"delivery_attempts"`
	CreatedAt        time.Time              `json:"created_at"`
	UpdatedAt        time.Time              `json:"updated_at"`
}

type DeliveryAttemptResp struct {
	AttemptNumber int        `json:"attempt_number"`
	StatusCode    *int       `json:"status_code"`
	ErrorMessage  *string    `json:"error_message"`
	DurationMs    int        `json:"duration_ms"`
	Timestamp     time.Time  `json:"timestamp"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}