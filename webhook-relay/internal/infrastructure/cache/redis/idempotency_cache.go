package redis

import (
	"context"
	"time"

	"github.com/elite-engineering/webhook-relay/internal/domain/ports"
	"github.com/redis/go-redis/v9"
)

type IdempotencyCache struct {
	client *redis.Client
}

func NewIdempotencyCache(client *redis.Client) ports.IdempotencyCache {
	return &IdempotencyCache{client: client}
}

// Get checks if an idempotency key has already been processed.
func (c *IdempotencyCache) Get(ctx context.Context, key string) (string, bool, error) {
	eventID, err := c.client.Get(ctx, "idempotency:"+key).Result()
	if err == redis.Nil {
		return "", false, nil // Key does not exist
	}
	if err != nil {
		return "", false, err
	}
	return eventID, true, nil
}

// Set stores the idempotency key with a 24-hour TTL.
func (c *IdempotencyCache) Set(ctx context.Context, key string, eventID string) error {
	return c.client.Set(ctx, "idempotency:"+key, eventID, 24*time.Hour).Err()
}