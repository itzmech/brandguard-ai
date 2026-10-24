import type { Review } from "../types";

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
  status: Review["status"];
  onSave: () => void;
  onSubmit: () => void;
  onNewReview: () => void;
  saving: boolean;
  savedAt: string | null;
};

// Content editor with all the controls for editing and analyzing content
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
  onSave,
  onSubmit,
  onNewReview,
  saving,
  savedAt,
}: ContentEditorProps) {
  const charCount = content.length;
  const isLocked = status === "approved";
  const canSave = status === "draft" || status === "changes_requested";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-900">
          Content
        </h2>
        {/* Load sample button */}
        <button
          onClick={onLoadSample}
          disabled={disabled || isLocked}
          className="text-sm text-blue-600 hover:text-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
        >
          📄 Load Sample
        </button>
      </div>

      {/* Textarea */}
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLocked}
        placeholder="Paste your marketing content here..."
        className="w-full h-80 p-4 border-2 border-slate-300 rounded-xl resize-none focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 disabled:bg-slate-50 disabled:cursor-not-allowed text-base transition-all"
        maxLength={5000}
      />

      {/* Character counter */}
      <div className="text-right text-sm font-medium text-slate-500 mt-2">
        {charCount} / 5000 characters
      </div>

      {/* Run brand review button */}
      <button
        onClick={onAnalyze}
        disabled={!content.trim() || disabled || loading || isLocked}
        className="w-full mt-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transition-all"
      >
        {loading ? (
          <>
            <span className="inline-block w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin"></span>
            Analyzing Content...
          </>
        ) : (
          <>
            <span>🔍</span>
            Run Brand Review
          </>
        )}
      </button>

      {/* Slow server message */}
      {slowServer && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⏳</span>
          <p className="text-sm text-amber-700 font-medium">
            Server is waking up, please wait...
          </p>
        </div>
      )}

      {/* Error message with retry button */}
      {error && (
        <div className="mt-4 bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-700 mb-3 font-medium">{error}</p>
          <button
            onClick={onRetry}
            className="text-sm text-white bg-red-600 hover:bg-red-700 font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            🔄 Try Again
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 space-y-3">
        {canSave && (
          <button
            onClick={onSave}
            disabled={saving || !content.trim()}
            className="w-full bg-slate-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
          >
            {saving ? "💾 Saving..." : "💾 Save Draft"}
          </button>
        )}

        {canSave && (
          <button
            onClick={onSubmit}
            disabled={saving || !content.trim()}
            className="w-full bg-indigo-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
          >
            ✓ Submit for Approval
          </button>
        )}

        <button
          onClick={onNewReview}
          disabled={saving}
          className="w-full bg-slate-200 text-slate-700 py-3 px-6 rounded-xl font-semibold hover:bg-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          ➕ New Review
        </button>
      </div>

      {/* Saved timestamp */}
      {savedAt && (
        <p className="mt-3 text-sm text-green-600 text-center font-medium bg-green-50 py-2 rounded-lg border border-green-200">
          ✓ Saved at {savedAt}
        </p>
      )}

      {/* Status notices */}
      {status === "pending_approval" && (
        <div className="mt-4 bg-amber-50 border-2 border-amber-300 rounded-xl p-4 text-sm text-amber-800 font-medium flex items-center gap-3">
          <span className="text-2xl">⏳</span>
          <span>Waiting for approver review</span>
        </div>
      )}

      {status === "approved" && (
        <div className="mt-4 bg-green-50 border-2 border-green-300 rounded-xl p-4 text-sm text-green-800 font-medium flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <span>Approved. Editing is locked.</span>
        </div>
      )}

      {status === "changes_requested" && (
        <div className="mt-4 bg-orange-50 border-2 border-orange-300 rounded-xl p-4 text-sm text-orange-800 font-medium flex items-center gap-3">
          <span className="text-2xl">📝</span>
          <span>Changes requested. Please revise and resubmit.</span>
        </div>
      )}
    </div>
  );
}
