// Event-driven behavioral simulation of a testbench, like Vivado's xsim "Run Behavioral Simulation".
// The design is compiled as usual; testbench threads (initial blocks, processes with wait) are generators
// that yield delays and waits. After every change the design is settled, and all signals are recorded
// as value-change lists for the waveform viewer. Times are in ps.
import { compileDesign, type CompiledSim, type Design, type TbHost, type TbYield } from '../hdl';
import type { Part } from '../hdl/ir';

export interface WaveSig {
  id: number;
  name: string; // full hierarchical name, e.g. "dut.count"
  scope: string; // "" for the testbench itself, "dut" ...
  leaf: string;
  width: number;
  left: number;
  right: number;
  signed: boolean;
  lits?: string[];
}

export interface Wave {
  sig: WaveSig;
  t: number[];
  v: number[];
}

export interface TbLine {
  t: number;
  sev: number; // 0 note, 1 warning, 2 error, 3 failure; -1 plain $display output
  text: string;
}

export type StopReason = 'time' | 'finish' | 'idle' | 'budget' | 'error';

interface Waiter {
  g: number;
  w: number[];
  e: number[];
  prev: number[];
  u: (() => boolean) | null;
}

interface Ev {
  t: number;
  s: number;
  g: number; // thread, or -1 for a scheduled assignment
  f?: () => void;
}

const SEV_NAME = ['Note', 'Warning', 'Error', 'Failure'];

export function formatTime(ps: number): string {
  if (ps === 0) return '0 ns';
  const [div, unit] = ps >= 1e9 ? [1e9, 'ms'] : ps >= 1e6 ? [1e6, 'us'] : ps >= 1000 || ps % 1000 === 0 ? [1000, 'ns'] : [1, 'ps'];
  return `${Number((ps / div).toFixed(3))} ${unit}`;
}

const sx = (v: number, w: number) => (w >= 32 ? v | 0 : v >= 2 ** (w - 1) ? v - 2 ** w : v);

// One formatted value of a message.
export function formatValue(p: Extract<Part, { e: unknown }>, v: number): string {
  const w = Math.max(p.width || 32, 1);
  const pad = (s: string, n: number, c = ' ') => (s.length >= n ? s : c.repeat(n - s.length) + s);
  switch (p.f) {
    case 'd': {
      const s = String(p.signed ? sx(v, w) : v);
      return p.w < 0 ? pad(s, String(2 ** Math.min(w, 32) - 1).length + (p.signed ? 1 : 0)) : pad(s, p.w);
    }
    case 'h':
      return pad(v.toString(16), p.w < 0 ? Math.ceil(w / 4) : p.w, '0');
    case 'b':
      return pad(v.toString(2), p.w < 0 ? w : p.w, '0');
    case 'o':
      return pad(v.toString(8), p.w < 0 ? Math.ceil(w / 3) : p.w, '0');
    case 'c':
      return String.fromCharCode(v & 0xff);
    case 's': {
      let s = '';
      for (let i = Math.ceil(w / 8) - 1; i >= 0; i--) {
        const c = (v >>> (i * 8)) & 0xff;
        if (c) s += String.fromCharCode(c);
      }
      return p.w > 0 ? pad(s, p.w) : s;
    }
    case 't':
      // Verilog %t: time in the module's units
      return p.w > 0 ? pad(String(v), p.w) : String(v);
    case 'T':
      return formatTime(v);
    case 'img':
      if (p.lits) return p.lits[v] ?? String(v);
      if (w === 1 && !p.signed) return `'${v}'`;
      return String(p.signed ? sx(v, w) : v);
    default:
      // VHDL to_string / plain value
      if (p.lits) return p.lits[v] ?? String(v);
      if (w === 1) return String(v & 1);
      if (w === 32 && p.signed) return String(v | 0);
      return pad(v.toString(2), w, '0');
  }
}

export class TbSim {
  sim: CompiledSim;
  now = 0;
  finished = false;
  error: string | null = null;
  waves: Wave[] = [];
  lines: TbLine[] = [];
  errors = 0;
  steps = 0;
  onLine: (l: TbLine) => void = () => {};

  private heap: Ev[] = [];
  private seq = 0;
  private waiters: Waiter[] = [];
  private gens: Generator<TbYield, void, void>[] = [];
  private last: Uint32Array;
  private monitors: { idx: number; fn: () => number[]; text: string }[] = [];
  private pending = ''; // $write text without a newline yet
  private host: TbHost;
  private started = false;

  constructor(public design: Design) {
    const self = this;
    this.host = {
      t: 0,
      pr: (i, vals) => self.print(i, vals),
      mon: (i, fn) => {
        self.monitors.push({ idx: i, fn, text: '' });
      },
      sch: (d, fn) => self.push(self.now + Math.max(0, d), -1, fn),
      fin: () => {
        self.finished = true;
      },
    };
    this.sim = compileDesign(design, { host: this.host });
    const sigs = design.sigs.filter((s) => !s.name.includes('#loop'));
    this.waves = sigs.map((s) => {
      const dot = s.name.lastIndexOf('.');
      const scope = dot < 0 ? '' : s.name.slice(0, dot).replace(/(^|\.)proc\d+(?=\.|$)/g, '');
      return {
        sig: { id: s.id, name: s.name, scope: scope.replace(/\.+$/, ''), leaf: dot < 0 ? s.name : s.name.slice(dot + 1), width: s.width, left: s.left, right: s.right, signed: s.signed, lits: s.enumLits },
        t: [],
        v: [],
      };
    });
    this.last = new Uint32Array(this.waves.length);
    this.restart();
  }

  get unitPs() {
    return this.design.unitPs ?? 1000;
  }

  restart() {
    this.now = 0;
    this.host.t = 0;
    this.finished = false;
    this.error = null;
    this.heap = [];
    this.waiters = [];
    this.monitors = [];
    this.lines = [];
    this.errors = 0;
    this.steps = 0;
    this.pending = '';
    this.started = false;
    for (const w of this.waves) {
      w.t = [];
      w.v = [];
    }
    try {
      this.sim.reset();
    } catch (e) {
      this.fail(e);
      return;
    }
    this.gens = this.sim.threads.map((f) => f());
    this.gens.forEach((_, i) => this.push(0, i));
  }

  private fail(e: unknown) {
    this.error = (e as Error).message ?? String(e);
    this.finished = true;
  }

  private push(t: number, g: number, f?: () => void) {
    const h = this.heap;
    const ev: Ev = { t, s: this.seq++, g, f };
    h.push(ev);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p].t < ev.t || (h[p].t === ev.t && h[p].s < ev.s)) break;
      h[i] = h[p];
      i = p;
    }
    h[i] = ev;
  }

  private pop(): Ev {
    const h = this.heap;
    const top = h[0];
    const last = h.pop()!;
    if (h.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        const lt = (a: Ev, b: Ev) => a.t < b.t || (a.t === b.t && a.s < b.s);
        if (l < h.length && lt(h[l], m === i ? last : h[m])) m = l;
        if (r < h.length && lt(h[r], m === i ? last : h[m])) m = r;
        if (m === i) break;
        h[i] = h[m];
        i = m;
      }
      h[i] = last;
    }
    return top;
  }

  private resume(g: number) {
    const gen = this.gens[g];
    const v = this.sim.v;
    for (let guard = 0; guard < 1000; guard++) {
      const r = gen.next();
      if (r.done) return;
      const y = r.value;
      if (typeof y === 'number') {
        if (y >= 0) this.push(this.now + y, g);
        return;
      }
      if (y.l && y.u && y.u()) continue; // Verilog wait(cond) that already holds
      if (!y.w.length) return; // waits forever
      this.waiters.push({ g, w: y.w, e: y.e, prev: y.w.map((id) => v[id]), u: y.u });
      return;
    }
    throw new Error('testbench thread does not advance');
  }

  // wakes threads whose wait condition has fired; returns true when any did
  private checkWaiters(): boolean {
    const v = this.sim.v;
    const woken: number[] = [];
    this.waiters = this.waiters.filter((wt) => {
      let hit = false;
      for (let k = 0; k < wt.w.length; k++) {
        const cur = v[wt.w[k]];
        const old = wt.prev[k];
        if (cur === old) continue;
        wt.prev[k] = cur;
        const e = wt.e[k];
        if (e === 0 || (e === 1 && (old & 1) === 0 && (cur & 1) === 1) || (e === 2 && (old & 1) === 1 && (cur & 1) === 0)) hit = true;
      }
      if (hit && (!wt.u || wt.u())) {
        woken.push(wt.g);
        return false;
      }
      return true;
    });
    for (const g of woken) this.resume(g);
    return woken.length > 0;
  }

  private record() {
    const v = this.sim.v;
    const first = !this.started;
    this.started = true;
    for (let i = 0; i < this.waves.length; i++) {
      const x = v[this.waves[i].sig.id];
      if (first || x !== this.last[i]) {
        const w = this.waves[i];
        if (w.t.length && w.t[w.t.length - 1] === this.now) w.v[w.v.length - 1] = x;
        else {
          w.t.push(this.now);
          w.v.push(x);
        }
        this.last[i] = x;
      }
    }
  }

  private text(idx: number, vals: number[]): string {
    let k = 0;
    return this.sim.prints[idx].map((p) => ('s' in p ? p.s : formatValue(p, vals[k++] >>> 0))).join('');
  }

  private emit(sev: number, text: string) {
    const l: TbLine = { t: this.now, sev, text };
    this.lines.push(l);
    if (this.lines.length > 5000) this.lines.shift();
    this.onLine(l);
  }

  private print(idx: number, vals: number[]) {
    const sev = this.sim.printSev[idx] ?? 0;
    const s = this.text(idx, vals);
    if (sev > 0 || this.design.lang === 'vhdl') {
      // VHDL report / Verilog $error: one message with severity and time, like xsim
      if (sev >= 2) this.errors++;
      this.emit(sev, `${SEV_NAME[sev]}: ${s.replace(/\n$/, '')}  (Time: ${formatTime(this.now)})`);
      if (sev === 3) this.finished = true;
      return;
    }
    this.pending += s;
    const parts = this.pending.split('\n');
    this.pending = parts.pop()!;
    for (const p of parts) this.emit(-1, p);
  }

  // one time step: run everything scheduled now, then settle and wake waiting threads until quiet
  private step() {
    this.now = this.heap[0].t;
    this.host.t = this.now;
    for (let delta = 0; ; delta++) {
      if (delta > 10000) throw new Error(`zero-delay loop at ${formatTime(this.now)}`);
      while (this.heap.length && this.heap[0].t === this.now && !this.finished) {
        const ev = this.pop();
        if (ev.f) ev.f();
        else this.resume(ev.g);
      }
      this.sim.settle();
      if (this.finished) break;
      const woke = this.checkWaiters();
      if (!woke && !(this.heap.length && this.heap[0].t === this.now)) break;
    }
    this.record();
    for (const m of this.monitors) {
      const s = this.text(m.idx, m.fn());
      if (s !== m.text) {
        m.text = s;
        for (const line of s.split('\n').filter((x, i, a) => x || i < a.length - 1)) this.emit(-1, line);
      }
    }
    this.steps++;
  }

  // Runs for `duration` ps (Infinity = until $finish or nothing is left to do), within a wall-clock budget.
  run(duration: number, budgetMs = 4000): StopReason {
    if (this.error) return 'error';
    if (this.finished) return 'finish';
    const until = this.now + duration;
    const t0 = performance.now();
    try {
      if (!this.started) {
        if (!this.heap.length) this.record();
      }
      while (this.heap.length && this.heap[0].t <= until && !this.finished) {
        this.step();
        if ((this.steps & 255) === 0 && performance.now() - t0 > budgetMs) return 'budget';
      }
    } catch (e) {
      this.fail(e);
      this.emit(3, `ERROR: ${this.error}  (Time: ${formatTime(this.now)})`);
      return 'error';
    }
    if (this.pending) {
      this.emit(-1, this.pending);
      this.pending = '';
    }
    if (this.finished) return 'finish';
    if (!this.heap.length) {
      if (Number.isFinite(until)) this.now = until;
      return 'idle';
    }
    this.now = until;
    this.host.t = until;
    return 'time';
  }

  // value of a wave at time t
  static valueAt(w: Wave, t: number): number | undefined {
    let lo = 0;
    let hi = w.t.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (w.t[m] <= t) lo = m + 1;
      else hi = m;
    }
    return lo ? w.v[lo - 1] : undefined;
  }
}
