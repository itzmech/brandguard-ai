import { SeverityBadge } from './SeverityBadge';
import type { Finding } from '../types.ts';
import { canApply, getApplyDisabledReason } from '../utils.ts';

type FindingCardProps = {
  finding: Finding;
  decision: 'pending' | 'applied' | 'rejected';
  onApply: (replacement?: string) => void;
  onReject: () => void;
  disabled?: boolean;
  content?: string;
};

function getCategoryBadge(category?: string) {
  if (category === 'risk') {
    return (
      <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
        <span>🛡️</span>
        <span>Compliance Risk</span>
      </span>
    );
  }
  if (category === 'unsupported_claim') {
    return (
      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
        <span>⚠️</span>
        <span>Unsupported Claim</span>
      </span>
    );
  }
  if (category === 'needs_verification') {
    return (
      <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
        <span>🔍</span>
        <span>Needs Verification</span>
      </span>
    );
  }
  return null;
}

function getFindingTitle(finding: Finding): string {
  if (finding.category === 'needs_verification') {
    return 'Claim Requiring Source Verification';
  }
  if (finding.category === 'unsupported_claim') {
    return 'Unsupported or Superlative Claim';
  }
  if (finding.category === 'risk') {
    return 'Regulatory / Legal Compliance Risk';
  }

  const expl = finding.explanation.toLowerCase();
  const evid = finding.evidence.toLowerCase();
  if (expl.includes('superlative') || evid.includes('best')) {
    return 'Use of Superlative';
  }
  if (expl.includes('overpromising') || expl.includes('emotional') || evid.includes('amazed')) {
    return 'Overpromising Outcomes';
  }
  if (expl.includes('urgency') || expl.includes('exclamation') || evid.includes('limited time')) {
    return 'Excessive Urgency';
  }
  if (expl.includes('guarantee') || expl.includes('cure') || evid.includes('100%')) {
    return 'Unverified Absolute Claim';
  }
  if (expl.includes('regulatory') || expl.includes('fda') || expl.includes('doctor')) {
    return 'Unsubstantiated Endorsement';
  }
  return 'Compliance Finding';
}

export function FindingCard({
  finding,
  decision,
  onApply,
  onReject,
  disabled = false,
  content = '',
}: FindingCardProps) {
  const title = getFindingTitle(finding);
  const canBeApplied = canApply(finding, content);
  const disabledReason = getApplyDisabledReason(finding, content);
  const proposedReplacement =
    typeof finding.replacement === 'string' && finding.replacement.trim()
      ? finding.replacement
      : null;

  return (
    <div className="bg-white rounded-xl border border-border-default p-4 shadow-sm hover:border-slate-300 transition-all">
      {/* Top row: Badges on left, Action on right */}
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <SeverityBadge severity={finding.severity} variant="dot" />
          {getCategoryBadge(finding.category)}
        </div>
        <button
          onClick={() => onApply()}
          disabled={disabled || decision === 'applied' || !canBeApplied}
          className="border border-slate-200 bg-white hover:bg-slate-50 text-primary-blue px-2.5 py-0.5 rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title={decision === 'applied' ? 'Already applied' : !canBeApplied ? disabledReason : 'Apply suggested rewrite'}
        >
          {decision === 'applied' ? 'Applied' : canBeApplied ? 'Apply' : 'View'}
        </button>
      </div>

      {/* Title */}
      <h4 className="text-sm font-bold text-slate-900 mb-1">{title}</h4>

      {/* Explanation displayed strictly as Guidance */}
      <p className="text-xs text-slate-600 leading-relaxed mb-3">
        {finding.explanation}
      </p>

      {/* Evidence snippet */}
      <div className="flex items-center gap-1.5 text-xs mb-3 flex-wrap">
        <span className="text-slate-500 font-medium text-xs">Evidence:</span>
        <span className="bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded border border-blue-100 font-mono text-xs">
          {finding.evidence}
        </span>
      </div>

      {/* Proposed Replacement box (Only shown when a valid replacement exists and is applicable) */}
      {proposedReplacement && canBeApplied ? (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2.5 mb-3 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-emerald-800 font-semibold uppercase text-[10px] tracking-wider">
              ✨ Proposed Replacement
            </span>
            <span className="text-[10px] text-emerald-700 font-normal">Ready to insert</span>
          </div>
          <p className="text-emerald-950 font-medium font-sans">
            {proposedReplacement}
          </p>
        </div>
      ) : null}

      {/* Advisory Notice when replacement is not available or not applicable */}
      {!canBeApplied && decision !== 'applied' && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2.5 mb-3 text-xs text-amber-900">
          <span className="text-amber-800 font-semibold uppercase text-[10px] tracking-wider block mb-0.5">
            ℹ️ Advisory Finding
          </span>
          <p className="text-[11px] text-amber-800">
            {disabledReason}
          </p>
        </div>
      )}

      {finding.suggestions && finding.suggestions.length > 0 && (
        <div className="mb-3 space-y-2" aria-label="Rewrite suggestions">
          <h5 className="text-xs font-semibold text-slate-700">Rewrite suggestions</h5>
          {finding.suggestions.slice(0, 3).map((suggestion, index) => {
            const suggestionCanApply =
              !suggestion.requiresVerification &&
              canApply(finding, content, suggestion.text);
            const suggestionDisabledReason = suggestion.requiresVerification
              ? 'Verify this wording before applying it.'
              : getApplyDisabledReason(finding, content, suggestion.text);

            return (
              <div
                key={`${finding.id}-suggestion-${index}`}
                className="flex flex-col gap-2 border-t border-slate-100 pt-2 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-xs leading-relaxed text-slate-800 break-words">
                    {suggestion.text}
                  </p>
                  {suggestion.requiresVerification && (
                    <p className="mt-1 text-[11px] font-medium text-amber-800">
                      Requires evidence or verification before use.
                    </p>
                  )}
                  {!suggestionCanApply && !suggestion.requiresVerification && (
                    <p className="mt-1 text-[11px] text-amber-800">
                      {suggestionDisabledReason}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onApply(suggestion.text)}
                  disabled={
                    disabled ||
                    decision === 'applied' ||
                    !suggestionCanApply
                  }
                  className="shrink-0 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-primary-blue transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-blue disabled:cursor-not-allowed disabled:opacity-50"
                  title={
                    suggestionCanApply
                      ? 'Replace only the selected evidence with this suggestion'
                      : suggestionDisabledReason
                  }
                >
                  Apply Suggestion
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      {decision === 'pending' && (
        <div className="flex items-center gap-2 pt-1 border-t border-border-default/50">
          <button
            onClick={() => onApply()}
            disabled={disabled || !canBeApplied}
            className="flex-1 bg-primary-blue hover:bg-blue-hover text-white py-1.5 px-3 rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canBeApplied ? disabledReason : 'Apply suggested rewrite to editor'}
          >
            <span>✓</span> {canBeApplied ? 'Apply Replacement' : 'Advisory Only'}
          </button>
          <button
            onClick={onReject}
            disabled={disabled}
            className="flex-1 bg-white hover:bg-slate-50 text-slate-600 border border-border-default py-1.5 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span>✕</span> Reject
          </button>
        </div>
      )}

      {decision === 'applied' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-xs flex items-center justify-between text-emerald-800 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
              ✓
            </span>
            <span>Replacement applied to content</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-normal">Addressed</span>
        </div>
      )}

      {decision === 'rejected' && (
        <div className="bg-slate-100 border border-slate-200 rounded-lg p-2 text-xs flex items-center justify-between text-slate-600 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">✕</span>
            <span>Suggestion dismissed</span>
          </div>
          <button
            onClick={() => onApply()}
            disabled={disabled || !canBeApplied}
            className="text-primary-blue hover:underline text-[11px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={!canBeApplied ? disabledReason : 'Undo dismissal and apply replacement'}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
