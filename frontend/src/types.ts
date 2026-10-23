export type Finding = {
  id: string;
  severity: "high" | "medium" | "low";
  evidence: string;
  explanation: string;
  suggestion: string;
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
