type SeverityBadgeProps = {
  severity: 'high' | 'medium' | 'low';
  size?: 'sm' | 'md';
  variant?: 'pill' | 'dot';
};

export function SeverityBadge({
  severity,
  size = 'md',
  variant = 'dot',
}: SeverityBadgeProps) {
  const styles = {
    high: {
      bg: 'bg-red-50',
      text: 'text-severity-high',
      border: 'border-red-200',
      dot: 'bg-severity-high',
      label: 'High',
    },
    medium: {
      bg: 'bg-amber-50',
      text: 'text-severity-medium',
      border: 'border-amber-200',
      dot: 'bg-severity-medium',
      label: 'Medium',
    },
    low: {
      bg: 'bg-blue-50',
      text: 'text-severity-low',
      border: 'border-blue-200',
      dot: 'bg-severity-low',
      label: 'Low',
    },
  };

  const style = styles[severity] || styles.low;

  if (variant === 'dot') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-semibold ${style.text} text-xs`}>
        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
        <span>{style.label}</span>
      </span>
    );
  }

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-md border ${style.bg} ${style.text} ${style.border} ${sizeClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      <span>{style.label}</span>
    </span>
  );
}
