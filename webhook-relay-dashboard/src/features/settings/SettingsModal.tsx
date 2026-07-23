// src/features/settings/SettingsModal.tsx
import { useEffect, useRef, useState } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'display' | 'data' | 'api' | 'security';

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>('display');
  
  // Settings state
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [retentionDays, setRetentionDays] = useState(30);
  const [defaultRetries, setDefaultRetries] = useState(3);
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);

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

  const handleSave = () => {
    // Persist settings to localStorage
    const settings = {
      isDarkMode,
      density,
      retentionDays,
      defaultRetries,
      timeoutSeconds,
    };
    localStorage.setItem('webhook-relay-settings', JSON.stringify(settings));
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="fixed inset-0 m-0 p-0 w-full h-full max-w-3xl max-h-[90vh] mx-auto my-auto
                 bg-canvas shadow-product rounded-lg
                 backdrop:bg-surface-black/50 backdrop:backdrop-blur-sm"
      aria-label="Settings"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-hairline bg-canvas">
          <h2 className="text-[21px] font-semibold font-display tracking-[0.231px] text-ink">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-canvas-parchment transition-colors"
            aria-label="Close settings"
          >
            <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 py-3 border-b border-divider-soft bg-canvas-parchment/50">
          {(['display', 'data', 'api', 'security'] as Tab[]).map((tab) => (
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
        <main className="flex-1 overflow-y-auto p-6 bg-canvas space-y-6">
          {activeTab === 'display' && (
            <div className="space-y-6 max-w-2xl">
              <section>
                <h3 className="text-[17px] font-semibold text-ink mb-4">Appearance</h3>
                
                <div className="space-y-4">
                  {/* Dark Mode Toggle */}
                  <div className="flex items-center justify-between py-3 border-b border-divider-soft">
                    <div>
                      <div className="text-[15px] font-text text-ink">Dark Mode</div>
                      <div className="text-[14px] text-ink-muted-48">Switch between light and dark themes</div>
                    </div>
                    <button
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className={`relative w-12 h-6 rounded-full transition-colors
                        ${isDarkMode ? 'bg-primary' : 'bg-canvas-parchment border border-hairline'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform
                        ${isDarkMode ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>

                  {/* Density Toggle */}
                  <div className="flex items-center justify-between py-3 border-b border-divider-soft">
                    <div>
                      <div className="text-[15px] font-text text-ink">Density</div>
                      <div className="text-[14px] text-ink-muted-48">Adjust spacing and compactness</div>
                    </div>
                    <div className="flex gap-2">
                      {(['comfortable', 'compact'] as const).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setDensity(opt)}
                          className={`px-3 py-1.5 text-[14px] rounded-md capitalize transition-colors
                            ${density === opt
                              ? 'bg-primary text-white'
                              : 'bg-canvas-parchment text-ink-muted-80 hover:bg-white'
                            }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="space-y-6 max-w-2xl">
              <section>
                <h3 className="text-[17px] font-semibold text-ink mb-4">Data Retention</h3>
                
                <div className="space-y-4">
                  <div className="py-3 border-b border-divider-soft">
                    <div className="text-[15px] font-text text-ink mb-2">Retention Period</div>
                    <div className="text-[14px] text-ink-muted-48 mb-4">
                      How long to keep webhook event logs before automatic cleanup
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="7"
                        max="90"
                        value={retentionDays}
                        onChange={(e) => setRetentionDays(Number(e.target.value))}
                        className="flex-1 h-2 bg-canvas-parchment rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                      <span className="text-[15px] font-mono text-ink w-20 text-right">
                        {retentionDays} days
                      </span>
                    </div>
                  </div>

                  <button className="text-[14px] text-red-600 hover:text-red-700 font-text">
                    Clear All Events Now
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="space-y-6 max-w-2xl">
              <section>
                <h3 className="text-[17px] font-semibold text-ink mb-4">API Configuration</h3>
                
                <div className="space-y-4">
                  <div className="py-3 border-b border-divider-soft">
                    <div className="text-[15px] font-text text-ink mb-2">Default Retry Attempts</div>
                    <div className="text-[14px] text-ink-muted-48 mb-4">
                      Number of times to retry failed webhook deliveries
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={defaultRetries}
                      onChange={(e) => setDefaultRetries(Number(e.target.value))}
                      className="w-24 px-3 py-2 text-[15px] border border-hairline rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-focus"
                    />
                  </div>

                  <div className="py-3 border-b border-divider-soft">
                    <div className="text-[15px] font-text text-ink mb-2">Request Timeout</div>
                    <div className="text-[14px] text-ink-muted-48 mb-4">
                      Maximum time to wait for webhook delivery (seconds)
                    </div>
                    <input
                      type="number"
                      min="5"
                      max="120"
                      value={timeoutSeconds}
                      onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                      className="w-24 px-3 py-2 text-[15px] border border-hairline rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-focus"
                    />
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6 max-w-2xl">
              <section>
                <h3 className="text-[17px] font-semibold text-ink mb-4">API Keys</h3>
                
                <div className="border border-hairline rounded-lg p-4 bg-canvas-parchment">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-[15px] font-text text-ink">Production Key</div>
                      <div className="text-[12px] font-mono text-ink-muted-48 mt-1">
                        sk_live_••••••••••••••••••••••••
                      </div>
                    </div>
                    <button className="text-[14px] text-primary hover:text-primary-focus">
                      Regenerate
                    </button>
                  </div>
                  <div className="text-[12px] text-ink-muted-48">
                    Last used: 2 hours ago
                  </div>
                </div>

                <button className="w-full py-2.5 border border-dashed border-hairline rounded-lg text-[14px] text-ink-muted-80 hover:border-primary hover:text-primary transition-colors">
                  + Create New API Key
                </button>
              </section>

              <section>
                <h3 className="text-[17px] font-semibold text-ink mb-4">Signature Verification</h3>
                <div className="py-3 border-b border-divider-soft">
                  <div className="text-[15px] font-text text-ink mb-2">Enforce Signature Validation</div>
                  <div className="text-[14px] text-ink-muted-48">
                    Reject webhooks without valid cryptographic signatures
                  </div>
                </div>
              </section>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="flex items-center justify-end gap-3 px-6 py-4 border-t border-hairline bg-canvas-parchment/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-[15px] font-text text-ink-muted-80 hover:text-ink transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 text-[15px] font-text bg-primary text-white rounded-pill hover:bg-primary-focus transition-colors"
          >
            Save Changes
          </button>
        </footer>
      </div>
    </dialog>
  );
}