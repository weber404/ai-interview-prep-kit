import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatRequirementId,
  normalizeRequirements,
  normalizeText,
} from './requirement-normalizer.js';

test('normalizeText collapses whitespace and trims', () => {
  assert.equal(normalizeText('  React   and\n\tTypeScript '), 'React and TypeScript');
});

test('formatRequirementId zero-pads to three digits', () => {
  assert.equal(formatRequirementId(0), 'req-001');
  assert.equal(formatRequirementId(9), 'req-010');
  assert.equal(formatRequirementId(123), 'req-124');
});

test('IDs are assigned in surviving order and are stable', () => {
  const drafts = [
    { text: 'React', kind: 'technical' as const, priority: 'must' as const },
    { text: 'TypeScript', kind: 'technical' as const, priority: 'must' as const },
    { text: 'Redux', kind: 'technical' as const, priority: 'nice' as const },
  ];

  const a = normalizeRequirements(drafts);
  const b = normalizeRequirements(drafts);

  assert.deepEqual(a.map((r) => r.id), ['req-001', 'req-002', 'req-003']);
  assert.deepEqual(a, b);
});

test('similar-but-distinct requirements are not merged', () => {
  const result = normalizeRequirements([
    { text: 'Experience with React', kind: 'technical', priority: 'must' },
    { text: 'Experience with React Native', kind: 'technical', priority: 'must' },
  ]);

  assert.equal(result.length, 2);
});

test('a must duplicate upgrades an earlier nice entry', () => {
  const result = normalizeRequirements([
    { text: 'TypeScript', kind: 'technical', priority: 'nice' },
    { text: 'typescript', kind: 'technical', priority: 'must' },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0]!.priority, 'must');
});

test('empty and whitespace-only requirements are dropped', () => {
  const result = normalizeRequirements([
    { text: '', kind: 'technical', priority: 'must' },
    { text: '   ', kind: 'technical', priority: 'must' },
    { text: 'React', kind: 'technical', priority: 'must' },
  ]);

  assert.deepEqual(result, [
    { id: 'req-001', text: 'React', kind: 'technical', priority: 'must' },
  ]);
});
