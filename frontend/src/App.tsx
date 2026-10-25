import { useState, useEffect } from "react";
import type { Finding, Review } from "./types";
import * as api from "./api";
import { ContentEditor } from "./components/ContentEditor";
import { FindingCard } from "./components/FindingCard";
import { samples } from "./sampleContent";
import "./App.css";

function App() {
  // Main state
  const [content, setContent] = useState("");
  const [findings, setFindings] = useState<Finding[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slowServer, setSlowServer] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, "pending" | "applied" | "rejected">>({});
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<Review["status"]>("draft");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isApproverMode, setIsApproverMode] = useState(false);
  const [sampleIndex, setSampleIndex] = useState(0);

  // Load existing review from localStorage on mount
  useEffect(() => {
    const storedId = localStorage.getItem("brandguard_review_id");
    if (storedId && api.isValidReviewId(storedId)) {
      api
        .loadReview(storedId)
        .then((review) => {
          setContent(review.content);
          setFindings(review.findings);
          setReviewId(review.id);
          setReviewStatus(review.status);
          setHasAnalyzed(true);
          // Initialize decisions for all findings
          const initialDecisions: Record<string, "pending" | "applied" | "rejected"> = {};
          review.findings.forEach((f) => {
            initialDecisions[f.id] = "pending";
          });
          setDecisions(initialDecisions);
        })
        .catch(() => {
          // If load fails, remove invalid id
          localStorage.removeItem("brandguard_review_id");
        });
    }
  }, []);

  // Handle analyze content
  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setSlowServer(false);

    // Show slow server message after 5 seconds
    const timer = setTimeout(() => {
      setSlowServer(true);
    }, 5000);

    try {
      const result = await api.analyze(content);
      setFindings(result.findings);
      setHasAnalyzed(true);
      // Initialize all findings as pending
      const initialDecisions: Record<string, "pending" | "applied" | "rejected"> = {};
      result.findings.forEach((f) => {
        initialDecisions[f.id] = "pending";
      });
      setDecisions(initialDecisions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setSlowServer(false);
    }
  };

  // Apply a finding suggestion
  const handleApply = (finding: Finding) => {
    if (!content.includes(finding.evidence)) {
      setError("Original text not found, edit manually");
      return;
    }
    // Replace first occurrence
    const newContent = content.replace(finding.evidence, finding.suggestion);
    setContent(newContent);
    setDecisions({ ...decisions, [finding.id]: "applied" });
  };

  // Reject a finding
  const handleReject = (findingId: string) => {
    setDecisions({ ...decisions, [findingId]: "rejected" });
  };

  // Save current review (returns the id or null on failure)
  const saveCurrent = async (): Promise<string | null> => {
    setSaving(true);
    setError(null);
    try {
      let review: Review;
      if (reviewId) {
        review = await api.saveReview(reviewId, content, findings);
      } else {
        review = await api.createReview(content, findings);
      }
      localStorage.setItem("brandguard_review_id", review.id);
      setReviewId(review.id);
      setReviewStatus(review.status);
      // Format saved time as HH:MM
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      setSavedAt(`${hours}:${minutes}`);
      return review.id;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      return null;
    } finally {
      setSaving(false);
    }
  };

  // Save button handler
  const handleSave = async () => {
    await saveCurrent();
  };

  // Submit for approval
  const handleSubmit = async () => {
    const id = await saveCurrent();
    if (!id) return;

    setSaving(true);
    setError(null);
    try {
      const review = await api.submitForApproval(id);
      setReviewStatus(review.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSaving(false);
    }
  };

  // Start new review
  const handleNewReview = () => {
    localStorage.removeItem("brandguard_review_id");
    setContent("");
    setFindings([]);
    setError(null);
    setHasAnalyzed(false);
    setDecisions({});
    setReviewId(null);
    setReviewStatus("draft");
    setSavedAt(null);
  };

  // Approve review
  const handleApprove = async () => {
    if (!reviewId) return;
    setSaving(true);
    setError(null);
    try {
      const review = await api.approveReview(reviewId);
      setReviewStatus(review.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setSaving(false);
    }
  };

  // Request changes
  const handleRequestChanges = async () => {
    if (!reviewId) return;
    setSaving(true);
    setError(null);
    try {
      const review = await api.requestChanges(reviewId);
      setReviewStatus(review.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request changes");
    } finally {
      setSaving(false);
    }
  };

  // Load sample content
  const handleLoadSample = () => {
    setContent(samples[sampleIndex].content);
    setSampleIndex((sampleIndex + 1) % samples.length);
  };

  // Calculate compliance score
  const calculateComplianceScore = (): number => {
    let deductions = 0;
    findings.forEach((f) => {
      const decision = decisions[f.id];
      if (decision !== "applied" && decision !== "rejected") {
        if (f.severity === "high") deductions += 25;
        else if (f.severity === "medium") deductions += 10;
        else if (f.severity === "low") deductions += 3;
      }
    });
    return Math.max(0, 100 - deductions);
  };

  const complianceScore = calculateComplianceScore();

  const isLocked = reviewStatus === "approved";

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="brand-lockup" aria-label="BrandGuard AI">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span className="brand-name">BrandGuard <span>AI</span></span>
        </div>
        <div className="workspace-label">
          <span className="workspace-indicator" aria-hidden="true" />
          Review workspace
        </div>
      </header>

      <main className="page-container">
        <section className="page-heading">
          <div>
            <h1>Content review</h1>
            <p>Ensure brand compliance with AI-powered content review.</p>
          </div>
          <div className="review-controls">
            <span className={`status-badge status-${reviewStatus}`}>
              <span className="status-dot" aria-hidden="true" />
              {reviewStatus.replaceAll("_", " ")}
            </span>
            <label className="approver-toggle">
              <input
                type="checkbox"
                checked={isApproverMode}
                onChange={(e) => setIsApproverMode(e.target.checked)}
              />
              <span className="toggle-track" aria-hidden="true"><span /></span>
              <span>Approver mode</span>
            </label>
          </div>
        </section>

        <div className="workspace-grid">
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
            onSave={handleSave}
            onSubmit={handleSubmit}
            onNewReview={handleNewReview}
            saving={saving}
            savedAt={savedAt}
          />

          <section className="panel findings-panel" aria-labelledby="findings-title">
            <div className="panel-heading">
              <div>
                <h2 id="findings-title">Review findings</h2>
                <p className="panel-subtitle">Issues detected in your content</p>
              </div>
              {hasAnalyzed && findings.length > 0 && (
                <span className="finding-count">
                  {findings.length} {findings.length === 1 ? "finding" : "findings"}
                </span>
              )}
            </div>

            {!hasAnalyzed && !loading && (
              <div className="empty-state">
                <span className="empty-mark" aria-hidden="true"><span /><span /><span /></span>
                <h3>Ready when you are</h3>
                <p>Run a review to see potential compliance issues and suggested revisions here.</p>
              </div>
            )}

            {loading && (
              <div className="loading-state" role="status" aria-label="Reviewing content">
                <div className="skeleton-line skeleton-short" />
                <div className="skeleton-line" />
                <div className="skeleton-line skeleton-medium" />
                <div className="skeleton-block" />
                <div className="skeleton-line skeleton-short" />
                <div className="skeleton-line" />
                <div className="skeleton-block" />
              </div>
            )}

            {hasAnalyzed && !loading && findings.length === 0 && (
              <div className="empty-state success-state">
                <span className="success-mark" aria-hidden="true">✓</span>
                <h3>No brand issues found</h3>
                <p>Your content meets all brand guidelines.</p>
              </div>
            )}

            {hasAnalyzed && !loading && findings.length > 0 && (
              <>
                <div className="severity-summary" aria-label="Findings by severity">
                  {(["high", "medium", "low"] as const).map((severity) => (
                    <span className={`severity-total severity-${severity}`} key={severity}>
                      <span className="severity-total-count">
                        {findings.filter((finding) => finding.severity === severity).length}
                      </span>
                      <span>{severity}</span>
                    </span>
                  ))}
                </div>

                <div className="findings-list">
                  {findings.map((finding) => (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      decision={decisions[finding.id] || "pending"}
                      onApply={() => handleApply(finding)}
                      onReject={() => handleReject(finding.id)}
                      disabled={isLocked}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        </div>

        {hasAnalyzed && findings.length > 0 && (
          <section className="panel signoff-panel" aria-labelledby="signoff-title">
            <div className="signoff-header">
              <div>
                <h2 id="signoff-title">Compliance sign-off</h2>
                <p className="panel-subtitle">Review the outstanding findings before approval.</p>
              </div>
              <div className="score-display">
                <span className="score-value">{complianceScore}%</span>
                <span className="score-label">compliance score</span>
              </div>
            </div>
            <progress
              className={`score-progress ${complianceScore >= 70 ? "score-good" : complianceScore >= 40 ? "score-watch" : "score-low"}`}
              value={complianceScore}
              max="100"
              aria-label={`Compliance score ${complianceScore} percent`}
            />
            <p className="compliance-message">
              {complianceScore >= 70
                ? "Content meets brand compliance standards and is ready for approval."
                : complianceScore >= 40
                ? "Content needs some improvements to meet brand standards."
                : "Content requires significant revision before approval."}
            </p>

            {isApproverMode && reviewStatus === "pending_approval" && (
              <div className="approval-actions">
                <button
                  onClick={handleApprove}
                  disabled={saving}
                  className="button button-primary"
                >
                  {saving ? "Processing..." : "Approve review"}
                </button>
                <button
                  onClick={handleRequestChanges}
                  disabled={saving}
                  className="button button-secondary"
                >
                  Request changes
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
