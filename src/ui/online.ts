import type { Game, Player } from '../game.ts';
import type { Action } from '../actions.ts';

export type OnlineState = { code: string; game: Game; history?: Game[]; joined: boolean; turnSeconds: number; deadline: number | null; expiresAt: number; revision: number };
export type Seat = { token: string; player: Player };

export async function onlineRequest(path: string, body: unknown): Promise<OnlineState & Seat> {
  const response = await fetch(`/api/games${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Unable to update game.');
  return result;
}
export function sendMove(state: OnlineState, seat: Seat, action: Action) {
  return onlineRequest(`/${state.code}/move`, { token: seat.token, revision: state.revision, action });
}
