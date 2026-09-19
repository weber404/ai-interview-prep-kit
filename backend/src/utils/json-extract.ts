/**
 * Extract a JSON object from raw model text.
 *
 * Models frequently wrap JSON in markdown fences or surround it with prose.
 * This helper strips fences and, failing that, scans for the first balanced
 * top-level object. It never evaluates the input.
 *
 * Returns `null` when no parseable object can be found; callers convert that
 * into a structured INVALID_LLM_OUTPUT error.
 */
export function extractJsonObject(raw: string): unknown | null {
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const candidates: string[] = [];

  // 1. Whole string, as-is.
  candidates.push(trimmed);

  // 2. Contents of a fenced block (```json ... ``` or ``` ... ```).
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fence?.[1]) candidates.push(fence[1].trim());

  // 3. First balanced {...} span anywhere in the text.
  const balanced = firstBalancedObject(trimmed);
  if (balanced) candidates.push(balanced);

  for (const candidate of candidates) {
    const parsed = tryParse(candidate);
    if (parsed !== undefined) return parsed;
  }
  return null;
}

function tryParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Scan for the first top-level `{...}` span, ignoring braces that appear
 * inside string literals.
 */
function firstBalancedObject(text: string): string | null {
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
      if (depth < 0) return null;
    }
  }
  return null;
}
