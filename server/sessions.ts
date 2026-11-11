import { DatabaseSync } from 'node:sqlite';
import { randomInt, randomBytes } from 'node:crypto';
import { createGame, type Game, type Mode, type Player } from '../src/game.ts';
import { actingPlayer, applyAction } from '../src/actions.ts';

export const SESSION_LIFETIME = 2 * 60 * 60 * 1000;
type Session = {
  code: string; game: Game; host: Player; tokens: (string | null)[];
  joined: boolean; turnSeconds: number; deadline: number | null;
  expiresAt: number; revision: number; listeners: Set<() => void>;
};
export class Sessions {
  games = new Map<string, Session>();
  now: () => number;
  db: DatabaseSync;
  constructor(now = () => Date.now(), path = ':memory:') {
    this.now = now;
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS sessions (code TEXT PRIMARY KEY, data TEXT NOT NULL)');
    for (const row of this.db.prepare('SELECT data FROM sessions').all()) {
      const session = JSON.parse(String(row.data));
      session.listeners = new Set<() => void>();
      this.games.set(session.code, session);
    }
    this.sweep();
  }
  save(session: Session) {
    const { listeners, ...data } = session;
    this.db.prepare('INSERT OR REPLACE INTO sessions VALUES (?, ?)').run(session.code, JSON.stringify(data));
  }
  create(mode: Mode, turnSeconds: number) {
    if (!['classic', 'upgrade'].includes(mode) || ![0, 30, 60, 120, 300].includes(turnSeconds)) throw new Error('Choose valid rules and a turn limit.');
    this.sweep();
    if (this.games.size >= 1000) throw new Error('The server is full. Please try again later.');
    let code: string;
    do { code = Array.from({ length: 6 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[randomInt(36)]).join(''); } while (this.games.has(code));
    const host = randomInt(2) as Player;
    const session: Session = { code, game: createGame(mode), host, tokens: [null, null] as (string | null)[], joined: false, turnSeconds, deadline: null as number | null, expiresAt: this.now() + SESSION_LIFETIME, revision: 0, listeners: new Set<() => void>() };
    session.tokens[host] = randomBytes(18).toString('hex');
    this.games.set(code, session);
    this.save(session);
    return { ...this.view(session), token: session.tokens[host], player: host };
  }
  get(code: string) {
    const session = this.games.get(code.toUpperCase());
    if (!session || session.expiresAt <= this.now()) throw new Error('This game has expired or does not exist.');
    this.timeout(session);
    return session;
  }
  seat(session: Session, token: string) {
    const player = session.tokens.indexOf(token);
    if (!token || player < 0) throw new Error('This seat is unavailable. Open the invite link to join.');
    return player as Player;
  }
  join(code: string, token?: string) {
    const session = this.get(code);
    if (token && session.tokens.includes(token)) return { ...this.view(session), token, player: this.seat(session, token) };
    if (session.joined) throw new Error('Both seats are already taken.');
    const player = 1 - session.host;
    session.tokens[player] = randomBytes(18).toString('hex');
    session.joined = true;
    this.resetClock(session);
    this.publish(session);
    return { ...this.view(session), token: session.tokens[player], player };
  }
  move(code: string, token: string, revision: number, action: unknown) {
    const session = this.get(code);
    const player = this.seat(session, token);
    if (!session.joined) throw new Error('Waiting for your friend to join.');
    if (revision !== session.revision) throw new Error('The board changed. Please try your move again.');
    if (actingPlayer(session.game) !== player) throw new Error('It is not your turn.');
    const previous = actingPlayer(session.game);
    session.game = applyAction(session.game, action);
    if (actingPlayer(session.game) !== previous) this.resetClock(session);
    this.publish(session);
    return this.view(session);
  }
  resetClock(session: Session) {
    session.deadline = session.turnSeconds && session.game.winner === null ? this.now() + session.turnSeconds * 1000 : null;
  }
  timeout(session: Session) {
    if (session.deadline !== null && session.deadline <= this.now() && session.game.winner === null) {
      session.game = { ...session.game, winner: (1 - actingPlayer(session.game)!) as Player, reason: 'timeout', message: 'Turn time expired. The other player wins.', choices: [] };
      session.deadline = null;
      this.publish(session);
    }
  }
  view(session: Session) {
    return { code: session.code, game: session.game, joined: session.joined, turnSeconds: session.turnSeconds, deadline: session.deadline, expiresAt: session.expiresAt, revision: session.revision };
  }
  publish(session: Session) { session.revision++; this.save(session); for (const listener of session.listeners) listener(); }
  sweep() {
    for (const [code, session] of this.games) {
      if (session.expiresAt <= this.now()) { this.games.delete(code); this.db.prepare('DELETE FROM sessions WHERE code = ?').run(code); for (const listener of session.listeners) listener(); session.listeners.clear(); }
      else this.timeout(session);
    }
  }
}
