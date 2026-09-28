// A rough technology mapping of the RTL netlist onto 7-series primitives (LUT6, CARRY4, FDRE, DSP48E1, RAMB36E1, ...).
// It is an estimate for learning, not a real synthesis run, but it responds to the design the way Vivado does: logic
// between registers is packed into 6-input LUTs, adders use carry chains, unused logic is removed, and so on.
import type { Cell, Netlist, Ref } from "./netlist";
import { fmtConst, prettyName } from "./netlist";

export interface Primitive {
  name: string;
  count: number;
  group: string;
}

export interface Util {
  lutLogic: number;
  lutMem: number;
  ffs: number;
  latches: number;
  f7: number;
  f8: number;
  carry4: number;
  bram36: number;
  bram18: number;
  dsp: number;
  iob: number;
  bufg: number;
}

export interface TimingPath {
  from: string;
  to: string;
  delay: number; // ns, data path
  slack: number;
  levels: number;
  steps: { cell: string; type: string; incr: number; at: number }[];
}

export interface Fsm {
  reg: string;
  states: { name: string; code: string }[];
  encoding: string;
}

export interface SynthResult {
  util: Util;
  // per hierarchy path ('' = top), LUTs / FFs
  hier: {
    path: string;
    luts: number;
    ffs: number;
    carry4: number;
    bram: number;
    dsp: number;
  }[];
  prims: Primitive[];
  timing: {
    period: number;
    wns: number;
    tns: number;
    failing: number;
    endpoints: number;
    worst: TimingPath | null;
    clocks: string[];
  };
  fsms: Fsm[];
  removed: string[];
}

const LUT_DELAY = 0.12;
const NET_DELAY = 0.45;
const CLK_Q = 0.45;
const SETUP = 0.06;
const CARRY_DELAY = 0.11;

// cells whose outputs are packed into LUTs together with the logic that feeds them
const LOGIC = new Set(["gate", "mux", "pmux", "bsel", "insert", "concat"]);
const LOGIC_OPS = new Set(["eq", "ne", "redand", "redor", "redxor"]);
const isLogic = (c: Cell) =>
  LOGIC.has(c.type) || (c.type === "op" && LOGIC_OPS.has(c.op!));

export function techMap(nl: Netlist, periodNs = 10): SynthResult {
  const cells = nl.cells;
  const used = (c: Cell) => !c.unused;
  const fanout = new Map<number, number>();
  for (const c of cells)
    if (used(c))
      for (const p of c.ins)
        if (p.src) fanout.set(p.src.cell, (fanout.get(p.src.cell) ?? 0) + 1);

  // ---------------------------------------------------------------- bit-level support of logic cones
  // a logic cell with several readers is a LUT output of its own (the logic is shared, not duplicated)
  const boundary = (c: Cell) => !isLogic(c) || (fanout.get(c.id) ?? 0) > 1;
  const memo = new Map<string, Set<string>>();
  const CAP = 128;
  const union = (a: Set<string>, b: Set<string>) => {
    if (a.size >= CAP) return;
    for (const x of b) {
      a.add(x);
      if (a.size >= CAP) break;
    }
  };
  function refBit(r: Ref | null, i: number, top: boolean): Set<string> {
    if (!r || i >= r.width) return new Set();
    return cellBit(r.cell, r.lo + i, top);
  }
  function refAll(r: Ref | null): Set<string> {
    const s = new Set<string>();
    if (r) for (let i = 0; i < r.width; i++) union(s, refBit(r, i, false));
    return s;
  }
  function cellBit(id: number, bit: number, top: boolean): Set<string> {
    const c = cells[id];
    if (c.type === "const") return new Set();
    if (!top && boundary(c)) return new Set([`${id}:${bit}`]);
    const key = `${id}:${bit}`;
    const m = memo.get(key);
    if (m) return m;
    const s = new Set<string>();
    memo.set(key, s);
    const [a, b, e] = c.ins.map((p) => p.src);
    switch (c.type) {
      case "concat": {
        let at = 0;
        for (const p of c.ins) {
          if (bit < at + p.src!.width) {
            union(s, refBit(p.src, bit - at, false));
            break;
          }
          at += p.src!.width;
        }
        break;
      }
      case "gate":
        for (const p of c.ins) union(s, refBit(p.src, bit, false));
        break;
      case "mux":
        union(s, refBit(a, 0, false));
        union(s, refBit(b, bit, false));
        union(s, refBit(e, bit, false));
        break;
      case "pmux":
        union(s, refAll(a));
        for (const p of c.ins.slice(1)) union(s, refBit(p.src, bit, false));
        break;
      case "bsel":
        union(s, refAll(a));
        union(s, refAll(b));
        break;
      case "insert":
        union(s, refBit(a, bit, false));
        union(s, refAll(b));
        union(s, refAll(e));
        break;
      default: // eq, ne, reductions
        for (const p of c.ins) union(s, refAll(p.src));
    }
    return s;
  }

  // LUTs for one output bit of a logic cone with k inputs: a tree of LUT6s
  const lutsFor = (k: number) => (k <= 1 ? 0 : Math.ceil((k - 1) / 5));
  const lutLevels = (k: number) =>
    k <= 1 ? 0 : Math.ceil(Math.log(k) / Math.log(6) - 1e-9);
  const lutHist = new Map<number, number>();
  const addLut = (k: number, n = 1) => {
    if (k > 6) {
      lutHist.set(6, (lutHist.get(6) ?? 0) + lutsFor(k) * n);
      return;
    }
    lutHist.set(k, (lutHist.get(k) ?? 0) + n);
  };

  const hier = new Map<
    string,
    {
      path: string;
      luts: number;
      ffs: number;
      carry4: number;
      bram: number;
      dsp: number;
    }
  >();
  const H = (path: string) => {
    let h = hier.get(path);
    if (!h)
      hier.set(
        path,
        (h = { path, luts: 0, ffs: 0, carry4: 0, bram: 0, dsp: 0 }),
      );
    return h;
  };
  for (const i of nl.instances) H(i.path);

  const u: Util = {
    lutLogic: 0,
    lutMem: 0,
    ffs: 0,
    latches: 0,
    f7: 0,
    f8: 0,
    carry4: 0,
    bram36: 0,
    bram18: 0,
    dsp: 0,
    iob: 0,
    bufg: 0,
  };
  const prim = new Map<string, Primitive>();
  const P = (name: string, n: number, group: string) => {
    if (n <= 0) return;
    const p = prim.get(name) ?? { name, count: 0, group };
    p.count += n;
    prim.set(name, p);
  };

  // roots of logic cones: logic bits read by a non-logic cell or shared by several readers
  const coneLuts = new Map<number, { luts: number; levels: number[] }>();
  const cone = (id: number) => {
    let r = coneLuts.get(id);
    if (r) return r;
    const c = cells[id];
    r = { luts: 0, levels: [] };
    for (let bit = 0; bit < c.width; bit++) {
      const s = cellBit(id, bit, true);
      let k = s.size;
      // an inverter or a buffer ends up inside the next LUT or FF; count one LUT only for a lone inverter
      const n =
        k <= 1 ? (c.type === "gate" && c.op === "not" ? 1 : 0) : lutsFor(k);
      if (n) addLut(Math.max(1, Math.min(k, 7)));
      r.luts += n;
      r.levels.push(k <= 1 ? n : lutLevels(k));
      if (c.type === "pmux") {
        const items = c.ins.length - 1;
        if (items > 4) u.f7 += 1;
        if (items > 8) u.f8 += 1;
      }
      k = 0;
    }
    coneLuts.set(id, r);
    return r;
  };

  const clocks = new Set<number>();
  const removed: string[] = [];
  for (const c of cells) {
    if (!used(c)) {
      if (c.type === "reg" || c.type === "latch")
        removed.push(`${prettyName(c.name!)}_reg`);
      continue;
    }
    const h = H(c.path);
    if (isLogic(c)) {
      if (!boundary(c)) continue;
      const r = cone(c.id);
      u.lutLogic += r.luts;
      h.luts += r.luts;
      continue;
    }
    const w = c.width;
    const inW = (i: number) => c.ins[i]?.src?.width ?? 0;
    const constIn = (i: number) => {
      const s = c.ins[i]?.src;
      return !!s && cells[s.cell].type === "const";
    };
    let luts = 0;
    let carry = 0;
    switch (c.type) {
      case "in":
        u.iob += w;
        P(c.width && isClock(c) ? "IBUF" : "IBUF", w, "IO");
        break;
      case "out": {
        u.iob += w;
        const src = c.ins[0].src;
        if (!(src && cells[src.cell].type === "tri")) P("OBUF", w, "IO");
        break;
      }
      case "tri":
        P("OBUFT", w, "IO");
        break;
      case "reg": {
        u.ffs += w;
        h.ffs += w;
        const clk = c.ins.find((p) => p.name === "C")?.src;
        if (clk) clocks.add(clk.cell);
        const hasR = c.ins.some((p) => p.name === "CLR" || p.name === "PRE");
        for (let b = 0; b < w; b++) {
          const one = ((c.arst?.value ?? 0) >>> b) & 1;
          P(
            hasR
              ? one
                ? "FDPE"
                : "FDCE"
              : ((c.srst ?? c.init ?? 0) >>> b) & 1
                ? "FDSE"
                : "FDRE",
            1,
            "Register",
          );
        }
        break;
      }
      case "latch":
        u.latches += w;
        h.ffs += w;
        P("LDCE", w, "Register");
        break;
      case "op":
        switch (c.op) {
          case "add":
          case "sub":
          case "neg":
            luts = w;
            carry = Math.ceil(w / 4);
            break;
          case "lt":
          case "le":
          case "gt":
          case "ge": {
            const cw = Math.max(inW(0), inW(1));
            luts =
              constIn(0) || constIn(1) ? Math.ceil(cw / 3) : Math.ceil(cw / 2);
            carry = Math.ceil(cw / 8);
            break;
          }
          case "mul": {
            const a = inW(0);
            const b = inW(1);
            if (constIn(0) || constIn(1) || Math.min(a, b) <= 4) {
              luts = Math.ceil((a * b) / 2);
              carry = Math.ceil(w / 4);
            } else {
              const n =
                Math.ceil(Math.max(a, b) / 25) * Math.ceil(Math.min(a, b) / 18);
              u.dsp += n;
              h.dsp += n;
              P("DSP48E1", n, "Arithmetic");
            }
            break;
          }
          case "div":
          case "mod":
          case "pow": {
            const bc = c.ins[1]?.src;
            const v =
              bc && cells[bc.cell].type === "const"
                ? cells[bc.cell].value!
                : -1;
            if (v > 0 && (v & (v - 1)) === 0) break; // by a power of two: wiring only
            luts = inW(0) * Math.max(inW(1), 1);
            carry = Math.ceil((inW(0) * Math.max(inW(1), 1)) / 4);
            break;
          }
          case "shl":
          case "shr":
          case "sshr":
            luts = Math.ceil(
              (w * Math.max(1, Math.ceil(Math.log2(Math.max(2, w))))) / 3,
            );
            break;
        }
        break;
      case "ramrd":
        break; // counted with the memory
      case "ram": {
        const depth = c.init ?? 1;
        const bits = depth * w;
        const written = c.op === "ram";
        if (bits > 4096 && depth > 64) {
          const b36 = Math.max(1, Math.ceil(bits / 36864));
          if (bits <= 18432) {
            u.bram18 += 1;
            P("RAMB18E1", 1, "Block Memory");
          } else {
            u.bram36 += b36;
            P("RAMB36E1", b36, "Block Memory");
          }
          h.bram += bits <= 18432 ? 0.5 : b36;
        } else {
          const n = w * Math.ceil(depth / 64) * (written ? 1 : 1);
          if (written) {
            u.lutMem += n;
            P(depth <= 32 ? "RAM32X1S" : "RAM64X1S", n, "Distributed Memory");
          } else {
            u.lutLogic += n;
            addLut(Math.min(6, Math.max(1, Math.ceil(Math.log2(depth)))), n);
          }
          h.luts += n;
        }
        break;
      }
    }
    if (luts) {
      u.lutLogic += luts;
      h.luts += luts;
      addLut(
        c.type === "op" && (c.op === "add" || c.op === "sub") ? 2 : 4,
        luts,
      );
    }
    if (carry) {
      u.carry4 += carry;
      h.carry4 += carry;
      P("CARRY4", carry, "CarryLogic");
    }
    // the inputs of a non-logic cell are cone roots
  }
  // logic cones that end on non-logic cells but are read only once are counted here
  for (const c of cells) {
    if (!used(c) || isLogic(c)) continue;
    for (const p of c.ins) {
      if (!p.src) continue;
      const s = cells[p.src.cell];
      if (s.unused || !isLogic(s) || boundary(s)) continue;
      const r = cone(s.id);
      u.lutLogic += r.luts;
      H(s.path).luts += r.luts;
    }
  }
  function isClock(c: Cell) {
    return cells.some(
      (r) =>
        r.type === "reg" &&
        r.ins.some((p) => p.name === "C" && p.src?.cell === c.id),
    );
  }
  u.bufg = clocks.size;
  P("BUFG", clocks.size, "Clock");
  for (const [k, n] of [...lutHist].sort((a, b) => a[0] - b[0]))
    P(`LUT${k}`, n, "LUT");
  P("MUXF7", u.f7, "MuxFx");
  P("MUXF8", u.f8, "MuxFx");

  // ---------------------------------------------------------------- timing (register to register)
  const arrival = new Map<
    number,
    { t: number; from: number; prev: number; levels: number }
  >();
  const visiting = new Set<number>();
  function arr(id: number): {
    t: number;
    from: number;
    prev: number;
    levels: number;
  } {
    const a = arrival.get(id);
    if (a) return a;
    const c = cells[id];
    if (c.type === "reg" || c.type === "latch")
      return { t: CLK_Q, from: id, prev: -1, levels: 0 };
    if (c.type === "in" || c.type === "const" || visiting.has(id))
      return { t: -Infinity, from: -1, prev: -1, levels: 0 };
    if (c.type === "ram")
      return {
        t: c.ins.length && cellsBram(c) ? 2.2 : -Infinity,
        from: id,
        prev: -1,
        levels: 0,
      };
    visiting.add(id);
    let best = { t: -Infinity, from: -1, prev: -1, levels: 0 };
    for (const p of c.ins) {
      if (!p.src) continue;
      const x = arr(p.src.cell);
      if (x.t > best.t) best = { ...x, prev: p.src.cell };
    }
    visiting.delete(id);
    let d = 0;
    let lv = 0;
    if (isLogic(c)) {
      if (c.type !== "concat") {
        // a logic cell adds a share of a LUT level: roughly 2 to 3 gates fit in one LUT6
        d = boundary(c) ? LUT_DELAY + NET_DELAY : (LUT_DELAY + NET_DELAY) * 0.4;
        lv = boundary(c) ? 1 : 0.4;
      }
    } else if (c.type === "op") {
      const w = Math.max(c.width, ...c.ins.map((p) => p.src?.width ?? 0));
      if (["add", "sub", "neg", "lt", "le", "gt", "ge"].includes(c.op!)) {
        d = LUT_DELAY + NET_DELAY + CARRY_DELAY * Math.ceil(w / 4) + 0.2;
        lv = 1 + Math.ceil(w / 4);
      } else if (c.op === "mul") {
        d = 3.4;
        lv = 1;
      } else {
        d =
          (LUT_DELAY + NET_DELAY) *
          Math.max(2, Math.ceil(Math.log2(Math.max(2, w))) * 2);
        lv = Math.max(2, Math.ceil(Math.log2(Math.max(2, w))) * 2);
      }
    } else if (c.type === "ramrd") {
      d = 1.1;
      lv = 1;
    }
    const out = {
      t: best.t + d,
      from: best.from,
      prev: best.prev,
      levels: best.levels + lv,
    };
    arrival.set(id, out);
    return out;
  }
  function cellsBram(c: Cell) {
    return (c.init ?? 1) * c.width > 4096 && (c.init ?? 1) > 64;
  }
  let worst: TimingPath | null = null;
  let wns = Infinity;
  let tns = 0;
  let failing = 0;
  let endpoints = 0;
  for (const c of cells) {
    if (!used(c) || c.type !== "reg") continue;
    for (const p of c.ins) {
      if (!p.src || p.name === "C" || p.name === "CLR" || p.name === "PRE")
        continue;
      const a = arr(p.src.cell);
      for (let b = 0; b < (p.name === "D" ? c.width : 1); b++) endpoints++;
      if (a.t === -Infinity) continue;
      const t = a.t + NET_DELAY * 0.5;
      const slack = periodNs - t - SETUP;
      if (slack < 0) {
        failing++;
        tns += slack;
      }
      if (slack < wns) {
        wns = slack;
        const steps: TimingPath["steps"] = [];
        let cur = p.src.cell;
        const chain: number[] = [];
        while (cur >= 0 && chain.length < 64) {
          chain.push(cur);
          const x = arrival.get(cur);
          cur = x ? x.prev : -1;
        }
        chain.reverse();
        let last = 0;
        for (const id of chain) {
          const cc = cells[id];
          const at = cc.type === "reg" ? CLK_Q : (arrival.get(id)?.t ?? 0);
          steps.push({
            cell: cellLabel(cc, nl),
            type: primName(cc),
            incr: +(at - last).toFixed(3),
            at: +at.toFixed(3),
          });
          last = at;
        }
        steps.push({
          cell: cellLabel(c, nl) + `/${p.name}`,
          type: primName(c),
          incr: +(t - last).toFixed(3),
          at: +t.toFixed(3),
        });
        worst = {
          from: steps[0]?.cell ?? "",
          to: cellLabel(c, nl),
          delay: +t.toFixed(3),
          slack: +slack.toFixed(3),
          levels: Math.round(a.levels),
          steps,
        };
      }
    }
  }
  if (wns === Infinity) wns = periodNs;

  // ---------------------------------------------------------------- FSMs: a register that only takes constant values and decides its own next value
  const fsms: Fsm[] = [];
  for (const c of cells) {
    if (c.type !== "reg" || !used(c) || c.width > 16) continue;
    const vals = new Set<number>();
    let ok = true;
    let selfDecides = false;
    const seen = new Set<number>();
    const walk = (r: Ref | null, depth: number) => {
      if (!r || !ok || depth > 40) return;
      const x = cells[r.cell];
      if (x.id === c.id) return; // holds its value
      if (seen.has(x.id)) return;
      seen.add(x.id);
      if (x.type === "const") {
        vals.add(
          ((x.value! >>> r.lo) & ((1 << Math.min(r.width, 31)) - 1)) >>> 0,
        );
        return;
      }
      if (x.type === "mux") {
        if (dependsOn(x.ins[0].src, c.id, 6)) selfDecides = true;
        walk(x.ins[1].src, depth + 1);
        walk(x.ins[2].src, depth + 1);
        return;
      }
      if (x.type === "pmux") {
        if (dependsOn(x.ins[0].src, c.id, 6)) selfDecides = true;
        for (const p of x.ins.slice(1)) walk(p.src, depth + 1);
        return;
      }
      ok = false;
    };
    function dependsOn(r: Ref | null, target: number, depth: number): boolean {
      if (!r || depth < 0) return false;
      if (r.cell === target) return true;
      const x = cells[r.cell];
      if (x.type === "reg") return false;
      return x.ins.some((p) => dependsOn(p.src, target, depth - 1));
    }
    const D = c.ins.find((p) => p.name === "D")?.src ?? null;
    walk(D, 0);
    if (c.arst) vals.add(c.arst.value);
    vals.add(c.init ?? 0);
    if (!ok || !selfDecides || vals.size < 3) continue;
    const sig = nl.design.sigs[c.sig!];
    const lits = sig.enumLits;
    const states = [...vals]
      .sort((a, b) => a - b)
      .map((v) => ({
        name: lits?.[v] ?? `S${v}`,
        code: fmtConst(v, c.width).replace(/^\d+'/, ""),
      }));
    const onehot = [...vals].every((v) => v && (v & (v - 1)) === 0);
    fsms.push({
      reg: `${prettyName(c.name!)}_reg`,
      states,
      encoding: onehot ? "one-hot" : lits ? "sequential" : "user",
    });
  }

  return {
    util: u,
    hier: [...hier.values()].sort((a, b) => a.path.localeCompare(b.path)),
    prims: [...prim.values()],
    timing: {
      period: periodNs,
      wns: +wns.toFixed(3),
      tns: +tns.toFixed(3),
      failing,
      endpoints,
      worst,
      clocks: [...clocks].map(
        (id) => nl.netNames.get(id) ?? cells[id].name ?? "?",
      ),
    },
    fsms,
    removed,
  };
}

export function primName(c: Cell): string {
  switch (c.type) {
    case "reg":
      return c.ins.some((p) => p.name === "CLR")
        ? "FDCE"
        : c.ins.some((p) => p.name === "PRE")
          ? "FDPE"
          : "FDRE";
    case "latch":
      return "LDCE";
    case "op":
      return ["add", "sub", "neg", "lt", "le", "gt", "ge"].includes(c.op!)
        ? "CARRY4"
        : c.op === "mul"
          ? "DSP48E1"
          : "LUT6";
    case "ramrd":
    case "ram":
      return "RAM";
    default:
      return "LUT";
  }
}

// the name Vivado would show for a cell
export function cellLabel(c: Cell, nl: Netlist): string {
  switch (c.type) {
    case "reg":
    case "latch":
      return `${prettyName(c.name!)}_reg${c.width > 1 ? `[${c.width - 1}:0]` : ""}`;
    case "in":
    case "out":
    case "tri":
      return c.name!;
    case "ram":
      return `${prettyName(c.name!)}_reg`;
    default: {
      const n = nl.netNames.get(c.id);
      return n ? `${n}_i` : `${c.path}${rtlName(c).toLowerCase()}_${c.id}`;
    }
  }
}

export function rtlName(c: Cell): string {
  switch (c.type) {
    case "gate":
      return `RTL_${c.op!.toUpperCase()}`;
    case "mux":
    case "pmux":
    case "bsel":
      return "RTL_MUX";
    case "insert":
      return "RTL_BSEL";
    case "reg":
      return "RTL_REG";
    case "latch":
      return "RTL_LATCH";
    case "ram":
      return c.op === "rom" ? "RTL_ROM" : "RTL_RAM";
    case "ramrd":
      return "RTL_RAM_RD";
    case "tri":
      return "RTL_TRIBUF";
    case "concat":
      return "RTL_CONCAT";
    case "op": {
      const m: Record<string, string> = {
        add: "RTL_ADD",
        sub: "RTL_SUB",
        neg: "RTL_NEG",
        mul: "RTL_MULT",
        div: "RTL_DIV",
        mod: "RTL_MOD",
        pow: "RTL_POWER",
        eq: "RTL_EQ",
        ne: "RTL_NEQ",
        lt: "RTL_LT",
        le: "RTL_LEQ",
        gt: "RTL_GT",
        ge: "RTL_GEQ",
        redand: "RTL_REDUCTION_AND",
        redor: "RTL_REDUCTION_OR",
        redxor: "RTL_REDUCTION_XOR",
        shl: "RTL_LSHIFT",
        shr: "RTL_RSHIFT",
        sshr: "RTL_RSHIFT",
      };
      return m[c.op!] ?? `RTL_${c.op!.toUpperCase()}`;
    }
    default:
      return c.type.toUpperCase();
  }
}

// text report, like `report_utilization` in the Tcl console
export function utilizationText(
  r: SynthResult,
  top: string,
  part: string,
  avail: { luts: number; ffs: number; iob: number; bram: number; dsp?: number },
): string {
  const pct = (a: number, b: number) => ((a / b) * 100).toFixed(2);
  const rows: [string, number | string, number | string, string][] = [
    [
      "Slice LUTs",
      r.util.lutLogic + r.util.lutMem,
      avail.luts,
      pct(r.util.lutLogic + r.util.lutMem, avail.luts),
    ],
    [
      "  LUT as Logic",
      r.util.lutLogic,
      avail.luts,
      pct(r.util.lutLogic, avail.luts),
    ],
    ["  LUT as Memory", r.util.lutMem, 19000, pct(r.util.lutMem, 19000)],
    [
      "Slice Registers",
      r.util.ffs + r.util.latches,
      avail.ffs,
      pct(r.util.ffs + r.util.latches, avail.ffs),
    ],
    [
      "  Register as Flip Flop",
      r.util.ffs,
      avail.ffs,
      pct(r.util.ffs, avail.ffs),
    ],
    [
      "  Register as Latch",
      r.util.latches,
      avail.ffs,
      pct(r.util.latches, avail.ffs),
    ],
    ["F7 Muxes", r.util.f7, 31700, pct(r.util.f7, 31700)],
    ["F8 Muxes", r.util.f8, 15850, pct(r.util.f8, 15850)],
    [
      "Block RAM Tile",
      r.util.bram36 + r.util.bram18 / 2,
      avail.bram,
      pct(r.util.bram36 + r.util.bram18 / 2, avail.bram),
    ],
    ["DSPs", r.util.dsp, avail.dsp ?? 240, pct(r.util.dsp, avail.dsp ?? 240)],
    ["Bonded IOB", r.util.iob, avail.iob, pct(r.util.iob, avail.iob)],
    ["BUFGCTRL", r.util.bufg, 32, pct(r.util.bufg, 32)],
  ];
  const line = "+-------------------------+------+-----------+-------+";
  const out = [
    `Utilization Design Information (estimate)`,
    `| Design : ${top}`,
    `| Device : ${part}`,
    line,
    "|        Site Type        | Used | Available | Util% |",
    line,
    ...rows.map(
      ([n, u, a, p]) =>
        `| ${n.padEnd(23)} | ${String(u).padStart(4)} | ${String(a).padStart(9)} | ${p.padStart(5)} |`,
    ),
    line,
  ];
  return out.join("\n");
}
