// src/App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import { WebhookGrid } from '@/features/webhook-grid/WebhookGrid';
import { WebhookDetailDrawer } from '@/features/webhook-detail/WebhookDetailDrawer';

// Elite Directive: Configure QueryClient with strict cache defaults
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Apple Canvas Parchment Background */}
      <div className="min-h-screen bg-canvas-parchment font-text text-ink">
        
        {/* Apple Sub-Nav (Frosted Glass) */}
        <header className="sticky top-0 z-40 bg-canvas-parchment/80 backdrop-blur-xl border-b border-hairline">
          <div className="max-w-[1440px] mx-auto px-6 h-[52px] flex items-center justify-between">
            {/* Category Name */}
            <h1 className="text-[21px] font-semibold font-display tracking-[0.231px] text-ink">
              Webhook Relay
            </h1>
            
            {/* Right-aligned Actions */}
            <div className="flex items-center gap-4">
              <button className="text-[14px] text-ink-muted-80 hover:text-ink transition-colors font-text">
                Documentation
              </button>
              {/* Dark Utility Button */}
              <button className="bg-ink text-white text-[14px] rounded-sm px-[15px] py-2 hover:bg-ink/90 active:scale-95 transition-all font-text">
                Settings
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-[1440px] mx-auto bg-canvas min-h-[calc(100vh-52px)]">
          {/* Elite Directive: Wrap the main grid in an Error Boundary for resilience */}
          <ErrorBoundary 
            fallback={(error, reset) => (
              <div className="p-8 text-center">
                <p className="text-red-600 font-display text-[21px] mb-4">Something went wrong.</p>
                <button 
                  onClick={reset}
                  className="bg-primary text-white rounded-pill px-5 py-2.5 hover:bg-primary-focus transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          >
            {/* This is the 60fps Virtualized Grid we built in Phase 2 */}
            <WebhookGrid />
          </ErrorBoundary>
        </main>

        {/* This is the Native Accessible Drawer we built in Phase 3 */}
        <WebhookDetailDrawer />
        
      </div>
    </QueryClientProvider>
  );
}