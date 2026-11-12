import { difficultyNames, type Difficulty } from '../../ai.ts';
import { renderIcon } from '../icons.ts';
import { names, type Game, type Player } from '../../game.ts';
import { renderPiece } from './piece.ts';

function renderPiecePicker(baseCount: number, upgradedCount: number, selectedUpgraded: boolean): string {
  return `
    <div class="piece-picker" role="group" aria-label="Piece to place">
      <button data-piece="base" ${baseCount ? '' : 'disabled'}
        class="${selectedUpgraded ? '' : 'chosen'}">Base · ${baseCount}</button>
      <button data-piece="upgraded" ${upgradedCount ? '' : 'disabled'}
        class="${selectedUpgraded ? 'chosen' : ''}">${renderIcon('upgrade')} Upgraded · ${upgradedCount}</button>
    </div>`;
}

function renderPlayer(game: Game, owner: Player, activePlayer: Player, selectedUpgraded: boolean, computer: Difficulty | null, reviewing: boolean): string {
  const supply = game.pools[owner];
  const onBoard = game.board.filter(piece => piece?.owner === owner).length;
  const upgradedInSupply = supply.filter(piece => piece.upgraded).length;
  const totalUpgraded = upgradedInSupply + game.board.filter(piece => piece?.owner === owner && piece.upgraded).length;
  const isActive = owner === activePlayer;
  const badge = isActive
    ? `<span class="turn-badge">${game.winner !== null ? 'WINNER' : reviewing ? 'NEXT' : 'TO PLAY'}</span>`
    : '';
  const canSelectPiece = !reviewing && !(computer && owner === 1) && game.mode === 'upgrade' && owner === game.turn
    && !game.choices.length && game.winner === null;
  const supplyPieces = supply.map(piece => renderPiece(owner, piece.upgraded)).join('');
  const placeholders = Array.from({ length: onBoard }, () => '<span class="empty-piece"></span>').join('');

  return `
    <section class="player-card ${isActive ? 'current' : ''} color-${owner}">
      <div class="player-title">
        ${renderPiece(owner)}
        <div><span class="tiny-label">${computer ? (owner === 0 ? 'YOU' : `${difficultyNames[computer].toUpperCase()} AI`) : `PLAYER ${owner + 1}`} </span><h3>${names[owner]}</h3></div>
        ${badge}
      </div>
      <div class="player-stats"><span>On the board</span><strong>${onBoard}<span> / 8</span></strong></div>
      <div class="supply" aria-label="${supply.length} pieces in supply">${supplyPieces}${placeholders}</div>
      <p class="supply-label">
        ${supply.length} in supply${game.mode === 'upgrade' ? ` · ${totalUpgraded} upgraded` : ''}
      </p>
      ${canSelectPiece ? renderPiecePicker(supply.length - upgradedInSupply, upgradedInSupply, selectedUpgraded) : ''}
    </section>`;
}

export function renderPlayers(game: Game, activePlayer: Player, selectedUpgraded: boolean, computer: Difficulty | null = null, reviewing = false): string {
  return ([0, 1] as const).map(owner => renderPlayer(game, owner, activePlayer, selectedUpgraded, computer, reviewing)).join('');
}
