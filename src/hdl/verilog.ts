// Recursive-descent parser for a synthesizable Verilog-2001 subset (+ a few SystemVerilog keywords).
import { HdlError, type ASens, type ADecl, type AExpr, type AItem, type AModule, type APart, type APort, type AStmt, type AType, type Loc, type Severity } from './ast';
import { lex, TokStream } from './lexer';

export function parseVerilogNumber(text: string, loc: Loc): AExpr {
  const s = text.replace(/_/g, '');
  const m = /^(\d*)'([sS]?)([bBoOdDhH])([0-9a-fA-FxXzZ?]+)$/.exec(s);
  if (!m) {
    if (!/^\d+$/.test(s)) throw new HdlError(`bad number '${text}'`, loc);
    const value = Number(s);
    if (value > 0xffffffff) throw new HdlError(`number '${text}' is wider than 32 bits`, loc);
    return { k: 'num', value, width: null, loc };
  }
  const width = m[1] ? Number(m[1]) : null;
  const base = m[3].toLowerCase();
  const digits = m[4].toLowerCase();
  let value = 0;
  let dc = 0;
  if (base === 'd') {
    if (/[xz?]/.test(digits)) value = 0;
    else value = Number(digits);
  } else {
    const bits = base === 'b' ? 1 : base === 'o' ? 3 : 4;
    for (const ch of digits) {
      value = value * (1 << bits);
      dc = dc * (1 << bits);
      if (ch === 'x' || ch === 'z' || ch === '?') dc += (1 << bits) - 1;
      else value += parseInt(ch, 16);
    }
  }
  if (width !== null && width > 32) throw new HdlError(`vectors wider than 32 bits are not supported ('${text}')`, loc, 'Synth 8-9999');
  if (width !== null && width < 32) {
    value = value % 2 ** width;
    dc = dc % 2 ** width;
  }
  if (value > 0xffffffff) value = value % 2 ** 32;
  return { k: 'num', value, width: width ?? 32, dc: dc || undefined, loc };
}

const BIN_PREC: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '|': 3,
  '^': 4,
  '~^': 4,
  '^~': 4,
  '&': 5,
  '==': 6,
  '!=': 6,
  '===': 6,
  '!==': 6,
  '<': 7,
  '<=': 7,
  '>': 7,
  '>=': 7,
  '<<': 8,
  '>>': 8,
  '<<<': 8,
  '>>>': 8,
  '+': 9,
  '-': 9,
  '*': 10,
  '/': 10,
  '%': 10,
  '**': 11,
};

const TIME_UNITS: Record<string, number> = { s: 1e12, ms: 1e9, us: 1e6, ns: 1e3, ps: 1, fs: 1e-3 };

// Splits a $display format string into text and formatted values.
function formatParts(args: AExpr[], loc: Loc): APart[] {
  const parts: APart[] = [];
  let rest = args;
  const text = (s: string) => {
    if (!s) return;
    const last = parts[parts.length - 1];
    if (last && 's' in last) last.s += s;
    else parts.push({ s });
  };
  if (args[0]?.k === 'str') {
    const f = args[0].value;
    rest = args.slice(1);
    let k = 0;
    for (let i = 0; i < f.length; i++) {
      const c = f[i];
      if (c === '\\') {
        const n = f[++i];
        text(n === 'n' ? '\n' : n === 't' ? '\t' : n ?? '');
      } else if (c === '%') {
        const m = /^(-?\d*)([a-zA-Z%])/.exec(f.slice(i + 1));
        if (!m) {
          text('%');
          continue;
        }
        i += m[0].length;
        const conv = m[2].toLowerCase();
        if (conv === '%') text('%');
        else if (conv === 'm') text('top');
        else {
          const e = rest[k++];
          if (!e) throw new HdlError(`missing argument for '%${m[2]}' in format string`, loc);
          parts.push({ e, f: conv === 'x' ? 'h' : conv === 'u' ? 'd' : conv, w: m[1] === '' ? -1 : Math.abs(Number(m[1])) });
        }
      } else text(c);
    }
    rest = rest.slice(k);
  }
  rest.forEach((e, i) => {
    if (i || parts.length) text(' ');
    if (e.k === 'str') text(e.value);
    else parts.push({ e, f: 'd', w: -1 });
  });
  return parts;
}

class VerilogParser {
  s: TokStream;
  constructor(
    src: string,
    public unitPs = 1000,
  ) {
    this.s = new TokStream(lex(src, 'verilog'));
  }

  // delay after '#': a number (possibly with a fraction), a name or a parenthesised expression; returned in ps
  delayValue(): AExpr {
    const t = this.s.peek();
    const loc = t.loc;
    let e: AExpr;
    if (t.t === 'num') {
      this.s.next();
      let v = Number(t.v.replace(/_/g, ''));
      if (!/^[\d_]+$/.test(t.v)) v = parseVerilogNumber(t.v, loc).k === 'num' ? (parseVerilogNumber(t.v, loc) as { value: number }).value : 0;
      if (this.s.is('.') && this.s.peek(1).t === 'num') {
        this.s.next();
        v = Number(`${v}.${this.s.next().v}`);
      }
      const unit = this.s.peek().t === 'id' && TIME_UNITS[this.s.peek().v] !== undefined ? TIME_UNITS[this.s.next().v] : this.unitPs;
      return { k: 'num', value: Math.round(v * unit), width: null, loc };
    }
    if (t.t === 'id') {
      this.s.next();
      e = { k: 'id', name: t.v, loc };
    } else {
      this.s.expect('(');
      e = this.expr();
      this.s.expect(')');
    }
    return this.unitPs === 1 ? e : { k: 'bin', op: '*', a: e, b: num(this.unitPs, loc), loc };
  }

  // @(posedge clk or negedge rst) / @(a or b) / @* / @clk
  eventControl(loc: Loc): AStmt {
    if (this.s.accept('*')) return { k: 'wait', on: [], auto: true, loc };
    const on: { name: string; edge: 'pos' | 'neg' | 'any'; loc: Loc }[] = [];
    if (!this.s.accept('(')) {
      const id = this.s.ident();
      return { k: 'wait', on: [{ name: id.v, edge: 'any', loc: id.loc }], loc };
    }
    if (this.s.accept('*')) {
      this.s.expect(')');
      return { k: 'wait', on: [], auto: true, loc };
    }
    for (;;) {
      let edge: 'pos' | 'neg' | 'any' = 'any';
      if (this.s.accept('posedge')) edge = 'pos';
      else if (this.s.accept('negedge')) edge = 'neg';
      const id = this.s.ident();
      let name = id.v;
      while (this.s.is('.') && this.s.peek(1).t === 'id') {
        this.s.next();
        name += '.' + this.s.next().v;
      }
      on.push({ name, edge, loc: id.loc });
      if (!this.s.accept('or') && !this.s.accept(',')) break;
    }
    this.s.expect(')');
    return { k: 'wait', on, loc };
  }

  // statement after a timing control: '#10;' alone or '#10 x = 1;'
  withBody(ctl: AStmt, loc: Loc): AStmt {
    if (this.s.accept(';')) return ctl;
    return { k: 'block', body: [ctl, this.stmt()], loc };
  }

  sysTask(): AStmt {
    const t = this.s.next();
    const loc = t.loc;
    const name = t.v;
    const args: AExpr[] = [];
    if (this.s.accept('(')) {
      while (!this.s.is(')')) {
        if (this.s.is(',')) args.push({ k: 'str', value: '', loc: this.s.peek().loc });
        else args.push(this.expr());
        if (!this.s.accept(',')) break;
      }
      this.s.expect(')');
    }
    this.s.expect(';');
    switch (name) {
      case '$display':
      case '$displayh':
      case '$displayb':
      case '$write':
      case '$strobe':
      case '$monitor':
      case '$info':
      case '$warning':
      case '$error':
      case '$fatal': {
        let a = args;
        if (name === '$fatal' && a[0] && a[0].k !== 'str') a = a.slice(1);
        const parts = formatParts(a, loc);
        if (name !== '$write') parts.push({ s: '\n' });
        const sev: Severity = name === '$warning' ? 'warning' : name === '$error' ? 'error' : name === '$fatal' ? 'failure' : 'note';
        const p: AStmt = { k: 'print', parts, sev, monitor: name === '$monitor', loc };
        return name === '$fatal' ? { k: 'block', body: [p, { k: 'finish', loc }], loc } : p;
      }
      case '$finish':
      case '$stop':
        return { k: 'finish', loc };
    }
    // $dumpfile, $dumpvars, $timeformat ... have no effect here
    return { k: 'block', body: [], loc };
  }

  parseFile(): AModule[] {
    const mods: AModule[] = [];
    while (this.s.peek().t !== 'eof') {
      if (this.s.is('module')) mods.push(this.module());
      else {
        const t = this.s.peek();
        throw new HdlError(`syntax error near '${t.v}': expected 'module'`, t.loc);
      }
    }
    return mods;
  }

  module(): AModule {
    const loc = this.s.expect('module').loc;
    const name = this.s.ident().v;
    const mod: AModule = { name, lang: 'verilog', params: [], ports: [], decls: [], enums: {}, arrayTypes: {}, items: [], loc, unitPs: this.unitPs };
    if (this.s.accept('#')) {
      this.s.expect('(');
      while (!this.s.is(')')) {
        this.s.accept('parameter');
        this.paramList(mod, false, [')']);
        if (!this.s.accept(',')) break;
      }
      this.s.expect(')');
    }
    const portOrder: string[] = [];
    if (this.s.accept('(')) {
      if (!this.s.is(')')) {
        if (this.s.is('input') || this.s.is('output') || this.s.is('inout')) {
          // ANSI header
          let dir: APort['dir'] = 'input';
          let type: AType = { signed: false };
          let isReg = false;
          for (;;) {
            if (this.s.is('input') || this.s.is('output') || this.s.is('inout')) {
              dir = this.s.next().v as APort['dir'];
              isReg = false;
              if (this.s.accept('reg') || this.s.accept('logic')) isReg = true;
              else this.s.accept('wire');
              type = this.typeSpec();
            }
            const t = this.s.ident();
            const port: APort = { name: t.v, dir, type, isReg, loc: t.loc };
            if (this.s.accept('=')) port.init = this.expr();
            mod.ports.push(port);
            if (!this.s.accept(',')) break;
          }
        } else {
          for (;;) {
            portOrder.push(this.s.ident().v);
            if (!this.s.accept(',')) break;
          }
        }
      }
      this.s.expect(')');
    }
    this.s.expect(';');
    while (!this.s.is('endmodule')) {
      if (this.s.peek().t === 'eof') throw new HdlError(`missing 'endmodule' for module '${name}'`, loc);
      this.item(mod);
    }
    this.s.expect('endmodule');
    if (portOrder.length) {
      // non-ANSI: ports were declared in the body; order them per header
      const byName = new Map(mod.ports.map((p) => [p.name, p]));
      const ordered: APort[] = [];
      for (const pn of portOrder) {
        const p = byName.get(pn);
        if (!p) throw new HdlError(`port '${pn}' is not declared as input/output`, loc);
        ordered.push(p);
      }
      mod.ports = ordered;
    }
    // "output reg" / "reg" redeclaration of a port merges into the port
    mod.decls = mod.decls.filter((d) => {
      const p = mod.ports.find((pp) => pp.name === d.name);
      if (!p) return true;
      if (d.type.left && !p.type.left) p.type = d.type;
      p.isReg = true;
      return false;
    });
    return mod;
  }

  typeSpec(): AType {
    const type: AType = { signed: false };
    if (this.s.accept('signed')) type.signed = true;
    this.s.accept('unsigned');
    if (this.s.accept('[')) {
      type.left = this.expr();
      this.s.expect(':');
      type.right = this.expr();
      this.s.expect(']');
    }
    return type;
  }

  paramList(mod: AModule, local: boolean, terminators: string[]) {
    // parameter [range] NAME = value {, NAME = value}
    this.s.accept('integer');
    this.typeSpec();
    for (;;) {
      const t = this.s.ident();
      this.s.expect('=');
      mod.params.push({ name: t.v, value: this.expr(), local, loc: t.loc });
      // stop at ',' followed by 'parameter' or a terminator
      if (this.s.is(',') && this.s.peek(1).t === 'id' && this.s.peek(2).v === '=') {
        this.s.next();
        continue;
      }
      if (terminators.some((x) => this.s.is(x)) || this.s.is(',') || this.s.is(';')) return;
    }
  }

  item(mod: AModule) {
    const t = this.s.peek();
    const loc = t.loc;
    switch (t.v) {
      case 'input':
      case 'output':
      case 'inout': {
        this.s.next();
        let isReg = false;
        if (this.s.accept('reg') || this.s.accept('logic')) isReg = true;
        else this.s.accept('wire');
        const type = this.typeSpec();
        for (;;) {
          const id = this.s.ident();
          mod.ports.push({ name: id.v, dir: t.v as APort['dir'], type, isReg, loc: id.loc });
          if (!this.s.accept(',')) break;
        }
        this.s.expect(';');
        return;
      }
      case 'wire':
      case 'reg':
      case 'logic':
      case 'integer':
      case 'genvar': {
        this.s.next();
        let type: AType;
        if (t.v === 'integer' || t.v === 'genvar') {
          type = { signed: true, left: num(31, loc), right: num(0, loc) };
        } else type = this.typeSpec();
        for (;;) {
          const id = this.s.ident();
          const d: ADecl = { name: id.v, type: { ...type }, kind: t.v === 'wire' ? 'wire' : 'reg', loc: id.loc };
          if (this.s.accept('[')) {
            const l = this.expr();
            this.s.expect(':');
            const r = this.expr();
            this.s.expect(']');
            d.type.arr = { left: l, right: r };
          }
          if (this.s.accept('=')) {
            const init = this.expr();
            if (d.kind === 'wire') mod.items.push({ k: 'assign', lhs: { k: 'id', name: id.v, loc: id.loc }, rhs: init, loc: id.loc });
            else d.init = init;
          }
          mod.decls.push(d);
          if (!this.s.accept(',')) break;
        }
        this.s.expect(';');
        return;
      }
      case 'parameter':
      case 'localparam':
        this.s.next();
        this.paramList(mod, t.v === 'localparam', [';']);
        this.s.expect(';');
        return;
      case 'assign':
        this.s.next();
        for (;;) {
          const lhs = this.lvalue();
          this.s.expect('=');
          mod.items.push({ k: 'assign', lhs, rhs: this.expr(), loc });
          if (!this.s.accept(',')) break;
        }
        this.s.expect(';');
        return;
      case 'always':
      case 'always_ff':
      case 'always_comb':
      case 'always_latch': {
        this.s.next();
        let sens: ASens = 'comb';
        if (this.s.accept('@')) {
          if (this.s.accept('*')) sens = 'comb';
          else {
            this.s.expect('(');
            if (this.s.accept('*')) {
              sens = 'comb';
            } else {
              const edges: { name: string; edge: 'pos' | 'neg' | 'any'; loc: Loc }[] = [];
              for (;;) {
                let edge: 'pos' | 'neg' | 'any' = 'any';
                if (this.s.accept('posedge')) edge = 'pos';
                else if (this.s.accept('negedge')) edge = 'neg';
                const id = this.s.ident();
                edges.push({ name: id.v, edge, loc: id.loc });
                if (!this.s.accept('or') && !this.s.accept(',')) break;
              }
              sens = edges.some((e) => e.edge !== 'any') ? { edges } : 'comb';
            }
            this.s.expect(')');
          }
        }
        mod.items.push({ k: 'always', sens, body: [this.stmt()], decls: [], loc });
        return;
      }
      case 'initial':
        this.s.next();
        mod.items.push({ k: 'initial', body: [this.stmt()], loc });
        return;
      case 'generate':
      case 'endgenerate':
        throw new HdlError(`'generate' blocks are not supported yet in this simulator`, loc, 'Synth 8-9999');
      case 'function':
      case 'task':
        throw new HdlError(`'${t.v}' is not supported yet in this simulator`, loc, 'Synth 8-9999');
    }
    if (t.t === 'id' && (this.s.peek(1).t === 'id' || this.s.peek(1).v === '#')) {
      mod.items.push(this.instance());
      return;
    }
    throw new HdlError(`syntax error near '${t.v}'`, loc);
  }

  instance(): AItem {
    const mt = this.s.ident();
    const params: { name?: string; value: AExpr }[] = [];
    if (this.s.accept('#')) {
      this.s.expect('(');
      while (!this.s.is(')')) {
        if (this.s.accept('.')) {
          const n = this.s.ident().v;
          this.s.expect('(');
          params.push({ name: n, value: this.expr() });
          this.s.expect(')');
        } else params.push({ value: this.expr() });
        if (!this.s.accept(',')) break;
      }
      this.s.expect(')');
    }
    const name = this.s.ident().v;
    const conns: { port?: string; expr?: AExpr }[] = [];
    this.s.expect('(');
    while (!this.s.is(')')) {
      if (this.s.accept('.')) {
        const port = this.s.ident().v;
        this.s.expect('(');
        const expr = this.s.is(')') ? undefined : this.expr();
        this.s.expect(')');
        conns.push({ port, expr });
      } else conns.push({ expr: this.expr() });
      if (!this.s.accept(',')) break;
    }
    this.s.expect(')');
    this.s.expect(';');
    return { k: 'inst', module: mt.v, name, params, conns, loc: mt.loc };
  }

  stmt(): AStmt {
    const t = this.s.peek();
    const loc = t.loc;
    if (this.s.accept('begin')) {
      if (this.s.accept(':')) this.s.ident();
      const body: AStmt[] = [];
      while (!this.s.is('end')) {
        if (this.s.peek().t === 'eof') throw new HdlError(`missing 'end'`, loc);
        // local declarations inside named blocks: integer i;
        if (this.s.is('integer') || this.s.is('reg')) throw new HdlError('declare variables at module level', this.s.peek().loc);
        body.push(this.stmt());
      }
      this.s.expect('end');
      return { k: 'block', body, loc };
    }
    if (this.s.accept('if')) {
      this.s.expect('(');
      const cond = this.expr();
      this.s.expect(')');
      const then = [this.stmt()];
      let els: AStmt[] = [];
      if (this.s.accept('else')) els = [this.stmt()];
      return { k: 'if', cond, then, els, loc };
    }
    if (this.s.is('case') || this.s.is('casez') || this.s.is('casex') || this.s.is('unique') || this.s.is('priority')) {
      if (this.s.is('unique') || this.s.is('priority')) this.s.next();
      const kw = this.s.next().v;
      this.s.expect('(');
      const sel = this.expr();
      this.s.expect(')');
      const items: { labels: AExpr[]; body: AStmt[] }[] = [];
      let def: AStmt[] | null = null;
      while (!this.s.accept('endcase')) {
        if (this.s.peek().t === 'eof') throw new HdlError(`missing 'endcase'`, loc);
        if (this.s.accept('default')) {
          this.s.accept(':');
          def = [this.stmt()];
          continue;
        }
        const labels: AExpr[] = [];
        for (;;) {
          labels.push(this.expr());
          if (!this.s.accept(',')) break;
        }
        this.s.expect(':');
        items.push({ labels, body: [this.stmt()] });
      }
      return { k: 'case', sel, items, def, wild: kw !== 'case', loc };
    }
    if (this.s.accept('for')) {
      this.s.expect('(');
      this.s.accept('integer');
      this.s.accept('int');
      const init = this.simpleAssign();
      this.s.expect(';');
      const cond = this.expr();
      this.s.expect(';');
      const step = this.simpleAssign();
      this.s.expect(')');
      return { k: 'for', init, cond, step, body: [this.stmt()], loc };
    }
    if (this.s.accept(';')) return { k: 'block', body: [], loc };
    if (t.t === 'sys') return this.sysTask();
    if (this.s.accept('#')) return this.withBody({ k: 'delay', t: this.delayValue(), loc }, loc);
    if (this.s.accept('@')) return this.withBody(this.eventControl(loc), loc);
    if (this.s.accept('wait')) {
      this.s.expect('(');
      const until = this.expr();
      this.s.expect(')');
      return this.withBody({ k: 'wait', on: [], until, level: true, loc }, loc);
    }
    if (this.s.accept('forever')) return { k: 'loop', body: [this.stmt()], loc };
    if (this.s.accept('repeat') || this.s.is('while')) {
      const isWhile = this.s.accept('while');
      this.s.expect('(');
      const e = this.expr();
      this.s.expect(')');
      return isWhile ? { k: 'loop', cond: e, body: [this.stmt()], loc } : { k: 'loop', count: e, body: [this.stmt()], loc };
    }
    const st = this.simpleAssign(true);
    this.s.expect(';');
    return st;
  }

  // x = e | x <= e | x++ | x-- | x += e (the last three only as blocking)
  simpleAssign(allowNb = false): AStmt {
    const loc = this.s.peek().loc;
    const lhs = this.lvalue();
    if ((this.s.is('+') && this.s.is('+', 1)) || (this.s.is('-') && this.s.is('-', 1))) {
      const op = this.s.next().v;
      this.s.next();
      return { k: 'assign', lhs, rhs: { k: 'bin', op, a: lhs, b: num(1, loc), loc }, nb: false, loc };
    }
    if ((this.s.is('+') || this.s.is('-')) && this.s.is('=', 1)) {
      const op = this.s.next().v;
      this.s.next();
      return { k: 'assign', lhs, rhs: { k: 'bin', op, a: lhs, b: this.expr(), loc }, nb: false, loc };
    }
    let nb = false;
    if (allowNb && this.s.accept('<=')) nb = true;
    else this.s.expect('=');
    return { k: 'assign', lhs, rhs: this.expr(), nb, loc };
  }

  lvalue(): AExpr {
    const t = this.s.peek();
    if (t.v === '{' && t.t === 'op') return this.primary();
    if (t.t !== 'id') throw new HdlError(`syntax error near '${t.v}': expected a signal name`, t.loc);
    return this.primary();
  }

  expr(): AExpr {
    const c = this.binary(1);
    if (this.s.is('?')) {
      const loc = this.s.next().loc;
      const t = this.expr();
      this.s.expect(':');
      const f = this.expr();
      return { k: 'cond', c, t, f, loc };
    }
    return c;
  }

  binary(minPrec: number): AExpr {
    let a = this.unary();
    for (;;) {
      const t = this.s.peek();
      const prec = t.t === 'op' ? BIN_PREC[t.v] : undefined;
      if (prec === undefined || prec < minPrec) return a;
      this.s.next();
      const b = this.binary(t.v === '**' ? prec : prec + 1);
      a = { k: 'bin', op: t.v, a, b, loc: t.loc };
    }
  }

  unary(): AExpr {
    const t = this.s.peek();
    if (t.t === 'op' && ['!', '~', '-', '+', '&', '|', '^', '~&', '~|', '~^', '^~'].includes(t.v)) {
      this.s.next();
      const a = this.unary();
      return { k: 'un', op: t.v, a, loc: t.loc };
    }
    return this.primary();
  }

  primary(): AExpr {
    const t = this.s.next();
    const loc = t.loc;
    let e: AExpr;
    if (t.t === 'num') {
      // "4 'b0101" handled by lexer; also handle unsized followed by sized part, e.g. 4'b1
      e = parseVerilogNumber(t.v, loc);
    } else if (t.t === 'str') {
      return { k: 'str', value: t.v, loc };
    } else if (t.t === 'sys' && ['$time', '$realtime', '$stime'].includes(t.v)) {
      e = { k: 'now', loc };
    } else if (t.t === 'sys' && (t.v === '$random' || t.v === '$urandom')) {
      if (this.s.accept('(')) {
        while (!this.s.accept(')')) this.s.next();
      }
      e = { k: 'random', loc };
    } else if (t.t === 'sys') {
      const args: AExpr[] = [];
      if (this.s.accept('(')) {
        while (!this.s.is(')')) {
          args.push(this.expr());
          if (!this.s.accept(',')) break;
        }
        this.s.expect(')');
      }
      e = { k: 'call', name: t.v, args, loc };
    } else if (t.t === 'id') {
      let name = t.v;
      // hierarchical name: dut.count
      while (this.s.is('.') && this.s.peek(1).t === 'id') {
        this.s.next();
        name += '.' + this.s.next().v;
      }
      e = { k: 'id', name, loc };
    } else if (t.v === '(') {
      e = this.expr();
      this.s.expect(')');
      return e;
    } else if (t.v === '{') {
      const first = this.expr();
      if (this.s.accept('{')) {
        // replication {n{...}}
        const parts: AExpr[] = [];
        for (;;) {
          parts.push(this.expr());
          if (!this.s.accept(',')) break;
        }
        this.s.expect('}');
        this.s.expect('}');
        return { k: 'repl', count: first, e: parts.length === 1 ? parts[0] : { k: 'concat', parts, loc }, loc };
      }
      const parts = [first];
      while (this.s.accept(',')) parts.push(this.expr());
      this.s.expect('}');
      return { k: 'concat', parts, loc };
    } else {
      throw new HdlError(`syntax error near '${t.v}'`, loc);
    }
    while (this.s.is('[')) {
      const l = this.s.next().loc;
      const a = this.expr();
      if (this.s.accept(':')) {
        const b = this.expr();
        this.s.expect(']');
        e = { k: 'slice', base: e, left: a, right: b, loc: l };
      } else if (this.s.is('+:') || this.s.is('-:')) {
        const up = this.s.next().v === '+:';
        const w = this.expr();
        this.s.expect(']');
        e = { k: 'pslice', base: e, start: a, width: w, up, loc: l };
      } else {
        this.s.expect(']');
        e = { k: 'index', base: e, index: a, loc: l };
      }
    }
    return e;
  }
}

function num(value: number, loc: Loc): AExpr {
  return { k: 'num', value, width: null, loc };
}

export function parseVerilog(src: string): AModule[] {
  // `timescale 1ns / 1ps: the first number is the unit of # delays and $time
  const ts = /`timescale\s+(1|10|100)\s*(s|ms|us|ns|ps|fs)\b/.exec(src);
  const unit = ts ? Number(ts[1]) * TIME_UNITS[ts[2]] : 1000;
  return new VerilogParser(src, Math.max(1, unit)).parseFile();
}
