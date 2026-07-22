// src/domain/webhook-machine.ts
import { createMachine, assign } from 'xstate';
import type { components } from '@/api/generated/schema';

export type EventStatus = components['schemas']['EventStatus'];

// FIX: Changed traceId from optional (?) to explicitly allowing undefined.
// This satisfies XState v5's ContextFactory return type inference and exactOptionalPropertyTypes.
export interface WebhookContext {
  eventId: string;
  status: EventStatus;
  traceId: string | undefined;
}

export type WebhookEvents =
  | { type: 'DISPATCH' }
  | { type: 'SUCCEED'; traceId: string }
  | { type: 'FAIL' }
  | { type: 'REPLAY' }
  | { type: 'UPDATE_STATUS'; status: EventStatus };

export const webhookMachine = createMachine({
  id: 'webhook',
  types: {} as {
    context: WebhookContext;
    events: WebhookEvents;
    input: Pick<WebhookContext, 'eventId' | 'status'> & { traceId?: string };
  },
  // XState v5: Derive initial context from the input passed at instantiation
  context: ({ input }) => ({
    eventId: input.eventId,
    status: input.status,
    traceId: input.traceId, // Now perfectly matches `string | undefined`
  }),
  initial: 'INGESTED',
  states: {
    INGESTED: {
      on: {
        DISPATCH: 'QUEUED',
        UPDATE_STATUS: {
          target: 'QUEUED',
          guard: ({ event }) => event.status === 'QUEUED',
        },
      },
    },
    QUEUED: {
      on: {
        DISPATCH: 'DISPATCHING',
        UPDATE_STATUS: {
          target: 'DISPATCHING',
          guard: ({ event }) => event.status === 'DISPATCHING',
        },
      },
    },
    DISPATCHING: {
      on: {
        SUCCEED: {
          target: 'SUCCESS',
          // Capture the trace ID from the backend's success event into context
          actions: assign({ traceId: ({ event }) => event.traceId }),
        },
        FAIL: 'FAILED',
        UPDATE_STATUS: [
          {
            target: 'SUCCESS',
            guard: ({ event }) => event.status === 'SUCCESS',
          },
          {
            target: 'FAILED',
            guard: ({ event }) => event.status === 'FAILED',
          },
        ],
      },
    },
    SUCCESS: { type: 'final' },
    FAILED: {
      on: {
        REPLAY: 'QUEUED',
        UPDATE_STATUS: {
          target: 'QUEUED',
          guard: ({ event }) => event.status === 'QUEUED',
        },
      },
    },
    DEAD_LETTER: {
      on: {
        REPLAY: 'QUEUED',
        UPDATE_STATUS: {
          target: 'QUEUED',
          guard: ({ event }) => event.status === 'QUEUED',
        },
      },
    },
  },
});

// Helper for UI components to check if replay is allowed without parsing the FSM
export const isReplayable = (status: EventStatus): boolean => {
  return status === 'FAILED' || status === 'DEAD_LETTER';
};