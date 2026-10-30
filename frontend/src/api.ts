import type { AnalyzeResponse, Review, Finding } from "./types";

// Use the configured API URL when provided; otherwise call the production Worker.
const BASE_URL = (
  import.meta.env?.VITE_API_URL ||
  "https://brandguard-api.brandguard-api.workers.dev"
).replace(/\/+$/, "");

// Fake mode flag - can be configured via environment or toggled in Settings
const STORAGE_FAKE_KEY = "brandguard_use_fake";
const STORAGE_REVIEWS_KEY = "brandguard_fake_reviews";

export function getFakeMode(): boolean {
  const stored = typeof localStorage === "undefined"
    ? null
    : localStorage.getItem(STORAGE_FAKE_KEY);
  if (stored !== null) {
    return stored === "true";
  }
  // Default to FALSE for live AI analysis; only enable if explicitly set
  return import.meta.env?.VITE_USE_FAKE === "true";
}

export function setFakeMode(enabled: boolean): void {
  localStorage.setItem(STORAGE_FAKE_KEY, enabled ? "true" : "false");
}

export let USE_FAKE = getFakeMode();

// Seed initial mock reviews matching the UI mockup
function getSeedReviews(): Review[] {
  const now = Date.now();
  const hour = 3600 * 1000;
  const day = 24 * hour;

  return [
    {
      id: "rev-mock-001",
      content:
        "Summer Campaign Landing Page\nIntroducing the BEST productivity tool you'll be AMAZED by! Limited time only! Get started today and see results instantly.",
      status: "pending_approval",
      findings: [
        {
          id: "f-001",
          severity: "high",
          category: "unsupported_claim",
          evidence: "the BEST",
          explanation: "Using superlatives like 'BEST' can come across as boastful and may damage credibility.",
          replacement: "our",
        },
        {
          id: "f-002",
          severity: "medium",
          category: "unsupported_claim",
          evidence: "you'll be AMAZED by",
          explanation: "Overpromising emotional outcomes can seem inauthentic to potential customers.",
          replacement: null,
        },
        {
          id: "f-003",
          severity: "low",
          category: "risk",
          evidence: "Limited time only!",
          explanation: "Excessive exclamation marks and aggressive urgency can appear spammy.",
          replacement: null,
        },
      ],
      updated_at: new Date(now - 2 * hour).toISOString(),
    },
    {
      id: "rev-mock-002",
      content:
        "Q2 Product Announcement Email\nWe are excited to share new features built to improve collaboration across distributed teams. Learn more about our latest release on our blog.",
      status: "approved",
      findings: [],
      updated_at: new Date(now - 1 * day).toISOString(),
    },
    {
      id: "rev-mock-003",
      content:
        "New Feature Social Post\nCheck out the #1 solution that eliminates 100% of errors forever! Don't miss this opportunity.",
      status: "changes_requested",
      findings: [
        {
          id: "f-004",
          severity: "high",
          category: "risk",
          evidence: "eliminates 100% of errors forever",
          explanation: "Absolute claims without verifiable scientific proof violate regulatory truth-in-advertising guidelines.",
          replacement: null,
        },
        {
          id: "f-005",
          severity: "medium",
          category: "unsupported_claim",
          evidence: "#1 solution",
          explanation: "Unsubstantiated rank claims require explicit third-party attribution.",
          replacement: "the solution",
        },
      ],
      updated_at: new Date(now - 2 * day).toISOString(),
    },
    {
      id: "rev-mock-004",
      content:
        "Homepage Hero Section\nEmpower your team with intuitive workflows and clear project visibility. Trusted by forward-thinking teams globally.",
      status: "approved",
      findings: [],
      updated_at: new Date(now - 3 * day).toISOString(),
    },
    {
      id: "rev-mock-005",
      content:
        "Product Comparison Page\nWhy settle for average tools? Our software is guaranteed to double your team's output without extra effort.",
      status: "pending_approval",
      findings: [
        {
          id: "f-006",
          severity: "high",
          category: "risk",
          evidence: "guaranteed to double your team's output without extra effort",
          explanation: "Unrealistic performance guarantees create consumer fraud liability.",
          replacement: null,
        },
      ],
      updated_at: new Date(now - 5 * day).toISOString(),
    },
    {
      id: "rev-mock-006",
      content:
        "Spring Promotion Draft\nSave up to 30% on annual subscriptions during our seasonal event. Conditions apply.",
      status: "draft",
      findings: [],
      updated_at: new Date(now - 6 * day).toISOString(),
    },
  ];
}

// Helper to access fake store
function getFakeStore(): Review[] {
  try {
    const raw = localStorage.getItem(STORAGE_REVIEWS_KEY);
    if (!raw) {
      const initial = getSeedReviews();
      localStorage.setItem(STORAGE_REVIEWS_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return getSeedReviews();
  }
}

function saveFakeStore(reviews: Review[]): void {
  try {
    localStorage.setItem(STORAGE_REVIEWS_KEY, JSON.stringify(reviews));
  } catch (err) {
    console.warn("Failed to write to localStorage fake store", err);
  }
}

export function resetFakeStore(): void {
  const initial = getSeedReviews();
  localStorage.setItem(STORAGE_REVIEWS_KEY, JSON.stringify(initial));
}

// Generic request helper that handles fetch, errors, and JSON parsing
async function request<T>(
  path: string,
  method: string,
  body?: unknown
): Promise<T> {
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    let data: any;
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data as T;
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("fetch") || err.message.includes("NetworkError")) {
        throw new Error("Cannot reach the server. Please try again in a moment.");
      }
      throw err;
    }
    throw new Error("Cannot reach the server. Please try again in a moment.");
  }
}

// Check if a value is a valid review ID (UUID format: 8-4-4-4-12)
export function isValidReviewId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.startsWith("rev-mock-") || value.startsWith("fake-")) {
    return getFakeMode();
  }
  const parts = value.split("-");
  if (parts.length !== 5) return false;
  if (parts[0].length !== 8) return false;
  if (parts[1].length !== 4) return false;
  if (parts[2].length !== 4) return false;
  if (parts[3].length !== 4) return false;
  if (parts[4].length !== 12) return false;
  return true;
}

// Helper to determine if an ID is a fake ID
export function isFakeId(id: string): boolean {
  return id.startsWith("rev-mock-") || id.startsWith("fake-");
}

// Analyze content for brand violations
export async function analyze(content: string): Promise<AnalyzeResponse> {
  USE_FAKE = getFakeMode();
  if (USE_FAKE) {
    throw new Error("AI analysis is unavailable while demo mode is enabled.");
  }
  return request<AnalyzeResponse>("/api/analyze", "POST", { content });
}

// Check health of backend API without exposing secrets
export async function checkHealth(): Promise<{
  status: string;
  service?: string;
  model?: string;
  has_api_key?: boolean;
}> {
  return request<{
    status: string;
    service?: string;
    model?: string;
    has_api_key?: boolean;
  }>("/health", "GET");
}

// Create a new review (draft)
export async function createReview(
  content: string,
  findings: Finding[]
): Promise<Review> {
  USE_FAKE = getFakeMode();
  if (USE_FAKE) {
    const reviews = getFakeStore();
    const newReview: Review = {
      id: `fake-${Date.now()}`,
      content,
      status: "draft",
      findings,
      updated_at: new Date().toISOString(),
    };
    reviews.unshift(newReview);
    saveFakeStore(reviews);
    return newReview;
  }
  return request<Review>("/api/reviews", "POST", { content, findings });
}

// Save an existing review
export async function saveReview(
  id: string,
  content: string,
  findings: Finding[]
): Promise<Review> {
  USE_FAKE = getFakeMode();
  if (USE_FAKE || isFakeId(id)) {
    const reviews = getFakeStore();
    const idx = reviews.findIndex((r) => r.id === id);
    const updated: Review = {
      id,
      content,
      status: idx !== -1 ? reviews[idx].status : "draft",
      findings,
      updated_at: new Date().toISOString(),
    };
    if (idx !== -1) {
      reviews[idx] = updated;
    } else {
      reviews.unshift(updated);
    }
    saveFakeStore(reviews);
    return updated;
  }
  return request<Review>(`/api/reviews/${id}`, "PUT", { content, findings });
}

// Load a review by ID
export async function loadReview(id: string): Promise<Review> {
  USE_FAKE = getFakeMode();
  if (USE_FAKE || isFakeId(id)) {
    const reviews = getFakeStore();
    const found = reviews.find((r) => r.id === id);
    if (found) return found;
    throw new Error(`Review ${id} not found in local store.`);
  }
  return request<Review>(`/api/reviews/${id}`, "GET");
}

// Submit a review for approval
export async function submitForApproval(id: string): Promise<Review> {
  USE_FAKE = getFakeMode();
  if (USE_FAKE || isFakeId(id)) {
    const reviews = getFakeStore();
    const idx = reviews.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("Review not found");
    reviews[idx] = {
      ...reviews[idx],
      status: "pending_approval",
      updated_at: new Date().toISOString(),
    };
    saveFakeStore(reviews);
    return reviews[idx];
  }
  return request<Review>(`/api/reviews/${id}/submit`, "POST");
}

// Approve a review
export async function approveReview(id: string): Promise<Review> {
  USE_FAKE = getFakeMode();
  if (USE_FAKE || isFakeId(id)) {
    const reviews = getFakeStore();
    const idx = reviews.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("Review not found");
    reviews[idx] = {
      ...reviews[idx],
      status: "approved",
      updated_at: new Date().toISOString(),
    };
    saveFakeStore(reviews);
    return reviews[idx];
  }
  return request<Review>(`/api/reviews/${id}/approve`, "POST");
}

// Request changes on a review
export async function requestChanges(id: string): Promise<Review> {
  USE_FAKE = getFakeMode();
  if (USE_FAKE || isFakeId(id)) {
    const reviews = getFakeStore();
    const idx = reviews.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error("Review not found");
    reviews[idx] = {
      ...reviews[idx],
      status: "changes_requested",
      updated_at: new Date().toISOString(),
    };
    saveFakeStore(reviews);
    return reviews[idx];
  }
  return request<Review>(`/api/reviews/${id}/request-changes`, "POST");
}

// List all reviews
export async function listReviews(): Promise<Review[]> {
  USE_FAKE = getFakeMode();
  if (USE_FAKE) {
    return getFakeStore();
  }
  const data = await request<Review[]>("/api/reviews", "GET");
  if (!Array.isArray(data)) {
    throw new Error("The reviews service returned an invalid response.");
  }
  return data;
}

// Delete a review
export async function deleteReview(id: string): Promise<void> {
  USE_FAKE = getFakeMode();
  const reviews = getFakeStore().filter((r) => r.id !== id);
  saveFakeStore(reviews);
  if (!USE_FAKE && !isFakeId(id)) {
    try {
      await request<void>(`/api/reviews/${id}`, "DELETE");
    } catch {
      // ignore
    }
  }
}
