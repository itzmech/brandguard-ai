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
    <section className="panel editor-panel" aria-labelledby="content-title">
      <div className="panel-heading">
        <div>
          <h2 id="content-title">Content</h2>
          <p className="panel-subtitle">Draft or paste copy for review</p>
        </div>
        <button
          onClick={onLoadSample}
          disabled={disabled || isLocked}
          className="button button-tertiary"
        >
          Load sample
        </button>
      </div>

      <div className="field-group">
        <label className="field-label" htmlFor="review-content">Content to review</label>
        <textarea
          id="review-content"
          value={content}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLocked}
          placeholder="Paste your marketing content here..."
          maxLength={5000}
          aria-describedby="character-count"
        />
        <div className="field-footer">
          {isLocked ? <span>Approved content is locked.</span> : <span>Maximum 5,000 characters</span>}
          <span id="character-count" className="character-count">{charCount.toLocaleString()} / 5,000</span>
        </div>
      </div>

      <button
        onClick={onAnalyze}
        disabled={!content.trim() || disabled || loading || isLocked}
        className="button button-primary analyze-button"
      >
        {loading ? <><span className="button-spinner" aria-hidden="true" />Analyzing content...</> : "Run brand review"}
      </button>

      {slowServer && (
        <div className="notice notice-warning" role="status">
          <span className="notice-indicator" aria-hidden="true" />
          <p>Server is waking up. Please wait...</p>
        </div>
      )}

      {error && (
        <div className="notice notice-error" role="alert">
          <p>{error}</p>
          <button
            onClick={onRetry}
            className="button button-danger"
          >
            Try again
          </button>
        </div>
      )}

      <div className="editor-actions">
        {canSave && (
          <button
            onClick={onSave}
            disabled={saving || !content.trim()}
            className="button button-secondary"
          >
            {saving ? "Saving..." : "Save draft"}
          </button>
        )}

        {canSave && (
          <button
            onClick={onSubmit}
            disabled={saving || !content.trim()}
            className="button button-secondary"
          >
            Submit for approval
          </button>
        )}

        <button
          onClick={onNewReview}
          disabled={saving}
          className="button button-quiet"
        >
          New review
        </button>
      </div>

      {savedAt && (
        <p className="save-confirmation" role="status">
          Saved at {savedAt}
        </p>
      )}

      {status === "pending_approval" && (
        <div className="notice notice-warning" role="status">
          <span className="notice-indicator" aria-hidden="true" />
          <p>Waiting for approver review</p>
        </div>
      )}

      {status === "approved" && (
        <div className="notice notice-success" role="status">
          <span className="notice-indicator" aria-hidden="true" />
          <p>Approved. Editing is locked.</p>
        </div>
      )}

      {status === "changes_requested" && (
        <div className="notice notice-warning" role="status">
          <span className="notice-indicator" aria-hidden="true" />
          <p>Changes requested. Please revise and resubmit.</p>
        </div>
      )}
    </section>
  );
}
