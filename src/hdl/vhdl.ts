// Recursive-descent parser for a synthesizable VHDL-93/2008 subset.
// The lexer lower-cases identifiers, since VHDL is case-insensitive.
import { HdlError, type ADecl, type AExpr, type AItem, type AModule, type APort, type AStmt, type AType, type Loc } from './ast';
import { lex, TokStream, type Tok } from './lexer';

const LOGICAL = ['and', 'or', 'nand', 'nor', 'xor', 'xnor'];
const RELATIONAL = ['=', '/=', '<', '<=', '>', '>='];
const SHIFT = ['sll', 'srl', 'sla', 'sra', 'rol', 'ror'];
const ADDING = ['+', '-', '&'];
const MULT = ['*', '/', 'mod', 'rem'];

interface Entity {
  name: string;
  generics: AModule['params'];
  ports: APort[];
  loc: Loc;
}

function parseBits(v: string, loc: Loc): AExpr {
  const [base, digits] = v.split(':');
  let value = 0;
  let dc = 0;
  let width = 0;
  const bits = base === 'b' ? 1 : base === 'o' ? 3 : 4;
  for (const ch0 of digits) {
    const ch = ch0.toLowerCase();
    value = value * 2 ** bits;
    dc = dc * 2 ** bits;
    width += bits;
    if ('xzuw-'.includes(ch)) dc += 2 ** bits - 1;
    else if (ch === 'h') value += 1;
    else if (ch === 'l') value += 0;
    else {
      const d = parseInt(ch, 16);
      if (Number.isNaN(d) || d >= 2 ** bits) throw new HdlError(`bad bit-string literal "${digits}"`, loc);
      value += d;
    }
  }
  if (width > 32) throw new HdlError('vectors wider than 32 bits are not supported', loc, 'Synth 8-9999');
  return { k: 'num', value, width: Math.max(width, 1), dc: dc || undefined, loc };
}

class VhdlParser {
  s: TokStream;
  entities = new Map<string, Entity>();
  modules: AModule[] = [];
  constructor(src: string) {
    this.s = new TokStream(lex(src, 'vhdl'));
  }

  parseFile(): AModule[] {
    while (this.s.peek().t !== 'eof') {
      if (this.s.accept('library')) {
        this.skipTo(';');
      } else if (this.s.accept('use')) {
        this.skipTo(';');
      } else if (this.s.is('entity')) {
        this.entity();
      } else if (this.s.is('architecture')) {
        this.architecture();
      } else if (this.s.is('package')) {
        throw new HdlError('packages are not supported yet in this simulator', this.s.peek().loc, 'Synth 8-9999');
      } else {
        const t = this.s.peek();
        throw new HdlError(`syntax error near '${t.v}': expected entity or architecture`, t.loc);
      }
    }
    for (const e of this.entities.values()) {
      if (!this.modules.some((m) => m.name === e.name)) {
        throw new HdlError(`entity '${e.name}' has no architecture`, e.loc);
      }
    }
    return this.modules;
  }

  skipTo(v: string) {
    while (!this.s.is(v) && this.s.peek().t !== 'eof') this.s.next();
    this.s.expect(v);
  }

  endOf(kw: string) {
    // end [kw] [name];
    this.s.expect('end');
    this.s.accept(kw);
    if (this.s.peek().t === 'id') this.s.next();
    this.s.expect(';');
  }

  entity() {
    const loc = this.s.expect('entity').loc;
    const name = this.s.ident().v;
    this.s.expect('is');
    const ent: Entity = { name, generics: [], ports: [], loc };
    if (this.s.accept('generic')) {
      this.s.expect('(');
      for (;;) {
        const names = this.identList();
        this.s.expect(':');
        this.subtype();
        let value: AExpr = { k: 'num', value: 0, width: null, loc };
        if (this.s.accept(':=')) value = this.expr();
        for (const n of names) ent.generics.push({ name: n.v, value, local: false, loc: n.loc });
        if (!this.s.accept(';')) break;
      }
      this.s.expect(')');
      this.s.expect(';');
    }
    if (this.s.accept('port')) {
      this.s.expect('(');
      for (;;) {
        const names = this.identList();
        this.s.expect(':');
        let dir: APort['dir'] = 'input';
        if (this.s.accept('in')) dir = 'input';
        else if (this.s.accept('out') || this.s.accept('buffer')) dir = 'output';
        else if (this.s.accept('inout')) dir = 'inout';
        const type = this.subtype();
        let init: AExpr | undefined;
        if (this.s.accept(':=')) init = this.expr();
        for (const n of names) ent.ports.push({ name: n.v, dir, type, isReg: false, init, loc: n.loc });
        if (!this.s.accept(';')) break;
      }
      this.s.expect(')');
      this.s.expect(';');
    }
    this.endOf('entity');
    this.entities.set(name, ent);
  }

  identList(): Tok[] {
    const r = [this.s.ident()];
    while (this.s.accept(',')) r.push(this.s.ident());
    return r;
  }

  subtype(mod?: AModule): AType {
    const t = this.s.ident();
    const name = t.v;
    switch (name) {
      case 'std_logic':
      case 'std_ulogic':
      case 'bit':
      case 'boolean':
        return { signed: false };
      case 'std_logic_vector':
      case 'std_ulogic_vector':
      case 'bit_vector':
      case 'unsigned':
      case 'signed': {
        this.s.expect('(');
        const left = this.expr();
        if (!this.s.is('downto') && !this.s.is('to')) throw new HdlError(`expected 'downto' or 'to'`, this.s.peek().loc);
        this.s.next();
        const right = this.expr();
        this.s.expect(')');
        return { left, right, signed: name === 'signed' };
      }
      case 'integer':
      case 'natural':
      case 'positive': {
        if (this.s.accept('range')) {
          const lo = this.expr();
          const down = this.s.is('downto');
          if (!this.s.accept('to') && !this.s.accept('downto')) throw new HdlError(`expected 'to'`, this.s.peek().loc);
          const hi = this.expr();
          return { signed: false, intRange: down ? { lo: hi, hi: lo } : { lo, hi } };
        }
        if (name === 'integer') return { signed: true, intRange: 'integer' };
        return { signed: false, intRange: { lo: { k: 'num', value: 0, width: null, loc: t.loc }, hi: { k: 'num', value: 0x7fffffff, width: null, loc: t.loc } } };
      }
    }
    if (mod) {
      if (mod.enums[name]) return { signed: false, enumName: name };
      if (mod.arrayTypes[name]) return mod.arrayTypes[name];
    }
    throw new HdlError(`unsupported or unknown type '${name}'`, t.loc);
  }

  architecture() {
    const loc = this.s.expect('architecture').loc;
    this.s.ident();
    this.s.expect('of');
    const entName = this.s.ident().v;
    this.s.expect('is');
    const ent = this.entities.get(entName);
    if (!ent) throw new HdlError(`entity '${entName}' is not declared before its architecture`, loc);
    const mod: AModule = {
      name: ent.name,
      lang: 'vhdl',
      params: [...ent.generics],
      ports: ent.ports,
      decls: [],
      enums: {},
      arrayTypes: {},
      items: [],
      loc,
    };
    // declarative part
    while (!this.s.accept('begin')) {
      const t = this.s.peek();
      if (t.t === 'eof') throw new HdlError(`missing 'begin' in architecture`, loc);
      if (this.s.accept('signal')) {
        for (const d of this.objDecl(mod, 'reg')) mod.decls.push(d);
      } else if (this.s.accept('constant')) {
        for (const d of this.objDecl(mod, 'const')) {
          if (!d.init) throw new HdlError(`constant '${d.name}' needs a value`, d.loc);
          mod.params.push({ name: d.name, value: d.init, local: true, loc: d.loc });
        }
      } else if (this.s.accept('type')) {
        const n = this.s.ident().v;
        this.s.expect('is');
        if (this.s.accept('(')) {
          const lits = this.identList().map((x) => x.v);
          this.s.expect(')');
          mod.enums[n] = lits;
        } else if (this.s.accept('array')) {
          this.s.expect('(');
          const left = this.expr();
          if (!this.s.accept('to') && !this.s.accept('downto')) throw new HdlError(`expected 'to'`, this.s.peek().loc);
          const right = this.expr();
          this.s.expect(')');
          this.s.expect('of');
          const el = this.subtype(mod);
          mod.arrayTypes[n] = { ...el, arr: { left, right } };
        } else throw new HdlError(`unsupported type declaration`, t.loc);
        this.s.expect(';');
      } else if (this.s.accept('component')) {
        // component declarations just repeat the entity; skip them
        while (!(this.s.is('end') && this.s.is('component', 1))) {
          if (this.s.peek().t === 'eof') throw new HdlError(`missing 'end component'`, t.loc);
          this.s.next();
        }
        this.endOf('component');
      } else if (this.s.accept('attribute')) {
        this.skipTo(';');
      } else {
        throw new HdlError(`syntax error near '${t.v}' in architecture declarations`, t.loc);
      }
    }
    while (!this.s.is('end')) {
      if (this.s.peek().t === 'eof') throw new HdlError(`missing 'end architecture'`, loc);
      this.concurrent(mod);
    }
    this.endOf('architecture');
    const idx = this.modules.findIndex((m) => m.name === mod.name);
    if (idx >= 0) this.modules[idx] = mod;
    else this.modules.push(mod);
  }

  objDecl(mod: AModule, kind: ADecl['kind']): ADecl[] {
    const names = this.identList();
    this.s.expect(':');
    const type = this.subtype(mod);
    let init: AExpr | undefined;
    if (this.s.accept(':=')) init = this.expr();
    this.s.expect(';');
    return names.map((n) => ({ name: n.v, type, init, kind, loc: n.loc }));
  }

  concurrent(mod: AModule) {
    const t = this.s.peek();
    let label: string | undefined;
    if (t.t === 'id' && this.s.is(':', 1)) {
      label = t.v;
      this.s.next();
      this.s.next();
    }
    const loc = this.s.peek().loc;
    if (this.s.accept('process')) {
      let sensNames: Tok[] = [];
      let all = false;
      if (this.s.accept('(')) {
        if (this.s.accept('all')) all = true;
        else sensNames = this.identList();
        this.s.expect(')');
      }
      this.s.accept('is');
      const decls: ADecl[] = [];
      while (!this.s.accept('begin')) {
        const d = this.s.peek();
        if (this.s.accept('variable')) decls.push(...this.objDecl(mod, 'reg'));
        else if (this.s.accept('constant')) decls.push(...this.objDecl(mod, 'const'));
        else throw new HdlError(`syntax error near '${d.v}' in process declarations`, d.loc);
      }
      const body = this.seqList(['end']);
      this.s.expect('end');
      this.s.expect('process');
      if (this.s.peek().t === 'id') this.s.next();
      this.s.expect(';');
      if (!all && sensNames.length === 0) throw new HdlError(`processes need a sensitivity list (wait statements are not supported)`, loc, 'Synth 8-9999');
      const clocked = !all && usesEdge(body);
      const sens: AItem & { k: 'always' } = {
        k: 'always',
        sens: clocked ? { edges: sensNames.map((n) => ({ name: n.v, edge: 'any' as const, loc: n.loc })) } : 'comb',
        body,
        decls,
        loc,
      };
      mod.items.push(sens);
      return;
    }
    if (this.s.accept('with')) {
      const sel = this.expr();
      this.s.expect('select');
      const lhs = this.target();
      this.s.expect('<=');
      const items: { labels: AExpr[]; body: AStmt[] }[] = [];
      let def: AStmt[] | null = null;
      for (;;) {
        const rhs = this.expr();
        this.s.expect('when');
        const body: AStmt[] = [{ k: 'assign', lhs, rhs, nb: false, loc }];
        if (this.s.accept('others')) def = body;
        else items.push({ labels: this.choices(), body });
        if (!this.s.accept(',')) break;
      }
      this.s.expect(';');
      mod.items.push({ k: 'always', sens: 'comb', body: [{ k: 'case', sel, items, def, wild: false, loc }], decls: [], loc });
      return;
    }
    if (this.s.accept('assert')) {
      this.skipTo(';');
      return;
    }
    // instantiation:  label : [entity work.]name [generic map (...)] port map (...);
    if (label !== undefined && (this.s.is('entity') || this.s.is('component') || this.s.is('port', 1) || this.s.is('generic', 1))) {
      this.s.accept('component');
      if (this.s.accept('entity')) {
        this.s.ident(); // library (work)
        this.s.expect('.');
      }
      const modName = this.s.ident().v;
      if (this.s.accept('(')) {
        this.s.ident(); // architecture name
        this.s.expect(')');
      }
      const params: { name?: string; value: AExpr }[] = [];
      const conns: { port?: string; expr?: AExpr }[] = [];
      if (this.s.accept('generic')) {
        this.s.expect('map');
        for (const a of this.assocList()) params.push({ name: a.port, value: a.expr! });
      }
      this.s.expect('port');
      this.s.expect('map');
      conns.push(...this.assocList());
      this.s.expect(';');
      mod.items.push({ k: 'inst', module: modName, name: label, params, conns, loc });
      return;
    }
    // concurrent signal assignment, possibly conditional
    const lhs = this.target();
    this.s.expect('<=');
    let rhs = this.waveform();
    if (this.s.is('when')) {
      const chain: { c: AExpr; v: AExpr }[] = [];
      let last = rhs;
      let fallback: AExpr | null = null;
      while (this.s.accept('when')) {
        const c = this.expr();
        chain.push({ c, v: last });
        if (this.s.accept('else')) {
          last = this.waveform();
          fallback = last;
        } else {
          fallback = null;
          break;
        }
      }
      if (!fallback) throw new HdlError(`conditional assignment needs a final 'else' value`, loc);
      rhs = fallback;
      for (let i = chain.length - 1; i >= 0; i--) rhs = { k: 'cond', c: chain[i].c, t: chain[i].v, f: rhs, loc };
    }
    this.s.expect(';');
    mod.items.push({ k: 'assign', lhs, rhs, loc });
  }

  waveform(): AExpr {
    const e = this.expr();
    if (this.s.accept('after')) {
      this.expr();
      if (this.s.peek().t === 'id' && ['ns', 'ps', 'us', 'ms', 'fs', 'sec'].includes(this.s.peek().v)) this.s.next();
    }
    return e;
  }

  assocList(): { port?: string; expr?: AExpr }[] {
    const r: { port?: string; expr?: AExpr }[] = [];
    this.s.expect('(');
    for (;;) {
      if (this.s.peek().t === 'id' && this.s.is('=>', 1)) {
        const port = this.s.next().v;
        this.s.next();
        if (this.s.accept('open')) r.push({ port });
        else r.push({ port, expr: this.expr() });
      } else r.push({ expr: this.expr() });
      if (!this.s.accept(',')) break;
    }
    this.s.expect(')');
    return r;
  }

  target(): AExpr {
    const t = this.s.peek();
    if (t.t !== 'id') throw new HdlError(`syntax error near '${t.v}': expected a signal name`, t.loc);
    return this.name();
  }

  choices(): AExpr[] {
    const r = [this.simple()];
    while (this.s.accept('|')) r.push(this.simple());
    if (this.s.is('to') || this.s.is('downto')) throw new HdlError('range choices in case statements are not supported yet', this.s.peek().loc, 'Synth 8-9999');
    return r;
  }

  seqList(terminators: string[]): AStmt[] {
    const body: AStmt[] = [];
    while (!terminators.some((x) => this.s.is(x))) {
      if (this.s.peek().t === 'eof') throw new HdlError(`unexpected end of file`, this.s.peek().loc);
      const st = this.seq();
      if (st) body.push(st);
    }
    return body;
  }

  seq(): AStmt | null {
    const t = this.s.peek();
    const loc = t.loc;
    // optional statement label
    if (t.t === 'id' && this.s.is(':', 1) && !this.s.is('=', 2)) {
      this.s.next();
      this.s.next();
    }
    if (this.s.accept('null')) {
      this.s.expect(';');
      return null;
    }
    if (this.s.accept('if')) {
      const cond = this.expr();
      this.s.expect('then');
      const then = this.seqList(['elsif', 'else', 'end']);
      let els: AStmt[] = [];
      if (this.s.is('elsif')) {
        // rewrite elsif as nested if
        const l = this.s.peek().loc;
        this.s.next();
        this.s.toks[this.s.p - 1] = { t: 'id', v: 'if', loc: l };
        this.s.p--;
        const inner = this.seqIfNoEnd();
        els = [inner];
      } else if (this.s.accept('else')) {
        els = this.seqList(['end']);
      }
      this.s.expect('end');
      this.s.expect('if');
      if (this.s.peek().t === 'id') this.s.next();
      this.s.expect(';');
      return { k: 'if', cond, then, els, loc };
    }
    if (this.s.accept('case')) {
      const sel = this.expr();
      this.s.expect('is');
      const items: { labels: AExpr[]; body: AStmt[] }[] = [];
      let def: AStmt[] | null = null;
      while (this.s.accept('when')) {
        if (this.s.accept('others')) {
          this.s.expect('=>');
          def = this.seqList(['when', 'end']);
        } else {
          const labels = this.choices();
          this.s.expect('=>');
          items.push({ labels, body: this.seqList(['when', 'end']) });
        }
      }
      this.s.expect('end');
      this.s.expect('case');
      if (this.s.peek().t === 'id') this.s.next();
      this.s.expect(';');
      return { k: 'case', sel, items, def, wild: false, loc };
    }
    if (this.s.accept('for')) {
      const v = this.s.ident().v;
      this.s.expect('in');
      const from = this.expr();
      const down = this.s.is('downto');
      if (!this.s.accept('to') && !this.s.accept('downto')) throw new HdlError(`expected 'to'`, this.s.peek().loc);
      const to = this.expr();
      this.s.expect('loop');
      const body = this.seqList(['end']);
      this.s.expect('end');
      this.s.expect('loop');
      if (this.s.peek().t === 'id') this.s.next();
      this.s.expect(';');
      return { k: 'vfor', v, from, to, down, body, loc };
    }
    if (this.s.is('report') || this.s.is('assert') || this.s.is('wait')) {
      if (this.s.is('wait')) throw new HdlError(`'wait' statements are not supported in synthesizable code`, loc, 'Synth 8-9999');
      this.skipTo(';');
      return null;
    }
    const lhs = this.target();
    let nb: boolean;
    if (this.s.accept('<=')) nb = true;
    else if (this.s.accept(':=')) nb = false;
    else throw new HdlError(`syntax error near '${this.s.peek().v}': expected '<=' or ':='`, this.s.peek().loc);
    const rhs = this.waveform();
    this.s.expect(';');
    return { k: 'assign', lhs, rhs, nb, loc };
  }

  // Parses "if cond then ... [elsif ...] [else ...]" without consuming the final "end if;" (shared by the outer if).
  seqIfNoEnd(): AStmt {
    const loc = this.s.expect('if').loc;
    const cond = this.expr();
    this.s.expect('then');
    const then = this.seqList(['elsif', 'else', 'end']);
    let els: AStmt[] = [];
    if (this.s.is('elsif')) {
      const l = this.s.peek().loc;
      this.s.next();
      this.s.toks[this.s.p - 1] = { t: 'id', v: 'if', loc: l };
      this.s.p--;
      els = [this.seqIfNoEnd()];
    } else if (this.s.accept('else')) {
      els = this.seqList(['end']);
    }
    return { k: 'if', cond, then, els, loc };
  }

  // ---- expressions ----
  expr(): AExpr {
    let a = this.relation();
    for (;;) {
      const t = this.s.peek();
      if (t.t === 'id' && LOGICAL.includes(t.v)) {
        this.s.next();
        const b = this.relation();
        a = { k: 'bin', op: t.v, a, b, loc: t.loc };
      } else return a;
    }
  }

  relation(): AExpr {
    const a = this.shiftExpr();
    const t = this.s.peek();
    if (t.t === 'op' && RELATIONAL.includes(t.v)) {
      this.s.next();
      const b = this.shiftExpr();
      return { k: 'bin', op: t.v === '=' ? '==' : t.v === '/=' ? '!=' : t.v, a, b, loc: t.loc };
    }
    return a;
  }

  shiftExpr(): AExpr {
    const a = this.simple();
    const t = this.s.peek();
    if (t.t === 'id' && SHIFT.includes(t.v)) {
      this.s.next();
      const b = this.simple();
      return { k: 'bin', op: t.v, a, b, loc: t.loc };
    }
    return a;
  }

  simple(): AExpr {
    let a: AExpr;
    const t0 = this.s.peek();
    if (t0.t === 'op' && (t0.v === '-' || t0.v === '+')) {
      this.s.next();
      a = { k: 'un', op: t0.v, a: this.term(), loc: t0.loc };
    } else a = this.term();
    let cat: (AExpr & { k: 'concat' }) | null = null;
    for (;;) {
      const t = this.s.peek();
      if (t.t === 'op' && ADDING.includes(t.v)) {
        this.s.next();
        const b = this.term();
        if (t.v === '&') {
          if (cat && a === cat) cat.parts.push(b);
          else a = cat = { k: 'concat', parts: [a, b], loc: t.loc };
        } else a = { k: 'bin', op: t.v, a, b, loc: t.loc };
      } else return a;
    }
  }

  term(): AExpr {
    let a = this.factor();
    for (;;) {
      const t = this.s.peek();
      if ((t.t === 'op' || t.t === 'id') && MULT.includes(t.v)) {
        this.s.next();
        const b = this.factor();
        a = { k: 'bin', op: t.v === 'mod' || t.v === 'rem' ? '%' : t.v, a, b, loc: t.loc };
      } else return a;
    }
  }

  factor(): AExpr {
    const t = this.s.peek();
    if (t.t === 'id' && t.v === 'not') {
      this.s.next();
      return { k: 'un', op: '~', a: this.factor(), loc: t.loc };
    }
    if (t.t === 'id' && t.v === 'abs') {
      this.s.next();
      return { k: 'call', name: 'abs', args: [this.factor()], loc: t.loc };
    }
    const a = this.primary();
    if (this.s.is('**')) {
      const l = this.s.next().loc;
      return { k: 'bin', op: '**', a, b: this.primary(), loc: l };
    }
    return a;
  }

  primary(): AExpr {
    const t = this.s.peek();
    const loc = t.loc;
    if (t.t === 'num') {
      this.s.next();
      const m = /^(\d+)#([0-9a-fA-F_]+)#$/.exec(t.v);
      if (m) return { k: 'num', value: parseInt(m[2].replace(/_/g, ''), Number(m[1])), width: null, loc };
      return { k: 'num', value: Number(t.v.replace(/_/g, '')), width: null, loc };
    }
    if (t.t === 'chr') {
      this.s.next();
      const c = t.v.toLowerCase();
      if (c === '1' || c === 'h') return { k: 'num', value: 1, width: 1, loc };
      if (c === '-' || c === 'x' || c === 'z' || c === 'u') return { k: 'num', value: 0, width: 1, dc: 1, loc };
      return { k: 'num', value: 0, width: 1, loc };
    }
    if (t.t === 'bits') {
      this.s.next();
      return parseBits(t.v, loc);
    }
    if (t.v === '(' && t.t === 'op') {
      this.s.next();
      if (this.s.accept('others')) {
        this.s.expect('=>');
        const bit = this.expr();
        this.s.expect(')');
        return { k: 'others', bit, loc };
      }
      const e = this.expr();
      if (this.s.is('=>')) throw new HdlError('only (others => ...) aggregates are supported', this.s.peek().loc, 'Synth 8-9999');
      this.s.expect(')');
      return e;
    }
    if (t.t === 'id') {
      if (t.v === 'true' || t.v === 'false') {
        this.s.next();
        return { k: 'num', value: t.v === 'true' ? 1 : 0, width: 1, loc };
      }
      return this.name();
    }
    throw new HdlError(`syntax error near '${t.v}'`, loc);
  }

  name(): AExpr {
    const t = this.s.ident();
    let e: AExpr = { k: 'id', name: t.v, loc: t.loc };
    for (;;) {
      if (this.s.is('(')) {
        const l = this.s.next().loc;
        const first = this.expr();
        if (this.s.is('downto') || this.s.is('to')) {
          this.s.next();
          const right = this.expr();
          this.s.expect(')');
          e = { k: 'slice', base: e, left: first, right, loc: l };
          continue;
        }
        const args = [first];
        while (this.s.accept(',')) args.push(this.expr());
        this.s.expect(')');
        if (e.k === 'id') e = { k: 'call', name: e.name, args, loc: e.loc };
        else if (args.length === 1) e = { k: 'index', base: e, index: args[0], loc: l };
        else throw new HdlError('multi-dimensional indexing is not supported', l);
        continue;
      }
      if (this.s.is("'") && this.s.peek(1).t === 'id') {
        const l = this.s.next().loc;
        const attr = this.s.next().v;
        e = { k: 'attr', base: e, attr, loc: l };
        continue;
      }
      if (this.s.is('.') && this.s.peek(1).t === 'id') {
        // selected names such as work.foo are not expressions; keep the suffix
        this.s.next();
        e = { k: 'id', name: this.s.next().v, loc: t.loc };
        continue;
      }
      return e;
    }
  }
}

function exprUsesEdge(e: AExpr | undefined): boolean {
  if (!e) return false;
  switch (e.k) {
    case 'call':
      return e.name === 'rising_edge' || e.name === 'falling_edge' || e.args.some(exprUsesEdge);
    case 'attr':
      return e.attr === 'event';
    case 'bin':
      return exprUsesEdge(e.a) || exprUsesEdge(e.b);
    case 'un':
      return exprUsesEdge(e.a);
    default:
      return false;
  }
}

function usesEdge(body: AStmt[]): boolean {
  return body.some((s) => {
    switch (s.k) {
      case 'if':
        return exprUsesEdge(s.cond) || usesEdge(s.then) || usesEdge(s.els);
      case 'case':
        return s.items.some((i) => usesEdge(i.body)) || (s.def ? usesEdge(s.def) : false);
      case 'block':
        return usesEdge(s.body);
      case 'vfor':
      case 'for':
        return usesEdge(s.body);
      default:
        return false;
    }
  });
}

export function parseVhdl(src: string): AModule[] {
  return new VhdlParser(src).parseFile();
}
