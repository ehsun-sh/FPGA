// Elaboration: resolves names, evaluates parameters, flattens the module hierarchy into one Design.
import { splitTristate } from './tristate';
import { HdlError, type ADecl, type AExpr, type AModule, type APart, type AStmt, type AType, type Lang, type Loc } from './ast';
import { bitsFor, mask, type Design, type Expr, type LVal, type Part, type Sig, type Stmt } from './ir';

type Entry =
  | { k: 'sig'; id: number }
  | { k: 'mem'; id: number }
  | { k: 'const'; value: number; width: number; signed: boolean };

class Scope {
  map = new Map<string, Entry>();
  constructor(public parent?: Scope) {}
  get(n: string): Entry | undefined {
    return this.map.get(n) ?? this.parent?.get(n);
  }
  set(n: string, e: Entry) {
    this.map.set(n, e);
  }
}

interface Ctx {
  lang: Lang;
  prefix: string;
  scope: Scope;
  mod: AModule;
  // inside a testbench thread (delays and waits allowed, 'after' is honoured)
  tb?: boolean;
}

const SEV = { note: 0, warning: 1, error: 2, failure: 3 } as const;

// statements that only make sense in simulation: a process containing them becomes a testbench thread
function hasTiming(list: AStmt[], waitsOnly: boolean): boolean {
  return list.some((s) => {
    switch (s.k) {
      case 'delay':
      case 'wait':
        return true;
      case 'print':
      case 'finish':
      case 'sched':
      case 'loop':
        return !waitsOnly || (s.k === 'loop' && hasTiming(s.body, true));
      case 'if':
        return hasTiming(s.then, waitsOnly) || hasTiming(s.els, waitsOnly);
      case 'case':
        return s.items.some((i) => hasTiming(i.body, waitsOnly)) || (s.def ? hasTiming(s.def, waitsOnly) : false);
      case 'block':
      case 'for':
      case 'vfor':
        return hasTiming(s.body, waitsOnly);
      default:
        return false;
    }
  });
}

// signals an IR expression / statement list reads (for wait on implicit sensitivity)
function readsOf(o: unknown, out: Set<number>) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) {
    o.forEach((x) => readsOf(x, out));
    return;
  }
  const r = o as Record<string, unknown>;
  if ((r.k === 'sig' || r.k === 'edge' || r.k === 'event') && typeof r.id === 'number' && !('lhs' in r)) out.add(r.id);
  for (const [key, val] of Object.entries(r)) if (key !== 'lhs' && val && typeof val === 'object') readsOf(val, out);
}

const CAST_FUNCS = new Set([
  'unsigned',
  'signed',
  'std_logic_vector',
  'std_ulogic_vector',
  'to_integer',
  'conv_integer',
  'integer',
  'natural',
  'to_stdlogicvector',
  'to_bitvector',
  '$signed',
  '$unsigned',
]);
const RESIZE_FUNCS = new Set(['to_unsigned', 'to_signed', 'resize', 'conv_std_logic_vector', 'conv_unsigned', 'conv_signed']);

export class Elaborator {
  design: Design;
  modules = new Map<string, AModule>();
  depth = 0;

  constructor(mods: AModule[], lang: Lang) {
    for (const m of mods) this.modules.set(m.name, m);
    this.design = { top: '', lang, sigs: [], mems: [], procs: [], ports: [], modules: [], warnings: [] };
  }

  run(topName?: string, params?: Record<string, number>): Design {
    let top: AModule | undefined;
    if (topName) top = this.modules.get(topName);
    if (!top) {
      const instantiated = new Set<string>();
      for (const m of this.modules.values()) for (const it of m.items) if (it.k === 'inst') instantiated.add(it.module);
      const roots = [...this.modules.values()].filter((m) => !instantiated.has(m.name));
      top = roots[roots.length - 1] ?? [...this.modules.values()].pop();
    }
    if (!top) throw new HdlError('no module or entity found in the design source', undefined, 'Synth 8-439');
    this.design.top = top.name;
    this.design.unitPs = top.unitPs ?? 1000;
    this.design.topParams = top.params.filter((p) => !p.local).map((p) => p.name);
    // parameter / generic overrides for the top module (VHDL names are lower case)
    const ov = new Map<string, number>();
    for (const [k, v] of Object.entries(params ?? {})) ov.set(top.lang === 'vhdl' ? k.toLowerCase() : k, v);
    this.instantiate(top, '', ov, true);
    if (this.design.ports.some((p) => p.dir === 'inout')) {
      try {
        this.design.tri = splitTristate(this.design);
      } catch (e) {
        throw new HdlError((e as Error).message, top.loc, 'Synth 8-3352');
      }
    }
    return this.design;
  }

  newSig(name: string, t: { width: number; left: number; right: number; signed: boolean; enumLits?: string[] }, loc?: Loc): number {
    const id = this.design.sigs.length;
    const s: Sig = { id, name, width: t.width, left: t.left, right: t.right, signed: t.signed, init: 0, loc, enumLits: t.enumLits };
    this.design.sigs.push(s);
    return id;
  }

  // ---------------- constant evaluation ----------------
  constEval(e: AExpr, ctx: Ctx): { value: number; width: number; signed: boolean } {
    const fail = (): never => {
      throw new HdlError(`expression must be constant here`, e.loc);
    };
    switch (e.k) {
      case 'num':
        return { value: e.value, width: e.width ?? 32, signed: false };
      case 'id': {
        const en = ctx.scope.get(e.name);
        if (en?.k === 'const') return en;
        if (!en) throw new HdlError(`'${e.name}' is not declared`, e.loc, 'Synth 8-1031');
        return fail();
      }
      case 'un': {
        const a = this.constEval(e.a, ctx);
        switch (e.op) {
          case '-':
            return { ...a, value: -a.value };
          case '+':
            return a;
          case '~':
            return { ...a, value: ~a.value & mask(a.width) };
          case '!':
            return { value: a.value ? 0 : 1, width: 1, signed: false };
        }
        return fail();
      }
      case 'bin': {
        const a = this.constEval(e.a, ctx).value;
        const b = this.constEval(e.b, ctx).value;
        const r = (value: number) => ({ value, width: 32, signed: true });
        switch (e.op) {
          case '+':
            return r(a + b);
          case '-':
            return r(a - b);
          case '*':
            return r(a * b);
          case '/':
            return r(Math.trunc(a / b));
          case '%':
            return r(a % b);
          case '**':
            return r(a ** b);
          case '<<':
          case 'sll':
            return r(a * 2 ** b);
          case '>>':
          case 'srl':
            return r(Math.floor(a / 2 ** b));
          case '==':
            return r(a === b ? 1 : 0);
          case '!=':
            return r(a !== b ? 1 : 0);
          case '<':
            return r(a < b ? 1 : 0);
          case '<=':
            return r(a <= b ? 1 : 0);
          case '>':
            return r(a > b ? 1 : 0);
          case '>=':
            return r(a >= b ? 1 : 0);
          case '&':
          case 'and':
            return r(a & b);
          case '|':
          case 'or':
            return r(a | b);
          case '^':
          case 'xor':
            return r(a ^ b);
          case '&&':
            return r(a && b ? 1 : 0);
          case '||':
            return r(a || b ? 1 : 0);
        }
        return fail();
      }
      case 'cond':
        return this.constEval(e.c, ctx).value ? this.constEval(e.t, ctx) : this.constEval(e.f, ctx);
      case 'call':
        if (e.name === '$clog2') {
          const v = this.constEval(e.args[0], ctx).value;
          let w = 0;
          while (2 ** w < v) w++;
          return { value: w, width: 32, signed: false };
        }
        if ((CAST_FUNCS.has(e.name) || RESIZE_FUNCS.has(e.name)) && e.args.length >= 1) {
          const a = this.constEval(e.args[0], ctx);
          if (e.args.length === 2) {
            const w = this.constEval(e.args[1], ctx).value;
            return { value: a.value & mask(w), width: w, signed: false };
          }
          return a;
        }
        return fail();
      default:
        return fail();
    }
  }

  typeInfo(t: AType, ctx: Ctx, loc: Loc): { width: number; left: number; right: number; signed: boolean; enumLits?: string[] } {
    if (t.enumName) {
      const lits = ctx.mod.enums[t.enumName];
      const w = bitsFor(Math.max(lits.length - 1, 1));
      return { width: w, left: w - 1, right: 0, signed: false, enumLits: lits };
    }
    if (t.intRange === 'integer') return { width: 32, left: 31, right: 0, signed: true };
    if (t.intRange) {
      const lo = this.constEval(t.intRange.lo, ctx).value;
      const hi = this.constEval(t.intRange.hi, ctx).value;
      if (lo < 0) return { width: 32, left: 31, right: 0, signed: true };
      const w = bitsFor(hi);
      return { width: w, left: w - 1, right: 0, signed: false };
    }
    if (t.left && t.right) {
      const l = this.constEval(t.left, ctx).value;
      const r = this.constEval(t.right, ctx).value;
      const w = Math.abs(l - r) + 1;
      if (w > 32) throw new HdlError(`vectors wider than 32 bits are not supported in this simulator (${w} bits)`, loc, 'Synth 8-9999');
      return { width: w, left: l, right: r, signed: t.signed };
    }
    return { width: 1, left: 0, right: 0, signed: false };
  }

  declare(d: { name: string; type: AType; init?: AExpr; loc: Loc }, ctx: Ctx, scope: Scope): Entry {
    if (scope.map.has(d.name)) throw new HdlError(`'${d.name}' is already declared${ctx.lang === 'vhdl' ? ' (VHDL names are not case-sensitive)' : ''}`, d.loc, 'Synth 8-2611');
    const info = this.typeInfo(d.type, ctx, d.loc);
    const full = ctx.prefix + d.name;
    if (d.type.arr) {
      const l = this.constEval(d.type.arr.left, ctx).value;
      const r = this.constEval(d.type.arr.right, ctx).value;
      const id = this.design.mems.length;
      this.design.mems.push({ id, name: full, width: info.width, lo: Math.min(l, r), length: Math.abs(l - r) + 1, signed: info.signed, init: 0 });
      if (d.init) {
        // (others => '0') or (others => (others => '0'))
        const bit = d.init.k === 'others' && d.init.bit.k === 'others' ? d.init.bit.bit : d.init.k === 'others' ? d.init.bit : null;
        if (bit) this.design.mems[id].init = this.constEval(bit, ctx).value ? mask(info.width) : 0;
        else throw new HdlError('array initial values other than (others => ...) are not supported', d.loc, 'Synth 8-9999');
      }
      const en: Entry = { k: 'mem', id };
      scope.set(d.name, en);
      return en;
    }
    const id = this.newSig(full, info, d.loc);
    if (d.init) {
      const sig = this.design.sigs[id];
      if (d.init.k === 'others') sig.init = this.constEval(d.init.bit, ctx).value ? mask(info.width) : 0;
      else sig.init = (this.constEval(d.init, ctx).value >>> 0) & mask(info.width);
    }
    const en: Entry = { k: 'sig', id };
    scope.set(d.name, en);
    return en;
  }

  // ---------------- instantiation ----------------
  // aliases: input ports connected to a whole parent signal share that signal (keeps one clock net across the hierarchy)
  instantiate(mod: AModule, prefix: string, paramOverrides: Map<string, number>, isTop: boolean, aliases = new Map<string, number>()): Map<string, number> {
    try {
      return this.instantiateModule(mod, prefix, paramOverrides, isTop, aliases);
    } catch (e) {
      if (e instanceof HdlError && !e.file) e.file = mod.file;
      throw e;
    }
  }

  instantiateModule(mod: AModule, prefix: string, paramOverrides: Map<string, number>, isTop: boolean, aliases: Map<string, number>): Map<string, number> {
    if (++this.depth > 32) throw new HdlError(`recursive instantiation of '${mod.name}'`, mod.loc);
    if (!this.design.modules.includes(mod.name)) this.design.modules.push(mod.name);
    const scope = new Scope();
    const ctx: Ctx = { lang: mod.lang, prefix, scope, mod };
    // enum literals
    for (const lits of Object.values(mod.enums)) {
      const w = bitsFor(Math.max(lits.length - 1, 1));
      lits.forEach((l, i) => scope.set(l, { k: 'const', value: i, width: w, signed: false }));
    }
    for (const p of mod.params) {
      const ov = paramOverrides.get(p.name);
      if (ov !== undefined && !p.local) scope.set(p.name, { k: 'const', value: ov, width: 32, signed: true });
      else {
        const v = this.constEval(p.value, ctx);
        scope.set(p.name, { k: 'const', value: v.value, width: v.width, signed: v.signed });
      }
    }
    const portIds = new Map<string, number>();
    for (const p of mod.ports) {
      const alias = aliases.get(p.name);
      if (alias !== undefined && p.dir === 'input' && this.typeInfo(p.type, ctx, p.loc).width === this.design.sigs[alias].width) {
        scope.set(p.name, { k: 'sig', id: alias });
        portIds.set(p.name, alias);
        continue;
      }
      const en = this.declare({ name: p.name, type: p.type, init: p.init, loc: p.loc }, ctx, scope);
      if (en.k !== 'sig') throw new HdlError(`array ports are not supported`, p.loc);
      portIds.set(p.name, en.id);
      if (isTop) {
        const s = this.design.sigs[en.id];
        s.dir = p.dir;
        this.design.ports.push(s);
      }
    }
    for (const d of mod.decls) this.declare(d, ctx, scope);

    let procNo = 0;
    // instances first, so that processes can refer to signals inside them (dut.count)
    const items = [...mod.items.filter((i) => i.k === 'inst'), ...mod.items.filter((i) => i.k !== 'inst')];
    for (const it of items) {
      switch (it.k) {
        case 'assign': {
          const lhs = this.lval(it.lhs, ctx);
          const rhs = this.expr(it.rhs, ctx, false);
          this.design.procs.push({ kind: 'comb', triggers: [], body: [{ k: 'assign', lhs, rhs, nb: false, loc: it.loc }], loc: it.loc });
          break;
        }
        case 'always': {
          const pscope = new Scope(scope);
          const pctx: Ctx = { ...ctx, scope: pscope, prefix: `${prefix}proc${procNo++}.` };
          for (const d of it.decls) {
            if (d.kind === 'const') {
              const v = this.constEval(d.init!, pctx);
              pscope.set(d.name, { k: 'const', value: v.value, width: v.width, signed: v.signed });
            } else this.declare(d as ADecl, pctx, pscope);
          }
          if (it.sens === 'comb' && hasTiming(it.body, true)) {
            // always #5 clk = ~clk;  or a VHDL process with wait statements: a thread that loops forever
            const tctx = { ...pctx, tb: true };
            this.design.procs.push({ kind: 'tb', triggers: [], body: [{ k: 'loop', body: this.stmts(it.body, tctx, false, false) }], loc: it.loc });
          } else if (it.sens === 'comb') {
            this.design.procs.push({ kind: 'comb', triggers: [], body: this.stmts(it.body, pctx, false, true), loc: it.loc });
          } else {
            const triggers = it.sens.edges.map((ed) => {
              const en = scope.get(ed.name);
              if (!en || en.k !== 'sig') throw new HdlError(`'${ed.name}' is not a signal`, ed.loc, 'Synth 8-1031');
              return { id: en.id, edge: ed.edge };
            });
            this.design.procs.push({ kind: 'seq', triggers, body: this.stmts(it.body, pctx, true, false), loc: it.loc });
          }
          break;
        }
        case 'initial':
          if (hasTiming(it.body, false)) this.design.procs.push({ kind: 'tb', triggers: [], body: this.stmts(it.body, { ...ctx, tb: true }, false, false), loc: it.loc });
          else this.design.procs.push({ kind: 'init', triggers: [], body: this.stmts(it.body, ctx, false, true), loc: it.loc });
          break;
        case 'inst': {
          const child = this.modules.get(it.module);
          if (!child) throw new HdlError(`module '${it.module}' not found`, it.loc, 'Synth 8-439');
          const ov = new Map<string, number>();
          const pubParams = child.params.filter((p) => !p.local);
          it.params.forEach((p, i) => {
            const name = p.name ?? pubParams[i]?.name;
            if (!name) throw new HdlError(`too many parameters for '${it.module}'`, it.loc);
            ov.set(name, this.constEval(p.value, ctx).value);
          });
          const aliases = new Map<string, number>();
          it.conns.forEach((c, i) => {
            const port = c.port !== undefined ? child.ports.find((p) => p.name === c.port) : child.ports[i];
            if (port?.dir !== 'input' || c.expr?.k !== 'id') return;
            const en = ctx.scope.get(c.expr.name);
            if (en?.k === 'sig') aliases.set(port.name, en.id);
          });
          const childPorts = this.instantiate(child, `${prefix}${it.name}.`, ov, false, aliases);
          it.conns.forEach((c, i) => {
            const port = c.port !== undefined ? child.ports.find((p) => p.name === c.port) : child.ports[i];
            if (!port) throw new HdlError(`module '${it.module}' has no port '${c.port ?? '#' + i}'`, it.loc, 'Synth 8-448');
            if (!c.expr) return;
            const pid = childPorts.get(port.name)!;
            if (aliases.get(port.name) === pid) return; // shared net, no copy needed
            if (port.dir === 'input') {
              this.design.procs.push({
                kind: 'comb',
                triggers: [],
                body: [{ k: 'assign', lhs: { k: 'sig', id: pid }, rhs: this.expr(c.expr, ctx, false), nb: false }],
                loc: it.loc,
              });
            } else {
              this.design.procs.push({
                kind: 'comb',
                triggers: [],
                body: [{ k: 'assign', lhs: this.lval(c.expr, ctx), rhs: { k: 'sig', id: pid }, nb: false }],
                loc: it.loc,
              });
            }
          });
          break;
        }
      }
    }
    this.depth--;
    return portIds;
  }

  // ---------------- statements ----------------
  stmts(list: AStmt[], ctx: Ctx, clocked: boolean, comb: boolean): Stmt[] {
    const out: Stmt[] = [];
    for (const s of list) {
      const st = this.stmt(s, ctx, clocked, comb);
      if (s.k === 'wait' && s.auto && st.k === 'wait') {
        // implicit sensitivity: everything the statements before it read
        const r = new Set<number>();
        readsOf(out, r);
        st.on = [...r].map((id) => ({ id, edge: 'any' as const }));
      }
      out.push(st);
    }
    return out;
  }

  // name lookup with hierarchical names (dut.count) as a fallback
  lookup(name: string, ctx: Ctx) {
    const en = ctx.scope.get(name);
    if (en || !name.includes('.')) return en;
    const full = ctx.prefix + name;
    const sig = this.design.sigs.find((x) => x.name === full);
    if (sig) return { k: 'sig' as const, id: sig.id };
    const m = this.design.mems.find((x) => x.name === full);
    return m ? { k: 'mem' as const, id: m.id } : undefined;
  }

  part(p: APart, ctx: Ctx): Part {
    if ('s' in p) return { s: p.s };
    if (p.e.k === 'str') return { s: p.e.value };
    const e = this.expr(p.e, ctx, false);
    const sig = e.k === 'sig' ? this.design.sigs[e.id] : undefined;
    const f = p.f === 't' && ctx.lang === 'vhdl' ? 'T' : p.f;
    return { e, f, w: p.w, signed: this.exprSigned(e), width: this.selfWidth(e), lits: sig?.enumLits };
  }

  simOnly(what: string, ctx: Ctx, loc?: Loc) {
    if (!ctx.tb) throw new HdlError(`${what} can only be used in a testbench (an initial block or a process without a sensitivity list)`, loc, 'Synth 8-9999');
  }

  stmt(s: AStmt, ctx: Ctx, clocked: boolean, comb: boolean): Stmt {
    switch (s.k) {
      case 'assign': {
        const lhs = this.lval(s.lhs, ctx);
        // VHDL: variables (declared in the process) are always immediate
        let nb = s.nb && !comb;
        if (ctx.lang === 'vhdl' && s.nb && lhs.k !== 'concat') {
          const id = lhs.k === 'mem' ? -1 : lhs.id;
          if (id >= 0 && this.design.sigs[id].name.startsWith(ctx.prefix) && ctx.prefix.includes('proc')) nb = false;
        }
        return { k: 'assign', lhs, rhs: this.expr(s.rhs, ctx, clocked), nb, loc: s.loc };
      }
      case 'if':
        return { k: 'if', c: this.expr(s.cond, ctx, clocked), t: this.stmts(s.then, ctx, clocked, comb), f: this.stmts(s.els, ctx, clocked, comb) };
      case 'case':
        return {
          k: 'case',
          sel: this.expr(s.sel, ctx, clocked),
          items: s.items.map((it) => ({ labels: it.labels.map((l) => this.expr(l, ctx, clocked)), body: this.stmts(it.body, ctx, clocked, comb) })),
          def: s.def ? this.stmts(s.def, ctx, clocked, comb) : null,
          wild: s.wild,
        };
      case 'for':
        return {
          k: 'for',
          init: this.stmt(s.init, ctx, clocked, true),
          cond: this.expr(s.cond, ctx, clocked),
          step: this.stmt(s.step, ctx, clocked, true),
          body: this.stmts(s.body, ctx, clocked, comb),
        };
      case 'vfor': {
        const scope = new Scope(ctx.scope);
        const lctx: Ctx = { ...ctx, scope };
        const id = this.newSig(`${ctx.prefix}${s.v}#loop${this.design.sigs.length}`, { width: 32, left: 31, right: 0, signed: true }, s.loc);
        scope.set(s.v, { k: 'sig', id });
        const from = this.expr(s.from, ctx, clocked);
        const to = this.expr(s.to, ctx, clocked);
        const ref: Expr = { k: 'sig', id };
        const one: Expr = { k: 'const', value: 1, width: 32, signed: true };
        return {
          k: 'for',
          init: { k: 'assign', lhs: { k: 'sig', id }, rhs: { k: 'cast', a: from, signed: true }, nb: false },
          cond: { k: 'bin', op: s.down ? '>=' : '<=', a: ref, b: { k: 'cast', a: to, signed: true } },
          step: { k: 'assign', lhs: { k: 'sig', id }, rhs: { k: 'bin', op: s.down ? '-' : '+', a: ref, b: one }, nb: false },
          body: this.stmts(s.body, lctx, clocked, comb),
        };
      }
      case 'block':
        return { k: 'block', body: this.stmts(s.body, ctx, clocked, comb) };
      case 'delay':
        this.simOnly('a delay', ctx, s.loc);
        return { k: 'delay', t: this.expr(s.t, ctx, false) };
      case 'wait': {
        this.simOnly(`'wait' / '@'`, ctx, s.loc);
        const on = s.on.map((o) => {
          const en = this.lookup(o.name, ctx);
          if (!en || en.k !== 'sig') throw new HdlError(`'${o.name}' is not a signal`, o.loc, 'Synth 8-1031');
          return { id: en.id, edge: o.edge };
        });
        const until = s.until ? this.expr(s.until, ctx, false) : undefined;
        if (until && !on.length) {
          const r = new Set<number>();
          readsOf(until, r);
          r.forEach((id) => on.push({ id, edge: 'any' }));
        }
        return { k: 'wait', on, until, level: s.level };
      }
      case 'print':
        return { k: 'print', parts: s.parts.map((p) => this.part(p, ctx)), sev: SEV[s.sev], monitor: s.monitor, loc: s.loc };
      case 'finish':
        return { k: 'finish' };
      case 'loop':
        if (!s.count && !ctx.tb) this.simOnly(s.cond ? `'while'` : `'forever'`, ctx, s.loc);
        return {
          k: 'loop',
          count: s.count ? this.expr(s.count, ctx, false) : undefined,
          cond: s.cond ? this.expr(s.cond, ctx, false) : undefined,
          body: this.stmts(s.body, ctx, clocked, comb),
        };
      case 'sched': {
        const lhs = this.lval(s.lhs, ctx);
        // in synthesizable code 'after' is ignored, as Vivado does
        if (!ctx.tb) return { k: 'assign', lhs, rhs: this.expr(s.items[0].rhs, ctx, clocked), nb: !comb, loc: s.loc };
        return { k: 'sched', lhs, items: s.items.map((i) => ({ rhs: this.expr(i.rhs, ctx, false), t: i.t ? this.expr(i.t, ctx, false) : { k: 'const', value: 0, width: 32 } })) };
      }
    }
  }

  // ---------------- l-values ----------------
  lval(e: AExpr, ctx: Ctx): LVal {
    switch (e.k) {
      case 'id': {
        const en = this.lookup(e.name, ctx);
        if (!en) throw new HdlError(`'${e.name}' is not declared`, e.loc, 'Synth 8-1031');
        if (en.k !== 'sig') throw new HdlError(`cannot assign to '${e.name}'`, e.loc, 'Synth 8-2576');
        return { k: 'sig', id: en.id };
      }
      case 'concat':
        return { k: 'concat', parts: e.parts.map((p) => this.lval(p, ctx)) };
      case 'index':
      case 'call': {
        const baseName = e.k === 'call' ? e.name : e.base.k === 'id' ? e.base.name : null;
        const idx = e.k === 'call' ? e.args[0] : e.index;
        if (!baseName || (e.k === 'call' && e.args.length !== 1)) throw new HdlError('unsupported assignment target', e.loc, 'Synth 8-2576');
        const en = ctx.scope.get(baseName);
        if (!en) throw new HdlError(`'${baseName}' is not declared`, e.loc, 'Synth 8-1031');
        if (en.k === 'mem') return { k: 'mem', mem: en.id, addr: this.expr(idx, ctx, false) };
        if (en.k !== 'sig') throw new HdlError(`cannot assign to '${baseName}'`, e.loc, 'Synth 8-2576');
        return { k: 'sel', id: en.id, lo: this.bitPos(en.id, idx, ctx), width: 1 };
      }
      case 'slice':
      case 'pslice': {
        if (e.base.k !== 'id') throw new HdlError('unsupported assignment target', e.loc, 'Synth 8-2576');
        const en = ctx.scope.get(e.base.name);
        if (!en || en.k !== 'sig') throw new HdlError(`'${e.base.name}' is not a signal`, e.loc, 'Synth 8-1031');
        const { lo, width } = this.slicePos(en.id, e, ctx);
        return { k: 'sel', id: en.id, lo, width };
      }
    }
    throw new HdlError('unsupported assignment target', e.loc, 'Synth 8-2576');
  }

  bitPos(id: number, idx: AExpr, ctx: Ctx): Expr {
    const s = this.design.sigs[id];
    const ie = this.expr(idx, ctx, false);
    if (ie.k === 'const') {
      const pos = s.left >= s.right ? ie.value - s.right : s.right - ie.value;
      if (pos < 0 || pos >= s.width) this.design.warnings.push({ msg: `index ${ie.value} is out of range for '${s.name}'`, loc: idx.loc });
      return { k: 'const', value: pos, width: 32 };
    }
    if (s.left >= s.right) return s.right === 0 ? ie : { k: 'bin', op: '-', a: ie, b: { k: 'const', value: s.right, width: 32 } };
    return { k: 'bin', op: '-', a: { k: 'const', value: s.right, width: 32 }, b: ie };
  }

  slicePos(id: number, e: AExpr & ({ k: 'slice' } | { k: 'pslice' }), ctx: Ctx): { lo: Expr; width: number } {
    const s = this.design.sigs[id];
    const pos = (i: number) => (s.left >= s.right ? i - s.right : s.right - i);
    if (e.k === 'slice') {
      const a = this.constEval(e.left, ctx).value;
      const b = this.constEval(e.right, ctx).value;
      const pa = pos(a);
      const pb = pos(b);
      return { lo: { k: 'const', value: Math.min(pa, pb), width: 32 }, width: Math.abs(pa - pb) + 1 };
    }
    const w = this.constEval(e.width, ctx).value;
    const start = this.expr(e.start, ctx, false);
    // [start +: w] covers start..start+w-1 ; [start -: w] covers start-w+1..start
    const lowIdx: Expr = e.up ? start : { k: 'bin', op: '-', a: start, b: { k: 'const', value: w - 1, width: 32 } };
    if (s.left < s.right) throw new HdlError('+: / -: on ascending ranges is not supported', e.loc, 'Synth 8-9999');
    const lo: Expr = s.right === 0 ? lowIdx : { k: 'bin', op: '-', a: lowIdx, b: { k: 'const', value: s.right, width: 32 } };
    return { lo, width: w };
  }

  // ---------------- expressions ----------------
  expr(e: AExpr, ctx: Ctx, clocked: boolean): Expr {
    switch (e.k) {
      case 'num':
        return { k: 'const', value: e.value >>> 0, width: e.width ?? (ctx.lang === 'vhdl' ? 0 : 32), dc: e.dc };
      case 'id': {
        const en = this.lookup(e.name, ctx);
        if (!en) throw new HdlError(`'${e.name}' is not declared`, e.loc, 'Synth 8-1031');
        if (en.k === 'const') {
          const unsized = ctx.lang === 'vhdl' && en.width >= 32;
          return { k: 'const', value: en.value >>> 0, width: unsized ? 0 : en.width, signed: en.signed && !unsized };
        }
        if (en.k === 'mem') throw new HdlError(`memory '${e.name}' must be indexed`, e.loc);
        return { k: 'sig', id: en.id };
      }
      case 'index': {
        if (e.base.k === 'id') {
          const en = ctx.scope.get(e.base.name);
          if (en?.k === 'mem') return { k: 'mem', mem: en.id, addr: this.expr(e.index, ctx, clocked) };
          if (en?.k === 'sig') return { k: 'sel', a: { k: 'sig', id: en.id }, lo: this.bitPos(en.id, e.index, ctx), width: 1 };
        }
        // mem[i][b] or expression index: treat as descending from 0
        return { k: 'sel', a: this.expr(e.base, ctx, clocked), lo: this.expr(e.index, ctx, clocked), width: 1 };
      }
      case 'slice':
      case 'pslice': {
        if (e.base.k === 'id') {
          const en = ctx.scope.get(e.base.name);
          if (en?.k === 'sig') {
            const { lo, width } = this.slicePos(en.id, e, ctx);
            return { k: 'sel', a: { k: 'sig', id: en.id }, lo, width };
          }
        }
        if (e.k === 'slice') {
          const a = this.constEval(e.left, ctx).value;
          const b = this.constEval(e.right, ctx).value;
          return { k: 'sel', a: this.expr(e.base, ctx, clocked), lo: { k: 'const', value: Math.min(a, b), width: 32 }, width: Math.abs(a - b) + 1 };
        }
        throw new HdlError('unsupported part select', e.loc);
      }
      case 'un': {
        const a = this.expr(e.a, ctx, clocked);
        return { k: 'un', op: e.op, a };
      }
      case 'bin': {
        const a = this.expr(e.a, ctx, clocked);
        const b = this.expr(e.b, ctx, clocked);
        const map: Record<string, string> = { and: '&', or: '|', xor: '^', xnor: '~^', sll: '<<', srl: '>>', sla: '<<<', sra: '>>>' };
        if (e.op === 'nand') return { k: 'un', op: '~', a: { k: 'bin', op: '&', a, b } };
        if (e.op === 'nor') return { k: 'un', op: '~', a: { k: 'bin', op: '|', a, b } };
        if (e.op === 'rol' || e.op === 'ror') throw new HdlError(`'${e.op}' is not supported yet`, e.loc, 'Synth 8-9999');
        return { k: 'bin', op: map[e.op] ?? e.op, a, b };
      }
      case 'cond':
        return { k: 'cond', c: this.expr(e.c, ctx, clocked), t: this.expr(e.t, ctx, clocked), f: this.expr(e.f, ctx, clocked) };
      case 'concat':
        return { k: 'concat', parts: e.parts.map((p) => this.expr(p, ctx, clocked)) };
      case 'repl': {
        const n = this.constEval(e.count, ctx).value;
        const inner = this.expr(e.e, ctx, clocked);
        return { k: 'concat', parts: Array.from({ length: n }, () => inner) };
      }
      case 'others':
        return { k: 'others', bit: this.expr(e.bit, ctx, clocked) };
      case 'str':
        throw new HdlError('strings can only be used in $display / report messages', e.loc, 'Synth 8-9999');
      case 'now':
        return { k: 'now', div: ctx.lang === 'vhdl' ? 1 : (ctx.mod.unitPs ?? 1000) };
      case 'random':
        return { k: 'random' };
      case 'attr': {
        const base = e.base.k === 'id' ? ctx.scope.get(e.base.name) : undefined;
        if (!base || base.k !== 'sig') throw new HdlError(`attribute '${e.attr}' needs a signal`, e.loc);
        const s = this.design.sigs[base.id];
        switch (e.attr) {
          case 'event':
            if (!clocked) throw new HdlError(`'event can only be used in a clocked process`, e.loc);
            return { k: 'event', id: base.id };
          case 'length':
            return { k: 'const', value: s.width, width: 0 };
          case 'high':
            return { k: 'const', value: Math.max(s.left, s.right), width: 0 };
          case 'low':
            return { k: 'const', value: Math.min(s.left, s.right), width: 0 };
          case 'left':
            return { k: 'const', value: s.left, width: 0 };
          case 'right':
            return { k: 'const', value: s.right, width: 0 };
        }
        throw new HdlError(`attribute '${e.attr}' is not supported`, e.loc, 'Synth 8-9999');
      }
      case 'call': {
        const en = ctx.scope.get(e.name);
        if (en && en.k !== 'const' && e.args.length === 1) {
          // VHDL index a(i)
          return this.expr({ k: 'index', base: { k: 'id', name: e.name, loc: e.loc }, index: e.args[0], loc: e.loc }, ctx, clocked);
        }
        const n = e.name;
        if (n === 'rising_edge' || n === 'falling_edge') {
          const a = e.args[0];
          const s = a?.k === 'id' ? ctx.scope.get(a.name) : undefined;
          if (!s || s.k !== 'sig') throw new HdlError(`${n}() needs a signal`, e.loc);
          if (!clocked) throw new HdlError(`${n}() can only be used in a clocked process`, e.loc);
          return { k: 'edge', id: s.id, rising: n === 'rising_edge' };
        }
        if (CAST_FUNCS.has(n)) {
          if (e.args.length !== 1) throw new HdlError(`${n}() takes one argument`, e.loc);
          const a = this.expr(e.args[0], ctx, clocked);
          const keep = n === 'to_integer' || n === 'conv_integer' || n === 'integer' || n === 'natural';
          return { k: 'cast', a, signed: keep ? this.exprSigned(a) : n === 'signed' || n === '$signed' };
        }
        if (RESIZE_FUNCS.has(n)) {
          if (e.args.length !== 2) throw new HdlError(`${n}() takes two arguments`, e.loc);
          const w = this.constEval(e.args[1], ctx).value;
          if (w > 32) throw new HdlError(`vectors wider than 32 bits are not supported`, e.loc, 'Synth 8-9999');
          const a = this.expr(e.args[0], ctx, clocked);
          const signed = n === 'to_signed' || n === 'conv_signed' || (n === 'resize' && this.exprSigned(a));
          return { k: 'resize', a, width: w, signed };
        }
        if (n === 'shift_left' || n === 'shift_right') {
          const a = this.expr(e.args[0], ctx, clocked);
          const b = this.expr(e.args[1], ctx, clocked);
          const signed = this.exprSigned(a);
          const w = this.selfWidth(a);
          return { k: 'resize', a: { k: 'bin', op: n === 'shift_left' ? '<<' : signed ? '>>>' : '>>', a, b }, width: w, signed };
        }
        if (n === '$clog2') {
          const v = this.constEval(e, ctx);
          return { k: 'const', value: v.value, width: 32 };
        }
        if (en?.k === 'const') throw new HdlError(`'${n}' is a constant, not a function`, e.loc);
        throw new HdlError(`function '${n}' is not supported or not declared`, e.loc, 'Synth 8-1031');
      }
    }
  }

  exprSigned(e: Expr): boolean {
    switch (e.k) {
      case 'sig':
        return this.design.sigs[e.id].signed;
      case 'cast':
      case 'resize':
        return e.signed;
      case 'const':
        return !!e.signed;
      default:
        return false;
    }
  }

  selfWidth(e: Expr): number {
    switch (e.k) {
      case 'sig':
        return this.design.sigs[e.id].width;
      case 'resize':
        return e.width;
      case 'sel':
        return e.width;
      case 'const':
        return e.width || 32;
      case 'cast':
        return this.selfWidth(e.a);
      default:
        return 32;
    }
  }
}

export function elaborate(mods: AModule[], lang: Lang, top?: string, params?: Record<string, number>): Design {
  return new Elaborator(mods, lang).run(top, params);
}
