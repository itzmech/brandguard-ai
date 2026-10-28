type MetricCardProps = {
  icon: React.ReactNode;
  label: string;
  value: number;
  trend?: {
    text: string;
    isPositive?: boolean;
    color?: 'emerald' | 'rose' | 'amber';
  };
  color?: 'blue' | 'indigo' | 'green' | 'amber';
  onClick?: () => void;
};

export function MetricCard({
  icon,
  label,
  value,
  trend,
  color = 'blue',
  onClick,
}: MetricCardProps) {
  const iconStyles = {
    blue: 'bg-blue-50 text-primary-blue',
    indigo: 'bg-blue-50 text-primary-blue',
    green: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  const trendColorClass =
    trend?.color === 'rose'
      ? 'text-rose-600'
      : trend?.color === 'amber'
      ? 'text-amber-600'
      : trend?.isPositive === false
      ? 'text-rose-600'
      : 'text-emerald-600';

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-border-default p-5 shadow-sm transition-all ${
        onClick ? 'cursor-pointer hover:border-slate-300 hover:shadow-md' : ''
      }`}
    >
      {/* Top row: Icon on left, Label on right */}
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-lg ${iconStyles[color]} flex items-center justify-center shrink-0`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-slate-500 truncate">
            {label}
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            {value}
          </div>
        </div>
      </div>

      {/* Bottom row: Trend */}
      {trend && (
        <div className={`mt-3 text-xs font-medium flex items-center gap-1 ${trendColorClass}`}>
          <span>{trend.text.startsWith('↑') || trend.text.startsWith('↓') ? '' : trend.isPositive === false ? '↓' : '↑'}</span>
          <span>{trend.text}</span>
        </div>
      )}
    </div>
  );
}
