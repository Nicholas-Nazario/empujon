import { musicTracks } from '../music/tracks.ts';
import { createMusicPlayer, type MusicState } from '../music/player.ts';
import { renderIcon } from './icons.ts';

/** Mount once so volume, track controls, and keyboard focus survive game renders. */
export function setupMusic(root: HTMLElement): void {
  const dialog = root.querySelector<HTMLElement>('#music-dialog')!;
  const open = root.querySelector<HTMLButtonElement>('#music-open')!;
  const play = root.querySelector<HTMLButtonElement>('#music-play')!;
  const status = root.querySelector<HTMLElement>('#music-status')!;
  const volume = root.querySelector<HTMLInputElement>('#music-volume')!;
  const output = root.querySelector<HTMLOutputElement>('#music-volume-value')!;
  const tracks = root.querySelector<HTMLElement>('#music-tracks')!;
  const announcement = root.querySelector<HTMLElement>('#music-announcement')!;
  let lastAnnounced = '';
  let iconName = '';
  let announcementTimer: ReturnType<typeof setTimeout> | undefined;
  let announcementAnimation: Animation | undefined;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function positionAnnouncement(): void {
    const icon = open.getBoundingClientRect();
    const beside = icon.left >= 164;
    const width = Math.min(260, beside ? icon.left - 24 : innerWidth - 32);
    announcement.style.width = `${width}px`;
    announcement.style.left = `${beside ? icon.left - width - 8 : 16}px`;
    announcement.style.top = `${beside ? Math.max(8, icon.top) : icon.bottom + 8}px`;
  }
  function hideAnnouncement(): void {
    clearTimeout(announcementTimer);
    announcementAnimation?.cancel();
    announcement.hidePopover();
  }
  function announceTrack(track: typeof musicTracks[number]): void {
    hideAnnouncement();
    root.querySelector('#music-announcement-title')!.textContent = track.title;
    root.querySelector('#music-announcement-composer')!.textContent = track.composer;
    positionAnnouncement();
    announcement.showPopover();
    if (reducedMotion.matches) announcementTimer = setTimeout(hideAnnouncement, 4200);
    else {
      announcementAnimation = announcement.animate([
        { opacity: 0, transform: 'translateX(12px)', offset: 0 },
        { opacity: 1, transform: 'translateX(0)', offset: .06 },
        { opacity: 1, transform: 'translateX(0)', offset: .9 },
        { opacity: 0, transform: 'translateX(8px)', offset: 1 },
      ], { duration: 4200, easing: 'ease-out', fill: 'both' });
      announcementAnimation.onfinish = hideAnnouncement;
    }
  }
  for (const event of ['resize', 'scroll']) window.addEventListener(event, () => {
    if (announcement.matches(':popover-open')) positionAnnouncement();
  }, { passive: true });
  reducedMotion.addEventListener('change', hideAnnouncement);
  // Keep every track’s attribution available alongside its inclusion control.
  tracks.innerHTML = musicTracks.map(track => `<article class="music-track">
    <div class="music-track-row"><label class="music-track-choice"><input type="checkbox" name="music-track" value="${track.id}" aria-label="Include ${track.title}"><span><strong>${track.title}</strong><span>${track.composer}</span></span></label>
    <button class="music-track-play icon-button" data-play-track="${track.id}" aria-label="Play ${track.title}">${renderIcon('play')}</button></div>
    <details class="music-track-credits"><summary>Credits &amp; license</summary>
    <dl class="music-credits">
      <div><dt>Composer</dt><dd><a href="${track.composerUrl}" target="_blank" rel="noopener noreferrer">${track.composer}</a></dd></div>
      <div><dt>License</dt><dd><a href="${track.licenseUrl}" target="_blank" rel="noopener noreferrer">${track.license}</a></dd></div>
    </dl>
    <p class="music-provider">Music powered by <a href="${track.providerUrl}" target="_blank" rel="noopener noreferrer">${track.provider}</a></p>
    </details>
  </article>`).join('');
  function update(state: MusicState): void {
    const active = state.status === 'playing' || state.status === 'loading';
    const track = musicTracks.find(track => track.id === state.trackId)!;
    const nextIcon = active ? 'music' : 'music-off';
    if (iconName !== nextIcon) { open.innerHTML = renderIcon(nextIcon); iconName = nextIcon; }
    open.classList.toggle('music-playing', state.status === 'playing');
    if (state.status === 'playing' && lastAnnounced !== track.id) {
      lastAnnounced = track.id;
      announceTrack(track);
    } else if (!active) hideAnnouncement();
    open.title = active ? `Music: ${track.title} · open music settings` : 'Choose background music';
    play.textContent = active ? 'Pause music' : state.status === 'error' ? 'Try again' : 'Play music';
    play.setAttribute('aria-pressed', String(active));
    play.disabled = state.excludedIds.length === musicTracks.length;
    root.querySelector<HTMLButtonElement>('#music-next')!.disabled = play.disabled;
    status.textContent = play.disabled ? 'Select at least one track to play.' : state.status === 'error' ? 'Unable to play this track. Please try again.'
      : state.status === 'loading' ? `Loading ${track.title}…`
      : state.status === 'playing' ? `Playing ${track.title}` : 'Music is paused.';
    volume.value = String(Math.round(state.volume * 100));
    output.value = `${volume.value}%`;
    tracks.querySelectorAll<HTMLInputElement>('input').forEach(input => { input.checked = !state.excludedIds.includes(input.value);
      input.closest('.music-track')?.classList.toggle('is-current', input.value === state.trackId && active); });
  }
  const player = createMusicPlayer(musicTracks, update);
  try {
    const saved = JSON.parse(localStorage.getItem('empujon:music') ?? 'null');
    if (Array.isArray(saved?.excludedIds)) for (const id of saved.excludedIds) if (typeof id === 'string') player.setIncluded(id, false);
    if (saved && typeof saved.trackId === 'string') player.select(saved.trackId);
    if (saved && typeof saved.volume === 'number') player.setVolume(saved.volume);
  } catch { /* Defaults work when storage is unavailable. */ }
  const save = () => {
    const { trackId, volume, excludedIds } = player.getState();
    try { localStorage.setItem('empujon:music', JSON.stringify({ trackId, volume, excludedIds })); } catch { /* Keep session settings. */ }
  };
  update(player.getState());
  dialog.addEventListener('toggle', () => open.setAttribute('aria-expanded', String(dialog.matches(':popover-open'))));
  root.querySelector('#music-close')!.addEventListener('click', () => dialog.hidePopover());
  root.querySelector('#music-next')!.addEventListener('click', () => { player.next(); save(); });
  play.addEventListener('click', () => {
    const { status } = player.getState();
    if (status === 'playing' || status === 'loading') player.pause();
    else void player.play();
  });
  volume.addEventListener('input', () => { player.setVolume(Number(volume.value) / 100); save(); });
  tracks.addEventListener('change', event => {
    if (event.target instanceof HTMLInputElement) { player.setIncluded(event.target.value, event.target.checked); save(); }
  });
  tracks.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-play-track]') : null;
    if (!button) return;
    const id = button.dataset.playTrack!;
    player.pause(); player.setIncluded(id, true); player.select(id); void player.play(); save();
  });
  window.addEventListener('pagehide', () => { player.pause(); hideAnnouncement(); });
}
