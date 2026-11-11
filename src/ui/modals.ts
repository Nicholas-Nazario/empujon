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
export function createModals(layout: Layout, onConfirmNewGame: (mode: Mode) => void) {
  let pendingMode: Mode = 'classic';
  const openRules = () => layout.rulesDialog.showModal();

  layout.rulesOpenButton.addEventListener('click', openRules);
  layout.rulesCloseButton.addEventListener('click', () => layout.rulesDialog.close());
  layout.cancelNewButton.addEventListener('click', () => layout.newGameDialog.close());
  layout.confirmNewButton.addEventListener('click', () => {
    onConfirmNewGame(pendingMode);
    layout.newGameDialog.close();
  });
  closeOnBackdropClick(layout.rulesDialog);
  closeOnBackdropClick(layout.newGameDialog);

  return {
    confirmNewGame(mode: Mode): void {
      pendingMode = mode;
      layout.newGameDialog.showModal();
    },
  };
}
