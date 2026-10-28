export type FindingSeverity = "high" | "medium" | "low";
export type FindingCategory = "risk" | "unsupported_claim" | "needs_verification";

export type Finding = {
  id: string;
  severity: FindingSeverity;
  category?: FindingCategory;
  evidence: string;
  explanation: string;
  replacement?: string | null;
  /** Deprecated backward-compatibility alias */
  suggestion?: string | null;
};

export type AnalyzeRequest = { content: string };

export type AnalyzeResponse = { findings: Finding[] };

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
