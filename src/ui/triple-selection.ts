import type { Choice } from '../game.ts';

/** Repeated taps on a shared piece cycle through its complete triples. */
export function tripleSelectionAt(choice: Choice | undefined, index: number, selected: number | null = null): number | null {
  if (choice?.kind !== 'line') return null;
  const options = choice.options.flatMap((cells, option) => cells.includes(index) ? [option] : []);
  if (!options.length) return null;
  const current = selected === null ? -1 : options.indexOf(selected);
  return options[(current + 1) % options.length];
}
