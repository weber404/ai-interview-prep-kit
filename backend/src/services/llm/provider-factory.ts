import { AppError } from '../../types/errors.js';
import { GeminiProvider } from './gemini-provider.js';
import type { LLMProvider } from './llm-provider.js';

const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-1.5-flash',
};

/**
 * Builds the configured provider from environment variables.
 *
 * Missing credentials raise an explicit LLM_NOT_CONFIGURED error — the service
 * never falls back to canned or fabricated requirements.
 */
export function createLLMProvider(env: NodeJS.ProcessEnv = process.env): LLMProvider {
  const providerName = (env.LLM_PROVIDER ?? 'gemini').trim().toLowerCase();
  const apiKey = (env.LLM_API_KEY ?? '').trim();

  if (apiKey.length === 0) {
    throw new AppError(
      'LLM_NOT_CONFIGURED',
      'No language model credentials are configured on the server.',
    );
  }

  switch (providerName) {
    case 'gemini': {
      const model = (env.LLM_MODEL ?? '').trim() || DEFAULT_MODELS.gemini!;
      const timeoutMs = Number.parseInt(env.LLM_TIMEOUT_MS ?? '', 10);
      return new GeminiProvider({
        apiKey,
        model,
        timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : undefined,
      });
    }
    default:
      throw new AppError(
        'LLM_NOT_CONFIGURED',
        `Unsupported LLM_PROVIDER value: "${providerName}".`,
      );
  }
}
