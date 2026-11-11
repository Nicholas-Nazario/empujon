export type Player = 0 | 1;
export type Mode = 'classic' | 'upgrade';
export type Piece = { owner: Player; upgraded: boolean };
export type Choice = { owner: Player; kind: 'line' | 'eight'; options: number[][] };
export type Push = { owner: Player; from: number; to: number | null; dr: number; dc: number };
export type Movement = { owner: Player; placement: number; pushes: Push[] };
export type Game = {
  lastMovement?: Movement;
  mode: Mode; board: (Piece | null)[]; turn: Player;
  pools: [Piece[], Piece[]]; winner: Player | null; reason: string;
  choices: Choice[]; moves: number; last: number | null; message: string; rewards: string[];
};
export const names = ['Terracotta', 'Adoquín'] as const;
export function createGame(mode: Mode): Game {
  return { mode, board: Array(36).fill(null), turn: 0,
    pools: [Array.from({length: 8}, () => ({owner: 0, upgraded: false})), Array.from({length: 8}, () => ({owner: 1, upgraded: false}))],
    winner: null, reason: '', choices: [], moves: 0, last: null, rewards: [], message: 'Terracotta opens. Choose any empty square.' };
}
export function lines(board: Game['board'], owner: Player, upgradedOnly = false): number[][] {
  const result: number[][] = [];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
    for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
      const endR = r + 2*dr, endC = c + 2*dc;
      if (endR > 5 || endC < 0 || endC > 5) continue;
      const cells = [r*6+c, (r+dr)*6+c+dc, endR*6+endC];
      if (cells.every(i => board[i]?.owner === owner && (!upgradedOnly || board[i]?.upgraded))) result.push(cells);
    }
  }
  return result;
}
function win(g: Game, p: Player): string {
  if (lines(g.board, p, g.mode === 'upgrade').length) return g.mode === 'classic' ? 'Three in a row.' : 'Three upgraded pieces in a row.';
  const pieces = g.board.filter(x => x?.owner === p);
  if (pieces.length === 8 && (g.mode === 'classic' || pieces.every(x => x!.upgraded))) return g.mode === 'classic' ? 'All eight pieces on the board.' : 'All eight upgraded pieces on the board.';
  return '';
}
function groups(options: number[][]): number[][][] {
  const remaining = [...options], result: number[][][] = [];
  while (remaining.length) {
    const group = [remaining.shift()!];
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = remaining.length-1; i >= 0; i--) if (remaining[i].some(cell => group.some(line => line.includes(cell)))) {
        group.push(remaining.splice(i,1)[0]); changed = true;
      }
    }
    result.push(group);
  }
  return result;
}
function finish(g: Game) {
  g.turn = (1-g.turn) as Player;
  g.message = `${g.rewards.join(' ')} ${names[g.turn]}'s turn. Place a piece to push its neighbors.`.trim();
}
function applyChoice(g: Game, choice: Choice, cells: number[]) {
  const upgraded = cells.filter(i => !g.board[i]?.upgraded).length;
  g.rewards.push(`${names[choice.owner]} returned ${cells.length} ${cells.length === 1 ? "piece" : "pieces"} to supply${upgraded ? `, upgrading ${upgraded}` : ""}.`);
  for (const i of cells) {
    const piece = g.board[i];
    if (!piece || piece.owner !== choice.owner) throw new Error('Invalid upgrade selection');
    g.pools[choice.owner].push({...piece, upgraded: true}); g.board[i] = null;
  }
}
function processChoices(g: Game) {
  while (g.choices.length && g.choices[0].options.length === 1) {
    const choice = g.choices.shift()!; applyChoice(g, choice, choice.options[0]);
  }
  if (!g.choices.length) finish(g);
  else g.message = `${names[g.choices[0].owner]}: choose ${g.choices[0].kind === 'line' ? 'a line to upgrade' : 'a base piece to upgrade'}.`;
}
export function chooseUpgrade(game: Game, option: number): Game {
  const g = structuredClone(game), choice = g.choices[0];
  if (!choice || !choice.options[option]) return game;
  g.choices.shift(); applyChoice(g, choice, choice.options[option]); processChoices(g); return g;
}
/** Prefer stronger pieces when the caller has not explicitly selected a type. */
export function defaultPieceUpgraded(game: Game): boolean {
  return game.mode === 'upgrade' && game.pools[game.turn].some(piece => piece.upgraded);
}

/** Shared by placement and previews so strength, blocking, and edge rules agree. */
export function previewMovement(game: Game, index: number, upgraded = defaultPieceUpgraded(game)): Movement | null {
  if (game.winner !== null || game.choices.length || !Number.isInteger(index) || index < 0 || index >= 36 || game.board[index]
    || !game.pools[game.turn].some(piece => piece.upgraded === upgraded)) return null;
  const pushes: Push[] = [];
  const r = Math.floor(index/6), c = index%6;
  // Each ray has one neighbor and one destination; pushes cannot chain.
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const nr = r+dr, nc = c+dc;
    if (nr < 0 || nr > 5 || nc < 0 || nc > 5) continue;
    const from = nr*6+nc, piece = game.board[from];
    if (!piece) continue;
    // Strength applies to either owner and every direction, including off-board pushes.
    if (game.mode === 'upgrade' && piece.upgraded && !upgraded) continue;
    const tr = r+2*dr, tc = c+2*dc;
    if (tr < 0 || tr > 5 || tc < 0 || tc > 5) {
      pushes.push({ owner: piece.owner, from, to: null, dr, dc });
    } else if (!game.board[tr*6+tc]) pushes.push({ owner: piece.owner, from, to: tr*6+tc, dr, dc });
  }
  return { owner: game.turn, placement: index, pushes };
}

export function place(game: Game, index: number, upgraded = defaultPieceUpgraded(game)): Game {
  if (game.winner !== null || game.choices.length || !Number.isInteger(index) || index < 0 || index >= 36 || game.board[index]) return game;
  const supplyIndex = game.pools[game.turn].findIndex(x => x.upgraded === upgraded);
  if (supplyIndex < 0) return game;
  const g = structuredClone(game);
  g.rewards = [];
  g.board[index] = g.pools[g.turn].splice(supplyIndex,1)[0];
  const movement = previewMovement(game, index, upgraded)!;
  for (const { from, to } of movement.pushes) {
    const piece = g.board[from]!;
    if (to === null) g.pools[piece.owner].push(piece);
    else g.board[to] = piece;
    g.board[from] = null;
  }
  g.lastMovement = movement;
  g.last = index; g.moves++;
  const order: Player[] = [g.turn, (1-g.turn) as Player];
  for (const p of order) {
    const reason = win(g,p);
    if (reason) { g.winner = p; g.reason = reason; g.message = `${names[p]} wins! ${reason}`; return g; }
  }
  if (g.mode === 'upgrade') {
    for (const p of order) {
      const formations = groups(lines(g.board,p));
      for (const options of formations) g.choices.push({owner: p, kind: 'line', options});
      // A line takes precedence over the eight-piece reward because it removes pieces.
      if (!formations.length && g.board.filter(x => x?.owner === p).length === 8) {
        const options = g.board.flatMap((x,i) => x?.owner === p && !x.upgraded ? [[i]] : []);
        if (options.length) g.choices.push({owner:p, kind:'eight', options});
      }
    }
    processChoices(g);
  } else finish(g);
  return g;
}
