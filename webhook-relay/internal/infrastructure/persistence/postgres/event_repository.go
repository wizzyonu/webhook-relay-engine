package postgres

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/elite-engineering/webhook-relay/internal/domain/entities"
	"github.com/elite-engineering/webhook-relay/internal/domain/ports"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type EventRepository struct {
	pool *pgxpool.Pool
}

func NewEventRepository(pool *pgxpool.Pool) ports.WebhookRepository {
	return &EventRepository{pool: pool}
}

func (r *EventRepository) Save(ctx context.Context, event *entities.WebhookEvent) error {
	query := `
		INSERT INTO webhook_events (id, idempotency_key, target_url, status, trace_id, payload, headers, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := r.pool.Exec(ctx, query,
		event.ID, event.IdempotencyKey, event.TargetURL, event.Status,
		event.TraceID, event.Payload, event.Headers, event.CreatedAt, event.UpdatedAt,
	)
	return err
}

func (r *EventRepository) FindByID(ctx context.Context, id string) (*entities.WebhookEvent, error) {
	query := `
		SELECT id, idempotency_key, target_url, status, trace_id, payload, headers, created_at, updated_at
		FROM webhook_events WHERE id = $1
	`
	return r.scanEvent(ctx, query, id)
}

func (r *EventRepository) UpdateStatus(ctx context.Context, id string, status entities.EventStatus) error {
	query := `UPDATE webhook_events SET status = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.pool.Exec(ctx, query, status, id)
	return err
}

func (r *EventRepository) SaveDeliveryAttempt(ctx context.Context, attempt *entities.DeliveryAttempt) error {
	query := `
		INSERT INTO delivery_attempts (id, event_id, attempt_number, status_code, error_message, duration_ms, timestamp)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err := r.pool.Exec(ctx, query,
		attempt.ID, attempt.EventID, attempt.AttemptNumber,
		attempt.StatusCode, attempt.ErrorMessage, attempt.DurationMs, attempt.Timestamp,
	)
	return err
}

// ListByCursor implements elite keyset pagination.
// Cursor format: base64("timestamp_unix|uuid")
func (r *EventRepository) ListByCursor(ctx context.Context, cursor string, limit int, status *entities.EventStatus) ([]*entities.WebhookEvent, string, error) {
	var args []interface{}
	query := `SELECT id, idempotency_key, target_url, status, trace_id, payload, headers, created_at, updated_at FROM webhook_events`
	
	var conditions []string
	argIndex := 1

	if status != nil {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIndex))
		args = append(args, *status)
		argIndex++
	}

	if cursor != "" {
		decoded, err := base64.StdEncoding.DecodeString(cursor)
		if err != nil {
			return nil, "", fmt.Errorf("invalid cursor format: %w", err)
		}
		parts := strings.Split(string(decoded), "|")
		if len(parts) != 2 {
			return nil, "", fmt.Errorf("invalid cursor payload")
		}
		
		// Parse timestamp and ID for keyset comparison
		ts, err := time.Parse(time.RFC3339Nano, parts[0])
		if err != nil {
			return nil, "", fmt.Errorf("invalid cursor timestamp: %w", err)
		}
		
		// Keyset condition: (created_at, id) < (cursor_time, cursor_id)
		conditions = append(conditions, fmt.Sprintf("(created_at, id) < ($%d, $%d)", argIndex, argIndex+1))
		args = append(args, ts, parts[1])
		argIndex += 2
	}

	if len(conditions) > 0 {
		query += " WHERE " + strings.Join(conditions, " AND ")
	}

	// We fetch limit + 1 to determine if there are more pages
	query += fmt.Sprintf(" ORDER BY created_at DESC, id DESC LIMIT $%d", argIndex)
	args = append(args, limit+1)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()

	var events []*entities.WebhookEvent
	for rows.Next() {
		event, err := scanEventRow(rows)
		if err != nil {
			return nil, "", err
		}
		events = append(events, event)
	}

	var nextCursor string
	hasMore := len(events) > limit
	if hasMore {
		events = events[:limit] // Trim the extra row
		lastEvent := events[limit-1]
		// Generate next cursor
		cursorPayload := fmt.Sprintf("%s|%s", lastEvent.CreatedAt.Format(time.RFC3339Nano), lastEvent.ID)
		nextCursor = base64.StdEncoding.EncodeToString([]byte(cursorPayload))
	}

	return events, nextCursor, nil
}

// --- Helper Scanners ---

func (r *EventRepository) scanEvent(ctx context.Context, query string, args ...interface{}) (*entities.WebhookEvent, error) {
	row := r.pool.QueryRow(ctx, query, args...)
	return scanEventRow(row)
}

type rowScanner interface {
	Scan(dest ...interface{}) error
}

func scanEventRow(row rowScanner) (*entities.WebhookEvent, error) {
	var event entities.WebhookEvent
	var payloadBytes, headersBytes []byte
	
	err := row.Scan(
		&event.ID, &event.IdempotencyKey, &event.TargetURL, &event.Status,
		&event.TraceID, &payloadBytes, &headersBytes, &event.CreatedAt, &event.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	event.Payload = json.RawMessage(payloadBytes)
	if err := json.Unmarshal(headersBytes, &event.Headers); err != nil {
		return nil, fmt.Errorf("failed to unmarshal headers: %w", err)
	}

	return &event, nil
}