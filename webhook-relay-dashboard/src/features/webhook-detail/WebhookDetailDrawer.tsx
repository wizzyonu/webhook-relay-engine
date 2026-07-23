// src/features/webhook-detail/WebhookDetailDrawer.tsx
import { useEffect, useRef } from 'react';
import { useUIStore } from '@/store/ui-store';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { queryKeys } from '@/api/query-keys';
import { PayloadViewer } from './PayloadViewer';
import { TraceLink } from './TraceLink';
import { Badge } from '@/components/ui/Badge';
import { ReplayButton } from '@/features/replay-action/ReplayButton'; // <-- ADD THIS
import type { components } from '@/api/generated/schema';

type WebhookEvent = components['schemas']['WebhookEvent'];

export function WebhookDetailDrawer() {
  const { isDetailDrawerOpen, selectedEventId, closeDetailDrawer } = useUIStore();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { data: event, isLoading } = useQuery<WebhookEvent>({
    queryKey: queryKeys.webhooks.detail(selectedEventId!),
    queryFn: () => apiClient<WebhookEvent>(`/webhooks/events/${selectedEventId}`),
    enabled: !!selectedEventId && isDetailDrawerOpen,
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isDetailDrawerOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isDetailDrawerOpen && dialog.open) {
      dialog.close();
    }
  }, [isDetailDrawerOpen]);

  useEffect(() => {
    return () => {
      if (dialogRef.current?.open) {
        dialogRef.current.close();
      }
    };
  }, []);

  return (
    <dialog 
      ref={dialogRef} 
      onClose={closeDetailDrawer}
      className="fixed top-0 right-0 h-full w-full max-w-3xl m-0 p-0 
                 bg-canvas shadow-product
                 transform transition-transform duration-300 ease-out
                 translate-x-full open:translate-x-0 
                 backdrop:bg-surface-black/50 backdrop:backdrop-blur-sm"
      aria-label="Webhook Event Details"
      data-testid="webhook-detail-drawer" // <-- ENSURE THIS EXISTS FOR TESTS
    >
      <div className="h-full flex flex-col">
        {/* Header - Apple style with Replay Action */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-hairline bg-canvas">
          <h2 className="text-[21px] font-semibold font-display tracking-[0.231px] text-ink">
            Event Details
          </h2>
          <div className="flex items-center gap-3">
            {/* ADD REPLAY BUTTON HERE: It will internally disable itself if status !== FAILED/DEAD_LETTER */}
            {event && (
              <ReplayButton 
                eventId={event.id} 
                status={event.status} 
                onReplaySuccess={closeDetailDrawer} // Optional: close drawer on success
              />
            )}
            <button 
              onClick={closeDetailDrawer}
              className="p-2 rounded-full hover:bg-canvas-parchment transition-colors"
              aria-label="Close drawer"
              data-testid="close-drawer-button"
            >
              <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-canvas">
          {isLoading ? (
            <div className="space-y-4" data-testid="grid-skeleton">
              <div className="h-6 w-1/3 bg-canvas-parchment animate-pulse rounded" />
              <div className="h-40 w-full bg-canvas-parchment animate-pulse rounded" />
            </div>
          ) : event ? (
            <>
              <TraceLink traceId={event.trace_id} />

              <div className="bg-canvas border border-hairline rounded-lg p-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <span className="text-[14px] text-ink-muted-48 font-text">Status</span>
                    <div className="mt-1" data-testid="event-status-badge">
                      <Badge status={event.status} />
                    </div>
                  </div>
                  <div>
                    <span className="text-[14px] text-ink-muted-48 font-text">Idempotency Key</span>
                    <div className="mt-1 font-mono text-[13px] text-ink break-all">{event.idempotency_key}</div>
                  </div>
                  <div>
                    <span className="text-[14px] text-ink-muted-48 font-text">Created</span>
                    <div className="mt-1 text-[15px] text-ink font-text">{new Date(event.created_at).toLocaleString()}</div>
                  </div>
                  <div>
                    <span className="text-[14px] text-ink-muted-48 font-text">Target URL</span>
                    <div className="mt-1 font-mono text-[13px] text-ink break-all">{event.target_url}</div>
                  </div>
                </div>
              </div>

              <section>
                <h3 className="text-[21px] font-semibold font-display tracking-[0.231px] text-ink mb-4">
                  Raw Payload
                </h3>
                <PayloadViewer rawPayload={event.payload} />
              </section>
            </>
          ) : null}
        </main>
      </div>
    </dialog>
  );
}