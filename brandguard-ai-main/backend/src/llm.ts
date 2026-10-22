type JsonObject = Record<string, unknown>;

export type LLMErrorCategory =
  | 'missing_configuration'
  | 'unsupported_provider'
  | 'invalid_configuration'
  | 'timeout'
  | 'network_error'
  | 'http_error'
  | 'invalid_json'
  | 'missing_response_structure'
  | 'unexpected_response_structure';

export class LLMError extends Error {
  constructor(
    readonly category: LLMErrorCategory,
    message: string,
    readonly statusCode?: number,
    readonly settingName?: string,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

type ProviderConfig =
  | {
      provider: 'ollama';
      model: string;
      url: string;
    }
  | {
      provider: 'gemini' | 'groq' | 'openrouter';
      model: string;
      apiKey: string;
      url: string;
    };

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredSetting(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new LLMError(
      'missing_configuration',
      `Missing required environment variable: ${name}`,
      undefined,
      name,
    );
  }
  return value;
}

function getProviderConfig(): ProviderConfig {
  const provider = (process.env.LLM_PROVIDER || 'ollama').trim().toLowerCase();

  switch (provider) {
    case 'ollama':
      return {
        provider,
        model: requiredSetting('OLLAMA_MODEL'),
        url: `${(process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '')}/api/generate`,
      };
    case 'gemini':
      return {
        provider,
        model: requiredSetting('GEMINI_MODEL'),
        apiKey: requiredSetting('GEMINI_API_KEY'),
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(requiredSetting('GEMINI_MODEL'))}:generateContent`,
      };
    case 'groq':
      return {
        provider,
        model: requiredSetting('GROQ_MODEL'),
        apiKey: requiredSetting('GROQ_API_KEY'),
        url: 'https://api.groq.com/openai/v1/chat/completions',
      };
    case 'openrouter':
      return {
        provider,
        model: requiredSetting('OPENROUTER_MODEL'),
        apiKey: requiredSetting('OPENROUTER_API_KEY'),
        url: 'https://openrouter.ai/api/v1/chat/completions',
      };
    default:
      throw new LLMError('unsupported_provider', 'Unsupported LLM_PROVIDER');
  }
}

function getTimeoutMs(): number {
  const configuredTimeout = process.env.LLM_TIMEOUT_MS;
  if (configuredTimeout === undefined || configuredTimeout.trim() === '') {
    return 30_000;
  }

  const timeoutMs = Number(configuredTimeout);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new LLMError('invalid_configuration', 'LLM_TIMEOUT_MS must be a positive integer');
  }

  return timeoutMs;
}

async function readJsonResponse(
  response: Response,
  provider: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    if (signal.aborted) {
      throw new LLMError('timeout', `${provider} request timed out after ${timeoutMs}ms`);
    }
    throw new LLMError('invalid_json', `${provider} returned invalid JSON`);
  }
}

function getChatCompletionText(data: unknown, provider: string): string {
  if (!isRecord(data) || !Array.isArray(data.choices)) {
    throw new LLMError(
      'unexpected_response_structure',
      `${provider} response had an unexpected structure`,
    );
  }

  const choice = data.choices[0];
  if (!isRecord(choice) || !isRecord(choice.message)) {
    throw new LLMError(
      'unexpected_response_structure',
      `${provider} response had an unexpected structure`,
    );
  }

  const text = choice.message.content;
  if (typeof text !== 'string' || text.length === 0) {
    throw new LLMError(
      'unexpected_response_structure',
      `${provider} response had an unexpected structure`,
    );
  }

  return text;
}

function getGeminiText(data: unknown): string {
  if (!isRecord(data)) {
    throw new LLMError('unexpected_response_structure', 'Gemini response was not an object');
  }
  if (!('candidates' in data)) {
    throw new LLMError('missing_response_structure', 'Gemini response did not include candidates');
  }
  if (!Array.isArray(data.candidates)) {
    throw new LLMError('unexpected_response_structure', 'Gemini candidates had an unexpected structure');
  }
  if (data.candidates.length === 0) {
    throw new LLMError('missing_response_structure', 'Gemini response did not contain a candidate');
  }

  const candidate = data.candidates[0];
  if (!isRecord(candidate)) {
    throw new LLMError('unexpected_response_structure', 'Gemini candidate had an unexpected structure');
  }
  if (!('content' in candidate)) {
    throw new LLMError('missing_response_structure', 'Gemini candidate did not include content');
  }
  if (!isRecord(candidate.content)) {
    throw new LLMError('unexpected_response_structure', 'Gemini content had an unexpected structure');
  }
  if (!('parts' in candidate.content)) {
    throw new LLMError('missing_response_structure', 'Gemini content did not include parts');
  }
  if (!Array.isArray(candidate.content.parts)) {
    throw new LLMError('unexpected_response_structure', 'Gemini parts had an unexpected structure');
  }

  const text = candidate.content.parts
    .filter(isRecord)
    .map((part) => part.text)
    .filter((part): part is string => typeof part === 'string')
    .join('');

  if (!text) {
    throw new LLMError('missing_response_structure', 'Gemini response did not contain text');
  }

  return text;
}

export async function callLLM(prompt: string): Promise<string> {
  const config = getProviderConfig();
  const timeoutMs = getTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let headers: HeadersInit = { 'Content-Type': 'application/json' };
  let body: JsonObject;

  if (config.provider === 'ollama') {
    body = { model: config.model, prompt, stream: false };
  } else if (config.provider === 'gemini') {
    headers = { ...headers, 'x-goog-api-key': config.apiKey };
    body = { contents: [{ parts: [{ text: prompt }] }] };
  } else {
    headers = { ...headers, Authorization: `Bearer ${config.apiKey}` };
    body = {
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
    };
  }

  try {
    let response: Response;
    try {
      response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      if (controller.signal.aborted) {
        throw new LLMError(
          'timeout',
          `${config.provider} request timed out after ${timeoutMs}ms`,
        );
      }
      throw new LLMError('network_error', `${config.provider} network request failed`);
    }

    if (!response.ok) {
      throw new LLMError(
        'http_error',
        `${config.provider} request failed with HTTP ${response.status}`,
        response.status,
      );
    }

    const data = await readJsonResponse(
      response,
      config.provider,
      controller.signal,
      timeoutMs,
    );

    if (config.provider === 'ollama') {
      if (!isRecord(data) || typeof data.response !== 'string' || data.response.length === 0) {
        throw new LLMError(
          'unexpected_response_structure',
          'Ollama response had an unexpected structure',
        );
      }
      return data.response;
    }

    if (config.provider === 'gemini') {
      return getGeminiText(data);
    }

    return getChatCompletionText(data, config.provider);
  } finally {
    clearTimeout(timeout);
  }
}
