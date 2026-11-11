import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, place, previewMovement, chooseUpgrade, type Game } from '../src/game.ts';
import { renderMovement } from '../src/ui/components/movement.ts';

function position(mode: Game['mode'], entries: [number, boolean][]): Game {
  const game = createGame(mode);
  for (const [index, upgraded] of entries) {
    game.board[index] = { owner: 1, upgraded };
    game.pools[1].pop();
  }
  return game;
}

test('preview matches actual pushes in all eight directions without mutating the position', () => {
  const game = position('classic', [7,8,9,13,15,19,20,21].map(i => [i, false]));
  const before = structuredClone(game);
  const movement = previewMovement(game, 14)!;
  assert.equal(movement.pushes.length, 8);
  assert.deepEqual(game, before);
  const next = place(game, 14);
  assert.deepEqual(next.lastMovement, movement);
  assert.match(renderMovement(next.lastMovement!, false).description, /Last move: Terracotta placed at C3/);
  for (const { from, to } of movement.pushes) {
    assert.equal(next.board[from], null);
    assert.deepEqual(next.board[to!], game.board[from]);
  }
});

test('preview excludes blocked and stronger pieces and marks off-board returns', () => {
  const game = position('upgrade', [[0, false], [2, true], [8, false], [14, false], [21, false]]);
  const movement = previewMovement(game, 7, false)!;
  assert.deepEqual(movement.pushes.map(({ from, to }) => [from, to]), [[0, null], [8, 9]]);
  assert.equal(previewMovement(game, 0), null);
  assert.equal(previewMovement(game, -1), null);
  assert.equal(previewMovement(game, 7, true), null);
  game.pools[0][0].upgraded = true;
  assert.ok(previewMovement(game, 7, true)!.pushes.some(push => push.from === 2 && push.to === null));
  const rendered = renderMovement(movement, true);
  assert.match(rendered.description, /A1 → off board \(returns to supply\)/);
  assert.match(rendered.description, /C2 → D2/);
  assert.match(rendered.svg, /push-off/);
  assert.match(rendered.svg, /push-destination/);
});

test('last movement survives upgrade resolution and rejects previews during choices or after a win', () => {
  const game = position('upgrade', [[0, false], [1, false], [2, false], [3, false]]);
  const next = place(game, 35);
  assert.ok(next.choices.length);
  assert.equal(previewMovement(next, 34), null);
  const resolved = chooseUpgrade(next, 0);
  assert.deepEqual(resolved.lastMovement, next.lastMovement);
  game.winner = 0;
  assert.equal(previewMovement(game, 35), null);
});
