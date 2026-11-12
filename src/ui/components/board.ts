import { lines, names, type Game } from '../../game.ts';
import { coordinate, renderPiece } from './piece.ts';

export function renderBoard(game: Game, selectedUpgraded: boolean, locked = false): string {
  const choice = game.choices[0];
  const winningCells = game.winner === null
    ? []
    : [...new Set(lines(game.board, game.winner, game.mode === 'upgrade').flat())];

  return game.board.map((piece, index) => {
    const classes = ['cell'];
    const winOrder = winningCells.indexOf(index);
    if (index === game.last) classes.push('last');
    if (winningCells.includes(index)) classes.push('winning');
    const eligible = choice?.options.some(option => option.includes(index)) ?? false;
    if (eligible) classes.push('eligible');
    const description = piece
      ? `${names[piece.owner]} ${piece.upgraded ? 'upgraded' : 'base'} piece`
      : 'empty';
    const disabled = locked || game.winner !== null || (choice ? !eligible : piece !== null || choice !== undefined);
    const content = piece
      ? renderPiece(piece.owner, piece.upgraded)
      : `<span class="ghost">${renderPiece(game.turn, selectedUpgraded)}</span>`;

    return `
      <button class="${classes.join(' ')}" data-cell="${index}"
        ${winOrder >= 0 ? `style="--win-order: ${winOrder}"` : ''}
        ${eligible && choice !== undefined ? 'aria-pressed="false" aria-describedby="movement-description"' : ''}
        aria-label="${coordinate(index)}, ${description}${eligible && choice !== undefined ? ', select pieces to upgrade' : ''}${winOrder >= 0 ? ', winning line' : ''}" ${disabled ? 'disabled' : ''}>
        ${content}
      </button>`;
  }).join('');
}

export function highlightChoice(board: HTMLElement, cells: number[]): void {
  board.querySelectorAll<HTMLElement>('[data-cell]').forEach(cell => {
    cell.classList.toggle('choice-highlight', cells.includes(Number(cell.dataset.cell)));
  });
}
