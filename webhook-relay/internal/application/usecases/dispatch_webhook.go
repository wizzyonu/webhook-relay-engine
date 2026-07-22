package usecases

import (
	"context"

	"github.com/elite-engineering/webhook-relay/internal/domain/entities"
	"github.com/elite-engineering/webhook-relay/internal/domain/ports"
)

type DispatchWebhookUseCase struct {
	repo       ports.WebhookRepository
	dispatcher ports.Dispatcher
	queue      ports.MessageQueue
	maxRetries int
}

func NewDispatchWebhookUseCase(
	repo ports.WebhookRepository,
	dispatcher ports.Dispatcher,
	queue ports.MessageQueue,
	maxRetries int,
) *DispatchWebhookUseCase {
	return &DispatchWebhookUseCase{
		repo: repo, dispatcher: dispatcher, queue: queue, maxRetries: maxRetries,
	}
}

func (uc *DispatchWebhookUseCase) Execute(ctx context.Context, eventID string) error {
	event, err := uc.repo.FindByID(ctx, eventID)
	if err != nil || event == nil {
		return err 
	}

	// 1. Transition to DISPATCHING
	if err := event.TransitionTo(entities.StatusDispatching); err != nil {
		return err
	}
	_ = uc.repo.UpdateStatus(ctx, event.ID, event.Status)

	// 2. Execute HTTP Dispatch
	attempt, dispatchErr := uc.dispatcher.Dispatch(ctx, event)
	if attempt != nil {
		attempt.AttemptNumber = 1 
		_ = uc.repo.SaveDeliveryAttempt(ctx, attempt)
	}

	// 3. Evaluate Result & Handle Retries
	isSuccess := dispatchErr == nil && attempt != nil && attempt.StatusCode != nil && *attempt.StatusCode >= 200 && *attempt.StatusCode < 300

	if isSuccess {
		_ = event.TransitionTo(entities.StatusSuccess)
	} else {
		// For hackathon demo: We hardcode currentAttempt to 1 and enqueue immediately 
		// to prove the retry loop works without over-engineering the Redis ZSET delayed queue.
		currentAttempt := 1 
		
		if currentAttempt >= uc.maxRetries {
			_ = event.TransitionTo(entities.StatusDeadLetter)
		} else {
			_ = event.TransitionTo(entities.StatusFailed)
			
			// Enqueue immediately to trigger the retry loop
			_ = uc.queue.Enqueue(ctx, event.ID)
		}
	}

	// 4. Final State Update
	return uc.repo.UpdateStatus(ctx, event.ID, event.Status)
}