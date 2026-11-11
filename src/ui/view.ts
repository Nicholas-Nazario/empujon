import { actingPlayer } from '../actions.ts';
import { names, type Game } from '../game.ts';
import type { Layout } from './layout.ts';
import { renderBoard, renderUpgradeChoices } from './components/board.ts';
import { renderPlayers } from './components/players.ts';
import { renderPiece } from './components/piece.ts';

export type ViewState = {
  game: Game;
  selectedUpgraded: boolean;
  canUndo: boolean;
  soundEnabled: boolean;
  computer: boolean;
};

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
  layout.moveCount.textContent = `MOVE ${String(game.moves + (game.winner === null ? 1 : 0)).padStart(2, '0')}`;
  layout.boardMode.textContent = game.mode.toUpperCase();
  const thinking = state.computer && actingPlayer(game) === 1;
  layout.status.textContent = thinking ? (choice ? 'Beginner is choosing an upgrade…' : 'Beginner is choosing a move…') : game.message;
  layout.opponentNote.textContent = state.computer
    ? 'You are Terracotta. Beginner plays Indigo. Builds lines, keeps pieces in play, and earns upgrades.'
    : 'Take turns on this device, or play Beginner in either mode.';
  for (const button of layout.opponentButtons) {
    const selected = (button.dataset.opponent === 'beginner') === state.computer;
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
  layout.board.innerHTML = renderBoard(game, selectedUpgraded, thinking);
  layout.choices.innerHTML = renderUpgradeChoices(game, thinking);
  layout.players.innerHTML = renderPlayers(game, activePlayer, selectedUpgraded, state.computer);
  layout.undoButton.disabled = !state.canUndo;
  renderSoundButton(layout.soundButton, state.soundEnabled);
}

export function renderSoundButton(button: HTMLButtonElement, enabled: boolean): void {
  button.setAttribute('aria-pressed', String(enabled));
  button.innerHTML = `♪ <span>Sound ${enabled ? 'on' : 'off'}</span>`;
}
