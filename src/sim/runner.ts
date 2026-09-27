// Drives a compiled design in real time: feeds board inputs, clocks it, and turns outputs into LED brightness.
import type { BoardDef, BoardOutputs } from '../boards';
import type { Binding, Mapping } from '../boards/mapping';
import { compileDesign, type CompiledSim, type Design } from '../hdl';

const SEG_INDEX: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 6, dp: 7 };
const RGB_INDEX: Record<string, number> = { r: 0, g: 1, b: 2 };
// persistence of vision, in simulated board time
const TAU_SECONDS = 0.01;
const FRAME_BUDGET_MS = 11;

export class Runner {
  sim: CompiledSim | null = null;
  design: Design | null = null;
  mapping: Mapping | null = null;
  running = false;
  speedHz = 100e6; // target simulated clock rate (set to board.clockHz for real time)
  achievedHz = 0;
  totalCycles = 0;
  error: string | null = null;
  onError: (msg: string) => void = () => {};
  // logic-analyzer hooks: extra signals to watch, a callback on every change (absolute board cycle), and time restarts
  private probeSigs: number[] = [];
  onSample: ((cycle: number) => void) | null = null;
  onRestart: (() => void) | null = null;

  private outBindings: Binding[] = [];
  private inBindings: Binding[] = [];
  // brightness slots: [leds][rgb * 3][digits * 8]
  private nLed: number;
  private nRgb: number;
  private nDig: number;
  private lit: Float64Array;
  private acc: Float64Array;
  private bright: Float64Array;

  constructor(public board: BoardDef) {
    this.nLed = board.io.leds;
    this.nRgb = board.io.rgb.length;
    this.nDig = board.io.digits;
    const n = this.nLed + this.nRgb * 3 + this.nDig * 8;
    this.lit = new Float64Array(n);
    this.acc = new Float64Array(n);
    this.bright = new Float64Array(n);
  }
  private lastMark = 0;
  private fractional = 0;
  private chunk = 2000;
  private hzWindow: { t: number; c: number }[] = [];

  program(design: Design, mapping: Mapping, inputs: { switches: boolean[]; pressed: (b: string) => boolean }) {
    this.design = design;
    this.mapping = mapping;
    this.probeSigs = [];
    this.outBindings = mapping.bindings.filter((b) => !['sw', 'btn', 'clk', 'reset'].includes(b.device.kind));
    this.inBindings = mapping.bindings.filter((b) => ['sw', 'btn', 'reset'].includes(b.device.kind));
    this.sim = this.compile();
    this.error = null;
    this.reset(inputs);
    this.running = true;
  }

  private compile(): CompiledSim {
    const watch = [...new Set(this.outBindings.map((b) => b.sig))];
    return compileDesign(this.design!, {
      clock: this.mapping!.clock,
      watch,
      onOut: (c) => this.mark(c),
      probe: this.probeSigs,
      onProbe: (c) => this.onSample?.(this.totalCycles + this.runBase + c + 1),
    });
  }

  // Signals the logic analyzer samples. Recompiles the running design without disturbing its state.
  setProbeSigs(ids: number[]) {
    const next = [...new Set(ids)].sort((a, b) => a - b);
    if (next.join() === this.probeSigs.join()) return;
    this.probeSigs = next;
    if (!this.sim) return;
    const old = this.sim;
    const sim = this.compile();
    sim.v.set(old.v);
    old.mems.forEach((m, i) => sim.mems[i].set(m));
    sim.sync();
    this.sim = sim;
  }

  get now(): number {
    return this.totalCycles + this.runBase;
  }

  reset(inputs: { switches: boolean[]; pressed: (b: string) => boolean }) {
    if (!this.sim) return;
    this.sim.reset();
    // apply current board inputs without settling each bit
    for (const b of this.inBindings) this.writeBit(b, this.inputValue(b, inputs));
    this.safe(() => this.sim!.settle());
    this.totalCycles = 0;
    this.lastMark = 0;
    this.acc.fill(0);
    this.computeLit();
    this.bright.set(this.lit);
    this.onRestart?.();
    this.onSample?.(0);
  }

  stop() {
    this.running = false;
    this.sim = null;
    this.design = null;
    this.mapping = null;
    this.achievedHz = 0;
    this.lit.fill(0);
    this.pending = [];
    this.bright.fill(0);
  }

  private inputValue(b: Binding, inputs: { switches: boolean[]; pressed: (b: string) => boolean }): number {
    const d = b.device;
    if (d.kind === 'sw') return inputs.switches[d.index] ? 1 : 0;
    if (d.kind === 'btn') return inputs.pressed(d.name) ? 1 : 0;
    if (d.kind === 'reset') return inputs.pressed(d.name) ? 0 : 1; // active-low
    return 0;
  }

  private writeBit(b: Binding, val: number) {
    const v = this.sim!.v;
    const m = (1 << b.bit) >>> 0;
    v[b.sig] = val ? (v[b.sig] | m) >>> 0 : (v[b.sig] & ~m) >>> 0;
  }

  setSwitch(i: number, on: boolean) {
    this.setDevice((d) => d.kind === 'sw' && d.index === i, on ? 1 : 0);
  }

  setButton(name: string, pressed: boolean) {
    this.pending = this.pending.filter((p) => p.name !== name);
    if (this.bounce && this.running && this.mapping?.clock !== undefined) {
      // mechanical contact bounce: a burst of random transitions over ~0.2-3 ms before the level settles
      const hz = this.board.clockHz;
      let at = this.totalCycles;
      let level = pressed;
      const n = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        at += Math.round((0.0001 + Math.random() * 0.0006) * hz);
        level = !level;
        this.pending.push({ at, name, pressed: level });
      }
      at += Math.round(0.0003 * hz);
      this.pending.push({ at, name, pressed });
    }
    this.applyButton(name, pressed);
  }

  private applyButton(name: string, pressed: boolean) {
    if (name === this.board.io.reset) this.setDevice((d) => d.kind === 'reset', pressed ? 0 : 1);
    else this.setDevice((d) => d.kind === 'btn' && d.name === name, pressed ? 1 : 0);
  }

  // simulate contact bounce on push buttons
  bounce = false;
  private pending: { at: number; name: string; pressed: boolean }[] = [];

  private setDevice(match: (d: Binding['device']) => boolean, val: number) {
    if (!this.sim || !this.running) return;
    const bs = this.inBindings.filter((b) => match(b.device));
    if (!bs.length) return;
    for (const b of bs) this.writeBit(b, val);
    this.safe(() => this.sim!.settle());
    if (this.sim) {
      this.computeLit();
      this.onSample?.(this.now);
    }
  }

  private safe(fn: () => void) {
    try {
      fn();
    } catch (e) {
      this.running = false;
      this.error = (e as Error).message;
      this.onError(this.error);
    }
  }

  private computeLit() {
    const v = this.sim!.v;
    const lit = this.lit;
    lit.fill(0);
    const segRaw = [1, 1, 1, 1, 1, 1, 1, 1];
    const anRaw = new Array(this.nDig).fill(1);
    const rgb0 = this.nLed;
    const seg0 = this.nLed + this.nRgb * 3;
    for (const b of this.outBindings) {
      const bit = (v[b.sig] >>> b.bit) & 1;
      const d = b.device;
      if (d.kind === 'led') lit[d.index] = bit;
      else if (d.kind === 'rgb') lit[rgb0 + d.index * 3 + RGB_INDEX[d.color]] = bit;
      else if (d.kind === 'seg') segRaw[SEG_INDEX[d.seg]] = bit;
      else if (d.kind === 'an') anRaw[d.index] = bit;
    }
    // common-anode displays: anode and cathode are both active-low
    for (let dg = 0; dg < this.nDig; dg++) {
      if (anRaw[dg]) continue;
      for (let s = 0; s < 8; s++) lit[seg0 + dg * 8 + s] = segRaw[s] ? 0 : 1;
    }
  }

  // an output changed at cycle `c` of the current run() call
  private mark(c: number) {
    const at = this.runBase + c + 1;
    const span = at - this.lastMark;
    if (span > 0) for (let i = 0; i < this.acc.length; i++) this.acc[i] += this.lit[i] * span;
    this.lastMark = at;
    if (this.sim) {
      this.computeLit();
      this.onSample?.(this.totalCycles + at);
    }
  }

  private runBase = 0;

  // Advance the simulation for one animation frame of `dt` seconds.
  frame(dt: number): BoardOutputs {
    if (this.sim && this.running && this.mapping?.clock !== undefined) {
      let want = this.speedHz * dt + this.fractional;
      const whole = Math.floor(want);
      this.fractional = want - whole;
      want = whole;
      const t0 = performance.now();
      let done = 0;
      this.lastMark = 0;
      this.acc.fill(0);
      while (done < want) {
        let n = Math.min(this.chunk, want - done);
        if (this.pending.length) {
          const now = this.totalCycles + done;
          for (const p of this.pending.filter((q) => q.at <= now)) {
            this.runBase = done;
            this.mark(-1); // close the brightness window up to now, then change the input
            this.applyButton(p.name, p.pressed);
          }
          this.pending = this.pending.filter((q) => q.at > now);
          if (this.pending.length) n = Math.max(1, Math.min(n, Math.min(...this.pending.map((q) => q.at)) - now));
        }
        this.runBase = done;
        const ts = performance.now();
        try {
          this.sim.run(n);
        } catch (e) {
          this.running = false;
          this.error = (e as Error).message;
          this.onError(this.error);
          break;
        }
        done += n;
        const el = performance.now() - ts;
        // adapt chunk so one chunk takes ~1.5 ms
        if (el > 0.05) this.chunk = Math.max(100, Math.min(2_000_000, Math.round((n * 1.5) / el)));
        if (performance.now() - t0 > FRAME_BUDGET_MS) break;
      }
      this.runBase = 0;
      this.totalCycles += done;
      // close the accumulation window
      const span = done - this.lastMark;
      if (span > 0) for (let i = 0; i < this.acc.length; i++) this.acc[i] += this.lit[i] * span;
      this.lastMark = 0;
      const now = performance.now();
      this.hzWindow.push({ t: now, c: done });
      while (this.hzWindow.length > 1 && now - this.hzWindow[0].t > 1000) this.hzWindow.shift();
      const spanT = (now - this.hzWindow[0].t) / 1000;
      const sumC = this.hzWindow.reduce((s, x) => s + x.c, 0);
      this.achievedHz = spanT > 0.2 ? sumC / spanT : this.achievedHz;
      if (done > 0 && this.speedHz >= 100_000) {
        const alpha = 1 - Math.exp(-done / (TAU_SECONDS * this.board.clockHz));
        for (let i = 0; i < this.acc.length; i++) this.bright[i] += (this.acc[i] / done - this.bright[i]) * alpha;
      } else {
        this.bright.set(this.lit);
      }
    } else if (this.sim && this.running) {
      // no clock: board time still passes, so the logic analyzer can show input changes
      this.fractional += this.speedHz * dt;
      const whole = Math.floor(this.fractional);
      this.fractional -= whole;
      this.totalCycles += whole;
      this.achievedHz = 0;
      this.bright.set(this.lit);
    }
    return this.outputs();
  }

  private outputs(): BoardOutputs {
    const b = this.bright;
    const on = this.running || !!this.sim;
    const f = (x: number, gain: number) => (x <= 0 ? 0 : Math.min(1, Math.sqrt(x) * gain));
    const led: number[] = [];
    const rgb0 = this.nLed;
    const seg0 = this.nLed + this.nRgb * 3;
    for (let i = 0; i < this.nLed; i++) led.push(on ? f(b[i], 1.15) : 0);
    const rgb: [number, number, number][] = [];
    for (let k = 0; k < this.nRgb; k++) rgb.push([0, 1, 2].map((c) => (on ? f(b[rgb0 + k * 3 + c], 1.15) : 0)) as [number, number, number]);
    const seg: number[][] = [];
    for (let dg = 0; dg < this.nDig; dg++) {
      const row: number[] = [];
      for (let s = 0; s < 8; s++) row.push(on ? f(b[seg0 + dg * 8 + s], 1.7) : 0);
      seg.push(row);
    }
    return { led, rgb, seg, done: !!this.sim };
  }
}
