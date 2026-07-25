package http_client

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/elite-engineering/webhook-relay/internal/domain/entities"
	"github.com/elite-engineering/webhook-relay/internal/domain/ports"
)

type HTTPDispatcher struct {
	client *http.Client
}

func NewHTTPDispatcher() ports.Dispatcher {
	return &HTTPDispatcher{
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (d *HTTPDispatcher) Dispatch(ctx context.Context, event *entities.WebhookEvent) (*entities.DeliveryAttempt, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, event.TargetURL, bytes.NewReader(event.Payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	// PRD FR5: Inject Idempotency Key & Trace ID
	req.Header.Set("X-Relay-Idempotency-Key", event.IdempotencyKey)
	req.Header.Set("X-Trace-Id", event.TraceID)
	
	// Inject any custom headers from the original ingestion
	for k, v := range event.Headers {
		req.Header.Set(k, v)
	}

	start := time.Now()
	resp, err := d.client.Do(req)
	duration := time.Since(start)

	attemptNumber := event.AttemptCount + 1
	attempt := &entities.DeliveryAttempt{
		EventID:       event.ID,
		AttemptNumber: attemptNumber,
		DurationMs:    duration.Milliseconds(), // FIX: Milliseconds() returns int64
		Timestamp:     time.Now(),
	}

	if err != nil {
		errMsg := err.Error()
		attempt.ErrorMessage = &errMsg
		return attempt, fmt.Errorf("http request failed: %w", err)
	}
	defer resp.Body.Close()

	attempt.StatusCode = resp.StatusCode // FIX: Assign int directly, no pointer

	if resp.StatusCode >= 400 {
		errMsg := fmt.Sprintf("HTTP %d", resp.StatusCode)
		attempt.ErrorMessage = &errMsg
		return attempt, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	return attempt, nil
}