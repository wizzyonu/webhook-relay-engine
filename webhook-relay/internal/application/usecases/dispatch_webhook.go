package usecases

import (
	"context"
	"fmt"
	"time"

	"github.com/elite-engineering/webhook-relay/internal/domain/entities"
	"github.com/elite-engineering/webhook-relay/internal/domain/ports"
)

type DispatchWebhookUseCase struct {
	repo         ports.WebhookRepository
	dispatcher   ports.Dispatcher
	delayedQueue ports.DelayedMessageQueue
	maxRetries   int
}

func NewDispatchWebhookUseCase(
	repo ports.WebhookRepository,
	dispatcher ports.Dispatcher,
	delayedQueue ports.DelayedMessageQueue, // Uses the specific interface for retries
	maxRetries int,
) *DispatchWebhookUseCase {
	return &DispatchWebhookUseCase{
		repo:         repo,
		dispatcher:   dispatcher,
		delayedQueue: delayedQueue,
		maxRetries:   maxRetries,
	}
}

func (uc *DispatchWebhookUseCase) Execute(ctx context.Context, eventID string) error {
	// 1. Fetch Event
	event, err := uc.repo.FindByID(ctx, eventID)
	if err != nil || event == nil {
		return fmt.Errorf("event not found: %w", err)
	}

	// 2. Transition to DISPATCHING
	if err := event.TransitionTo(entities.StatusDispatching); err != nil {
		return fmt.Errorf("failed to transition to DISPATCHING: %w", err)
	}
	_ = uc.repo.UpdateStatus(ctx, event.ID, event.Status)

	// 3. Execute HTTP Dispatch
	// The Dispatcher interface returns (*entities.DeliveryAttempt, error)
	attempt, err := uc.dispatcher.Dispatch(ctx, event)

	// 4. Record Delivery Attempt
	if attempt != nil {
		event.AddDeliveryAttempt(*attempt)
		_ = uc.repo.SaveDeliveryAttempt(ctx, attempt)
	}

	// 5. Handle Success or Failure
	if err != nil || (attempt != nil && attempt.StatusCode >= 400) {
		// --- FAILURE PATH ---
		event.Status = entities.StatusFailed
		event.UpdatedAt = time.Now()
		_ = uc.repo.UpdateStatus(ctx, event.ID, event.Status)

		if event.AttemptCount < uc.maxRetries {
			// Enqueue with delay for retries
			backoff := calculateBackoff(event.AttemptCount)
			_ = uc.delayedQueue.EnqueueWithDelay(ctx, event.ID, backoff)
		} else {
			// Max retries exceeded: Transition to DEAD_LETTER (PRD FR7)
			event.Status = entities.StatusDeadLetter
			event.UpdatedAt = time.Now()
			_ = uc.repo.UpdateStatus(ctx, event.ID, event.Status)
			return fmt.Errorf("max retries (%d) exceeded, moved to DEAD_LETTER", uc.maxRetries)
		}
		return fmt.Errorf("dispatch failed")
	}

	// --- SUCCESS PATH ---
	event.Status = entities.StatusSuccess
	event.UpdatedAt = time.Now()
	_ = uc.repo.UpdateStatus(ctx, event.ID, event.Status)

	return nil
}

// calculateBackoff implements Exponential Backoff with Jitter (PRD FR6)
func calculateBackoff(attempt int) time.Duration {
	base := []time.Duration{1 * time.Minute, 5 * time.Minute, 30 * time.Minute, 2 * time.Hour}
	
	var delay time.Duration
	if attempt-1 < len(base) {
		delay = base[attempt-1]
	} else {
		delay = 2 * time.Hour
	}

	// Add up to 20% jitter to prevent thundering herd
	jitter := time.Duration(float64(delay) * 0.2 * (float64(time.Now().UnixNano()%1000) / 1000.0))
	return delay + jitter
}