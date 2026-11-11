import type { Mode } from '../game.ts';
import type { Layout } from './layout.ts';

export type GameActions = {
  placePiece(index: number): void;
  chooseUpgrade(option: number): void;
  selectPiece(upgraded: boolean): void;
  requestNewGame(mode?: Mode, computer?: boolean): void;
  undoMove(): void;
  toggleSound(): void;
  previewChoice(option: number | null): void;
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
  layout.choices.addEventListener('click', event => {
    const button = actionButton(event, '[data-choice]');
    if (button) actions.chooseUpgrade(Number(button.dataset.choice));
  });

  const previewChoice = (event: Event) => {
    const button = actionButton(event, '[data-choice]');
    if (button) actions.previewChoice(Number(button.dataset.choice));
  };
  const clearPreview = () => actions.previewChoice(null);
  layout.choices.addEventListener('pointerover', previewChoice);
  layout.choices.addEventListener('focusin', previewChoice);
  layout.choices.addEventListener('pointerout', event => {
    const button = actionButton(event, '[data-choice]');
    if (event.relatedTarget instanceof Node && button?.contains(event.relatedTarget)) return;
    clearPreview();
  });
  layout.choices.addEventListener('focusout', clearPreview);

  for (const button of layout.modeButtons) {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode;
      if (mode === 'classic' || mode === 'upgrade') actions.requestNewGame(mode);
    });
  }
  for (const button of layout.opponentButtons) {
    button.addEventListener('click', () => actions.requestNewGame(undefined, button.dataset.opponent === 'beginner'));
  }
  layout.restartButton.addEventListener('click', () => actions.requestNewGame());
  layout.undoButton.addEventListener('click', actions.undoMove);
  layout.soundButton.addEventListener('click', actions.toggleSound);
}
