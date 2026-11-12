import { actingPlayer } from '../../actions.ts';
import { difficultyNames, type Difficulty } from '../../ai.ts';
import { names, type Game, type Movement } from '../../game.ts';
import { renderIcon } from '../icons.ts';
import { renderMovement } from './movement.ts';

export type BoardInformationState = {
  game: Game;
  computer: Difficulty | null;
  review: { index: number; total: number } | null;
  upgrade: { selected: number | null } | null;
  preview: Movement | null;
  touchPreview: boolean;
  online: { title: string; status: string; yourTurn: boolean } | null;
};

/** One owner for the panel's content; its three layout slots never change size. */
export function createBoardInformation(panel: HTMLElement) {
  const title = panel.querySelector<HTMLElement>('#turn-title')!;
  const count = panel.querySelector<HTMLElement>('#move-count')!;
  const description = panel.querySelector<HTMLElement>('#movement-description')!;
  const preview = panel.querySelector<HTMLElement>('#movement-preview')!;
  const status = panel.querySelector<HTMLElement>('#status')!;
  const confirm = panel.querySelector<HTMLButtonElement>('[data-confirm-upgrade]')!;
  const place = panel.querySelector<HTMLButtonElement>('#preview-place')!;
  const review = panel.querySelector<HTMLElement>('#game-review')!;
  const position = panel.querySelector<HTMLElement>('#review-position')!;
  const buttons = Array.from(review.querySelectorAll<HTMLButtonElement>('[data-review]'));

  return {
    render(state: BoardInformationState): void {
      const { game, upgrade, online } = state;
      const choice = game.choices[0];
      const player = game.winner ?? choice?.owner ?? game.turn;
      const thinking = !state.review && !!state.computer && actingPlayer(game) === 1;
      const wasReady = !confirm.hidden && !confirm.disabled;
      panel.className = `board-heading color-${player}`;
      panel.classList.toggle('your-turn', !state.review && !!online?.yourTurn);
      panel.classList.toggle('choosing-upgrade', !!upgrade);
      title.textContent = state.review ? game.winner !== null ? `${names[player]} wins · Review` : 'Game review'
        : online?.title ?? (game.winner !== null ? `${names[player]} wins`
          : choice ? `${names[player]} · choose an upgrade` : `${names[player]}'s turn`);
      count.textContent = `MOVE ${String(game.moves + (game.winner === null ? 1 : 0)).padStart(2, '0')}`;
      count.hidden = !!state.review || !!upgrade;
      description.textContent = game.lastMovement ? renderMovement(game.lastMovement, false).description : 'Last move: no pieces placed yet.';
      status.textContent = state.review ? game.moves === 0 ? 'Starting position. Terracotta opens.'
        : game.winner !== null ? game.message
        : choice ? `${names[choice.owner]} has an upgrade decision.`
        : game.rewards.join(' ') || `Position after move ${game.moves}.`
        : online?.status ?? (thinking ? `${difficultyNames[state.computer!]} is choosing ${choice ? 'an upgrade' : 'a move'}…` : game.message);
      const showPreview = !state.review && !upgrade && !!state.preview;
      preview.hidden = !showPreview;
      preview.textContent = showPreview ? renderMovement(state.preview, true).description : '';
      description.hidden = showPreview;
      place.hidden = !showPreview || !state.touchPreview;
      if (state.preview) place.textContent = `Place at ${'ABCDEF'[state.preview.placement % 6]}${Math.floor(state.preview.placement / 6) + 1}`;
      confirm.hidden = !upgrade;
      confirm.disabled = !upgrade || upgrade.selected === null;
      if (upgrade && choice) {
        const ready = upgrade.selected !== null;
        title.textContent = `${names[choice.owner]} · ${ready ? 'Ready to upgrade' : choice.kind === 'line' ? 'Choose a triple' : 'Choose a piece'}`;
        confirm.innerHTML = `${renderIcon('upgrade')}<span>${ready ? 'Confirm upgrade' : choice.kind === 'line' ? 'Select a triple on the board' : 'Select a piece on the board'}</span>`;
        description.textContent = !ready ? choice.kind === 'line' ? 'Tap an outlined piece to preview a triple.' : 'Tap a piece to return upgraded.'
          : choice.kind === 'line' ? `Triple ${upgrade.selected! + 1}/${choice.options.length} selected. Confirm to upgrade.` : 'Piece selected. Confirm to return it upgraded.';
        status.textContent = '';
        if (ready && !wasReady && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          confirm.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.025)' }, { transform: 'scale(1)' }], { duration: 450, easing: 'ease-in-out' });
        }
      }
      review.hidden = !state.review;
      if (state.review) {
        const { index, total } = state.review;
        position.textContent = `${index === 0 && game.moves === 0 ? 'Starting position' : `Move ${game.moves}`} · ${index + 1} / ${total}`;
        for (const button of buttons) button.disabled = ['first', 'previous'].includes(button.dataset.review!) ? index === 0 : index === total - 1;
      }
      title.title = title.textContent ?? '';
      for (const text of [description, preview, status]) text.title = text.textContent ?? '';
    },
  };
}
