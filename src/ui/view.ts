import { difficultyNames, type Difficulty } from '../ai.ts';
import { renderIcon } from './icons.ts';
import { actingPlayer } from '../actions.ts';
import { names, type Game } from '../game.ts';
import type { Layout } from './layout.ts';
import { renderBoard, renderUpgradeChoices } from './components/board.ts';
import { renderPlayers } from './components/players.ts';
import { renderPiece } from './components/piece.ts';

export type ViewState = {
  game: Game;
  locked?: boolean;
  reviewing?: boolean;
  selectedUpgraded: boolean;
  canUndo: boolean;
  soundEnabled: boolean;
  computer: Difficulty | null;
};

const boardMarkup = new WeakMap<HTMLElement, string>();

/** Updates presentation only. Event listeners are installed separately, once. */
export function renderGame(layout: Layout, state: ViewState): void {
  const { game, selectedUpgraded } = state;
  const choice = game.choices[0];
  const activePlayer = game.winner ?? choice?.owner ?? game.turn;
  const playerName = names[activePlayer];

  layout.turnTitle.textContent = game.winner !== null
    ? `${playerName} wins`
    : choice ? `${playerName} · choose an upgrade` : `${playerName}'s turn`;
  layout.boardHeading.className = `board-heading color-${activePlayer}`;
  layout.playPanel.className = `play-panel color-${activePlayer}`;
  layout.moveCount.textContent = `MOVE ${String(game.moves + (game.winner === null ? 1 : 0)).padStart(2, '0')}`;
  layout.moveCount.hidden = !!state.reviewing;
  layout.boardMode.textContent = game.mode.toUpperCase();
  const thinking = !state.reviewing && !!state.computer && actingPlayer(game) === 1;
  layout.status.textContent = thinking ? (choice ? `${difficultyNames[state.computer!]} is choosing an upgrade…` : `${difficultyNames[state.computer!]} is choosing a move…`) : game.message;
  layout.opponentNote.textContent = state.computer
    ? `You’re ${names[0]}. ${difficultyNames[state.computer]} plays ${names[1]}.`
    : 'Share a screen. Trade little pushes.';
  for (const button of layout.opponentButtons) {
    const selected = button.dataset.opponent === (state.computer ?? 'local');
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  layout.goal.textContent = game.mode === 'classic'
    ? 'Line up three of your pieces, or get all eight onto the board.'
    : 'Line up three upgraded pieces, or get all eight upgraded pieces onto the board.';
  layout.goalExample.innerHTML = Array.from({ length: 3 }, () => renderPiece(0, game.mode === 'upgrade')).join('')
    + '<span>3 in a row</span>';

  for (const button of layout.modeButtons) {
    const isSelected = button.dataset.mode === game.mode;
    button.classList.toggle('active', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  }
  const boardHtml = renderBoard(game, selectedUpgraded, thinking || state.locked);
  // Online status updates should not restart the winning-line animation.
  if (boardMarkup.get(layout.board) !== boardHtml) {
    layout.board.innerHTML = boardHtml;
    boardMarkup.set(layout.board, boardHtml);
  }
  layout.choices.innerHTML = state.reviewing ? '' : renderUpgradeChoices(game, thinking || state.locked);
  layout.players.innerHTML = renderPlayers(game, activePlayer, selectedUpgraded, state.computer, state.reviewing);
  if (state.reviewing) {
    layout.turnTitle.textContent = game.winner !== null ? `${playerName} wins · Review` : 'Game review';
    layout.moveCount.textContent = `MOVE ${String(game.moves).padStart(2, '0')}`;
    layout.status.textContent = game.moves === 0 ? 'Starting position. Terracotta opens.'
      : game.winner !== null ? game.message
      : game.choices.length ? `${names[game.choices[0].owner]} has an upgrade decision.`
      : `Position after move ${game.moves}. ${game.rewards.join(' ')}`.trim();
  }
  layout.undoButton.disabled = !state.canUndo;
  renderSoundButton(layout.soundButton, state.soundEnabled);
}

export function renderSoundButton(button: HTMLButtonElement, enabled: boolean): void {
  button.setAttribute('aria-pressed', String(enabled));
  button.title = enabled ? 'Turn sound off' : 'Turn sound on';
  button.innerHTML = `${renderIcon(enabled ? 'music' : 'music-off')}<span>Sound ${enabled ? 'on' : 'off'}</span>`;
}
