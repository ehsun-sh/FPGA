import { describe, expect, it } from 'vitest';
import { BOARDS, DEFAULT_BOARD } from '../src/boards';
import { mapPorts } from '../src/boards/mapping';
import { compileDesign, synthesize } from '../src/hdl';
import { Acquisition } from '../src/la/capture';
import { decodeUart } from '../src/la/decode';
import { ADVANCED } from '../src/lessons/advanced';
import { ALL_LESSONS } from '../src/lessons/course';
import { LESSONS, PLAYGROUND } from '../src/lessons/lessons';

type Harness = ReturnType<typeof harness>;

function harness(src: string, lang: 'verilog' | 'vhdl', xdc: string) {
  const d = synthesize(src, lang);
  const map = mapPorts(d, xdc, DEFAULT_BOARD);
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
      return ['r', 'g', 'b'].map((c) => readDev((b) => b.device.kind === 'rgb' && b.device.index === 0 && b.device.color === c)[0] ?? 0);
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
  decoder(h) {
    for (let i = 0; i < 8; i++) {
      h.sw(8 | i);
      expect(h.led() & 0xff).toBe(1 << i);
    }
    h.sw(5);
    expect(h.led() & 0xff).toBe(0);
    for (const [req, code] of [
      [0x80, 7],
      [0x5a, 6],
      [0x13, 4],
      [0x01, 0],
    ]) {
      h.sw(req << 8);
      expect((h.led() >> 12) & 7, `req ${req}`).toBe(code);
      expect(h.led() >> 15).toBe(1);
    }
    h.sw(0);
    expect(h.led() >> 15).toBe(0);
  },
  shifter(h) {
    const rotr = (a: number, k: number) => ((a >> k) | (a << (8 - k))) & 0xff;
    for (const a of [0x01, 0xb4]) {
      for (let k = 0; k < 8; k++) {
        h.sw(a | (k << 8));
        expect(h.led() & 0xff, `ror ${a} ${k}`).toBe(rotr(a, k));
        expect(h.led() >> 8).toBe(a);
        h.sw(a | (k << 8) | 0x8000);
        expect(h.led() & 0xff, `rol ${a} ${k}`).toBe(rotr(a, (8 - k) & 7));
      }
    }
  },
  alu(h) {
    const ops = [
      (a: number, b: number) => (a + b) & 31,
      (a: number, b: number) => (a - b) & 31,
      (a: number, b: number) => a & b,
      (a: number, b: number) => a | b,
      (a: number, b: number) => a ^ b,
      (a: number) => ~a & 15,
      (a: number, b: number) => (a < b ? 1 : 0),
      (a: number) => (a << 1) & 31,
    ];
    for (const [a, b] of [
      [9, 12],
      [7, 7],
      [15, 1],
      [0, 5],
    ]) {
      for (let op = 0; op < 8; op++) {
        h.sw(a | (b << 4) | (op << 13));
        const r = ops[op](a, b);
        expect(h.led() & 0x7fff, `op ${op} a ${a} b ${b}`).toBe(r);
        expect(h.led() >> 15).toBe((r & 15) === 0 ? 1 : 0);
      }
    }
  },
  shiftreg(h) {
    h.reset(1);
    h.sw(1);
    let lfsr = 1;
    for (let i = 0; i < 3; i++) {
      h.sim.run(25_000_000);
      lfsr = ((lfsr << 1) | (((lfsr >> 7) ^ (lfsr >> 5) ^ (lfsr >> 4) ^ (lfsr >> 3)) & 1)) & 0xff;
      expect(h.led() & 0xff).toBe(lfsr);
    }
    expect(h.led() >> 8).toBe(0b111);
    h.sw(0);
    h.sim.run(25_000_000);
    expect(h.led() >> 8).toBe(0b1110);
    h.reset(0);
    h.sim.run(1);
    expect(h.led()).toBe(1);
  },
  stopwatch(h) {
    const digits = () => {
      const seen = new Map<number, number>();
      for (let k = 0; k < 4; k++) {
        seen.set(h.an(), h.seg());
        h.sim.run(1 << 16);
      }
      return seen;
    };
    h.sw(1);
    h.sim.run(12 * 10_000_000);
    h.sw(0);
    const d = digits();
    expect(d.get(0xfe)).toBe(HEX[2]);
    expect(d.get(0xfd)).toBe(HEX[1]);
    expect(d.get(0xfb)).toBe(HEX[0]);
    expect(d.has(0xf7)).toBe(false);
    h.btn('BTNU', 1);
    h.sim.run(1);
    h.btn('BTNU', 0);
    expect(digits().get(0xfd)).toBe(HEX[0]);
  },
  debounce(h) {
    // a bouncy press: short glitches, then a stable level
    for (const level of [1, 0, 1, 0, 1]) {
      h.btn('BTNC', level);
      h.sim.run(20_000);
    }
    h.sim.run(1_100_000);
    expect(h.led()).toBe((1 << 8) | 3);
    for (const level of [0, 1, 0]) {
      h.btn('BTNC', level);
      h.sim.run(20_000);
    }
    h.sim.run(1_100_000);
    expect(h.led()).toBe((1 << 8) | 4);
    h.btn('BTNC', 1);
    h.sim.run(1_100_000);
    expect(h.led()).toBe((2 << 8) | 5);
    h.btn('BTNU', 1);
    h.sim.run(1);
    expect(h.led()).toBe(0);
  },
  bin2bcd(h) {
    for (const n of [8191, 1234, 7, 5009]) {
      h.sw(n);
      h.sim.run(40);
      const seen = new Map<number, number>();
      for (let k = 0; k < 4; k++) {
        seen.set(h.an(), h.seg());
        h.sim.run(1 << 16);
      }
      const dec = String(n).padStart(4, '0');
      for (let i = 0; i < 4; i++) expect(seen.get(0xff & ~(1 << i)), `${n} digit ${i}`).toBe(HEX[+dec[3 - i]]);
      expect(h.led()).toBe(n);
    }
  },
  ram(h) {
    for (const [a, v] of [
      [3, 0x5a],
      [9, 0xc3],
    ]) {
      h.sw((a << 8) | v);
      h.btn('BTNC', 1);
      h.sim.run(2);
      h.btn('BTNC', 0);
    }
    h.sw(3 << 8);
    h.sim.run(2);
    expect(h.led()).toBe((3 << 8) | 0x5a);
    h.sw(9 << 8);
    h.sim.run(2);
    expect(h.led()).toBe((9 << 8) | 0xc3);
    h.sw(4 << 8);
    h.sim.run(2);
    expect(h.led()).toBe(4 << 8);
  },
  pwm(h) {
    h.sw(64 | (192 << 8));
    let r = 0;
    let g = 0;
    for (let i = 0; i < 512; i++) {
      const [cr, cg] = h.rgb16();
      r += cr;
      g += cg;
      h.sim.run(1);
    }
    expect(r).toBe(128);
    expect(g).toBe(384);
  },
  uart(h) {
    // capture the TX line with the logic analyzer engine, triggered on the start bit, and decode it
    const tx = h.map.bindings.find((b) => b.pin === 'D4')!;
    expect(tx).toBeTruthy();
    const acq = new Acquisition();
    acq.rec.setSources([{ sig: tx.sig, bit: tx.bit }]);
    acq.trigger = { ch: 0, edge: 'fall' };
    acq.base = 20_000; // 200 us/div
    acq.pos = 4 * acq.base;
    let t = 0;
    acq.sample(t, h.sim.v);
    acq.run(0, true);
    h.btn('BTNC', 1);
    for (let i = 0; i < 200_000 && !acq.tick(t); i++) {
      h.sim.run(1);
      acq.sample(++t, h.sim.v);
    }
    expect(acq.captured).toBe(true);
    const [t0, t1] = acq.window;
    const anns = decodeUart(acq.rec.extract(t0, t1), { ch: 0, baud: 115200, bits: 8, parity: 'none', stop: 1 }, 100e6);
    const text = anns.map((a) => String.fromCharCode(parseInt(/0x([0-9A-F]+)/.exec(a.text)![1], 16))).join('');
    expect(text).toBe('Hello FPGA!\r\n');
    expect(anns.every((a) => a.kind === 'data')).toBe(true);
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
        const h = harness(lang === 'verilog' ? l.verilog : l.vhdl, lang, DEFAULT_BOARD.masterXdc(l.xdc));
        const check = checks[l.id];
        expect(check, 'missing behaviour check').toBeTruthy();
        check(h);
      });
    }
  }
});

describe('board definitions', () => {
  for (const b of BOARDS) {
    it(`${b.id} is consistent`, () => {
      for (const [name, pin] of Object.entries(b.defaultNames)) expect(b.pins[pin], `${name} -> ${pin}`).toBeTruthy();
      const devs = Object.values(b.pins);
      expect(devs.filter((d) => d.kind === 'sw').length).toBe(b.io.switches);
      expect(devs.filter((d) => d.kind === 'led').length).toBe(b.io.leds);
      expect(devs.filter((d) => d.kind === 'an').length).toBe(b.io.digits);
      expect(devs.filter((d) => d.kind === 'rgb').length).toBe(b.io.rgb.length * 3);
      expect(devs.filter((d) => d.kind === 'btn').map((d) => (d as { name: string }).name).sort()).toEqual([...b.io.buttons].sort());
    });
  }
});

describe('course', () => {
  it('every lesson belongs to exactly one chapter', () => {
    const ids = ALL_LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of [...LESSONS, ...ADVANCED, PLAYGROUND]) expect(ids, l.id).toContain(l.id);
  });
});

describe('translations', () => {
  it('every lesson has English text', async () => {
    const { EN } = await import('../src/lessons/en');
    for (const l of ALL_LESSONS) {
      const e = EN[l.id];
      expect(e, l.id).toBeTruthy();
      expect(!!e.exercise, `${l.id} exercise`).toBe(!!l.exercise);
    }
  });
});
