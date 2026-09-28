import { nexysA7 } from './nexys-a7';
import type { BoardDef, Device } from './types';

export type { BoardDef, BoardOutputs, BoardView, Device, XdcGroup } from './types';

// Add new boards here.
export const BOARDS: BoardDef[] = [nexysA7];

export const DEFAULT_BOARD = nexysA7;

export function getBoard(id: string | null | undefined): BoardDef {
  return BOARDS.find((b) => b.id === id) ?? DEFAULT_BOARD;
}

// Silkscreen-style name of an on-board device, e.g. "LD3", "SW0", "JA1".
export function deviceLabel(d: Device, board: BoardDef): string {
  switch (d.kind) {
    case 'sw':
      return `SW${d.index}`;
    case 'led':
      return `LD${d.index}`;
    case 'an':
      return `AN${d.index}`;
    case 'seg':
      return `C${d.seg.toUpperCase()}`;
    case 'rgb':
      return `${board.io.rgb[d.index]} ${d.color.toUpperCase()}`;
    case 'clk':
      return `${board.clockHz / 1e6} MHz oscillator`;
    default:
      return d.name;
  }
}

// Devices that drive an FPGA input.
export function isBoardInput(d: Device): boolean {
  return d.kind === 'sw' || d.kind === 'btn' || d.kind === 'clk' || d.kind === 'reset' || (d.kind === 'uart' && d.dir === 'in');
}
