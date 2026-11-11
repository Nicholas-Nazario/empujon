import layoutHtml from './templates/layout.html?raw';
import rulesHtml from './templates/rules.html?raw';
import newGameHtml from './templates/new-game.html?raw';

/** Resolve stable elements once, and fail clearly if the template is incomplete. */
function requireElement<T extends HTMLElement>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing UI element: ${selector}`);
  return element;
}

export function mountLayout(root: HTMLElement) {
  root.innerHTML = layoutHtml + rulesHtml + newGameHtml;
  return {
    board: requireElement<HTMLDivElement>(root, '#board'),
    boardHeading: requireElement(root, '.board-heading'),
    turnTitle: requireElement(root, '#turn-title'),
    moveCount: requireElement(root, '#move-count'),
    boardMode: requireElement(root, '#board-mode'),
    status: requireElement(root, '#status'),
    goal: requireElement(root, '#goal'),
    goalExample: requireElement(root, '.mini-line'),
    choices: requireElement(root, '#choices'),
    players: requireElement(root, '#players'),
    modeButtons: Array.from(root.querySelectorAll<HTMLButtonElement>('[data-mode]')),
    opponentButtons: Array.from(root.querySelectorAll<HTMLButtonElement>('[data-opponent]')),
    opponentNote: requireElement(root, '#opponent-note'),
    undoButton: requireElement<HTMLButtonElement>(root, '#undo'),
    soundButton: requireElement<HTMLButtonElement>(root, '#sound'),
    restartButton: requireElement<HTMLButtonElement>(root, '#restart'),
    rulesOpenButton: requireElement<HTMLButtonElement>(root, '#rules-open'),
    tipRulesButton: requireElement<HTMLButtonElement>(root, '#tip-rules'),
    rulesDialog: requireElement<HTMLDialogElement>(root, '#rules'),
    rulesCloseButton: requireElement<HTMLButtonElement>(root, '#rules-close'),
    newGameDialog: requireElement<HTMLDialogElement>(root, '#new-game'),
    cancelNewButton: requireElement<HTMLButtonElement>(root, '#cancel-new'),
    confirmNewButton: requireElement<HTMLButtonElement>(root, '#confirm-new'),
  };
}

export type Layout = ReturnType<typeof mountLayout>;
