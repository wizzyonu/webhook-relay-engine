package usecases

import (
	"context"
	"errors"

	"github.com/elite-engineering/webhook-relay/internal/domain/entities"
	"github.com/elite-engineering/webhook-relay/internal/domain/ports"
)

var ErrEventNotFound = errors.New("event not found")

type ReplayEventUseCase struct {
	repo  ports.WebhookRepository
	queue ports.MessageQueue
}

func NewReplayEventUseCase(repo ports.WebhookRepository, queue ports.MessageQueue) ports.ReplayEventUseCase {
	return &ReplayEventUseCase{repo: repo, queue: queue}
}

func (uc *ReplayEventUseCase) Execute(ctx context.Context, eventID string) error {
	event, err := uc.repo.FindByID(ctx, eventID)
	if err != nil {
		return err
	}
	if event == nil {
		return ErrEventNotFound
	}

	// Enforce FSM: Only FAILED or DEAD_LETTER can be replayed to QUEUED
	if event.Status != entities.StatusFailed && event.Status != entities.StatusDeadLetter {
		return entities.ErrInvalidTransition
	}

	// Transition state
	if err := event.TransitionTo(entities.StatusQueued); err != nil {
		return err
	}

	// Persist and Re-queue
	if err := uc.repo.UpdateStatus(ctx, event.ID, event.Status); err != nil {
		return err
	}

	return uc.queue.Enqueue(ctx, event.ID)
}