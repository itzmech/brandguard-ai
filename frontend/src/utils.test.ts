import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Finding } from './types.ts';
import { applyReplacement, canApply, escapeRegExp, findAlignedEvidence } from './utils.ts';

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

  it('escapes regular-expression metacharacters', () => {
    assert.equal(escapeRegExp('100% (guaranteed).'), '100% \\(guaranteed\\)\\.');
  });
});
