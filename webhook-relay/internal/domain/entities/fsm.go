package entities

import (
	"errors"
	"time" // <--- ADD THIS IMPORT
)

var (
	ErrInvalidTransition = errors.New("invalid state transition")
	ErrTerminalState     = errors.New("event is in a terminal state and cannot be modified")
)

// validTransitions defines the strict rules of our FSM.
var validTransitions = map[EventStatus][]EventStatus{
	StatusIngested:    {StatusQueued},
	StatusQueued:      {StatusDispatching},
	StatusDispatching: {StatusSuccess, StatusFailed},
	StatusFailed:      {StatusQueued, StatusDeadLetter}, // Replay moves it back to QUEUED
	StatusSuccess:     {},                               // Terminal
	StatusDeadLetter:  {},                               // Terminal
}

// CanTransitionTo enforces the FSM rules.
func (current EventStatus) CanTransitionTo(next EventStatus) bool {
	allowedStates, exists := validTransitions[current]
	if !exists {
		return false
	}
	for _, state := range allowedStates {
		if state == next {
			return true
		}
	}
	return false
}

// Transition attempts to change the state, returning an error if the FSM forbids it.
func (e *WebhookEvent) TransitionTo(newStatus EventStatus) error {
	if !e.Status.CanTransitionTo(newStatus) {
		return ErrInvalidTransition
	}
	e.Status = newStatus
	e.UpdatedAt = time.Now()
	return nil
}