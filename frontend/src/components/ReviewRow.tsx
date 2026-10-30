import { StatusBadge } from './StatusBadge';
import { ReviewActionsMenu } from './ReviewActionsMenu';
import type { Review } from '../types';

type ReviewRowProps = {
  review: Review;
  onClick: (id: string) => void;
  onDelete?: (id: string) => void;
};

function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    const mins = Math.max(1, Math.floor(diff / minute));
    return `Updated ${mins} ${mins === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `Updated ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  const days = Math.floor(diff / day);
  if (days === 1) return 'Updated yesterday';
  return `Updated ${days} days ago`;
}

function formatFullDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }) + ' at ' + d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

export function ReviewRow({ review, onClick, onDelete }: ReviewRowProps) {
  const firstLine = review.content.split('\n')[0].trim();
  const title =
    firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine || 'Untitled Review';
  const timeAgo = formatRelativeTime(review.updated_at);
  const formattedDate = formatFullDate(review.updated_at);

  return (
    <tr
      onClick={() => onClick(review.id)}
      className="border-b border-border-default hover:bg-slate-50/70 cursor-pointer transition-colors group"
    >
      {/* Content / Title */}
      <td className="px-6 py-4">
        <div className="font-semibold text-slate-900 text-sm group-hover:text-primary-blue transition-colors">
          {title}
        </div>
        <div className="text-xs text-slate-400 mt-0.5">
          {timeAgo}
        </div>
      </td>

      {/* Status */}
      <td className="px-6 py-4 whitespace-nowrap">
        <StatusBadge status={review.status} size="sm" />
      </td>

      {/* Last Updated */}
      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
        {formattedDate}
      </td>

      {/* Actions */}
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="inline-flex items-center gap-2">
          {/* View button in border */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick(review.id);
            }}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-primary-blue px-3 py-1 rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            View
          </button>

          {/* More menu */}
          <ReviewActionsMenu
            onView={() => onClick(review.id)}
            onDelete={onDelete ? () => onDelete(review.id) : undefined}
          />
        </div>
      </td>
    </tr>
  );
}
