package queue

import (
	"context"
	"time"

	"github.com/elite-engineering/webhook-relay/internal/domain/ports"
	"github.com/redis/go-redis/v9"
)

type RedisQueue struct {
	client *redis.Client
	key    string
}

func NewRedisQueue(client *redis.Client, key string) ports.MessageQueue {
	return &RedisQueue{client: client, key: key}
}

// Enqueue adds an event to the immediate processing queue.
func (q *RedisQueue) Enqueue(ctx context.Context, eventID string) error {
	return q.client.LPush(ctx, q.key+":immediate", eventID).Err()
}

// Dequeue blocks until an item is available or context is cancelled.
func (q *RedisQueue) Dequeue(ctx context.Context) (string, error) {
	result, err := q.client.BRPop(ctx, 5*time.Second, q.key+":immediate").Result()
	if err == redis.Nil {
		return "", nil // Timeout, no items
	}
	if err != nil {
		return "", err
	}
	return result[1], nil // BRPop returns [key, value]
}

// EnqueueWithDelay satisfies the ports.DelayedMessageQueue interface.
// Note: For hackathon demo purposes, this enqueues immediately. 
// Production implementation would use Redis ZSET (ZAdd) + BZPOPMIN sweeper.
func (q *RedisQueue) EnqueueWithDelay(ctx context.Context, eventID string, delay time.Duration) error {
	return q.client.LPush(ctx, q.key+":immediate", eventID).Err()
}