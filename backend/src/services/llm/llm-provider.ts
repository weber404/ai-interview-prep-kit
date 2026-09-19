/**
 * Provider-agnostic LLM abstraction.
 *
 * Pipeline stages depend on this interface only. Swapping Gemini for
 * OpenAI / Anthropic / a local model means adding one file that implements
 * `LLMProvider` — no changes to extraction logic.
 */

export interface StructuredRequest {
  /**
   * Trusted developer instructions. Never built from user input.
   */
  systemInstruction: string;
  /**
   * The prompt body. Untrusted user data must already be delimited and
   * labelled as data by the caller.
   */
  userContent: string;
  /** Sampling temperature. Extraction wants low/deterministic output. */
  temperature?: number;
}

export interface LLMProvider {
  /** Human-readable provider id, used in server-side logs only. */
  readonly name: string;

  /**
   * Returns the model's raw text response.
   *
   * Callers must treat the return value as untrusted: it may contain
   * markdown fences, prose around the JSON, or malformed JSON.
   *
   * Implementations throw `ProviderError` for transport/provider failures
   * and mark them retryable when appropriate.
   */
  generateStructured(request: StructuredRequest): Promise<string>;
}
