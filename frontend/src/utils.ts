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

export function findEvidenceRange(
  content: string,
  finding: Pick<Finding, 'evidence' | 'context' | 'targetStart'>
): { start: number; end: number } | null {
  const { evidence, context, targetStart } = finding;
  if (!content || !evidence.trim()) return null;

  if (
    typeof targetStart === 'number' &&
    targetStart >= 0 &&
    content.slice(targetStart, targetStart + evidence.length) === evidence
  ) {
    if (!context) {
      return { start: targetStart, end: targetStart + evidence.length };
    }
    const contextIndex = content.indexOf(context);
    if (
      contextIndex >= 0 &&
      content.indexOf(context, contextIndex + 1) === -1 &&
      targetStart >= contextIndex &&
      targetStart + evidence.length <= contextIndex + context.length
    ) {
      return { start: targetStart, end: targetStart + evidence.length };
    }
  }

  if (context) {
    const contextIndex = content.indexOf(context);
    if (contextIndex >= 0 && content.indexOf(context, contextIndex + 1) === -1) {
      const evidenceIndex = context.indexOf(evidence);
      if (
        evidenceIndex >= 0 &&
        context.indexOf(evidence, evidenceIndex + 1) === -1
      ) {
        const start = contextIndex + evidenceIndex;
        return { start, end: start + evidence.length };
      }
    }
  }

  const firstIndex = content.indexOf(evidence);
  if (firstIndex < 0 || content.indexOf(evidence, firstIndex + 1) >= 0) {
    return null;
  }
  return { start: firstIndex, end: firstIndex + evidence.length };
}

function isSelectedSuggestionSafe(finding: Finding, replacement: string): boolean {
  const selected = finding.suggestions?.find(({ text }) => text === replacement);
  return Boolean(selected && !selected.requiresVerification);
}

/**
 * Decide whether a finding can be safely applied.
 * A finding is applicable ONLY when:
 * 1. It has a non-empty `replacement`.
 * 2. The replacement is actual replacement text, NOT generic advice or guidance.
 * 3. If `content` is provided, the flagged evidence can be located in the content.
 */
export function canApply(
  finding: Finding,
  content?: string,
  selectedReplacement?: string
): boolean {
  if (!finding) return false;

  const rawReplacement = selectedReplacement ?? finding.replacement;

  if (typeof rawReplacement !== 'string' || !rawReplacement.trim()) {
    return false;
  }

  if (
    selectedReplacement !== undefined &&
    !isSelectedSuggestionSafe(finding, selectedReplacement)
  ) {
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
    if (!findEvidenceRange(content, finding)) {
      return false;
    }
  }

  return true;
}

/**
 * Get the specific explanation for why Apply is unavailable for a finding.
 */
export function getApplyDisabledReason(
  finding: Finding,
  content?: string,
  selectedReplacement?: string
): string {
  if (!finding) return 'Invalid finding.';

  if (typeof content === 'string') {
    if (!finding.evidence || !finding.evidence.trim()) {
      return 'No exact evidence span was identified; review and edit this finding manually.';
    }
    if (!findEvidenceRange(content, finding)) {
      const firstIndex = content.indexOf(finding.evidence);
      if (firstIndex === -1) {
      return 'Flagged text not found in current editor content (text was edited or finding is stale).';
      }
      return 'Evidence appears more than once in current content, so the target is ambiguous.';
    }
  }

  const rawReplacement = selectedReplacement ?? finding.replacement;

  if (typeof rawReplacement !== 'string' || !rawReplacement.trim()) {
    return 'Advisory finding: no direct text replacement (external verification or manual editing required).';
  }

  if (
    selectedReplacement !== undefined &&
    !isSelectedSuggestionSafe(finding, selectedReplacement)
  ) {
    return 'This suggestion requires verification before it can be applied.';
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
  finding: Finding,
  selectedReplacement?: string
):
  | {
      success: true;
      newContent: string;
      evidenceStart: number;
      evidenceEnd: number;
    }
  | { success: false; newContent: string; reason: string } {
  if (!canApply(finding, content, selectedReplacement)) {
    return {
      success: false,
      newContent: content,
      reason:
        getApplyDisabledReason(finding, content, selectedReplacement) ||
        'Cannot apply replacement.',
    };
  }

  const rawReplacement =
    selectedReplacement ??
    (typeof finding.replacement === 'string' ? finding.replacement : '');

  const range = findEvidenceRange(content, finding);
  if (!range) {
    return {
      success: false,
      newContent: content,
      reason: 'Flagged text not found in current editor content.',
    };
  }

  // Exact slicing guarantees safe replacement without RegExp or $ metacharacter substitution side effects
  const newContent =
    content.slice(0, range.start) + rawReplacement + content.slice(range.end);
  return {
    success: true,
    newContent,
    evidenceStart: range.start,
    evidenceEnd: range.end,
  };
}

function getSentenceContext(content: string, start: number, end: number): string {
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

export function invalidateOverlappingFindings(
  content: string,
  findings: Finding[],
  appliedFindingId: string,
  appliedEvidenceStart: number,
  appliedEvidenceEnd: number,
  updatedContent?: string,
  appliedReplacement?: string
): Finding[] {
  return findings.map((finding) => {
    if (finding.id === appliedFindingId) {
      return appliedReplacement === undefined
        ? finding
        : { ...finding, replacement: appliedReplacement };
    }

    if (!finding.evidence || !finding.evidence.trim()) return finding;

    const range = findEvidenceRange(content, finding);
    if (!range) return finding;
    const overlapsAppliedText =
      range.start < appliedEvidenceEnd && appliedEvidenceStart < range.end;
    if (overlapsAppliedText) {
      return {
        ...finding,
        replacement: null,
        suggestions: [],
        explanation: `${finding.explanation} This evidence overlaps text replaced by another finding, so manual review is required.`,
      };
    }

    if (!updatedContent) return finding;
    const delta = updatedContent.length - content.length;
    const updatedStart =
      range.start >= appliedEvidenceEnd ? range.start + delta : range.start;
    if (
      updatedContent.slice(updatedStart, updatedStart + finding.evidence.length) !==
      finding.evidence
    ) {
      return finding;
    }

    return {
      ...finding,
      targetStart: updatedStart,
      context: getSentenceContext(
        updatedContent,
        updatedStart,
        updatedStart + finding.evidence.length
      ),
    };
  });
}
