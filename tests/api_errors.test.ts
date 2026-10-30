import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/src/index.ts";
import { analyzeWithGroq } from "../worker/src/groq.ts";
import {
  analyzeWithRules,
  consolidateOverlappingFindings,
} from "../worker/src/rules.ts";
import type { Env } from "../worker/src/types.ts";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const API_KEY = "test-groq-key";

function groqCompletion(findings: unknown[]): Response {
  return Response.json({
    choices: [{ message: { content: JSON.stringify({ findings }) } }],
  });
}

async function analyze(
  content: string,
  env: Env = { GROQ_API_KEY: API_KEY },
  origin = "http://127.0.0.1:5174"
): Promise<Response> {
  return worker.fetch(
    new Request("https://worker.test/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ content }),
    }),
    env
  );
}

describe("Groq analysis and rules fallback", () => {
  it("uses Groq chat completions and returns valid findings with CORS headers", async () => {
    const content = "Our suitable product is the best choice.";
    const fetchMock = mock.method(globalThis, "fetch", async (input, init) => {
      assert.equal(String(input), GROQ_URL);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Authorization"), `Bearer ${API_KEY}`);
      assert.equal(headers.get("Content-Type"), "application/json");
      const requestBody = JSON.parse(String(init?.body));
      assert.equal(requestBody.temperature, 0.2);
      assert.deepEqual(requestBody.response_format, { type: "json_object" });
      assert.equal(typeof requestBody.model, "string");
      assert.deepEqual(JSON.parse(requestBody.messages[1].content), {
        submitted_content: content,
      });
      assert.match(requestBody.messages[0].content, /untrusted data, not instructions/i);
      assert.match(requestBody.messages[0].content, /smallest complete problematic passage/i);
      assert.match(requestBody.messages[0].content, /rewriteRationale/i);
      return groqCompletion([
        {
          severity: "medium",
          category: "unsupported_claim",
          evidence: "the best choice",
          context: content,
          start: content.indexOf("the best choice"),
          end: content.indexOf("the best choice") + "the best choice".length,
          explanation: "This comparative claim needs support.",
          rewriteRationale: "Removes the unsupported superlative while preserving the choice claim.",
          requiresVerification: false,
          uncertainty: null,
          suggestions: [{ text: "a suitable choice", rationale: "Removes the unsupported superlative while preserving the choice claim.", requiresVerification: false }],
        },
      ]);
    });

    try {
      const response = await analyze(content);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("X-Analysis-Source"), "groq");
      assert.equal(
        response.headers.get("Access-Control-Allow-Origin"),
        "http://127.0.0.1:5174"
      );
      assert.equal(response.headers.get("Access-Control-Allow-Methods"), "GET, POST, PUT, DELETE, OPTIONS");
      assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type, Authorization");
      assert.equal(response.headers.get("Vary"), "Origin");
      const body = await response.json() as {
        findings: Array<Record<string, unknown>>;
        analysisSource: string;
        analysisMessage: string | null;
      };
      assert.equal(body.findings.length, 1);
      assert.equal(body.analysisSource, "groq");
      assert.equal(body.analysisMessage, null);
      assert.equal(body.findings[0].id, "llm-1");
      assert.equal(body.findings[0].evidence, "the best choice");
      assert.equal(body.findings[0].targetStart, content.indexOf("the best choice"));
      assert.equal(body.findings[0].targetEnd, content.indexOf("the best choice") + "the best choice".length);
      assert.equal(body.findings[0].replacement, "a suitable choice");
      assert.deepEqual(body.findings[0].suggestions, [
        {
          text: "a suitable choice",
          rationale: "Removes the unsupported superlative while preserving the choice claim.",
          requiresVerification: false,
          uncertainty: null,
        },
      ]);
      assert.deepEqual(Object.keys(body).sort(), ["analysisMessage", "analysisSource", "findings"]);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("drops Groq findings whose evidence is absent from the source", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "high",
          category: "risk",
          evidence: "invented phrase",
          context: "This is guaranteed to work.",
          explanation: "Unsupported.",
          suggestions: [{ text: "A rewrite.", requiresVerification: false }],
        },
      ])
    );

    try {
      const response = await analyze("This is guaranteed to work.");
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("X-Analysis-Source"), "rules-fallback");
      const body = await response.json() as { findings: Array<{ evidence: string }> };
      assert.ok(body.findings.length > 0);
      assert.ok(body.findings.some((finding) => finding.evidence === "This is guaranteed to work."));
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("rewrites only the matched passage instead of replacing its surrounding sentence", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "medium",
          category: "unsupported_claim",
          evidence: "BEST choice",
          context: "Our BEST choice is available.",
          start: 4,
          end: 15,
          explanation: "This broad comparison needs support.",
          rewriteRationale: "Removes the absolute ranking while preserving the rest of the sentence.",
          suggestions: [{
            text: "a choice",
            rationale: "Removes the absolute ranking while preserving the rest of the sentence.",
            requiresVerification: false,
          }],
        },
      ])
    );

    try {
      const response = await analyze("Our BEST choice is available.");
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("X-Analysis-Source"), "groq");
      const body = await response.json() as {
        findings: Array<{
          evidence: string;
          targetStart: number;
          replacement: string | null;
          suggestions: unknown[];
        }>;
      };
      const finding = body.findings.find(({ evidence }) => evidence === "BEST choice");
      assert.ok(finding);
      assert.equal(finding.targetStart, 4);
      assert.equal(finding.replacement, "a choice");
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("allows safe spelling and grammar corrections without requiring evidence", async () => {
    const content = "Our produckt recieves updates.";
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "low",
          category: "risk",
          evidence: "produckt recieves",
          context: content,
          start: content.indexOf("produckt recieves"),
          end: content.indexOf("produckt recieves") + "produckt recieves".length,
          explanation: "Correct the spelling and grammar.",
          requiresVerification: false,
          suggestions: [{
            text: "product receives",
            rationale: "Corrects spelling and grammar without changing meaning.",
            requiresVerification: false,
          }],
        },
      ])
    );

    try {
      const response = await analyze(content);
      const body = await response.json() as {
        findings: Array<{
          requiresVerification: boolean;
          replacement: string | null;
          suggestions: Array<{ text: string; requiresVerification: boolean }>;
        }>;
      };
      assert.equal(body.findings.length, 1);
      assert.equal(body.findings[0].requiresVerification, false);
      assert.equal(body.findings[0].replacement, "product receives");
      assert.equal(body.findings[0].suggestions[0].requiresVerification, false);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("evaluates alternatives independently from a finding-level verification flag", async () => {
    const content = "My AI will work for sure.";
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "high",
          category: "needs_verification",
          evidence: content,
          context: content,
          start: 0,
          end: content.length,
          explanation: "The performance guarantee is unsupported.",
          requiresVerification: true,
          suggestions: [
            {
              text: "Explore what my AI can do.",
              rationale: "Recasts the assertion as an invitation without promising performance.",
              requiresVerification: false,
            },
            {
              text: "My AI delivers guaranteed results.",
              rationale: "This alternative retains a guaranteed outcome.",
              requiresVerification: false,
            },
            {
              text: "My AI is designed to assist with your workflow.",
              rationale: "This describes a product capability that needs confirmation.",
              requiresVerification: true,
            },
          ],
        },
      ])
    );

    try {
      const response = await analyze(content);
      const body = await response.json() as {
        findings: Array<{
          requiresVerification: boolean;
          replacement: string | null;
          suggestions: Array<{ text: string; requiresVerification: boolean }>;
        }>;
      };
      assert.equal(body.findings.length, 1);
      const finding = body.findings[0];
      assert.equal(finding.requiresVerification, true);
      assert.equal(finding.replacement, "Explore what my AI can do.");
      assert.deepEqual(
        finding.suggestions.map(({ text, requiresVerification }) => [
          text,
          requiresVerification,
        ]),
        [
          ["Explore what my AI can do.", false],
          ["My AI delivers guaranteed results.", true],
          ["My AI is designed to assist with your workflow.", true],
        ]
      );
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("blocks meaning changes and newly strengthened claims even if the model marks them safe", async () => {
    const content = "Our product is available.";
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "medium",
          category: "unsupported_claim",
          evidence: content,
          context: content,
          start: 0,
          end: content.length,
          explanation: "The replacement strengthens the original claim.",
          requiresVerification: false,
          suggestions: [{
            text: "Our product is guaranteed to work.",
            rationale: "Adds a guarantee absent from the source.",
            requiresVerification: false,
          }, {
            text: "Our product does not work.",
            rationale: "Changes the original claim's meaning.",
            requiresVerification: true,
          }],
        },
      ])
    );

    try {
      const response = await analyze(content);
      const body = await response.json() as {
        findings: Array<{
          replacement: string | null;
          suggestions: Array<{ text: string; requiresVerification: boolean }>;
        }>;
      };
      assert.equal(body.findings.length, 1);
      assert.equal(body.findings[0].replacement, null);
      assert.equal(body.findings[0].suggestions[0].requiresVerification, true);
      assert.equal(body.findings[0].suggestions[1].requiresVerification, true);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("keeps an existing unsupported factual claim blocked after editorial rewriting", async () => {
    const content = "Our product is guaranteed to work.";
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "high",
          category: "unsupported_claim",
          evidence: content,
          context: content,
          start: 0,
          end: content.length,
          explanation: "The outcome claim still requires substantiation.",
          requiresVerification: false,
          suggestions: [{
            text: "Our product is designed to work.",
            rationale: "Softens the wording but does not verify the outcome.",
            requiresVerification: false,
          }],
        },
      ])
    );

    try {
      const response = await analyze(content);
      const body = await response.json() as {
        findings: Array<{
          category: string;
          requiresVerification: boolean;
          replacement: string | null;
          suggestions: Array<{ requiresVerification: boolean }>;
        }>;
      };
      assert.equal(body.findings.length, 1);
      assert.equal(body.findings[0].category, "needs_verification");
      assert.equal(body.findings[0].requiresVerification, true);
      assert.equal(body.findings[0].replacement, null);
      assert.equal(body.findings[0].suggestions[0].requiresVerification, true);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("consolidates overlapping findings while preserving separate passages", async () => {
    const content = "Our best choice. This product is reliable.";
    const firstEvidence = "best choice";
    const firstStart = content.indexOf(firstEvidence);
    const secondEvidence = "This product is reliable.";
    const secondStart = content.indexOf(secondEvidence);
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "medium",
          category: "unsupported_claim",
          evidence: firstEvidence,
          context: content,
          start: firstStart,
          end: firstStart + firstEvidence.length,
          explanation: "The superlative is unsupported.",
          requiresVerification: false,
          suggestions: [{
            text: "a suitable choice",
            rationale: "Softens the superlative without adding a factual claim.",
            requiresVerification: false,
          }],
        },
        {
          severity: "low",
          category: "risk",
          evidence: firstEvidence,
          context: content,
          start: firstStart,
          end: firstStart + firstEvidence.length,
          explanation: "The phrase can be clearer.",
          requiresVerification: false,
          suggestions: [{
            text: "a good option",
            rationale: "Offers a concise contextual alternative.",
            requiresVerification: false,
          }],
        },
        {
          severity: "low",
          category: "risk",
          evidence: secondEvidence,
          context: content,
          start: secondStart,
          end: secondStart + secondEvidence.length,
          explanation: "Review this separate passage.",
          requiresVerification: false,
          suggestions: [{
            text: "This product is dependable.",
            rationale: "Keeps the separate sentence intact.",
            requiresVerification: false,
          }],
        },
      ])
    );

    try {
      const response = await analyze(content);
      const body = await response.json() as {
        findings: Array<{
          evidence: string;
          targetStart: number;
          replacement: string | null;
          suggestions: Array<{ text: string }>;
        }>;
      };
      assert.equal(body.findings.length, 2);
      const consolidated = body.findings.find(({ targetStart }) => targetStart === firstStart);
      assert.ok(consolidated);
      assert.equal(consolidated.evidence, firstEvidence);
      assert.equal(consolidated.replacement, "a suitable choice");
      assert.deepEqual(
        consolidated.suggestions.map(({ text }) => text),
        ["a suitable choice", "a good option"]
      );
      assert.ok(body.findings.some(({ evidence, targetStart }) =>
        evidence === secondEvidence && targetStart === secondStart
      ));
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("consolidates overlapping deterministic fallback findings", () => {
    const findings = analyzeWithRules("100% guaranteed results.");
    assert.equal(findings.length, 1);
    assert.equal(findings[0].evidence, "100% guaranteed results.");
  });

  it("merges partially overlapping rewrite ranges into one full-passage finding", () => {
    const content = "Our bold choice.";
    const broadEvidence = "bold choice";
    const narrowEvidence = "choice";
    const findings = consolidateOverlappingFindings(content, [
      {
        id: "broad",
        severity: "medium",
        category: "risk",
        evidence: broadEvidence,
        context: content,
        targetStart: content.indexOf(broadEvidence),
        targetEnd: content.indexOf(broadEvidence) + broadEvidence.length,
        explanation: "Review the full phrase.",
        requiresVerification: false,
        replacement: "good choice",
        suggestions: [{
          text: "good choice",
          requiresVerification: false,
          rationale: "Rewrites the complete matched phrase.",
        }],
      },
      {
        id: "narrow",
        severity: "low",
        category: "risk",
        evidence: narrowEvidence,
        context: content,
        targetStart: content.indexOf(narrowEvidence),
        targetEnd: content.indexOf(narrowEvidence) + narrowEvidence.length,
        explanation: "Review the final word.",
        requiresVerification: false,
        replacement: "option",
        suggestions: [{
          text: "option",
          requiresVerification: false,
          rationale: "Offers a contextual word alternative.",
        }],
      },
    ]);

    assert.equal(findings.length, 1);
    assert.equal(findings[0].evidence, broadEvidence);
    assert.equal(findings[0].replacement, "good choice");
    assert.deepEqual(findings[0].suggestions?.map(({ text }) => text), [
      "good choice",
      "bold option",
    ]);
  });

  it("finds independent issues in constructed copy and returns no issue for clean copy", async () => {
    const campaign = `Launch ${Date.now()}`;
    const marketingCopy = `${campaign}: This is the best choice for organizing team notes.`;
    const multiParagraphCopy = [
      "A clear introduction describes the service.",
      "This service is guaranteed to solve every issue.",
      "",
      "It is the best fit for a collaborative team.",
    ].join("\n");
    const cleanCopy = `Teams can use ${campaign} to share notes and project updates.`;
    const samples = new Map([
      [
        marketingCopy,
        [{
          severity: "medium",
          category: "unsupported_claim",
          evidence: "the best",
          context: marketingCopy,
          start: marketingCopy.indexOf("the best"),
          end: marketingCopy.indexOf("the best") + "the best".length,
          explanation: "The ranking is unsupported by evidence in the copy.",
          replacement: "a",
          rewriteRationale: "Removes the unsupported ranking while preserving the sentence.",
          requiresVerification: false,
          uncertainty: null,
        }],
      ],
      [
        multiParagraphCopy,
        [
          {
            severity: "high",
            category: "needs_verification",
            evidence: "guaranteed to solve every issue",
            context: "This service is guaranteed to solve every issue.",
            start: multiParagraphCopy.indexOf("guaranteed to solve every issue"),
            end:
              multiParagraphCopy.indexOf("guaranteed to solve every issue") +
              "guaranteed to solve every issue".length,
            explanation: "The outcome requires substantiation.",
            rewriteRationale: null,
            requiresVerification: true,
            uncertainty: "Verify the stated outcome before publication.",
            replacement: null,
            suggestions: [],
          },
          {
            severity: "medium",
            category: "unsupported_claim",
            evidence: "the best fit",
            context: "It is the best fit for a collaborative team.",
            start: multiParagraphCopy.indexOf("the best fit"),
            end: multiParagraphCopy.indexOf("the best fit") + "the best fit".length,
            explanation: "The superlative has no supporting comparison.",
            replacement: "a fit",
            rewriteRationale: "Removes the absolute ranking and leaves the rest intact.",
            requiresVerification: false,
            uncertainty: null,
          },
        ],
      ],
      [cleanCopy, []],
    ]);

    const fetchMock = mock.method(globalThis, "fetch", async (_input, init) => {
      const submitted = JSON.parse(
        JSON.parse(String(init?.body)).messages[1].content
      ).submitted_content as string;
      const findings = samples.get(submitted);
      assert.ok(findings);
      return groqCompletion(findings);
    });

    try {
      const marketingResult = await analyze(marketingCopy);
      const marketingBody = await marketingResult.json() as {
        findings: Array<{ evidence: string; replacement: string | null }>;
        analysisSource: string;
      };
      assert.equal(marketingBody.analysisSource, "groq");
      assert.deepEqual(
        marketingBody.findings.map(({ evidence, replacement }) => ({ evidence, replacement })),
        [{ evidence: "the best", replacement: "a" }]
      );

      const multiParagraphResult = await analyze(multiParagraphCopy);
      const multiParagraphBody = await multiParagraphResult.json() as {
        findings: Array<{ evidence: string; replacement: string | null; uncertainty?: string | null }>;
      };
      assert.equal(multiParagraphBody.findings.length, 2);
      assert.ok(multiParagraphBody.findings.some(({ evidence, replacement, uncertainty }) =>
        evidence === "guaranteed to solve every issue" &&
        replacement === null &&
        uncertainty === "Verify the stated outcome before publication."
      ));
      assert.ok(multiParagraphBody.findings.some(({ evidence, replacement }) =>
        evidence === "the best fit" && replacement === "a fit"
      ));

      const cleanResult = await analyze(cleanCopy);
      const cleanBody = await cleanResult.json() as {
        findings: unknown[];
        analysisSource: string;
      };
      assert.equal(cleanBody.analysisSource, "groq");
      assert.deepEqual(cleanBody.findings, []);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("does not append hardcoded rule findings when Groq finds no issue", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([])
    );

    try {
      const response = await analyze("Our internal code name is BEST, not a marketing claim.");
      const body = await response.json() as {
        findings: unknown[];
        analysisSource: string;
        analysisMessage: string | null;
      };
      assert.equal(body.analysisSource, "groq");
      assert.equal(body.analysisMessage, null);
      assert.deepEqual(body.findings, []);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("anchors repeated identical passages by validated model offsets", async () => {
    const content = [
      "Version alpha offers the best fit for this team.",
      "Version beta offers the best fit for this team.",
    ].join("\n");
    const evidence = "the best fit";
    const firstStart = content.indexOf(evidence);
    const secondStart = content.lastIndexOf(evidence);
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion(
        ["alpha", "beta"].map((version, index) => {
          const start = index === 0 ? firstStart : secondStart;
          const context = `Version ${version} offers the best fit for this team.`;
          return {
            severity: "medium",
            category: "unsupported_claim",
            evidence,
            context,
            start,
            end: start + evidence.length,
            explanation: "The comparison needs evidence.",
            replacement: "a fit",
            rewriteRationale: "Removes the unsupported superlative.",
            requiresVerification: false,
            uncertainty: null,
          };
        })
      )
    );

    try {
      const response = await analyze(content);
      const body = await response.json() as {
        findings: Array<{ evidence: string; targetStart: number; targetEnd: number }>;
      };
      assert.deepEqual(
        body.findings.filter(({ evidence: text }) => text === evidence)
          .map(({ targetStart, targetEnd }) => [targetStart, targetEnd]),
        [
          [firstStart, firstStart + evidence.length],
          [secondStart, secondStart + evidence.length],
        ]
      );
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("keeps an incomplete rewrite advisory instead of applying an ungrounded proposal", async () => {
    const content = "Our product is the best option.";
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "medium",
          category: "unsupported_claim",
          evidence: "the best",
          context: content,
          start: content.indexOf("the best"),
          end: content.indexOf("the best") + "the best".length,
          explanation: "This ranking has no evidence in the provided copy.",
          replacement: "a",
        },
      ])
    );

    try {
      const response = await analyze(content);
      const body = await response.json() as {
        findings: Array<{ evidence: string; replacement: string | null; suggestions: unknown[] }>;
      };
      const finding = body.findings.find(({ evidence }) => evidence === "the best");
      assert.ok(finding);
      assert.equal(finding.replacement, null);
      assert.deepEqual(finding.suggestions, []);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("falls back to deterministic rules on Groq HTTP 503", async () => {
    let attempts = 0;
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      attempts += 1;
      return Response.json({ error: "temporarily unavailable" }, { status: 503 });
    });

    try {
      const response = await analyze("This is 100% guaranteed.");
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("X-Analysis-Source"), "rules-fallback");
      assert.equal(attempts, 2);
      const body = await response.json() as {
        findings: Array<{ evidence: string; replacement: string | null; suggestions: unknown[] }>;
        analysisMessage: string;
      };
      assert.ok(body.findings.some((finding) => finding.evidence === "This is 100% guaranteed."));
      assert.ok(body.findings.every((finding) => finding.replacement === null && finding.suggestions.length === 0));
      assert.match(body.analysisMessage, /AI analysis is unavailable/i);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("logs safe structured provider diagnostics without exposing them in the API response", async () => {
    const submittedContent = "Private phrase: crimson otter launch.";
    const apiKey = "secret-test-token-123";
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      Response.json(
        {
          error: {
            message: `Invalid request for ${submittedContent} using ${apiKey}`,
            code: "invalid_request_error",
            param: "messages",
          },
        },
        { status: 400 }
      )
    );
    const errorLog = mock.method(console, "error", () => {});

    try {
      const response = await analyze(submittedContent, { GROQ_API_KEY: apiKey });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("X-Analysis-Source"), "rules-fallback");
      const body = await response.json() as {
        analysisSource: string;
        analysisMessage: string;
      };
      assert.equal(body.analysisSource, "rules-fallback");
      assert.match(body.analysisMessage, /AI analysis is unavailable/i);
      assert.equal(JSON.stringify(body).includes("invalid_request_error"), false);

      assert.equal(errorLog.mock.calls.length, 1);
      const [eventName, details] = errorLog.mock.calls[0].arguments as [
        string,
        { status: number; message: string; code: string; param: string },
      ];
      assert.equal(eventName, "Groq provider error");
      assert.equal(details.status, 400);
      assert.equal(details.code, "invalid_request_error");
      assert.equal(details.param, "messages");
      assert.match(details.message, /redacted/i);
      assert.equal(JSON.stringify(errorLog.mock.calls).includes(submittedContent), false);
      assert.equal(JSON.stringify(errorLog.mock.calls).includes(apiKey), false);
    } finally {
      fetchMock.mock.restore();
      errorLog.mock.restore();
    }
  });

  it("falls back to deterministic rules when Groq returns invalid JSON", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      new Response("not JSON", { status: 200 })
    );

    try {
      const response = await analyze("Our miracle cream.");
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("X-Analysis-Source"), "rules-fallback");
      const body = await response.json() as { findings: Array<{ evidence: string }> };
      assert.ok(body.findings.some((finding) => finding.evidence === "Our miracle cream."));
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("reports unavailable AI instead of presenting an empty rules fallback as a clear analysis", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      new Response("not JSON", { status: 200 })
    );

    try {
      const response = await analyze(
        "The team can organize projects and share status updates in one workspace."
      );
      const body = await response.json() as {
        findings: unknown[];
        analysisSource: string;
        analysisMessage: string;
      };
      assert.equal(response.status, 200);
      assert.equal(body.analysisSource, "rules-fallback");
      assert.deepEqual(body.findings, []);
      assert.match(body.analysisMessage, /AI analysis is unavailable/i);
      assert.match(body.analysisMessage, /context-aware rewrites were not generated/i);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("falls back to deterministic rules when GROQ_API_KEY is missing", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("Groq must not be called without a key.");
    });

    try {
      const response = await analyze("Act now!!!", {});
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("X-Analysis-Source"), "rules-fallback");
      const body = await response.json() as { findings: Array<{ evidence: string }> };
      assert.ok(body.findings.some((finding) => finding.evidence === "Act now!!!"));
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("keeps an unsupported guarantee advisory instead of inserting a negative rewrite", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "high",
          category: "unsupported_claim",
          evidence: "This product is guaranteed to work.",
          context: "This product is guaranteed to work.",
          explanation: "The guaranteed outcome needs supporting evidence.",
          rewriteRationale: "No safe rewrite can retain the guarantee without evidence.",
          suggestions: [{
            text: "This product is designed to work.",
            requiresVerification: false,
          }],
        },
      ])
    );

    try {
      const response = await analyze("This product is guaranteed to work.");
      const body = await response.json() as {
        findings: Array<{
          evidence: string;
          category: string;
          explanation: string;
          replacement: string | null;
          suggestions: Array<{
            text: string;
            requiresVerification: boolean;
            rationale?: string;
            uncertainty?: string | null;
          }>;
        }>;
      };
      const finding = body.findings.find(
        ({ evidence }) => evidence === "This product is guaranteed to work."
      );
      assert.ok(finding);
      assert.equal(finding.category, "needs_verification");
      assert.equal(finding.replacement, null);
      assert.equal(finding.suggestions[0].requiresVerification, true);
      assert.match(finding.explanation, /supporting evidence/i);
      assert.notEqual(finding.replacement, "not guaranteed");
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("keeps exact evidence for informal and misspelled copy using full sentence context", async () => {
    const content = "our produckt is guarenteed too werk";
    let submittedContent = "";
    const fetchMock = mock.method(globalThis, "fetch", async (_input, init) => {
      submittedContent = JSON.parse(
        JSON.parse(String(init?.body)).messages[1].content
      ).submitted_content;
      return groqCompletion([
        {
          severity: "high",
          category: "needs_verification",
          evidence: content,
          context: content,
          explanation: "This informal guarantee needs evidence before it can be used.",
          suggestions: [],
        },
      ]);
    });

    try {
      const response = await analyze(content);
      assert.equal(response.status, 200);
      assert.equal(submittedContent, content);
      const body = await response.json() as {
        findings: Array<{ evidence: string; context?: string; targetStart?: number }>;
      };
      assert.equal(submittedContent, content);
      assert.ok(body.findings.some((finding) =>
        finding.evidence === content &&
        finding.context === content &&
        finding.targetStart === 0
      ));
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("returns multiple clearly marked advisory suggestions without making them applicable", async () => {
    const content = "This product is guaranteed to work.";
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "high",
          category: "needs_verification",
          evidence: content,
          context: content,
          explanation: "The outcome requires supporting evidence.",
          rewriteRationale: "No safe replacement can retain this outcome claim without verification.",
          suggestions: [
            { text: "This product is intended to work.", requiresVerification: true },
            { text: "This product is designed to work.", requiresVerification: true },
          ],
        },
      ])
    );

    try {
      const response = await analyze(content);
      const body = await response.json() as {
        findings: Array<{
          evidence: string;
          replacement: string | null;
          suggestions: Array<{ text: string; requiresVerification: boolean }>;
        }>;
      };
      const finding = body.findings.find(({ evidence }) => evidence === content);
      assert.ok(finding);
      assert.equal(finding.replacement, null);
      assert.equal(finding.suggestions.length, 2);
      assert.ok(finding.suggestions.every(({ requiresVerification }) => requiresVerification));
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("keeps repeated evidence distinct when each finding has unique exact context", async () => {
    const content = "This service is guaranteed to work. That tool is guaranteed to work.";
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "high",
          category: "needs_verification",
          evidence: "This service is guaranteed to work.",
          context: "This service is guaranteed to work.",
          explanation: "Verify the service outcome.",
          suggestions: [],
        },
        {
          severity: "high",
          category: "needs_verification",
          evidence: "That tool is guaranteed to work.",
          context: "That tool is guaranteed to work.",
          explanation: "Verify the tool outcome.",
          suggestions: [],
        },
      ])
    );

    try {
      const response = await analyze(content);
      const body = await response.json() as {
        findings: Array<{ evidence: string; context?: string; targetStart?: number }>;
      };
      const repeated = body.findings.filter(({ evidence }) =>
        evidence.includes("guaranteed to work")
      );
      assert.deepEqual(repeated.map(({ context }) => context), [
        "This service is guaranteed to work.",
        "That tool is guaranteed to work.",
      ]);
      assert.deepEqual(repeated.map(({ targetStart }) => targetStart), [
        content.indexOf("This service"),
        content.indexOf("That tool"),
      ]);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("marks a suggestion that adds an unsupported factual term as requiring verification", async () => {
    const content = "Our best result.\nThis unrelated item is premium.";
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "medium",
          category: "unsupported_claim",
          evidence: "Our best result.",
          context: "Our best result.",
          explanation: "Comparative claims need evidence.",
          rewriteRationale: "This proposed replacement adds a factual qualifier not in the source.",
          suggestions: [{ text: "Our premium result.", requiresVerification: false }],
        },
      ])
    );

    try {
      const response = await analyze(content);
      const body = await response.json() as {
        findings: Array<{
          evidence: string;
          replacement: string | null;
          suggestions: Array<{ text: string; requiresVerification: boolean }>;
        }>;
      };
      const finding = body.findings.find(({ evidence }) => evidence === "Our best result.");
      assert.ok(finding);
      assert.equal(finding.replacement, null);
      assert.deepEqual(finding.suggestions, [
        {
          text: "Our premium result.",
          requiresVerification: true,
          rationale: "This proposed replacement adds a factual qualifier not in the source.",
          uncertainty: null,
        },
      ]);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("rejects empty and malformed analysis bodies without calling Groq", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("Groq must not be called for invalid content.");
    });

    try {
      const empty = await analyze(" \n ");
      assert.equal(empty.status, 400);
      const malformed = await worker.fetch(
        new Request("https://worker.test/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: { unexpected: true } }),
        }),
        { GROQ_API_KEY: API_KEY }
      );
      assert.equal(malformed.status, 400);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("quotes the complete guaranteed-results claim and requires verification", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      new Response("unavailable", { status: 503 })
    );

    try {
      const response = await analyze("Guaranteed results in 7 days.");
      const body = await response.json() as {
        findings: Array<{ evidence: string; replacement: string | null }>;
      };
      assert.ok(body.findings.some(
        ({ evidence, replacement }) =>
          evidence === "Guaranteed results in 7 days." && replacement === null
      ));
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("returns an advisory when Groq cannot safely rewrite an evidence-dependent claim", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "high",
          category: "needs_verification",
          evidence: "Our service guarantees results in 7 days.",
          context: "Our service guarantees results in 7 days.",
          explanation: "Verify the guarantee and seven-day outcome with reliable evidence.",
          suggestions: [],
        },
      ])
    );

    try {
      const response = await analyze("Our service guarantees results in 7 days.");
      assert.equal(response.status, 200);
      const body = await response.json() as {
        findings: Array<{ evidence: string; replacement: string | null }>;
      };
      assert.ok(body.findings.some(
        ({ evidence, replacement }) =>
          evidence === "Our service guarantees results in 7 days." && replacement === null
      ));
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("rejects oversized payloads before calling Groq", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("Groq must not be called for oversized payloads.");
    });
    try {
      const response = await worker.fetch(
        new Request("https://worker.test/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": "60000" },
          body: JSON.stringify({ content: "short content" }),
        }),
        { GROQ_API_KEY: API_KEY }
      );
      assert.equal(response.status, 413);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("keeps CORS preflight headers", async () => {
    const response = await worker.fetch(
      new Request("https://worker.test/api/analyze", {
        method: "OPTIONS",
        headers: {
          Origin: "http://127.0.0.1:5174",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
        },
      }),
      {}
    );
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:5174");
    assert.equal(response.headers.get("Access-Control-Allow-Methods"), "GET, POST, PUT, DELETE, OPTIONS");
    assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type, Authorization");
    assert.equal(response.headers.get("Vary"), "Origin");
  });

  it("returns CORS headers on Analyze validation errors", async () => {
    const response = await analyze("  ");
    assert.equal(response.status, 400);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:5174");
    assert.equal(response.headers.get("Access-Control-Allow-Methods"), "GET, POST, PUT, DELETE, OPTIONS");
    assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type, Authorization");
  });

  it("returns CORS headers when the Worker throws", async () => {
    const request = new Request("https://worker.test/api/analyze", {
      method: "POST",
      headers: { Origin: "http://127.0.0.1:5174" },
    });
    Object.defineProperty(request, "url", {
      get() {
        throw new Error("Simulated URL parsing failure.");
      },
    });

    const response = await worker.fetch(request, {});
    assert.equal(response.status, 500);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), "http://127.0.0.1:5174");
    assert.equal(response.headers.get("Access-Control-Allow-Methods"), "GET, POST, PUT, DELETE, OPTIONS");
    assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type, Authorization");
  });

  it("validates the Groq response directly and ignores invalid evidence", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "high",
          category: "unsupported_claim",
          evidence: "This is the best choice.",
          context: "This is the best choice.",
          explanation: "Exaggerated comparison.",
          rewriteRationale: "Removes the unsupported absolute comparison.",
          suggestions: [{ text: "This is a choice.", requiresVerification: false }],
        },
        {
          severity: "invalid",
          category: "unsupported_claim",
          evidence: "BEST",
          context: "This is the best choice.",
          explanation: "Invalid severity.",
          rewriteRationale: "Invalid item.",
          suggestions: [{ text: "a suitable option", requiresVerification: false }],
        },
        {
          severity: "low",
          category: "unsupported_claim",
          evidence: "not present",
          context: "This is the best choice.",
          explanation: "Stale.",
          rewriteRationale: "Invalid evidence.",
          suggestions: [{ text: "a rewrite", requiresVerification: false }],
        },
      ])
    );
    try {
      const findings = await analyzeWithGroq("This is the best choice.", {
        GROQ_API_KEY: API_KEY,
      });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].id, "llm-1");
      assert.equal(findings[0].evidence, "This is the best choice.");
    } finally {
      fetchMock.mock.restore();
    }
  });
});
