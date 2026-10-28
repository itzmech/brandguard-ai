// Safe text-replacement helpers for BrandGuard findings.
// Findings store the literal flagged substring (`evidence`), the rationale (`explanation`),
// and the actual ready-to-insert rewrite (`replacement`).
// "Apply" replaces only the flagged substring using `replacement`, preserving all
// surrounding text, punctuation, casing, line breaks, and formatting.

import type { Finding } from './types.ts';

/**
 * Escape a plain string so it can be used as a literal match in a regular expression.
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * General check to verify whether a string is advice/guidance rather than
 * a direct drop-in replacement text.
 */
export function isAdviceText(text: string): boolean {
  if (!text || !text.trim()) return false;
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Common imperative advice openings
  const adviceOpenings = [
    /^(?:please\s+)?avoid\b/i,
    /^(?:please\s+)?do\s+not\b/i,
    /^(?:please\s+)?don't\b/i,
    /^(?:please\s+)?never\b/i,
    /^(?:please\s+)?consider\b/i,
    /^(?:please\s+)?use\s+(?:a|an|the|more|specific|verifiable|measured|clear|neutral|accurate)\b/i,
    /^(?:please\s+)?ensure\b/i,
    /^(?:please\s+)?provide\b/i,
    /^(?:please\s+)?support\b/i,
    /^(?:please\s+)?substantiate\b/i,
    /^(?:please\s+)?verify\b/i,
    /^(?:please\s+)?explain\b/i,
    /^(?:please\s+)?justify\b/i,
    /^(?:please\s+)?refrain\s+from\b/i,
    /^(?:please\s+)?instead\s+of\b/i,
    /^(?:please\s+)?replace\s+(?:with|this)\b/i,
    /^(?:please\s+)?rephrase\b/i,
    /^(?:please\s+)?rewrite\b/i,
    /^(?:please\s+)?reword\b/i,
    /^(?:please\s+)?remove\s+(?:this|the)\b/i,
    /^(?:please\s+)?omit\b/i,
    /^(?:please\s+)?check\b/i,
    /^(?:please\s+)?cite\b/i,
    /^(?:please\s+)?document\b/i,
  ];

  if (adviceOpenings.some((regex) => regex.test(trimmed))) {
    return true;
  }

  // Guidance cues anywhere in the string that signify advice rather than replacement text
  const adviceCues = [
    'specific, verifiable',
    'verifiable description',
    "product's benefits",
    'product’s benefits',
    'supporting evidence',
    'third-party proof',
    'third-party verification',
    'clinical proof',
    'must be substantiated',
    'requires substantiation',
    'requires verification',
    'requires evidence',
    'unsubstantiated claim',
    'truth-in-advertising',
    'regulatory guidelines',
    'consumer protection',
  ];

  if (adviceCues.some((cue) => lower.includes(cue))) {
    return true;
  }

  return false;
}

/**
 * Return the exact evidence span only when it occurs once in current content.
 * Fuzzy or repeated matches are ambiguous and must not be rewritten.
 */
export function findAlignedEvidence(
  content: string,
  evidence: string
): string | null {
  if (!content || !evidence || !evidence.trim()) return null;

  const firstIndex = content.indexOf(evidence);
  if (firstIndex === -1 || content.indexOf(evidence, firstIndex + 1) !== -1) {
    return null;
  }
  return evidence;
}

/**
 * Decide whether a finding can be safely applied.
 * A finding is applicable ONLY when:
 * 1. It has a non-empty `replacement`.
 * 2. The replacement is actual replacement text, NOT generic advice or guidance.
 * 3. If `content` is provided, the flagged evidence can be located in the content.
 */
export function canApply(finding: Finding, content?: string): boolean {
  if (!finding) return false;

  const rawReplacement = finding.replacement;

  if (typeof rawReplacement !== 'string' || !rawReplacement.trim()) {
    return false;
  }

  if (isAdviceText(rawReplacement)) {
    return false;
  }
  if (rawReplacement.trim().toLowerCase() === finding.explanation.trim().toLowerCase()) {
    return false;
  }

  if (typeof content === 'string') {
    if (!finding.evidence || !finding.evidence.trim()) {
      return false;
    }
    if (!findAlignedEvidence(content, finding.evidence)) {
      return false;
    }
  }

  return true;
}

/**
 * Get the specific explanation for why Apply is unavailable for a finding.
 */
export function getApplyDisabledReason(finding: Finding, content?: string): string {
  if (!finding) return 'Invalid finding.';

  if (typeof content === 'string') {
    if (!finding.evidence || !finding.evidence.trim()) {
      return 'No exact evidence span was identified; review and edit this finding manually.';
    }
    const firstIndex = content.indexOf(finding.evidence);
    if (firstIndex === -1) {
      return 'Flagged text not found in current editor content (text was edited or finding is stale).';
    }
    if (content.indexOf(finding.evidence, firstIndex + 1) !== -1) {
      return 'Evidence appears more than once in current content, so the target is ambiguous.';
    }
  }

  const rawReplacement = finding.replacement;

  if (typeof rawReplacement !== 'string' || !rawReplacement.trim()) {
    return 'Advisory finding: no direct text replacement (external verification or manual editing required).';
  }

  if (isAdviceText(rawReplacement)) {
    return 'Advisory guidance only: not a ready-to-insert rewrite.';
  }
  if (rawReplacement.trim().toLowerCase() === finding.explanation.trim().toLowerCase()) {
    return 'Advisory guidance only: the replacement repeats the explanation.';
  }

  return '';
}

/**
 * Safely applies the replacement text for a finding to the content.
 * Preserves all surrounding content, punctuation, spacing, and line breaks.
 * Never inserts explanation, guidance, or advice.
 */
export function applyReplacement(
  content: string,
  finding: Finding
):
  | {
      success: true;
      newContent: string;
      evidenceStart: number;
      evidenceEnd: number;
    }
  | { success: false; newContent: string; reason: string } {
  if (!canApply(finding, content)) {
    return {
      success: false,
      newContent: content,
      reason: getApplyDisabledReason(finding, content) || 'Cannot apply replacement.',
    };
  }

  const rawReplacement = typeof finding.replacement === 'string' ? finding.replacement : '';

  const aligned = findAlignedEvidence(content, finding.evidence);
  if (!aligned) {
    return {
      success: false,
      newContent: content,
      reason: 'Flagged text not found in current editor content.',
    };
  }

  const idx = content.indexOf(aligned);
  if (idx === -1) {
    return {
      success: false,
      newContent: content,
      reason: 'Could not locate evidence index in content.',
    };
  }

  // Exact slicing guarantees safe replacement without RegExp or $ metacharacter substitution side effects
  const newContent = content.slice(0, idx) + rawReplacement + content.slice(idx + aligned.length);
  return {
    success: true,
    newContent,
    evidenceStart: idx,
    evidenceEnd: idx + aligned.length,
  };
}

export function invalidateOverlappingFindings(
  content: string,
  findings: Finding[],
  appliedFindingId: string,
  appliedEvidenceStart: number,
  appliedEvidenceEnd: number
): Finding[] {
  return findings.map((finding) => {
    if (
      finding.id === appliedFindingId ||
      typeof finding.replacement !== 'string' ||
      !finding.replacement.trim()
    ) {
      return finding;
    }

    if (!finding.evidence || !finding.evidence.trim()) return finding;

    let evidenceStart = content.indexOf(finding.evidence);
    let overlapsAppliedText = false;
    while (evidenceStart !== -1) {
      const evidenceEnd = evidenceStart + finding.evidence.length;
      if (evidenceStart < appliedEvidenceEnd && appliedEvidenceStart < evidenceEnd) {
        overlapsAppliedText = true;
        break;
      }
      evidenceStart = content.indexOf(finding.evidence, evidenceStart + 1);
    }
    if (!overlapsAppliedText) return finding;

    return {
      ...finding,
      replacement: null,
      explanation: `${finding.explanation} This evidence overlaps text replaced by another finding, so manual review is required.`,
    };
  });
}
