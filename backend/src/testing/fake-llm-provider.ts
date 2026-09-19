import type {
  LLMProvider,
  StructuredRequest,
} from '../services/llm/llm-provider.js';

/**
 * Test double implementing the real LLMProvider interface.
 *
 * Used only by tests — never imported by application code, and excluded from
 * the production build via tsconfig.
 *
 * Each queued script entry is either a string to return or an Error to throw,
 * consumed one per call. The last entry repeats once exhausted.
 */
export class FakeLLMProvider implements LLMProvider {
  readonly name = 'fake';

  readonly calls: StructuredRequest[] = [];
  private readonly script: Array<string | Error>;
  private cursor = 0;

  constructor(script: Array<string | Error>) {
    if (script.length === 0) {
      throw new Error('FakeLLMProvider requires at least one scripted result');
    }
    this.script = script;
  }

  get callCount(): number {
    return this.calls.length;
  }

  async generateStructured(request: StructuredRequest): Promise<string> {
    this.calls.push(request);

    const index = Math.min(this.cursor, this.script.length - 1);
    this.cursor += 1;

    const next = this.script[index]!;
    if (next instanceof Error) throw next;
    return next;
  }
}

/** No-op sleep so retry tests do not wait on real timers. */
export const instantSleep = async (): Promise<void> => {};
