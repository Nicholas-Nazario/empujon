import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, place, chooseUpgrade } from '../src/game.ts';
import { transitionSounds } from '../src/ui/sound.ts';

test('placement and actual pushes have distinct cues', () => {
  const game = createGame('classic');
  const first = place(game, 14);
  assert.deepEqual(transitionSounds(game, first, null), ['place']);
  assert.deepEqual(transitionSounds(first, place(first, 15), null), ['place', 'push']);
  assert.deepEqual(transitionSounds(first, place(first, 14), null), []);
});

test('blocked and stronger neighbors do not produce push cues', () => {
  const game = createGame('upgrade');
  game.board[14] = { owner: 1, upgraded: true };
  assert.deepEqual(transitionSounds(game, place(game, 15), null), ['place']);
  game.board[14]!.upgraded = false;
  game.board[13] = { owner: 1, upgraded: false };
  assert.deepEqual(transitionSounds(game, place(game, 15), null), ['place']);
});

test('off-board pushes add a distinct return cue', () => {
  const game = createGame('classic');
  game.board[0] = { owner: 1, upgraded: false };
  assert.deepEqual(transitionSounds(game, place(game, 1), null), ['place', 'push', 'return']);
});

test('automatic and chosen upgrades produce a chime', () => {
  const game = createGame('upgrade');
  for (const index of [0, 1, 2]) game.board[index] = { owner: 0, upgraded: false };
  const next = place(game, 35);
  assert.deepEqual(transitionSounds(game, next, null), ['place', 'upgrade']);
  game.choices = [{ owner: 0, kind: 'line', options: [[0, 1, 2]] }];
  assert.deepEqual(transitionSounds(game, chooseUpgrade(game, 0), null), ['upgrade']);
});

test('outcomes respect the listener and stay silent on repeated snapshots', () => {
  const game = createGame('classic');
  for (const index of [0, 1, 2]) game.board[index] = { owner: 0, upgraded: false };
  const next = place(game, 35);
  assert.deepEqual(transitionSounds(game, next, 0), ['place', 'win']);
  assert.deepEqual(transitionSounds(game, next, 1), ['place', 'lose']);
  assert.deepEqual(transitionSounds(game, next, null), ['place', 'win']);
  assert.deepEqual(transitionSounds(next, structuredClone(next), 0), []);
});

test('base and upgraded placements have different cues, including automatic returns', () => {
  const game = createGame('upgrade');
  game.pools[0][0].upgraded = true;
  assert.deepEqual(transitionSounds(game, place(game, 14, false), null), ['place']);
  assert.deepEqual(transitionSounds(game, place(game, 14, true), null), ['place-upgraded']);
  // A mixed line returns the upgraded placement to supply immediately.
  game.board[0] = { owner: 0, upgraded: false };
  game.board[1] = { owner: 0, upgraded: false };
  const next = place(game, 2, true);
  assert.equal(next.board[2], null);
  assert.deepEqual(transitionSounds(game, next, null), ['place-upgraded', 'upgrade']);
});

test('simultaneous exits produce one return cue and repeated snapshots stay silent', () => {
  const game = createGame('classic');
  game.board[0] = { owner: 0, upgraded: false };
  game.board[1] = { owner: 1, upgraded: false };
  game.board[14] = { owner: 1, upgraded: false };
  const after = place(game, 7);
  assert.deepEqual(transitionSounds(game, after, null), ['place', 'push', 'return']);
  assert.deepEqual(transitionSounds(after, structuredClone(after), null), []);
});
