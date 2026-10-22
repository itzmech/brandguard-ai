/**
 * Status badge component
 * Displays review status with appropriate styling
 */
function StatusBadge({ status }: { status: string }) {
  let className = 'bg-gray-100 text-gray-800';
  let text = 'Draft';
  if (status === 'pending_approval') {
    className = 'bg-yellow-100 text-yellow-800';
    text = 'Pending Approval';
  } else if (status === 'approved') {
    className = 'bg-green-100 text-green-800';
    text = 'Approved';
  } else if (status === 'changes_requested') {
    className = 'bg-orange-100 text-orange-800';
    text = 'Changes Requested';
  }

  return (
    <span className={className}>
      {text}
    </span>
  );
}

export default StatusBadge;
