/**
 * Main application component
 * Root component that renders the BrandGuard AI application
 */
import { useState, useEffect } from 'react';
import ContentEditor from './components/ContentEditor';
import FindingCard from './components/FindingCard';
import { analyze, createReview, saveReview, loadReview, submitForApproval, approveReview, requestChanges } from './api';
import { Finding } from './types';

function App() {
  // Main state as specified
  const [content, setContent] = useState<string>('');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Decisions state: tracks Apply/Reject for each finding by ID
  const [decisions, setDecisions] = useState<Record<string, 'pending' | 'applied' | 'rejected'>>({});

  // Review state
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string>('draft');

  // Approver mode toggle (demo-only)
  const [isApproverMode, setIsApproverMode] = useState<boolean>(false);

  /** Handle analysis request */
  const handleAnalyze = async () => {
    setError('');

    // Set timer for 5 seconds - "Server is waking up" message
    const wakingTimer = setTimeout(() => {
      // Just ensure loading ends after 5s if still loading
      setLoading(false);
    }, 5000);

    try {
      const result = await analyze(content);
      setFindings(result.findings);

      // Initialize decisions for new findings
      const newDecisions: Record<string, 'pending' | 'applied' | 'rejected'> = {};
      result.findings.forEach((finding: Finding) => {
        if (!decisions[finding.id]) {
          newDecisions[finding.id] = 'pending';
        }
      });
      setDecisions(newDecisions);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred during analysis');
      }
    } finally {
      // Clear timer and reset loading state
      clearTimeout(wakingTimer);
      setLoading(false);
    }
  };

  /** Handle retry of failed analysis */
  const handleRetry = () => {
    handleAnalyze();
  };

  /** Apply a suggestion - replaces first occurrence of evidence in content */
  const handleApplySuggestion = (findingId: string, evidence: string, suggestion: string) => {
    if (content.includes(evidence)) {
      const newContent = content.replace(evidence, suggestion);
      setContent(newContent);
      setDecisions(prev => ({
        ...prev,
        [findingId]: 'applied'
      }));
    } else {
      setDecisions(prev => ({
        ...prev,
        [findingId]: 'applied'
      }));
      setError('Original text not found, edit manually');
    }
  };

  /** Reject a suggestion - don't modify content */
  const handleRejectSuggestion = (findingId: string) => {
    setDecisions(prev => ({
      ...prev,
      [findingId]: 'rejected'
    }));
  };

  /** Handle creating a new review */
  const handleCreateReview = async () => {
    setError('');
    setLoading(true);

    try {
      const result = await createReview(content, findings);
      setReviewId(result.id);
      setReviewStatus(result.status);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create review');
      }
    } finally {
      setLoading(false);
    }
  };

  /** Handle saving a review */
  const handleSaveReview = async () => {
    setError('');
    setLoading(true);

    try {
      if (reviewId) {
        // Subsequent save - update existing review
        await saveReview(reviewId!, content, findings);
      } else {
        // First save - create new review
        const result = await createReview(content, findings);
        setReviewId(result.id);
        setReviewStatus(result.status);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save review');
      }
    } finally {
      setLoading(false);
    }
  };

  /** Handle loading a review on startup */
  const handleLoadReview = async (id: string) => {
    setError('');
    setLoading(true);

    try {
      const result = await loadReview(id);
      setFindings(result.findings);
      setReviewStatus(result.status);
      setReviewId(result.id);
    } catch (err) {
      console.log('Could not load stored review:', err);
    } finally {
      setLoading(false);
    }
  };

  /** Handle submitting for approval */
  const handleSubmitForApproval = async () => {
    setError('');
    setLoading(true);

    try {
      // Must save latest content and findings first
      await handleSaveReview();

      // Then submit for approval
      if (reviewId) {
        const result = await submitForApproval(reviewId);
        setReviewStatus(result.status);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to submit for approval');
      }
    } finally {
      setLoading(false);
    }
  };

  /** Handle approving a review */
  const handleApproveReview = async () => {
    setError('');
    setLoading(true);

    try {
      if (reviewId) {
        const result = await approveReview(reviewId);
        setReviewStatus(result.status);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to approve review');
      }
    } finally {
      setLoading(false);
    }
  };

  /** Handle requesting changes */
  const handleRequestChanges = async () => {
    setError('');
    setLoading(true);

    try {
      if (reviewId) {
        const result = await requestChanges(reviewId);
        setReviewStatus(result.status);
      }
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to request changes');
      }
    } finally {
      setLoading(false);
    }
  };

  /** Handle new review - clears saved review ID and resets */
  const handleNewReview = () => {
    setReviewId(null);
    setReviewStatus('draft');
    setFindings([]);
    setContent('');
    setDecisions({});
    setError('');
  };

  // Load stored review on startup
  useEffect(() => {
    const storedId = localStorage.getItem('brandguard_review_id');
    if (storedId) {
      handleLoadReview(storedId);
    }
  }, []);

  /** Compute compliance score:
   *  100 - 25 per high - 10 per medium - 3 per low (only findings not applied/rejected)
   */
  const computeComplianceScore = (): number => {
    let deduction = 0;
    findings.forEach(finding => {
      // Only count findings that are not yet applied or rejected
      if (decisions[finding.id] !== 'applied' && decisions[finding.id] !== 'rejected') {
        if (finding.severity === 'high') deduction += 25;
        if (finding.severity === 'medium') deduction += 10;
        if (finding.severity === 'low') deduction += 3;
      }
    });
    return Math.max(0, 100 - deduction);
  };

  const complianceScore = computeComplianceScore();
  const highCount = findings.filter(f => f.severity === 'high').length;
  const mediumCount = findings.filter(f => f.severity === 'medium').length;
  const lowCount = findings.filter(f => f.severity === 'low').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        {/* HEADER */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">🛡️</span>
            <h1 className="text-3xl font-bold text-gray-900">BrandGuard AI</h1>
          </div>

          {/* Status pill and Approver mode toggle */}
          <div className="flex items-center gap-4">
            <span className={`inline-block px-3 py-1 rounded text-sm font-medium ${reviewStatus === 'draft' ? 'bg-gray-100 text-gray-800' : reviewStatus === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' : reviewStatus === 'approved' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
              {reviewStatus === 'draft' ? 'Draft' : reviewStatus === 'pending_approval' ? 'Pending Approval' : reviewStatus === 'approved' ? 'Approved' : 'Changes Requested'}
            </span>

            <div className="hidden sm:block">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isApproverMode}
                  onChange={e => setIsApproverMode(e.target.checked)}
                  className="rounded border-gray-400"
                />
                Approver mode
              </label>
            </div>
          </div>
        </header>

        {/* Two-column layout - stacked on mobile */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-6xl mx-auto">
          {/* Content card (left on desktop, full-width on mobile) */}
          <div className="sm:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Content</h2>

              <ContentEditor
                content={content}
                onContentChange={setContent}
                onAnalyze={handleAnalyze}
                loading={loading}
                error={error}
                onRetry={handleRetry}
              />

              {/* Action buttons row */}
              <div className="mt-6 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleAnalyze}
                  disabled={content.trim() === '' || loading}
                  className={`px-4 py-2 rounded font-medium ${content.trim() === '' || loading ? 'bg-gray-400 text-gray-600 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  type="button"
                >
                  {loading ? 'Analyzing...' : 'Run brand review'}
                </button>

                {reviewStatus === 'draft' && (
                  <button
                    onClick={handleCreateReview}
                    disabled={loading}
                    className={`px-4 py-2 rounded font-medium ${loading ? 'bg-gray-400 text-gray-600 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                    type="button"
                  >
                    {loading ? 'Saving...' : 'Save Review'}
                  </button>
                )}

                {reviewId && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSubmitForApproval}
                      disabled={loading}
                      className={`px-4 py-2 rounded font-medium ${loading ? 'bg-gray-400 text-gray-600 cursor-not-allowed' : 'bg-orange-600 text-white hover:bg-orange-700'}`}
                      type="button"
                    >
                      {loading ? 'Submitting...' : 'Submit for approval'}
                    </button>

                    {reviewStatus === 'pending_approval' && (
                      <>
                        <button
                          onClick={handleApproveReview}
                          disabled={loading}
                          className={`px-4 py-2 rounded font-medium ${loading ? 'bg-gray-400 text-gray-600 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                          type="button"
                        >
                          Approve
                        </button>
                        <button
                          onClick={handleRequestChanges}
                          disabled={loading}
                          className={`px-4 py-2 rounded font-medium ${loading ? 'bg-gray-400 text-gray-600 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-600'}`}
                          type="button"
                        >
                          Request changes
                        </button>
                      </>
                    )}
                  </div>
                )}

                {reviewStatus === 'approved' && (
                  <div className="mt-2 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                    <p className="font-medium">Review approved ✓</p>
                    <p className="text-sm">This review has been approved</p>
                  </div>
                )}

                {reviewStatus === 'changes_requested' && (
                  <div className="mt-2 bg-orange-100 border border-orange-400 text-orange-700 px-4 py-3 rounded">
                    <p className="font-medium">Changes requested</p>
                    <p className="text-sm">Editor remains editable</p>
                  </div>
                )}

                <button
                  onClick={handleNewReview}
                  disabled={loading}
                  className={`px-4 py-2 rounded font-medium ${loading ? 'bg-gray-400 text-gray-600 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
                  type="button"
                >
                  New review
                </button>
              </div>
            </div>
          </div>

          {/* Findings card (right on desktop, full-width below on mobile) */}
          <div className="sm:col-span-1 sm:mt-0 sm:mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Findings</h2>

              {/* Summary strip with pills */}
              {findings.length > 0 || isApproverMode ? (
                <div className="mb-4 flex flex-wrap gap-2">
                  {findings.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        {highCount} high
                      </span>
                      <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-sm">
                        {mediumCount} medium
                      </span>
                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                        {lowCount} low
                      </span>
                    </div>
                  )}

                  {/* "N issues detected" strip */}
                  {findings.length > 0 && (
                    <div className="ml-auto flex items-center gap-2 bg-gray-100 px-3 py-1 rounded text-sm">
                      <span className="font-medium">{findings.length} issues detected</span>
                    </div>
                  )}

                  {/* Empty / hint state */}
                  {!findings.length && !isApproverMode && (
                    <div className="mt-2 text-center text-gray-500 text-sm">
                      <p>No active findings</p>
                      <p className="mt-1">Run a review to detect brand issues</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2 text-gray-500 text-sm">
                  No active findings
                </div>
              )}

              {/* Finding cards - only show if we have findings */}
              {findings.length > 0 && (
                <div className="space-y-3">
                  {findings.map((finding: Finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      onApply={() => handleApplySuggestion(finding.id, finding.evidence, finding.suggestion)}
                      onReject={() => handleRejectSuggestion(finding.id)}
                      isApplied={decisions[finding.id] === 'applied'}
                      isRejected={decisions[finding.id] === 'rejected'}
                    />
                  ))}
                </div>
              )}

              {/* Loading state skeleton */}
              {loading && findings.length === 0 && (
                <div className="mt-4 h-px bg-gray-200 rounded animate-pulse" />
              )}
            </div>
          </div>
        </div>

        {/* COMPLIANCE SIGN-OFF BOX */}
        <div className="mt-8 bg-white rounded-lg shadow p-6 max-w-2xl mx-auto">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Compliance Sign-off</h3>
          <p className="text-lg font-medium">
            Compliance score: <span className={complianceScore >= 70 ? 'text-green-600' : complianceScore >= 40 ? 'text-yellow-600' : 'text-red-600'}>{complianceScore}%</span>
          </p>
          <p className="text-sm text-gray-500 mt-1">
            100 - 25 per high finding / 10 per medium finding / 3 per low finding
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Score counts only findings not yet applied or rejected
          </p>

          {/* Approve and Request changes buttons - only in Approver mode when pending_approval */}
          {isApproverMode && reviewStatus === 'pending_approval' && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleApproveReview}
                disabled={loading}
                className={`px-4 py-2 rounded font-medium ${loading ? 'bg-gray-400 text-gray-600 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                type="button"
              >
                Approve
              </button>
              <button
                onClick={handleRequestChanges}
                disabled={loading}
                className={`px-4 py-2 rounded font-medium ${loading ? 'bg-gray-400 text-gray-600 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
                type="button"
              >
                Request changes
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
