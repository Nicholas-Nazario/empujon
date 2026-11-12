import type { Mode } from '../game.ts';
import type { Layout } from './layout.ts';

function closeOnBackdropClick(dialog: HTMLDialogElement): void {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (outside) dialog.close();
  });
}

/** Owns dialog events and the mode awaiting restart confirmation. */
export function createModals(layout: Layout, onConfirmNewGame: (mode: Mode) => void, onReviewGame: () => void) {
  let pendingMode: Mode = 'classic';
  let resultTimer: ReturnType<typeof setTimeout> | undefined;
  const cancelResult = () => {
    clearTimeout(resultTimer);
    resultTimer = undefined;
  };
  const openRules = () => layout.rulesDialog.showModal();
  const eyebrow = layout.newGameDialog.querySelector<HTMLElement>('.eyebrow')!;
  const title = layout.newGameDialog.querySelector<HTMLElement>('#new-game-title')!;
  const description = layout.newGameDialog.querySelector<HTMLElement>('#new-game-description')!;

  layout.rulesOpenButton.addEventListener('click', openRules);
  layout.rulesCloseButton.addEventListener('click', () => layout.rulesDialog.close());
  layout.cancelNewButton.addEventListener('click', () => {
    const review = layout.newGameDialog.classList.contains('game-result');
    layout.newGameDialog.close();
    if (review) onReviewGame();
  });
  layout.confirmNewButton.addEventListener('click', () => {
    onConfirmNewGame(pendingMode);
    layout.newGameDialog.close();
  });
  closeOnBackdropClick(layout.rulesDialog);
  closeOnBackdropClick(layout.newGameDialog);

  return {
    cancelResult,
    confirmNewGame(mode: Mode): void {
      cancelResult();
      layout.newGameDialog.classList.remove('game-result');
      pendingMode = mode;
      eyebrow.textContent = 'A FRESH START';
      title.textContent = 'Start a new game?';
      description.textContent = 'Your current board will be cleared.';
      layout.cancelNewButton.textContent = 'Keep playing';
      layout.newGameDialog.showModal();
    },
    showResult(mode: Mode, heading: string, message: string): void {
      cancelResult();
      // Let the winning line count finish before covering the board.
      resultTimer = setTimeout(() => {
        resultTimer = undefined;
        if (layout.newGameDialog.open) return;
        pendingMode = mode;
        eyebrow.textContent = 'GAME OVER';
        title.textContent = heading;
        description.textContent = message;
        layout.cancelNewButton.textContent = 'Review game';
        layout.newGameDialog.classList.add('game-result');
        layout.newGameDialog.showModal();
      }, 2000);
    },
  };
}
