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
    high: "bg-red-50 text-red-700 border-red-300",
    medium: "bg-amber-50 text-amber-700 border-amber-300",
    low: "bg-blue-50 text-blue-700 border-blue-300",
  };

  const quoteColors = {
    high: "border-red-400 bg-red-50",
    medium: "border-amber-400 bg-amber-50",
    low: "border-blue-400 bg-blue-50",
  };

  return (
    <div
      className={`bg-gradient-to-br from-white to-slate-50 border-2 border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all ${
        decision !== "pending" ? "opacity-70" : ""
      }`}
    >
      {/* Severity badge */}
      <span
        className={`inline-block px-4 py-1.5 text-xs font-bold rounded-lg border-2 ${
          severityColors[finding.severity]
        }`}
      >
        {finding.severity.toUpperCase()}
      </span>

      {/* Evidence quote */}
      <div
        className={`mt-4 pl-4 pr-4 py-3 border-l-4 rounded-r-lg ${quoteColors[finding.severity]}`}
      >
        <p className="text-sm text-slate-800 italic font-medium">"{finding.evidence}"</p>
      </div>

      {/* Explanation */}
      <div className="mt-4">
        <p className="text-xs font-bold text-slate-600 uppercase mb-2 tracking-wide">
          Why it matters
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">{finding.explanation}</p>
      </div>

      {/* Suggestion */}
      <div className="mt-4 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4">
        <p className="text-xs font-bold text-green-800 uppercase mb-2 tracking-wide">
          ✨ Suggested rewrite
        </p>
        <p className="text-sm text-green-900 font-medium">{finding.suggestion}</p>
      </div>

      {/* Action buttons or decision status */}
      {decision === "pending" && (
        <div className="mt-5 flex gap-3">
          <button
            onClick={onApply}
            disabled={disabled}
            className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg text-sm font-bold hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
          >
            ✓ Apply
          </button>
          <button
            onClick={onReject}
            disabled={disabled}
            className="flex-1 bg-white border-2 border-slate-300 text-slate-700 py-3 px-4 rounded-lg text-sm font-bold hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            ✗ Reject
          </button>
        </div>
      )}

      {decision === "applied" && (
        <div className="mt-4 bg-green-50 border-2 border-green-300 rounded-lg p-4">
          <p className="text-sm text-green-800 font-bold flex items-center gap-2">
            <span className="text-lg">✅</span>
            Applied Successfully
          </p>
          <p className="text-xs text-green-700 mt-2">
            Replaced with: {finding.suggestion}
          </p>
        </div>
      )}

      {decision === "rejected" && (
        <div className="mt-4 bg-slate-100 border-2 border-slate-300 rounded-lg p-4">
          <p className="text-sm text-slate-700 font-bold flex items-center gap-2">
            <span className="text-lg">❌</span>
            Rejected
          </p>
        </div>
      )}
    </div>
  );
}
