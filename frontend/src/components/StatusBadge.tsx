type StatusBadgeProps = {
  status: 'draft' | 'pending_approval' | 'approved' | 'changes_requested';
  size?: 'sm' | 'md';
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const styles: Record<
    StatusBadgeProps['status'],
    { bg: string; text: string; dot: string; label: string }
  > = {
    draft: {
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      dot: 'bg-slate-400',
      label: 'Draft',
    },
    pending_approval: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      dot: 'bg-amber-500',
      label: 'Pending Approval',
    },
    approved: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
      label: 'Approved',
    },
    changes_requested: {
      bg: 'bg-rose-50',
      text: 'text-rose-700',
      dot: 'bg-rose-500',
      label: 'Changes Requested',
    },
  };

  const current = styles[status] || styles.draft;
  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-0.5 text-xs font-medium'
      : 'px-3 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${current.bg} ${current.text} ${sizeClasses} whitespace-nowrap`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${current.dot}`} />
      <span>{current.label}</span>
    </span>
  );
}
