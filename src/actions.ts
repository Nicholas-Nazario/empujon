import { chooseUpgrade, place, type Game, type Player } from './game.ts';

/** Indices are row-major: A1 = 0, F1 = 5, A6 = 30, F6 = 35. */
export type Action =
  | { type: 'place'; index: number; upgraded: boolean }
  | { type: 'choose'; option: number };

/** A pending reward can require a decision from the opponent of game.turn. */
export function actingPlayer(game: Game): Player | null {
  return game.winner !== null ? null : game.choices[0]?.owner ?? game.turn;
}

export function legalActions(game: Game): Action[] {
  if (game.winner !== null) return [];
  if (game.choices.length) {
    return game.choices[0].options.map((_, option) => ({ type: 'choose', option }));
  }
  const types = [false, true].filter(upgraded => game.pools[game.turn].some(p => p.upgraded === upgraded));
  return game.board.flatMap((piece, index) => piece ? [] : types.map(upgraded => ({ type: 'place' as const, index, upgraded })));
}

/** Validate input at the boundary; all game transitions use the shared engine. */
export function applyAction(game: Game, input: unknown): Game {
  if (!input || typeof input !== 'object') throw new Error('Expected a place or choose action.');
  const action = input as Record<string, unknown>;
  if (action.type === 'place') {
    if (typeof action.index !== 'number' || !Number.isInteger(action.index) ||
      (action.upgraded !== undefined && typeof action.upgraded !== 'boolean')) {
      throw new Error('place requires an integer index and an optional boolean upgraded.');
    }
    const next = place(game, action.index, action.upgraded as boolean | undefined);
    if (next === game) throw new Error('Illegal placement. Inspect legalActions for available actions.');
    return next;
  }
  if (action.type === 'choose') {
    if (typeof action.option !== 'number' || !Number.isInteger(action.option) || game.winner !== null) {
      throw new Error('choose requires an integer option for a pending upgrade choice.');
    }
    const next = chooseUpgrade(game, action.option);
    if (next === game) throw new Error('Illegal choice. Inspect legalActions for available actions.');
    return next;
  }
  throw new Error('Unknown action. Expected place or choose.');
}
