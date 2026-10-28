import { useState } from 'react';
import * as api from '../api';

type SettingsViewProps = {
  isApproverMode: boolean;
  onToggleApproverMode: (val: boolean) => void;
  isFakeMode: boolean;
  onToggleFakeMode: (val: boolean) => void;
  onResetData: () => void;
};

export function SettingsView({
  isApproverMode,
  onToggleApproverMode,
  isFakeMode,
  onToggleFakeMode,
  onResetData,
}: SettingsViewProps) {
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleReset = () => {
    if (window.confirm('Reset all sample reviews back to initial seed data?')) {
      api.resetFakeStore();
      onResetData();
      setResetMessage('Sample data has been reset to defaults.');
      setTimeout(() => setResetMessage(null), 3000);
    }
  };

  const handleClear = () => {
    if (window.confirm('Clear stored local review cache?')) {
      localStorage.removeItem('brandguard_fake_reviews');
      localStorage.removeItem('brandguard_review_id');
      onResetData();
      setResetMessage('Local cache cleared.');
      setTimeout(() => setResetMessage(null), 3000);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      {/* Simulation & Mode Settings */}
      <div className="bg-white rounded-xl border border-border-default shadow-sm p-6">
        <h3 className="text-base font-bold text-text-primary mb-1">
          Review & Workflow Settings
        </h3>
        <p className="text-xs text-text-secondary mb-6">
          Configure local review capabilities and reviewer permissions.
        </p>

        <div className="space-y-4 divide-y divide-border-default">
          {/* Approver Mode */}
          <div className="flex items-center justify-between pt-4 first:pt-0">
            <div>
              <div className="text-sm font-semibold text-text-primary">
                Approver Mode
              </div>
              <div className="text-xs text-text-secondary mt-0.5">
                Enable approval and rejection controls on pending compliance reviews.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isApproverMode}
                onChange={(e) => onToggleApproverMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-blue"></div>
            </label>
          </div>

          {/* Fake Mode */}
          <div className="flex items-center justify-between pt-4">
            <div>
              <div className="text-sm font-semibold text-text-primary">
                Fake Mode (Local Data Store)
              </div>
              <div className="text-xs text-text-secondary mt-0.5">
                Runs compliance analysis and review workflows locally without requiring a live cloud backend.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isFakeMode}
                onChange={(e) => onToggleFakeMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-blue"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Backend & Environment */}
      <div className="bg-white rounded-xl border border-border-default shadow-sm p-6">
        <h3 className="text-base font-bold text-text-primary mb-1">
          Backend Configuration
        </h3>
        <p className="text-xs text-text-secondary mb-4">
          Information regarding the configured server connection.
        </p>

        <div className="space-y-3">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
            <span className="text-text-muted font-semibold uppercase text-[10px] tracking-wider block mb-1">
              Active API Endpoint
            </span>
            <code className="text-text-primary font-mono text-xs select-all">
              {import.meta.env.VITE_API_URL || 'Configured via VITE_API_URL or relative (/api)'}
            </code>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span className={`w-2 h-2 rounded-full ${isFakeMode ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              <span>
                Operating in{' '}
                <strong className="text-text-primary">
                  {isFakeMode ? 'Demo Fallback Mode (Mock Analyzer)' : 'Live Cloudflare Worker API Mode'}
                </strong>
              </span>
            </div>

            <button
              onClick={async () => {
                try {
                  const res = await api.checkHealth();
                  alert(`Health Check OK!\nService: ${res.service || 'BrandGuard API'}\nModel: ${res.model || 'Gemini'}\nAPI Key configured: ${res.has_api_key ? 'Yes' : 'No'}`);
                } catch (err) {
                  alert(`Health Check Failed:\n${err instanceof Error ? err.message : String(err)}`);
                }
              }}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md font-medium transition-colors cursor-pointer"
            >
              Test Backend Connection
            </button>
          </div>
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-white rounded-xl border border-border-default shadow-sm p-6">
        <h3 className="text-base font-bold text-text-primary mb-1">
          Data & Cache Management
        </h3>
        <p className="text-xs text-text-secondary mb-4">
          Manage locally stored mock reviews and test sessions.
        </p>

        {resetMessage && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2 rounded-lg">
            ✓ {resetMessage}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="bg-slate-100 hover:bg-slate-200 text-text-primary px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors"
          >
            Reset Default Sample Reviews
          </button>
          <button
            onClick={handleClear}
            className="bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors"
          >
            Clear Local Cache
          </button>
        </div>
      </div>
    </div>
  );
}
