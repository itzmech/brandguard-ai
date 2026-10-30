import type { Finding, FindingSeverity } from '../types';

type ReviewSummaryProps = {
  findings: Finding[];
};

const severityRows: Array<{
  severity: FindingSeverity;
  label: string;
  classes: string;
}> = [
  {
    severity: 'high',
    label: 'High risk',
    classes: 'border-rose-200 bg-rose-50/70 text-rose-800',
  },
  {
    severity: 'medium',
    label: 'Medium risk',
    classes: 'border-amber-200 bg-amber-50/70 text-amber-800',
  },
  {
    severity: 'low',
    label: 'Low risk',
    classes: 'border-emerald-200 bg-emerald-50/70 text-emerald-800',
  },
];

const categoryLabels = {
  risk: 'Compliance risk',
  unsupported_claim: 'Unsupported claim',
  needs_verification: 'Needs verification',
} as const;

export function ReviewSummary({ findings }: ReviewSummaryProps) {
  const categories = [...new Set(findings.flatMap(({ category }) => category ? [category] : []))];

  return (
    <aside
      aria-label="Review summary"
      className="rounded-xl border border-border-default bg-white shadow-sm"
    >
      <div className="border-b border-border-default p-4">
        <h2 className="text-base font-bold text-slate-900">Review Summary</h2>
      </div>

      <dl className="space-y-2.5 p-4">
        {severityRows.map(({ severity, label, classes }) => (
          <div
            key={severity}
            className={`flex items-center justify-between rounded-lg border p-3 ${classes}`}
          >
            <dt className="text-sm font-medium">{label}</dt>
            <dd className="text-sm font-bold">
              {findings.filter((finding) => finding.severity === severity).length}
            </dd>
          </div>
        ))}
      </dl>

      <section className="border-t border-border-default p-4">
        <h3 className="text-sm font-bold text-slate-900">Finding categories</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          The analysis response does not include separate check-level execution details.
        </p>
        {categories.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {categories.map((category) => (
              <li key={category} className="flex items-start gap-2 text-sm text-slate-700">
                <svg
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 12 4 4L19 6" />
                </svg>
                <span>{categoryLabels[category]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No finding categories were returned.
          </p>
        )}
      </section>
    </aside>
  );
}
