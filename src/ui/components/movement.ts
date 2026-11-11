import { names, type Movement } from '../../game.ts';
import { coordinate } from './coordinate.ts';

/** Overlay coordinates scale with the board, including on small screens. */
export function renderMovement(movement: Movement | null, preview: boolean): { svg: string; description: string } {
  if (!movement) return { svg: '', description: 'Hover or focus an empty square to preview its pushes.' };
  const x = (i: number) => (i % 6) * 100 + 50;
  const y = (i: number) => Math.floor(i / 6) * 100 + 50;
  const { placement, pushes } = movement;
  const arrows = pushes.map(({ owner, from, to, dr, dc }) => {
    const endX = to === null ? x(from) + dc * 42 : x(to);
    const endY = to === null ? y(from) + dr * 42 : y(to);
    // A short direction cue near the cell edge, rather than a full movement path.
    const length = Math.hypot(dr, dc);
    const ux = dc / length, uy = dr / length;
    const midX = to === null ? x(from) + ux * 18 : (x(from) + endX) / 2;
    const midY = to === null ? y(from) + uy * 18 : (y(from) + endY) / 2;
    const halfLength = to === null ? 9 : 14;
    return `<g class="${to === null ? 'push-off' : 'push-destination'}"><line x1="${midX - ux * halfLength}" y1="${midY - uy * halfLength}" x2="${midX + ux * halfLength}" y2="${midY + uy * halfLength}" marker-end="url(#push-arrow)"/>${to === null
      ? `<text class="color-${owner}" x="${endX}" y="${endY}" dy="6" text-anchor="middle">×</text>`
      : ''}</g>`;
  }).join('');
  const description = `${preview ? 'Preview' : 'Last move'}: ${preview ? 'place at' : `${names[movement.owner]} placed at`} ${coordinate(placement)}. `
    + (pushes.length ? pushes.map(({ from, to }) => `${coordinate(from)} → ${to === null ? 'off board (returns to supply)' : coordinate(to)}`).join('; ') + '.' : 'No pieces pushed.');
  return {
    svg: `<svg viewBox="0 0 600 600" aria-hidden="true"><defs><marker id="push-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3" markerHeight="3" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"/></marker></defs>${arrows}</svg>`,
    description,
  };
}
