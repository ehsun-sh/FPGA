// Logic-analyzer acquisition: records probe transitions from the simulator and handles triggering.
// Times are absolute board clock cycles (Runner.totalCycles), so resolution is one clock period.

export interface Source {
  sig: number;
  bit: number;
}

// A window of recorded data: `init` holds before the first transition; values are one bit per channel.
export interface Trace {
  t0: number;
  t1: number;
  init: number;
  times: number[];
  vals: number[];
  // data before this time is not available (recording started later or was overwritten)
  known: number;
}

export class Recorder {
  private times: Float64Array;
  private vals: Uint32Array;
  private start = 0;
  len = 0;
  last = -1;
  private srcs: (Source | null)[] = [];

  constructor(readonly cap = 1 << 19) {
    this.times = new Float64Array(cap);
    this.vals = new Uint32Array(cap);
  }

  setSources(srcs: (Source | null)[]) {
    this.srcs = srcs;
    this.clear();
  }

  clear() {
    this.start = 0;
    this.len = 0;
    this.last = -1;
  }

  // sample the probes; returns the packed word (bit i = channel i)
  sample(t: number, v: Uint32Array): number {
    let w = 0;
    const s = this.srcs;
    for (let i = 0; i < s.length; i++) {
      const x = s[i];
      if (x && (v[x.sig] >>> x.bit) & 1) w |= 1 << i;
    }
    w >>>= 0;
    if (w !== this.last) this.push(t, w);
    return w;
  }

  push(t: number, w: number) {
    if (this.len && this.time(this.len - 1) === t) {
      // several changes within one clock: keep the final value
      this.vals[(this.start + this.len - 1) % this.cap] = w;
      this.last = w;
      return;
    }
    const i = (this.start + this.len) % this.cap;
    this.times[i] = t;
    this.vals[i] = w;
    if (this.len < this.cap) this.len++;
    else this.start = (this.start + 1) % this.cap;
    this.last = w;
  }

  time(i: number) {
    return this.times[(this.start + i) % this.cap];
  }
  val(i: number) {
    return this.vals[(this.start + i) % this.cap];
  }

  // first logical index whose time is > t
  private upper(t: number): number {
    let lo = 0;
    let hi = this.len;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (this.time(m) <= t) lo = m + 1;
      else hi = m;
    }
    return lo;
  }

  extract(t0: number, t1: number): Trace {
    const k = this.upper(t0);
    const known = this.len ? this.time(0) : Infinity;
    const init = k > 0 ? this.val(k - 1) : this.len ? this.val(0) : 0;
    const times: number[] = [];
    const vals: number[] = [];
    for (let i = k; i < this.len; i++) {
      const t = this.time(i);
      if (t > t1) break;
      times.push(t);
      vals.push(this.val(i));
    }
    return { t0, t1, init, times, vals, known };
  }
}

export type Edge = 'rise' | 'fall' | 'either';
export interface Trigger {
  ch: number;
  edge: Edge;
}

export type AcqState = 'stopped' | 'armed' | 'triggered' | 'auto';

// Acquisition control in the style of a bench logic analyzer: Single / Run (repeated) / Stop,
// with an edge trigger or free-running (auto) capture. Display window = 10 divisions around `ref`.
export class Acquisition {
  rec = new Recorder();
  state: AcqState = 'stopped';
  repeat = true;
  trigger: Trigger | null = null;
  base = 100; // cycles per division
  pos = 0; // window centre relative to the trigger, in cycles
  ref = 0; // time of the last trigger (or of the auto capture)
  captured = false;
  captures = 0;
  private trigAt = 0;
  private armedAt = 0;
  private lastAuto = -1;

  get span() {
    return 10 * this.base;
  }
  // window shown for the current capture
  get window(): [number, number] {
    const c = this.ref + this.pos;
    return [c - this.span / 2, c + this.span / 2];
  }

  sample(t: number, v: Uint32Array) {
    const prev = this.rec.last;
    const w = this.rec.sample(t, v);
    if (this.state !== 'armed' || !this.trigger || prev < 0 || t < this.armedAt) return;
    const b0 = (prev >>> this.trigger.ch) & 1;
    const b1 = (w >>> this.trigger.ch) & 1;
    if (b0 === b1) return;
    const e = this.trigger.edge;
    if (e === 'either' || (e === 'rise') === (b1 === 1)) {
      this.trigAt = t;
      this.state = 'triggered';
    }
  }

  run(now: number, single = false) {
    this.repeat = !single;
    this.armedAt = now;
    this.state = this.trigger ? 'armed' : 'auto';
  }

  stop() {
    this.state = 'stopped';
  }

  restart() {
    this.rec.clear();
    if (this.state === 'triggered') this.state = 'armed';
    this.armedAt = 0;
  }

  // Called once per animation frame with the current board time. Returns true when a new capture is ready.
  tick(now: number): boolean {
    if (this.state === 'triggered') {
      const end = this.trigAt + this.pos + this.span / 2;
      if (now < end) return false;
      this.ref = this.trigAt;
      this.finish(now);
      return true;
    }
    if (this.state === 'auto') {
      if (this.captured && now === this.lastAuto) return false;
      this.lastAuto = now;
      // free running: the window ends at "now"
      this.ref = now - this.pos - this.span / 2;
      this.finish(now);
      return true;
    }
    return false;
  }

  private finish(now: number) {
    this.captured = true;
    this.captures++;
    if (!this.repeat) this.state = 'stopped';
    else if (this.trigger) {
      this.state = 'armed';
      this.armedAt = now;
    }
  }
}
