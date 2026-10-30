import { useState } from 'react';
import type { Finding, FindingDecision } from '../types';
import { SeverityBadge } from './SeverityBadge';
import { canApply, findEvidenceRange, getApplyDisabledReason } from '../utils';

type FindingCardProps = {
  finding: Finding;
  decision: FindingDecision;
  selectedReplacement?: string;
  onAccept: (replacement?: string) => void;
  onReject: () => void;
  disabled?: boolean;
  content?: string;
};

const categoryLabels = {
  risk: 'Compliance risk',
  unsupported_claim: 'Unsupported claim',
  needs_verification: 'Needs verification',
} as const;

const decisionLabels: Record<FindingDecision, string> = {
  pending: 'Needs review',
  accepted: 'Accepted',
  applied: 'Rewrite applied',
  rejected: 'Rejected',
};

export function FindingCard({
  finding,
  decision,
  selectedReplacement,
  onAccept,
  onReject,
  disabled = false,
  content = '',
}: FindingCardProps) {
  const [expanded, setExpanded] = useState(true);
  const evidenceRange = content ? findEvidenceRange(content, finding) : null;
  const suggestions = finding.suggestions ?? [];
  const directReplacement =
    typeof finding.replacement === 'string' && finding.replacement.trim()
      ? finding.replacement
      : null;
  const showDirectReplacement =
    directReplacement !== null &&
    !suggestions.some(({ text }) => text === directReplacement);
  const directReplacementCanApply = directReplacement
    ? canApply(finding, content) && decision !== 'applied'
    : false;
  const directReplacementReason = directReplacement
    ? decision === 'applied'
      ? 'This finding has already been applied. Reanalyse the content before applying it again.'
      : getApplyDisabledReason(finding, content)
    : '';
  const alreadyApplied = decision === 'applied';
  const cardTint =
    finding.severity === 'high'
      ? 'border-rose-200 bg-rose-50/30'
      : finding.severity === 'medium'
        ? 'border-amber-200 bg-amber-50/30'
        : 'border-emerald-200 bg-emerald-50/20';

  return (
    <article className={`rounded-xl border p-4 sm:p-5 shadow-sm ${cardTint}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={finding.severity} variant="pill" size="sm" />
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
              {decisionLabels[decision]}
            </span>
            {finding.category && (
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800">
                {categoryLabels[finding.category]}
              </span>
            )}
          </div>
          <p className="mt-2 break-words text-sm leading-relaxed text-slate-700">
            {finding.explanation}
          </p>
          {finding.uncertainty && (
            <p className="mt-2 text-xs leading-relaxed text-amber-800">
              Verification needed: {finding.uncertainty}
            </p>
          )}
          {!finding.uncertainty &&
            (finding.requiresVerification ||
              finding.category === 'needs_verification') && (
              <p className="mt-2 text-xs leading-relaxed text-amber-800">
                The original wording needs verification. Each alternative has its own verification status.
              </p>
            )}
          {finding.rewriteRationale && (finding.suggestions?.length ?? 0) === 0 && (
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Rewrite rationale: {finding.rewriteRationale}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`finding-details-${finding.id}`}
          onClick={() => setExpanded((isExpanded) => !isExpanded)}
          className="shrink-0 rounded-md border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </header>

      <div id={`finding-details-${finding.id}`} className="mt-4" hidden={!expanded}>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3.5">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                Why is this a concern?
              </h3>
              <p className="break-words text-sm leading-relaxed text-slate-700">
                {finding.explanation}
              </p>
            </section>

            <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-3.5">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                Original matched text
              </h3>
              <blockquote className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm leading-relaxed text-rose-950">
                {finding.evidence}
              </blockquote>
              <p className="mt-2 text-xs text-slate-500">
                {evidenceRange
                  ? `Characters ${evidenceRange.start + 1}–${evidenceRange.end}`
                  : 'Source position unavailable'}
              </p>
            </section>

          </div>

          <section className="mt-4 rounded-lg border border-violet-200 bg-violet-50/40 p-3.5 sm:p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-900">Suggested Rewrites</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Accept options independently, then apply accepted suggestions together.
              </p>
            </div>
            {suggestions.length > 0 || showDirectReplacement ? (
              <ul className="space-y-2.5">
                {showDirectReplacement && directReplacement && (
                  <li className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      {(finding.requiresVerification ||
                        finding.category === 'needs_verification') && (
                        <p className="text-xs font-medium text-amber-800">
                          Verification warning: review this wording before publishing. It remains editable after applying.
                        </p>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-slate-500">Original matched text</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                          {finding.evidence}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-violet-700">Complete proposed replacement</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                          {directReplacement}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                      {!directReplacementCanApply && directReplacementReason && (
                        <p className="max-w-56 text-xs text-amber-800">{directReplacementReason}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => onAccept()}
                        disabled={disabled || !directReplacementCanApply}
                        title={
                          directReplacementCanApply
                            ? 'Accept this rewrite for batch application'
                            : directReplacementReason
                        }
                        className="min-h-11 rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {decision === 'applied'
                          ? 'Applied'
                          : decision === 'accepted' && selectedReplacement === directReplacement
                            ? 'Accepted'
                            : 'Accept suggestion'}
                      </button>
                    </div>
                  </li>
                )}
                {suggestions.map((suggestion, index) => {
                  const canApplySuggestion =
                    !alreadyApplied &&
                    canApply(finding, content, suggestion.text);
                  const reason = alreadyApplied
                    ? 'This finding has already been applied. Reanalyse the content before applying it again.'
                    : getApplyDisabledReason(finding, content, suggestion.text);

                  return (
                    <li
                      key={`${finding.id}-suggestion-${index}`}
                      className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-500">Original matched text</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                              {finding.evidence}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-violet-700">Complete proposed replacement</p>
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-800">
                              {suggestion.text}
                            </p>
                          </div>
                        </div>
                        {suggestion.requiresVerification && (
                          <p className="mt-1 text-xs font-medium text-amber-800">
                            Verification warning: review this wording before publishing. You can still apply it for further editing.
                          </p>
                        )}
                        {suggestion.rationale && (
                          <p className="mt-2 text-xs leading-relaxed text-slate-600">
                            Rewrite rationale: {suggestion.rationale}
                          </p>
                        )}
                        {!canApplySuggestion && !suggestion.requiresVerification && (
                          <p className="mt-1 text-xs text-amber-800">{reason}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                        {!canApplySuggestion && (
                          <p className="max-w-56 text-xs text-amber-800">{reason}</p>
                        )}
                        <button
                          type="button"
                          onClick={() => onAccept(suggestion.text)}
                          disabled={disabled || !canApplySuggestion}
                          aria-pressed={decision === 'accepted' && selectedReplacement === suggestion.text}
                          title={canApplySuggestion ? 'Accept this rewrite for batch application' : reason}
                          className="min-h-11 rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {decision === 'applied'
                            ? 'Applied'
                            : decision === 'accepted' && selectedReplacement === suggestion.text
                              ? 'Accepted'
                              : 'Accept suggestion'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm leading-relaxed text-slate-600">
                No safe complete rewrite was returned for this finding. Review the matched text and edit the content manually if needed.
              </p>
            )}
          </section>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200/80 pt-4">
        <button
          type="button"
          onClick={onReject}
          disabled={disabled}
          aria-pressed={decision === 'rejected'}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden="true">×</span>
          {decision === 'rejected' ? 'Finding Rejected' : 'Reject Finding'}
        </button>
      </div>
    </article>
  );
}
