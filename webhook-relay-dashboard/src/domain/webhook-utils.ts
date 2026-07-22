// src/domain/webhook-utils.ts
// Pure functions for domain logic. ZERO React imports.
import type { EventStatus } from './webhook-machine';

export const getStatusColor = (status: EventStatus): string => {
  switch (status) {
    case 'SUCCESS': return 'text-green-600 bg-green-50 border-green-200';
    case 'FAILED': return 'text-red-600 bg-red-50 border-red-200';
    case 'DEAD_LETTER': return 'text-white bg-ink border-ink';
    case 'DISPATCHING': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'QUEUED': return 'text-primary bg-blue-50 border-blue-200';
    default: return 'text-ink-muted-80 bg-canvas-parchment border-hairline';
  }
};

export const formatTimestamp = (isoString: string): string => {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};