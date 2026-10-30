import type { Finding, FindingCategory, FindingSeverity } from "./types.ts";

export function findContextRange(
  content: string,
  start: number,
  end: number
): { start: number; end: number } {
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
  while (contextEnd < content.length && /[.!?]/.test(content[contextEnd])) {
    contextEnd += 1;
  }

  return { start: contextStart, end: contextEnd };
}

function getFindingRange(
  content: string,
  finding: Finding
): { start: number; end: number } | null {
  const { targetStart, targetEnd, evidence } = finding;
  if (
    typeof targetStart !== "number" ||
    typeof targetEnd !== "number" ||
    targetStart < 0 ||
    targetEnd <= targetStart ||
    content.slice(targetStart, targetEnd) !== evidence
  ) {
    return null;
  }
  return { start: targetStart, end: targetEnd };
}

export function consolidateOverlappingFindings(
  content: string,
  findings: Finding[]
): Finding[] {
  const ordered = findings
    .map((finding, order) => ({
      finding,
      order,
      range: getFindingRange(content, finding),
    }))
    .sort((left, right) => {
      if (!left.range) return right.range ? 1 : left.order - right.order;
      if (!right.range) return -1;
      return left.range.start - right.range.start || left.order - right.order;
    });

  const groups: typeof ordered[] = [];
  for (const entry of ordered) {
    const previousGroup = groups[groups.length - 1];
    const previousEnd = previousGroup?.reduce(
      (end, member) => Math.max(end, member.range?.end ?? 0),
      0
    );
    if (
      entry.range &&
      previousGroup?.some((member) => member.range) &&
      entry.range.start < previousEnd
    ) {
      previousGroup.push(entry);
    } else {
      groups.push([entry]);
    }
  }

  return groups.map((group) => {
    if (group.length === 1 || group.some(({ range }) => !range)) {
      return group[0].finding;
    }

    const ranged = group.filter(
      (entry): entry is (typeof entry & { range: { start: number; end: number } }) =>
        entry.range !== null
    );
    const start = Math.min(...ranged.map(({ range }) => range.start));
    const end = Math.max(...ranged.map(({ range }) => range.end));
    const evidence = content.slice(start, end);
    const sourceRequiresVerification = ranged.some(
      ({ finding }) =>
        finding.requiresVerification === true ||
        finding.category === "needs_verification"
    );
    const proposals = ranged.flatMap(({ finding, range, order }) => {
      const sourceSuggestions = finding.suggestions?.length
        ? finding.suggestions
        : finding.replacement
          ? [{
              text: finding.replacement,
              requiresVerification: finding.requiresVerification === true,
              rationale: finding.rewriteRationale ?? undefined,
              uncertainty: finding.uncertainty,
            }]
          : [];

      return sourceSuggestions.map((suggestion, suggestionOrder) => ({
        finding,
        order: order * 4 + suggestionOrder,
        suggestion: {
          ...suggestion,
          text:
            evidence.slice(0, range.start - start) +
            suggestion.text +
            evidence.slice(range.end - start),
          requiresVerification:
            sourceRequiresVerification || suggestion.requiresVerification,
        },
      }));
    });
    const seen = new Set<string>();
    const suggestions = proposals
      .filter(({ suggestion }) => {
        if (seen.has(suggestion.text)) return false;
        seen.add(suggestion.text);
        return true;
      })
      .sort((left, right) => {
        const score = (proposal: (typeof proposals)[number]) =>
          Number(!proposal.suggestion.requiresVerification) * 100 +
          Number(Boolean(proposal.suggestion.rationale)) * 10 +
          Number(!proposal.suggestion.uncertainty);
        return score(right) - score(left) || left.order - right.order;
      })
      .slice(0, 3);
    const selected = suggestions[0];
    const representative = selected?.finding ?? ranged[0].finding;
    const contextRange = findContextRange(content, start, end);
    const context = content.slice(contextRange.start, contextRange.end);

    return {
      ...representative,
      evidence,
      context,
      targetStart: start,
      targetEnd: end,
      category: sourceRequiresVerification
        ? "needs_verification"
        : representative.category,
      requiresVerification: sourceRequiresVerification,
      replacement:
        selected && !selected.suggestion.requiresVerification
          ? selected.suggestion.text
          : null,
      suggestions: suggestions.map(({ suggestion }) => suggestion),
      rewriteRationale:
        selected?.suggestion.rationale ?? representative.rewriteRationale ?? null,
      uncertainty:
        selected?.suggestion.uncertainty ?? representative.uncertainty ?? null,
    };
  });
}

interface Rule {
  pattern: RegExp;
  severity: FindingSeverity;
  category: FindingCategory;
  explanation: string;
}

const RULES: Rule[] = [
  {
    pattern: /\b100%\s+guaranteed(?:\s+(?:results?(?:\s+\w+){0,4}|to(?:\s+\w+){1,4}))?/gi,
    severity: "high",
    category: "needs_verification",
    explanation: "This absolute guarantee needs supporting evidence before it can be rewritten safely.",
  },
  {
    pattern: /\bguaranteed\b(?:\s+(?:results?(?:\s+\w+){0,4}|to(?:\s+\w+){1,4}))?/gi,
    severity: "high",
    category: "needs_verification",
    explanation: "This guarantee needs supporting evidence before it can be rewritten safely.",
  },
  {
    pattern: /\b100%(?!\w)/gi,
    severity: "high",
    category: "needs_verification",
    explanation: "This absolute percentage needs evidence supporting the precise figure.",
  },
  {
    pattern: /\bmiracle\s+[\p{L}][\p{L}\p{N}'-]*/giu,
    severity: "medium",
    category: "unsupported_claim",
    explanation: "“Miracle” is an exceptional claim that needs substantiation.",
  },
  {
    pattern: /\bcure\s+[\p{L}][\p{L}\p{N}'-]*/giu,
    severity: "high",
    category: "risk",
    explanation: "A cure claim can imply a medical outcome and requires strong evidence.",
  },
  {
    pattern: /\bact now\b/gi,
    severity: "low",
    category: "unsupported_claim",
    explanation: "Urgency can pressure readers and should reflect a real deadline.",
  },
  {
    pattern: /\blimited time\b/gi,
    severity: "medium",
    category: "unsupported_claim",
    explanation: "Time-limited availability should be supported by a real deadline.",
  },
  {
    pattern: /!!!+/g,
    severity: "low",
    category: "unsupported_claim",
    explanation: "Repeated exclamation marks can make promotional copy feel overstated.",
  },
  {
    pattern: /\b[A-Z]{2,}\b/g,
    severity: "low",
    category: "unsupported_claim",
    explanation: "All-caps emphasis can read as shouting; use standard capitalization.",
  },
];

export function analyzeWithRules(content: string): Finding[] {
  const findings: Finding[] = [];

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(content)) !== null) {
      const evidenceRange = findContextRange(
        content,
        match.index,
        match.index + match[0].length
      );
      const evidence = content.slice(evidenceRange.start, evidenceRange.end);
      findings.push({
        id: `rule-${findings.length + 1}`,
        severity: rule.severity,
        category: rule.category,
        evidence,
        context: evidence,
        targetStart: evidenceRange.start,
        targetEnd: evidenceRange.end,
        explanation: rule.explanation,
        replacement: null,
        suggestions: [],
      });
    }
  }

  return consolidateOverlappingFindings(content, findings);
}
