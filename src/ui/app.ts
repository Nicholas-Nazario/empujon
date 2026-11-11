import { createGame, place, chooseUpgrade, defaultPieceUpgraded, type Game, type Mode } from '../game.ts';
import { highlightChoice } from './components/board.ts';
import { bindGameEvents, type GameActions } from './events.ts';
import { mountLayout } from './layout.ts';
import { createModals } from './modals.ts';
import { createMoveSound } from './sound.ts';
import { renderGame, renderSoundButton } from './view.ts';

/** Owns the local session and translates UI actions into shared-engine calls. */
export function startApp(root: HTMLElement): void {
  const layout = mountLayout(root);
  const moveSound = createMoveSound();
  let game = createGame('classic');
  let history: Game[] = [];
  let selectedUpgraded: boolean | null = null;
  let soundEnabled = false;

  function render(): void {
    const supply = game.pools[game.turn];
    if (selectedUpgraded !== null && !supply.some(piece => piece.upgraded === selectedUpgraded)) {
      selectedUpgraded = null;
    }
    renderGame(layout, { game, selectedUpgraded: selectedUpgraded ?? defaultPieceUpgraded(game), canUndo: history.length > 0, soundEnabled });
  }

  function startNewGame(mode: Mode): void {
    game = createGame(mode);
    history = [];
    selectedUpgraded = null;
    render();
  }

  const modals = createModals(layout, startNewGame);
  const actions: GameActions = {
    placePiece(index) {
      const next = place(game, index, selectedUpgraded ?? defaultPieceUpgraded(game));
      if (next === game) return;
      history.push(game);
      game = next;
      selectedUpgraded = null;
      if (soundEnabled) moveSound.play();
      render();
    },
    chooseUpgrade(option) {
      game = chooseUpgrade(game, option);
      selectedUpgraded = null;
      render();
    },
    selectPiece(upgraded) {
      selectedUpgraded = upgraded;
      render();
    },
    requestNewGame(mode = game.mode) {
      if (game.moves === 0) startNewGame(mode);
      else modals.confirmNewGame(mode);
    },
    undoMove() {
      const previous = history.pop();
      if (!previous) return;
      game = previous;
      selectedUpgraded = null;
      render();
    },
    toggleSound() {
      soundEnabled = !soundEnabled;
      // Keep focus on the stable sound button while its label changes.
      renderSoundButton(layout.soundButton, soundEnabled);
    },
    previewChoice(option) {
      const cells = option === null ? [] : game.choices[0]?.options[option] ?? [];
      highlightChoice(layout.board, cells);
    },
  };

  bindGameEvents(layout, actions);
  render();
}
