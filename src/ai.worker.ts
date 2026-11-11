import { computerAction, type Difficulty } from './ai.ts';
import type { Game } from './game.ts';

self.onmessage = (event: MessageEvent<{ game: Game; difficulty: Difficulty }>) => {
  self.postMessage(computerAction(event.data.game, event.data.difficulty));
};
