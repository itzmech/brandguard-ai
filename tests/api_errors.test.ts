import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/src/index.ts";
import { analyzeWithGroq } from "../worker/src/groq.ts";
import type { Env } from "../worker/src/types.ts";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const API_KEY = "test-groq-key";

function groqCompletion(findings: unknown[]): Response {
  return Response.json({
    choices: [{ message: { content: JSON.stringify({ findings }) } }],
  });
}

async function analyze(content: string, env: Env = { GROQ_API_KEY: API_KEY }): Promise<Response> {
  return worker.fetch(
    new Request("https://worker.test/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://brandguard-ai-seven.vercel.app",
      },
      body: JSON.stringify({ content }),
    }),
    env
  );
}

describe("Groq analysis and rules fallback", () => {
  it("uses Groq chat completions and returns valid findings with CORS headers", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async (input, init) => {
      assert.equal(String(input), GROQ_URL);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("Authorization"), `Bearer ${API_KEY}`);
      assert.equal(headers.get("Content-Type"), "application/json");
      const requestBody = JSON.parse(String(init?.body));
      assert.equal(requestBody.temperature, 0.2);
      assert.deepEqual(requestBody.response_format, { type: "json_object" });
      assert.equal(typeof requestBody.model, "string");
      return groqCompletion([
        {
          severity: "medium",
          evidence: "best choice",
          explanation: "This comparative claim needs support.",
          suggestion: "a suitable choice",
        },
      ]);
    });

    try {
      const response = await analyze("Our product is the best choice.");
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("X-Analysis-Source"), "groq");
      assert.equal(
        response.headers.get("Access-Control-Allow-Origin"),
        "https://brandguard-ai-seven.vercel.app"
      );
      const body = await response.json() as { findings: Array<Record<string, unknown>> };
      assert.equal(body.findings.length, 1);
      assert.equal(body.findings[0].id, "llm-1");
      assert.equal(body.findings[0].evidence, "best choice");
      assert.equal(body.findings[0].replacement, null);
      assert.equal(body.findings[0].suggestion, "a suitable choice");
      assert.deepEqual(Object.keys(body).sort(), ["findings"]);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("drops Groq findings whose evidence is absent from the source", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "high",
          evidence: "invented phrase",
          explanation: "Unsupported.",
          suggestion: "A rewrite.",
        },
      ])
    );

    try {
      const response = await analyze("This is guaranteed to work.");
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("X-Analysis-Source"), "rules-fallback");
      const body = await response.json() as { findings: Array<{ evidence: string }> };
      assert.ok(body.findings.length > 0);
      assert.ok(body.findings.every((finding) => "This is guaranteed to work.".includes(finding.evidence)));
      assert.ok(body.findings.some((finding) => finding.evidence === "guaranteed"));
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
      const body = await response.json() as { findings: Array<{ evidence: string }> };
      assert.ok(body.findings.some((finding) => finding.evidence === "100% guaranteed"));
    } finally {
      fetchMock.mock.restore();
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
      assert.ok(body.findings.some((finding) => finding.evidence === "miracle cream"));
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
      assert.ok(body.findings.some((finding) => finding.evidence.toLowerCase() === "act now"));
      assert.ok(body.findings.some((finding) => finding.evidence === "!!!"));
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
          Origin: "https://brandguard-ai-seven.vercel.app",
          "Access-Control-Request-Method": "POST",
        },
      }),
      {}
    );
    assert.equal(response.status, 204);
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      "https://brandguard-ai-seven.vercel.app"
    );
  });

  it("validates the Groq response directly and ignores invalid evidence", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      groqCompletion([
        {
          severity: "high",
          evidence: "BEST",
          explanation: "Exaggerated comparison.",
          suggestion: "a better option",
        },
        {
          severity: "invalid",
          evidence: "BEST",
          explanation: "Invalid severity.",
          suggestion: "a suitable option",
        },
        {
          severity: "low",
          evidence: "not present",
          explanation: "Stale.",
          suggestion: "a rewrite",
        },
      ])
    );
    try {
      const findings = await analyzeWithGroq("This is the best choice.", {
        GROQ_API_KEY: API_KEY,
      });
      assert.equal(findings.length, 1);
      assert.equal(findings[0].id, "llm-1");
      assert.equal(findings[0].evidence, "BEST");
    } finally {
      fetchMock.mock.restore();
    }
  });
});
