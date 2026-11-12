import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beginnerAction } from '../src/ai.ts';
import { actingPlayer } from '../src/actions.ts';
import { Sessions, SESSION_LIFETIME } from '../server/sessions.ts';

test('invite assigns opposite seats, reconnects, and enforces turns and revisions', () => {
  const sessions = new Sessions();
  const host = sessions.create('classic', 60);
  assert.match(host.code, /^[A-Z0-9]{6}$/);
  assert.throws(() => sessions.move(host.code, host.token!, 0, { type: 'place', index: 0 }), /Waiting/);
  const friend = sessions.join(host.code.toLowerCase());
  assert.equal(friend.player, 1 - host.player);
  assert.equal(sessions.join(host.code, host.token!).player, host.player);
  assert.throws(() => sessions.join(host.code), /already taken/);
  const [first, second] = host.player === 0 ? [host, friend] : [friend, host];
  assert.throws(() => sessions.move(host.code, second.token!, 1, { type: 'place', index: 0 }), /not your turn/);
  const next = sessions.move(host.code, first.token!, 1, { type: 'place', index: 0 });
  assert.equal(next.game.moves, 1);
  assert.throws(() => sessions.move(host.code, second.token!, 1, { type: 'place', index: 35 }), /board changed/);
  assert.equal(sessions.move(host.code, second.token!, 2, { type: 'place', index: 35 }).game.moves, 2);
  sessions.db.close();
});

test('turn clocks start on join, timeout forfeits, and expiry deletes sessions', () => {
  let now = 1000;
  const sessions = new Sessions(() => now);
  const host = sessions.create('upgrade', 30);
  now += 60000;
  assert.equal(sessions.get(host.code).deadline, null);
  const friend = sessions.join(host.code);
  now += 30000;
  assert.equal(sessions.get(host.code).game.winner, 1);
  assert.throws(() => sessions.move(host.code, friend.token!, 2, { type: 'place', index: 0 }), /not your turn/);
  let expired = false;
  sessions.get(host.code).listeners.add(() => { expired = true; });
  now = 1000 + SESSION_LIFETIME;
  sessions.sweep();
  assert.equal(expired, true);
  assert.equal(sessions.games.size, 0);
  assert.equal(sessions.db.prepare('SELECT count(*) AS count FROM sessions').get()!.count, 0);
  assert.throws(() => sessions.get(host.code), /expired/);
  sessions.db.close();
});

test('SQLite restores seats, board, deadline, and original expiry after restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'empujon-test-'));
  try {
    const path = join(dir, 'games.sqlite');
    const sessions = new Sessions(() => 1000, path);
    const host = sessions.create('classic', 60);
    const friend = sessions.join(host.code);
    const first = host.player === 0 ? host : friend;
    sessions.move(host.code, first.token!, 1, { type: 'place', index: 0 });
    sessions.db.close();
    const restored = new Sessions(() => 2000, path);
    const seat = restored.join(host.code, host.token!);
    assert.equal(seat.player, host.player);
    assert.equal(seat.game.moves, 1);
    assert.equal(seat.deadline, 61000);
    assert.equal(seat.expiresAt, host.expiresAt);
    restored.db.close();
  } finally { rmSync(dir, { recursive: true }); }
});

test('completed online games retain every position through reconnect and restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'empujon-review-'));
  try {
    const path = join(dir, 'games.sqlite');
    const sessions = new Sessions(() => 1000, path);
    const host = sessions.create('upgrade', 0);
    const friend = sessions.join(host.code);
    const tokens = host.player === 0 ? [host.token!, friend.token!] : [friend.token!, host.token!];
    let state = sessions.view(sessions.get(host.code));
    const expected = [structuredClone(state.game)];
    let seed = 1;
    const random = Math.random;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
    let choices = 0;
    try {
      while (state.game.winner === null && expected.length < 200) {
        assert.equal(state.history, undefined, 'Do not resend the timeline during play');
        const action = beginnerAction(state.game)!;
        if (action.type === 'choose') choices++;
        state = sessions.move(host.code, tokens[actingPlayer(state.game)!], state.revision, action);
        expected.push(structuredClone(state.game));
      }
    } finally { Math.random = random; }
    assert.notEqual(state.game.winner, null);
    assert.ok(choices > 0);
    assert.deepEqual(state.history, expected);
    sessions.db.close();
    const restored = new Sessions(() => 2000, path);
    assert.deepEqual(restored.join(host.code, host.token!).history, expected);
    assert.throws(() => restored.move(host.code, host.token!, state.revision, { type: 'place', index: 0 }));
    assert.deepEqual(restored.view(restored.get(host.code)).history, expected);
    restored.db.close();
  } finally { rmSync(dir, { recursive: true }); }
});

test('timeout adds a final result position without changing previous boards', () => {
  let now = 1000;
  const sessions = new Sessions(() => now);
  const host = sessions.create('classic', 30);
  const friend = sessions.join(host.code);
  const first = host.player === 0 ? host : friend;
  const state = sessions.move(host.code, first.token!, 1, { type: 'place', index: 0 });
  now += 30000;
  const ended = sessions.view(sessions.get(host.code));
  assert.equal(ended.history!.length, 3);
  assert.deepEqual(ended.history![1], state.game);
  assert.equal(ended.history![1].winner, null);
  assert.equal(ended.history![2].reason, 'timeout');
  assert.deepEqual(ended.history![1].board, ended.game.board);
  sessions.db.close();
});
