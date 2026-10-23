import type { Finding } from "../types";

type FindingCardProps = {
  finding: Finding;
  decision: "pending" | "applied" | "rejected";
  onApply: () => void;
  onReject: () => void;
  disabled: boolean;
};

// Card displaying a single finding with apply/reject controls
export function FindingCard({
  finding,
  decision,
  onApply,
  onReject,
  disabled,
}: FindingCardProps) {
  const severityColors = {
    high: "bg-red-100 text-red-700 border-red-200",
    medium: "bg-amber-100 text-amber-700 border-amber-200",
    low: "bg-blue-100 text-blue-700 border-blue-200",
  };

  const quoteColors = {
    high: "border-red-300",
    medium: "border-amber-300",
    low: "border-blue-300",
  };

  return (
    <div
      className={`bg-white border border-slate-200 rounded-lg p-4 ${
        decision !== "pending" ? "opacity-60" : ""
      }`}
    >
      {/* Severity badge */}
      <span
        className={`inline-block px-2 py-1 text-xs font-medium rounded border ${
          severityColors[finding.severity]
        }`}
      >
        {finding.severity.toUpperCase()}
      </span>

      {/* Evidence quote */}
      <div
        className={`mt-3 pl-3 border-l-4 ${quoteColors[finding.severity]} py-1`}
      >
        <p className="text-sm text-slate-700 italic">"{finding.evidence}"</p>
      </div>

      {/* Explanation */}
      <div className="mt-3">
        <p className="text-xs font-medium text-slate-500 uppercase mb-1">
          Why it matters
        </p>
        <p className="text-sm text-slate-700">{finding.explanation}</p>
      </div>

      {/* Suggestion */}
      <div className="mt-3 bg-green-50 border border-green-200 rounded p-3">
        <p className="text-xs font-medium text-green-700 uppercase mb-1">
          Suggested rewrite
        </p>
        <p className="text-sm text-green-800">{finding.suggestion}</p>
      </div>

      {/* Action buttons or decision status */}
      {decision === "pending" && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={onApply}
            disabled={disabled}
            className="flex-1 bg-indigo-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply
          </button>
          <button
            onClick={onReject}
            disabled={disabled}
            className="flex-1 bg-white border border-slate-300 text-slate-700 py-2 px-3 rounded text-sm font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reject
          </button>
        </div>
      )}

      {decision === "applied" && (
        <div className="mt-3 bg-green-50 border border-green-200 rounded p-2">
          <p className="text-sm text-green-700 font-medium">Applied ✓</p>
          <p className="text-xs text-green-600 mt-1">
            Replaced with: {finding.suggestion}
          </p>
        </div>
      )}

      {decision === "rejected" && (
        <div className="mt-3 bg-slate-100 border border-slate-200 rounded p-2">
          <p className="text-sm text-slate-600 font-medium">Rejected</p>
        </div>
      )}
    </div>
  );
}
