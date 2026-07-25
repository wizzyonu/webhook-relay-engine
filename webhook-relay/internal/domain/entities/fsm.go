package entities

import (
	"errors"
	"fmt"
	"time"
)

var ErrInvalidTransition = errors.New("invalid state transition")

func (e *WebhookEvent) TransitionTo(newStatus EventStatus) error {
	validTransitions := map[EventStatus][]EventStatus{
		StatusIngested:    {StatusQueued, StatusFailed},
		StatusQueued:      {StatusDispatching, StatusFailed},
		// ELITE FIX: Allow DISPATCHING to transition to QUEUED (for retries), SUCCESS, FAILED, or DEAD_LETTER.
		StatusDispatching: {StatusSuccess, StatusQueued, StatusFailed, StatusDeadLetter},
		StatusFailed:      {StatusQueued},      // Allows FR10: Replay
		StatusDeadLetter:  {StatusQueued},      // Allows FR10: Replay
	}

	allowed, exists := validTransitions[e.Status]
	if !exists {
		return fmt.Errorf("%w: invalid current state: %s", ErrInvalidTransition, e.Status)
	}

	for _, state := range allowed {
		if state == newStatus {
			e.Status = newStatus
			e.UpdatedAt = time.Now()
			return nil
		}
	}

	return fmt.Errorf("%w: from %s to %s", ErrInvalidTransition, e.Status, newStatus)
}