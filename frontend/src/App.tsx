import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Finding, Review } from './types';
import * as api from './api';
import { applyReplacement, invalidateOverlappingFindings } from './utils';
import { Sidebar } from './components/Sidebar';
import { PageHeader } from './components/PageHeader';
import { MetricCard } from './components/MetricCard';
import { ComplianceOverview } from './components/ComplianceOverview';
import { RecentReviews } from './components/RecentReviews';
import { ReviewTable } from './components/ReviewTable';
import { ContentEditor } from './components/ContentEditor';
import { FindingCard } from './components/FindingCard';
import { StatusBadge } from './components/StatusBadge';
import { ReviewDetailsView } from './components/ReviewDetailsView';
import { TemplatesView } from './components/TemplatesView';
import { SettingsView } from './components/SettingsView';
import { samples } from './sampleContent';

type ViewMode =
  | 'dashboard'
  | 'new-review'
  | 'my-reviews'
  | 'pending'
  | 'approved'
  | 'changes-requested'
  | 'templates'
  | 'settings';

export default function App() {
  // Navigation & View state
  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  const [workspaceMode, setWorkspaceMode] = useState<'editor' | 'details'>('editor');

  // Review & Workspace state
  const [content, setContent] = useState('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slowServer, setSlowServer] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, 'pending' | 'applied' | 'rejected'>>({});
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<Review['status']>('draft');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [sampleIndex, setSampleIndex] = useState(0);

  // Settings state
  const [isApproverMode, setIsApproverMode] = useState(false);
  const [isFakeMode, setIsFakeMode] = useState<boolean>(api.getFakeMode());

  // Global Reviews List for Dashboard and Tables
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [tableLoading, setTableLoading] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Helper to load decisions persisted across page refreshes
  const loadDecisionsForReview = (id: string, currentFindings: Finding[]): Record<string, 'pending' | 'applied' | 'rejected'> => {
    try {
      const saved = localStorage.getItem(`brandguard_decisions_${id}`);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // fallback
    }
    const initial: Record<string, 'pending' | 'applied' | 'rejected'> = {};
    currentFindings.forEach((f) => {
      initial[f.id] = 'pending';
    });
    return initial;
  };

  // Helper to save decisions persisted across page refreshes
  const saveDecisionsForReview = (
    id: string | null,
    newDecisions: Record<string, 'pending' | 'applied' | 'rejected'>
  ) => {
    try {
      const key = id ? `brandguard_decisions_${id}` : 'brandguard_decisions_current';
      localStorage.setItem(key, JSON.stringify(newDecisions));
    } catch {
      // ignore
    }
  };

  // Refresh reviews list
  const refreshReviews = useCallback(async () => {
    setTableLoading(true);
    setTableError(null);
    try {
      const list = await api.listReviews();
      setAllReviews(list);
    } catch (err) {
      setTableError(err instanceof Error ? err.message : 'Failed to fetch reviews');
    } finally {
      setTableLoading(false);
    }
  }, []);

  // Initial load: fetch reviews and restore active review if present
  useEffect(() => {
    let ignore = false;
    api
      .listReviews()
      .then((list) => {
        if (!ignore) setAllReviews(list);
      })
      .catch((err) => {
        if (!ignore) setTableError(err instanceof Error ? err.message : 'Failed to fetch reviews');
      });

    const storedId = localStorage.getItem('brandguard_review_id');
    if (storedId && api.isValidReviewId(storedId)) {
      api
        .loadReview(storedId)
        .then((review) => {
          if (ignore) return;
          setContent(review.content);
          setFindings(review.findings);
          setReviewId(review.id);
          setReviewStatus(review.status);
          setHasAnalyzed(review.findings.length > 0 || review.status !== 'draft');
          const loadedDecisions = loadDecisionsForReview(review.id, review.findings);
          setDecisions(loadedDecisions);
          setWorkspaceMode(review.status === 'approved' || review.status === 'pending_approval' ? 'details' : 'editor');
        })
        .catch(() => {
          localStorage.removeItem('brandguard_review_id');
        });
    }

    return () => {
      ignore = true;
    };
  }, []);

  // Handle open review from table or recent reviews
  const handleOpenReview = async (id: string) => {
    try {
      const review = await api.loadReview(id);
      setContent(review.content);
      setFindings(review.findings);
      setReviewId(review.id);
      setReviewStatus(review.status);
      setHasAnalyzed(true);
      setError(null);

      const loadedDecisions = loadDecisionsForReview(review.id, review.findings);
      setDecisions(loadedDecisions);
      localStorage.setItem('brandguard_review_id', review.id);

      // If approved or pending approval, open in details view (matching mockup Top-Right); otherwise open in continuous editor
      if (review.status === 'approved' || review.status === 'pending_approval') {
        setWorkspaceMode('details');
      } else {
        setWorkspaceMode('editor');
      }
      setCurrentView('new-review');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not open review', 'error');
    }
  };

  // Start a fresh review
  const handleStartNewReview = () => {
    localStorage.removeItem('brandguard_review_id');
    localStorage.removeItem('brandguard_decisions_current');
    setContent('');
    setFindings([]);
    setError(null);
    setHasAnalyzed(false);
    setDecisions({});
    setReviewId(null);
    setReviewStatus('draft');
    setSavedAt(null);
    setWorkspaceMode('editor');
    setCurrentView('new-review');
  };

  // Delete review
  const handleDeleteReview = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this review?')) {
      await api.deleteReview(id);
      localStorage.removeItem(`brandguard_decisions_${id}`);
      if (reviewId === id) {
        handleStartNewReview();
      }
      refreshReviews();
      showToast('Review deleted successfully');
    }
  };

  // Handle content analysis
  const handleAnalyze = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError(null);
    setSlowServer(false);

    const timer = setTimeout(() => {
      setSlowServer(true);
    }, 5000);

    try {
      const result = await api.analyze(content);
      setFindings(result.findings);
      setHasAnalyzed(true);

      const initialDecisions: Record<string, 'pending' | 'applied' | 'rejected'> = {};
      result.findings.forEach((f) => {
        initialDecisions[f.id] = 'pending';
      });
      setDecisions(initialDecisions);
      saveDecisionsForReview(reviewId, initialDecisions);
      showToast(
        result.findings.length > 0
          ? `Analysis complete: ${result.findings.length} ${result.findings.length === 1 ? 'issue' : 'issues'} found`
          : 'Analysis complete: No brand issues found!',
        result.findings.length > 0 ? 'info' : 'success'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during analysis');
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setSlowServer(false);
    }
  };

  // Apply a finding's suggested rewrite, replacing only the flagged
  // substring with the exact replacement text. This deliberately does not insert
  // explanation or advice text.
  const handleApply = (finding: Finding, selectedReplacement?: string) => {
    const result = applyReplacement(content, finding, selectedReplacement);
    if (!result.success) {
      setError(result.reason || 'No rewrite is available for this finding. Edit manually.');
      showToast(result.reason || 'No rewrite available for this finding', 'error');
      return;
    }
    setFindings((current) =>
      invalidateOverlappingFindings(
        content,
        current,
        finding.id,
        result.evidenceStart,
        result.evidenceEnd,
        result.newContent,
        selectedReplacement
      )
    );
    setContent(result.newContent);
    setDecisions((prev) => {
      const updated = { ...prev, [finding.id]: 'applied' as const };
      saveDecisionsForReview(reviewId, updated);
      return updated;
    });
    showToast('Applied replacement rewrite to editor');
  };

  // Reject finding suggestion
  const handleReject = (findingId: string) => {
    setDecisions((prev) => {
      const updated = { ...prev, [findingId]: 'rejected' as const };
      saveDecisionsForReview(reviewId, updated);
      return updated;
    });
    showToast('Suggestion dismissed', 'info');
  };

  // Save current review (Draft)
  const saveCurrent = async (): Promise<string | null> => {
    if (!content.trim()) return null;
    setSaving(true);
    setError(null);
    try {
      let review: Review;
      if (reviewId) {
        review = await api.saveReview(reviewId, content, findings);
      } else {
        review = await api.createReview(content, findings);
      }
      localStorage.setItem('brandguard_review_id', review.id);
      setReviewId(review.id);
      setReviewStatus(review.status);

      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setSavedAt(`${hours}:${minutes}`);
      refreshReviews();
      return review.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save review');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const id = await saveCurrent();
    if (id) {
      showToast('Draft saved successfully');
    }
  };

  // Submit for approval (No wizard!)
  const handleSubmit = async () => {
    const id = await saveCurrent();
    if (!id) return;

    setSaving(true);
    setError(null);
    try {
      const review = await api.submitForApproval(id);
      setReviewStatus(review.status);
      refreshReviews();
      showToast('Review submitted for approval!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
      showToast('Failed to submit review', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Approver actions
  const handleApprove = async () => {
    if (!reviewId) return;
    setSaving(true);
    setError(null);
    try {
      const review = await api.approveReview(reviewId);
      setReviewStatus(review.status);
      refreshReviews();
      showToast('Review approved successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve review');
      showToast('Failed to approve review', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!reviewId) return;
    setSaving(true);
    setError(null);
    try {
      const review = await api.requestChanges(reviewId);
      setReviewStatus(review.status);
      refreshReviews();
      showToast('Changes requested on review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request changes');
      showToast('Failed to request changes', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Load sample content into editor
  const handleLoadSample = () => {
    setContent(samples[sampleIndex].content);
    setSampleIndex((sampleIndex + 1) % samples.length);
    showToast(`Loaded ${samples[sampleIndex].name}`);
  };

  // Choose template from Templates view
  const handleSelectTemplate = (templateContent: string) => {
    handleStartNewReview();
    setContent(templateContent);
    setWorkspaceMode('editor');
    setCurrentView('new-review');
    showToast('Template loaded into editor');
  };

  // Toggle Fake Mode
  const handleToggleFakeMode = (enabled: boolean) => {
    api.setFakeMode(enabled);
    setIsFakeMode(enabled);
    refreshReviews();
    showToast(`Switched to ${enabled ? 'Fake Mode (Local)' : 'Live API Mode'}`);
  };

  // Metrics derived from actual reviews dataset
  const metrics = useMemo(() => {
    const total = allReviews.length;
    const pending = allReviews.filter((r) => r.status === 'pending_approval').length;
    const approved = allReviews.filter((r) => r.status === 'approved').length;
    const changesRequested = allReviews.filter((r) => r.status === 'changes_requested').length;
    return { total, pending, approved, changesRequested };
  }, [allReviews]);

  // Derived Title for Review Header
  const currentReviewTitle = useMemo(() => {
    if (!reviewId) return 'New Review';
    const firstLine = content.split('\n')[0].trim();
    return firstLine ? (firstLine.length > 45 ? firstLine.substring(0, 45) + '...' : firstLine) : 'Review Details';
  }, [reviewId, content]);

  // Finding summary counts
  const highCount = findings.filter((f) => f.severity === 'high').length;
  const mediumCount = findings.filter((f) => f.severity === 'medium').length;
  const lowCount = findings.filter((f) => f.severity === 'low').length;

  const isLocked = reviewStatus === 'approved';
  const canSave = reviewStatus === 'draft' || reviewStatus === 'changes_requested';
  const canSubmit = (reviewStatus === 'draft' || reviewStatus === 'changes_requested') && content.trim().length > 0;

  // Selected review object for ReviewDetailsView
  const currentReviewObj: Review = useMemo(() => {
    const existing = allReviews.find((r) => r.id === reviewId);
    return {
      id: reviewId || 'rev-current',
      content,
      status: reviewStatus,
      findings,
      updated_at: existing ? existing.updated_at : '2024-05-20T10:30:00.000Z',
    };
  }, [reviewId, content, reviewStatus, findings, allReviews]);

  return (
    <div className="min-h-screen bg-bg-main flex font-sans antialiased text-text-primary">
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-lg shadow-xl animate-fade-in border border-slate-700">
          <span>
            {toast.type === 'success' ? '✓' : toast.type === 'error' ? '⚠️' : 'ℹ️'}
          </span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Navy Sidebar matching mockup */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'new-review') {
            handleStartNewReview();
          } else {
            setCurrentView(view as ViewMode);
          }
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* ========================================================= */}
          {/* 1. DASHBOARD VIEW (Matching Top-Left of Mockup)           */}
          {/* ========================================================= */}
          {currentView === 'dashboard' && (
            <div className="space-y-6">
              <PageHeader
                title="Good morning, Alex 👋"
                subtitle="Here's what's happening with your content reviews."
                action={
                  <button
                    onClick={handleStartNewReview}
                    className="bg-primary-blue hover:bg-blue-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>+</span>
                    <span>New Review</span>
                  </button>
                }
              />

              {/* 4 Metric Cards matching scratch_metrics.png */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <MetricCard
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                  label="Total Reviews"
                  value={metrics.total}
                  color="blue"
                  trend={{ text: '18% from last month', isPositive: true }}
                  onClick={() => setCurrentView('my-reviews')}
                />
                <MetricCard
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                  label="Pending Approval"
                  value={metrics.pending}
                  color="indigo"
                  trend={{ text: '8% from last month', isPositive: false }}
                  onClick={() => setCurrentView('pending')}
                />
                <MetricCard
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  }
                  label="Approved"
                  value={metrics.approved}
                  color="green"
                  trend={{ text: '25% from last month', isPositive: true }}
                  onClick={() => setCurrentView('approved')}
                />
                <MetricCard
                  icon={
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  }
                  label="Changes Requested"
                  value={metrics.changesRequested}
                  color="amber"
                  trend={{ text: '12% from last month', isPositive: true, color: 'amber' }}
                  onClick={() => setCurrentView('changes-requested')}
                />
              </div>

              {/* 2 Side-by-Side Sections: Recent Reviews & Compliance Overview */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
                <RecentReviews
                  reviews={allReviews}
                  onReviewClick={handleOpenReview}
                  onAllReviews={() => setCurrentView('my-reviews')}
                />
                <ComplianceOverview
                  total={metrics.total}
                  approved={metrics.approved}
                  pending={metrics.pending}
                  changesRequested={metrics.changesRequested}
                />
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. CONTINUOUS REVIEW WORKSPACE & REVIEW DETAILS           */}
          {/* CRITICAL: NO STEP-BY-STEP APPROVAL WIZARD!               */}
          {/* ========================================================= */}
          {currentView === 'new-review' && (
            <div className="space-y-6">
              {/* Explicit Demo / Fallback Mode Banner */}
              {isFakeMode && (
                <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3.5 text-xs flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🧪</span>
                    <span>
                      <strong className="font-semibold text-amber-950">Demo Mock Analyzer Active:</strong> The application is currently using local rule-based simulation. To analyze content using the live Gemini API, disable Fake Mode in Settings.
                    </span>
                  </div>
                  <button
                    onClick={() => setCurrentView('settings')}
                    className="text-amber-800 hover:text-amber-950 font-bold underline shrink-0 cursor-pointer text-xs ml-3"
                  >
                    Open Settings
                  </button>
                </div>
              )}

              {/* If review has ID and in details mode, show the ReviewDetailsView (Top-Right of Mockup) */}
              {reviewId && workspaceMode === 'details' ? (
                <ReviewDetailsView
                  review={currentReviewObj}
                  content={content}
                  findings={findings}
                  decisions={decisions}
                  onBack={() => setCurrentView('my-reviews')}
                  onSubmit={handleSubmit}
                  onApprove={handleApprove}
                  onRequestChanges={handleRequestChanges}
                  onApply={handleApply}
                  onReject={handleReject}
                  onEditWorkspace={() => setWorkspaceMode('editor')}
                  isApproverMode={isApproverMode}
                  saving={saving}
                />
              ) : (
                /* Continuous 2-Column Review Workspace (Bottom-Left of Mockup) */
                <div className="space-y-6">
                  {/* Header with Title, Status & Actions */}
                  <PageHeader
                    backButton={{
                      label: 'Back to reviews',
                      onClick: () => setCurrentView('my-reviews'),
                    }}
                    title={currentReviewTitle}
                    badge={<StatusBadge status={reviewStatus} />}
                    action={
                      <div className="flex items-center gap-2">
                        {/* Toggle to Overview if review already exists */}
                        {reviewId && (
                          <button
                            onClick={() => setWorkspaceMode('details')}
                            className="text-xs font-semibold text-slate-600 hover:text-slate-900 border border-border-default bg-white px-3 py-2 rounded-lg transition-colors cursor-pointer"
                          >
                            👁️ View Details
                          </button>
                        )}

                        {/* Approver mode buttons when pending approval */}
                        {isApproverMode && reviewStatus === 'pending_approval' && (
                          <>
                            <button
                              onClick={handleApprove}
                              disabled={saving}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <span>✓</span>
                              <span>Approve</span>
                            </button>
                            <button
                              onClick={handleRequestChanges}
                              disabled={saving}
                              className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                              <span>←</span>
                              <span>Request Changes</span>
                            </button>
                          </>
                        )}

                        {/* Submitter Save Draft button */}
                        {canSave && (
                          <button
                            onClick={handleSave}
                            disabled={saving || !content.trim()}
                            className="bg-white hover:bg-slate-50 text-slate-700 border border-border-default px-3.5 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <span>{saving ? 'Saving...' : 'Save Draft'}</span>
                          </button>
                        )}

                        {/* Submit for Approval button */}
                        {canSubmit && (
                          <button
                            onClick={handleSubmit}
                            disabled={saving}
                            className="bg-primary-blue hover:bg-blue-hover text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <span>Submit for Approval</span>
                          </button>
                        )}

                        {/* Fresh review reset */}
                        {reviewId && (
                          <button
                            onClick={handleStartNewReview}
                            className="text-xs text-slate-500 hover:text-slate-900 p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Start New Review"
                          >
                            + New
                          </button>
                        )}
                      </div>
                    }
                  />

                  {/* Timestamp feedback if saved */}
                  {savedAt && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3.5 py-2 rounded-lg flex items-center justify-between">
                      <span>✓ Draft saved at {savedAt}</span>
                      {reviewId && (
                        <span className="font-mono text-[11px] text-emerald-700">
                          ID: {reviewId}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Single Continuous Review Workspace: 2-Column Desktop matching Bottom-Left of Mockup */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column: Content Editor (7 cols) */}
                    <div className="lg:col-span-7 h-full">
                      <ContentEditor
                        content={content}
                        onChange={setContent}
                        onLoadSample={handleLoadSample}
                        onAnalyze={handleAnalyze}
                        loading={loading}
                        slowServer={slowServer}
                        error={error}
                        onRetry={handleAnalyze}
                        disabled={loading || saving}
                        status={reviewStatus}
                        isReadOnly={isLocked}
                      />
                    </div>

                    {/* Right Column: Findings Panel (5 cols) */}
                    <div className="lg:col-span-5 space-y-4">
                      <div className="bg-white rounded-xl border border-border-default shadow-sm p-5">
                        {/* Findings Header matching mockup: Findings (3) */}
                        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border-default">
                          <h3 className="text-base font-bold text-slate-900">
                            Findings {hasAnalyzed ? `(${findings.length})` : ''}
                          </h3>

                          {/* Severity breakdown chips */}
                          {hasAnalyzed && findings.length > 0 && (
                            <div className="flex items-center gap-1.5 text-xs">
                              {highCount > 0 && (
                                <span className="px-2 py-0.5 bg-red-50 text-rose-600 font-semibold rounded border border-red-200">
                                  {highCount} High
                                </span>
                              )}
                              {mediumCount > 0 && (
                                <span className="px-2 py-0.5 bg-amber-50 text-amber-600 font-semibold rounded border border-amber-200">
                                  {mediumCount} Med
                                </span>
                              )}
                              {lowCount > 0 && (
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 font-semibold rounded border border-blue-200">
                                  {lowCount} Low
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Pre-analysis Empty State */}
                        {!hasAnalyzed && !loading && (
                          <div className="py-12 px-4 text-center">
                            <div className="w-12 h-12 rounded-full bg-blue-50 text-primary-blue flex items-center justify-center mx-auto mb-3">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 mb-1">
                              Ready for Compliance Review
                            </h4>
                            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                              Paste your marketing content on the left and click &ldquo;⚡ Analyze Content&rdquo; to evaluate brand compliance and view suggested rewrites.
                            </p>
                          </div>
                        )}

                        {/* Loading State Skeleton */}
                        {loading && (
                          <div className="space-y-3 py-2">
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl animate-pulse space-y-2.5">
                              <div className="h-4 w-24 bg-slate-200 rounded" />
                              <div className="h-3 w-3/4 bg-slate-200 rounded" />
                              <div className="h-8 w-full bg-slate-200 rounded" />
                            </div>
                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl animate-pulse space-y-2.5">
                              <div className="h-4 w-20 bg-slate-200 rounded" />
                              <div className="h-3 w-2/3 bg-slate-200 rounded" />
                              <div className="h-8 w-full bg-slate-200 rounded" />
                            </div>
                          </div>
                        )}

                        {/* Zero Findings State */}
                        {hasAnalyzed && !loading && findings.length === 0 && (
                          <div className="py-10 px-4 text-center">
                            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <h4 className="text-sm font-bold text-emerald-800 mb-1">
                              No Compliance Findings
                            </h4>
                            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                              No compliance issues were flagged for this text. Content passes brand compliance guidelines.
                            </p>
                          </div>
                        )}

                        {/* Findings List matching mockup */}
                        {hasAnalyzed && !loading && findings.length > 0 && (
                          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                            {findings.map((finding) => (
                              <FindingCard
                                key={finding.id}
                                finding={finding}
                                decision={decisions[finding.id] || 'pending'}
                                onApply={(replacement) => handleApply(finding, replacement)}
                                onReject={() => handleReject(finding.id)}
                                disabled={isLocked}
                                content={content}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. MY REVIEWS VIEW (Matching Bottom-Right of Mockup)      */}
          {/* ========================================================= */}
          {currentView === 'my-reviews' && (
            <div className="space-y-6">
              <PageHeader
                title="My Reviews"
                action={
                  <button
                    onClick={handleStartNewReview}
                    className="bg-primary-blue hover:bg-blue-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>+</span>
                    <span>New Review</span>
                  </button>
                }
              />

              <ReviewTable
                reviews={allReviews}
                onRowClick={handleOpenReview}
                onDelete={handleDeleteReview}
                onNewReview={handleStartNewReview}
                loading={tableLoading}
                error={tableError}
              />
            </div>
          )}

          {/* ========================================================= */}
          {/* 4. STATUS-SPECIFIC VIEWS (Pending, Approved, Changes)     */}
          {/* ========================================================= */}
          {currentView === 'pending' && (
            <div className="space-y-6">
              <PageHeader
                title="Pending Approval"
                subtitle="Reviews awaiting reviewer sign-off before publication."
                action={
                  <button
                    onClick={handleStartNewReview}
                    className="bg-primary-blue hover:bg-blue-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  >
                    + New Review
                  </button>
                }
              />
              <ReviewTable
                reviews={allReviews}
                onRowClick={handleOpenReview}
                onDelete={handleDeleteReview}
                onNewReview={handleStartNewReview}
                loading={tableLoading}
                error={tableError}
                defaultStatusFilter="pending_approval"
              />
            </div>
          )}

          {currentView === 'approved' && (
            <div className="space-y-6">
              <PageHeader
                title="Approved Reviews"
                subtitle="Compliant marketing assets cleared for publishing."
                action={
                  <button
                    onClick={handleStartNewReview}
                    className="bg-primary-blue hover:bg-blue-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  >
                    + New Review
                  </button>
                }
              />
              <ReviewTable
                reviews={allReviews}
                onRowClick={handleOpenReview}
                onDelete={handleDeleteReview}
                onNewReview={handleStartNewReview}
                loading={tableLoading}
                error={tableError}
                defaultStatusFilter="approved"
              />
            </div>
          )}

          {currentView === 'changes-requested' && (
            <div className="space-y-6">
              <PageHeader
                title="Changes Requested"
                subtitle="Content requiring edits or clarification before approval can proceed."
                action={
                  <button
                    onClick={handleStartNewReview}
                    className="bg-primary-blue hover:bg-blue-hover text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                  >
                    + New Review
                  </button>
                }
              />
              <ReviewTable
                reviews={allReviews}
                onRowClick={handleOpenReview}
                onDelete={handleDeleteReview}
                onNewReview={handleStartNewReview}
                loading={tableLoading}
                error={tableError}
                defaultStatusFilter="changes_requested"
              />
            </div>
          )}

          {/* ========================================================= */}
          {/* 5. TEMPLATES VIEW                                         */}
          {/* ========================================================= */}
          {currentView === 'templates' && (
            <div className="space-y-6">
              <PageHeader
                title="Templates"
                subtitle="Select a marketing framework to populate the continuous review workspace."
              />
              <TemplatesView onSelectTemplate={handleSelectTemplate} />
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. SETTINGS VIEW                                          */}
          {/* ========================================================= */}
          {currentView === 'settings' && (
            <div className="space-y-6">
              <PageHeader
                title="Settings"
                subtitle="Application configuration, reviewer permissions, and data preferences."
              />
              <SettingsView
                isApproverMode={isApproverMode}
                onToggleApproverMode={setIsApproverMode}
                isFakeMode={isFakeMode}
                onToggleFakeMode={handleToggleFakeMode}
                onResetData={refreshReviews}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
