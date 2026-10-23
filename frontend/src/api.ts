import type { AnalyzeResponse, Review, Finding } from "./types";

// Base URL for API requests
const BASE_URL =
  import.meta.env.VITE_API_URL || "https://YOUR-SERVICE.onrender.com";

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
      if (err.message.includes("fetch")) {
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
  const parts = value.split("-");
  if (parts.length !== 5) return false;
  if (parts[0].length !== 8) return false;
  if (parts[1].length !== 4) return false;
  if (parts[2].length !== 4) return false;
  if (parts[3].length !== 4) return false;
  if (parts[4].length !== 12) return false;
  return true;
}

// Analyze content for brand violations
export async function analyze(content: string): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>("/api/analyze", "POST", { content });
}

// Create a new review (draft)
export async function createReview(
  content: string,
  findings: Finding[]
): Promise<Review> {
  return request<Review>("/api/reviews", "POST", { content, findings });
}

// Save an existing review
export async function saveReview(
  id: string,
  content: string,
  findings: Finding[]
): Promise<Review> {
  return request<Review>(`/api/reviews/${id}`, "PUT", { content, findings });
}

// Load a review by ID
export async function loadReview(id: string): Promise<Review> {
  return request<Review>(`/api/reviews/${id}`, "GET");
}

// Submit a review for approval
export async function submitForApproval(id: string): Promise<Review> {
  return request<Review>(`/api/reviews/${id}/submit`, "POST");
}

// Approve a review
export async function approveReview(id: string): Promise<Review> {
  return request<Review>(`/api/reviews/${id}/approve`, "POST");
}

// Request changes on a review
export async function requestChanges(id: string): Promise<Review> {
  return request<Review>(`/api/reviews/${id}/request-changes`, "POST");
}
