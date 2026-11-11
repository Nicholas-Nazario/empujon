/** Lazily creates audio after a user action. Audio failure must not stop play. */
export function createMoveSound() {
  let audio: AudioContext | undefined;
  return {
    play(): void {
      try {
        audio ??= new AudioContext();
        void audio.resume().catch(() => undefined);
        const oscillator = audio.createOscillator();
        const gain = audio.createGain();
        oscillator.connect(gain);
        gain.connect(audio.destination);
        oscillator.frequency.setValueAtTime(420, audio.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(220, audio.currentTime + 0.08);
        gain.gain.setValueAtTime(0.07, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.12);
        oscillator.start();
        oscillator.stop(audio.currentTime + 0.13);
      } catch {
        // Sound is optional on devices without Web Audio.
      }
    },
  };
}
