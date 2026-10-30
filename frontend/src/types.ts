export type FindingSeverity = "high" | "medium" | "low";
export type FindingCategory = "risk" | "unsupported_claim" | "needs_verification";
export type FindingDecision = "pending" | "accepted" | "applied" | "rejected";

export type RewriteSuggestion = {
  text: string;
  requiresVerification: boolean;
  rationale?: string;
  uncertainty?: string | null;
};

export type Finding = {
  id: string;
  severity: FindingSeverity;
  category?: FindingCategory;
  evidence: string;
  context?: string;
  targetStart?: number;
  targetEnd?: number;
  explanation: string;
  rewriteRationale?: string | null;
  uncertainty?: string | null;
  requiresVerification?: boolean;
  replacement?: string | null;
  suggestions?: RewriteSuggestion[];
  /** Deprecated backward-compatibility alias */
  suggestion?: string | null;
};

export type AnalyzeRequest = { content: string };

export type AnalyzeResponse = {
  findings: Finding[];
  analysisSource?: "groq" | "rules-fallback";
  analysisMessage?: string | null;
};

export type Review = {
  id: string;
  content: string;
  status: "draft" | "pending_approval" | "approved" | "changes_requested";
  findings: Finding[];
  updated_at: string;
};

export type Template = {
  id: string;
  title: string;
  description: string;
  category: string;
  content: string;
};
