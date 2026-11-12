import type { Game } from '../game.ts';

/** Reconstruct the contact moment before pushes and automatic upgrade returns. */
export function movementStage(before: Game, after: Game): Game | null {
  if (after.moves !== before.moves + 1 || !after.lastMovement) return null;
  const index = after.lastMovement.placement;
  const placed = after.board[index] ?? after.upgradeReturns?.flat().find(piece => piece.index === index)?.piece;
  if (!placed || before.board[index]) return null;
  const board = [...before.board];
  board[index] = placed;
  const pools: Game['pools'] = [before.pools[0].slice(), before.pools[1].slice()];
  const supplyIndex = pools[placed.owner].findIndex(piece => piece.upgraded === placed.upgraded);
  if (supplyIndex >= 0) pools[placed.owner].splice(supplyIndex, 1);
  return { ...after, board, pools, winner: null, choices: [], upgradeReturns: [] };
}

/** Only the placed and actually pushed pieces move. All distances follow cell geometry. */
export function animateMovement(board: HTMLElement, game: Game): number {
  const movement = game.lastMovement!;
  const cell = (index: number) => board.querySelector<HTMLElement>(`[data-cell="${index}"]`)!;
  const placed = cell(movement.placement).querySelector<HTMLElement>(':scope > .piece');
  placed?.animate([
    { transform: 'scale(.82)', opacity: .65 },
    { transform: 'scale(1.04)', opacity: 1, offset: .65 },
    { transform: 'scale(1)', opacity: 1 },
  ], { duration: 200, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });

  const origin = cell(0).getBoundingClientRect();
  const next = cell(7).getBoundingClientRect();
  for (const push of movement.pushes) {
    const piece = cell(push.from).querySelector<HTMLElement>(':scope > .piece');
    const transform = `translate(${push.dc * (next.x - origin.x)}px, ${push.dr * (next.y - origin.y)}px)`;
    piece?.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      ...(push.to === null ? [
        { transform: `translate(${push.dc * (next.x - origin.x) * .4}px, ${push.dr * (next.y - origin.y) * .4}px) scale(.92)`, opacity: .9, offset: .4 },
      ] : []),
      { transform: `${transform} scale(${push.to === null ? .45 : 1})`, opacity: push.to === null ? 0 : 1 },
    ], { duration: 280, delay: 70, easing: 'cubic-bezier(.22,.68,.25,1)', fill: 'both' });
  }
  return movement.pushes.length ? 350 : 200;
}

/** A single quiet acknowledgement per receiving player, even for multiple exits. */
export function pulseReturnedSupplies(players: HTMLElement, game: Game): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const owners = new Set(game.lastMovement?.pushes.filter(push => push.to === null).map(push => push.owner));
  for (const owner of owners) {
    players.querySelector<HTMLElement>(`.player-card.color-${owner} .supply`)?.animate([
      { transform: 'scale(1)' },
      { transform: 'scale(1.045)', offset: .4 },
      { transform: 'scale(1)' },
    ], { duration: 320, easing: 'ease-in-out' });
  }
}
