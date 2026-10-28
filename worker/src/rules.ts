import type { Finding, FindingCategory, FindingSeverity } from "./types.ts";

interface Rule {
  pattern: RegExp;
  severity: FindingSeverity;
  category: FindingCategory;
  explanation: string;
  suggestion: (evidence: string) => string;
  replacement?: (match: RegExpExecArray) => string | null;
}

const RULES: Rule[] = [
  {
    pattern: /\b100%\s+guaranteed\b/gi,
    severity: "high",
    category: "risk",
    explanation: "Absolute guarantees require reliable substantiation.",
    suggestion: () => "not guaranteed",
    replacement: () => "not guaranteed",
  },
  {
    pattern: /\bguaranteed\b/gi,
    severity: "high",
    category: "risk",
    explanation: "Guarantees can imply certainty that needs substantiation.",
    suggestion: () => "not guaranteed",
  },
  {
    pattern: /\b100%(?!\w)/gi,
    severity: "high",
    category: "unsupported_claim",
    explanation: "Absolute percentages need evidence supporting the precise figure.",
    suggestion: () => "a substantiated percentage",
  },
  {
    pattern: /\bmiracle\s+[\p{L}][\p{L}\p{N}'-]*/giu,
    severity: "medium",
    category: "unsupported_claim",
    explanation: "“Miracle” is an exceptional claim that needs substantiation.",
    suggestion: (_evidence) => "remove the unsupported “miracle” description",
    replacement: (match) => match[0].replace(/^miracle\s+/i, ""),
  },
  {
    pattern: /\bcure\s+[\p{L}][\p{L}\p{N}'-]*/giu,
    severity: "high",
    category: "risk",
    explanation: "A cure claim can imply a medical outcome and requires strong evidence.",
    suggestion: () => "remove the cure claim unless it is appropriately substantiated",
  },
  {
    pattern: /\bact now\b/gi,
    severity: "low",
    category: "unsupported_claim",
    explanation: "Urgency can pressure readers and should reflect a real deadline.",
    suggestion: () => "learn more",
    replacement: () => "learn more",
  },
  {
    pattern: /\blimited time\b/gi,
    severity: "medium",
    category: "unsupported_claim",
    explanation: "Time-limited availability should be supported by a real deadline.",
    suggestion: () => "state the actual availability period",
  },
  {
    pattern: /!!!+/g,
    severity: "low",
    category: "unsupported_claim",
    explanation: "Repeated exclamation marks can make promotional copy feel overstated.",
    suggestion: () => "!",
    replacement: () => "!",
  },
  {
    pattern: /\b[A-Z]{2,}\b/g,
    severity: "low",
    category: "unsupported_claim",
    explanation: "All-caps emphasis can read as shouting; use standard capitalization.",
    suggestion: (evidence) => evidence.toLowerCase(),
  },
];

export function analyzeWithRules(content: string): Finding[] {
  const findings: Finding[] = [];

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(content)) !== null) {
      const evidence = match[0];
      findings.push({
        id: `rule-${findings.length + 1}`,
        severity: rule.severity,
        category: rule.category,
        evidence,
        explanation: rule.explanation,
        replacement: rule.replacement?.(match) ?? null,
        suggestion: rule.suggestion(evidence),
      });
    }
  }

  return findings;
}
