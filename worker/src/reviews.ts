import type { Review, Finding, ReviewStatus, Env } from "./types.ts";

// In-memory fallback cache across invocations in the same worker isolate
const memoryReviews = new Map<string, Review>();

// Seed default reviews matching the mockup
function getSeedReviews(): Review[] {
  const now = Date.now();
  const hour = 3600 * 1000;
  const day = 24 * hour;

  return [
    {
      id: "rev-seed-001",
      content:
        "Summer Campaign Landing Page\nIntroducing the BEST productivity tool you'll be AMAZED by! Limited time only! Get started today and see results instantly.",
      status: "pending_approval",
      findings: [
        {
          id: "f-001",
          severity: "high",
          category: "unsupported_claim",
          evidence: "the BEST",
          explanation: "Superlative claim without third-party comparative data.",
          replacement: "our",
        },
        {
          id: "f-002",
          severity: "medium",
          category: "unsupported_claim",
          evidence: "you'll be AMAZED by",
          explanation: "Overpromising emotional outcomes can damage credibility.",
          replacement: null,
        },
        {
          id: "f-003",
          severity: "low",
          category: "risk",
          evidence: "Limited time only!",
          explanation: "Excessive urgency tactics diminish premium perception.",
          replacement: null,
        },
      ],
      updated_at: new Date(now - 2 * hour).toISOString(),
    },
    {
      id: "rev-seed-002",
      content:
        "Q2 Product Announcement Email\nWe are excited to share new features built to improve collaboration across distributed teams. Learn more about our latest release on our blog.",
      status: "approved",
      findings: [],
      updated_at: new Date(now - 1 * day).toISOString(),
    },
    {
      id: "rev-seed-003",
      content:
        "New Feature Social Post\nCheck out the #1 solution that eliminates 100% of errors forever! Don't miss this opportunity.",
      status: "changes_requested",
      findings: [
        {
          id: "f-004",
          severity: "high",
          category: "risk",
          evidence: "eliminates 100% of errors forever",
          explanation: "Absolute claims without verifiable proof violate truth-in-advertising guidelines.",
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
  ];
}

function initializeSeedIfEmpty() {
  if (memoryReviews.size === 0) {
    for (const r of getSeedReviews()) {
      memoryReviews.set(r.id, r);
    }
  }
}

export async function listReviews(env: Env): Promise<Review[]> {
  if (env.REVIEWS_KV) {
    const listRes = await env.REVIEWS_KV.list({ prefix: "rev:" });
    const reviews: Review[] = [];
    for (const key of listRes.keys) {
      const data = await env.REVIEWS_KV.get(key.name);
      if (data) {
        try {
          reviews.push(JSON.parse(data));
        } catch {
          // ignore corrupted items
        }
      }
    }
    if (reviews.length === 0) {
      // Seed to KV
      const seeds = getSeedReviews();
      for (const s of seeds) {
        await env.REVIEWS_KV.put(`rev:${s.id}`, JSON.stringify(s));
      }
      return seeds;
    }
    return reviews.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  initializeSeedIfEmpty();
  return Array.from(memoryReviews.values()).sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export async function getReview(id: string, env: Env): Promise<Review | null> {
  if (env.REVIEWS_KV) {
    const data = await env.REVIEWS_KV.get(`rev:${id}`);
    if (data) {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return null;
  }

  initializeSeedIfEmpty();
  return memoryReviews.get(id) || null;
}

export async function saveReview(
  review: Review,
  env: Env
): Promise<Review> {
  if (env.REVIEWS_KV) {
    await env.REVIEWS_KV.put(`rev:${review.id}`, JSON.stringify(review));
  }
  memoryReviews.set(review.id, review);
  return review;
}

export async function createReview(
  content: string,
  findings: Finding[],
  env: Env
): Promise<Review> {
  const id = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const review: Review = {
    id,
    content,
    status: "draft",
    findings,
    updated_at: new Date().toISOString(),
  };
  return saveReview(review, env);
}

export async function updateReview(
  id: string,
  content: string,
  findings: Finding[],
  env: Env
): Promise<Review> {
  const existing = await getReview(id, env);
  const updated: Review = {
    id,
    content,
    status: existing ? existing.status : "draft",
    findings,
    updated_at: new Date().toISOString(),
  };
  return saveReview(updated, env);
}

export async function updateReviewStatus(
  id: string,
  status: ReviewStatus,
  env: Env
): Promise<Review> {
  const existing = await getReview(id, env);
  if (!existing) {
    throw new Error(`Review with id '${id}' not found`);
  }
  const updated: Review = {
    ...existing,
    status,
    updated_at: new Date().toISOString(),
  };
  return saveReview(updated, env);
}

export async function deleteReview(id: string, env: Env): Promise<boolean> {
  if (env.REVIEWS_KV) {
    await env.REVIEWS_KV.delete(`rev:${id}`);
  }
  return memoryReviews.delete(id);
}
