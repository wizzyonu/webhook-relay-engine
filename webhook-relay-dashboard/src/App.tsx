// src/App.tsx - UPDATED with Settings & Documentation
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { WebhookGrid } from '@/features/webhook-grid/WebhookGrid';
import { WebhookDetailDrawer } from '@/features/webhook-detail/WebhookDetailDrawer';
import { DocumentationModal } from '@/features/documentation/DocumentationModal';
import { SettingsModal } from '@/features/settings/SettingsModal';
import { useState } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  const [isDocsOpen, setIsDocsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-canvas-parchment font-text text-ink">
        <header className="sticky top-0 z-40 bg-canvas-parchment/80 backdrop-blur-xl border-b border-hairline">
          <div className="max-w-[1440px] mx-auto px-6 h-[52px] flex items-center justify-between">
            <h1 className="text-[21px] font-semibold font-display tracking-[0.231px] text-ink">
              Webhook Relay
            </h1>
            
            <div className="flex items-center gap-4">
              {/* Documentation Button - NOW OPENS MODAL */}
              <button 
                onClick={() => setIsDocsOpen(true)}
                className="text-[14px] text-ink-muted-80 hover:text-ink transition-colors font-text cursor-pointer"
              >
                Documentation
              </button>
              
              {/* Settings Button - NOW OPENS MODAL */}
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="bg-ink text-white text-[14px] rounded-sm px-[15px] py-2 hover:bg-ink/90 active:scale-95 transition-all font-text cursor-pointer"
              >
                Settings
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-[1440px] mx-auto bg-canvas min-h-[calc(100vh-52px)]">
          <ErrorBoundary 
            fallback={(error, reset) => (
              <div className="p-8 text-center">
                <p className="text-red-600 font-display text-[21px] mb-4">Failed to load webhooks.</p>
                <p className="text-ink-muted-48 text-[14px] mb-6">{error.message}</p>
                <div className="flex gap-4 justify-center">
                  <button 
                    onClick={reset}
                    className="bg-primary text-white rounded-pill px-5 py-2.5 hover:bg-primary-focus transition-colors"
                  >
                    Retry
                  </button>
                  <button 
                    onClick={() => window.location.reload()}
                    className="bg-canvas-parchment text-ink border border-hairline rounded-pill px-5 py-2.5 hover:bg-white transition-colors"
                  >
                    Refresh Page
                  </button>
                </div>
              </div>
            )}
          >
            <WebhookGrid />
          </ErrorBoundary>
        </main>

        <WebhookDetailDrawer />
        
        {/* NEW: Documentation Modal */}
        <DocumentationModal 
          isOpen={isDocsOpen}
          onClose={() => setIsDocsOpen(false)}
        />
        
        {/* NEW: Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    </QueryClientProvider>
  );
}