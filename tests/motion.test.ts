import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, place } from '../src/game.ts';
import { movementStage } from '../src/ui/motion.ts';

test('contact stage preserves pushed pieces until the slide finishes, including edge exits', () => {
  const before = createGame('classic');
  before.board[0] = { owner: 1, upgraded: false };
  before.board[14] = { owner: 0, upgraded: false };
  const after = place(before, 7);
  const stage = movementStage(before, after)!;
  assert.deepEqual(stage.board[0], before.board[0]);
  assert.deepEqual(stage.board[14], before.board[14]);
  assert.equal(stage.board[21], null);
  assert.deepEqual(stage.board[7], after.board[7]);
  assert.equal(after.board[0], null);
  assert.deepEqual(after.board[21], before.board[14]);
  assert.equal(before.board[7], null);
  assert.equal(movementStage(after, before), null);
  assert.equal(movementStage(after, structuredClone(after)), null);
});

test('automatic upgrade triple includes the placed piece before returning to supply', () => {
  const before = createGame('upgrade');
  before.board[0] = { owner: 0, upgraded: false };
  before.board[1] = { owner: 0, upgraded: false };
  const after = place(before, 2);
  assert.equal(after.board[2], null);
  assert.equal(after.upgradeReturns?.flat().length, 3);
  const stage = movementStage(before, after)!;
  assert.deepEqual(stage.board.slice(0, 3), Array.from({ length: 3 }, () => ({ owner: 0, upgraded: false })));
  assert.deepEqual(stage.upgradeReturns, []);
  assert.equal(stage.winner, null);
});
