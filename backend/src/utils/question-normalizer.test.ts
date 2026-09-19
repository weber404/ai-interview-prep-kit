import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  duplicateQuestionKey,
  formatQuestionId,
  normalizeQuestions,
  normalizeText,
  type DraftQuestion,
} from './question-normalizer.js';

test('normalizeText collapses whitespace and trims', () => {
  assert.equal(
    normalizeText('   How   do   you\n\n  test React?  '),
    'How do you test React?',
  );
});

test('duplicateQuestionKey collapses case and trailing punctuation', () => {
  assert.equal(
    duplicateQuestionKey('How do you test React?'),
    'how do you test react',
  );
  assert.equal(
    duplicateQuestionKey('  How do you test React...  '),
    'how do you test react',
  );
});

test('formatQuestionId zero-pads to three digits', () => {
  assert.equal(formatQuestionId(0), 'q-001');
  assert.equal(formatQuestionId(9), 'q-010');
  assert.equal(formatQuestionId(99), 'q-100');
});

test('normalizeQuestions drops empty prompts and empty answer outlines', () => {
  const validIds = new Set(['req-001', 'req-002']);
  const drafts: DraftQuestion[] = [
    {
      prompt: '   ',
      answer_outline: 'Some outline',
      category: 'technical',
      difficulty: 2,
      requirement_ids: ['req-001'],
    },
    {
      prompt: 'Valid prompt',
      answer_outline: '   ',
      category: 'technical',
      difficulty: 2,
      requirement_ids: ['req-001'],
    },
    {
      prompt: 'Valid prompt',
      answer_outline: 'Valid outline',
      category: 'technical',
      difficulty: 2,
      requirement_ids: ['req-001'],
    },
  ];

  const result = normalizeQuestions(drafts, validIds);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, 'q-001');
  assert.equal(result[0]!.prompt, 'Valid prompt');
});

test('normalizeQuestions filters unknown requirement IDs and drops questions without valid IDs', () => {
  const validIds = new Set(['req-001']);
  const drafts: DraftQuestion[] = [
    {
      prompt: 'Question referencing unknown ID only',
      answer_outline: 'Outline',
      category: 'technical',
      difficulty: 2,
      requirement_ids: ['req-999'],
    },
    {
      prompt: 'Question referencing both valid and invalid IDs',
      answer_outline: 'Outline',
      category: 'technical',
      difficulty: 2,
      requirement_ids: ['req-001', 'req-888', 'req-001'],
    },
  ];

  const result = normalizeQuestions(drafts, validIds);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.id, 'q-001');
  assert.deepEqual(result[0]!.requirement_ids, ['req-001']);
});

test('normalizeQuestions deduplicates by prompt and merges requirement IDs', () => {
  const validIds = new Set(['req-001', 'req-002', 'req-003']);
  const drafts: DraftQuestion[] = [
    {
      prompt: 'Explain React hooks lifecycle.',
      answer_outline: 'First outline',
      category: 'technical',
      difficulty: 2,
      requirement_ids: ['req-001'],
    },
    {
      prompt: 'explain react hooks lifecycle?',
      answer_outline: 'Second outline',
      category: 'technical',
      difficulty: 2,
      requirement_ids: ['req-002'],
    },
    {
      prompt: 'Describe Redux data flow.',
      answer_outline: 'Redux outline',
      category: 'technical',
      difficulty: 2,
      requirement_ids: ['req-003'],
    },
  ];

  const result = normalizeQuestions(drafts, validIds);
  assert.equal(result.length, 2);
  assert.equal(result[0]!.id, 'q-001');
  assert.equal(result[0]!.prompt, 'Explain React hooks lifecycle.');
  assert.deepEqual(result[0]!.requirement_ids, ['req-001', 'req-002']);
  assert.equal(result[1]!.id, 'q-002');
  assert.equal(result[1]!.prompt, 'Describe Redux data flow.');
});

test('IDs are assigned sequentially and are deterministic', () => {
  const validIds = new Set(['req-001', 'req-002']);
  const drafts: DraftQuestion[] = [
    {
      prompt: 'Question 1',
      answer_outline: 'Outline 1',
      category: 'technical',
      difficulty: 1,
      requirement_ids: ['req-001'],
    },
    {
      prompt: 'Question 2',
      answer_outline: 'Outline 2',
      category: 'behavioural',
      difficulty: 2,
      requirement_ids: ['req-002'],
    },
  ];

  const first = normalizeQuestions(drafts, validIds);
  const second = normalizeQuestions(drafts, validIds);

  assert.deepEqual(
    first.map((q) => q.id),
    ['q-001', 'q-002'],
  );
  assert.deepEqual(first, second);
});
