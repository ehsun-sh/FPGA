// Drives a compiled design in real time: feeds board inputs, clocks it, and turns outputs into LED brightness.
import { isBoardInput, type BoardDef, type BoardOutputs } from '../boards';
import type { Binding, Mapping } from '../boards/mapping';
import { compileDesign, type CompiledSim, type Design } from '../hdl';
import { PinBus } from '../modules/bus';

const SEG_INDEX: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 6, dp: 7 };
const RGB_INDEX: Record<string, number> = { r: 0, g: 1, b: 2 };
// persistence of vision, in simulated board time
const TAU_SECONDS = 0.01;
const FRAME_BUDGET_MS = 11;

export interface Probe {
  sigs: number[];
  onSample(cycle: number): void;
  onRestart?(): void;
}

export interface SerialFormat {
  baud: number;
  bits: number;
  parity: 'none' | 'even' | 'odd';
  stop: 1 | 2;
}

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
  // instruments (logic analyzer, serial console): extra signals to watch, a callback on every change
  // (absolute board cycle) and on time restarts
  private probes = new Map<string, Probe>();
  private probeSigs: number[] = [];
  // modules attached to the board's pins (sensors, Pmods, ...)
  bus: PinBus;

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
    this.bus = new PinBus(board.clockHz, () => this.sim);
  }
  private lastMark = 0;
  private fractional = 0;
  private chunk = 2000;
  private hzWindow: { t: number; c: number }[] = [];

  program(design: Design, mapping: Mapping, inputs: { switches: boolean[]; pressed: (b: string) => boolean }) {
    this.design = design;
    this.mapping = mapping;
    this.probes.clear(); // instruments re-register for the new design
    this.bus.setDesign(design, mapping);
    this.probeSigs = this.bus.sigs();
    this.outBindings = mapping.bindings.filter((b) => !isBoardInput(b.device));
    this.inBindings = mapping.bindings.filter((b) => isBoardInput(b.device) && b.device.kind !== 'clk');
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
      onProbe: (c) => this.sample(this.totalCycles + this.runBase + c + 1),
    });
  }

  private sample(t: number) {
    this.bus.refresh(t);
    for (const p of this.probes.values()) p.onSample(t);
  }

  // Register (or with null, remove) an instrument. Recompiles the running design without disturbing its state.
  setProbe(owner: string, probe: Probe | null) {
    if (probe) this.probes.set(owner, probe);
    else this.probes.delete(owner);
    this.reprobe();
  }

  // modules were attached or removed: watch their lines and update the design's inputs
  modulesChanged() {
    this.reprobe();
    this.bus.now = this.now;
    this.poke();
  }

  // something outside the clock runs changed the design's inputs (a module's button, ...)
  poke() {
    if (!this.sim) return;
    this.computeLit();
    this.sample(this.now);
  }

  private reprobe() {
    const next = [...new Set([...[...this.probes.values()].flatMap((p) => p.sigs), ...this.bus.sigs()])].sort((a, b) => a - b);
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
    this.pending = [];
    this.serialLevel = 1;
    this.serialFree = 0;
    this.bus.reset(0);
    this.computeLit();
    for (const p of this.probes.values()) p.onRestart?.();
    this.sample(0);
  }

  stop() {
    this.running = false;
    this.sim = null;
    this.bus.setDesign(null, null);
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
    if (d.kind === 'uart') return this.serialLevel;
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
    const apply = (p: boolean) => () => this.applyButton(name, p);
    if (this.bounce && this.running && this.mapping?.clock !== undefined) {
      // mechanical contact bounce: a burst of random transitions over ~0.2-3 ms before the level settles
      const hz = this.board.clockHz;
      let at = this.totalCycles;
      let level = pressed;
      const n = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++) {
        at += Math.round((0.0001 + Math.random() * 0.0006) * hz);
        level = !level;
        this.pending.push({ at, name, apply: apply(level) });
      }
      at += Math.round(0.0003 * hz);
      this.pending.push({ at, name, apply: apply(pressed) });
    }
    this.applyButton(name, pressed);
  }

  private applyButton(name: string, pressed: boolean) {
    if (name === this.board.io.reset) this.setDevice((d) => d.kind === 'reset', pressed ? 0 : 1);
    else this.setDevice((d) => d.kind === 'btn' && d.name === name, pressed ? 1 : 0);
  }

  // simulate contact bounce on push buttons
  bounce = false;
  // scheduled input changes, in board cycles (button bounce, serial bits)
  private pending: { at: number; name: string; apply: () => void }[] = [];

  // PC -> FPGA serial line (UART_TXD_IN), idle high
  private serialLevel = 1;
  private serialFree = 0; // board cycle when the line is free for the next byte

  // Queue bytes on the USB-UART line into the FPGA. Returns false when no clocked design is running.
  sendSerial(bytes: number[], f: SerialFormat): boolean {
    if (!this.sim || !this.running || this.mapping?.clock === undefined) return false;
    const T = this.board.clockHz / f.baud;
    let t = Math.max(this.now + 1, this.serialFree);
    const set = (lv: number) => () => {
      this.serialLevel = lv;
      this.setDevice((d) => d.kind === 'uart' && d.dir === 'in', lv);
    };
    for (const b of bytes) {
      const bits = [0];
      let ones = 0;
      for (let k = 0; k < f.bits; k++) {
        const x = (b >> k) & 1;
        bits.push(x);
        ones += x;
      }
      if (f.parity !== 'none') bits.push((ones & 1) ^ (f.parity === 'odd' ? 1 : 0));
      for (let k = 0; k < f.stop; k++) bits.push(1);
      bits.forEach((lv, k) => this.pending.push({ at: Math.round(t + k * T), name: '#serial', apply: set(lv) }));
      t += bits.length * T;
    }
    this.serialFree = Math.round(t);
    return true;
  }

  get serialBusy() {
    return this.serialFree > this.now;
  }

  private setDevice(match: (d: Binding['device']) => boolean, val: number) {
    if (!this.sim || !this.running) return;
    const bs = this.inBindings.filter((b) => match(b.device));
    if (!bs.length) return;
    for (const b of bs) this.writeBit(b, val);
    this.safe(() => this.sim!.settle());
    if (this.sim) {
      this.computeLit();
      this.sample(this.now);
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
      this.sample(this.totalCycles + at);
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
        {
          const now = this.totalCycles + done;
          this.runBase = done;
          if (this.bus.runDue(now)) this.mark(-1); // module events changed inputs: outputs may follow
          n = Math.max(1, Math.min(n, this.bus.nextAt - now));
          if (this.bus.timed) n = Math.min(n, 1000);
          if (!this.running) break;
        }
        if (this.pending.length) {
          const now = this.totalCycles + done;
          for (const p of this.pending.filter((q) => q.at <= now)) {
            this.runBase = done;
            this.mark(-1); // close the brightness window up to now, then change the input
            p.apply();
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
      this.bus.now = this.totalCycles;
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
