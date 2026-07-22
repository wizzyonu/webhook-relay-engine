// src/components/ui/Badge.tsx
import { cn } from '@/lib/cn';
import type { components } from '@/api/generated/schema';

type EventStatus = components['schemas']['EventStatus'];

interface BadgeProps {
  status: EventStatus;
}

// Apple-style status badges with minimal chrome
const statusStyles: Record<EventStatus, string> = {
  INGESTED: "bg-canvas-parchment text-ink border-hairline",
  QUEUED: "bg-blue-50 text-primary border-blue-200",
  DISPATCHING: "bg-orange-50 text-orange-600 border-orange-200",
  SUCCESS: "bg-green-50 text-green-600 border-green-200",
  FAILED: "bg-red-50 text-red-600 border-red-200",
  DEAD_LETTER: "bg-ink text-white border-ink",
};

const statusLabels: Record<EventStatus, string> = {
  INGESTED: "Ingested",
  QUEUED: "Queued",
  DISPATCHING: "Dispatching",
  SUCCESS: "Success",
  FAILED: "Failed",
  DEAD_LETTER: "Dead Letter",
};

export function Badge({ status }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border",
        statusStyles[status]
      )}
    >
      {statusLabels[status]}
    </span>
  );
}