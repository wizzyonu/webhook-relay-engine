// src/features/webhook-grid/GridSkeleton.tsx
import { Skeleton } from '@/components/ui/Skeleton';

// Matches the EXACT height (56px) and layout of the WebhookRow to guarantee Zero CLS
export function GridSkeleton({ rows = 15 }: { rows?: number }) {
  return (
    <div className="w-full bg-canvas">
      {Array.from({ length: rows }).map((_, i) => (
        <div 
          key={i} 
          className="flex items-center gap-6 h-14 px-6 border-b border-divider-soft"
        >
          {/* Status Badge Placeholder */}
          <Skeleton className="h-6 w-20 rounded-pill" /> 
          
          {/* Target URL Placeholder */}
          <Skeleton className="h-4 flex-1 rounded-sm" /> 
          
          {/* Timestamp Placeholder */}
          <Skeleton className="h-4 w-24 rounded-sm" />   
          
          {/* Action Button Placeholder */}
          <Skeleton className="h-8 w-24 rounded-pill" /> 
        </div>
      ))}
    </div>
  );
}