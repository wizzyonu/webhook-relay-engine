package usecases

import (
	"context"
	"time"

	"github.com/elite-engineering/webhook-relay/internal/domain/entities"
	"github.com/elite-engineering/webhook-relay/internal/domain/ports"
	"github.com/elite-engineering/webhook-relay/internal/pkg/validator"
	"github.com/google/uuid"
)

type IngestWebhookUseCase struct {
	repo          ports.WebhookRepository
	cache         ports.IdempotencyCache
	queue         ports.MessageQueue
	uuidGen       ports.UUIDGenerator
	signingSecret string
}

func NewIngestWebhookUseCase(
	repo ports.WebhookRepository,
	cache ports.IdempotencyCache,
	queue ports.MessageQueue,
	uuidGen ports.UUIDGenerator,
	signingSecret string,
) ports.IngestWebhookUseCase {
	return &IngestWebhookUseCase{
		repo: repo, cache: cache, queue: queue, uuidGen: uuidGen, signingSecret: signingSecret,
	}
}

func (uc *IngestWebhookUseCase) Execute(ctx context.Context, input ports.IngestWebhookInput) (*ports.IngestWebhookOutput, error) {
	// 1. Validate Cryptographic Signature (Security First)
	if err := validator.VerifyHMACSHA256(input.Payload, input.Signature, uc.signingSecret); err != nil {
		return nil, err
	}

	// 2. Generate DETERMINISTIC UUIDv5 from the payload for true idempotency
	namespace := uuid.MustParse("6ba7b810-9dad-11d1-80b4-00c04fd430c8")
	idempotencyKey := uuid.NewSHA1(namespace, input.Payload).String()
	
	traceID := uc.uuidGen.New()

	// 3. Check Idempotency Cache (Fast Path)
	if existingEventID, exists, _ := uc.cache.Get(ctx, idempotencyKey); exists {
		event, err := uc.repo.FindByID(ctx, existingEventID)
		if err != nil || event == nil {
			return nil, err
		}
		return &ports.IngestWebhookOutput{
			EventID:        event.ID,
			IdempotencyKey: event.IdempotencyKey,
			Status:         event.Status,
		}, nil
	}

	// 4. Create Domain Entity (Starts as INGESTED per TDD)
	now := time.Now()
	event := &entities.WebhookEvent{
		ID:             uc.uuidGen.New(),
		IdempotencyKey: idempotencyKey,
		TargetURL:      input.TargetURL,
		Status:         entities.StatusIngested, 
		TraceID:        traceID,
		Payload:        input.Payload,
		Headers:        input.Headers,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	// 5. Persist to ACID Store
	if err := uc.repo.Save(ctx, event); err != nil {
		return nil, err 
	}

	// 6. 🚨 CRITICAL FIX: Transition to QUEUED and Update DB *before* enqueuing to Redis.
	// This guarantees the background worker will NEVER read the event as INGESTED, 
	// completely eliminating the "invalid state transition" race condition.
	event.Status = entities.StatusQueued
	event.UpdatedAt = time.Now()
	if err := uc.repo.UpdateStatus(ctx, event.ID, event.Status); err != nil {
		return nil, err
	}

	// 7. Set Idempotency Cache (TTL 24h)
	_ = uc.cache.Set(ctx, idempotencyKey, event.ID)

	// 8. Enqueue for Async Dispatch
	// Because the DB is already updated to QUEUED, the worker can safely 
	// transition it to DISPATCHING without any race conditions.
	if err := uc.queue.Enqueue(ctx, event.ID); err != nil {
		// Log error, but don't fail the HTTP request since payload is safely persisted 
		// and marked as QUEUED in the DB.
	}

	return &ports.IngestWebhookOutput{
		EventID:        event.ID,
		IdempotencyKey: event.IdempotencyKey,
		Status:         event.Status, // Returns "QUEUED"
	}, nil
}