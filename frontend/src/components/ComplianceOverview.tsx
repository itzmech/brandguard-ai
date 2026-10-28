type ComplianceOverviewProps = {
  total: number;
  approved: number;
  pending: number;
  changesRequested: number;
};

export function ComplianceOverview({
  total,
  approved,
  pending,
  changesRequested,
}: ComplianceOverviewProps) {
  if (total === 0) {
    return (
      <div className="bg-white rounded-xl border border-border-default p-6 shadow-sm flex flex-col justify-between h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900">Compliance Overview</h3>
          <span className="text-xs text-slate-400">All Time</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-900">No review records yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Status analytics and distribution will appear here once you create and review content.
          </p>
        </div>
      </div>
    );
  }

  // Calculate percentages
  const approvedPct = Math.round((approved / total) * 100);
  const pendingPct = Math.round((pending / total) * 100);
  const changesPct = Math.max(0, 100 - approvedPct - pendingPct);

  // Donut chart dimensions matching mockup
  const size = 150;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Visual segments matching the mockup:
  // Approved (primary blue), Pending (light blue/amber), Changes Requested (red/navy)
  const segments = [
    { label: 'Approved', value: approved, pct: approvedPct, color: '#145BE8', dotColor: 'bg-emerald-500' },
    { label: 'Pending Approval', value: pending, pct: pendingPct, color: '#93C5FD', dotColor: 'bg-amber-500' },
    { label: 'Changes Requested', value: changesRequested, pct: changesPct, color: '#DC2626', dotColor: 'bg-rose-500' },
  ];

  let accumulatedLength = 0;
  const paths = segments.map((seg, idx) => {
    const segmentLength = (seg.value / total) * circumference;
    const strokeDasharray = `${segmentLength} ${circumference - segmentLength}`;
    const strokeDashoffset = -accumulatedLength;
    accumulatedLength += segmentLength;

    return (
      <circle
        key={idx}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="transparent"
        stroke={seg.color}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="butt"
        className="transition-all duration-700 ease-out"
      />
    );
  });

  return (
    <div className="bg-white rounded-xl border border-border-default p-6 shadow-sm flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-4 pb-1">
        <h3 className="text-base font-bold text-slate-900">Compliance Overview</h3>
        <div className="text-xs text-slate-500 flex items-center gap-1.5 cursor-pointer hover:text-slate-700 transition-colors">
          <span>This month</span>
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
        {/* Donut chart */}
        <div className="relative shrink-0 flex items-center justify-center">
          <svg width={size} height={size} className="transform -rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="#F1F5F9"
              strokeWidth={strokeWidth}
            />
            {paths}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-3xl font-extrabold text-slate-900 leading-none tracking-tight">
              {total}
            </span>
            <span className="text-xs font-medium text-slate-400 mt-1">Total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 w-full space-y-3">
          {segments.map((seg) => (
            <div key={seg.label} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${seg.dotColor} shrink-0`} />
                <span className="font-medium text-slate-600">{seg.label}</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <span>{seg.value}</span>
                <span className="text-slate-400 font-normal">({seg.pct}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
