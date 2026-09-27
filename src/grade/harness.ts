// A virtual test bench for a design mapped onto the board: drives switches, buttons and pins, runs the clock
// and reads LEDs, the seven-segment display and pins. Used by the exercise checker (and the tests).
import type { BoardDef } from '../boards';
import { mapPorts, type Binding, type Mapping } from '../boards/mapping';
import { compileDesign, type CompiledSim, type Design } from '../hdl';
import { Recorder, type Trace } from '../la/capture';
import { decodeUart } from '../la/decode';
import { hTotal, vgaTap, vTotal, VgaMonitor } from '../vga/monitor';

// active-low segment patterns {g..a} for 0..F
export const HEX7 = [0x40, 0x79, 0x24, 0x30, 0x19, 0x12, 0x02, 0x78, 0x00, 0x10, 0x08, 0x03, 0x46, 0x21, 0x06, 0x0e];

export function segChar(seg: number | null): string {
  if (seg === null) return ' ';
  const i = HEX7.indexOf(seg & 0x7f);
  return i < 0 ? '?' : i.toString(16).toUpperCase();
}

export class BoardHarness {
  map: Mapping;
  sim: CompiledSim;
  cycles = 0;
  maxCycles = Infinity;

  constructor(
    public design: Design,
    xdc: string,
    public board: BoardDef,
  ) {
    this.map = mapPorts(design, xdc, board);
    const errors = this.map.messages.filter((m) => m.level === 'error');
    if (errors.length) throw new Error(errors.map((e) => e.msg).join('\n'));
    this.sim = compileDesign(design, { clock: this.map.clock });
    this.sim.reset();
    // board inputs start released / off; the reset button is not pressed (high)
    this.set((b) => b.device.kind === 'reset', 1);
  }

  private bind(pred: (b: Binding) => boolean) {
    return this.map.bindings.filter(pred);
  }

  private set(pred: (b: Binding) => boolean, val: number) {
    for (const b of this.bind(pred)) {
      const m = (1 << b.bit) >>> 0;
      this.sim.v[b.sig] = val ? (this.sim.v[b.sig] | m) >>> 0 : (this.sim.v[b.sig] & ~m) >>> 0;
    }
    this.sim.settle();
  }

  has(kind: string, name?: string): boolean {
    return this.map.bindings.some((b) => b.device.kind === kind && (name === undefined || ('name' in b.device && b.device.name === name)));
  }
  hasPin(pin: string) {
    return this.map.bindings.some((b) => b.pin === pin);
  }
  get clocked() {
    return this.map.clock !== undefined;
  }

  run(n: number) {
    n = Math.max(0, Math.round(n));
    if (this.cycles + n > this.maxCycles) throw new Error('time budget');
    if (this.clocked) this.sim.run(n);
    this.cycles += n;
  }

  sw(v: number) {
    for (let i = 0; i < 16; i++) this.set((b) => b.device.kind === 'sw' && b.device.index === i, (v >> i) & 1);
  }
  btn(name: string, v: number) {
    this.set((b) => b.device.kind === 'btn' && b.device.name === name, v);
  }
  // 1 = released (CPU_RESETN high), 0 = pressed
  reset(v: number) {
    this.set((b) => b.device.kind === 'reset', v);
  }
  pin(pin: string, v: number) {
    this.set((b) => b.pin === pin, v);
  }
  readPin(pin: string): number {
    const b = this.map.bindings.find((x) => x.pin === pin);
    return b ? (this.sim.v[b.sig] >>> b.bit) & 1 : 0;
  }

  led(): number {
    let r = 0;
    for (const b of this.map.bindings) if (b.device.kind === 'led' && ((this.sim.v[b.sig] >>> b.bit) & 1)) r |= 1 << b.device.index;
    return r >>> 0;
  }
  // raw segment pins {g..a}, active-low
  seg(): number {
    const order = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    let r = 0;
    for (const b of this.map.bindings) if (b.device.kind === 'seg' && b.device.seg !== 'dp' && ((this.sim.v[b.sig] >>> b.bit) & 1)) r |= 1 << order.indexOf(b.device.seg);
    return r;
  }
  dp(): number {
    const b = this.map.bindings.find((x) => x.device.kind === 'seg' && x.device.seg === 'dp');
    return b ? (this.sim.v[b.sig] >>> b.bit) & 1 : 1;
  }
  an(): number {
    let r = 0xff;
    for (const b of this.map.bindings) if (b.device.kind === 'an') r = ((this.sim.v[b.sig] >>> b.bit) & 1 ? r | (1 << b.device.index) : r & ~(1 << b.device.index)) & 0xff;
    return r;
  }
  rgb(i = 0): [number, number, number] {
    const get = (c: string) => {
      const b = this.map.bindings.find((x) => x.device.kind === 'rgb' && x.device.index === i && x.device.color === c);
      return b ? (this.sim.v[b.sig] >>> b.bit) & 1 : 0;
    };
    return [get('r'), get('g'), get('b')];
  }

  // Watches the multiplexed display for `cycles` and returns what each of the 8 digits showed (last seen).
  digits(cycles = 1 << 20, step = 1024): { seg: (number | null)[]; dp: (number | null)[] } {
    const seg: (number | null)[] = Array(8).fill(null);
    const dp: (number | null)[] = Array(8).fill(null);
    const look = () => {
      const an = this.an();
      for (let d = 0; d < 8; d++)
        if (!((an >> d) & 1)) {
          seg[d] = this.seg();
          dp[d] = this.dp();
        }
    };
    look();
    if (!this.clocked) return { seg, dp };
    for (let c = 0; c < cycles; c += step) {
      this.run(step);
      look();
    }
    return { seg, dp };
  }

  // the text shown on digits hi..lo (e.g. 3..0)
  text(hi: number, lo: number, cycles?: number): string {
    const { seg } = this.digits(cycles);
    let s = '';
    for (let d = hi; d >= lo; d--) s += segChar(seg[d]);
    return s;
  }

  // records pins every clock for `cycles`, after running `stimulus`
  capture(pins: string[], cycles: number, stimulus: () => void = () => {}): Trace {
    const r = new Recorder(1 << 18);
    r.setSources(
      pins.map((p) => {
        const b = this.map.bindings.find((x) => x.pin === p);
        return b ? { sig: b.sig, bit: b.bit } : null;
      }),
    );
    let t = 0;
    r.sample(0, this.sim.v);
    stimulus();
    r.sample(0, this.sim.v);
    for (let i = 0; i < cycles; i++) {
      this.run(1);
      r.sample(++t, this.sim.v);
    }
    return r.extract(0, t);
  }

  // watches the VGA connector for `frames` whole frames (after one frame to lock on) and returns the monitor
  vga(frames = 1): VgaMonitor | null {
    const tap = vgaTap(this.map.bindings);
    if (!tap || !this.clocked) return null;
    const mon = new VgaMonitor(this.board.clockHz);
    let base = 0;
    const feed = (t: number) => {
      const l = tap.read(this.sim.v);
      mon.feed(t, l.hs, l.vs, l.color);
    };
    const old = this.sim;
    const sim = compileDesign(this.design, { clock: this.map.clock, probe: tap.sigs, onProbe: (c) => feed(base + c + 1) });
    sim.v.set(old.v);
    old.mems.forEach((m, i) => sim.mems[i].set(m));
    sim.sync();
    this.sim = sim;
    const l = tap.read(sim.v);
    mon.reset(0, l.hs, l.vs, l.color);
    const frame = Math.round((this.board.clockHz / 25.175e6) * hTotal(mon.mode) * vTotal(mon.mode));
    const want = mon.frames + frames + 1;
    const step = 1 << 16;
    const limit = frame * (frames + 3);
    while (mon.frames < want && base < limit) {
      this.run(step);
      base += step;
    }
    return mon;
  }

  // sends bytes into a pin as UART 8N1
  uartIn(pin: string, bytes: number[], baud: number) {
    const T = this.board.clockHz / baud;
    let acc = 0;
    for (const byte of bytes) {
      for (const bit of [0, ...Array.from({ length: 8 }, (_, k) => (byte >> k) & 1), 1]) {
        this.pin(pin, bit);
        acc += T;
        const n = Math.round(acc);
        acc -= n;
        this.run(n);
      }
    }
  }

  // decodes what a pin sends as UART 8N1 during `cycles`, while `stimulus` runs first
  uartOut(pin: string, cycles: number, baud: number, stimulus: () => void = () => {}): { text: string; errors: number } {
    const tr = this.capture([pin], cycles, stimulus);
    const anns = decodeUart(tr, { ch: 0, baud, bits: 8, parity: 'none', stop: 1 }, this.board.clockHz);
    let text = '';
    let errors = 0;
    for (const a of anns) {
      if (a.kind === 'err') errors++;
      const m = /0x([0-9A-F]+)/.exec(a.text);
      if (m) text += String.fromCharCode(parseInt(m[1], 16));
    }
    return { text, errors };
  }
}
