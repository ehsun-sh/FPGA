import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../src/boards';
import { mapPorts } from '../src/boards/mapping';
import { synthesize } from '../src/hdl';
import { ALL_LESSONS } from '../src/lessons/course';
import { UartStream } from '../src/serial/console';
import { Runner } from '../src/sim/runner';

const F = { baud: 115200, bits: 8, parity: 'none' as const, stop: 1 as const };

describe('serial console', () => {
  it('decodes a live UART stream, including a byte of all ones', () => {
    const got: number[] = [];
    const s = new UartStream(F, 100e6);
    s.onByte = (b) => got.push(b);
    const T = 100e6 / 115200;
    let t = 1000;
    for (const byte of [0x41, 0xff, 0x00]) {
      const bits = [0, ...Array.from({ length: 8 }, (_, k) => (byte >> k) & 1), 1];
      bits.forEach((b, k) => s.edge(Math.round(t + k * T), b));
      t += 10 * T;
    }
    s.advance(t + T);
    expect(got).toEqual([0x41, 0xff, 0x00]);
  });

  it('types into the echo lesson and reads the answer back', () => {
    for (const lang of ['verilog', 'vhdl'] as const) {
      const l = ALL_LESSONS.find((x) => x.id === 'uart_rx')!;
      const d = synthesize(lang === 'verilog' ? l.verilog : l.vhdl, lang);
      const map = mapPorts(d, DEFAULT_BOARD.masterXdc(l.xdc), DEFAULT_BOARD);
      const r = new Runner(DEFAULT_BOARD);
      r.program(d, map, { switches: [], pressed: () => false });
      const tx = map.bindings.find((b) => b.device.kind === 'uart' && b.device.dir === 'out')!;
      const got: number[] = [];
      const s = new UartStream(F, 100e6);
      s.onByte = (b) => got.push(b);
      r.setProbe('serial', { sigs: [tx.sig], onSample: (t) => s.edge(t, (r.sim!.v[tx.sig] >>> tx.bit) & 1) });
      expect(r.sendSerial([...new TextEncoder().encode('fpga ok')], F)).toBe(true);
      for (let i = 0; i < 400 && r.totalCycles < 1_200_000; i++) r.frame(1 / 60);
      s.advance(r.now);
      expect(new TextDecoder().decode(new Uint8Array(got)), lang).toBe('FPGA OK');
    }
  });
});
