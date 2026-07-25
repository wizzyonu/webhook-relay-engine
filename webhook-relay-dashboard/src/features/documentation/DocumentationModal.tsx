// src/features/documentation/DocumentationModal.tsx
import { useEffect, useRef, useState } from 'react';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DocTab = 'overview' | 'endpoints' | 'schemas' | 'examples';

export function DocumentationModal({ isOpen, onClose }: DocumentationModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<DocTab>('overview');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (dialogRef.current?.open) {
        dialogRef.current.close();
      }
    };
  }, []);

  const endpoints: Array<{ method: string; path: string; description: string }> = [
    { method: 'POST', path: '/webhooks/ingest', description: 'Ingest a new webhook event' },
    { method: 'GET', path: '/webhooks/events', description: 'List webhook events (cursor paginated)' },
    { method: 'GET', path: '/webhooks/events/{eventId}', description: 'Get event details' },
    { method: 'POST', path: '/webhooks/events/{eventId}/replay', description: 'Replay a failed event' },
  ];

  const codeExamples = {
    curl: `# Ingest a webhook
curl -X POST http://localhost:3000/api/v1/webhooks/ingest \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Signature: sha256=..." \\
  -d '{
    "target_url": "https://api.example.com/webhook",
    "payload": { "event": "user.created" }
  }'`,
    javascript: `// Replay a failed webhook
const response = await fetch(
  'http://localhost:3000/api/v1/webhooks/events/{eventId}/replay',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'traceparent': '00-...'
    }
  }
);

const event = await response.json();
console.log('Status:', event.status); // QUEUED`,
    python: `# Fetch webhook events with cursor pagination
import requests

params = {'limit': 50}
events = []

while True:
    resp = requests.get(
        'http://localhost:3000/api/v1/webhooks/events',
        params=params
    )
    data = resp.json()
    events.extend(data['items'])
    
    if not data['has_more']:
        break
    params['cursor'] = data['next_cursor']

print(f'Loaded {len(events)} events')`,
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 m-0 p-0 w-full h-full max-w-5xl max-h-[90vh] mx-auto my-auto
                 bg-canvas shadow-product rounded-lg
                 backdrop:bg-surface-black/50 backdrop:backdrop-blur-sm"
      aria-label="API Documentation"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-hairline bg-canvas">
          <div className="flex items-center gap-4">
            <h2 className="text-[21px] font-semibold font-display tracking-[0.231px] text-ink">
              API Documentation
            </h2>
            <span className="text-[12px] text-ink-muted-48 font-mono">v1.0.0</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-canvas-parchment transition-colors"
            aria-label="Close documentation"
          >
            <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-divider-soft bg-canvas-parchment/50">
          {(['overview', 'endpoints', 'schemas', 'examples'] as DocTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-[14px] font-text rounded-md transition-colors capitalize
                ${activeTab === tab
                  ? 'bg-white text-ink shadow-sm'
                  : 'text-ink-muted-48 hover:text-ink hover:bg-white/50'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6 bg-canvas">
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-3xl">
              <section>
                <h3 className="text-[28px] font-display text-ink mb-3">Webhook Relay API</h3>
                <p className="text-[17px] text-ink-muted-80 leading-relaxed">
                  A production-grade idempotent webhook relay system with guaranteed exactly-once delivery, 
                  automatic retries, and full observability tracing.
                </p>
              </section>

              <section className="space-y-3">
                <h4 className="text-[21px] font-semibold font-display text-ink">Key Features</h4>
                <ul className="space-y-2 text-[17px] text-ink-muted-80">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span><strong>Idempotency:</strong> Prevents duplicate webhook processing with UUID-based keys</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span><strong>Cursor Pagination:</strong> Efficiently handle 100k+ events without offset degradation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span><strong>Trace Propagation:</strong> W3C traceparent headers for full-stack observability</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span><strong>Optimistic Replay:</strong> Instant UI updates with backend reconciliation</span>
                  </li>
                </ul>
              </section>

              <section className="bg-canvas-parchment rounded-lg p-6 border border-hairline">
                <h4 className="text-[17px] font-semibold text-ink mb-2">Base URL</h4>
                <code className="text-[14px] font-mono text-primary bg-white px-2 py-1 rounded">
                  http://localhost:3000/api/v1
                </code>
              </section>
            </div>
          )}

          {activeTab === 'endpoints' && (
            <div className="space-y-4 max-w-3xl">
              {endpoints.map((endpoint) => (
                <div key={endpoint.path} className="border border-hairline rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-canvas-parchment border-b border-hairline">
                    <span className={`px-2.5 py-0.5 rounded text-[12px] font-mono font-semibold
                      ${endpoint.method === 'GET' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                      {endpoint.method}
                    </span>
                    <code className="text-[14px] font-mono text-ink">{endpoint.path}</code>
                  </div>
                  <p className="px-4 py-3 text-[15px] text-ink-muted-80">{endpoint.description}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'schemas' && (
            <div className="space-y-6 max-w-3xl">
              <div className="border border-hairline rounded-lg p-6 bg-canvas-parchment">
                <h4 className="text-[17px] font-semibold text-ink mb-4">WebhookEvent Schema</h4>
                <pre className="text-[13px] font-mono text-ink-muted-80 overflow-x-auto">
                  {`{
  "id": "uuid",
  "idempotency_key": "uuid",
  "target_url": "https://...",
  "status": "INGESTED | QUEUED | DISPATCHING | SUCCESS | FAILED | DEAD_LETTER",
  "trace_id": "string",
  "payload": { ... },
  "headers": { "Content-Type": "application/json" },
  "delivery_attempts": [
    {
      "attempt_number": 1,
      "status_code": 200,
      "duration_ms": 145,
      "timestamp": "2026-07-23T10:30:00Z"
    }
  ],
  "created_at": "2026-07-23T10:30:00Z",
  "updated_at": "2026-07-23T10:30:00Z"
}`}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'examples' && (
            <div className="space-y-6 max-w-3xl">
              {Object.entries(codeExamples).map(([lang, code]) => (
                <div key={lang} className="border border-hairline rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-canvas-parchment border-b border-hairline">
                    <span className="text-[14px] font-semibold text-ink capitalize">{lang}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(code)}
                      className="text-[12px] text-primary hover:text-primary-focus"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="p-4 text-[13px] font-mono text-ink bg-white overflow-x-auto">
                    <code>{code}</code>
                  </pre>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </dialog>
  );
}