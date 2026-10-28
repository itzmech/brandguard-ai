import { describe, it } from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/src/index.ts";
import type { Env } from "../worker/src/types.ts";

describe("Worker: Health Check", () => {
  it("reports Groq key configuration as a boolean without exposing the key", async () => {
    const env: Env = { GROQ_API_KEY: "secret-groq-key-12345" };
    const response = await worker.fetch(new Request("http://localhost/health"), env);

    assert.equal(response.status, 200);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body.status, "ok");
    assert.equal(body.has_groq_api_key, true);
    assert.equal(typeof body.has_groq_api_key, "boolean");
    assert.ok(body.timestamp);
    assert.ok(!JSON.stringify(body).includes("secret-groq-key-12345"));
    assert.ok(!("model" in body));
  });

  it("reports false when GROQ_API_KEY is absent", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/health"),
      {}
    );
    assert.equal(response.status, 200);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body.status, "ok");
    assert.equal(body.has_groq_api_key, false);
  });
});

describe("Worker: Input Validation & Request Limits", () => {
  const env: Env = { GROQ_API_KEY: "test-key" };

  it("returns 400 for empty or whitespace-only content", async () => {
    for (const content of ["", "   \n\t  "]) {
      const response = await worker.fetch(
        new Request("http://localhost/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }),
        env
      );
      assert.equal(response.status, 400);
      const body = await response.json() as { error: string };
      assert.match(body.error, /empty/i);
    }
  });

  it("returns 400 for missing content or non-string content", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wrongField: 123 }),
      }),
      env
    );
    assert.equal(response.status, 400);
    const body = await response.json() as { error: string };
    assert.match(body.error, /content.*string/i);
  });

  it("returns 400 for invalid JSON body", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json{",
      }),
      env
    );
    assert.equal(response.status, 400);
  });

  it("returns 400 if content exceeds 10,000 characters", async () => {
    const response = await worker.fetch(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: "a".repeat(10001) }),
      }),
      env
    );
    assert.equal(response.status, 400);
    const body = await response.json() as { error: string };
    assert.match(body.error, /maximum allowed length/i);
  });
});
