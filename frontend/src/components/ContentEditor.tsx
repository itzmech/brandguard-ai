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
      <div className="relative flex-1 flex flex-col min-h-[300px]">
        <textarea
          value={content}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLocked || disabled}
          placeholder="Paste or write marketing content here..."
          className={`w-full flex-1 p-4 pb-8 text-sm text-slate-900 border border-border-default rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-primary-blue/20 focus:border-primary-blue font-sans leading-relaxed transition-all placeholder:text-slate-400 ${
            isLocked ? 'bg-slate-50 cursor-not-allowed opacity-90' : 'bg-white'
          }`}
          maxLength={5000}
        />

        {/* Character count at bottom-right of textarea container matching mockup */}
        <div className="absolute bottom-2.5 right-3 text-xs text-slate-400 pointer-events-none font-sans">
          {charCount} / 5000
        </div>
      </div>

      {/* Analyze button matching mockup: ⚡ Analyze Content */}
      {!isLocked && (
        <div className="mt-4 pt-1">
          <button
            onClick={onAnalyze}
            disabled={!content.trim() || disabled || loading}
            className="w-full bg-primary-blue hover:bg-blue-hover text-white py-3 px-4 rounded-lg font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
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
                <span>⚡</span>
                <span>Analyze Content</span>
              </>
            )}
          </button>
        </div>
      )}

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
