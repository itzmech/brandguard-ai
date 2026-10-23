import { useState, useEffect } from "react";
import type { Finding, Review } from "./types";
import * as api from "./api";
import { ContentEditor } from "./components/ContentEditor";
import { FindingCard } from "./components/FindingCard";
import { samples } from "./sampleContent";

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

  // Status badge styling
  const statusStyles = {
    draft: "bg-slate-100 text-slate-700",
    pending_approval: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    changes_requested: "bg-orange-100 text-orange-700",
  };

  const isLocked = reviewStatus === "approved";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">🛡️ BrandGuard AI</h1>
          <div className="flex items-center gap-4">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                statusStyles[reviewStatus]
              }`}
            >
              {reviewStatus.replace("_", " ")}
            </span>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isApproverMode}
                onChange={(e) => setIsApproverMode(e.target.checked)}
                className="rounded"
              />
              Approver mode
            </label>
          </div>
        </div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Content Editor */}
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

          {/* Right: Findings */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-xs uppercase text-slate-500 font-medium mb-4">
              Findings
            </h2>

            {/* Before first run */}
            {!hasAnalyzed && !loading && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-6xl mb-4">🛡️</div>
                <p className="text-slate-600">
                  Paste your content and run a review to see findings here.
                </p>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="space-y-3">
                <div className="h-32 bg-slate-200 rounded-lg animate-pulse"></div>
                <div className="h-32 bg-slate-200 rounded-lg animate-pulse"></div>
              </div>
            )}

            {/* Zero findings */}
            {hasAnalyzed && !loading && findings.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-6xl mb-4">✅</div>
                <p className="text-green-700 font-medium">No brand issues found</p>
              </div>
            )}

            {/* Findings list */}
            {hasAnalyzed && !loading && findings.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-slate-700 font-medium">
                    {findings.length} issues detected
                  </span>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                    {findings.filter((f) => f.severity === "high").length} high
                  </span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full">
                    {findings.filter((f) => f.severity === "medium").length} medium
                  </span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {findings.filter((f) => f.severity === "low").length} low
                  </span>
                </div>

                <div className="space-y-3">
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
          </div>
        </div>

        {/* Compliance Sign-off */}
        {hasAnalyzed && findings.length > 0 && (
          <div className="mt-6 max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-xs uppercase text-slate-500 font-medium mb-3">
              Compliance Sign-off
            </h2>

            <div className="flex items-center justify-between mb-4">
              <span className="text-lg font-medium text-slate-900">
                Compliance score:{" "}
                <span
                  className={
                    complianceScore >= 70
                      ? "text-green-600"
                      : complianceScore >= 40
                      ? "text-amber-600"
                      : "text-red-600"
                  }
                >
                  {complianceScore}%
                </span>
              </span>
            </div>

            <p className="text-sm text-slate-600 mb-4">
              {complianceScore >= 70
                ? "Content meets brand compliance standards."
                : complianceScore >= 40
                ? "Content needs some improvements to meet brand standards."
                : "Content requires significant revision before approval."}
            </p>

            {/* Approver actions */}
            {isApproverMode && reviewStatus === "pending_approval" && (
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={saving}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Approve
                </button>
                <button
                  onClick={handleRequestChanges}
                  disabled={saving}
                  className="flex-1 bg-orange-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Request changes
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
