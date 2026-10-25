import type { Finding } from "../types";

type FindingCardProps = {
  finding: Finding;
  decision: "pending" | "applied" | "rejected";
  onApply: () => void;
  onReject: () => void;
  disabled: boolean;
};

export function FindingCard({
  finding,
  decision,
  onApply,
  onReject,
  disabled,
}: FindingCardProps) {
  return (
    <article className={`finding-item ${decision !== "pending" ? "finding-resolved" : ""}`}>
      <div className="finding-item-header">
        <span className={`severity-badge severity-${finding.severity}`}>{finding.severity}</span>
        {decision !== "pending" && <span className={`decision-label decision-${decision}`}>{decision}</span>}
      </div>

      <blockquote className="finding-evidence">“{finding.evidence}”</blockquote>

      <div className="finding-detail">
        <h3>Why it matters</h3>
        <p>{finding.explanation}</p>
      </div>

      <div className="finding-suggestion">
        <h3>Suggested rewrite</h3>
        <p>{finding.suggestion}</p>
      </div>

      {decision === "pending" && (
        <div className="finding-actions">
          <button
            onClick={onApply}
            disabled={disabled}
            className="button button-primary"
          >
            Apply suggestion
          </button>
          <button
            onClick={onReject}
            disabled={disabled}
            className="button button-secondary"
          >
            Reject
          </button>
        </div>
      )}

      {decision === "applied" && (
        <div className="decision-detail decision-applied" role="status">
          <p>Suggestion applied to the content.</p>
          <p>Replaced with: {finding.suggestion}</p>
        </div>
      )}

      {decision === "rejected" && (
        <div className="decision-detail decision-rejected" role="status">
          <p>Finding rejected.</p>
        </div>
      )}
    </article>
  );
}
