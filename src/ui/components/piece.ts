import { renderIcon } from '../icons.ts';
import type { Player } from '../../game.ts';

export function renderPiece(owner: Player, upgraded = false): string {
  const upgradeClass = upgraded ? ' upgraded' : '';
  return `<span class="piece p${owner}${upgradeClass}" aria-hidden="true">${upgraded ? renderIcon('upgrade') : ''}</span>`;
}

export function coordinate(index: number): string {
  return `${'ABCDEF'[index % 6]}${Math.floor(index / 6) + 1}`;
}
