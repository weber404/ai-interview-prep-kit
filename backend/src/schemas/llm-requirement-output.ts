import { z } from 'zod';
import {
  RequirementKindSchema,
  RequirementPrioritySchema,
} from '@interview-prep-ai/shared';

/**
 * Shape of the raw model payload for requirement extraction.
 *
 * This is NOT a second Requirement contract. It is the pre-normalization
 * wire format: the same enums as the canonical RequirementSchema, minus the
 * `id`, because application-generated IDs replace whatever the model invents.
 * Any `id` the model sends is accepted and then discarded.
 */
export const LlmRequirementSchema = z
  .object({
    id: z.unknown().optional(),
    text: z.string(),
    kind: RequirementKindSchema,
    priority: RequirementPrioritySchema,
  })
  .transform(({ text, kind, priority }) => ({ text, kind, priority }));

export const LlmRequirementOutputSchema = z.object({
  requirements: z.array(LlmRequirementSchema),
});

export type LlmRequirementOutput = z.infer<typeof LlmRequirementOutputSchema>;
