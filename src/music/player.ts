import type { MusicTrack } from './tracks.ts';

export type MusicState = { trackId: string; volume: number; status: 'paused' | 'loading' | 'playing' | 'error'; excludedIds: string[] };
type MusicAudio = Pick<HTMLAudioElement, 'src' | 'loop' | 'volume' | 'preload' | 'currentTime' | 'play' | 'pause' | 'addEventListener'>;

/** One audio element plays included tracks in order, wrapping at the end. */
export function createMusicPlayer(tracks: readonly MusicTrack[], onChange: (state: MusicState) => void, audio: MusicAudio = new Audio()) {
  if (!tracks.length) throw new Error('Music requires at least one track.');
  let state: MusicState = { trackId: tracks[0].id, volume: .3, status: 'paused', excludedIds: [] };
  let request = 0;
  audio.preload = 'none';
  audio.loop = false;
  audio.volume = state.volume;
  const snapshot = () => ({ ...state, excludedIds: [...state.excludedIds] });
  const emit = () => onChange(snapshot());
  const included = () => tracks.filter(track => !state.excludedIds.includes(track.id));
  const pause = () => { request++; audio.pause(); state.status = 'paused'; emit(); };
  const play = async () => {
    if (!included().length) { pause(); return; }
    const current = ++request;
    if (!audio.src || state.status === 'error') audio.src = tracks.find(track => track.id === state.trackId)!.src;
    state.status = 'loading'; emit();
    try {
      await audio.play();
      if (current !== request) return;
      state.status = 'playing'; emit();
    } catch {
      if (current !== request) return;
      state.status = 'error'; emit();
    }
  };
  const select = (trackId: string) => {
    const track = included().find(track => track.id === trackId);
    if (!track || trackId === state.trackId) return;
    const resume = state.status === 'playing' || state.status === 'loading';
    pause(); state.trackId = trackId; audio.src = track.src; emit();
    if (resume) void play();
  };
  const next = () => {
    const available = included();
    if (!available.length) { pause(); return; }
    const index = tracks.findIndex(track => track.id === state.trackId);
    const track = tracks.slice(index + 1).concat(tracks.slice(0, index + 1)).find(track => available.includes(track))!;
    if (track.id === state.trackId) { audio.currentTime = 0; void play(); }
    else select(track.id);
  };
  audio.addEventListener('ended', () => { if (state.status === 'playing') next(); });
  audio.addEventListener('error', () => {
    if (state.status === 'paused') return;
    request++; audio.pause(); state.status = 'error'; emit();
  });
  return {
    getState: snapshot,
    play, pause, select, next,
    setIncluded(trackId: string, enabled: boolean) {
      if (!tracks.some(track => track.id === trackId)) return;
      state.excludedIds = state.excludedIds.filter(id => id !== trackId);
      if (!enabled) state.excludedIds.push(trackId);
      if (!included().length) pause();
      else if (state.excludedIds.includes(state.trackId)) next();
      emit();
    },
    setVolume(volume: number) {
      if (!Number.isFinite(volume)) return;
      state.volume = Math.min(1, Math.max(0, volume)); audio.volume = state.volume; emit();
    },
  };
}
