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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h2 className="text-xs uppercase text-slate-500 font-medium mb-4">
        Content
      </h2>

      {/* Load sample button */}
      <button
        onClick={onLoadSample}
        disabled={disabled || isLocked}
        className="mb-3 text-sm text-indigo-600 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Load sample
      </button>

      {/* Textarea */}
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLocked}
        placeholder="Paste your marketing content here..."
        className="w-full h-72 p-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
        maxLength={5000}
      />

      {/* Character counter */}
      <div className="text-right text-sm text-slate-500 mt-1">
        {charCount} / 5000
      </div>

      {/* Run brand review button */}
      <button
        onClick={onAnalyze}
        disabled={!content.trim() || disabled || loading || isLocked}
        className="w-full mt-4 bg-indigo-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            Analyzing...
          </>
        ) : (
          "Run brand review"
        )}
      </button>

      {/* Slow server message */}
      {slowServer && (
        <p className="mt-3 text-sm text-amber-600">
          Server is waking up, please wait...
        </p>
      )}

      {/* Error message with retry button */}
      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700 mb-2">{error}</p>
          <button
            onClick={onRetry}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 space-y-2">
        {canSave && (
          <button
            onClick={onSave}
            disabled={saving || !content.trim()}
            className="w-full bg-slate-100 text-slate-700 py-2 px-4 rounded-lg font-medium hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        )}

        {canSave && (
          <button
            onClick={onSubmit}
            disabled={saving || !content.trim()}
            className="w-full bg-indigo-100 text-indigo-700 py-2 px-4 rounded-lg font-medium hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit for approval
          </button>
        )}

        <button
          onClick={onNewReview}
          disabled={saving}
          className="w-full bg-slate-100 text-slate-700 py-2 px-4 rounded-lg font-medium hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          New review
        </button>
      </div>

      {/* Saved timestamp */}
      {savedAt && (
        <p className="mt-2 text-sm text-slate-500 text-center">
          Saved at {savedAt}
        </p>
      )}

      {/* Status notices */}
      {status === "pending_approval" && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700">
          Waiting for approver.
        </div>
      )}

      {status === "approved" && (
        <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          Approved. Editing is locked.
        </div>
      )}

      {status === "changes_requested" && (
        <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
          Changes requested. Please revise and resubmit.
        </div>
      )}
    </div>
  );
}
