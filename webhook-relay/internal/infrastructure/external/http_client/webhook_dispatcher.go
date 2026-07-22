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
		client: &http.Client{
			Timeout: 10 * time.Second, // Strict timeout to prevent worker thread exhaustion
		},
	}
}

func (d *HTTPDispatcher) Dispatch(ctx context.Context, event *entities.WebhookEvent) (*entities.DeliveryAttempt, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, event.TargetURL, bytes.NewReader(event.Payload))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// 1. Inject Strict Contract Headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Trace-Id", event.TraceID)
	req.Header.Set("X-Relay-Idempotency-Key", event.IdempotencyKey)
	
	// Re-inject original headers if necessary (excluding host/content-length)
	for k, v := range event.Headers {
		if k != "Content-Length" && k != "Host" {
			req.Header.Set(k, v)
		}
	}

	// 2. Execute and Measure
	start := time.Now()
	resp, err := d.client.Do(req)
	duration := time.Since(start).Milliseconds()

	attempt := &entities.DeliveryAttempt{
		EventID:    event.ID,
		DurationMs: int(duration),
		Timestamp:  time.Now(),
	}

	if err != nil {
		errMsg := err.Error()
		attempt.ErrorMessage = &errMsg
		return attempt, err // Network failure or timeout
	}
	defer resp.Body.Close()

	attempt.StatusCode = &resp.StatusCode
	return attempt, nil
}