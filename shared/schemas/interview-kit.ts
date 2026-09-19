import { z } from 'zod';

/**
 * Canonical InterviewKit Zod schemas.
 *
 * These mirror ../types/interview-kit.ts exactly. Every runtime boundary
 * (HTTP request, LLM response, persisted document) must validate through
 * these schemas rather than through ad-hoc checks.
 *
 * TODO (later steps) — cross-entity referential rules deliberately NOT
 * enforced here, because they require the whole kit to exist:
 *   - question.requirement_ids / flashcard.requirement_ids must exist
 *     among role.requirements
 *   - schedule.days[].question_ids must exist among questions
 *   - every "must" requirement covered by at least one question
 *   - schedule.days.length must match schedule.days_available
 */

const nonEmptyString = z.string().trim().min(1);

export const InterviewKitSourceSchema = z.object({
  company: nonEmptyString,
  company_url: z.string().url(),
  jd_chars: z.number().int().nonnegative(),
  researched_at: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: 'researched_at must be a parseable date/time string',
    }),
});
export type InterviewKitSource = z.infer<typeof InterviewKitSourceSchema>;

export const CompanyBriefSchema = z.object({
  summary: nonEmptyString,
  products: z.array(z.string()),
  tech_signals: z.array(z.string()),
  notes: z.array(z.string()),
});
export type CompanyBrief = z.infer<typeof CompanyBriefSchema>;

export const RequirementKindSchema = z.enum([
  'technical',
  'behavioural',
  'domain',
]);
export type RequirementKind = z.infer<typeof RequirementKindSchema>;

export const RequirementPrioritySchema = z.enum(['must', 'nice']);
export type RequirementPriority = z.infer<typeof RequirementPrioritySchema>;

export const RequirementSchema = z.object({
  id: nonEmptyString,
  text: nonEmptyString,
  kind: RequirementKindSchema,
  priority: RequirementPrioritySchema,
});
export type Requirement = z.infer<typeof RequirementSchema>;

export const InterviewRoleSchema = z.object({
  title: nonEmptyString,
  seniority: nonEmptyString,
  requirements: z.array(RequirementSchema),
});
export type InterviewRole = z.infer<typeof InterviewRoleSchema>;

export const QuestionCategorySchema = z.enum([
  'technical',
  'behavioural',
  'system-design',
  'company-fit',
]);
export type QuestionCategory = z.infer<typeof QuestionCategorySchema>;

export const QuestionDifficultySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);
export type QuestionDifficulty = z.infer<typeof QuestionDifficultySchema>;

export const InterviewQuestionSchema = z.object({
  id: nonEmptyString,
  prompt: nonEmptyString,
  category: QuestionCategorySchema,
  difficulty: QuestionDifficultySchema,
  requirement_ids: z.array(nonEmptyString).min(1),
  answer_outline: nonEmptyString,
});
export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>;

export const InterviewFlashcardSchema = z.object({
  id: nonEmptyString,
  front: nonEmptyString,
  back: nonEmptyString,
  requirement_ids: z.array(z.string()),
});
export type InterviewFlashcard = z.infer<typeof InterviewFlashcardSchema>;

export const InterviewScheduleDaySchema = z.object({
  day: z.number().int(),
  minutes: z.number().int(),
  question_ids: z.array(z.string()),
  focus: z.string(),
});
export type InterviewScheduleDay = z.infer<typeof InterviewScheduleDaySchema>;

export const InterviewScheduleSchema = z.object({
  days_available: z.number().int(),
  days: z.array(InterviewScheduleDaySchema),
});
export type InterviewSchedule = z.infer<typeof InterviewScheduleSchema>;

export const InterviewCoverageSchema = z.object({
  passes: z.number().int().nonnegative(),
  uncovered_requirement_ids: z.array(z.string()),
  notes: z.array(z.string()),
});
export type InterviewCoverage = z.infer<typeof InterviewCoverageSchema>;

export const InterviewKitSchema = z.object({
  source: InterviewKitSourceSchema,
  company: CompanyBriefSchema,
  role: InterviewRoleSchema,
  questions: z.array(InterviewQuestionSchema),
  flashcards: z.array(InterviewFlashcardSchema),
  schedule: InterviewScheduleSchema,
  coverage: InterviewCoverageSchema,
});
export type InterviewKit = z.infer<typeof InterviewKitSchema>;
