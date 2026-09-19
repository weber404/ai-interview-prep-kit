import {
  InterviewQuestionSchema,
  RequirementSchema,
  type InterviewQuestion,
  type Requirement,
} from '@interview-prep-ai/shared';

import {
  LlmQuestionOutputSchema,
  type LlmQuestion,
} from '../schemas/llm-question-output.js';
import { AppError, ProviderError } from '../types/errors.js';
import { extractJsonObject } from '../utils/json-extract.js';
import { logger } from '../utils/logger.js';
import {
  normalizeQuestions,
  type DraftQuestion,
} from '../utils/question-normalizer.js';
import { withRetry } from '../utils/retry.js';
import type { LLMProvider } from './llm/llm-provider.js';
import {
  buildUserContent,
  QUESTION_GENERATION_REPAIR_INSTRUCTION,
  QUESTION_GENERATION_SYSTEM_INSTRUCTION,
} from './prompts/question-generation-prompt.js';

export interface GenerateQuestionsOptions {
  provider: LLMProvider;
  /** Total provider attempts per call, for transient failures. */
  providerAttempts?: number;
  /** Injectable for deterministic tests. */
  sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_PROVIDER_ATTEMPTS = 2;

/**
 * Validates the raw requirements array before invoking the LLM provider.
 * Throws AppError('INVALID_REQUIREMENTS' or 'INVALID_REQUEST').
 */
export function validateRequirements(raw: unknown): Requirement[] {
  if (!Array.isArray(raw)) {
    throw new AppError('INVALID_REQUEST', 'Requirements must be an array.');
  }

  if (raw.length === 0) {
    throw new AppError(
      'INVALID_REQUIREMENTS',
      'Requirements list cannot be empty.',
    );
  }

  const validated: Requirement[] = [];
  for (const item of raw) {
    const result = RequirementSchema.safeParse(item);
    if (!result.success) {
      throw new AppError(
        'INVALID_REQUIREMENTS',
        'Requirements array contains invalid items.',
      );
    }
    validated.push(result.data);
  }

  return validated;
}

/**
 * Stage 2 of the pipeline: Requirement[] -> InterviewQuestion[].
 */
export async function generateQuestions(
  rawRequirements: unknown,
  options: GenerateQuestionsOptions,
): Promise<InterviewQuestion[]> {
  const requirements = validateRequirements(rawRequirements);
  const { provider } = options;
  const attempts = options.providerAttempts ?? DEFAULT_PROVIDER_ATTEMPTS;

  const validRequirementIds = new Set(requirements.map((r) => r.id));
  const userContent = buildUserContent(requirements);

  // --- Pass 1: original generation -----------------------------------------
  const firstResponse = await callProvider(provider, {
    systemInstruction: QUESTION_GENERATION_SYSTEM_INSTRUCTION,
    userContent,
    attempts,
    sleep: options.sleep,
  });

  const firstDrafts = parseDrafts(firstResponse, validRequirementIds);
  if (firstDrafts) {
    return finalize(firstDrafts, validRequirementIds);
  }

  // --- Pass 2: single repair retry -----------------------------------------
  logger.warn('Question generation returned unparseable output; repairing', {
    provider: provider.name,
  });

  const repairResponse = await callProvider(provider, {
    systemInstruction: `${QUESTION_GENERATION_SYSTEM_INSTRUCTION}\n\n${QUESTION_GENERATION_REPAIR_INSTRUCTION}`,
    userContent,
    attempts,
    sleep: options.sleep,
  });

  const repairedDrafts = parseDrafts(repairResponse, validRequirementIds);
  if (repairedDrafts) {
    return finalize(repairedDrafts, validRequirementIds);
  }

  logger.error('Question generation failed after repair attempt', {
    provider: provider.name,
  });
  throw new AppError(
    'INVALID_LLM_OUTPUT',
    'The language model returned an invalid question structure.',
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
    logger.error('LLM provider call failed', {
      provider: provider.name,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    throw new AppError(
      'LLM_PROVIDER_ERROR',
      'Question generation could not be completed.',
    );
  }
}

/**
 * Raw text -> structured payload -> JSON parse -> Zod validation.
 * Verifies that all requirement IDs exist in validRequirementIds and that
 * the questions array is non-empty. Returns null when unusable.
 */
function parseDrafts(
  raw: string,
  validRequirementIds: Set<string>,
): DraftQuestion[] | null {
  const payload = extractJsonObject(raw);
  if (payload === null) return null;

  const result = LlmQuestionOutputSchema.safeParse(payload);
  if (!result.success) return null;

  const questions = result.data.questions;
  if (questions.length === 0) return null;

  // Verify that every question references strictly valid requirement IDs
  for (const q of questions) {
    if (!q.requirement_ids || q.requirement_ids.length === 0) return null;
    for (const reqId of q.requirement_ids) {
      if (!validRequirementIds.has(reqId.trim())) {
        return null;
      }
    }
  }

  return questions;
}

/** Normalize, assign deterministic IDs, and enforce canonical contract. */
function finalize(
  drafts: DraftQuestion[],
  validRequirementIds: Set<string>,
): InterviewQuestion[] {
  const questions = normalizeQuestions(drafts, validRequirementIds);

  if (questions.length === 0) {
    throw new AppError(
      'INVALID_LLM_OUTPUT',
      'The language model returned an invalid question structure.',
    );
  }

  for (const question of questions) {
    const result = InterviewQuestionSchema.safeParse(question);
    if (!result.success) {
      throw new AppError(
        'INVALID_LLM_OUTPUT',
        'The language model returned an invalid question structure.',
      );
    }

    // Referential integrity guard: question.requirement_ids ⊆ supplied requirement IDs
    for (const reqId of question.requirement_ids) {
      if (!validRequirementIds.has(reqId)) {
        throw new AppError(
          'INVALID_LLM_OUTPUT',
          'Generated question references an unknown requirement ID.',
        );
      }
    }
  }

  return questions;
}
