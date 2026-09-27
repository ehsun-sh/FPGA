import { nexysA7 } from './nexys-a7';
import type { BoardDef } from './types';

export type { BoardDef, BoardOutputs, BoardView, Device, XdcGroup } from './types';

// Add new boards here.
export const BOARDS: BoardDef[] = [nexysA7];

export const DEFAULT_BOARD = nexysA7;

export function getBoard(id: string | null | undefined): BoardDef {
  return BOARDS.find((b) => b.id === id) ?? DEFAULT_BOARD;
}
