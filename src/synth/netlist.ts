// RTL netlist: what the elaborated design looks like as hardware, like Vivado's "Open Elaborated Design".
// Every process is executed symbolically: an `if` turns into a multiplexer, a `case` into a wide multiplexer, a
// clocked process into registers whose D input is the logic that computes the next value, and a combinational process
// that does not assign a signal on every path into a latch.
import type { Loc } from "../hdl/ast";
import type { Design, Expr, LVal, Proc, Stmt } from "../hdl/ir";
import { bitsFor, mask } from "../hdl/ir";

export type CellType =
  | "in" // top-level input port
  | "out" // top-level output port
  | "const"
  | "reg" // flip-flop (RTL_REG)
  | "latch"
  | "gate" // bitwise and / or / xor / xnor / not
  | "op" // arithmetic, comparison, reduction, variable shift
  | "mux" // 2:1 multiplexer: ins = [S, I0, I1]
  | "pmux" // case multiplexer: ins = [S, item0, item1, ..., default]
  | "bsel" // variable bit select: ins = [data, index]
  | "insert" // variable bit assignment: ins = [old, value, index]
  | "concat" // bus merge, ins LSB first
  | "ram" // memory array: ins = write ports (WE, WA, WD)*
  | "ramrd" // memory read: ins = [memory, address]
  | "tri" // tri-state buffer: ins = [I, T (drive enable)]
  | "sigref" // placeholder for a signal's value, replaced by its driver
  | "hole"; // placeholder: "not assigned by this process"

export interface Ref {
  cell: number;
  lo: number;
  width: number;
}

export interface Pin {
  name: string;
  src: Ref | null;
}

export interface Cell {
  id: number;
  type: CellType;
  op?: string;
  width: number;
  ins: Pin[];
  // signal / port / instance-style name (registers: the signal the register drives)
  name?: string;
  // hierarchy path, e.g. 'u_div.' ('' = top)
  path: string;
  sig?: number;
  value?: number;
  // pmux: one label per item (constants shown on the select input)
  labels?: string[];
  loc?: Loc;
  // registers
  negedge?: boolean;
  arst?: { value: number; high: boolean };
  srst?: number; // synchronous reset / set value
  init?: number;
  mem?: number;
  // removed by synthesis: does not reach an output
  unused?: boolean;
}

export interface Netlist {
  design: Design;
  cells: Cell[];
  // net names: cell id -> name of the signal that cell's output drives
  netNames: Map<number, string>;
  warnings: { code: string; msg: string; loc?: Loc }[];
  // hierarchy paths ('' = top) with the module name
  instances: { path: string; module: string }[];
}

// 'u1.proc0.x' -> path 'u1.', leaf 'x'
export function splitName(full: string): { path: string; leaf: string } {
  const parts = full.split(".");
  const leaf = parts.pop()!;
  const path = parts.filter((p) => !/^proc\d+$/.test(p)).join(".");
  return { path: path ? path + "." : "", leaf };
}

export function prettyName(full: string): string {
  const { path, leaf } = splitName(full);
  return path + leaf.replace(/#loop\d+$/, "");
}

interface Env {
  b: Map<number, Ref>; // blocking writes (and every write in a combinational process)
  nb: Map<number, Ref>; // non-blocking writes in a clocked process
}

interface MemWrite {
  we: Ref;
  addr: Ref;
  data: Ref;
}

export function buildNetlist(d: Design): Netlist {
  const cells: Cell[] = [];
  const warnings: Netlist["warnings"] = [];
  const consts = new Map<string, number>();
  const sigrefs = new Map<number, number>();
  const holes = new Map<number, number>();
  const drivers = new Map<number, Ref>();
  const combParts = new Map<number, { lo: number; ref: Ref }[]>();
  const memWrites = new Map<number, { clk: Ref | null; w: MemWrite }[]>();
  const regOf = new Map<number, number>();

  // structurally identical logic is built once (like Vivado's resource sharing of equal comparators)
  const shared = new Map<string, number>();
  const add = (c: Omit<Cell, "id">): number => {
    let key = "";
    if (["gate", "op", "mux", "pmux", "concat", "bsel"].includes(c.type)) {
      key = `${c.type}|${c.op ?? ""}|${c.width}|${c.path}|${c.labels?.join(",") ?? ""}|${c.ins.map((p) => (p.src ? `${p.src.cell}:${p.src.lo}:${p.src.width}` : "-")).join(",")}`;
      const hit = shared.get(key);
      if (hit !== undefined) return hit;
    }
    const id = cells.length;
    if (key) shared.set(key, id);
    cells.push({ ...c, id } as Cell);
    return id;
  };
  const full = (cell: number): Ref => ({
    cell,
    lo: 0,
    width: cells[cell].width,
  });
  const pathOf = (sig: number) => splitName(d.sigs[sig].name).path;

  const konst = (value: number, width: number): Ref => {
    width = Math.max(1, Math.min(32, width || bitsFor(value >>> 0)));
    value = (value & mask(width)) >>> 0;
    const key = `${value}/${width}`;
    let id = consts.get(key);
    if (id === undefined) {
      id = add({ type: "const", width, ins: [], value, path: "" });
      consts.set(key, id);
    }
    return full(id);
  };
  const isConst = (r: Ref) => cells[r.cell].type === "const";
  const constVal = (r: Ref) =>
    ((cells[r.cell].value! >>> r.lo) & mask(r.width)) >>> 0;
  const same = (a: Ref, b: Ref) =>
    a.cell === b.cell && a.lo === b.lo && a.width === b.width;

  const sigref = (id: number): Ref => {
    let c = sigrefs.get(id);
    if (c === undefined) {
      c = add({
        type: "sigref",
        width: d.sigs[id].width,
        ins: [],
        sig: id,
        path: pathOf(id),
      });
      sigrefs.set(id, c);
    }
    return full(c);
  };
  const hole = (id: number): Ref => {
    let c = holes.get(id);
    if (c === undefined) {
      c = add({
        type: "hole",
        width: d.sigs[id].width,
        ins: [],
        sig: id,
        path: pathOf(id),
      });
      holes.set(id, c);
    }
    return full(c);
  };

  // bits [lo, lo+width) of r; looks through bus merges and constants
  function slice(r: Ref, lo: number, width: number): Ref {
    if (width <= 0) return { cell: r.cell, lo: r.lo, width: 0 };
    if (lo <= 0 && width >= r.width) return r;
    width = Math.max(1, Math.min(width, r.width - lo));
    if (lo >= r.width) return konst(0, width);
    const c = cells[r.cell];
    if (c.type === "const") return konst(constVal(r) >>> lo, width);
    const abs = r.lo + lo;
    if (c.type === "concat") {
      let at = 0;
      for (const p of c.ins) {
        const pw = p.src!.width;
        if (abs >= at && abs + width <= at + pw)
          return slice(p.src!, abs - at, width);
        at += pw;
      }
    }
    return { cell: r.cell, lo: abs, width };
  }

  // a bus from parts (LSB first); merges neighbouring slices of the same cell
  function concat(parts: Ref[], path: string): Ref {
    const flat: Ref[] = [];
    for (const p of parts) {
      if (p.width <= 0) continue;
      const pc = cells[p.cell];
      if (pc.type === "concat" && p.lo === 0 && p.width === pc.width)
        flat.push(...pc.ins.map((i) => i.src!));
      else flat.push(p);
    }
    const merged: Ref[] = [];
    for (const p of flat) {
      const last = merged[merged.length - 1];
      if (
        last &&
        last.cell === p.cell &&
        last.lo + last.width === p.lo &&
        !isConst(p)
      )
        last.width += p.width;
      else if (
        last &&
        isConst(last) &&
        isConst(p) &&
        last.width + p.width <= 32
      )
        merged[merged.length - 1] = konst(
          constVal(last) | (constVal(p) << last.width),
          last.width + p.width,
        );
      else merged.push({ ...p });
    }
    if (merged.length === 1) return merged[0];
    const width = merged.reduce((s, p) => s + p.width, 0);
    return full(
      add({
        type: "concat",
        width,
        ins: merged.map((src, i) => ({ name: String(i), src })),
        path,
      }),
    );
  }

  const fold = (op: string, a: number, b: number, w: number): number | null => {
    const m = mask(w);
    switch (op) {
      case "+":
        return (a + b) & m;
      case "-":
        return (a - b) & m;
      case "*":
        return Math.imul(a, b) & m;
      case "&":
        return a & b;
      case "|":
        return a | b;
      case "^":
        return (a ^ b) & m;
      case "<<":
        return b >= 32 ? 0 : (a << b) & m;
      case ">>":
        return b >= 32 ? 0 : a >>> b;
      case "==":
        return a === b ? 1 : 0;
      case "!=":
        return a !== b ? 1 : 0;
      case "<":
        return a < b ? 1 : 0;
      case "<=":
        return a <= b ? 1 : 0;
      case ">":
        return a > b ? 1 : 0;
      case ">=":
        return a >= b ? 1 : 0;
      case "&&":
        return a && b ? 1 : 0;
      case "||":
        return a || b ? 1 : 0;
      case "/":
        return b ? Math.floor(a / b) & m : 0;
      case "%":
        return b ? a % b : 0;
    }
    return null;
  };

  let curPath = "";
  let curLoc: Loc | undefined;

  const gate = (op: string, ins: Ref[], width: number): Ref =>
    full(
      add({
        type: "gate",
        op,
        width,
        ins: ins.map((src, i) => ({ name: op === "not" ? "I" : `I${i}`, src })),
        path: curPath,
        loc: curLoc,
      }),
    );
  const opCell = (
    op: string,
    ins: Ref[],
    width: number,
    names = ["A", "B"],
  ): Ref =>
    full(
      add({
        type: "op",
        op,
        width,
        ins: ins.map((src, i) => ({ name: names[i] ?? `I${i}`, src })),
        path: curPath,
        loc: curLoc,
      }),
    );

  // 1-bit truth value of r
  function bool(r: Ref): Ref {
    if (r.width === 1) return r;
    if (isConst(r)) return konst(constVal(r) ? 1 : 0, 1);
    return opCell("redor", [r], 1, ["I"]);
  }
  function not1(r: Ref): Ref {
    if (isConst(r)) return konst(constVal(r) ? 0 : 1, 1);
    const c = cells[r.cell];
    if (c.type === "gate" && c.op === "not" && c.width === 1)
      return c.ins[0].src!;
    return gate("not", [r], 1);
  }
  function and1(a: Ref | null, b: Ref): Ref {
    if (!a) return b;
    if (isConst(a)) return constVal(a) ? b : a;
    if (isConst(b)) return constVal(b) ? a : b;
    return gate("and", [a, b], 1);
  }
  function mux(s: Ref, i0: Ref, i1: Ref): Ref {
    if (same(i0, i1)) return i0;
    if (isConst(s)) return constVal(s) ? i1 : i0;
    const width = Math.max(i0.width, i1.width);
    return full(
      add({
        type: "mux",
        width,
        ins: [
          { name: "S", src: s },
          { name: "I0", src: i0 },
          { name: "I1", src: i1 },
        ],
        path: curPath,
        loc: curLoc,
      }),
    );
  }

  const edgeOf = (e: Expr): Expr | null => {
    if (e.k === "edge" || e.k === "event") return e;
    if (e.k === "bin" && (e.op === "&&" || e.op === "&"))
      return edgeOf(e.a) ?? edgeOf(e.b);
    return null;
  };
  const withoutEdge = (e: Expr): Expr | null => {
    if (e.k === "edge" || e.k === "event") return null;
    if (e.k === "bin" && (e.op === "&&" || e.op === "&")) {
      const a = withoutEdge(e.a);
      const b = withoutEdge(e.b);
      if (!a) return b;
      if (!b) return a;
      return { ...e, a, b };
    }
    return e;
  };

  // ---------------------------------------------------------------- expressions
  let env: Env = { b: new Map(), nb: new Map() };
  let comb = true;

  const read = (id: number): Ref => env.b.get(id) ?? sigref(id);
  // the value a signal keeps when a branch does not assign it
  const keep = (id: number, nb: boolean): Ref =>
    (nb ? env.nb.get(id) : undefined) ??
    env.b.get(id) ??
    (comb ? hole(id) : sigref(id));

  function ex(e: Expr): Ref {
    switch (e.k) {
      case "const":
        return konst(e.value, e.width || bitsFor(e.value >>> 0));
      case "sig":
        return read(e.id);
      case "sel": {
        const a = ex(e.a);
        const lo = ex(e.lo);
        if (isConst(lo)) return slice(a, constVal(lo), e.width);
        return full(
          add({
            type: "bsel",
            width: e.width,
            ins: [
              { name: "D", src: a },
              { name: "S", src: lo },
            ],
            path: curPath,
            loc: curLoc,
          }),
        );
      }
      case "mem": {
        const addr = ex(e.addr);
        const m = d.mems[e.mem];
        return full(
          add({
            type: "ramrd",
            width: m.width,
            ins: [
              { name: "M", src: null },
              { name: "A", src: addr },
            ],
            mem: e.mem,
            path: splitName(m.name).path,
            loc: curLoc,
          }),
        );
      }
      case "un": {
        const a = ex(e.a);
        switch (e.op) {
          case "+":
            return a;
          case "~":
            if (isConst(a)) return konst(~constVal(a), a.width);
            return gate("not", [a], a.width);
          case "!":
            return not1(bool(a));
          case "-":
            if (isConst(a)) return konst(-constVal(a), a.width);
            return opCell("neg", [a], a.width, ["I"]);
          default: {
            const red = e.op.replace("~", "");
            const opn =
              red === "&" ? "redand" : red === "|" ? "redor" : "redxor";
            if (isConst(a)) {
              const v = constVal(a);
              const r =
                red === "&"
                  ? v === mask(a.width)
                    ? 1
                    : 0
                  : red === "|"
                    ? v
                      ? 1
                      : 0
                    : v.toString(2).split("1").length % 2 === 0
                      ? 1
                      : 0;
              return konst(e.op.startsWith("~") ? r ^ 1 : r, 1);
            }
            if (a.width === 1 && red !== "^")
              return e.op.startsWith("~") ? not1(a) : a;
            const r = opCell(opn, [a], 1, ["I"]);
            return e.op.startsWith("~") ? not1(r) : r;
          }
        }
      }
      case "bin": {
        const op = e.op;
        if (op === "&&" || op === "||") {
          const a = bool(ex(e.a));
          const b = bool(ex(e.b));
          if (isConst(a) && isConst(b))
            return konst(fold(op, constVal(a), constVal(b), 1)!, 1);
          if (op === "&&") return and1(a, b);
          if (isConst(a)) return constVal(a) ? a : b;
          if (isConst(b)) return constVal(b) ? b : a;
          return gate("or", [a, b], 1);
        }
        const a = ex(e.a);
        const b = ex(e.b);
        const cmp = ["==", "!=", "===", "!==", "<", "<=", ">", ">="].includes(
          op,
        );
        // an unsized constant (32 bits in Verilog) is only as wide as its value next to a signal
        const effW = (r: Ref, other: Ref) =>
          isConst(r) && !isConst(other)
            ? Math.min(r.width, Math.max(other.width, bitsFor(constVal(r))))
            : r.width;
        const wa = effW(a, b);
        const wb = effW(b, a);
        const w = cmp
          ? 1
          : ["<<", ">>", "<<<", ">>>", "**"].includes(op)
            ? a.width
            : Math.max(wa, wb);
        const nop =
          op === "===" ? "==" : op === "!==" ? "!=" : op === "<<<" ? "<<" : op;
        if (isConst(a) && isConst(b)) {
          const v = fold(
            nop === ">>>" ? ">>" : nop,
            constVal(a),
            constVal(b),
            Math.max(w, 1),
          );
          if (v !== null) return konst(v, w);
        }
        if (
          (op === "<<" || op === "<<<" || op === ">>" || op === ">>>") &&
          isConst(b)
        ) {
          const k = constVal(b);
          if (k >= a.width) return konst(0, a.width);
          if (op === "<<" || op === "<<<")
            return concat([konst(0, k), slice(a, 0, a.width - k)], curPath);
          if (op === ">>>") {
            const sign = slice(a, a.width - 1, 1);
            return concat(
              [
                slice(a, k, a.width - k),
                ...Array.from({ length: k }, () => sign),
              ],
              curPath,
            );
          }
          return concat([slice(a, k, a.width - k), konst(0, k)], curPath);
        }
        if (["&", "|", "^", "~^", "^~"].includes(op)) {
          // x & 0, x | all-ones, ...
          const gop =
            op === "&"
              ? "and"
              : op === "|"
                ? "or"
                : op === "^"
                  ? "xor"
                  : "xnor";
          for (const [x, y] of [
            [a, b],
            [b, a],
          ] as const) {
            if (!isConst(y) || y.width < x.width) continue;
            const v = constVal(slice(y, 0, x.width));
            if (gop === "and" && v === mask(x.width)) return x;
            if (gop === "and" && v === 0) return konst(0, w);
            if (gop === "or" && v === 0) return x;
            if (gop === "xor" && v === 0) return x;
          }
          return gate(gop, [a, b], w);
        }
        const names: Record<string, string> = {
          "+": "add",
          "-": "sub",
          "*": "mul",
          "/": "div",
          "%": "mod",
          "**": "pow",
          "==": "eq",
          "!=": "ne",
          "<": "lt",
          "<=": "le",
          ">": "gt",
          ">=": "ge",
          "<<": "shl",
          ">>": "shr",
          ">>>": "sshr",
        };
        return opCell(names[nop] ?? nop, [slice(a, 0, wa), slice(b, 0, wb)], w);
      }
      case "cond": {
        const c = bool(ex(e.c));
        return mux(c, ex(e.f), ex(e.t));
      }
      case "concat": {
        const parts = e.parts.map(ex).reverse();
        return concat(parts, curPath);
      }
      case "resize": {
        const a = ex(e.a);
        if (e.width < a.width) return slice(a, 0, e.width);
        if (isConst(a)) return konst(constVal(a), e.width);
        return a;
      }
      case "cast":
        return ex(e.a);
      case "others":
        return ex(e.bit);
      default:
        return konst(e.k === "edge" || e.k === "event" ? 1 : 0, 1);
    }
  }

  // ---------------------------------------------------------------- statements
  let pc: Ref | null = null; // path condition, for memory writes
  let procClk: Ref | null = null;

  const setVal = (id: number, v: Ref, nb: boolean) => {
    const w = d.sigs[id].width;
    if (v.width > w) v = slice(v, 0, w);
    (nb && !comb ? env.nb : env.b).set(id, v);
  };

  function assign(l: LVal, v: Ref, nb: boolean) {
    switch (l.k) {
      case "sig":
        setVal(l.id, v, nb);
        break;
      case "sel": {
        const w = d.sigs[l.id].width;
        const old = keep(l.id, nb);
        const lo = ex(l.lo);
        if (isConst(lo)) {
          const k = constVal(lo);
          if (k >= w) break;
          const width = Math.min(l.width, w - k);
          setVal(
            l.id,
            concat(
              [
                slice(old, 0, k),
                slice(v, 0, width),
                slice(old, k + width, w - k - width),
              ],
              curPath,
            ),
            nb,
          );
        } else {
          const r = full(
            add({
              type: "insert",
              width: w,
              ins: [
                { name: "D", src: old },
                { name: "V", src: slice(v, 0, l.width) },
                { name: "S", src: lo },
              ],
              path: curPath,
              loc: curLoc,
            }),
          );
          setVal(l.id, r, nb);
        }
        break;
      }
      case "mem": {
        const list = memWrites.get(l.mem) ?? [];
        list.push({
          clk: procClk,
          w: { we: pc ?? konst(1, 1), addr: ex(l.addr), data: v },
        });
        memWrites.set(l.mem, list);
        break;
      }
      case "concat": {
        let at = 0;
        const widthOf = (x: LVal): number =>
          x.k === "sig"
            ? d.sigs[x.id].width
            : x.k === "sel"
              ? x.width
              : x.k === "mem"
                ? d.mems[x.mem].width
                : x.parts.reduce((s, p) => s + widthOf(p), 0);
        for (const p of [...l.parts].reverse()) {
          const pw = widthOf(p);
          assign(p, slice(v, at, pw), nb);
          at += pw;
        }
        break;
      }
    }
  }

  // runs `branches` from the current environment and merges what they assign with `pick(values)`
  function branch(
    bodies: Stmt[][],
    conds: (Ref | null)[],
    merge: (vals: Ref[]) => Ref,
  ) {
    const base = env;
    const outs: Env[] = [];
    const basePc = pc;
    bodies.forEach((body, i) => {
      env = { b: new Map(base.b), nb: new Map(base.nb) };
      pc = conds[i] ? and1(basePc, conds[i]!) : basePc;
      exec(body);
      outs.push(env);
    });
    pc = basePc;
    env = base;
    for (const kind of ["b", "nb"] as const) {
      const keys = new Set<number>();
      for (const o of outs)
        for (const [k, v] of o[kind]) if (base[kind].get(k) !== v) keys.add(k);
      for (const k of keys) {
        const def =
          kind === "nb"
            ? (base.nb.get(k) ?? base.b.get(k) ?? (comb ? hole(k) : sigref(k)))
            : (base.b.get(k) ?? (comb ? hole(k) : sigref(k)));
        const vals = outs.map((o) => o[kind].get(k) ?? def);
        env[kind].set(
          k,
          vals.every((v) => same(v, vals[0]))
            ? vals[0]
            : mergeBits(vals, merge),
        );
      }
    }
  }

  // merges bit ranges that differ between the branches; bits that are the same in every branch stay wires
  function mergeBits(vals: Ref[], merge: (vals: Ref[]) => Ref): Ref {
    const W = Math.max(...vals.map((v) => v.width));
    const bitKey = (v: Ref, i: number) => {
      if (i >= v.width) return "x";
      const b = slice(v, i, 1);
      return isConst(b) ? `c${constVal(b)}` : `${b.cell}:${b.lo}`;
    };
    const eq: boolean[] = [];
    for (let i = 0; i < W; i++) {
      const k0 = bitKey(vals[0], i);
      eq.push(vals.every((v) => bitKey(v, i) === k0));
    }
    if (eq.every((e) => !e)) return merge(vals);
    const parts: Ref[] = [];
    for (let i = 0; i < W; ) {
      let j = i;
      while (j < W && eq[j] === eq[i]) j++;
      parts.push(
        eq[i]
          ? slice(vals[0], i, j - i)
          : merge(vals.map((v) => slice(v, i, j - i))),
      );
      i = j;
    }
    return concat(parts, curPath);
  }

  function exec(list: Stmt[]) {
    for (const s of list) {
      switch (s.k) {
        case "assign":
          curLoc = s.loc ?? curLoc;
          assign(s.lhs, ex(s.rhs), s.nb);
          break;
        case "block":
          exec(s.body);
          break;
        case "if": {
          if (!comb && edgeOf(s.c)) {
            // the clocked part of a VHDL process: rising_edge(clk) [and en = '1']
            const rest = withoutEdge(s.c);
            if (rest) {
              const c = bool(ex(rest));
              branch([s.f, s.t], [not1(c), c], (v) => mux(c, v[0], v[1]));
            } else exec(s.t);
            break;
          }
          const c = bool(ex(s.c));
          if (isConst(c)) {
            exec(constVal(c) ? s.t : s.f);
            break;
          }
          branch([s.f, s.t], [not1(c), c], (v) => mux(c, v[0], v[1]));
          break;
        }
        case "case": {
          const sel = ex(s.sel);
          const labelVals = s.items.map((it) => it.labels.map(ex));
          const allConst =
            !s.wild && labelVals.every((ls) => ls.every(isConst));
          if (isConst(sel) && allConst) {
            const v = constVal(sel);
            const i = labelVals.findIndex((ls) =>
              ls.some((l) => constVal(l) === (v & mask(l.width))),
            );
            exec(i >= 0 ? s.items[i].body : (s.def ?? []));
            break;
          }
          // a full case (every value listed) needs no default: the last item is the default
          let items = s.items;
          let def = s.def;
          if (!def && allConst && sel.width <= 12) {
            const seen = new Set(
              labelVals.flat().map((l) => constVal(l) & mask(sel.width)),
            );
            if (seen.size === 2 ** sel.width && items.length > 1) {
              def = items[items.length - 1].body;
              items = items.slice(0, -1);
              labelVals.pop();
            }
          }
          const hits = labelVals.map((ls) =>
            ls
              .map((l) => opCell("eq", [sel, l], 1))
              .reduce((a, b) => gate("or", [a, b], 1)),
          );
          const bodies = [...items.map((it) => it.body), def ?? []];
          const conds = [...hits, null];
          if (allConst) {
            const sw = d.sigs[s.sel.k === "sig" ? s.sel.id : -1];
            const lits = sw?.enumLits;
            const labels = items.map((it, i) =>
              labelVals[i]
                .map(
                  (l) => lits?.[constVal(l)] ?? fmtConst(constVal(l), l.width),
                )
                .join(","),
            );
            // the eq cells are only needed for memory write enables; drop them from the picture when unused
            branch(bodies, conds, (vals) =>
              full(
                add({
                  type: "pmux",
                  width: Math.max(...vals.map((v) => v.width)),
                  ins: [
                    { name: "S", src: sel },
                    ...vals.map((src, i) => ({
                      name: i < labels.length ? labels[i] : "default",
                      src,
                    })),
                  ],
                  labels: [...labels, "default"],
                  path: curPath,
                  loc: curLoc,
                }),
              ),
            );
          } else {
            // priority chain: the first matching item wins
            branch(bodies, conds, (vals) => {
              let r = vals[vals.length - 1];
              for (let i = hits.length - 1; i >= 0; i--)
                r = mux(hits[i], r, vals[i]);
              return r;
            });
          }
          break;
        }
        case "for": {
          exec([s.init]);
          let n = 0;
          for (;;) {
            const c = bool(ex(s.cond));
            if (!isConst(c)) {
              warnings.push({
                code: "Synth 8-3380",
                msg: "loop condition does not evaluate to a constant: the loop is not shown in the schematic",
                loc: curLoc,
              });
              break;
            }
            if (!constVal(c)) break;
            if (++n > 1024) {
              warnings.push({
                code: "Synth 8-3380",
                msg: "loop limit of 1024 iterations reached",
                loc: curLoc,
              });
              break;
            }
            exec(s.body);
            exec([s.step]);
          }
          break;
        }
        default:
          break; // print, finish and simulation-only statements
      }
    }
  }

  // ---------------------------------------------------------------- ports
  const tri = new Map((d.tri ?? []).map((t) => [t.port, t]));
  for (const p of d.ports) {
    const { leaf } = splitName(p.name);
    if (p.dir === "input" || p.dir === "inout") {
      const c = add({
        type: "in",
        width: p.width,
        ins: [],
        name: leaf,
        sig: p.id,
        path: "",
        loc: p.loc,
      });
      drivers.set(p.id, full(c));
    }
  }

  // ---------------------------------------------------------------- processes
  for (const proc of d.procs) {
    if (proc.kind === "tb" || proc.kind === "init") continue;
    curLoc = proc.loc;
    const written = new Set<number>();
    collectWrites(proc.body, written);
    const firstSig = [...written][0];
    curPath = firstSig !== undefined ? pathOf(firstSig) : "";
    env = { b: new Map(), nb: new Map() };
    pc = null;
    if (proc.kind === "comb") {
      comb = true;
      procClk = null;
      exec(proc.body);
      for (const [id, v] of env.b) if (written.has(id)) combResult(id, v, proc);
    } else {
      comb = false;
      seqProc(proc, written);
    }
  }

  function combResult(id: number, v: Ref, proc: Proc) {
    const h = holes.get(id);
    if (h === undefined) {
      addPart(id, 0, v);
      return;
    }
    // top-level parts: holes there are bits this process does not drive
    const tops: { lo: number; ref: Ref }[] = [];
    const c = cells[v.cell];
    if (c.type === "concat" && v.lo === 0 && v.width === c.width) {
      let at = 0;
      for (const p of c.ins) {
        tops.push({ lo: at, ref: p.src! });
        at += p.src!.width;
      }
    } else tops.push({ lo: 0, ref: v });
    for (const t of tops) {
      if (t.ref.cell === h) continue;
      if (reaches(t.ref.cell, h)) {
        const sig = d.sigs[id];
        const L = add({
          type: "latch",
          width: sig.width,
          ins: [{ name: "D", src: null }],
          name: sig.name,
          sig: id,
          path: pathOf(id),
          loc: proc.loc,
        });
        replaceRefs(v.cell, h, L);
        cells[L].ins[0].src = v.cell === h ? full(L) : v;
        warnings.push({
          code: "Synth 8-327",
          msg: `inferring latch for variable '${prettyName(sig.name)}_reg' (it is not assigned on every path of a combinational process)`,
          loc: proc.loc,
        });
        addPart(id, 0, full(L));
        return;
      }
    }
    for (const t of tops) if (t.ref.cell !== h) addPart(id, t.lo, t.ref);
  }

  function addPart(id: number, lo: number, ref: Ref) {
    const list = combParts.get(id) ?? [];
    list.push({ lo, ref });
    combParts.set(id, list);
  }

  // does the logic of `from` read `target` (within cells created for one process)?
  function reaches(
    from: number,
    target: number,
    seen = new Set<number>(),
  ): boolean {
    if (from === target) return true;
    if (seen.has(from)) return false;
    seen.add(from);
    const c = cells[from];
    if (c.type === "sigref" || c.type === "reg" || c.type === "in")
      return false;
    return c.ins.some((p) => p.src && reaches(p.src.cell, target, seen));
  }
  function replaceRefs(
    from: number,
    target: number,
    by: number,
    seen = new Set<number>(),
  ) {
    if (seen.has(from) || from === target) return;
    seen.add(from);
    const c = cells[from];
    if (c.type === "sigref" || c.type === "reg" || c.type === "in") return;
    for (const p of c.ins) {
      if (!p.src) continue;
      if (p.src.cell === target)
        p.src = { cell: by, lo: p.src.lo, width: p.src.width };
      else replaceRefs(p.src.cell, target, by, seen);
    }
  }

  function seqProc(proc: Proc, written: Set<number>) {
    // async reset: if (rst) ... else <clocked>  (Verilog, rst in the sensitivity list)
    // or           if rst = '1' then ... elsif rising_edge(clk) then ...  (VHDL)
    let body = proc.body;
    let arst: { c: Expr; body: Stmt[] } | null = null;
    const trig = new Set(proc.triggers.map((t) => t.id));
    if (body.length === 1 && body[0].k === "if" && !edgeOf(body[0].c)) {
      const s = body[0];
      const reads = new Set<number>();
      exprReads(s.c, reads);
      const vhdlStyle =
        s.f.length === 1 && s.f[0].k === "if" && !!edgeOf(s.f[0].c);
      const verilogStyle =
        proc.triggers.length > 1 && [...reads].some((r) => trig.has(r));
      if (vhdlStyle || verilogStyle) {
        arst = { c: s.c, body: s.t };
        body = s.f;
      }
    }
    // the clock: the edge in the body (VHDL) or the trigger that is not the reset
    let clkId = -1;
    let neg = false;
    const findEdge = (list: Stmt[]): void => {
      for (const s of list) {
        if (s.k === "if") {
          const e = edgeOf(s.c);
          if (e && (e.k === "edge" || e.k === "event")) {
            clkId = e.id;
            neg = e.k === "edge" && !e.rising;
            return;
          }
        }
      }
    };
    findEdge(body);
    if (clkId < 0) {
      const rr = new Set<number>();
      if (arst) exprReads(arst.c, rr);
      const t = proc.triggers.find((x) => !rr.has(x.id)) ?? proc.triggers[0];
      if (t) {
        clkId = t.id;
        neg = t.edge === "neg";
      }
    }
    const clk = clkId >= 0 ? sigref(clkId) : konst(0, 1);
    procClk = clk;

    let rstVals = new Map<number, Ref>();
    let rstC: Ref | null = null;
    if (arst) {
      rstC = bool(ex(arst.c));
      env = { b: new Map(), nb: new Map() };
      exec(arst.body);
      rstVals = new Map([...env.b, ...env.nb]);
      env = { b: new Map(), nb: new Map() };
    }
    exec(body);
    const vals = new Map([...env.b, ...env.nb]);
    for (const id of written) {
      const v = vals.get(id);
      if (!v) continue;
      const sig = d.sigs[id];
      if (sig.name.includes("#loop")) continue;
      // only blocking temporaries that are always assigned before use stay combinational; keep them as registers too
      let D = v;
      let CE: Ref | null = null;
      const q = sigref(id);
      // synchronous reset: if (rst) q <= const; else ...   (it overrides the clock enable, like FDRE's R pin)
      let srst: { c: Ref; value: number; set: boolean } | null = null;
      const rc = cells[D.cell];
      if (rc.type === "mux" && D.lo === 0 && D.width === rc.width) {
        const [s, i0, i1] = rc.ins.map((p) => p.src!);
        if (isConst(i1) && !isConst(i0)) {
          srst = {
            c: s,
            value: constVal(i1),
            set: constVal(i1) === mask(sig.width) && sig.width > 1,
          };
          D = i0;
        } else if (isConst(i0) && !isConst(i1)) {
          srst = {
            c: not1(s),
            value: constVal(i0),
            set: constVal(i0) === mask(sig.width) && sig.width > 1,
          };
          D = i1;
        }
      }
      const dc = cells[D.cell];
      if (dc.type === "mux" && D.lo === 0 && D.width === dc.width) {
        const [s, i0, i1] = dc.ins.map((p) => p.src!);
        if (same(i0, q)) {
          CE = s;
          D = i1;
        } else if (same(i1, q)) {
          CE = not1(s);
          D = i0;
        }
      }
      if (same(D, q) && !srst) continue; // never changes
      // a process variable that is always assigned before it is read is only a wire
      if (/(^|\.)proc\d+\./.test(sig.name) && !reaches(v.cell, q.cell))
        continue;
      const ins: Pin[] = [
        { name: "D", src: D },
        { name: "C", src: clk },
      ];
      if (CE) ins.push({ name: "CE", src: CE });
      if (srst) ins.push({ name: srst.set ? "S" : "R", src: srst.c });
      let arstInfo: Cell["arst"];
      const rv = rstVals.get(id);
      if (rstC && rv) {
        ins.push({
          name:
            isConst(rv) &&
            constVal(rv) === mask(sig.width) &&
            sig.width > 0 &&
            constVal(rv) !== 0
              ? "PRE"
              : "CLR",
          src: rstC,
        });
        arstInfo = { value: isConst(rv) ? constVal(rv) : 0, high: true };
      }
      const R = add({
        type: "reg",
        width: sig.width,
        ins,
        name: sig.name,
        sig: id,
        path: pathOf(id),
        loc: proc.loc,
        negedge: neg,
        arst: arstInfo,
        srst: srst?.value,
        init: sig.init,
      });
      regOf.set(id, R);
      drivers.set(id, full(R));
    }
  }

  // ---------------------------------------------------------------- memories
  for (const m of d.mems) {
    const writes = memWrites.get(m.id) ?? [];
    const ins: Pin[] = [];
    writes.forEach((w, i) => {
      const n = writes.length > 1 ? String(i) : "";
      ins.push(
        { name: `WE${n}`, src: w.w.we },
        { name: `WA${n}`, src: w.w.addr },
        { name: `WD${n}`, src: w.w.data },
      );
      if (w.clk) ins.push({ name: `C${n}`, src: w.clk });
    });
    const id = add({
      type: "ram",
      op: writes.length ? "ram" : "rom",
      width: m.width,
      ins,
      name: m.name,
      mem: m.id,
      path: splitName(m.name).path,
      init: m.length,
    });
    for (const c of cells)
      if (c.type === "ramrd" && c.mem === m.id) c.ins[0].src = full(id);
  }

  // ---------------------------------------------------------------- combinational drivers
  for (const [id, parts] of combParts) {
    if (drivers.has(id) && !tri.has(id)) {
      const kind = cells[drivers.get(id)!.cell].type;
      if (kind === "reg")
        warnings.push({
          code: "Synth 8-6859",
          msg: `multi-driven net '${prettyName(d.sigs[id].name)}': driven by a clocked and a combinational process`,
        });
      continue;
    }
    const w = d.sigs[id].width;
    const bits: (Ref | null)[] = new Array(w).fill(null);
    for (const p of parts)
      for (let i = 0; i < p.ref.width && p.lo + i < w; i++)
        bits[p.lo + i] = slice(p.ref, i, 1);
    if (parts.length === 1 && parts[0].lo === 0 && parts[0].ref.width >= w) {
      drivers.set(id, slice(parts[0].ref, 0, w));
      continue;
    }
    const undriven = bits.filter((b) => !b).length;
    if (undriven && d.sigs[id].dir === "output")
      warnings.push({
        code: "Synth 8-3295",
        msg: `tying undriven pin '${prettyName(d.sigs[id].name)}' bits to constant 0`,
      });
    drivers.set(
      id,
      concat(
        bits.map((b) => b ?? konst(0, 1)),
        pathOf(id),
      ),
    );
  }

  // ---------------------------------------------------------------- outputs
  for (const p of d.ports) {
    const { leaf } = splitName(p.name);
    if (p.dir === "output")
      add({
        type: "out",
        width: p.width,
        ins: [{ name: "I", src: sigref(p.id) }],
        name: leaf,
        sig: p.id,
        path: "",
        loc: p.loc,
      });
    const t = tri.get(p.id);
    if (t) {
      const b = add({
        type: "tri",
        width: p.width,
        ins: [
          { name: "I", src: sigref(t.o) },
          { name: "T", src: sigref(t.oe) },
        ],
        name: leaf,
        path: "",
        loc: p.loc,
      });
      add({
        type: "out",
        width: p.width,
        ins: [{ name: "I", src: full(b) }],
        name: leaf,
        sig: p.id,
        path: "",
        loc: p.loc,
      });
    }
  }

  // ---------------------------------------------------------------- resolve signal placeholders
  const resolving = new Set<number>();
  const resolved = new Map<number, Ref>();
  function resolveSig(id: number): Ref {
    const r = resolved.get(id);
    if (r) return r;
    if (resolving.has(id)) {
      warnings.push({
        code: "Synth 8-295",
        msg: `combinational loop through '${prettyName(d.sigs[id].name)}'`,
      });
      return konst(0, d.sigs[id].width);
    }
    resolving.add(id);
    const drv = drivers.get(id);
    const out = drv
      ? resolveRef(drv)
      : konst(d.sigs[id].init, d.sigs[id].width);
    resolving.delete(id);
    resolved.set(id, out);
    return out;
  }
  function resolveRef(r: Ref): Ref {
    const c = cells[r.cell];
    if (c.type === "sigref") return slice(resolveSig(c.sig!), r.lo, r.width);
    if (c.type === "hole") return konst(0, r.width);
    if (c.type === "concat") {
      // resolve inside, so that slicing can look through it
      const parts = c.ins.map((p) => resolveRef(p.src!));
      if (parts.every((p, i) => same(p, c.ins[i].src!))) return r;
      return slice(concat(parts, c.path), r.lo, r.width);
    }
    return r;
  }
  for (const c of [...cells])
    for (const p of c.ins) if (p.src) p.src = resolveRef(p.src);
  for (const id of drivers.keys()) resolveSig(id);

  // net names: a cell output that is exactly a named signal
  const netNames = new Map<number, string>();
  for (let id = 0; id < d.sigs.length; id++) {
    const r = resolved.get(id);
    if (!r) continue;
    const c = cells[r.cell];
    if (c.type === "const" || r.lo !== 0 || r.width !== c.width) continue;
    const nm = prettyName(d.sigs[id].name);
    const prev = netNames.get(r.cell);
    // prefer the shortest (outermost) name
    if (!prev || nm.split(".").length < prev.split(".").length)
      netNames.set(r.cell, nm);
  }

  // ---------------------------------------------------------------- used / unused (removed by synthesis)
  const live = new Set<number>();
  const stack = cells.filter((c) => c.type === "out").map((c) => c.id);
  while (stack.length) {
    const id = stack.pop()!;
    if (live.has(id)) continue;
    live.add(id);
    for (const p of cells[id].ins) if (p.src) stack.push(p.src.cell);
  }
  // cells in the final list: everything except placeholders and eq cells built only for memory write enables
  const keepCell = (c: Cell) => c.type !== "sigref" && c.type !== "hole";
  const refs = new Map<number, number>();
  for (const c of cells)
    if (keepCell(c))
      for (const p of c.ins)
        if (p.src) refs.set(p.src.cell, (refs.get(p.src.cell) ?? 0) + 1);
  // drop dangling helper cells (eq / or chains for case items that nobody reads)
  const dead = new Set<number>();
  const work = cells
    .filter((c) => keepCell(c) && !refs.get(c.id))
    .map((c) => c.id);
  while (work.length) {
    const id = work.pop()!;
    const c = cells[id];
    if (
      dead.has(id) ||
      !["gate", "op", "concat", "mux", "bsel", "const"].includes(c.type)
    )
      continue;
    dead.add(id);
    for (const p of c.ins) {
      if (!p.src) continue;
      const n = (refs.get(p.src.cell) ?? 0) - 1;
      refs.set(p.src.cell, n);
      if (n <= 0) work.push(p.src.cell);
    }
  }
  for (const c of cells) {
    if (!keepCell(c) || dead.has(c.id)) continue;
    if (!live.has(c.id) && c.type !== "in") {
      c.unused = true;
      if (c.type === "reg" || c.type === "latch")
        warnings.push({
          code: "Synth 8-3332",
          msg: `Sequential element (${prettyName(c.name!)}_reg) is unused and will be removed from module ${d.top}.`,
        });
    }
  }

  // renumber
  const kept = cells.filter((c) => keepCell(c) && !dead.has(c.id));
  const newId = new Map(kept.map((c, i) => [c.id, i]));
  const outCells = kept.map((c) => ({
    ...c,
    id: newId.get(c.id)!,
    ins: c.ins.map((p) => ({
      name: p.name,
      src:
        p.src && newId.has(p.src.cell)
          ? { ...p.src, cell: newId.get(p.src.cell)! }
          : null,
    })),
  }));
  const outNames = new Map<number, string>();
  for (const [k, v] of netNames)
    if (newId.has(k)) outNames.set(newId.get(k)!, v);

  const instances = [{ path: "", module: d.top }];
  const seenPaths = new Set([""]);
  for (const s of d.sigs) {
    const { path } = splitName(s.name);
    if (!seenPaths.has(path)) {
      seenPaths.add(path);
      instances.push({ path, module: "" });
    }
  }
  return {
    design: d,
    cells: outCells,
    netNames: outNames,
    warnings,
    instances,
  };
}

export function fmtConst(v: number, w: number): string {
  if (w <= 4) return `${w}'b${(v >>> 0).toString(2).padStart(w, "0")}`;
  return `${w}'h${(v >>> 0).toString(16).toUpperCase()}`;
}

function collectWrites(list: Stmt[], out: Set<number>) {
  const lv = (l: LVal) => {
    if (l.k === "sig" || l.k === "sel") out.add(l.id);
    if (l.k === "concat") l.parts.forEach(lv);
  };
  for (const s of list) {
    if (s.k === "assign") lv(s.lhs);
    else if (s.k === "if") {
      collectWrites(s.t, out);
      collectWrites(s.f, out);
    } else if (s.k === "case") {
      s.items.forEach((i) => collectWrites(i.body, out));
      if (s.def) collectWrites(s.def, out);
    } else if (s.k === "for") collectWrites([s.init, s.step, ...s.body], out);
    else if (s.k === "block" || s.k === "loop") collectWrites(s.body, out);
  }
}

function exprReads(e: Expr, out: Set<number>) {
  const r = e as unknown as Record<string, unknown>;
  if (e.k === "sig") out.add(e.id);
  for (const v of Object.values(r)) {
    if (Array.isArray(v))
      v.forEach(
        (x) =>
          x && typeof x === "object" && "k" in x && exprReads(x as Expr, out),
      );
    else if (v && typeof v === "object" && "k" in (v as object))
      exprReads(v as Expr, out);
  }
}
