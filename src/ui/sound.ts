import type { Game, Player } from '../game.ts';

export type SoundCue = 'place' | 'place-upgraded' | 'push' | 'upgrade' | 'win' | 'lose';

function upgradedCount(game: Game): number {
  return [...game.board, ...game.pools.flat()].filter(piece => piece?.upgraded).length;
}

/** Describe actual changes, including automatic upgrades and off-board pushes. */
export function transitionSounds(before: Game, after: Game, listener: Player | null): SoundCue[] {
  if (before === after) return [];
  const cues: SoundCue[] = [];
  if (after.moves > before.moves && after.last !== null) {
    const row = Math.floor(after.last / 6), col = after.last % 6;
    // An automatic line reward can already have removed the placed piece.
    // Account for base pieces pushed back into the mover's supply in that case.
    const returnedBase = before.board.filter((piece, index) => {
      const dr = Math.floor(index / 6) - row, dc = index % 6 - col;
      return piece?.owner === before.turn && !piece.upgraded
        && Math.abs(dr) <= 1 && Math.abs(dc) <= 1 && (dr !== 0 || dc !== 0)
        && (row + 2 * dr < 0 || row + 2 * dr > 5 || col + 2 * dc < 0 || col + 2 * dc > 5);
    }).length;
    const baseCount = (game: Game) => game.pools[before.turn].filter(piece => !piece.upgraded).length;
    const placedUpgraded = after.board[after.last]?.upgraded
      ?? baseCount(after) === baseCount(before) + returnedBase;
    cues.push(placedUpgraded ? 'place-upgraded' : 'place');
    const pushed = before.board.some((piece, index) => {
      if (!piece) return false;
      const dr = Math.floor(index / 6) - row, dc = index % 6 - col;
      if ((!dr && !dc) || Math.abs(dr) > 1 || Math.abs(dc) > 1) return false;
      if (before.mode === 'upgrade' && piece.upgraded && !placedUpgraded) return false;
      const tr = row + 2 * dr, tc = col + 2 * dc;
      return tr < 0 || tr > 5 || tc < 0 || tc > 5 || !before.board[tr * 6 + tc];
    });
    if (pushed) cues.push('push');
  }
  if (upgradedCount(after) > upgradedCount(before)) cues.push('upgrade');
  if (before.winner === null && after.winner !== null) {
    cues.push(listener !== null && after.winner !== listener ? 'lose' : 'win');
  }
  return cues;
}

/** Small synthesized sounds: no downloads, with audio failure isolated from play. */
export function createGameSound() {
  let audio: AudioContext | undefined;
  let master: GainNode | undefined;
  function unlock(): void {
    try {
      if (!audio) {
        audio = new AudioContext();
        master = audio.createGain();
        master.gain.value = 0.45;
        master.connect(audio.destination);
      }
      void audio.resume().catch(() => undefined);
    } catch { /* Web Audio is optional. */ }
  }
  function tone(frequency: number, end: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine') {
    const oscillator = audio!.createOscillator();
    const gain = audio!.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(end, start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(master!);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }
  function slide(start: number): void {
    const duration = 0.19;
    const buffer = audio!.createBuffer(1, Math.ceil(audio!.sampleRate * duration), audio!.sampleRate);
    const samples = buffer.getChannelData(0);
    // Gentle continuous friction with a rounded start and finish.
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.random() * 2 - 1;
    }
    const source = audio!.createBufferSource();
    const filter = audio!.createBiquadFilter();
    const gain = audio!.createGain();
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.Q.value = 0.45;
    filter.frequency.setValueAtTime(950, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.19, start + 0.045);
    gain.gain.linearRampToValueAtTime(0.14, start + 0.11);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master!);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    source.start(start);
  }
  return {
    unlock,
    stop(): void {
      // Muting also silences phrases already scheduled on the audio clock.
      if (audio && master) master.gain.setValueAtTime(0, audio.currentTime);
    },
    play(cues: SoundCue[]): void {
      try {
        unlock();
        if (!audio || !master) return;
        master.gain.setValueAtTime(0.45, audio.currentTime);
        let start = audio.currentTime + 0.015;
        for (const cue of cues) {
          if (cue === 'place' || cue === 'place-upgraded') {
            // Same contact, envelope, and harmonic balance; a fifth apart.
            const pitch = cue === 'place-upgraded' ? 1.5 : 1;
            tone(240 * pitch, 95 * pitch, start, 0.11, 0.24);
            tone(780 * pitch, 340 * pitch, start, 0.035, 0.07, 'triangle');
            start += 0.065;
          } else if (cue === 'push') {
            slide(start);
            start += 0.21;
          } else if (cue === 'upgrade') {
            // A single sparkling bloom, rather than a melodic victory phrase.
            tone(880, 1320, start, 0.18, 0.10);
            tone(1760, 2640, start + 0.025, 0.20, 0.045);
            tone(2217.46, 2217.46, start + 0.065, 0.22, 0.035);
            start += 0.30;
          } else if (cue === 'win') {
            // A rhythmic fanfare resolving into a sustained major chord.
            const notes = [392, 392, 523.25, 659.25];
            const offsets = [0, 0.12, 0.30, 0.48];
            notes.forEach((note, index) => tone(note, note, start + offsets[index], 0.22, 0.13, 'triangle'));
            for (const note of [523.25, 659.25, 783.99]) {
              tone(note, note, start + 0.72, 0.65, 0.085, 'triangle');
            }
            start += 1.4;
          } else {
            [392, 349.23, 261.63].forEach((note, index) => tone(note, note, start + index * 0.14, 0.28, 0.12));
            start += 0.42;
          }
        }
      } catch { /* Sound must never interrupt a move. */ }
    },
  };
}
