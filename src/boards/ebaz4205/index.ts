import type { BoardDef } from '../types';
import { EbazModel } from './model3d';
import { DEFAULT_NAMES, HEADERS, masterXdc, PINS } from './pins';

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
  // XC7Z010: 17,600 LUTs, 35,200 flip-flops, 60 36 Kb block RAMs; 100 PL I/O in the CLG400 package
  resources: { luts: 17600, ffs: 35200, iob: 100, bram: 60 },
  io: { switches: 0, leds: 2, rgb: [], digits: 0, buttons: [], ledNames: ['LED_R', 'LED_G'] },
  pins: PINS,
  headers: HEADERS,
  defaultNames: DEFAULT_NAMES,
  masterXdc,
  createView: (container) => new EbazModel(container),
};
