import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractJsonObject } from './json-extract.js';

test('parses plain JSON', () => {
  assert.deepEqual(extractJsonObject('{"a":1}'), { a: 1 });
});

test('parses JSON inside markdown fences', () => {
  assert.deepEqual(extractJsonObject('```json\n{"a":1}\n```'), { a: 1 });
});

test('parses JSON surrounded by prose', () => {
  assert.deepEqual(
    extractJsonObject('Here you go:\n{"a":1}\nHope that helps!'),
    { a: 1 },
  );
});

test('ignores braces inside string literals', () => {
  assert.deepEqual(extractJsonObject('{"a":"} not the end {"}'), {
    a: '} not the end {',
  });
});

test('returns null for unparseable text', () => {
  assert.equal(extractJsonObject('no json here'), null);
  assert.equal(extractJsonObject(''), null);
  assert.equal(extractJsonObject('{ broken'), null);
});
