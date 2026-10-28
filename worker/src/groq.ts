import type { Env, Finding, FindingSeverity } from "./types.ts";

const GROQ_MODEL = "openai/gpt-oss-20b";
const GROQ_TIMEOUT_MS = 10_000;
const GROQ_PATH = "/openai/v1/chat/completions";
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSeverity(value: unknown): value is FindingSeverity {
  return value === "high" || value === "medium" || value === "low";
}

const GRAMMAR_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "to", "of", "in", "on", "for", "with", "and", "or", "but", "as", "at",
  "by", "from", "that", "this", "these", "those", "it", "its", "our",
  "your", "their", "we", "you", "they",
]);

function introducesUnsupportedTerms(replacement: string, content: string): boolean {
  const sourceTerms = new Set(
    (content.match(/[\p{L}\p{N}%]+/gu) ?? []).map((term) => term.toLowerCase())
  );
  const replacementTerms = replacement.match(/[\p{L}\p{N}%]+/gu) ?? [];
  return replacementTerms.some(
    (term) =>
      !sourceTerms.has(term.toLowerCase()) &&
      !GRAMMAR_WORDS.has(term.toLowerCase())
  );
}

function requiresVerification(evidence: string): boolean {
  return /\b(?:guaranteed|100%|cure)\b/i.test(evidence);
}

async function requestGroq(apiKey: string, content: string): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);
    try {
      const response = await fetch(`https://api.groq.com${GROQ_PATH}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                'Analyze the complete submitted marketing copy for compliance risks. Return only JSON shaped as {"findings":[...]}, with at most 5 findings. Each finding must contain severity ("high", "medium", or "low"), evidence, explanation, and replacement. Evidence must be an exact, case-sensitive substring from the submitted copy and should identify the smallest complete claim span that can be replaced. Use the full sentence and surrounding copy to understand context. A non-null replacement must be a fluent drop-in rewrite for only the evidence span, preserve the original intent and tone where possible, and add no benefits, evidence, statistics, timelines, certifications, or promises not supported by the submitted copy. Do not turn an unsupported positive claim into a negative or awkward phrase merely to remove it. If supporting evidence is needed or no safe context-aware rewrite can be made, set replacement to null and explain what must be verified. Return {"findings":[]} if there are no issues. Do not add markdown.',
            },
            { role: "user", content },
          ],
        }),
        signal: controller.signal,
      });

      console.info(`Groq HTTP ${response.status}; path=${GROQ_PATH}`);
      if (attempt === 0 && RETRYABLE_STATUSES.has(response.status)) {
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        continue;
      }

      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`Groq request failed with HTTP ${response.status}.`);
      }
      return responseText;
    } catch (error) {
      if (controller.signal.aborted) {
        console.info(`Groq HTTP timeout; path=${GROQ_PATH}`);
        throw new Error("Groq request timed out after 10 seconds.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Groq request failed after one retry.");
}

export async function analyzeWithGroq(content: string, env: Env): Promise<Finding[]> {
  const apiKey = env.GROQ_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const responseText = await requestGroq(apiKey, content);
  let response: unknown;
  try {
    response = JSON.parse(responseText);
  } catch {
    throw new Error("Groq returned invalid JSON.");
  }

  if (!isRecord(response) || !Array.isArray(response.choices)) {
    throw new Error("Groq returned an invalid chat completion.");
  }

  const choice = response.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message) || typeof choice.message.content !== "string") {
    throw new Error("Groq returned no JSON message.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(choice.message.content);
  } catch {
    throw new Error("Groq returned invalid findings JSON.");
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.findings)) {
    throw new Error("Groq findings JSON did not contain a findings array.");
  }

  const findings: Finding[] = [];
  for (const item of parsed.findings.slice(0, 5)) {
    if (!isRecord(item)) continue;
    const { severity, evidence, explanation, replacement } = item;
    const evidenceCount = typeof evidence === "string"
      ? content.split(evidence).length - 1
      : 0;
    if (
      !isSeverity(severity) ||
      typeof evidence !== "string" ||
      !evidence.trim() ||
      evidenceCount !== 1 ||
      typeof explanation !== "string" ||
      !explanation.trim() ||
      !Object.hasOwn(item, "replacement") ||
      (replacement !== null && typeof replacement !== "string")
    ) {
      continue;
    }

    const proposedReplacement =
      typeof replacement === "string" && replacement.trim()
        ? replacement.trim()
        : null;
    const unsupportedRewrite =
      proposedReplacement !== null &&
      (requiresVerification(evidence) ||
        introducesUnsupportedTerms(proposedReplacement, content));

    findings.push({
      id: `llm-${findings.length + 1}`,
      severity,
      category:
        replacement === null || unsupportedRewrite
          ? "needs_verification"
          : "unsupported_claim",
      evidence,
      explanation: unsupportedRewrite
        ? `${explanation.trim()} The suggested wording is not supported by the submitted copy; verify the claim before using a direct rewrite.`
        : explanation.trim(),
      replacement: unsupportedRewrite ? null : proposedReplacement,
    });
  }

  if (parsed.findings.length > 0 && findings.length === 0) {
    throw new Error("Groq returned no valid findings.");
  }

  return findings;
}
