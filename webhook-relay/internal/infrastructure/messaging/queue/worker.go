package queue

import (
	"context"
	"log"
	"sync"

	"github.com/elite-engineering/webhook-relay/internal/application/usecases"
	"github.com/elite-engineering/webhook-relay/internal/domain/ports"
)

type Worker struct {
	queue      ports.MessageQueue
	dispatchUC *usecases.DispatchWebhookUseCase
	concurrency int
}

func NewWorker(queue ports.MessageQueue, dispatchUC *usecases.DispatchWebhookUseCase, concurrency int) *Worker {
	return &Worker{queue: queue, dispatchUC: dispatchUC, concurrency: concurrency}
}

// Start begins the infinite loop, processing messages concurrently.
func (w *Worker) Start(ctx context.Context) {
	var wg sync.WaitGroup

	// Spawn concurrent workers (Goroutines) to process the queue
	for i := 0; i < w.concurrency; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			log.Printf("[Worker %d] Started listening for webhooks...", workerID)
			
			for {
				select {
				case <-ctx.Done():
					log.Printf("[Worker %d] Shutting down gracefully...", workerID)
					return
				default:
					// Dequeue blocks for 5 seconds if empty, preventing tight CPU loops
					eventID, err := w.queue.Dequeue(ctx)
					if err != nil {
						log.Printf("[Worker %d] Dequeue error: %v", workerID, err)
						continue
					}
					if eventID == "" {
						continue // Timeout, loop again
					}

					// Execute the pure Application Use Case
					if err := w.dispatchUC.Execute(ctx, eventID); err != nil {
						log.Printf("[Worker %d] Dispatch failed for event %s: %v", workerID, eventID, err)
					}
				}
			}
		}(i)
	}

	wg.Wait()
}