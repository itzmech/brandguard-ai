import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyReplacement,
  canApply,
  findAlignedEvidence,
  getApplyDisabledReason,
  invalidateOverlappingFindings,
} from "../frontend/src/utils.ts";
import type { Finding } from "../frontend/src/types.ts";

function createFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "f-1",
    severity: "medium",
    category: "unsupported_claim",
    evidence: "flagged text",
    explanation: "This wording needs review.",
    replacement: "revised text",
    ...overrides,
  };
}

describe("Rewrite application", () => {
  it("does not fabricate findings for arbitrary content in explicit demo mode", async () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });

    const { analyze, setFakeMode } = await import("../frontend/src/api.ts");
    setFakeMode(true);
    try {
      const result = await analyze(
        "Our editorial team publishes clear updates for readers every Monday."
      );
      assert.deepEqual(result.findings, []);
    } finally {
      setFakeMode(false);
    }
  });

  it("uses only replacement and never explanation or legacy suggestion", () => {
    const text = "The original promise remains.";
    const finding = createFinding({
      evidence: "promise",
      explanation: "Avoid unsupported promises.",
      replacement: "statement",
      suggestion: "legacy value",
    });

    const result = applyReplacement(text, finding);
    assert.equal(result.success, true);
    assert.equal(result.newContent, "The original statement remains.");

    const legacyOnly = createFinding({
      evidence: "promise",
      replacement: null,
      suggestion: "legacy value",
    });
    assert.equal(canApply(legacyOnly, text), false);
    assert.equal(applyReplacement(text, legacyOnly).newContent, text);
  });

  it("rejects advice in the replacement field", () => {
    const finding = createFinding({
      evidence: "flagged text",
      replacement: "Avoid absolute guarantees without evidence.",
    });
    assert.equal(canApply(finding, "flagged text"), false);
    assert.match(getApplyDisabledReason(finding, "flagged text"), /guidance/i);
  });

  it("does not apply the explanation when it is repeated as the replacement", () => {
    const explanation = "This wording is not supported by the supplied copy.";
    const finding = createFinding({
      evidence: "flagged text",
      explanation,
      replacement: explanation,
    });
    assert.equal(canApply(finding, "flagged text"), false);
    assert.match(getApplyDisabledReason(finding, "flagged text"), /repeats the explanation/i);
  });

  it("requires exact, case-sensitive evidence and rejects stale or ambiguous spans", () => {
    const original = "Arbitrary copy says BrandGuard keeps every line intact.";
    const exact = createFinding({
      evidence: "keeps every line",
      replacement: "preserves each line",
    });
    assert.equal(findAlignedEvidence(original, exact.evidence), exact.evidence);
    assert.equal(
      applyReplacement(original, exact).newContent,
      "Arbitrary copy says BrandGuard preserves each line intact."
    );

    const stale = createFinding({ evidence: "Keeps every line" });
    assert.equal(findAlignedEvidence(original, stale.evidence), null);
    assert.match(getApplyDisabledReason(stale, original), /stale/i);
    assert.equal(applyReplacement(original, stale).newContent, original);

    const repeated = "This phrase repeats: exact claim; exact claim.";
    const ambiguous = createFinding({ evidence: "exact claim" });
    assert.equal(findAlignedEvidence(repeated, ambiguous.evidence), null);
    assert.match(getApplyDisabledReason(ambiguous, repeated), /ambiguous/i);
    assert.equal(applyReplacement(repeated, ambiguous).newContent, repeated);
  });

  it("disables Apply and explains when no replacement or exact evidence is available", () => {
    const noReplacement = createFinding({ replacement: null });
    assert.equal(canApply(noReplacement, "flagged text"), false);
    assert.match(getApplyDisabledReason(noReplacement, "flagged text"), /no direct text replacement/i);

    const noEvidence = createFinding({ evidence: "", replacement: "replacement" });
    assert.equal(canApply(noEvidence, "some content"), false);
    assert.match(getApplyDisabledReason(noEvidence, "some content"), /evidence span/i);
  });

  it("preserves unrelated punctuation, whitespace, and line breaks across consecutive applies", () => {
    const initial = 'Headline:\n"We guarantee 100% success!"\n\nNext paragraph stays.';
    const first = createFinding({
      id: "f-wide",
      evidence: "guarantee 100% success",
      replacement: "aim to support strong results",
    });
    const second = createFinding({
      id: "f-other",
      evidence: "Next paragraph",
      replacement: "Final paragraph",
    });
    const overlap = createFinding({
      id: "f-overlap",
      evidence: "100% success",
      replacement: "success",
    });

    const afterFirst = applyReplacement(initial, first);
    assert.equal(afterFirst.success, true);
    assert.equal(
      afterFirst.newContent,
      'Headline:\n"We aim to support strong results!"\n\nNext paragraph stays.'
    );
    const afterSecond = applyReplacement(afterFirst.newContent, second);
    assert.equal(
      afterSecond.newContent,
      'Headline:\n"We aim to support strong results!"\n\nFinal paragraph stays.'
    );

    const staleOverlap = applyReplacement(afterFirst.newContent, overlap);
    assert.equal(staleOverlap.success, false);
    assert.equal(staleOverlap.newContent, afterFirst.newContent);
  });

  it("invalidates overlapping findings even if replacement text reintroduces their evidence", () => {
    const content = "The service guarantees 100% delivery.";
    const broad = createFinding({
      id: "broad",
      evidence: "guarantees 100% delivery",
      replacement: "provides 100% delivery estimates",
    });
    const narrow = createFinding({
      id: "narrow",
      evidence: "100% delivery",
      replacement: "delivery",
    });

    const applied = applyReplacement(content, broad);
    assert.equal(applied.success, true);
    assert.equal(findAlignedEvidence(applied.newContent, narrow.evidence), narrow.evidence);

    const updatedFindings = invalidateOverlappingFindings(
      content,
      [broad, narrow],
      broad.id,
      applied.evidenceStart,
      applied.evidenceEnd
    );
    assert.equal(updatedFindings[1].replacement, null);
    assert.match(updatedFindings[1].explanation, /overlaps text replaced/i);
    assert.equal(canApply(updatedFindings[1], applied.newContent), false);
  });

  it("inserts replacement text literally without changing surrounding characters", () => {
    const content = "Before [FLAG].\nAfter.";
    const finding = createFinding({
      evidence: "[FLAG]",
      replacement: "$& value ",
    });
    assert.equal(
      applyReplacement(content, finding).newContent,
      "Before $& value .\nAfter."
    );
  });
});
