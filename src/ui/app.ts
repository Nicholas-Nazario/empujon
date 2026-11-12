import { beginnerAction, type Difficulty } from '../ai.ts';
import { actingPlayer, applyAction, type Action } from '../actions.ts';
import { onlineRequest, sendMove, type OnlineState, type Seat } from './online.ts';
import { createGame, place, chooseUpgrade, defaultPieceUpgraded, previewMovement, names, type Game, type Mode } from '../game.ts';
import { renderIcon } from './icons.ts';
import { renderMovement } from './components/movement.ts';
import { highlightChoice } from './components/board.ts';
import { bindGameEvents, type GameActions } from './events.ts';
import { mountLayout } from './layout.ts';
import { createModals } from './modals.ts';
import { createGameSound, transitionSounds } from './sound.ts';
import { renderGame, renderSoundButton } from './view.ts';
import { movementStage, animateMovement, pulseReturnedSupplies } from './motion.ts';

/** Owns the local session and translates UI actions into shared-engine calls. */
export function startApp(root: HTMLElement): void {
  const layout = mountLayout(root);
  const sounds = createGameSound();
  const settings = root.querySelector<HTMLDetailsElement>('.game-settings')!;
  const mobileLayout = matchMedia('(max-width: 650px)');
  const playersPanel = root.querySelector<HTMLElement>('.players-panel')!;
  const boardActions = root.querySelector<HTMLElement>('.board-actions')!;
  function arrangeMobileLayout(): void {
    settings.open = !mobileLayout.matches;
    if (mobileLayout.matches) boardActions.before(playersPanel);
    else layout.playPanel.after(playersPanel);
  }
  arrangeMobileLayout();
  mobileLayout.addEventListener('change', arrangeMobileLayout);
  let game = createGame('classic');
  let upgradeUntil = 0;
  let upgradeKey = '';
  let upgradeTimer: ReturnType<typeof setTimeout> | undefined;

  let motion: { after: Game; stage: Game; started: boolean } | null = null;
  let motionTimer: ReturnType<typeof setTimeout> | undefined;
  let history: Game[] = [];
  let selectedUpgraded: boolean | null = null;
  let soundEnabled = false;
  let computer: Difficulty | null = null;
  let pendingComputer: Difficulty | null = null;
  let computerWorker: Worker | undefined;
  let computerTimer: ReturnType<typeof setTimeout> | undefined;
  let resultShown = false;
  let annotationsEnabled = false;
  let previewIndex: number | null = null;
  let touchPreview = false;
  let touchPreviewEnabled = false;
  try { touchPreviewEnabled = localStorage.getItem('empujon:touch-preview') === 'true'; } catch { /* Use single-tap placement when storage is unavailable. */ }
  const touchPreviewSetting = root.querySelector<HTMLButtonElement>('#touch-preview')!;
  function renderTouchPreviewSetting(): void {
    touchPreviewSetting.setAttribute('aria-pressed', String(touchPreviewEnabled));
    touchPreviewSetting.title = touchPreviewEnabled ? 'Tap once to preview, then tap again to place' : 'Tap once to place';
    touchPreviewSetting.innerHTML = `${renderIcon(touchPreviewEnabled ? 'touch' : 'touch-off')}<span>Touch preview ${touchPreviewEnabled ? 'on' : 'off'}</span>`;
  }
  renderTouchPreviewSetting();
  touchPreviewSetting.addEventListener('click', () => {
    touchPreviewEnabled = !touchPreviewEnabled;
    renderTouchPreviewSetting();
    touchPreview = false;
    touchSelection = null;
    showMovement();
    try { localStorage.setItem('empujon:touch-preview', String(touchPreviewEnabled)); } catch { /* Keep the setting for this session. */ }
  });
  let touchSelection: number | null = null;
  const movementOverlay = root.querySelector<HTMLElement>('#movement-overlay')!;
  const movementDescription = root.querySelector<HTMLElement>('#movement-description')!;
  const movementPreview = root.querySelector<HTMLElement>('#movement-preview')!;
  const movementToggle = root.querySelector<HTMLButtonElement>('#movement-toggle')!;
  const previewPlace = root.querySelector<HTMLButtonElement>('#preview-place')!;
  function showMovement(index: number | null = null): void {
    previewIndex = index;
    if (index === null) touchSelection = null;
    const movement = index === null ? game.lastMovement ?? null
      : previewMovement(game, index, selectedUpgraded ?? defaultPieceUpgraded(game));
    const rendered = renderMovement(movement, index !== null);
    movementOverlay.innerHTML = annotationsEnabled ? rendered.svg : '';
    movementDescription.textContent = game.lastMovement
      ? renderMovement(game.lastMovement, false).description : 'Last move: no pieces placed yet.';
    movementPreview.textContent = index === null ? '' : rendered.description;
    movementPreview.hidden = index === null;
    previewPlace.hidden = !touchPreview || index === null || !movement;
    if (index !== null) previewPlace.textContent = `Place at ${'ABCDEF'[index % 6]}${Math.floor(index / 6) + 1}`;
  }
  movementToggle.addEventListener('click', () => {
    annotationsEnabled = !annotationsEnabled;
    movementToggle.setAttribute('aria-pressed', String(annotationsEnabled));
    movementToggle.innerHTML = `${renderIcon(annotationsEnabled ? 'eye' : 'eye-off')}<span>Annotations ${annotationsEnabled ? 'on' : 'off'}</span>`;
    showMovement();
  });
  previewPlace.addEventListener('click', () => {
    if (previewIndex !== null) { touchPreview = false; actions.placePiece(previewIndex); }
  });
  layout.board.addEventListener('pointerdown', event => { touchPreview = touchPreviewEnabled && event.pointerType === 'touch'; });
  for (const type of ['pointerover', 'focusin']) layout.board.addEventListener(type, event => {
    const cell = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-cell]') : null;
    if (cell && !cell.disabled) showMovement(Number(cell.dataset.cell));
  });
  layout.board.addEventListener('pointerleave', () => { if (!touchPreview) showMovement(); });
  layout.board.addEventListener('focusout', event => {
    if (!touchPreview && !(event.relatedTarget instanceof Node && layout.board.contains(event.relatedTarget))) showMovement();
  });

  function playTransition(before: Game, after: Game): void {
    if (soundEnabled) sounds.play(transitionSounds(before, after, seat?.player ?? (computer ? 0 : null)));
    const stage = movementStage(before, after);
    if (stage && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      clearTimeout(motionTimer);
      motion = { after, stage, started: false };
    }
  }

  function cancelComputer(): void {
    computerWorker?.terminate();
    computerWorker = undefined;
    clearTimeout(computerTimer);
    computerTimer = undefined;
  }

  function scheduleComputer(): void {
    if (online || !computer || actingPlayer(game) !== 1 || computerTimer !== undefined || computerWorker) return;
    computerTimer = setTimeout(() => {
      computerTimer = undefined;
      computerWorker = new Worker(new URL('../ai.worker.ts', import.meta.url), { type: 'module' });
      const finishComputer = (action: Action | null) => {
        computerWorker?.terminate();
        computerWorker = undefined;
        if (!action) return;
        const next = applyAction(game, action);
        playTransition(game, next);
        game = next;
        render();
      };
      computerWorker.onmessage = (event: MessageEvent<Action | null>) => finishComputer(event.data);
      computerWorker.onerror = () => finishComputer(beginnerAction(game));
      computerWorker.postMessage({ game, difficulty: computer });
    }, Math.max(400, upgradeUntil - Date.now() + 100));
  }

  let online: OnlineState | null = null;
  let seat: Seat | null = null;
  let stream: EventSource | null = null;
  let connected = false;
  let busy = false;
  let onlineError = '';
  const hostButton = root.querySelector<HTMLButtonElement>('#host-online')!;
  const leaveButton = root.querySelector<HTMLButtonElement>('#leave-online')!;
  const turnLimit = root.querySelector<HTMLSelectElement>('#turn-limit')!;
  const onlineStatus = root.querySelector<HTMLElement>('#online-status')!;
  const banner = root.querySelector<HTMLElement>('#online-banner')!;
  const details = root.querySelector<HTMLElement>('#online-details')!;
  const setupDialog = root.querySelector<HTMLDialogElement>('#online-setup')!;
  const inviteDialog = root.querySelector<HTMLDialogElement>('#online-invite')!;
  const onlineMode = root.querySelector<HTMLSelectElement>('#online-mode')!;
  const startButton = root.querySelector<HTMLButtonElement>('#start-online')!;
  const setupError = root.querySelector<HTMLElement>('#online-setup-error')!;
  const inviteFeedback = root.querySelector<HTMLElement>('#invite-feedback')!;
  const inviteUrl = root.querySelector<HTMLInputElement>('#invite-url')!;
  const clock = root.querySelector<HTMLElement>('#online-clock')!;
  function canAct() { return !online || !!(seat && connected && online.joined && !busy && actingPlayer(game) === seat.player); }
  function updateClock() {
    if (!online) { clock.textContent = ''; return; }
    const remaining = Math.max(0, Math.ceil((online.expiresAt - Date.now()) / 60000));
    clock.textContent = `Session expires in ${remaining} min` + (online.deadline ? ` · Turn: ${Math.max(0, Math.ceil((online.deadline - Date.now()) / 1000))}s` : '');
  }
  setInterval(updateClock, 1000);
  function accept(state: OnlineState) { if (online && state.revision < online.revision) return; onlineError = ''; if (online && state.revision > online.revision) playTransition(game, state.game); online = state; game = state.game; selectedUpgraded = null; render(); }
  function error(error: unknown) { onlineError = error instanceof Error ? error.message : 'Unable to connect.'; onlineStatus.textContent = onlineError; }
  function connect(state: OnlineState & Seat) {
    cancelComputer();
    computer = null;
    pendingComputer = null;
    seat = { token: state.token, player: state.player };
    localStorage.setItem(`empujon:${state.code}`, JSON.stringify(seat));
    window.history.replaceState(null, '', `?game=${state.code}`);
    stream?.close();
    connected = false;
    accept(state);
    stream = new EventSource(`/api/games/${state.code}/events?token=${encodeURIComponent(seat.token)}`);
    stream.onmessage = event => { connected = true; accept(JSON.parse(event.data)); };
    stream.onerror = () => { connected = false; render(); onlineStatus.textContent = 'Connection interrupted. Reconnecting…'; };
    stream.addEventListener('expired', () => { connected = false; stream?.close(); render(); onlineStatus.textContent = 'This game has expired. Start a new game to play again.'; });
  }
  async function submit(action: Action) {
    if (!online || !seat || !canAct()) return;
    busy = true; onlineError = ''; render();
    try { accept(await sendMove(online, seat, action)); }
    catch (e) { error(e); }
    finally { busy = false; render(); }
  }
  function showInvite() {
    inviteFeedback.textContent = '';
    inviteDialog.showModal();
  }
  hostButton.addEventListener('click', () => {
    onlineMode.value = game.mode;
    setupError.textContent = '';
    setupDialog.showModal();
  });
  root.querySelector('#cancel-online')!.addEventListener('click', () => setupDialog.close());
  root.querySelector('#online-setup-form')!.addEventListener('submit', async event => {
    event.preventDefault();
    if (startButton.disabled) return;
    startButton.disabled = true;
    startButton.textContent = 'Starting…';
    setupError.textContent = '';
    try {
      connect(await onlineRequest('', { mode: onlineMode.value, turnSeconds: Number(turnLimit.value) }));
      setupDialog.close();
      showInvite();
    } catch (e) { setupError.textContent = e instanceof Error ? e.message : 'Unable to start game.'; }
    finally { startButton.disabled = false; startButton.textContent = 'Start online game'; }
  });
  root.querySelector('#show-invite')!.addEventListener('click', () => { void copyInvite(false); });
  root.querySelector('#close-invite')!.addEventListener('click', () => inviteDialog.close());
  leaveButton.addEventListener('click', () => { window.location.href = window.location.pathname; });
  async function copyInvite(fromDialog: boolean) {
    const feedback = root.querySelector<HTMLElement>('#sidebar-copy-feedback')!;
    const preview = root.querySelector<HTMLInputElement>('#sidebar-invite-url')!;
    try {
      await navigator.clipboard.writeText(inviteUrl.value);
      if (fromDialog) inviteDialog.close();
      feedback.textContent = 'Link copied!';
    } catch {
      const input = fromDialog ? inviteUrl : preview;
      input.focus(); input.select();
      (fromDialog ? inviteFeedback : feedback).textContent = 'Copy the selected link to share it.';
    }
  }
  root.querySelector('#copy-invite')!.addEventListener('click', () => { void copyInvite(true); });

  function render(): void {
    if (motion && (game.moves !== motion.after.moves || JSON.stringify(game.board) !== JSON.stringify(motion.after.board))) {
      clearTimeout(motionTimer);
      motion = null;
    }
    const key = JSON.stringify([game.moves, game.board, game.upgradeReturns]);
    if (!motion && key !== upgradeKey) {
      upgradeKey = key;
      clearTimeout(upgradeTimer);
      const count = game.upgradeReturns?.flat().length ?? 0;
      upgradeUntil = count ? Date.now() + (matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 150 + (count - 1) * 300 + 550) : 0;
      if (count) upgradeTimer = setTimeout(render, upgradeUntil - Date.now() + 20);
    }
    const returning = !motion && Date.now() < upgradeUntil ? game.upgradeReturns?.flat() ?? [] : [];
    const displayGame = motion?.stage ?? (returning.length ? { ...game, board: [...game.board] } : game);
    for (const { index, piece } of returning) displayGame.board[index] = piece;

    const supply = game.pools[game.turn];
    if (selectedUpgraded !== null && !supply.some(piece => piece.upgraded === selectedUpgraded)) {
      selectedUpgraded = null;
    }
    layout.board.classList.toggle('is-moving', !!motion);
    renderGame(layout, { game: displayGame, locked: !!motion || returning.length > 0, selectedUpgraded: selectedUpgraded ?? defaultPieceUpgraded(game), canUndo: !online && history.length > 0, soundEnabled, computer });
    returning.forEach(({ index }, order) => {
      const cell = layout.board.querySelector<HTMLElement>(`[data-cell="${index}"]`);
      cell?.classList.add('upgrading');
      cell?.style.setProperty('--win-order', String(order));
    });
    if (motion || returning.length) for (const button of root.querySelectorAll<HTMLButtonElement>('[data-cell], [data-choice], [data-piece]')) button.disabled = true;
    root.querySelector('#settings-summary')!.textContent = `${game.mode === 'classic' ? 'Classic' : 'Upgrade'} · ${online ? 'Online' : computer ? `${computer[0].toUpperCase()}${computer.slice(1)} CPU` : 'Pass & play'}`;
    hostButton.disabled = !!online;
    turnLimit.disabled = !!online;
    leaveButton.hidden = !online;
    banner.hidden = !online;
    details.hidden = !online;
    root.classList.toggle('is-online', !!online);
    layout.restartButton.disabled = !!online;
    for (const button of [...layout.modeButtons, ...layout.opponentButtons]) button.disabled = !!online;
    if (online && seat) {
      const rulesSection = details.querySelector('.session-section')!;
      const goalCard = root.querySelector('.goal-card')!;
      if (goalCard.parentElement !== rulesSection) rulesSection.append(goalCard);
      inviteUrl.value = `${window.location.origin}${window.location.pathname}?game=${online.code}`;
      root.querySelector<HTMLInputElement>('#sidebar-invite-url')!.value = inviteUrl.value;
      root.querySelector('#online-code')!.textContent = online.code;
      const mine = canAct();
      banner.classList.toggle('color-0', seat.player === 0);
      banner.classList.toggle('color-1', seat.player === 1);
      root.querySelector('#online-seat')!.textContent = `You are ${names[seat.player]}`;
      root.querySelector('#online-rules')!.textContent = `${game.mode === 'classic' ? 'Classic' : 'Upgrade'} rules`;
      root.querySelector('#online-settings')!.textContent = online.turnSeconds ? `${online.turnSeconds} seconds per turn` : 'No turn time limit';
      root.querySelector('#invite-description')!.textContent = `You are ${names[seat.player]}. Your friend gets ${names[1 - seat.player]}. Send them this link to join your online game.`;
      const turnText = !connected ? 'Connecting to your online game…'
        : !online.joined ? 'Waiting for your opponent to join…'
        : game.winner !== null ? (game.winner === seat.player ? 'You won!' : 'Your opponent won.')
        : busy ? 'Sending your move…'
        : mine ? (game.choices.length ? 'Your turn — choose an upgrade.' : 'Your turn — make your move.')
        : (game.choices.length ? 'Waiting for your opponent to choose an upgrade…' : "Waiting for your opponent’s move…");
      onlineStatus.textContent = turnText;
      layout.turnTitle.textContent = !online.joined ? 'Waiting for opponent' : game.winner !== null ? (game.winner === seat.player ? 'You win' : 'Opponent wins') : mine ? 'Your turn' : 'Opponent’s turn';
      layout.status.textContent = game.winner !== null ? game.message : turnText;
      banner.classList.toggle('is-your-turn', mine);
      layout.boardHeading.classList.toggle('your-turn', mine);
      document.title = mine ? 'Your turn · Empujón' : 'Empujón · Online game';
      if (!mine) for (const button of root.querySelectorAll<HTMLButtonElement>('[data-cell], [data-choice], [data-piece]')) button.disabled = true;
    }
    if (onlineError) onlineStatus.textContent = onlineError;
    showMovement();
    updateClock();
    if (motion) {
      if (!motion.started) {
        motion.started = true;
        const duration = animateMovement(layout.board, motion.after);
        const completed = motion.after;
        motionTimer = setTimeout(() => {
          motion = null;
          render();
          pulseReturnedSupplies(layout.players, completed);
        }, duration);
      }
      return;
    }
    scheduleComputer();
    if (game.winner === null) {
      resultShown = false;
      modals.cancelResult();
    }
    else if (!resultShown) {
      resultShown = true;
      pendingComputer = computer;
      const player = seat?.player ?? (computer ? 0 : null);
      const heading = player === null ? `Congratulations, ${names[game.winner]}!`
        : game.winner === player ? 'Congratulations! You won!' : 'Better luck next time!';
      modals.showResult(game.mode, heading, `${game.message} View the board to analyze the final position, or start a new game.`);
    }
  }

  function startNewGame(mode: Mode): void {
    if (online) {
      window.location.href = window.location.pathname;
      return;
    }
    cancelComputer();
    computer = pendingComputer;
    game = createGame(mode);
    history = [];
    selectedUpgraded = null;
    render();
  }

  const modals = createModals(layout, startNewGame);
  const actions: GameActions = {
    placePiece(index) {
      if (motion || Date.now() < upgradeUntil) return;
      if (touchPreview && touchSelection !== index) {
        touchSelection = index;
        showMovement(index);
        return;
      }
      touchSelection = null;
      touchPreview = false;
      if (online) { void submit({ type: 'place', index, upgraded: selectedUpgraded ?? defaultPieceUpgraded(game) }); return; }
      if (computer && actingPlayer(game) === 1) return;
      const next = place(game, index, selectedUpgraded ?? defaultPieceUpgraded(game));
      if (next === game) return;
      history.push(game);
      playTransition(game, next);
      game = next;
      selectedUpgraded = null;
      render();
    },
    chooseUpgrade(option) {
      if (motion || Date.now() < upgradeUntil) return;
      if (online) { void submit({ type: 'choose', option }); return; }
      if (computer && actingPlayer(game) === 1) return;
      const next = chooseUpgrade(game, option);
      playTransition(game, next);
      game = next;
      selectedUpgraded = null;
      render();
    },
    selectPiece(upgraded) {
      if (motion || !canAct() || (computer && actingPlayer(game) === 1)) return;
      selectedUpgraded = upgraded;
      render();
    },
    requestNewGame(mode = game.mode, opponent = computer) {
      if (online) return;
      pendingComputer = opponent;
      if (game.moves === 0) startNewGame(mode);
      else modals.confirmNewGame(mode);
    },
    undoMove() {
      if (online) return;
      const previous = history.pop();
      if (!previous) return;
      cancelComputer();
      game = previous;
      selectedUpgraded = null;
      render();
    },
    toggleSound() {
      soundEnabled = !soundEnabled;
      if (soundEnabled) sounds.play(['place']);
      else sounds.stop();
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
  const code = new URLSearchParams(window.location.search).get('game');
  if (code) {
    // Lock the local board while resolving an invite, including failed joins.
    connected = false;
    hostButton.disabled = true;
    banner.hidden = false;
    details.hidden = false;
    root.classList.add('is-online');
    root.querySelector('#online-seat')!.textContent = 'Joining online game';
    for (const button of root.querySelectorAll<HTMLButtonElement>('[data-cell], [data-mode], [data-opponent], #restart, #undo')) button.disabled = true;
    leaveButton.hidden = false;
    onlineStatus.textContent = 'Joining game…';
    let token: string | undefined;
    try { token = JSON.parse(localStorage.getItem(`empujon:${code.toUpperCase()}`) ?? 'null')?.token; } catch { /* Missing saved seat. */ }
    void onlineRequest(`/${encodeURIComponent(code)}/join`, { token }).then(connect).catch(error);
  }
}
