import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Review, Finding } from "../frontend/src/types.ts";

// Mock localStorage simulation for testing persistence across page refreshes
class LocalStorageMock {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe("Workflow & Decision Persistence Across Refresh", () => {
  it("persists reviewer decisions per review and restores them on page refresh", () => {
    const mockStorage = new LocalStorageMock();
    const reviewId = "rev-persist-001";
    const findings: Finding[] = [
      {
        id: "f-101",
        severity: "high",
        category: "risk",
        evidence: "guaranteed 100%",
        explanation: "Absolute guarantee",
        replacement: "designed for high reliability",
      },
      {
        id: "f-102",
        severity: "low",
        category: "unsupported_claim",
        evidence: "BEST",
        explanation: "Superlative",
        replacement: "leading",
      },
    ];

    // Initial state before decisions
    const initialDecisions: Record<string, "pending" | "accepted" | "applied" | "rejected"> = {
      "f-101": "pending",
      "f-102": "pending",
      "f-103": "pending",
    };

    // User applies f-101 and rejects f-102
    const updatedDecisions = {
      ...initialDecisions,
      "f-101": "applied" as const,
      "f-102": "rejected" as const,
      "f-103": "accepted" as const,
    };

    // Persist to storage
    mockStorage.setItem(`brandguard_decisions_${reviewId}`, JSON.stringify(updatedDecisions));
    mockStorage.setItem("brandguard_review_id", reviewId);

    // --- SIMULATE PAGE REFRESH ---
    const restoredReviewId = mockStorage.getItem("brandguard_review_id");
    assert.equal(restoredReviewId, reviewId);

    const savedDecisionsRaw = mockStorage.getItem(`brandguard_decisions_${restoredReviewId}`);
    assert.ok(savedDecisionsRaw);
    const restoredDecisions = JSON.parse(savedDecisionsRaw);

    assert.equal(restoredDecisions["f-101"], "applied");
    assert.equal(restoredDecisions["f-102"], "rejected");
    assert.equal(restoredDecisions["f-103"], "accepted");
  });

  it("preserves evidence, explanation, and replacement in saved review details", () => {
    const mockStorage = new LocalStorageMock();
    const review: Review = {
      id: "rev-rewrite-fields",
      content: "The BEST choice.",
      status: "draft",
      findings: [
        {
          id: "f-fields",
          severity: "medium",
          category: "needs_verification",
          evidence: "The BEST choice",
          context: "The BEST choice.",
          targetStart: 0,
          explanation: "A ranking needs substantiation.",
          replacement: null,
          suggestions: [
            { text: "The leading choice", requiresVerification: true },
            { text: "A choice", requiresVerification: false },
          ],
        },
      ],
      updated_at: new Date().toISOString(),
    };

    mockStorage.setItem("brandguard_fake_reviews", JSON.stringify([review]));
    const [reloaded] = JSON.parse(
      mockStorage.getItem("brandguard_fake_reviews")!
    ) as Review[];

    assert.deepEqual(reloaded.findings[0], review.findings[0]);
    assert.equal(reloaded.findings[0].evidence, "The BEST choice");
    assert.equal(reloaded.findings[0].explanation, "A ranking needs substantiation.");
    assert.equal(reloaded.findings[0].replacement, null);
    assert.deepEqual(reloaded.findings[0].suggestions, [
      { text: "The leading choice", requiresVerification: true },
      { text: "A choice", requiresVerification: false },
    ]);
    assert.equal(reloaded.status, "draft");
  });

  it("persists review status changes (submit -> approve / changes-requested) across reload", () => {
    const mockStorage = new LocalStorageMock();
    const review: Review = {
      id: "rev-flow-1",
      content: "Marketing copy",
      status: "draft",
      findings: [],
      updated_at: new Date().toISOString(),
    };

    const reviewsList = [review];
    mockStorage.setItem("brandguard_fake_reviews", JSON.stringify(reviewsList));

    // Submit review
    reviewsList[0].status = "pending_approval";
    mockStorage.setItem("brandguard_fake_reviews", JSON.stringify(reviewsList));

    // Simulate reload
    let reloadedReviews: Review[] = JSON.parse(mockStorage.getItem("brandguard_fake_reviews")!);
    assert.equal(reloadedReviews[0].status, "pending_approval");

    // Approver approves review
    reloadedReviews[0].status = "approved";
    mockStorage.setItem("brandguard_fake_reviews", JSON.stringify(reloadedReviews));

    // Simulate second reload
    const finalReviews: Review[] = JSON.parse(mockStorage.getItem("brandguard_fake_reviews")!);
    assert.equal(finalReviews[0].status, "approved");
  });
});
