import type { BoardDef } from '../types';
import { NexysA7Model } from './model3d';
import { DEFAULT_NAMES, HEADERS, masterXdc, PINS } from './pins';

export const nexysA7: BoardDef = {
  id: 'nexys-a7-100t',
  name: 'Nexys A7-100T',
  vendor: 'Digilent',
  part: 'xc7a100tcsg324-1',
  clockHz: 100e6,
  resources: { luts: 63400, ffs: 126800, iob: 210, bram: 135 },
  io: {
    switches: 16,
    leds: 16,
    rgb: ['LD16', 'LD17'],
    digits: 8,
    buttons: ['BTNC', 'BTNU', 'BTNL', 'BTNR', 'BTND'],
    reset: 'CPU_RESETN',
  },
  pins: PINS,
  headers: HEADERS,
  defaultNames: DEFAULT_NAMES,
  masterXdc,
  createView: (container) => new NexysA7Model(container),
};
