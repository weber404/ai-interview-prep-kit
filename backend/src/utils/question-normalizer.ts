import type {
  InterviewQuestion,
  QuestionCategory,
  QuestionDifficulty,
} from '@interview-prep-ai/shared';

export interface DraftQuestion {
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: QuestionDifficulty;
}

/** Collapse whitespace and trim. */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Key for exact-duplicate detection.
 * Case, internal extra whitespace, and trailing punctuation are normalized.
 */
export function duplicateQuestionKey(prompt: string): string {
  return normalizeText(prompt)
    .toLowerCase()
    .replace(/[.?!;:]+$/, '');
}

/** Zero-padded index-based ID: q-001, q-002, ... */
export function formatQuestionId(index: number): string {
  return `q-${String(index + 1).padStart(3, '0')}`;
}

/**
 * Normalizes draft questions:
 * - Trims whitespace on prompt and answer_outline
 * - Rejects empty prompts or empty answer outlines
 * - Discards requirement IDs not present in validRequirementIds
 * - Rejects questions with no remaining valid requirement IDs
 * - Deduplicates questions based on prompt (first occurrence wins, merges requirement IDs)
 * - Assigns stable, deterministic IDs (q-001, q-002, ...)
 */
export function normalizeQuestions(
  drafts: DraftQuestion[],
  validRequirementIds: Set<string>,
): InterviewQuestion[] {
  const kept: DraftQuestion[] = [];
  const indexByKey = new Map<string, number>();

  for (const draft of drafts) {
    const prompt = normalizeText(draft.prompt ?? '');
    const answerOutline = normalizeText(draft.answer_outline ?? '');

    if (prompt.length === 0 || answerOutline.length === 0) {
      continue;
    }

    // Filter requirement IDs: keep only unique IDs that exist in the supplied set
    const validIds: string[] = [];
    const seenIds = new Set<string>();

    for (const id of draft.requirement_ids ?? []) {
      const trimmedId = id.trim();
      if (validRequirementIds.has(trimmedId) && !seenIds.has(trimmedId)) {
        seenIds.add(trimmedId);
        validIds.push(trimmedId);
      }
    }

    // Must have at least one valid requirement ID
    if (validIds.length === 0) {
      continue;
    }

    const key = duplicateQuestionKey(prompt);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      indexByKey.set(key, kept.length);
      kept.push({
        prompt,
        answer_outline: answerOutline,
        category: draft.category,
        difficulty: draft.difficulty,
        requirement_ids: validIds,
      });
    } else {
      // Merge unique requirement IDs into the surviving question
      const existing = kept[existingIndex]!;
      const mergedSet = new Set(existing.requirement_ids);
      for (const id of validIds) {
        if (!mergedSet.has(id)) {
          mergedSet.add(id);
          existing.requirement_ids.push(id);
        }
      }
    }
  }

  return kept.map((draft, index) => ({
    id: formatQuestionId(index),
    prompt: draft.prompt,
    category: draft.category,
    difficulty: draft.difficulty,
    requirement_ids: draft.requirement_ids,
    answer_outline: draft.answer_outline,
  }));
}
