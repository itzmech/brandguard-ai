import type {
  Env,
  Finding,
  FindingCategory,
  FindingSeverity,
  RewriteSuggestion,
} from "./types.ts";

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

function isCategory(value: unknown): value is FindingCategory {
  return value === "risk" || value === "unsupported_claim" || value === "needs_verification";
}

function findExactOccurrences(text: string, value: string): number[] {
  const positions: number[] = [];
  let position = text.indexOf(value);
  while (position !== -1) {
    positions.push(position);
    position = text.indexOf(value, position + 1);
  }
  return positions;
}

function findTarget(content: string, evidence: string, context: unknown): number | null {
  if (typeof context === "string" && context.length > 0) {
    const contextPositions = findExactOccurrences(content, context);
    if (contextPositions.length !== 1) return null;
    const evidencePositions = findExactOccurrences(context, evidence);
    return evidencePositions.length === 1
      ? contextPositions[0] + evidencePositions[0]
      : null;
  }

  const positions = findExactOccurrences(content, evidence);
  return positions.length === 1 ? positions[0] : null;
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
  return /(?:\bguarantee(?:d|s)?\b|\b100\s*%|\bcures?\b|\bmiracle\b|\bproven\b|\bcertified\b)/i.test(evidence);
}

function isAdvice(text: string, explanation: string): boolean {
  return (
    /^(?:please\s+)?(?:avoid|verify|use|consider|provide|remove|check|cite|substantiate|rewrite|replace|ensure)\b/i.test(text) ||
    text.trim().toLowerCase() === explanation.trim().toLowerCase()
  );
}

function parseSuggestions(
  item: JsonRecord,
  supportingContext: string,
  evidence: string,
  explanation: string
): RewriteSuggestion[] {
  const candidates: unknown[] = Array.isArray(item.suggestions)
    ? item.suggestions.slice(0, 3)
    : [];
  if (typeof item.replacement === "string" && item.replacement.trim()) {
    candidates.unshift({
      text: item.replacement,
      requiresVerification: requiresVerification(evidence),
    });
  }

  const suggestions: RewriteSuggestion[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    const text = typeof candidate.text === "string" ? candidate.text.trim() : "";
    if (
      !text ||
      text.length > 500 ||
      typeof candidate.requiresVerification !== "boolean" ||
      isAdvice(text, explanation) ||
      seen.has(text)
    ) {
      continue;
    }

    const verificationRequired =
      candidate.requiresVerification ||
      requiresVerification(evidence) ||
      introducesUnsupportedTerms(text, supportingContext);
    suggestions.push({ text, requiresVerification: verificationRequired });
    seen.add(text);
    if (suggestions.length === 3) break;
  }

  return suggestions;
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
                'Analyze the complete submitted marketing copy semantically, including informal wording, typos, grammar, claims, headlines, bullets, and calls to action. Return only JSON shaped as {"findings":[...]}, with at most 5 findings. Each finding must contain severity ("high", "medium", or "low"), category ("risk", "unsupported_claim", or "needs_verification"), evidence, context, explanation, and suggestions (an array of up to 3 objects with text and boolean requiresVerification). Evidence and context must be exact, case-sensitive substrings copied from the submitted content; context must identify one occurrence of evidence. Use the complete content to understand tone and meaning. Every suggestion must be a fluent drop-in replacement for evidence only and preserve the original intent and tone where supportable. Never invent benefits, evidence, statistics, timelines, certifications, capabilities, or promises. Do not turn unsupported positive claims into negative wording. For unsupported guarantees or claims that require substantiation, return no directly applicable replacement; you may provide candidate wording only when clearly marked requiresVerification=true. Mark other suggestions requiresVerification=true when they add a factual claim not explicitly supported by the submitted copy. If no safe rewrite is possible, return an empty suggestions array and explain what evidence is needed. Return {"findings":[]} if there are no issues. Do not add markdown.',
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
  if (!content.trim()) {
    throw new Error("Analysis content must not be empty.");
  }
  if (content.length > 10_000) {
    throw new Error("Analysis content exceeds the 10,000 character limit.");
  }

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
    const { severity, category, evidence, context, explanation } = item;
    const targetStart =
      typeof evidence === "string"
        ? findTarget(content, evidence, context)
        : null;
    if (
      !isSeverity(severity) ||
      !isCategory(category) ||
      typeof evidence !== "string" ||
      !evidence.trim() ||
      targetStart === null ||
      typeof explanation !== "string" ||
      !explanation.trim()
    ) {
      continue;
    }

    const suggestions = parseSuggestions(
      item,
      typeof context === "string" ? context : evidence,
      evidence,
      explanation
    );
    const replacement =
      suggestions.find((suggestion) => !suggestion.requiresVerification)?.text ?? null;
    const needsVerification =
      category === "needs_verification" ||
      requiresVerification(evidence) ||
      suggestions.some((suggestion) => suggestion.requiresVerification);

    findings.push({
      id: `llm-${findings.length + 1}`,
      severity,
      category: needsVerification ? "needs_verification" : category,
      evidence,
      context: typeof context === "string" ? context : undefined,
      targetStart,
      explanation: explanation.trim(),
      replacement,
      suggestions,
    });
  }

  if (parsed.findings.length > 0 && findings.length === 0) {
    throw new Error("Groq returned no valid findings.");
  }

  return findings;
}
