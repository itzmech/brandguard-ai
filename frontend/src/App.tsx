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

  /**
   * Handle analysis request
   */
  const handleAnalyze = async () => {
    // Reset error state
    setError('');

    // Set timer for 5 seconds
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
      // Display useful error message
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

  /**
   * Handle retry of failed analysis
   */
  const handleRetry = () => {
    handleAnalyze();
  };

  /**
   * Apply a suggestion - replaces first occurrence of evidence in content
   */
  const handleApplySuggestion = (findingId: string, evidence: string, suggestion: string) => {
    // Check whether the finding's evidence exists in the current content
    if (content.includes(evidence)) {
      // Replace only its first occurrence
      const newContent = content.replace(evidence, suggestion);
      setContent(newContent);
      // Mark that finding as applied
      setDecisions(prev => ({
        ...prev,
        [findingId]: 'applied'
      }));
    } else {
      // Original text not found - don't change content, mark as applied with message
      setDecisions(prev => ({
        ...prev,
        [findingId]: 'applied'
      }));
      // Display message: "Original text not found, edit manually"
      setError('Original text not found, edit manually');
    }
  };

  /**
   * Reject a suggestion - don't modify content
   */
  const handleRejectSuggestion = (findingId: string) => {
    // Don't modify the content
    setDecisions(prev => ({
      ...prev,
      [findingId]: 'rejected'
    }));
  };

  /**
   * Handle creating a new review
   */
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

  /**
   * Handle saving a review
   */
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

  /**
   * Handle loading a review on startup
   */
  const handleLoadReview = async (id: string) => {
    setError('');
    setLoading(true);

    try {
      const result = await loadReview(id);
      setFindings(result.findings);
      setReviewStatus(result.status);
      setReviewId(result.id);
    } catch (err) {
      // Don't crash if stored review cannot be loaded
      console.log('Could not load stored review:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle submitting for approval
   */
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

  /**
   * Handle approving a review
   */
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

  /**
   * Handle requesting changes
   */
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

  /**
   * Handle new review - clears saved review ID and resets
   */
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-8 text-center">BrandGuard AI</h1>

        {/* Content Editor */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <ContentEditor
            content={content}
            onContentChange={setContent}
            onAnalyze={handleAnalyze}
            loading={loading}
            error={error}
            onRetry={handleRetry}
          />
        </div>

        {/* Findings List - only show if we have findings */}
        {findings.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Brand Issues Found</h2>
            <p className="text-gray-600 mb-4">
              {findings.length} finding(s) found
            </p>

            {/* Summary */}
            <p className="text-sm text-gray-500 mb-4">
              {findings.filter(f => f.severity === 'high').length} high,
              {findings.filter(f => f.severity === 'medium').length} medium,
              {findings.filter(f => f.severity === 'low').length} low
            </p>

            {/* Finding cards */}
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
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            <p className="mb-2">{error}</p>
            <button
              onClick={handleRetry}
              className="text-sm underline hover:no-underline"
              type="button"
            >
              Try again
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleAnalyze}
            disabled={content.trim() === '' || loading}
            className={`px-4 py-2 rounded font-medium ${
              content.trim() === '' || loading
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'}
            }`}
            type="button"
          >
            {loading ? 'Analyzing...' : 'Run brand review'}
          </button>

          {reviewStatus === 'draft' && (
            <button
              onClick={handleCreateReview}
              disabled={loading}
              className={`px-4 py-2 rounded font-medium ${
                loading ? 'bg-gray-400 text-gray-600 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}
              }`}
              type="button"
            >
              {loading ? 'Saving...' : 'Save Review'}
            </button>
          )}

          {reviewId && (
            <div className="flex space-x-2">
              <button
                onClick={handleSubmitForApproval}
                disabled={loading}
                className={`px-4 py-2 rounded font-medium ${
                  loading ? 'bg-gray-400 text-gray-600 cursor-not-allowed' : 'bg-orange-600 text-white hover:bg-orange-700'}
                }`}
                type="button"
              >
                {loading ? 'Submitting...' : 'Submit for approval'}
              </button>

              {reviewStatus === 'pending_approval' && (
                <>
                  <button
                    onClick={handleApproveReview}
                    disabled={loading}
                    className={`px-4 py-2 rounded font-medium ${
                      loading ? 'bg-gray-400 text-gray-600 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}
                    }`}
                    type="button"
                  >
                    Approve
                  </button>

                  <button
                    onClick={handleRequestChanges}
                    disabled={loading}
                    className={`px-4 py-2 rounded font-medium ${
                      loading ? 'bg-gray-400 text-gray-600 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}
                    }`}
                    type="button"
                  >
                    Request changes
                  </button>
                </>
              )}
            </div>
          )}

          {reviewStatus === 'approved' && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              <p className="font-medium">Review approved ✓</p>
              <p className="text-sm">This review has been approved</p>
            </div>
          )}

          {reviewStatus === 'changes_requested' && (
            <div className="bg-orange-100 border border-orange-400 text-orange-700 px-4 py-3 rounded">
              <p className="font-medium">Changes requested</p>
              <p className="text-sm">Editor remains editable</p>
            </div>
          )}

          <button
            onClick={handleNewReview}
            disabled={loading}
            className={`px-4 py-2 rounded font-medium ${
              loading ? 'bg-gray-400 text-gray-600 cursor-not-allowed' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}
            }`}
            type="button"
          >
            New review
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
