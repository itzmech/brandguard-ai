import type { Env, AnalyzeRequest } from "./types.ts";
import { analyzeWithGroq } from "./groq.ts";
import { analyzeWithRules } from "./rules.ts";
import {
  listReviews,
  getReview,
  createReview,
  updateReview,
  updateReviewStatus,
  deleteReview,
} from "./reviews.ts";

const MAX_PAYLOAD_BYTES = 50 * 1024; // 50 KB
const MAX_CONTENT_LENGTH = 10000; // 10,000 characters
const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

function getAllowedOrigins(env: Env): string[] {
  const defaults = [
    "https://brandguard-ai-seven.vercel.app",
    "http://localhost:5173",
    "http://localhost:4173",
  ];
  if (env.ALLOWED_ORIGINS) {
    const additional = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
    return [...new Set([...defaults, ...additional])];
  }
  return defaults;
}

function getCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowedOrigins = getAllowedOrigins(env);

  let allowOrigin = allowedOrigins[0];
  if (origin && allowedOrigins.includes(origin)) {
    allowOrigin = origin;
  } else if (origin && (origin.endsWith(".vercel.app") || origin.includes("localhost"))) {
    // Permissive for Vercel preview deploys and local testing
    allowOrigin = origin;
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(
  data: unknown,
  status = 200,
  corsHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function findEvidencePositions(content: string, evidence: string): number[] {
  const positions: number[] = [];
  const normalizedContent = content.toLowerCase();
  const normalizedEvidence = evidence.toLowerCase();
  let position = normalizedContent.indexOf(normalizedEvidence);

  while (position !== -1) {
    positions.push(position);
    position = normalizedContent.indexOf(normalizedEvidence, position + 1);
  }

  return positions;
}

function overlapsExisting(
  content: string,
  finding: { evidence: string },
  accepted: Array<{ evidence: string }>
): boolean {
  const positions = findEvidencePositions(content, finding.evidence);
  return accepted.some((existing) => {
    const existingPositions = findEvidencePositions(content, existing.evidence);
    return positions.some((position) =>
      existingPositions.some(
        (existingPosition) =>
          position < existingPosition + existing.evidence.length &&
          existingPosition < position + finding.evidence.length
      )
    );
  });
}

function mergeFindings(
  content: string,
  rules: Awaited<ReturnType<typeof analyzeWithRules>>,
  groq: Awaited<ReturnType<typeof analyzeWithGroq>>
) {
  const contextualGroqFindings = groq.map((finding) => {
    const overlappingRules = rules.filter((rule) =>
      overlapsExisting(content, rule, [finding])
    );
    const highestSeverity = [...overlappingRules, finding].reduce(
      (highest, candidate) =>
        SEVERITY_ORDER[candidate.severity] < SEVERITY_ORDER[highest]
          ? candidate.severity
          : highest,
      finding.severity
    );
    return { ...finding, severity: highestSeverity };
  });
  const unmatchedRules = rules.filter(
    (rule) => !contextualGroqFindings.some((finding) =>
      overlapsExisting(content, rule, [finding])
    )
  );
  const candidates = [...contextualGroqFindings, ...unmatchedRules].sort(
    (left, right) => SEVERITY_ORDER[left.severity] - SEVERITY_ORDER[right.severity]
  );
  const accepted: typeof candidates = [];

  for (const finding of candidates) {
    if (!overlapsExisting(content, finding, accepted)) {
      accepted.push(finding);
    }
  }

  return accepted;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = getCorsHeaders(request, env);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 1. Health check endpoints
      if ((path === "/health" || path === "/api/health") && request.method === "GET") {
        return jsonResponse(
          {
            status: "ok",
            service: "brandguard-api",
            has_groq_api_key: Boolean(env.GROQ_API_KEY?.trim()),
            timestamp: new Date().toISOString(),
          },
          200,
          corsHeaders
        );
      }

      // Check request size limit
      const contentLengthHeader = request.headers.get("Content-Length");
      if (contentLengthHeader && parseInt(contentLengthHeader, 10) > MAX_PAYLOAD_BYTES) {
        return jsonResponse(
          { error: `Payload too large. Maximum allowed size is ${MAX_PAYLOAD_BYTES / 1024}KB.` },
          413,
          corsHeaders
        );
      }

      // 2. POST /api/analyze
      if (path === "/api/analyze" && request.method === "POST") {
        let body: AnalyzeRequest;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON in request body." }, 400, corsHeaders);
        }

        if (typeof body.content !== "string") {
          return jsonResponse(
            { error: "Field 'content' is required and must be a string." },
            400,
            corsHeaders
          );
        }

        const trimmed = body.content.trim();
        if (trimmed.length === 0) {
          return jsonResponse(
            { error: "Content must not be empty or whitespace only." },
            400,
            corsHeaders
          );
        }

        if (body.content.length > MAX_CONTENT_LENGTH) {
          return jsonResponse(
            {
              error: `Content exceeds maximum allowed length of ${MAX_CONTENT_LENGTH} characters (received ${body.content.length}).`,
            },
            400,
            corsHeaders
          );
        }

        const ruleFindings = analyzeWithRules(body.content);
        let groqFindings: Awaited<ReturnType<typeof analyzeWithGroq>> = [];
        let analysisSource = "rules-fallback";

        try {
          groqFindings = await analyzeWithGroq(body.content, env);
          if (groqFindings.length > 0 || ruleFindings.length === 0) {
            analysisSource = "groq";
          }
        } catch {
          analysisSource = "rules-fallback";
        }

        return jsonResponse(
          { findings: mergeFindings(body.content, ruleFindings, groqFindings) },
          200,
          { ...corsHeaders, "X-Analysis-Source": analysisSource }
        );
      }

      // 3. Reviews API
      // GET /api/reviews
      if (path === "/api/reviews" && request.method === "GET") {
        const reviews = await listReviews(env);
        return jsonResponse(reviews, 200, corsHeaders);
      }

      // POST /api/reviews
      if (path === "/api/reviews" && request.method === "POST") {
        let body: any;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ error: "Invalid JSON in request body." }, 400, corsHeaders);
        }

        if (typeof body.content !== "string") {
          return jsonResponse(
            { error: "Field 'content' is required and must be a string." },
            400,
            corsHeaders
          );
        }

        const findings = Array.isArray(body.findings) ? body.findings : [];
        const review = await createReview(body.content, findings, env);
        return jsonResponse(review, 201, corsHeaders);
      }

      // Route review sub-paths: /api/reviews/:id/...
      const reviewPathMatch = path.match(/^\/api\/reviews\/([a-zA-Z0-9_-]+)(?:\/(.*))?$/);
      if (reviewPathMatch) {
        const reviewId = reviewPathMatch[1];
        const subAction = reviewPathMatch[2]; // e.g. "submit", "approve", "request-changes"

        // GET /api/reviews/:id
        if (!subAction && request.method === "GET") {
          const review = await getReview(reviewId, env);
          if (!review) {
            return jsonResponse({ error: `Review '${reviewId}' not found.` }, 404, corsHeaders);
          }
          return jsonResponse(review, 200, corsHeaders);
        }

        // PUT /api/reviews/:id
        if (!subAction && request.method === "PUT") {
          let body: any;
          try {
            body = await request.json();
          } catch {
            return jsonResponse({ error: "Invalid JSON in request body." }, 400, corsHeaders);
          }

          if (typeof body.content !== "string") {
            return jsonResponse(
              { error: "Field 'content' is required and must be a string." },
              400,
              corsHeaders
            );
          }

          const findings = Array.isArray(body.findings) ? body.findings : [];
          const updated = await updateReview(reviewId, body.content, findings, env);
          return jsonResponse(updated, 200, corsHeaders);
        }

        // DELETE /api/reviews/:id
        if (!subAction && request.method === "DELETE") {
          await deleteReview(reviewId, env);
          return new Response(null, { status: 204, headers: corsHeaders });
        }

        // POST /api/reviews/:id/submit
        if (subAction === "submit" && request.method === "POST") {
          const updated = await updateReviewStatus(reviewId, "pending_approval", env);
          return jsonResponse(updated, 200, corsHeaders);
        }

        // POST /api/reviews/:id/approve
        if (subAction === "approve" && request.method === "POST") {
          const updated = await updateReviewStatus(reviewId, "approved", env);
          return jsonResponse(updated, 200, corsHeaders);
        }

        // POST /api/reviews/:id/request-changes
        if (subAction === "request-changes" && request.method === "POST") {
          const updated = await updateReviewStatus(reviewId, "changes_requested", env);
          return jsonResponse(updated, 200, corsHeaders);
        }
      }

      // Route not found
      return jsonResponse(
        { error: `Route '${request.method} ${path}' not found.` },
        404,
        corsHeaders
      );
    } catch (err) {
      return jsonResponse(
        { error: "An unexpected server error occurred. Please retry later." },
        500,
        corsHeaders
      );
    }
  },
};
