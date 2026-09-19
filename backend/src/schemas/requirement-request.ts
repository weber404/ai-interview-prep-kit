import { z } from 'zod';

/** Generous enough for real job descriptions, bounded enough to be safe. */
export const MAX_JD_CHARS = 20_000;

export const ExtractRequirementsRequestSchema = z.object({
  jd: z.string({
    required_error: 'A "jd" field containing the job description is required.',
    invalid_type_error: 'The "jd" field must be a string.',
  }),
});

export type ExtractRequirementsRequest = z.infer<
  typeof ExtractRequirementsRequestSchema
>;
