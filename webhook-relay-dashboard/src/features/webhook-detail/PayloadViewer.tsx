// src/features/webhook-detail/PayloadViewer.tsx
import { useEffect } from 'react';
import { useJsonWorker } from '@/hooks/use-worker';
import { Skeleton } from '@/components/ui/Skeleton';

// ✅ FIX: Allow undefined and null to match the generated OpenAPI types
interface PayloadViewerProps {
  rawPayload?: object | string | null; 
}

export function PayloadViewer({ rawPayload }: PayloadViewerProps) {
  const { processJson, tokens, error, isProcessing } = useJsonWorker();

  useEffect(() => {
    // ✅ FIX: Guard against undefined/null payloads to prevent worker errors
    if (!rawPayload) return;

    const payloadString = typeof rawPayload === 'string' 
      ? rawPayload 
      : JSON.stringify(rawPayload);
      
    processJson(payloadString);
  }, [rawPayload, processJson]);

  // ✅ FIX: Render an Apple-style empty state if the payload is missing
  if (!rawPayload) {
    return (
      <div className="p-6 text-[14px] text-ink-muted-48 font-text bg-canvas-parchment rounded-lg border border-hairline text-center">
        No payload available for this event.
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="p-6 space-y-3 bg-canvas-parchment rounded-lg border border-hairline">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <Skeleton className="h-4 w-3/6" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-600 font-mono text-[13px] bg-red-50 rounded-lg border border-red-100">
        Error parsing JSON: {error}
      </div>
    );
  }

  if (!tokens) return null;

  return (
    <pre className="p-6 text-[13px] font-mono overflow-x-auto bg-canvas-parchment rounded-lg border border-hairline leading-relaxed max-h-[60vh]">
      <code>
        {tokens.map((token, i) => {
          let colorClass = 'text-ink';
          if (token.type === 'key') colorClass = 'text-primary font-semibold';
          else if (token.type === 'string') colorClass = 'text-green-700';
          else if (token.type === 'number') colorClass = 'text-blue-600';
          else if (token.type === 'boolean' || token.type === 'null') colorClass = 'text-orange-600';

          return (
            <span key={i} className={colorClass}>
              {token.value}
            </span>
          );
        })}
      </code>
    </pre>
  );
}