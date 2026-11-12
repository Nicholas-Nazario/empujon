import type { Difficulty } from '../ai.ts';
import type { Mode } from '../game.ts';
import type { Layout } from './layout.ts';

export type GameActions = {
  placePiece(index: number): void;
  chooseUpgrade(option: number): void;
  confirmTriple(): void;
  selectPiece(upgraded: boolean): void;
  requestNewGame(mode?: Mode, computer?: Difficulty | null): void;
  undoMove(): void;
  toggleSound(): void;
};

function actionButton(event: Event, selector: string): HTMLButtonElement | null {
  return event.target instanceof Element ? event.target.closest<HTMLButtonElement>(selector) : null;
}

/** Delegate dynamic controls to stable containers; rerenders never rebind events. */
export function bindGameEvents(layout: Layout, actions: GameActions): void {
  layout.board.addEventListener('click', event => {
    const button = actionButton(event, '[data-cell]');
    if (button && !button.disabled) actions.placePiece(Number(button.dataset.cell));
  });
  layout.players.addEventListener('click', event => {
    const button = actionButton(event, '[data-piece]');
    if (button && !button.disabled) actions.selectPiece(button.dataset.piece === 'upgraded');
  });
  layout.boardHeading.addEventListener('click', event => {
    const confirm = actionButton(event, '[data-confirm-upgrade]');
    if (confirm && !confirm.disabled) actions.confirmTriple();
  });

  for (const button of layout.modeButtons) {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode;
      if (mode === 'classic' || mode === 'upgrade') actions.requestNewGame(mode);
    });
  }
  for (const button of layout.opponentButtons) {
    button.addEventListener('click', () => actions.requestNewGame(undefined, button.dataset.opponent === 'local' ? null : button.dataset.opponent as Difficulty));
  }
  layout.restartButton.addEventListener('click', () => actions.requestNewGame());
  layout.undoButton.addEventListener('click', actions.undoMove);
  layout.soundButton.addEventListener('click', actions.toggleSound);
}
