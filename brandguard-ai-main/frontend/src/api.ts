/**
 * API layer for BrandGuard AI
 * All backend communication must go through this file
 */

import { AnalyzeResponse, Review, Finding } from './types';
import { sampleContents } from './sampleContent';

const USE_FAKE = false;
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Sleep helper to simulate network latency
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fake review store using localStorage
 */
function getFakeStore(): Record<string, Review> {
  try {
    const data = localStorage.getItem('brandguard_fake_reviews');
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveFakeStore(store: Record<string, Review>): void {
  try {
    localStorage.setItem('brandguard_fake_reviews', JSON.stringify(store));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Generate findings for sample content
 */
function generateFindingsForContent(content: string): Finding[] {
  // Check if it's sample #1
  if (sampleContents[0] && content === sampleContents[0].content) {
    return [
      {
        id: 'finding-1',
        severity: 'high',
        evidence: 'BEST in the industry',
        explanation: 'Using superlatives like "BEST" can come across as boastful and may damage credibility.',
        suggestion: 'A trusted leader in the industry',
      },
      {
        id: 'finding-2',
        severity: 'medium',
        evidence: "you'll be AMAZED",
        explanation: 'Overpromising emotional outcomes can seem inauthentic to potential customers.',
        suggestion: "you'll see great results",
      },
      {
        id: 'finding-3',
        severity: 'low',
        evidence: 'limited time only!!!',
        explanation: 'Excessive exclamation marks and aggressive urgency can appear spammy.',
        suggestion: 'Limited time offer',
      },
    ];
  }
  // Default: return empty findings for other content
  return [];
}

export async function analyze(content: string): Promise<AnalyzeResponse> {
  if (USE_FAKE) {
    await sleep(700);
    const findings = generateFindingsForContent(content);
    return { findings };
  }
  // Real implementation
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!response.ok) {
    let errorMessage = 'Analysis failed';
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Ignore malformed error responses
    }
    throw new Error(errorMessage);
  }
  try {
    return await response.json();
  } catch {
    throw new Error('Invalid response from server');
  }
}

export async function createReview(content: string, findings: Finding[]): Promise<Review> {
  if (USE_FAKE) {
    await sleep(700);
    const store = getFakeStore();
    const id = `review-${Date.now()}`;
    const review: Review = {
      id,
      content,
      status: 'draft',
      findings,
      updated_at: new Date().toISOString(),
    };
    store[id] = review;
    saveFakeStore(store);
    return review;
  }
  // Real implementation
  const response = await fetch(`${API_BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, findings }),
  });
  if (!response.ok) {
    let errorMessage = 'Failed to create review';
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Ignore malformed error responses
    }
    throw new Error(errorMessage);
  }
  try {
    return await response.json();
  } catch {
    throw new Error('Invalid response from server');
  }
}

export async function saveReview(id: string, content: string, findings: Finding[]): Promise<Review> {
  if (USE_FAKE) {
    await sleep(700);
    const store = getFakeStore();
    const existing = store[id];
    const review: Review = {
      id,
      content,
      status: existing?.status || 'draft',
      findings,
      updated_at: new Date().toISOString(),
    };
    store[id] = review;
    saveFakeStore(store);
    return review;
  }
  // Real implementation
  const response = await fetch(`${API_BASE_URL}/api/reviews/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, findings }),
  });
  if (!response.ok) {
    let errorMessage = 'Failed to save review';
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Ignore malformed error responses
    }
    throw new Error(errorMessage);
  }
  try {
    return await response.json();
  } catch {
    throw new Error('Invalid response from server');
  }
}

export async function loadReview(id: string): Promise<Review> {
  if (USE_FAKE) {
    await sleep(700);
    const store = getFakeStore();
    const review = store[id];
    if (!review) {
      throw new Error('Review not found');
    }
    return review;
  }
  // Real implementation
  const response = await fetch(`${API_BASE_URL}/api/reviews/${id}`);
  if (!response.ok) {
    let errorMessage = 'Failed to load review';
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Ignore malformed error responses
    }
    throw new Error(errorMessage);
  }
  try {
    return await response.json();
  } catch {
    throw new Error('Invalid response from server');
  }
}

export async function submitForApproval(id: string): Promise<Review> {
  if (USE_FAKE) {
    await sleep(700);
    const store = getFakeStore();
    const review = store[id];
    if (!review) {
      throw new Error('Review not found');
    }
    review.status = 'pending_approval';
    review.updated_at = new Date().toISOString();
    store[id] = review;
    saveFakeStore(store);
    return review;
  }
  // Real implementation
  const response = await fetch(`${API_BASE_URL}/api/reviews/${id}/submit`, {
    method: 'POST',
  });
  if (!response.ok) {
    let errorMessage = 'Failed to submit for approval';
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Ignore malformed error responses
    }
    throw new Error(errorMessage);
  }
  try {
    return await response.json();
  } catch {
    throw new Error('Invalid response from server');
  }
}

export async function approveReview(id: string): Promise<Review> {
  if (USE_FAKE) {
    await sleep(700);
    const store = getFakeStore();
    const review = store[id];
    if (!review) {
      throw new Error('Review not found');
    }
    review.status = 'approved';
    review.updated_at = new Date().toISOString();
    store[id] = review;
    saveFakeStore(store);
    return review;
  }
  // Real implementation
  const response = await fetch(`${API_BASE_URL}/api/reviews/${id}/approve`, {
    method: 'POST',
  });
  if (!response.ok) {
    let errorMessage = 'Failed to approve review';
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Ignore malformed error responses
    }
    throw new Error(errorMessage);
  }
  try {
    return await response.json();
  } catch {
    throw new Error('Invalid response from server');
  }
}

export async function requestChanges(id: string): Promise<Review> {
  if (USE_FAKE) {
    await sleep(700);
    const store = getFakeStore();
    const review = store[id];
    if (!review) {
      throw new Error('Review not found');
    }
    review.status = 'changes_requested';
    review.updated_at = new Date().toISOString();
    store[id] = review;
    saveFakeStore(store);
    return review;
  }
  // Real implementation
  const response = await fetch(`${API_BASE_URL}/api/reviews/${id}/request-changes`, {
    method: 'POST',
  });
  if (!response.ok) {
    let errorMessage = 'Failed to request changes';
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // Ignore malformed error responses
    }
    throw new Error(errorMessage);
  }
  try {
    return await response.json();
  } catch {
    throw new Error('Invalid response from server');
  }
}
