// src/features/webhook-grid/WebhookRow.tsx
import { useUIStore } from '@/store/ui-store';
import { isReplayable } from '@/domain/webhook-machine';
import type { components } from '@/api/generated/schema';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useReplayWebhook } from '@/api/hooks/use-webhooks';
import { formatTimestamp } from '@/domain/webhook-utils';

type WebhookEvent = components['schemas']['WebhookEvent'];

interface WebhookRowProps {
  event: WebhookEvent;
  style: React.CSSProperties; // Injected by Virtualizer for absolute positioning
}

export function WebhookRow({ event, style }: WebhookRowProps) {
  const openDrawer = useUIStore((state) => state.openDetailDrawer);
  const replayMutation = useReplayWebhook();

  const handleReplay = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the drawer
    replayMutation.mutate(event.id);
  };

  return (
    // Directive: CSS Compositing. We use transform for positioning to avoid layout thrashing.
    <div
      style={style}
      onClick={() => openDrawer(event.id)}
      className="absolute top-0 left-0 w-full flex items-center gap-6 h-14 px-6 
                 border-b border-divider-soft 
                 hover:bg-canvas-parchment 
                 cursor-pointer 
                 transition-colors duration-150
                 font-text text-body text-ink"
    >
      {/* Status Badge - Apple style */}
      <Badge status={event.status} />
      
      {/* Target URL - Monospace for technical feel, truncated */}
      <div className="flex-1 truncate text-[15px] font-mono text-ink-muted-80">
        {event.target_url}
      </div>
      
      {/* Timestamp - Muted, Right aligned */}
      <div className="text-[14px] text-ink-muted-48 w-24 text-right font-text tabular-nums">
        {formatTimestamp(event.created_at)}
      </div>

      {/* Replay Button - Only show if FSM allows it */}
      {isReplayable(event.status) && (
        <Button 
          variant="secondary-pill"
          size="default"
          onClick={handleReplay}
          disabled={replayMutation.isPending}
          className="shrink-0"
        >
          {replayMutation.isPending ? 'Replaying...' : 'Replay'}
        </Button>
      )}
    </div>
  );
}