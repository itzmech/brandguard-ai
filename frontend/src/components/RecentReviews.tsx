import { StatusBadge } from './StatusBadge';
import { EmptyState } from './EmptyState';
import type { Review } from '../types';

type RecentReviewsProps = {
  reviews: Review[];
  onReviewClick: (id: string) => void;
  onAllReviews: () => void;
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

export function RecentReviews({
  reviews,
  onReviewClick,
  onAllReviews,
}: RecentReviewsProps) {
  const recent = reviews.slice(0, 4);

  if (recent.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-border-default p-6 shadow-sm flex flex-col justify-between h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-slate-900">Recent Reviews</h3>
        </div>
        <EmptyState
          icon="📝"
          title="No reviews yet"
          description="Create your first content review to see activity here."
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-border-default p-6 shadow-sm flex flex-col justify-between h-full">
      <div className="flex items-center justify-between mb-2 pb-2">
        <h3 className="text-base font-bold text-slate-900">Recent Reviews</h3>
        <button
          onClick={onAllReviews}
          className="text-xs text-primary-blue hover:text-blue-hover font-semibold transition-colors cursor-pointer"
        >
          View all
        </button>
      </div>

      <div className="divide-y divide-border-default">
        {recent.map((review) => {
          const firstLine = review.content.split('\n')[0].trim();
          const title =
            firstLine.length > 40 ? firstLine.substring(0, 40) + '...' : firstLine || 'Untitled Review';
          const timeAgo = formatRelativeTime(review.updated_at);

          return (
            <div
              key={review.id}
              onClick={() => onReviewClick(review.id)}
              className="flex items-center justify-between py-3.5 hover:bg-slate-50/70 cursor-pointer transition-colors group px-1"
            >
              <div className="flex items-center gap-3 min-w-0 mr-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-primary-blue flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.75}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate group-hover:text-primary-blue transition-colors">
                    {title}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {timeAgo}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={review.status} size="sm" />
                <svg
                  className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
