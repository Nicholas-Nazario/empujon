export function coordinate(index: number): string {
  return `${'ABCDEF'[index % 6]}${Math.floor(index / 6) + 1}`;
}
