// src/features/replay-action/ReplayButton.tsx
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { queryKeys } from '@/api/query-keys';
import { useState } from 'react';
import type { components } from '@/api/generated/schema';

type WebhookEventStatus = components['schemas']['EventStatus'];

interface ReplayButtonProps {
  eventId: string;
  status: WebhookEventStatus;
  onReplaySuccess?: () => void;
}

/**
 * ReplayButton - Elite Implementation
 * 
 * FSM-Gated Action Button:
 * - Only ENABLED when status is 'FAILED' or 'DEAD_LETTER'
 * - DISABLED for all other states (prevents impossible actions)
 * - Optimistic UI: Flips to QUEUED instantly on click
 * - Automatic cache invalidation on success
 * 
 * Satisfies:
 * - FR10: Dashboard must provide Replay button for failed events
 * - frontend_skills.md §3B: Finite State Machines prevent impossible states
 * - backend_skills.md §5: Optimistic UI support
 */
export function ReplayButton({ eventId, status, onReplaySuccess }: ReplayButtonProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  // FSM Gate: Replay is only allowed for FAILED or DEAD_LETTER states
  const canReplay = status === 'FAILED' || status === 'DEAD_LETTER';

  const mutation = useMutation({
    mutationFn: () =>
      apiClient<components['schemas']['WebhookEvent']>(
        `/webhooks/events/${eventId}/replay`,
        { method: 'POST' }
      ),
    // Optimistic UI: Update cache BEFORE network resolves
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.webhooks.detail(eventId) });

      // Snapshot the previous value
      const previousEvent = queryClient.getQueryData(queryKeys.webhooks.detail(eventId));

      // Optimistically update to QUEUED
      queryClient.setQueryData(queryKeys.webhooks.detail(eventId), (old: any) => ({
        ...old,
        status: 'QUEUED',
        updated_at: new Date().toISOString(),
      }));

      return { previousEvent };
    },
    // Rollback on error
    onError: (err, _variables, context) => {
      if (context?.previousEvent) {
        queryClient.setQueryData(
          queryKeys.webhooks.detail(eventId),
          context.previousEvent
        );
      }
      setError(err instanceof Error ? err.message : 'Failed to replay event');
      setTimeout(() => setError(null), 5000); // Auto-clear error after 5s
    },
    // Refetch after mutation completes
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.detail(eventId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
      onReplaySuccess?.();
    },
  });

  // Render nothing if the event status doesn't allow replay
  // This enforces the FSM rule: prevent impossible states
  if (!canReplay) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        data-testid="replay-button"
        className={`
          font-text transition-all duration-150 ease-out 
          active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary-focus
          ${
            mutation.isPending
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-primary text-white hover:bg-primary/90'
          }
          rounded-pill text-[17px] px-5.5 py-2.75 shrink-0
        `}
      >
        {mutation.isPending ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Replaying...
          </span>
        ) : (
          'Replay'
        )}
      </button>
      {error && (
        <div
          data-testid="error-toast"
          className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
}