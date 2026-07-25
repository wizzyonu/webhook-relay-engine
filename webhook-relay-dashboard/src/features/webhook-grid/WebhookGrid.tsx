// src/features/webhook-grid/WebhookGrid.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { useWebhooks } from '@/api/hooks/use-webhooks';
import { WebhookRow } from './WebhookRow';
import { GridSkeleton } from './GridSkeleton';
import { useRef, useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

export function WebhookGrid() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useWebhooks({ status: statusFilter });
  
  // Flatten the paginated data into a single array for the virtualizer
  const allEvents = data?.pages.flatMap((page) => page.items) ?? [];

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: allEvents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56, // Exact height of the WebhookRow (h-14 = 56px)
    overscan: 10, // Render 10 rows outside the viewport for smooth scrolling
  });

  // Infinite scroll trigger: Fetch next page when user scrolls near the bottom
  useEffect(() => {
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();
    if (!lastItem) return;

    // Trigger fetch when we are within 5 items of the end
    if (
      lastItem.index >= allEvents.length - 5 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage, isFetchingNextPage, allEvents.length, rowVirtualizer.getVirtualItems()]);

  if (isLoading) {
    return <GridSkeleton rows={15} />;
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-ink-muted-48 font-text">
        Failed to load webhooks. Please check your connection.
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={<div className="p-8 text-red-500">Grid Crashed</div>}>
      <div className="flex flex-col h-[calc(100vh-52px)]">
        {/* Status Filter Toolbar */}
        <div className="px-6 py-3 border-b border-hairline bg-canvas-parchment/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label htmlFor="status-filter" className="text-[13px] font-medium text-ink-muted-80 font-text">
              Status Filter:
            </label>
            <select
              id="status-filter"
              data-testid="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-[13px] bg-canvas border border-hairline rounded px-3 py-1.5 text-ink font-text focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="INGESTED">INGESTED</option>
              <option value="QUEUED">QUEUED</option>
              <option value="DISPATCHING">DISPATCHING</option>
              <option value="SUCCESS">SUCCESS</option>
              <option value="FAILED">FAILED</option>
              <option value="DEAD_LETTER">DEAD_LETTER</option>
            </select>
          </div>
          <span className="text-[12px] text-ink-muted-48 font-mono">
            {allEvents.length} events
          </span>
        </div>

        {/* Scrollable Virtual Grid */}
        <div 
          ref={parentRef} 
          className="flex-1 overflow-auto contain-strict bg-canvas"
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const event = allEvents[virtualRow.index];
              return (
                <WebhookRow
                  key={event.id}
                  event={event}
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                />
              );
            })}
            
            {isFetchingNextPage && (
              <div className="absolute bottom-0 left-0 w-full h-14 flex items-center justify-center bg-canvas border-t border-divider-soft">
                <span className="text-[14px] text-ink-muted-48 font-text">Loading more events...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}