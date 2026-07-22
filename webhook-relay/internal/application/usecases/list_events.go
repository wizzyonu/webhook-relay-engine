package usecases

import (
	"context"
	"github.com/elite-engineering/webhook-relay/internal/domain/ports"
)

type ListEventsUseCase struct {
	repo ports.WebhookRepository
}

func NewListEventsUseCase(repo ports.WebhookRepository) ports.ListEventsUseCase {
	return &ListEventsUseCase{repo: repo}
}

func (uc *ListEventsUseCase) Execute(ctx context.Context, input ports.ListEventsInput) (*ports.ListEventsOutput, error) {
	items, nextCursor, err := uc.repo.ListByCursor(ctx, input.Cursor, input.Limit, input.Status)
	if err != nil {
		return nil, err
	}

	return &ports.ListEventsOutput{
		Items:      items,
		NextCursor: nextCursor,
		HasMore:    nextCursor != "",
	}, nil
}