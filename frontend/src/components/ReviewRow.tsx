import { useState, useRef, useEffect } from 'react';
import { StatusBadge } from './StatusBadge';
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
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

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
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="More actions"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>

            {showMenu && (
              <div
                className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-border-default py-1 z-20"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => {
                    setShowMenu(false);
                    onClick(review.id);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>Open Review</span>
                </button>
                {onDelete && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(review.id);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Delete</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
