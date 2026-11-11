import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
