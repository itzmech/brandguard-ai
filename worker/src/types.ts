export type FindingSeverity = "high" | "medium" | "low";
export type FindingCategory = "risk" | "unsupported_claim" | "needs_verification";

export interface Finding {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  evidence: string;
  explanation: string;
  replacement: string | null;
  /** Deprecated backward-compatibility alias */
  suggestion?: string | null;
}

export interface AnalyzeRequest {
  content: string;
}

export interface AnalyzeResponse {
  findings: Finding[];
}

export type ReviewStatus = "draft" | "pending_approval" | "approved" | "changes_requested";

export interface Review {
  id: string;
  content: string;
  status: ReviewStatus;
  findings: Finding[];
  updated_at: string;
}

export interface Env {
  GROQ_API_KEY?: string;
  ALLOWED_ORIGINS?: string;
  REVIEWS_KV?: {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string) => Promise<void>;
    delete: (key: string) => Promise<void>;
    list: (options?: { prefix?: string }) => Promise<{ keys: { name: string }[] }>;
  };
}
