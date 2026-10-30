type ContentEditorProps = {
  content: string;
  onChange: (content: string) => void;
  onLoadSample: () => void;
  onAnalyze: () => void;
  loading: boolean;
  slowServer: boolean;
  error: string | null;
  onRetry: () => void;
  disabled: boolean;
  status: 'draft' | 'pending_approval' | 'approved' | 'changes_requested';
  hasAnalyzed: boolean;
  isReadOnly?: boolean;
};

export function ContentEditor({
  content,
  onChange,
  onLoadSample,
  onAnalyze,
  loading,
  slowServer,
  error,
  onRetry,
  disabled,
  status,
  hasAnalyzed,
  isReadOnly = false,
}: ContentEditorProps) {
  const charCount = content.length;
  const isLocked = isReadOnly || status === 'approved';

  return (
    <div className="bg-white rounded-xl border border-border-default shadow-sm p-5 flex flex-col h-full">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-border-default">
        <h3 className="text-base font-bold text-slate-900">Content</h3>
        {!isLocked && (
          <button
            onClick={onLoadSample}
            disabled={disabled}
            className="text-xs text-primary-blue hover:text-blue-hover font-semibold px-2.5 py-1 rounded-md hover:bg-blue-50 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Load sample marketing content"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Load Sample</span>
          </button>
        )}
      </div>

      {/* Textarea container */}
      <div className="relative flex-1 flex flex-col min-h-[190px]">
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLocked || disabled}
          placeholder="Paste or write marketing content here..."
          aria-label="Marketing content"
          className={`w-full flex-1 min-h-[190px] p-4 text-sm text-slate-900 border border-border-default rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 font-sans leading-relaxed transition-all placeholder:text-slate-400 ${
            isLocked ? 'bg-slate-50 cursor-not-allowed opacity-90' : 'bg-white'
          }`}
          maxLength={5000}
        />

      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs tabular-nums text-slate-500" aria-live="polite">
          {charCount} / 5000 characters
        </p>
        {!isLocked && (
          <button
            onClick={onAnalyze}
            disabled={!content.trim() || disabled || loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Analyzing Content...</span>
              </>
            ) : (
              <>
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3 4 14h7l-1 7 10-12h-7l1-6Z" />
                </svg>
                <span>{hasAnalyzed ? 'Re-analyze' : 'Analyze Content'}</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Slow server alert */}
      {slowServer && (
        <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-xs flex items-center gap-2">
          <span>⏳</span>
          <span>The compliance analysis service is waking up, thank you for waiting...</span>
        </div>
      )}

      {/* Error alert with retry */}
      {error && (
        <div className="mt-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg p-3 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={onRetry}
            className="text-rose-700 hover:text-rose-900 font-bold underline ml-2 shrink-0 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
