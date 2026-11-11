/** Display names follow the stone colors; shared game state keeps stable players. */
export const playerNames = ['Terracotta', 'Adoquín'] as const;

export function playerMessage(message: string): string {
  return message.replace(/Terracotta|Indigo/g, name => playerNames[name === 'Terracotta' ? 0 : 1]);
}
