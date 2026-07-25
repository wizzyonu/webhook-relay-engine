package queue

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisQueue struct {
	client *redis.Client
	key    string
}

func NewRedisQueue(client *redis.Client, key string) *RedisQueue {
	return &RedisQueue{client: client, key: key}
}

// Enqueue pushes an event ID to the standard processing queue.
func (q *RedisQueue) Enqueue(ctx context.Context, eventID string) error {
	return q.client.LPush(ctx, q.key, eventID).Err()
}

// Dequeue blocks and waits for an event ID from the standard queue.
func (q *RedisQueue) Dequeue(ctx context.Context) (string, error) {
	// BRPop blocks until an element is available or context is cancelled
	result, err := q.client.BRPop(ctx, 5*time.Second, q.key).Result()
	if err == redis.Nil {
		return "", nil // Timeout, no events
	}
	if err != nil {
		return "", fmt.Errorf("failed to dequeue: %w", err)
	}
	
	// BRPop returns [key, value], we want the value
	if len(result) < 2 {
		return "", fmt.Errorf("unexpected BRPop result format")
	}
	return result[1], nil
}

// EnqueueWithDelay schedules an event for retry using a Redis Sorted Set (ZSET).
// The score is the Unix timestamp when the event should become available.
func (q *RedisQueue) EnqueueWithDelay(ctx context.Context, eventID string, delay time.Duration) error {
	delayedKey := q.key + ":delayed"
	score := float64(time.Now().Add(delay).Unix())
	
	// ZAdd adds the eventID with the future timestamp as the score
	return q.client.ZAdd(ctx, delayedKey, redis.Z{
		Score:  score,
		Member: eventID,
	}).Err()
}