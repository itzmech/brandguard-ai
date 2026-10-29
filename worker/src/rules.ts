import type { Finding, FindingCategory, FindingSeverity } from "./types.ts";

function findContext(content: string, start: number, end: number): string {
  let contextStart = start;
  while (contextStart > 0 && !/[\n\r.!?]/.test(content[contextStart - 1])) {
    contextStart -= 1;
  }
  while (contextStart < start && /\s/.test(content[contextStart])) {
    contextStart += 1;
  }

  let contextEnd = end;
  while (contextEnd < content.length && !/[\n\r.!?]/.test(content[contextEnd])) {
    contextEnd += 1;
  }
  if (contextEnd < content.length && /[.!?]/.test(content[contextEnd])) {
    contextEnd += 1;
  }

  return content.slice(contextStart, contextEnd);
}

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
    pattern: /\b100%\s+guaranteed(?:\s+(?:results?(?:\s+\w+){0,4}|to(?:\s+\w+){1,4}))?/gi,
    severity: "high",
    category: "needs_verification",
    explanation: "This absolute guarantee needs supporting evidence before it can be rewritten safely.",
    suggestion: () => "Verify the guarantee and any stated outcome before publishing.",
  },
  {
    pattern: /\bguaranteed\b(?:\s+(?:results?(?:\s+\w+){0,4}|to(?:\s+\w+){1,4}))?/gi,
    severity: "high",
    category: "needs_verification",
    explanation: "This guarantee needs supporting evidence before it can be rewritten safely.",
    suggestion: () => "Verify the guarantee and any stated outcome before publishing.",
  },
  {
    pattern: /\b100%(?!\w)/gi,
    severity: "high",
    category: "needs_verification",
    explanation: "This absolute percentage needs evidence supporting the precise figure.",
    suggestion: () => "Verify the percentage against reliable supporting evidence.",
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
      const targetStart = match.index;
      const replacement = rule.replacement?.(match) ?? null;
      findings.push({
        id: `rule-${findings.length + 1}`,
        severity: rule.severity,
        category: rule.category,
        evidence,
        context: findContext(content, targetStart, targetStart + evidence.length),
        targetStart,
        explanation: rule.explanation,
        replacement,
        suggestions: replacement
          ? [{ text: replacement, requiresVerification: false }]
          : [],
        suggestion: rule.suggestion(evidence),
      });
    }
  }

  return findings;
}
