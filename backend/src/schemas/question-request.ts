import { z } from 'zod';
import { RequirementSchema, type Requirement } from '@interview-prep-ai/shared';

export const GenerateQuestionsRequestSchema = z.object({
  requirements: z.array(RequirementSchema, {
    required_error: 'A "requirements" array is required.',
    invalid_type_error: 'The "requirements" field must be an array.',
  }),
});

export type GenerateQuestionsRequest = {
  requirements: Requirement[];
};
