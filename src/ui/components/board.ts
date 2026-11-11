import { playerNames as names } from '../player-colors.ts';
import { lines, type Game } from '../../game.ts';
import { coordinate, renderPiece } from './piece.ts';

export function renderBoard(game: Game, selectedUpgraded: boolean, locked = false): string {
  const choice = game.choices[0];
  const winningCells = game.winner === null
    ? []
    : lines(game.board, game.winner, game.mode === 'upgrade').flat();

  return game.board.map((piece, index) => {
    const classes = ['cell'];
    if (index === game.last) classes.push('last');
    if (winningCells.includes(index)) classes.push('winning');
    if (choice?.options.some(option => option.includes(index))) classes.push('eligible');
    const description = piece
      ? `${names[piece.owner]} ${piece.upgraded ? 'upgraded' : 'base'} piece`
      : 'empty';
    const disabled = locked || piece !== null || choice !== undefined || game.winner !== null;
    const content = piece
      ? renderPiece(piece.owner, piece.upgraded)
      : `<span class="ghost">${renderPiece(game.turn, selectedUpgraded)}</span>`;

    return `
      <button class="${classes.join(' ')}" data-cell="${index}"
        aria-label="${coordinate(index)}, ${description}" ${disabled ? 'disabled' : ''}>
        ${content}
      </button>`;
  }).join('');
}

export function renderUpgradeChoices(game: Game, locked = false): string {
  const choice = game.choices[0];
  if (!choice) return '';
  const instruction = choice.kind === 'line'
    ? 'Choose a triple to return upgraded:'
    : 'Choose a base piece to return upgraded:';
  const buttons = choice.options.map((cells, option) => `
    <button class="choice-button" data-choice="${option}" ${locked ? 'disabled' : ''}>
      ${cells.map(coordinate).join(' · ')}
    </button>`).join('');
  return `<span class="choice-instruction">${instruction}</span>${buttons}`;
}

export function highlightChoice(board: HTMLElement, cells: number[]): void {
  board.querySelectorAll<HTMLElement>('[data-cell]').forEach(cell => {
    cell.classList.toggle('choice-highlight', cells.includes(Number(cell.dataset.cell)));
  });
}
