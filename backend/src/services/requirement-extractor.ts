import { RequirementSchema, type Requirement } from '@interview-prep-ai/shared';

import { LlmRequirementOutputSchema } from '../schemas/llm-requirement-output.js';
import { MAX_JD_CHARS } from '../schemas/requirement-request.js';
import { AppError, ProviderError } from '../types/errors.js';
import { extractJsonObject } from '../utils/json-extract.js';
import { logger } from '../utils/logger.js';
import {
  normalizeRequirements,
  type DraftRequirement,
} from '../utils/requirement-normalizer.js';
import { withRetry } from '../utils/retry.js';
import type { LLMProvider } from './llm/llm-provider.js';
import {
  buildUserContent,
  REQUIREMENT_EXTRACTION_REPAIR_INSTRUCTION,
  REQUIREMENT_EXTRACTION_SYSTEM_INSTRUCTION,
} from './prompts/requirement-extraction-prompt.js';

/**
 * Stage 1 of the generation pipeline: job description -> Requirement[].
 *
 * This service knows nothing about questions, flashcards, schedules, company
 * research, or persistence. Later stages call `extractRequirements` and
 * consume its output.
 */

export interface ExtractRequirementsOptions {
  provider: LLMProvider;
  /** Total provider attempts per call, for transient failures. */
  providerAttempts?: number;
  /** Injectable for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_PROVIDER_ATTEMPTS = 2;

/**
 * Validate the raw JD before spending a provider call on it.
 * Throws AppError('INVALID_JD') and returns the trimmed text.
 */
export function validateJobDescription(jd: unknown): string {
  if (typeof jd !== 'string') {
    throw new AppError('INVALID_JD', 'Job description must be a string.');
  }

  const trimmed = jd.trim();

  if (trimmed.length === 0) {
    throw new AppError('INVALID_JD', 'Job description cannot be empty.');
  }

  if (trimmed.length > MAX_JD_CHARS) {
    throw new AppError(
      'INVALID_JD',
      `Job description is too long. Maximum ${MAX_JD_CHARS} characters.`,
    );
  }

  return trimmed;
}

export async function extractRequirements(
  jd: unknown,
  options: ExtractRequirementsOptions,
): Promise<Requirement[]> {
  const jobDescription = validateJobDescription(jd);
  const { provider } = options;
  const attempts = options.providerAttempts ?? DEFAULT_PROVIDER_ATTEMPTS;

  const userContent = buildUserContent(jobDescription);

  // --- Pass 1: original generation -----------------------------------------
  const firstResponse = await callProvider(provider, {
    systemInstruction: REQUIREMENT_EXTRACTION_SYSTEM_INSTRUCTION,
    userContent,
    attempts,
    sleep: options.sleep,
  });

  const firstDrafts = parseDrafts(firstResponse);
  if (firstDrafts) return finalize(firstDrafts);

  // --- Pass 2: single repair retry -----------------------------------------
  // Deliberately separate from the transient-failure retry above, and capped
  // at exactly one attempt so there is no loop.
  logger.warn('Requirement extraction returned unparseable output; repairing', {
    provider: provider.name,
  });

  const repairResponse = await callProvider(provider, {
    systemInstruction: `${REQUIREMENT_EXTRACTION_SYSTEM_INSTRUCTION}\n\n${REQUIREMENT_EXTRACTION_REPAIR_INSTRUCTION}`,
    userContent,
    attempts,
    sleep: options.sleep,
  });

  const repairedDrafts = parseDrafts(repairResponse);
  if (repairedDrafts) return finalize(repairedDrafts);

  logger.error('Requirement extraction failed after repair attempt', {
    provider: provider.name,
  });
  throw new AppError(
    'INVALID_LLM_OUTPUT',
    'The language model returned an invalid requirement structure.',
  );
}

/** Call the provider with transient-failure retry, mapping errors to AppError. */
async function callProvider(
  provider: LLMProvider,
  params: {
    systemInstruction: string;
    userContent: string;
    attempts: number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<string> {
  try {
    return await withRetry(
      () =>
        provider.generateStructured({
          systemInstruction: params.systemInstruction,
          userContent: params.userContent,
          temperature: 0,
        }),
      {
        attempts: params.attempts,
        baseDelayMs: 250,
        // Bad credentials and other permanent failures are not retried.
        isRetryable: (error) =>
          error instanceof ProviderError && error.retryable,
        onRetry: (_error, attempt) => {
          logger.warn('Retrying LLM provider call', {
            provider: provider.name,
            attempt,
          });
        },
        ...(params.sleep ? { sleep: params.sleep } : {}),
      },
    );
  } catch (error) {
    // Log the provider-side reason, return a generic message to the client.
    logger.error('LLM provider call failed', {
      provider: provider.name,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    throw new AppError(
      'LLM_PROVIDER_ERROR',
      'Requirement extraction could not be completed.',
    );
  }
}

/**
 * Raw text -> structured payload -> JSON parse -> Zod validation.
 * Returns null when the output is unusable, so the caller can decide whether
 * to repair or fail.
 */
function parseDrafts(raw: string): DraftRequirement[] | null {
  const payload = extractJsonObject(raw);
  if (payload === null) return null;

  const result = LlmRequirementOutputSchema.safeParse(payload);
  if (!result.success) return null;

  return result.data.requirements;
}

/** Normalize, assign deterministic IDs, then re-validate the canonical shape. */
function finalize(drafts: DraftRequirement[]): Requirement[] {
  const requirements = normalizeRequirements(drafts);

  // Final guard: everything leaving this service satisfies the shared contract.
  for (const requirement of requirements) {
    const result = RequirementSchema.safeParse(requirement);
    if (!result.success) {
      throw new AppError(
        'INVALID_LLM_OUTPUT',
        'The language model returned an invalid requirement structure.',
      );
    }
  }

  return requirements;
}
