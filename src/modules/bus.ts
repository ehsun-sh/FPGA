// External modules (sensors, Pmods, ...) attached to board pins, and the wires between them and the FPGA.
// A module is a behavioural model in TypeScript: it watches the lines the FPGA drives and drives the lines the FPGA
// reads. The bus resolves every line like real wires: an FPGA output, an FPGA input, or an open-drain line where
// anyone may pull it low and a pull-up makes it high otherwise.
import type { Binding, Mapping } from '../boards/mapping';
import type { CompiledSim, Design } from '../hdl';

// the direction of a module pin as seen from the FPGA: 'in' = the FPGA reads it (the module drives it),
// 'out' = the FPGA drives it, 'od' = open-drain in both directions (I²C)
export type PinIo = 'in' | 'out' | 'od';

export interface ModuleCtx {
  readonly clockHz: number;
  now(): number; // board cycle
  level(role: string): number;
  // drive a line: 0 / 1, or null to release it
  drive(role: string, v: 0 | 1 | null): void;
  // run fn at an absolute board cycle
  at(cycle: number, fn: () => void): void;
}

export interface ModuleInst {
  // a line the module listens to changed (the new level holds from `t` on)
  onChange?(role: string, level: number, t: number): void;
  reset?(): void;
  // a control on the module's card changed (slider, button, switch)
  set?(key: string, value: number): void;
  // a readout for the card (for LEDs: 0..1 brightness per LED)
  read?(key: string): number | number[] | string;
}

interface Line {
  pin: string;
  fpga: { kind: 'in' | 'out' | 'inout'; b: Binding; o?: number; oe?: number } | null;
  pull: number; // level with nobody driving
  drivers: Map<Attached, number>;
  level: number;
  fpgaLevel: number | null; // what the FPGA drives, or null
  watchers: { a: Attached; role: string }[];
}

interface Attached {
  inst: ModuleInst;
  pins: Record<string, string>; // role -> package pin
  io: Record<string, PinIo>;
  timed: boolean;
}

export interface AttachSpec {
  pins: Record<string, string>;
  io: Record<string, PinIo>;
  timed?: boolean;
  create(ctx: ModuleCtx): ModuleInst;
}

export class PinBus {
  private lines = new Map<string, Line>();
  private mods: Attached[] = [];
  private pending: { at: number; seq: number; fn: () => void }[] = [];
  private seq = 0;
  private design: Design | null = null;
  private mapping: Mapping | null = null;
  now = 0;

  constructor(
    public clockHz: number,
    private sim: () => CompiledSim | null,
  ) {}

  get timed() {
    return this.mods.some((m) => m.timed);
  }

  get nextAt(): number {
    return this.pending.length ? this.pending[0].at : Infinity;
  }

  attach(spec: AttachSpec): ModuleInst {
    const a: Attached = { inst: null as unknown as ModuleInst, pins: { ...spec.pins }, io: spec.io, timed: !!spec.timed };
    const ctx: ModuleCtx = {
      clockHz: this.clockHz,
      now: () => this.now,
      level: (role) => this.lines.get(a.pins[role])?.level ?? 0,
      drive: (role, v) => this.drive(a, role, v),
      at: (cycle, fn) => this.at(cycle, () => this.mods.includes(a) && fn()),
    };
    a.inst = spec.create(ctx);
    this.mods.push(a);
    this.rebuild();
    return a.inst;
  }

  detach(inst: ModuleInst) {
    this.mods = this.mods.filter((m) => m.inst !== inst);
    this.rebuild();
  }

  clear() {
    this.mods = [];
    this.pending = [];
    this.rebuild();
  }

  setDesign(design: Design | null, mapping: Mapping | null) {
    this.design = design;
    this.mapping = mapping;
    this.rebuild();
  }

  // signals the FPGA drives on module lines: the host calls refresh() when one of them changes
  sigs(): number[] {
    const out = new Set<number>();
    for (const l of this.lines.values()) {
      if (!l.fpga) continue;
      if (l.fpga.kind === 'out') out.add(l.fpga.b.sig);
      if (l.fpga.kind === 'inout') {
        out.add(l.fpga.o!);
        out.add(l.fpga.oe!);
      }
    }
    return [...out].sort((a, b) => a - b);
  }

  // after the design was reset: modules start over and the lines are driven again
  reset(t = 0) {
    this.now = t;
    this.pending = [];
    for (const l of this.lines.values()) {
      l.drivers.clear();
      l.fpgaLevel = this.fpgaDrive(l);
      l.level = this.resolve(l);
    }
    for (const m of this.mods) m.inst.reset?.();
    this.writeInputs(true);
  }

  // the FPGA's outputs may have changed at board cycle t
  refresh(t: number) {
    this.now = t;
    const changed: Line[] = [];
    for (const l of this.lines.values()) {
      if (!l.fpga || l.fpga.kind === 'in') continue;
      const f = this.fpgaDrive(l);
      if (f === l.fpgaLevel) continue;
      l.fpgaLevel = f;
      const lv = this.resolve(l);
      if (lv !== l.level) {
        l.level = lv;
        changed.push(l);
      }
    }
    if (!changed.length) return;
    if (changed.some((l) => l.fpga?.kind === 'inout')) this.writeInputs(false);
    for (const l of changed) this.notify(l, null);
  }

  // runs the scheduled events up to board cycle `now`
  runDue(now: number): number {
    let n = 0;
    while (this.pending.length && this.pending[0].at <= now) {
      const p = this.pending.shift()!;
      this.now = p.at;
      p.fn();
      n++;
    }
    this.now = now;
    return n;
  }

  private at(cycle: number, fn: () => void) {
    const e = { at: Math.max(cycle, this.now), seq: this.seq++, fn };
    let i = this.pending.length;
    while (i > 0 && (this.pending[i - 1].at > e.at || (this.pending[i - 1].at === e.at && this.pending[i - 1].seq > e.seq))) i--;
    this.pending.splice(i, 0, e);
  }

  private drive(a: Attached, role: string, v: 0 | 1 | null) {
    const l = this.lines.get(a.pins[role]);
    if (!l) return;
    if (a.io[role] === 'od' && v === 1) v = null; // open drain: only pulls low
    if (v === null) l.drivers.delete(a);
    else l.drivers.set(a, v);
    const lv = this.resolve(l);
    if (lv === l.level) return;
    l.level = lv;
    if (l.fpga && l.fpga.kind !== 'out') this.writeInputs(false);
    this.notify(l, a);
  }

  private notify(l: Line, from: Attached | null) {
    for (const w of l.watchers) if (w.a !== from) w.a.inst.onChange?.(w.role, l.level, this.now);
  }

  private fpgaDrive(l: Line): number | null {
    const s = this.sim();
    if (!s || !l.fpga) return null;
    const f = l.fpga;
    if (f.kind === 'out') return (s.v[f.b.sig] >>> f.b.bit) & 1;
    if (f.kind === 'inout') return (s.v[f.oe!] >>> f.b.bit) & 1 ? (s.v[f.o!] >>> f.b.bit) & 1 : null;
    return null;
  }

  private resolve(l: Line): number {
    let lv = 1;
    let any = false;
    if (l.fpgaLevel !== null) {
      lv &= l.fpgaLevel;
      any = true;
    }
    for (const v of l.drivers.values()) {
      lv &= v;
      any = true;
    }
    return any ? lv : l.pull;
  }

  // copies the line levels into the FPGA's input (and inout) ports
  private writeInputs(force: boolean) {
    const s = this.sim();
    if (!s) return;
    let dirty = force;
    for (const l of this.lines.values()) {
      if (!l.fpga || l.fpga.kind === 'out') continue;
      const b = l.fpga.b;
      const m = (1 << b.bit) >>> 0;
      const nv = l.level ? (s.v[b.sig] | m) >>> 0 : (s.v[b.sig] & ~m) >>> 0;
      if (nv !== s.v[b.sig]) {
        s.v[b.sig] = nv;
        dirty = true;
      }
    }
    if (dirty) s.settle();
  }

  private rebuild() {
    const old = this.lines;
    this.lines = new Map();
    const tri = new Map((this.design?.tri ?? []).map((t) => [t.port, t]));
    for (const a of this.mods) {
      for (const [role, pin] of Object.entries(a.pins)) {
        let l = this.lines.get(pin);
        if (!l) {
          const b = this.mapping?.bindings.find((x) => x.pin === pin);
          const dir = b ? this.design?.sigs[b.sig].dir : undefined;
          const t = b ? tri.get(b.sig) : undefined;
          const fpga = b && dir ? (t ? { kind: 'inout' as const, b, o: t.o, oe: t.oe } : { kind: dir === 'input' ? ('in' as const) : ('out' as const), b }) : null;
          l = { pin, fpga, pull: 0, drivers: new Map(), level: 0, fpgaLevel: null, watchers: [] };
          const prev = old.get(pin);
          if (prev) for (const [k, v] of prev.drivers) if (this.mods.includes(k)) l.drivers.set(k, v);
          this.lines.set(pin, l);
        }
        if (a.io[role] === 'od') l.pull = 1;
        l.watchers.push({ a, role });
      }
    }
    for (const l of this.lines.values()) {
      l.fpgaLevel = this.fpgaDrive(l);
      l.level = this.resolve(l);
    }
    this.writeInputs(false);
  }
}
