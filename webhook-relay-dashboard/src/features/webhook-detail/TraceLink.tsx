// src/features/webhook-detail/TraceLink.tsx
import { useState } from 'react';
import { OBSERVABILITY_URL } from '@/lib/constants';

interface TraceLinkProps {
  traceId?: string;
}

export function TraceLink({ traceId }: TraceLinkProps) {
  const [copied, setCopied] = useState(false);

  if (!traceId) return null;

  // Deep link to the internal observability platform (Jaeger/Grafana)
  const observabilityUrl = `${OBSERVABILITY_URL}?traceId=${traceId}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(traceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-between p-4 
                   bg-canvas-parchment border border-hairline rounded-lg">
      <div className="flex flex-col">
        <span className="text-[12px] font-semibold text-ink-muted-80 uppercase tracking-wide font-text">
          OpenTelemetry Trace ID
        </span>
        <code className="text-[13px] font-mono text-ink mt-1">
          {traceId}
        </code>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 text-[14px] font-medium text-primary 
                     bg-white border border-hairline rounded-pill 
                     hover:bg-canvas-parchment transition-colors font-text"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <a
          href={observabilityUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-[14px] font-medium text-white 
                     bg-primary rounded-pill 
                     hover:bg-primary-focus transition-colors font-text"
        >
          View Trace ↗
        </a>
      </div>
    </div>
  );
}