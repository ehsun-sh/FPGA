import type { BoardDef } from '../types';
import { EbazModel } from './model3d';
import { HEADERS, KEYS, masterXdc, namesFor, pinsFor } from './pins';

const CORE_IO: BoardDef['io'] = { switches: 0, leds: 2, rgb: [], digits: 0, buttons: [], ledNames: ['LED_R', 'LED_G'] };
// with the extension board: LED1-LED3 follow the two core LEDs, and its keys
const EXT_IO: BoardDef['io'] = { ...CORE_IO, leds: 5, buttons: KEYS.map(([n]) => n), ledNames: ['LED_R', 'LED_G', 'LED1', 'LED2', 'LED3'] };

export const ebaz4205: BoardDef = {
  id: 'ebaz4205',
  name: 'EBAZ4205',
  vendor: 'Ebit (Zynq-7010)',
  part: 'xc7z010clg400-1',
  clockHz: 50e6,
  internalClock: { port: 'clk', source: 'FCLK_CLK0', hz: 50e6 },
  jtag: 'localhost/xilinx_tcf/JTAG',
  note: { fa: 'برد ارزان Zynq با برد توسعه', en: 'Low-cost Zynq board with an extension board' },
  limits: {
    fa: 'پردازنده‌ی ARM (بخش PS) شبیه‌سازی نمی‌شود؛ فقط منطق PL روی برد سه‌بعدی اجرا می‌شود.',
    en: 'The ARM processor (the PS) is not simulated; only the PL logic runs on the 3D board.',
  },
  extension: { attached: true, label: { fa: 'برد توسعه', en: 'Extension board' } },
  // XC7Z010: 17,600 LUTs, 35,200 flip-flops, 60 36 Kb block RAMs; 100 PL I/O in the CLG400 package
  resources: { luts: 17600, ffs: 35200, iob: 100, bram: 60 },
  io: EXT_IO,
  pins: pinsFor(true),
  headers: HEADERS,
  defaultNames: namesFor(true),
  masterXdc,
  createView: (container) => new EbazModel(container, ebaz4205.extension!.attached),
};

// Plugs the extension board in or takes it off (store key "ebaz-ext", read once at start-up: the board is fixed for a
// page load). Without it the header pins are plain DATA pins again.
export function setEbazExtension(on: boolean) {
  ebaz4205.extension!.attached = on;
  ebaz4205.io = on ? EXT_IO : CORE_IO;
  ebaz4205.pins = pinsFor(on);
  ebaz4205.defaultNames = namesFor(on);
}
