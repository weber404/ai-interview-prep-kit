import { z } from 'zod';
import {
  QuestionCategorySchema,
  QuestionDifficultySchema,
} from '@interview-prep-ai/shared';

const nonEmptyString = z.string().trim().min(1);

/**
 * Shape of a single question as received from the language model.
 * Any model-generated `id` is discarded in favor of deterministic application IDs.
 */
export const LlmQuestionSchema = z
  .object({
    id: z.unknown().optional(),
    requirement_ids: z.array(nonEmptyString).min(1),
    category: QuestionCategorySchema,
    prompt: nonEmptyString,
    answer_outline: nonEmptyString,
    difficulty: QuestionDifficultySchema,
  })
  .transform(({ requirement_ids, category, prompt, answer_outline, difficulty }) => ({
    requirement_ids,
    category,
    prompt,
    answer_outline,
    difficulty,
  }));

export type LlmQuestion = z.infer<typeof LlmQuestionSchema>;

export const LlmQuestionOutputSchema = z.object({
  questions: z.array(LlmQuestionSchema),
});

export type LlmQuestionOutput = z.infer<typeof LlmQuestionOutputSchema>;
