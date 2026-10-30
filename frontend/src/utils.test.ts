import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Finding } from './types.ts';
import {
  applyAcceptedReplacements,
  applyAndAcceptReplacement,
  applyReplacement,
  canApply,
  clampReviewSummaryWidth,
  escapeRegExp,
  findAlignedEvidence,
  findEvidenceRange,
  invalidateOverlappingFindings,
  updateFindingDecision,
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
  it('replaces the full matched sentence while preserving unrelated source text', () => {
    const content = 'Headline: Guaranteed results in 7 days.\nNext line remains unchanged.';
    const result = applyReplacement(
      content,
      finding({
        evidence: 'Guaranteed results in 7 days.',
        context: 'Guaranteed results in 7 days.',
        targetStart: content.indexOf('Guaranteed'),
        replacement: 'Results may vary; review the supporting information.',
      })
    );

    assert.equal(result.success, true);
    assert.equal(
      result.newContent,
      'Headline: Results may vary; review the supporting information.\nNext line remains unchanged.'
    );
  });

  it('revalidates stale offsets and safely uses a unique exact context', () => {
    const content = 'Earlier text changed. Claim: guaranteed results in 7 days.\nUnrelated.';
    const exactSentence = 'Claim: guaranteed results in 7 days.';
    const result = applyReplacement(
      content,
      finding({
        evidence: exactSentence,
        context: exactSentence,
        targetStart: 2,
        replacement: 'Claim: results depend on individual circumstances.',
      })
    );

    assert.equal(result.success, true);
    assert.equal(
      result.newContent,
      'Earlier text changed. Claim: results depend on individual circumstances.\nUnrelated.'
    );
  });

  it('uses a validated source offset to replace the selected duplicate sentence', () => {
    const content = 'Same sentence.\nSame sentence.';
    const targetStart = content.lastIndexOf('Same sentence.');
    const result = applyReplacement(
      content,
      finding({
        evidence: 'Same sentence.',
        context: 'Same sentence.',
        targetStart,
        replacement: 'Revised sentence.',
      })
    );

    assert.equal(result.success, true);
    assert.equal(result.newContent, 'Same sentence.\nRevised sentence.');
  });

  it('keeps applying a rewrite separate from accepting the finding', () => {
    const pending = { 'finding-1': 'pending' as const };
    const afterApply = updateFindingDecision(pending, 'finding-1', 'applied');

    assert.equal(afterApply['finding-1'], 'applied');
    assert.notEqual(afterApply['finding-1'], 'accepted');
    const afterAccept = updateFindingDecision(afterApply, 'finding-1', 'accepted');
    assert.equal(afterAccept['finding-1'], 'accepted');
    assert.equal(updateFindingDecision(pending, 'finding-1', 'rejected')['finding-1'], 'rejected');
    assert.equal(pending['finding-1'], 'pending');
  });

  it('accepts a finding only when its rewrite succeeds', () => {
    const source = 'Opening stays. Our best option. Closing stays.';
    const target = 'Our best';
    const candidate = finding({
      evidence: target,
      context: 'Our best option.',
      targetStart: source.indexOf(target),
      targetEnd: source.indexOf(target) + target.length,
      replacement: 'A useful',
    });

    const applied = applyAndAcceptReplacement(source, candidate, 'pending');
    assert.equal(applied.success, true);
    if (applied.success) {
      assert.equal(applied.decision, 'accepted');
      assert.equal(applied.newContent, 'Opening stays. A useful option. Closing stays.');
    }

    const invalid = applyAndAcceptReplacement(
      source,
      { ...candidate, evidence: 'stale text' },
      'pending'
    );
    assert.equal(invalid.success, false);
    assert.equal(invalid.newContent, source);
    assert.equal('decision' in invalid, false);
  });

  it('accepts safe spelling and grammar corrections without verification', () => {
    const source = 'Our produckt recieves updates.';
    const evidence = 'produckt recieves';
    const result = applyAndAcceptReplacement(
      source,
      finding({
        evidence,
        context: source,
        targetStart: source.indexOf(evidence),
        targetEnd: source.indexOf(evidence) + evidence.length,
        replacement: null,
        suggestions: [{
          text: 'product receives',
          requiresVerification: false,
        }],
      }),
      'pending',
      'product receives'
    );

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.decision, 'accepted');
      assert.equal(result.newContent, 'Our product receives updates.');
    }
  });

  it('allows applying a safe alternative despite the finding-level verification flag', () => {
    const source = 'Opening stays. My AI will work for sure. Closing stays.';
    const evidence = 'My AI will work for sure.';
    const start = source.indexOf(evidence);
    const candidate = finding({
      category: 'needs_verification',
      evidence,
      context: evidence,
      targetStart: start,
      targetEnd: start + evidence.length,
      requiresVerification: true,
      replacement: 'Explore what my AI can do.',
      suggestions: [
        {
          text: 'Explore what my AI can do.',
          requiresVerification: false,
        },
        {
          text: 'My AI delivers guaranteed results.',
          requiresVerification: true,
        },
      ],
    });

    assert.equal(canApply(candidate, source, 'Explore what my AI can do.'), true);
    assert.equal(canApply(candidate, source, 'My AI delivers guaranteed results.'), true);
    const result = applyAndAcceptReplacement(
      source,
      candidate,
      'pending',
      'Explore what my AI can do.'
    );
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.decision, 'accepted');
      assert.equal(
        result.newContent,
        'Opening stays. Explore what my AI can do. Closing stays.'
      );
    }

    const stale = applyAndAcceptReplacement(
      source.replace(evidence, 'The source has changed.'),
      candidate,
      'pending',
      'Explore what my AI can do.'
    );
    assert.equal(stale.success, false);
    assert.equal('decision' in stale, false);
  });

  it('does not reapply already accepted or applied findings', () => {
    const source = 'First phrase.';
    const candidate = finding({
      evidence: 'phrase',
      targetStart: 6,
      targetEnd: 12,
      replacement: 'revision',
    });
    for (const decision of ['accepted', 'applied'] as const) {
      const result = applyAndAcceptReplacement(source, candidate, decision);
      assert.equal(result.success, false);
      assert.equal(result.newContent, source);
      assert.match(result.reason, /already been applied/i);
    }
  });

  it('keeps reject decision changes separate from editor text', () => {
    const content = 'The original editor text stays.';
    const rejected = updateFindingDecision(
      { 'finding-1': 'pending' },
      'finding-1',
      'rejected'
    );
    assert.equal(rejected['finding-1'], 'rejected');
    assert.equal(content, 'The original editor text stays.');
  });

  it('accepts and rejects findings independently, then applies accepted rewrites together', () => {
    const source = 'Opening stays. Claim A remains. Claim B remains. Closing stays.';
    const firstEvidence = 'Claim A';
    const secondEvidence = 'Claim B';
    const first = finding({
      id: 'first',
      evidence: firstEvidence,
      context: source,
      targetStart: source.indexOf(firstEvidence),
      targetEnd: source.indexOf(firstEvidence) + firstEvidence.length,
      replacement: null,
      suggestions: [{ text: 'A revised claim', requiresVerification: false }],
    });
    const second = finding({
      id: 'second',
      evidence: secondEvidence,
      context: source,
      targetStart: source.indexOf(secondEvidence),
      targetEnd: source.indexOf(secondEvidence) + secondEvidence.length,
      replacement: null,
      suggestions: [{ text: 'A second revision', requiresVerification: false }],
    });
    const third = finding({
      id: 'third',
      evidence: 'Closing',
      context: source,
      targetStart: source.indexOf('Closing'),
      targetEnd: source.indexOf('Closing') + 'Closing'.length,
      replacement: 'Ending',
    });
    const decisions = updateFindingDecision(
      updateFindingDecision(
        updateFindingDecision({}, first.id, 'accepted'),
        second.id,
        'accepted'
      ),
      third.id,
      'rejected'
    );
    assert.deepEqual(decisions, {
      first: 'accepted',
      second: 'accepted',
      third: 'rejected',
    });

    const result = applyAcceptedReplacements(source, [first, second, third], [
      { findingId: first.id, replacement: 'A revised claim' },
      { findingId: second.id, replacement: 'A second revision' },
    ]);
    assert.equal(result.success, true);
    if (!result.success) return;
    assert.equal(
      result.newContent,
      'Opening stays. A revised claim remains. A second revision remains. Closing stays.'
    );
    assert.deepEqual(result.appliedIds, ['first', 'second']);
    assert.equal(result.findings[2].targetStart, result.newContent.indexOf('Closing'));
    assert.equal(
      result.newContent.slice(
        result.findings[2].targetStart!,
        result.findings[2].targetEnd!
      ),
      'Closing'
    );
  });

  it('applies accepted findings atomically and refuses stale or overlapping targets', () => {
    const source = 'First phrase; second phrase.';
    const first = finding({
      id: 'first',
      evidence: 'First phrase',
      context: source,
      targetStart: 0,
      targetEnd: 'First phrase'.length,
      replacement: 'First revision',
    });
    const staleSecond = finding({
      id: 'second',
      evidence: 'not present',
      replacement: 'other',
    });
    const stale = applyAcceptedReplacements(source, [first, staleSecond], [
      { findingId: first.id, replacement: 'First revision' },
      { findingId: staleSecond.id, replacement: 'other' },
    ]);
    assert.equal(stale.success, false);
    assert.equal(stale.newContent, source);

    const overlapping = finding({
      id: 'overlapping',
      evidence: 'phrase',
      context: source,
      targetStart: source.indexOf('phrase'),
      targetEnd: source.indexOf('phrase') + 'phrase'.length,
      replacement: 'word',
    });
    const conflict = applyAcceptedReplacements(source, [first, overlapping], [
      { findingId: first.id, replacement: 'First revision' },
      { findingId: overlapping.id, replacement: 'word' },
    ]);
    assert.equal(conflict.success, false);
    assert.equal(conflict.newContent, source);
    assert.match(conflict.reason, /overlap/i);
  });

  it('allows a validated direct replacement to be queued without a suggestion list', () => {
    const source = 'A bad claim needs review.';
    const direct = finding({
      id: 'direct',
      evidence: 'bad claim',
      context: source,
      targetStart: source.indexOf('bad claim'),
      targetEnd: source.indexOf('bad claim') + 'bad claim'.length,
      replacement: 'careful wording',
      suggestions: [],
    });

    const result = applyAcceptedReplacements(source, [direct], [
      { findingId: direct.id, replacement: direct.replacement! },
    ]);

    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.newContent, 'A careful wording needs review.');
      assert.deepEqual(result.appliedIds, ['direct']);
    }
  });

  it('clamps the adjustable summary width to usable bounds', () => {
    assert.equal(clampReviewSummaryWidth(100), 240);
    assert.equal(clampReviewSummaryWidth(300), 300);
    assert.equal(clampReviewSummaryWidth(900), 420);
  });

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

    assert.equal(canApply(selected, content, 'unverified alternative'), true);
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

    const firstResult = applyAndAcceptReplacement(content, first, 'pending');
    assert.equal(firstResult.success, true);
    if (!firstResult.success) return;
    const decisions = updateFindingDecision({}, first.id, firstResult.decision);
    assert.equal(decisions.first, 'accepted');
    assert.equal(decisions.second, undefined);
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

    const secondResult = applyAndAcceptReplacement(
      firstResult.newContent,
      reanchored,
      decisions.second ?? 'pending'
    );
    assert.equal(secondResult.success, true);
    if (secondResult.success) {
      assert.equal(secondResult.decision, 'accepted');
      assert.equal(secondResult.newContent, 'First brief edit. Then second edit.');
    }
  });

  it('refuses repeated text when contextual evidence cannot uniquely identify the target', () => {
    const content = 'First flagged phrase. Then flagged phrase.';
    const ambiguous = finding({
      evidence: 'flagged phrase',
      context: 'flagged phrase.',
      targetStart: undefined,
      replacement: 'rewrite',
    });

    assert.equal(findEvidenceRange(content, ambiguous), null);
    assert.equal(canApply(ambiguous, content), false);
    assert.equal(applyReplacement(content, ambiguous).newContent, content);
  });

  it('does not trust an exact stale offset when its context disappeared and evidence repeats', () => {
    const content = 'Updated paragraph: flagged phrase; duplicate flagged phrase.';
    const stale = finding({
      evidence: 'flagged phrase',
      context: 'Original flagged phrase.',
      targetStart: content.indexOf('flagged phrase'),
      targetEnd: content.indexOf('flagged phrase') + 'flagged phrase'.length,
      replacement: 'revised phrase',
    });

    const result = applyReplacement(content, stale);
    assert.equal(result.success, false);
    assert.equal(result.newContent, content);
    assert.match(result.reason, /not found|ambiguous/i);
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

  it('recovers a stale end offset only when the exact contextual match is unique', () => {
    const content = 'First claim: the best option. Second claim: the best option.';
    const evidence = 'the best';
    const findingWithBadEnd = finding({
      evidence,
      context: 'Second claim: the best option.',
      targetStart: content.lastIndexOf(evidence),
      targetEnd: content.lastIndexOf(evidence) + evidence.length + 2,
      replacement: 'a',
    });

    const result = applyReplacement(content, findingWithBadEnd);
    assert.equal(result.success, true);
    assert.equal(result.newContent, 'First claim: the best option. Second claim: a option.');

    const ambiguous = finding({
      evidence,
      context: 'claim: the best',
      targetStart: undefined,
      targetEnd: undefined,
      replacement: 'a',
    });
    assert.equal(applyReplacement(content, ambiguous).success, false);
  });

  it('persists revised content and sends that content for reanalysis', async () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    });
    const api = await import('./api.ts');
    const source = 'A headline: the BEST option for teams. Another headline: the WORST choice for teams.';
    const firstEvidence = 'the BEST';
    const secondEvidence = 'the WORST';
    const firstFinding = finding({
      id: 'first',
      evidence: firstEvidence,
      context: 'A headline: the BEST option for teams.',
      targetStart: source.indexOf(firstEvidence),
      replacement: 'a suitable',
    });
    const secondFinding = finding({
      id: 'second',
      evidence: secondEvidence,
      context: 'Another headline: the WORST choice for teams.',
      targetStart: source.indexOf(secondEvidence),
      replacement: 'a different',
    });
    const batch = applyAcceptedReplacements(source, [firstFinding, secondFinding], [
      { findingId: firstFinding.id, replacement: 'a suitable' },
      { findingId: secondFinding.id, replacement: 'a different' },
    ]);
    assert.equal(batch.success, true);
    if (!batch.success) return;
    const revisedContent = batch.newContent;
    assert.equal(
      revisedContent,
      'A headline: a suitable option for teams. Another headline: a different choice for teams.'
    );
    const fakeId = 'fake-revised-content-test';

    api.setFakeMode(true);
    try {
      await api.saveReview(fakeId, revisedContent, [{
        ...firstFinding,
        replacement: 'a suitable',
      }, {
        ...secondFinding,
        replacement: 'a different',
      }]);
      const restored = await api.loadReview(fakeId);
      assert.equal(restored.content, revisedContent);

      api.setFakeMode(false);
      const submittedContents: string[] = [];
      const fetchMock = mock.method(globalThis, 'fetch', async (_input, init) => {
        const requestBody = JSON.parse(String(init?.body));
        submittedContents.push(requestBody.content);
        return Response.json({
          findings: [],
          analysisSource: 'groq',
          analysisMessage: null,
        });
      });
      try {
        const initialResult = await api.analyze(source);
        const result = await api.analyze(restored.content);
        const secondResult = await api.analyze(restored.content);
        assert.equal(initialResult.analysisSource, 'groq');
        assert.deepEqual(result.findings, []);
        assert.equal(result.analysisSource, 'groq');
        assert.deepEqual(secondResult.findings, []);
        assert.equal(secondResult.analysisSource, 'groq');
        assert.deepEqual(submittedContents, [source, revisedContent, revisedContent]);
        assert.equal(fetchMock.mock.calls.length, 3);
      } finally {
        fetchMock.mock.restore();
      }
    } finally {
      api.setFakeMode(false);
    }
  });
});
