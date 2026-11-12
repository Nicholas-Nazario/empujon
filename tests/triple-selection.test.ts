import test from 'node:test';
import assert from 'node:assert/strict';
import type { Choice } from '../src/game.ts';
import { tripleSelectionAt } from '../src/ui/triple-selection.ts';

const choice: Choice = { owner: 0, kind: 'line', options: [[14, 21, 28], [21, 28, 35]] };

test('end pieces select their complete triple and shared pieces cycle through options', () => {
  assert.equal(tripleSelectionAt(choice, 14), 0);
  assert.equal(tripleSelectionAt(choice, 35), 1);
  assert.equal(tripleSelectionAt(choice, 21), 0);
  assert.equal(tripleSelectionAt(choice, 21, 0), 1);
  assert.equal(tripleSelectionAt(choice, 21, 1), 0);
  assert.equal(tripleSelectionAt(choice, 28, 0), 1);
});

test('shared pieces cycle only through intersecting formations without changing engine choices', () => {
  const crossing: Choice = { owner: 1, kind: 'line', options: [[0, 1, 2], [0, 6, 12], [6, 7, 8]] };
  const original = structuredClone(crossing);
  assert.equal(tripleSelectionAt(crossing, 0, 0), 1);
  assert.equal(tripleSelectionAt(crossing, 0, 1), 0);
  assert.equal(tripleSelectionAt(crossing, 6, 1), 2);
  assert.equal(tripleSelectionAt(crossing, 6, 2), 1);
  assert.deepEqual(crossing, original);
});

test('unrelated squares and non-triple choices do not select an upgrade', () => {
  assert.equal(tripleSelectionAt(choice, 0), null);
  assert.equal(tripleSelectionAt(undefined, 14), null);
  assert.equal(tripleSelectionAt({ owner: 0, kind: 'eight', options: [[14], [21]] }, 14), null);
});
