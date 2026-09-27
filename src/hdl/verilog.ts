// Recursive-descent parser for a synthesizable Verilog-2001 subset (+ a few SystemVerilog keywords).
import { HdlError, type ASens, type ADecl, type AExpr, type AItem, type AModule, type APort, type AStmt, type AType, type Loc } from './ast';
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

class VerilogParser {
  s: TokStream;
  constructor(src: string) {
    this.s = new TokStream(lex(src, 'verilog'));
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
    const mod: AModule = { name, lang: 'verilog', params: [], ports: [], decls: [], enums: {}, arrayTypes: {}, items: [], loc };
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
    if (t.t === 'sys') {
      // $display / $finish ... ignored
      while (!this.s.is(';') && this.s.peek().t !== 'eof') this.s.next();
      this.s.expect(';');
      return { k: 'block', body: [], loc };
    }
    const lhs = this.lvalue();
    let nb = false;
    if (this.s.accept('<=')) nb = true;
    else if (this.s.is('++') || (this.s.is('+') && this.s.is('+', 1))) {
      throw new HdlError(`use 'x = x + 1' instead of '++'`, loc);
    } else this.s.expect('=');
    const rhs = this.expr();
    this.s.expect(';');
    return { k: 'assign', lhs, rhs, nb, loc };
  }

  simpleAssign(): AStmt {
    const loc = this.s.peek().loc;
    const lhs = this.lvalue();
    this.s.expect('=');
    return { k: 'assign', lhs, rhs: this.expr(), nb: false, loc };
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
      e = { k: 'id', name: t.v, loc };
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
  return new VerilogParser(src).parseFile();
}
