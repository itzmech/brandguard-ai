import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Finding } from './types.ts';
import {
  applyReplacement,
  canApply,
  escapeRegExp,
  findAlignedEvidence,
  findEvidenceRange,
  invalidateOverlappingFindings,
} from './utils.ts';

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'finding-1',
    severity: 'medium',
    evidence: 'flagged phrase',
    explanation: 'This assertion needs supporting evidence.',
    replacement: 'neutral wording',
    ...overrides,
  };
}

describe('rewrite data safety', () => {
  it('uses a literal exact evidence span and inserts only the replacement', () => {
    const content = 'Arbitrary content: flagged phrase, then untouched text.';
    const result = applyReplacement(
      content,
      finding({
        explanation: 'Avoid making unsupported assertions.',
        replacement: 'carefully reviewed phrase',
        suggestion: 'legacy replacement',
      })
    );

    assert.equal(result.success, true);
    assert.equal(result.newContent, 'Arbitrary content: carefully reviewed phrase, then untouched text.');
  });

  it('does not apply legacy suggestions or advice', () => {
    assert.equal(
      canApply(finding({ replacement: null, suggestion: 'legacy replacement' }), 'flagged phrase'),
      false
    );
    assert.equal(
      canApply(finding({ replacement: 'Use measured, verifiable language.' }), 'flagged phrase'),
      false
    );
  });

  it('rejects stale, case-mismatched, and repeated evidence', () => {
    assert.equal(findAlignedEvidence('A Flagged phrase.', 'flagged phrase'), null);
    assert.equal(findAlignedEvidence('flagged phrase, flagged phrase', 'flagged phrase'), null);

    const stale = applyReplacement('Edited content.', finding());
    assert.equal(stale.success, false);
    assert.equal(stale.newContent, 'Edited content.');
  });

  it('applies only the selected suggestion to its context-anchored repeated span', () => {
    const content = 'First flagged phrase. Then flagged phrase.';
    const firstStart = content.indexOf('flagged phrase');
    const selected = finding({
      evidence: 'flagged phrase',
      context: 'First flagged phrase.',
      targetStart: firstStart,
      replacement: null,
      suggestions: [
        { text: 'first revision', requiresVerification: false },
        { text: 'unverified alternative', requiresVerification: true },
      ],
    });

    assert.equal(canApply(selected, content, 'unverified alternative'), false);
    const result = applyReplacement(content, selected, 'first revision');
    assert.equal(result.success, true);
    assert.equal(result.newContent, 'First first revision. Then flagged phrase.');
    assert.equal(result.newContent.lastIndexOf('flagged phrase'), content.lastIndexOf('flagged phrase'));
    const persistedFinding = invalidateOverlappingFindings(
      content,
      [selected],
      selected.id,
      result.evidenceStart,
      result.evidenceEnd,
      result.newContent,
      'first revision',
    )[0];
    assert.equal(persistedFinding.replacement, 'first revision');
  });

  it('re-anchors the next finding after an earlier replacement changes content length', () => {
    const content = 'First flagged phrase. Then flagged phrase.';
    const first: Finding = {
      ...finding({
        id: 'first',
        evidence: 'flagged phrase',
        context: 'First flagged phrase.',
        targetStart: content.indexOf('flagged phrase'),
        replacement: 'brief edit',
      }),
    };
    const second: Finding = {
      ...finding({
        id: 'second',
        evidence: 'flagged phrase',
        context: 'Then flagged phrase.',
        targetStart: content.lastIndexOf('flagged phrase'),
        replacement: 'second edit',
      }),
    };

    const firstResult = applyReplacement(content, first);
    assert.equal(firstResult.success, true);
    const reanchored = invalidateOverlappingFindings(
      content,
      [first, second],
      first.id,
      firstResult.evidenceStart,
      firstResult.evidenceEnd,
      firstResult.newContent,
    )[1];
    assert.deepEqual(findEvidenceRange(firstResult.newContent, reanchored), {
      start: firstResult.newContent.indexOf('flagged phrase'),
      end: firstResult.newContent.indexOf('flagged phrase') + 'flagged phrase'.length,
    });

    const secondResult = applyReplacement(firstResult.newContent, reanchored);
    assert.equal(secondResult.success, true);
    assert.equal(secondResult.newContent, 'First brief edit. Then second edit.');
  });

  it('refuses repeated text when contextual evidence cannot uniquely identify the target', () => {
    const content = 'First flagged phrase. Then flagged phrase.';
    const ambiguous = finding({
      evidence: 'flagged phrase',
      context: 'flagged phrase.',
      targetStart: content.indexOf('flagged phrase'),
      replacement: 'rewrite',
    });

    assert.equal(findEvidenceRange(content, ambiguous), null);
    assert.equal(canApply(ambiguous, content), false);
    assert.equal(applyReplacement(content, ambiguous).newContent, content);
  });

  it('invalidates overlapping suggestions when another finding replaces their span', () => {
    const content = 'The guaranteed phrase is repeated elsewhere.';
    const broad = finding({
      id: 'broad',
      evidence: 'guaranteed phrase',
      context: 'The guaranteed phrase is repeated elsewhere.',
      targetStart: content.indexOf('guaranteed phrase'),
      replacement: 'verified phrase',
      suggestions: [{ text: 'verified phrase', requiresVerification: false }],
    });
    const overlapping = finding({
      id: 'overlapping',
      evidence: 'guaranteed',
      context: 'The guaranteed phrase is repeated elsewhere.',
      targetStart: content.indexOf('guaranteed'),
      replacement: 'supported',
      suggestions: [{ text: 'supported', requiresVerification: false }],
    });
    const result = applyReplacement(content, broad);
    assert.equal(result.success, true);
    const updated = invalidateOverlappingFindings(
      content,
      [broad, overlapping],
      broad.id,
      result.evidenceStart,
      result.evidenceEnd,
      result.newContent,
    )[1];

    assert.equal(updated.replacement, null);
    assert.deepEqual(updated.suggestions, []);
    assert.equal(canApply(updated, result.newContent), false);
  });

  it('escapes regular-expression metacharacters', () => {
    assert.equal(escapeRegExp('100% (guaranteed).'), '100% \\(guaranteed\\)\\.');
  });
});
