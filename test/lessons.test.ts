import { describe, expect, it } from 'vitest';
import { mapPorts } from '../src/board/mapping';
import { compileDesign, synthesize } from '../src/hdl';
import { ALL_LESSONS } from '../src/lessons/lessons';

type Harness = ReturnType<typeof harness>;

function harness(src: string, lang: 'verilog' | 'vhdl', xdc: string) {
  const d = synthesize(src, lang);
  const map = mapPorts(d, xdc);
  const errors = map.messages.filter((m) => m.level === 'error');
  if (errors.length) throw new Error(errors.map((e) => e.msg).join('\n'));
  const sim = compileDesign(d, { clock: map.clock });
  sim.reset();
  const bind = (pred: (b: (typeof map.bindings)[number]) => boolean) => map.bindings.filter(pred);
  const setDev = (pred: (b: (typeof map.bindings)[number]) => boolean, val: number) => {
    for (const b of bind(pred)) {
      const m = (1 << b.bit) >>> 0;
      sim.v[b.sig] = val ? (sim.v[b.sig] | m) >>> 0 : (sim.v[b.sig] & ~m) >>> 0;
    }
    sim.settle();
  };
  const readDev = (pred: (b: (typeof map.bindings)[number]) => boolean) => bind(pred).map((b) => (sim.v[b.sig] >>> b.bit) & 1);
  return {
    d,
    map,
    sim,
    sw(v: number) {
      for (let i = 0; i < 16; i++) setDev((b) => b.device.kind === 'sw' && b.device.index === i, (v >> i) & 1);
    },
    btn(name: string, v: number) {
      setDev((b) => b.device.kind === 'btn' && b.device.name === name, v);
    },
    reset(v: number) {
      setDev((b) => b.device.kind === 'reset', v);
    },
    led(): number {
      let r = 0;
      for (const b of map.bindings) if (b.device.kind === 'led' && ((sim.v[b.sig] >>> b.bit) & 1)) r |= 1 << b.device.index;
      return r;
    },
    seg(): number {
      const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
      let r = 0;
      for (const b of map.bindings) if (b.device.kind === 'seg' && b.device.seg !== 'dp' && ((sim.v[b.sig] >>> b.bit) & 1)) r |= 1 << order.indexOf(b.device.seg);
      return r;
    },
    an(): number {
      let r = 0;
      for (const b of map.bindings) if (b.device.kind === 'an' && ((sim.v[b.sig] >>> b.bit) & 1)) r |= 1 << b.device.index;
      return r;
    },
    rgb16(): number[] {
      return ['r', 'g', 'b'].map((c) => readDev((b) => b.device.kind === 'rgb' && b.device.index === 16 && b.device.color === c)[0] ?? 0);
    },
  };
}

const HEX = [0x40, 0x79, 0x24, 0x30, 0x19, 0x12, 0x02, 0x78, 0x00, 0x10, 0x08, 0x03, 0x46, 0x21, 0x06, 0x0e];

const checks: Record<string, (h: Harness) => void> = {
  intro(h) {
    h.sw(0xa5c3);
    expect(h.led()).toBe(0xa5c3);
  },
  gates(h) {
    for (let v = 0; v < 4; v++) {
      const a = v & 1;
      const b = (v >> 1) & 1;
      const outs = [a & b, a | b, a ^ 1, (a & b) ^ 1, (a | b) ^ 1, a ^ b, a ^ b ^ 1];
      h.sw(v);
      expect(h.led(), `sw=${v}`).toBe(outs.reduce((r, o, i) => r | (o << i), 0));
    }
  },
  mux(h) {
    h.sw(0b01);
    expect(h.led() & 1).toBe(1);
    h.sw(0b01 | 0x8000);
    expect(h.led() & 1).toBe(0);
    h.sw(0b0100 | (2 << 4));
    expect((h.led() >> 1) & 1).toBe(1);
    h.sw(0b1011 | (2 << 4));
    expect((h.led() >> 1) & 1).toBe(0);
  },
  adder(h) {
    for (const [a, b, c] of [
      [5, 3, 0],
      [15, 15, 1],
      [9, 8, 1],
    ]) {
      h.sw(a | (b << 4) | (c << 8));
      const s = a + b + c;
      expect(h.led() & 0x1f).toBe(s);
      expect((h.led() >> 8) & 0x1f).toBe(s);
    }
  },
  seg7(h) {
    for (let v = 0; v < 16; v++) {
      h.sw(v);
      expect(h.seg(), `digit ${v}`).toBe(HEX[v]);
      expect(h.an()).toBe(0xfe);
    }
  },
  ff(h) {
    h.reset(1);
    h.sw(0x1234);
    h.sim.run(3);
    expect(h.led()).toBe(0);
    h.btn('BTNC', 1);
    h.sim.run(2);
    h.btn('BTNC', 0);
    h.sw(0xffff);
    h.sim.run(5);
    expect(h.led()).toBe(0x1234);
    h.reset(0);
    h.sim.run(1);
    expect(h.led()).toBe(0);
  },
  counter(h) {
    h.reset(1);
    h.sim.run(50_000_000);
    expect(h.led()).toBe(0x0101);
    h.sim.run(50_000_000);
    expect(h.led()).toBe(0x0200);
  },
  multiplex(h) {
    h.sw(0x3a7f);
    const seen = new Map<number, number>();
    for (let k = 0; k < 4; k++) {
      seen.set(h.an(), h.seg());
      h.sim.run(1 << 16);
    }
    expect(seen.get(0xfe)).toBe(HEX[0xf]);
    expect(seen.get(0xfd)).toBe(HEX[0x7]);
    expect(seen.get(0xfb)).toBe(HEX[0xa]);
    expect(seen.get(0xf7)).toBe(HEX[0x3]);
  },
  fsm(h) {
    h.reset(1);
    expect(h.rgb16()).toEqual([1, 0, 0]);
    h.sim.run(200_000_000);
    expect(h.rgb16()).toEqual([0, 1, 0]);
    h.btn('BTNC', 1);
    h.sim.run(1);
    h.btn('BTNC', 0);
    h.sim.run(1);
    expect(h.rgb16()).toEqual([1, 1, 0]);
    expect(h.led()).toBe(0b100);
    h.sim.run(100_000_000);
    expect(h.rgb16()).toEqual([1, 0, 0]);
  },
  playground(h) {
    h.sw(0x00ff);
    expect(h.led()).toBe(0x00ff);
  },
};

describe('lessons', () => {
  for (const l of ALL_LESSONS) {
    for (const lang of ['verilog', 'vhdl'] as const) {
      it(`${l.id} (${lang})`, () => {
        const h = harness(lang === 'verilog' ? l.verilog : l.vhdl, lang, l.xdc);
        const check = checks[l.id];
        expect(check, 'missing behaviour check').toBeTruthy();
        check(h);
      });
    }
  }
});
