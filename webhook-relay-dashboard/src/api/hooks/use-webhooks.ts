// src/api/hooks/use-webhooks.ts
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import { queryKeys } from '../query-keys';
import type { components } from '../generated/schema';
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants';

type PaginatedResponse = components['schemas']['PaginatedEventResponse'];
type WebhookEvent = components['schemas']['WebhookEvent'];

// Cursor-based infinite scroll for the virtualized grid
export function useWebhooks(limit: number = DEFAULT_PAGE_LIMIT) {
  return useInfiniteQuery({
    queryKey: queryKeys.webhooks.list({ limit }),
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (pageParam) params.set('cursor', pageParam);

      return apiClient<PaginatedResponse>(`/webhooks/events?${params.toString()}`);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor : undefined,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Optimistic UI mutation for the Replay action
export function useReplayWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: string) => 
      apiClient<WebhookEvent>(`/webhooks/events/${eventId}/replay`, { method: 'POST' }),
    
    onMutate: async (eventId) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.webhooks.all });
      
      // Snapshot the current values
      const previousEvents = queryClient.getQueriesData({ queryKey: queryKeys.webhooks.all });

      // Optimistically update the specific event to QUEUED
      queryClient.setQueriesData({ queryKey: queryKeys.webhooks.all }, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: PaginatedResponse) => ({
            ...page,
            items: page.items.map((item) => 
              item.id === eventId ? { ...item, status: 'QUEUED' as const } : item
            ),
          })),
        };
      });

      return { previousEvents };
    },
    onError: (err, eventId, context) => {
      // Rollback to the snapshot if the backend rejects the replay
      if (context?.previousEvents) {
        for (const [queryKey, data] of context.previousEvents) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSettled: () => {
      // Always refetch after mutation to ensure server state is synced
      queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
    },
  });
}