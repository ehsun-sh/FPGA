// Names of the board parts that lesson text can point at (see part() in src/lessons/helpers.ts), per board.
import { expandEbazParts } from './ebaz4205/parts';
import { expandNexysParts } from './nexys-a7/parts';

export function expandParts(names: string[], board = 'nexys-a7-100t'): string[] {
  return board === 'ebaz4205' ? expandEbazParts(names) : expandNexysParts(names);
}
