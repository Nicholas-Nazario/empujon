import { actingPlayer, applyAction, legalActions, type Action } from './actions.ts';
import type { Game, Player } from './game.ts';

// Every possible three-cell line, including overlapping lines and diagonals.
const segments: number[][] = [];
for (let row = 0; row < 6; row++) for (let column = 0; column < 6; column++) {
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const endRow = row + 2 * dr, endColumn = column + 2 * dc;
    if (endRow < 6 && endColumn >= 0 && endColumn < 6) {
      segments.push([row * 6 + column, (row + dr) * 6 + column + dc, endRow * 6 + endColumn]);
    }
  }
}

/** Reward visible progress, without searching future turns. */
function progress(game: Game, player: Player): number {
  let score = 0;
  for (const [index, piece] of game.board.entries()) {
    if (piece?.owner !== player) continue;
    score += 4 + (piece.upgraded ? 4 : 0);
    // Interior pieces have room to maneuver and are harder to push off-board.
    score += Math.min(index % 6, 5 - index % 6, Math.floor(index / 6), 5 - Math.floor(index / 6)) * 0.5;
  }
  if (game.mode === 'upgrade') {
    const upgraded = [...game.board, ...game.pools[player]].filter(piece => piece?.owner === player && piece.upgraded).length;
    score += upgraded * 12;
    // Pending rewards are real progress even before the owner selects a line.
    // Value only newly upgraded pieces; returning an already upgraded one adds no reward.
    for (const choice of game.choices) {
      if (choice.owner !== player) continue;
      score += Math.max(...choice.options.map(cells => cells.reduce((gain, index) => {
        const piece = game.board[index]!;
        return gain + (piece.upgraded ? -8 : 8);
      }, 0)));
    }
  }
  for (const cells of segments) {
    const pieces = cells.map(index => game.board[index]);
    if (pieces.some(piece => piece !== null && piece.owner !== player)) continue;
    const owned = pieces.filter(piece => piece?.owner === player);
    if (owned.length === 2) {
      score += game.mode === 'classic' ? 3 : owned.every(piece => piece!.upgraded) ? 5 : 2;
    }
  }
  return score;
}

/** Beginner takes immediate wins, then varies among similarly promising moves. */
export function beginnerAction(game: Game, random: () => number = Math.random): Action | null {
  const player = actingPlayer(game);
  if (player === null) return null;
  const opponent = (1 - player) as Player;
  const evaluated = legalActions(game).map(action => {
    const next = applyAction(game, action);
    const score = next.winner === player ? 1_000_000 : next.winner === opponent ? -1_000_000
      : progress(next, player) - 0.8 * progress(next, opponent);
    return { action, score };
  });
  if (!evaluated.length) return null;
  const best = Math.max(...evaluated.map(candidate => candidate.score));
  const candidates = evaluated.filter(candidate => candidate.score >= best - 1);
  return candidates[Math.floor(random() * candidates.length)].action;
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export const difficultyNames: Record<Difficulty, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
};

/** Search complete iterations so the work limit never favors a partial root search. */
export function computerAction(game: Game, difficulty: Difficulty, random: () => number = Math.random): Action | null {
  if (difficulty === 'beginner') return beginnerAction(game, random);
  const player = actingPlayer(game);
  if (player === null) return null;
  const opponent = (1 - player) as Player;
  let remaining = difficulty === 'advanced' ? 20000 : 6000;
  const exhausted = Symbol('search exhausted');
  const evaluate = (state: Game): number => state.winner === player ? 1_000_000
    : state.winner === opponent ? -1_000_000 : progress(state, player) - progress(state, opponent);
  function children(state: Game) {
    const maximize = actingPlayer(state) === player;
    return legalActions(state).map(action => {
      if (--remaining < 0) throw exhausted;
      const next = applyAction(state, action);
      return { action, next, score: evaluate(next) };
    }).sort((a, b) => maximize ? b.score - a.score : a.score - b.score);
  }
  function search(state: Game, depth: number, alpha: number, beta: number): number {
    if (state.winner !== null || (depth <= 0 && !state.choices.length)) return evaluate(state);
    const maximize = actingPlayer(state) === player;
    let value = maximize ? -Infinity : Infinity;
    for (const child of children(state)) {
      // Reward decisions belong to their actual owner and do not consume a placement ply.
      const score = search(child.next, depth - (state.choices.length ? 0 : 1), alpha, beta);
      value = maximize ? Math.max(value, score) : Math.min(value, score);
      if (maximize) alpha = Math.max(alpha, value);
      else beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return Number.isFinite(value) ? value : evaluate(state);
  }
  let best = beginnerAction(game, random);
  const roots = children(game);
  for (let depth = 1; depth <= (difficulty === 'advanced' ? 3 : 2); depth++) {
    let candidate = best, value = -Infinity;
    try {
      for (const root of roots) {
        const score = search(root.next, depth - (game.choices.length ? 0 : 1), value, Infinity);
        if (score > value) { value = score; candidate = root.action; }
      }
    } catch (error) {
      if (error !== exhausted) throw error;
      break;
    }
    best = candidate;
  }
  return best;
}
