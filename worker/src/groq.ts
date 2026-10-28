import type { Env, Finding, FindingSeverity } from "./types.ts";

const GROQ_MODEL = "llama-3.1-8b-instant";
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
                'Analyze marketing copy for compliance risks. Return only a JSON object shaped as {"findings":[...]}, with at most 5 findings. Each finding must have severity ("high", "medium", or "low"), evidence copied exactly from the submitted text, explanation, and a concise concrete rewrite in suggestion. Do not invent facts or add markdown. If no issues are found, return {"findings":[]}.',
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
    const { severity, evidence, explanation, suggestion } = item;
    if (
      !isSeverity(severity) ||
      typeof evidence !== "string" ||
      !evidence.trim() ||
      typeof explanation !== "string" ||
      !explanation.trim() ||
      typeof suggestion !== "string" ||
      !suggestion.trim() ||
      !content.toLowerCase().includes(evidence.toLowerCase())
    ) {
      continue;
    }

    findings.push({
      id: `llm-${findings.length + 1}`,
      severity,
      category: "unsupported_claim",
      evidence,
      explanation: explanation.trim(),
      replacement: null,
      suggestion: suggestion.trim(),
    });
  }

  if (parsed.findings.length > 0 && findings.length === 0) {
    throw new Error("Groq returned no valid findings.");
  }

  return findings;
}
