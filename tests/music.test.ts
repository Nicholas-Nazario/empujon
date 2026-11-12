import test from 'node:test';
import assert from 'node:assert/strict';
import { createMusicPlayer } from '../src/music/player.ts';
import { musicTracks } from '../src/music/tracks.ts';

class FakeAudio extends EventTarget {
  src = '';
  loop = false;
  currentTime = 0;
  volume = 1;
  preload = '';
  plays = 0;
  pauses = 0;
  nextPlay: () => Promise<void> = () => Promise.resolve();
  play() { this.plays++; return this.nextPlay(); }
  pause() { this.pauses++; }
}
const tracks = [musicTracks[0], { ...musicTracks[0], id: 'second', src: '/music/second.mp3' }];

test('music is paused without loading audio until explicitly played, then plays the included playlist', async () => {
  const audio = new FakeAudio();
  const player = createMusicPlayer(tracks, () => {}, audio);
  assert.equal(player.getState().status, 'paused');
  assert.equal(audio.src, '');
  assert.equal(audio.plays, 0);
  assert.equal(audio.preload, 'none');
  assert.equal(audio.loop, false);
  const pending = player.play();
  assert.equal(player.getState().status, 'loading');
  await pending;
  assert.equal(player.getState().status, 'playing');
  assert.equal(audio.src, tracks[0].src);
  player.pause();
  assert.equal(player.getState().status, 'paused');
});

test('track changes replace playback without overlapping songs', async () => {
  const audio = new FakeAudio();
  const player = createMusicPlayer(tracks, () => {}, audio);
  player.select('missing');
  assert.equal(player.getState().trackId, tracks[0].id);
  await player.play();
  player.select('second');
  await Promise.resolve();
  assert.equal(player.getState().status, 'playing');
  assert.equal(audio.src, tracks[1].src);
  assert.equal(audio.pauses, 1);
  assert.equal(audio.plays, 2);
  player.pause();
  player.select('airoso');
  assert.equal(player.getState().status, 'paused');
  assert.equal(audio.plays, 2);
});

test('late play completion does not override a pause or new playback request', async () => {
  const audio = new FakeAudio();
  let finish!: () => void;
  audio.nextPlay = () => new Promise(resolve => { finish = resolve; });
  const player = createMusicPlayer(tracks, () => {}, audio);
  const pending = player.play();
  player.pause();
  finish(); await pending;
  assert.equal(player.getState().status, 'paused');
});

test('playback errors allow retry and volume is constrained independently', async () => {
  const audio = new FakeAudio();
  audio.nextPlay = () => Promise.reject(new Error('blocked'));
  const player = createMusicPlayer(tracks, () => {}, audio);
  await player.play();
  assert.equal(player.getState().status, 'error');
  audio.nextPlay = () => Promise.resolve();
  await player.play();
  assert.equal(player.getState().status, 'playing');
  audio.dispatchEvent(new Event('error'));
  assert.equal(player.getState().status, 'error');
  player.setVolume(2); assert.equal(audio.volume, 1);
  player.setVolume(-1); assert.equal(audio.volume, 0);
  player.setVolume(.42); player.setVolume(NaN);
  assert.equal(player.getState().volume, .42);
});

test('all songs start included; completion advances and wraps while skipping exclusions', async () => {
  const audio = new FakeAudio();
  const catalog = [...tracks, { ...tracks[0], id: 'third', src: '/music/third.mp3' }];
  const player = createMusicPlayer(catalog, () => {}, audio);
  assert.deepEqual(player.getState().excludedIds, []);
  player.setIncluded('second', false);
  await player.play();
  audio.dispatchEvent(new Event('ended')); await Promise.resolve();
  assert.equal(player.getState().trackId, 'third');
  audio.dispatchEvent(new Event('ended')); await Promise.resolve();
  assert.equal(player.getState().trackId, 'airoso');
  player.setIncluded('airoso', false); await Promise.resolve();
  assert.equal(player.getState().trackId, 'third');
  assert.equal(player.getState().status, 'playing');
});

test('removing every track pauses; re-enabling one permits playback and repeat', async () => {
  const audio = new FakeAudio();
  const player = createMusicPlayer(tracks, () => {}, audio);
  await player.play();
  for(const track of tracks) player.setIncluded(track.id, false);
  assert.equal(player.getState().status, 'paused');
  await player.play(); assert.equal(player.getState().status, 'paused');
  player.setIncluded('second', true);
  assert.equal(player.getState().status, 'paused');
  assert.equal(player.getState().trackId, 'second');
  await player.play(); audio.currentTime = 90;
  audio.dispatchEvent(new Event('ended')); await Promise.resolve();
  assert.equal(audio.currentTime, 0);
  assert.equal(player.getState().status, 'playing');
  const snapshot = player.getState(); snapshot.excludedIds.push('second');
  assert.deepEqual(player.getState().excludedIds, ['airoso']);
});
