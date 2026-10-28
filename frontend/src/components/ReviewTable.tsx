import { useState, useMemo } from 'react';
import { ReviewRow } from './ReviewRow';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import type { Review } from '../types';

type ReviewTableProps = {
  reviews: Review[];
  onRowClick: (id: string) => void;
  onDelete?: (id: string) => void;
  onNewReview?: () => void;
  loading?: boolean;
  error?: string | null;
  defaultStatusFilter?: string;
  showFilters?: boolean;
};

export function ReviewTable({
  reviews,
  onRowClick,
  onDelete,
  onNewReview,
  loading,
  error,
  defaultStatusFilter = 'all',
  showFilters = true,
}: ReviewTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(defaultStatusFilter);
  const [timeFilter, setTimeFilter] = useState('all');
  const [timeCutoff, setTimeCutoff] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const handleTimeFilterChange = (filter: string) => {
    setTimeFilter(filter);
    setCurrentPage(1);
    const day = 24 * 3600 * 1000;
    if (filter === '7d') {
      setTimeCutoff(Date.now() - 7 * day);
    } else if (filter === '30d') {
      setTimeCutoff(Date.now() - 30 * day);
    } else {
      setTimeCutoff(null);
    }
  };

  // Filter reviews
  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      // Search filter
      if (search.trim()) {
        const query = search.toLowerCase();
        const contentMatch = r.content.toLowerCase().includes(query);
        const statusMatch = r.status.replace(/_/g, ' ').toLowerCase().includes(query);
        if (!contentMatch && !statusMatch) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && r.status !== statusFilter) {
        return false;
      }

      // Time filter
      if (timeCutoff !== null) {
        const reviewDate = new Date(r.updated_at).getTime();
        if (reviewDate < timeCutoff) return false;
      }

      return true;
    });
  }, [reviews, search, statusFilter, timeCutoff]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageReviews = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-border-default shadow-sm p-12">
        <LoadingState message="Loading compliance reviews..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-border-default shadow-sm p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h4 className="text-base font-semibold text-slate-900 mb-1">Failed to load reviews</h4>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters bar */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Left search & filters */}
          <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5 max-w-2xl">
            {/* Search box */}
            <div className="relative flex-1">
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search reviews..."
                className="w-full pl-9 pr-4 py-2 bg-white border border-border-default rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-blue/20 focus:border-primary-blue transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 bg-white border border-border-default rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:border-primary-blue cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="changes_requested">Changes Requested</option>
              <option value="draft">Draft</option>
            </select>

            {/* Time Filter */}
            <select
              value={timeFilter}
              onChange={(e) => handleTimeFilterChange(e.target.value)}
              className="px-3 py-2 bg-white border border-border-default rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:border-primary-blue cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          {/* Right action button */}
          {onNewReview && (
            <button
              onClick={onNewReview}
              className="bg-primary-blue hover:bg-blue-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>+</span>
              <span>New Review</span>
            </button>
          )}
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-border-default shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="No reviews match your filters"
            description="Try adjusting your search terms or filter selections to find what you're looking for."
            action={{
              label: 'Clear Filters',
              onClick: () => {
                setSearch('');
                setStatusFilter('all');
                setTimeFilter('all');
                setTimeCutoff(null);
              },
            }}
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white border-b border-border-default">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500">
                      Content
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500">
                      Status
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-slate-500">
                      Last Updated
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {pageReviews.map((review) => (
                    <ReviewRow
                      key={review.id}
                      review={review}
                      onClick={onRowClick}
                      onDelete={onDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-border-default">
              {pageReviews.map((review) => {
                const firstLine = review.content.split('\n')[0].trim();
                const title = firstLine || 'Untitled Review';
                return (
                  <div
                    key={review.id}
                    onClick={() => onRowClick(review.id)}
                    className="p-4 hover:bg-slate-50 cursor-pointer space-y-2 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-sm text-slate-900 line-clamp-1">
                        {title}
                      </h4>
                      <span className="text-xs text-slate-400">View →</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
                      <span>{new Date(review.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Centered Pagination matching mockup: < 1 2 > */}
            {totalPages > 1 && (
              <div className="py-4 border-t border-border-default flex items-center justify-center gap-1.5 text-xs">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-7 h-7 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                  aria-label="Previous page"
                >
                  ‹
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      currentPage === pageNum
                        ? 'bg-primary-blue text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-7 h-7 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                  aria-label="Next page"
                >
                  ›
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
