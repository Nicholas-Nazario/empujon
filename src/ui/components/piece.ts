import { renderIcon } from '../icons.ts';
import type { Player } from '../../game.ts';

export function renderPiece(owner: Player, upgraded = false): string {
  const upgradeClass = upgraded ? ' upgraded' : '';
  return `<span class="piece p${owner}${upgradeClass}" aria-hidden="true">${upgraded ? renderIcon('upgrade') : ''}</span>`;
}

export { coordinate } from './coordinate.ts';
