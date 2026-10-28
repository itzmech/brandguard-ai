import { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { FindingCard } from './FindingCard';
import type { Review, Finding } from '../types';

type ReviewDetailsViewProps = {
  review: Review;
  content: string;
  findings: Finding[];
  decisions: Record<string, 'pending' | 'applied' | 'rejected'>;
  onBack: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onRequestChanges: () => void;
  onApply: (finding: Finding) => void;
  onReject: (findingId: string) => void;
  onEditWorkspace: () => void;
  isApproverMode: boolean;
  saving: boolean;
};

function formatFullDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return (
      d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) +
      ' at ' +
      d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    );
  } catch {
    return dateString;
  }
}

export function ReviewDetailsView({
  review,
  content,
  findings,
  decisions,
  onBack,
  onSubmit,
  onApprove,
  onRequestChanges,
  onApply,
  onReject,
  onEditWorkspace,
  isApproverMode,
  saving,
}: ReviewDetailsViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'findings' | 'history'>('overview');
  const [copied, setCopied] = useState(false);

  const highCount = findings.filter((f) => f.severity === 'high').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;
  const lowCount = findings.filter((f) => f.severity === 'low').length;

  const handleCopyId = () => {
    navigator.clipboard.writeText(review.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyContent = () => {
    navigator.clipboard.writeText(content);
    alert('Content copied to clipboard');
  };

  const formattedUpdated = formatFullDate(review.updated_at);

  return (
    <div className="bg-white rounded-xl border border-border-default shadow-sm overflow-hidden">
      {/* Top Header Bar */}
      <div className="p-6 border-b border-border-default flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 cursor-pointer"
        >
          <span>←</span>
          <span>Back to reviews</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Approver mode buttons when pending approval */}
          {isApproverMode && review.status === 'pending_approval' && (
            <>
              <button
                onClick={onApprove}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>✓</span>
                <span>Approve</span>
              </button>
              <button
                onClick={onRequestChanges}
                disabled={saving}
                className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>←</span>
                <span>Request Changes</span>
              </button>
            </>
          )}

          {/* Submit button when draft or changes requested */}
          {(review.status === 'draft' || review.status === 'changes_requested') && (
            <button
              onClick={onSubmit}
              disabled={saving}
              className="bg-primary-blue hover:bg-blue-hover text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              Submit for Approval
            </button>
          )}

          {/* Edit in Workspace Button */}
          <button
            onClick={onEditWorkspace}
            className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Open in Workspace Editor"
          >
            ✏️ Edit Workspace
          </button>
        </div>
      </div>

      {/* Sub-navigation Tabs matching mockup */}
      <div className="px-6 pt-3 border-b border-border-default flex items-center gap-8 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 relative transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'overview'
              ? 'text-primary-blue border-b-2 border-primary-blue font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {activeTab === 'overview' && <span className="w-1.5 h-1.5 rounded-full bg-primary-blue" />}
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('findings')}
          className={`pb-3 relative transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'findings'
              ? 'text-primary-blue border-b-2 border-primary-blue font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Findings</span>
          <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 text-[10px] flex items-center justify-center font-bold">
            {findings.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 relative transition-colors cursor-pointer ${
            activeTab === 'history'
              ? 'text-primary-blue border-b-2 border-primary-blue font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>History</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-6 space-y-6">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Status & Last Updated Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-border-default">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-medium">Review Status</span>
                <StatusBadge status={review.status} />
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Last updated</span>
                <span className="font-semibold text-slate-900">{formattedUpdated}</span>
              </div>
            </div>

            {/* Content card */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-slate-900">Content</h4>
                <button
                  onClick={handleCopyContent}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors cursor-pointer"
                  title="Copy content"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </button>
              </div>

              <div className="bg-[#F8FAFC] border border-border-default rounded-xl p-4 text-sm text-slate-900 leading-relaxed font-sans">
                {content}
              </div>
            </div>

            {/* Findings Summary Cards */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 mb-3">Findings Summary</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* High */}
                <div className="bg-white border border-border-default rounded-xl p-4">
                  <div className="text-xs font-bold text-rose-600 mb-1">High</div>
                  <div className="text-2xl font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{highCount}</span>
                    {highCount > 0 && <span className="text-rose-600 text-sm">!</span>}
                  </div>
                </div>

                {/* Medium */}
                <div className="bg-white border border-border-default rounded-xl p-4">
                  <div className="text-xs font-bold text-amber-600 mb-1">Medium</div>
                  <div className="text-2xl font-bold text-slate-900">{mediumCount}</div>
                </div>

                {/* Low */}
                <div className="bg-white border border-border-default rounded-xl p-4">
                  <div className="text-xs font-bold text-blue-600 mb-1">Low</div>
                  <div className="text-2xl font-bold text-slate-900">{lowCount}</div>
                </div>
              </div>
            </div>

            {/* Review Information */}
            <div className="pt-2">
              <h4 className="text-sm font-bold text-slate-900 mb-3">Review Information</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-16">ID</span>
                  <span className="font-mono text-slate-700">• {review.id}</span>
                  <button
                    onClick={handleCopyId}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    title="Copy ID"
                  >
                    {copied ? (
                      <span className="text-emerald-600 text-[10px]">Copied!</span>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 w-16">Created</span>
                  <span className="text-slate-700">• {formattedUpdated}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FINDINGS TAB */}
        {activeTab === 'findings' && (
          <div className="space-y-4">
            {findings.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                No compliance findings recorded for this review.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {findings.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    decision={decisions[finding.id] || 'pending'}
                    onApply={() => onApply(finding)}
                    onReject={() => onReject(finding.id)}
                    disabled={review.status === 'approved'}
                    content={content}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 text-xs">
              <span className="w-2 h-2 rounded-full bg-primary-blue mt-1 shrink-0" />
              <div>
                <div className="font-semibold text-slate-900">Review status: {review.status.replace(/_/g, ' ')}</div>
                <div className="text-slate-400 mt-0.5">{formattedUpdated}</div>
              </div>
            </div>
            <div className="flex items-start gap-3 text-xs">
              <span className="w-2 h-2 rounded-full bg-slate-300 mt-1 shrink-0" />
              <div>
                <div className="font-semibold text-slate-900">Content evaluated with {findings.length} findings</div>
                <div className="text-slate-400 mt-0.5">Initial automated compliance scan</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
