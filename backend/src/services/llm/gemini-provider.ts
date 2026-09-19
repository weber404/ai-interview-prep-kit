import { ProviderError } from '../../types/errors.js';
import type { LLMProvider, StructuredRequest } from './llm-provider.js';

const GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Google Gemini provider (AI Studio API).
 *
 * Chosen for Step 3 because it offers a genuine free tier. Implemented with
 * `fetch` so no provider SDK dependency is added.
 *
 * Nothing in this file is imported by the extraction service directly — it is
 * resolved through the provider factory.
 */
export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';

  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(options: {
    apiKey: string;
    model: string;
    timeoutMs?: number;
  }) {
    this.apiKey = options.apiKey;
    this.model = options.model;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async generateStructured(request: StructuredRequest): Promise<string> {
    const url = `${GEMINI_BASE_URL}/${encodeURIComponent(this.model)}:generateContent`;

    const body = {
      systemInstruction: {
        parts: [{ text: request.systemInstruction }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: request.userContent }],
        },
      ],
      generationConfig: {
        temperature: request.temperature ?? 0,
        responseMimeType: 'application/json',
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Header auth keeps the key out of URLs and therefore out of logs.
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (cause) {
      // Network failure or timeout — transient, safe to retry.
      throw new ProviderError('Gemini request failed before a response', {
        retryable: true,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // 401/403 mean bad credentials: retrying cannot help.
      const retryable = response.status !== 401 && response.status !== 403;
      throw new ProviderError(`Gemini responded with HTTP ${response.status}`, {
        retryable,
      });
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ProviderError('Gemini returned a non-JSON envelope', {
        retryable: true,
      });
    }

    const text = extractText(payload);
    if (text === null) {
      throw new ProviderError('Gemini response contained no text part', {
        retryable: true,
      });
    }
    return text;
  }
}

/** Pull the first text part out of the Gemini response envelope. */
function extractText(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const candidates = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  const parts = (candidates[0] as { content?: { parts?: unknown } })?.content
    ?.parts;
  if (!Array.isArray(parts)) return null;

  const texts = parts
    .map((part) => (part as { text?: unknown }).text)
    .filter((t): t is string => typeof t === 'string');

  return texts.length > 0 ? texts.join('') : null;
}
