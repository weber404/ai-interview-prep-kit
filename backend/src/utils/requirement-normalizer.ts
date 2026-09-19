import type {
  Requirement,
  RequirementKind,
  RequirementPriority,
} from '@interview-prep-ai/shared';

/** A requirement as it arrives from the model, before IDs are assigned. */
export interface DraftRequirement {
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
}

/**
 * Collapse whitespace and trim.
 *
 * Deliberately conservative: it cleans up formatting only. It does not
 * rewrite, shorten, or reinterpret the requirement text.
 */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Key used for exact-duplicate detection.
 *
 * Case and trailing punctuation are ignored, so "React experience" and
 * "react experience." collapse into one entry. Nothing fuzzier than that:
 * "Experience with React" and "Experience with React Native" are distinct
 * strings and must both survive.
 */
function duplicateKey(text: string): string {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[.;,]+$/, '');
}

/** Zero-padded, index-based id: req-001, req-002, ... */
export function formatRequirementId(index: number): string {
  return `req-${String(index + 1).padStart(3, '0')}`;
}

/**
 * Normalize, drop empties, remove exact duplicates, and assign deterministic
 * IDs based on the surviving order.
 *
 * Determinism: the same ordered input always yields the same IDs. No
 * randomness, no timestamps, no UUIDs.
 *
 * When duplicates collide, the first occurrence wins and keeps its position.
 * A `must` duplicate upgrades an earlier `nice` entry, since the JD stating a
 * requirement as mandatory anywhere makes it mandatory.
 */
export function normalizeRequirements(
  drafts: DraftRequirement[],
): Requirement[] {
  const kept: DraftRequirement[] = [];
  const indexByKey = new Map<string, number>();

  for (const draft of drafts) {
    const text = normalizeText(draft.text ?? '');
    if (text.length === 0) continue;

    const key = duplicateKey(text);
    const existingIndex = indexByKey.get(key);

    if (existingIndex === undefined) {
      indexByKey.set(key, kept.length);
      kept.push({ text, kind: draft.kind, priority: draft.priority });
      continue;
    }

    const existing = kept[existingIndex]!;
    if (existing.priority === 'nice' && draft.priority === 'must') {
      existing.priority = 'must';
    }
  }

  return kept.map((draft, index) => ({
    id: formatRequirementId(index),
    text: draft.text,
    kind: draft.kind,
    priority: draft.priority,
  }));
}
