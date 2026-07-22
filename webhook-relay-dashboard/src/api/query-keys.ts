// src/api/query-keys.ts
// Centralized key factory to prevent cache collisions
export const queryKeys = {
  webhooks: {
    all: ['webhooks'] as const,
    lists: () => [...queryKeys.webhooks.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.webhooks.lists(), filters] as const,
    details: () => [...queryKeys.webhooks.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.webhooks.details(), id] as const,
  },
};