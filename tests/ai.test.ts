import test from 'node:test';
import assert from 'node:assert/strict';
import { beginnerAction } from '../src/ai.ts';
import { applyAction, legalActions } from '../src/actions.ts';
import { createGame } from '../src/game.ts';

test('Beginner varies among useful opening moves without changing the input', () => {
  const game = createGame('classic');
  const original = structuredClone(game);
  const first = beginnerAction(game, () => 0);
  const last = beginnerAction(game, () => 0.999);
  assert.ok(first && last);
  assert.notDeepEqual(first, last);
  for (const action of [first, last]) assert.ok(legalActions(game).some(legal => JSON.stringify(legal) === JSON.stringify(action)));
  assert.deepEqual(game, original);
});

test('Beginner takes a winning push rather than just completing a pre-push line', () => {
  const game = createGame('classic');
  // Placing at C3 pushes C2 to C1, completing A1-B1-C1.
  for (const index of [0, 1, 8]) {
    game.board[index] = game.pools[0].pop()!;
  }
  for (const sample of [0, 0.5, 0.999]) {
    const action = beginnerAction(game, () => sample);
    assert.ok(action);
    assert.equal(applyAction(game, action).winner, 0);
  }
});

test('Beginner stops at terminal states', () => {
  const game = createGame('classic');
  game.winner = 1;
  assert.equal(beginnerAction(game), null);

});

test('Beginner can play either color through complete legal Classic games', () => {
  let seed = 17;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  for (let run = 0; run < 10; run++) {
    let game = createGame('classic');
    for (let move = 0; move < 300 && game.winner === null; move++) {
      const action = beginnerAction(game, random);
      assert.ok(action);
      assert.ok(legalActions(game).some(legal => JSON.stringify(legal) === JSON.stringify(action)));
      game = applyAction(game, action);
      for (const owner of [0, 1]) {
        assert.equal(game.pools[owner].length + game.board.filter(p => p?.owner === owner).length, 8);
      }
    }
    assert.notEqual(game.winner, null);
  }
});


test('Upgrade Beginner can win with an upgraded push and considers both piece types', () => {
  const game = createGame('upgrade');
  for (const index of [0, 1, 8]) {
    game.board[index] = { ...game.pools[0].pop()!, upgraded: true };
  }
  game.pools[0][0].upgraded = true;
  const original = structuredClone(game);
  for (const sample of [0, 0.5, 0.999]) {
    const action = beginnerAction(game, () => sample);
    assert.ok(action);
    assert.equal(action.type, 'place');
    assert.equal(applyAction(game, action).winner, 0);
  }
  assert.deepEqual(game, original);
});

test('Beginner resolves upgrade choices owned by the other player', () => {
  for (const kind of ['line', 'eight'] as const) {
    const game = createGame('upgrade');
    const options = kind === 'line' ? [[0, 1, 2], [0, 6, 12]] : [[0], [6]];
    for (const index of new Set(options.flat())) game.board[index] = game.pools[1].pop()!;
    game.choices = [{ owner: 1, kind, options }];
    assert.equal(game.turn, 0);
    const original = structuredClone(game);
    for (const sample of [0, 0.999]) {
      const action = beginnerAction(game, () => sample);
      assert.ok(action && action.type === 'choose');
      const next = applyAction(game, action);
      assert.equal(next.choices.length, 0);
      assert.ok(next.pools[1].some(piece => piece.upgraded));
    }
    assert.deepEqual(game, original);
  }
});

test('Beginner self-play handles Upgrade placements and rewards legally', () => {
  let seed = 37;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  let upgradedPlacements = 0;
  for (let run = 0; run < 5; run++) {
    let game = createGame('upgrade');
    for (let step = 0; step < 1000 && game.winner === null; step++) {
      const action = beginnerAction(game, random);
      assert.ok(action);
      assert.ok(legalActions(game).some(legal => JSON.stringify(legal) === JSON.stringify(action)));
      if (action.type === 'place' && action.upgraded) upgradedPlacements++;
      game = applyAction(game, action);
      for (const owner of [0, 1]) {
        assert.equal(game.pools[owner].length + game.board.filter(p => p?.owner === owner).length, 8);
      }
    }
    assert.notEqual(game.winner, null);
  }
  assert.ok(upgradedPlacements > 0);
});


test('Beginner builds its board presence instead of returning its own edge piece', () => {
  for (const mode of ['classic', 'upgrade'] as const) {
    const game = createGame(mode);
    game.board[0] = game.pools[0].pop()!;
    for (const sample of [0, 0.25, 0.5, 0.999]) {
      const action = beginnerAction(game, () => sample);
      assert.ok(action);
      const next = applyAction(game, action);
      assert.equal(next.board.filter(piece => piece?.owner === 0).length, 2);
    }
  }
});

test('Beginner earns upgrades instead of wandering away from an available reward', () => {
  const game = createGame('upgrade');
  for (const index of [0, 1, 8]) game.board[index] = game.pools[0].pop()!;
  for (const sample of [0, 0.5, 0.999]) {
    const action = beginnerAction(game, () => sample);
    assert.ok(action);
    const next = applyAction(game, action);
    const upgraded = [...next.board, ...next.pools[0]].filter(piece => piece?.owner === 0 && piece.upgraded).length;
    assert.equal(upgraded, 3);
  }
});

test('Beginner avoids a push that immediately awards the opponent a win', () => {
  const game = createGame('classic');
  for (const index of [0, 1, 8]) game.board[index] = game.pools[1].pop()!;
  assert.equal(applyAction(game, { type: 'place', index: 14, upgraded: false }).winner, 1);
  for (const sample of [0, 0.5, 0.999]) {
    const action = beginnerAction(game, () => sample);
    assert.ok(action);
    assert.notEqual(applyAction(game, action).winner, 1);
  }
});

test('Beginner chooses the reward that upgrades more base pieces', () => {
  const game = createGame('upgrade');
  for (const index of [0, 1, 2, 6, 12]) {
    game.board[index] = { ...game.pools[1].pop()!, upgraded: index === 6 || index === 12 };
  }
  game.choices = [{ owner: 1, kind: 'line', options: [[0, 1, 2], [0, 6, 12]] }];
  for (const sample of [0, 0.5, 0.999]) {
    const action = beginnerAction(game, () => sample);
    assert.deepEqual(action, { type: 'choose', option: 0 });
    const next = applyAction(game, action);
    assert.equal(next.pools[1].filter(piece => piece.upgraded).length, 3);
    assert.equal(next.board.filter(piece => piece?.owner === 1 && piece.upgraded).length, 2);
  }
});
