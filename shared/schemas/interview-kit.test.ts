import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validInterviewKit } from '../fixtures/valid-interview-kit.js';
import { InterviewKitSchema } from './interview-kit.js';

/** Deep clone helper so each test mutates an isolated copy. */
function clone(): any {
  return structuredClone(validInterviewKit);
}

test('valid kit passes validation', () => {
  const result = InterviewKitSchema.safeParse(validInterviewKit);
  assert.equal(result.success, true);
});

test('missing source.company is rejected', () => {
  const kit = clone();
  delete kit.source.company;
  assert.equal(InterviewKitSchema.safeParse(kit).success, false);
});

test('invalid requirement.kind is rejected', () => {
  const kit = clone();
  kit.role.requirements[0].kind = 'soft-skill';
  assert.equal(InterviewKitSchema.safeParse(kit).success, false);
});

test('invalid requirement.priority is rejected', () => {
  const kit = clone();
  kit.role.requirements[0].priority = 'optional';
  assert.equal(InterviewKitSchema.safeParse(kit).success, false);
});

test('invalid question.category is rejected', () => {
  const kit = clone();
  kit.questions[0].category = 'trivia';
  assert.equal(InterviewKitSchema.safeParse(kit).success, false);
});

test('question difficulty outside 1-3 is rejected', () => {
  const kit = clone();
  kit.questions[0].difficulty = 5;
  assert.equal(InterviewKitSchema.safeParse(kit).success, false);
});

test('negative source.jd_chars is rejected', () => {
  const kit = clone();
  kit.source.jd_chars = -1;
  assert.equal(InterviewKitSchema.safeParse(kit).success, false);
});

test('non-integer schedule minutes is rejected', () => {
  const kit = clone();
  kit.schedule.days[0].minutes = 42.5;
  assert.equal(InterviewKitSchema.safeParse(kit).success, false);
});

test('missing schedule.days is rejected', () => {
  const kit = clone();
  delete kit.schedule.days;
  assert.equal(InterviewKitSchema.safeParse(kit).success, false);
});

test('invalid company_url is rejected', () => {
  const kit = clone();
  kit.source.company_url = 'not-a-url';
  assert.equal(InterviewKitSchema.safeParse(kit).success, false);
});

test('negative coverage.passes is rejected', () => {
  const kit = clone();
  kit.coverage.passes = -2;
  assert.equal(InterviewKitSchema.safeParse(kit).success, false);
});
