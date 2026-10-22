import { randomUUID } from 'node:crypto';
import type { Finding } from './types';

type SafetyRule = {
  label: string;
  pattern: RegExp;
  severity: Finding['severity'];
  explanation: string;
  suggestion: string;
};

const RULES: SafetyRule[] = [
  {
    label: 'Absolute guarantees and unsupported claims',
    pattern:
      /(?:\b(?:guaranteed|risk-free|best in the world|number one|proven)\b|(?<![\p{L}\p{N}_])(?:100%|#1)(?![\p{L}\p{N}_]))/giu,
    severity: 'high',
    explanation: 'Absolute guarantees and unsupported claims can overstate what the product can deliver.',
    suggestion: 'Use a specific, verifiable description of the product’s benefits.',
  },
  {
    label: 'Medical and financial claims',
    pattern: /\b(?:cure|miracle|get rich|no side effects)\b/gi,
    severity: 'high',
    explanation: 'Medical or financial claims may imply outcomes that require evidence or qualification.',
    suggestion: 'Describe the product’s intended use and substantiated benefits without promising outcomes.',
  },
  {
    label: 'Absolute cosmetic outcome claims',
    pattern:
      /\b(?:(?:erase|eliminate|remove)s?\s+(?:every|all)\s+wrinkles?(?:\s+(?:overnight|instantly|immediately))?|guaranteed\s+to\s+remove\s+(?:every|all)\s+wrinkles?)\b/gi,
    severity: 'high',
    explanation: 'Absolute wrinkle-removal promises may overstate cosmetic results that vary by person.',
    suggestion: 'Describe supported moisturizing benefits without promising wrinkle removal.',
  },
  {
    label: 'Hype language',
    pattern: /\b(?:amazing|revolutionary|game-changing)\b/gi,
    severity: 'medium',
    explanation: 'Hype language can sound exaggerated and make the message less credible.',
    suggestion: 'Replace the hype with a concrete product feature or customer benefit.',
  },
  {
    label: 'Urgency language',
    pattern: /\b(?:act now|limited time only|last chance)\b/gi,
    severity: 'medium',
    explanation: 'High-pressure urgency can feel manipulative or overly promotional.',
    suggestion: 'State the relevant offer details clearly without pressuring the reader.',
  },
  {
    label: 'Repeated exclamation marks',
    pattern: /!{2,}/g,
    severity: 'low',
    explanation: 'Repeated exclamation marks can make the message appear overly aggressive.',
    suggestion: 'Use a single period or exclamation mark.',
  },
  {
    label: 'Excessive uppercase',
    pattern: /[A-Z]{4,}/g,
    severity: 'low',
    explanation: 'Long uppercase words can read as shouting and distract from the message.',
    suggestion: 'Use sentence case for a calmer, more readable tone.',
  },
  {
    label: 'Competitor comparison or bashing',
    pattern: /\b(?:better\s+than\s+[\p{L}\p{N}][\p{L}\p{N}'&.-]*|(?:competitor|competitors|rival|rivals)\b.{0,40}\b(?:terrible|awful|inferior|useless|worst))\b/giu,
    severity: 'medium',
    explanation: 'Unsubstantiated competitor comparisons or negative claims may seem unfair or misleading.',
    suggestion: 'Focus on your own product’s verifiable strengths instead of criticizing competitors.',
  },
];

export function runRules(content: string): Finding[] {
  const findings: Finding[] = [];
  const seenEvidence = new Set<string>();

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of content.matchAll(rule.pattern)) {
      const evidence = match[0];
      const normalizedEvidence = evidence.toLowerCase();
      if (seenEvidence.has(normalizedEvidence)) {
        continue;
      }

      seenEvidence.add(normalizedEvidence);
      findings.push({
        id: randomUUID(),
        severity: rule.severity,
        evidence,
        explanation: rule.explanation,
        suggestion: rule.suggestion,
      });
    }
  }

  return findings;
}
