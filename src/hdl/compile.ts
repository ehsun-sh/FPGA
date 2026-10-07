// Compiles an elaborated Design into a JavaScript cycle simulator (2-state, event-driven delta cycles).
import { HdlError } from './ast';
import { mask, type Design, type Expr, type LVal, type Part, type Proc, type Stmt } from './ir';

interface Gen {
  design: Design;
  // trigger signal id -> slot number (for edge/event expressions)
  slots: Map<number, number>;
  inSeq: boolean;
  tmp: number;
  // non-blocking targets that nothing else writes: committed unconditionally (keeps n[i] === v[i] between cycles)
  staticNb: Set<number>;
  // generating a testbench thread (a JS generator): delays and waits become yields
  inTb: boolean;
  // generating a combinational process: messages are dropped (it re-runs many times per step)
  inComb: boolean;
  // message templates referenced by H.pr / H.mon
  prints: Part[][];
  printSev: number[];
}

const M = (code: string, w: number): string => (w >= 32 ? `((${code})>>>0)` : `((${code})&${mask(w)})`);
const sx = (code: string, w: number): string => (w >= 32 ? `((${code})|0)` : `(((${code})<<${32 - w})>>${32 - w})`);

function selfW(e: Expr, g: Gen): number {
  const d = g.design;
  switch (e.k) {
    case 'const':
      return e.width;
    case 'sig':
      return d.sigs[e.id].width;
    case 'sel':
      return e.width;
    case 'mem':
      return d.mems[e.mem].width;
    case 'un':
      return ['~', '-', '+'].includes(e.op) ? selfW(e.a, g) : 1;
    case 'bin':
      if (['+', '-', '*', '/', '%', '&', '|', '^', '~^', '^~'].includes(e.op)) return Math.max(selfW(e.a, g), selfW(e.b, g));
      if (['<<', '>>', '<<<', '>>>', '**'].includes(e.op)) return selfW(e.a, g);
      return 1;
    case 'cond':
      return Math.max(selfW(e.t, g), selfW(e.f, g));
    case 'concat':
      return e.parts.reduce((s, p) => s + (selfW(p, g) || 32), 0);
    case 'resize':
      return e.width;
    case 'cast':
      return selfW(e.a, g);
    case 'edge':
    case 'event':
      return 1;
    case 'others':
      return 0;
    case 'now':
    case 'random':
      return 32;
  }
}

function isSigned(e: Expr, g: Gen): boolean {
  switch (e.k) {
    case 'const':
      return !!e.signed;
    case 'sig':
      return g.design.sigs[e.id].signed;
    case 'mem':
      return g.design.mems[e.mem].signed;
    case 'cast':
    case 'resize':
      return e.signed;
    case 'un':
      return (e.op === '-' || e.op === '~' || e.op === '+') && isSigned(e.a, g);
    case 'bin':
      if (['+', '-', '*', '/', '%', '&', '|', '^', '~^'].includes(e.op)) return isSigned(e.a, g) && (isSigned(e.b, g) || (e.b.k === 'const' && e.b.width === 0));
      if (['<<', '>>', '<<<', '>>>'].includes(e.op)) return isSigned(e.a, g);
      return false;
    case 'cond':
      return isSigned(e.t, g) && isSigned(e.f, g);
    default:
      return false;
  }
}

// value of e as an unsigned number < 2^W (sign-extending signed operands)
function ex(e: Expr, W: number, g: Gen): string {
  if (W > 32) throw new HdlError('expression wider than 32 bits is not supported', undefined, 'Synth 8-9999');
  if (W <= 0) W = 32;
  const sw = selfW(e, g);
  const extend = (code: string): string => {
    if (sw > 0 && sw < W && isSigned(e, g)) return M(sx(code, sw), W);
    if (sw > W) return M(code, W);
    return code;
  };
  switch (e.k) {
    case 'const': {
      let v = e.value;
      if (e.width > 0 && e.width < W && e.signed && v >= 2 ** (e.width - 1)) v = v - 2 ** e.width;
      v = ((v % 2 ** W) + 2 ** W) % 2 ** W;
      return String(v);
    }
    case 'sig':
      return extend(`v[${e.id}]`);
    case 'mem': {
      const m = g.design.mems[e.mem];
      const addr = ex(e.addr, Math.max(selfW(e.addr, g), 1), g);
      return extend(`(M[${e.mem}][${m.lo ? `${addr}-${m.lo}` : addr}]??0)`);
    }
    case 'sel': {
      const aw = selfW(e.a, g) || 32;
      const a = ex(e.a, aw, g);
      if (e.lo.k === 'const') {
        const lo = e.lo.value;
        const code = lo === 0 ? (e.width >= aw ? a : `(${a}&${mask(e.width)})`) : `((${a}>>>${lo})&${mask(e.width)})`;
        return extend(code);
      }
      const lo = ex(e.lo, Math.max(selfW(e.lo, g), 1), g);
      return extend(`((${a}>>>(${lo}))&${mask(e.width)})`);
    }
    case 'un': {
      switch (e.op) {
        case '~':
          return M(`~${ex(e.a, W, g)}`, W);
        case '-':
          return M(`-${ex(e.a, W, g)}`, W);
        case '+':
          return ex(e.a, W, g);
        case '!': {
          const w = selfW(e.a, g) || 32;
          return `(${ex(e.a, w, g)}===0?1:0)`;
        }
      }
      const w = selfW(e.a, g) || 32;
      const a = ex(e.a, w, g);
      switch (e.op) {
        case '&':
          return `(${a}===${mask(w)}?1:0)`;
        case '~&':
          return `(${a}===${mask(w)}?0:1)`;
        case '|':
          return `(${a}!==0?1:0)`;
        case '~|':
          return `(${a}!==0?0:1)`;
        case '^':
          return `par(${a})`;
        case '~^':
        case '^~':
          return `(par(${a})^1)`;
      }
      throw new HdlError(`unsupported operator '${e.op}'`);
    }
    case 'bin': {
      const op = e.op;
      if (['+', '-', '*', '/', '%', '&', '|', '^', '~^', '^~', '**'].includes(op)) {
        const a = ex(e.a, W, g);
        const b = ex(e.b, W, g);
        switch (op) {
          case '+':
            return M(`${a}+${b}`, W);
          case '-':
            return M(`${a}-${b}`, W);
          case '*':
            return M(`Math.imul(${a},${b})`, W);
          case '&':
            return M(`${a}&${b}`, W);
          case '|':
            return M(`${a}|${b}`, W);
          case '^':
            return M(`${a}^${b}`, W);
          case '~^':
          case '^~':
            return M(`~(${a}^${b})`, W);
          case '**':
            return M(`Math.pow(${a},${b})`, W);
          case '/':
          case '%': {
            if (isSigned(e, g)) {
              const sa = sx(a, W);
              const sb = sx(b, W);
              return op === '/' ? `(${b}===0?0:${M(`Math.trunc(${sa}/${sb})`, W)})` : `(${b}===0?0:${M(`${sa}%${sb}`, W)})`;
            }
            return op === '/' ? `(${b}===0?0:${M(`Math.floor(${a}/${b})`, W)})` : `(${b}===0?0:(${a}%${b}))`;
          }
        }
      }
      if (['==', '!=', '===', '!==', '<', '<=', '>', '>='].includes(op)) {
        let cw = Math.max(selfW(e.a, g), selfW(e.b, g));
        if (cw <= 0) cw = 32;
        let a = ex(e.a, cw, g);
        let b = ex(e.b, cw, g);
        const signed = isSigned(e.a, g) && (isSigned(e.b, g) || (e.b.k === 'const' && e.b.width === 0));
        const signedB = isSigned(e.b, g) && (isSigned(e.a, g) || (e.a.k === 'const' && e.a.width === 0));
        if (signed || signedB) {
          a = sx(a, cw);
          b = sx(b, cw);
        }
        const js = op === '==' || op === '===' ? '===' : op === '!=' || op === '!==' ? '!==' : op;
        return `(${a}${js}${b}?1:0)`;
      }
      if (op === '&&' || op === '||') {
        const a = ex(e.a, selfW(e.a, g) || 32, g);
        const b = ex(e.b, selfW(e.b, g) || 32, g);
        return `((${a}!==0)${op}(${b}!==0)?1:0)`;
      }
      if (['<<', '<<<', '>>', '>>>'].includes(op)) {
        const a = ex(e.a, W, g);
        const b = ex(e.b, selfW(e.b, g) || 32, g);
        if (op === '<<' || op === '<<<') return `(${b}>=${W}?0:${M(`${a}<<${b}`, W)})`;
        if (op === '>>>' && isSigned(e.a, g)) return M(`${sx(a, W)}>>(${b}>31?31:${b})`, W);
        return `(${b}>=32?0:(${a}>>>${b}))`;
      }
      throw new HdlError(`unsupported operator '${op}'`);
    }
    case 'cond':
      return `(${ex(e.c, selfW(e.c, g) || 32, g)}!==0?${ex(e.t, W, g)}:${ex(e.f, W, g)})`;
    case 'concat': {
      let total = 0;
      const parts: string[] = [];
      for (let i = e.parts.length - 1; i >= 0; i--) {
        const p = e.parts[i];
        let w = selfW(p, g);
        if (w === 0) {
          if (p.k === 'others') throw new HdlError('(others => ...) cannot be used inside a concatenation');
          w = 32;
        }
        const c = ex(p, w, g);
        parts.unshift(total === 0 ? c : `${c}*${2 ** total}`);
        total += w;
      }
      if (total > 32) throw new HdlError(`concatenation is ${total} bits wide; more than 32 bits is not supported`, undefined, 'Synth 8-9999');
      const code = `(${parts.join('+')})`;
      return total > W ? M(code, W) : code;
    }
    case 'resize': {
      const aw = selfW(e.a, g) || 32;
      const inner = ex(e.a, Math.max(aw, e.width), g);
      return extend(e.width >= 32 ? inner : `(${inner}&${mask(e.width)})`);
    }
    case 'cast': {
      const aw = selfW(e.a, g) || 32;
      const inner = ex(e.a, aw, g);
      if (e.signed && aw < W) return M(sx(inner, aw), W);
      return aw > W ? M(inner, W) : inner;
    }
    case 'edge':
    case 'event': {
      const slot = g.slots.get(e.id);
      if (slot === undefined || !g.inSeq) throw new HdlError(`'${g.design.sigs[e.id].name}' must be in the process sensitivity list`, undefined, 'Synth 8-9999');
      if (e.k === 'event') return `(e${slot}?1:0)`;
      return `(e${slot}&&(v[${e.id}]&1)===${e.rising ? 1 : 0}?1:0)`;
    }
    case 'others':
      return `(${ex(e.bit, 1, g)}!==0?${mask(W)}:0)`;
    case 'now':
      return M(`Math.floor(H.t/${e.div})`, W);
    case 'random':
      return M(`(Math.random()*4294967296)`, W);
  }
}

function lvalWidth(l: LVal, g: Gen): number {
  switch (l.k) {
    case 'sig':
      return g.design.sigs[l.id].width;
    case 'sel':
      return l.width;
    case 'mem':
      return g.design.mems[l.mem].width;
    case 'concat':
      return l.parts.reduce((s, p) => s + lvalWidth(p, g), 0);
  }
}

function writeCode(l: LVal, val: string, nb: boolean, g: Gen): string {
  switch (l.k) {
    case 'sig':
      if (!nb) return `v[${l.id}]=${val};`;
      if (g.staticNb.has(l.id)) return `n[${l.id}]=${val};`;
      return `if(!d[${l.id}]){d[${l.id}]=1;dl[dn++]=${l.id};}n[${l.id}]=${val};`;
    case 'sel': {
      const sig = g.design.sigs[l.id];
      const m = mask(l.width);
      const arr = nb ? 'n' : 'v';
      const pre = nb && !g.staticNb.has(l.id) ? `if(!d[${l.id}]){d[${l.id}]=1;dl[dn++]=${l.id};n[${l.id}]=v[${l.id}];}` : '';
      if (l.lo.k === 'const') {
        const lo = l.lo.value;
        if (lo < 0 || lo + l.width > sig.width) return '';
        if (lo === 0 && l.width >= 32) return pre + `${arr}[${l.id}]=${val};`;
        const nm = ~(m * 2 ** lo) >>> 0;
        return pre + `${arr}[${l.id}]=(${arr}[${l.id}]&${nm})|((${val})<<${lo});`;
      }
      const t = `lo${g.tmp++}`;
      const lo = ex(l.lo, Math.max(selfW(l.lo, g), 1), g);
      return `{const ${t}=${lo};if(${t}>=0&&${t}<${sig.width}){${pre}${arr}[${l.id}]=(${arr}[${l.id}]&~(${m}<<${t}))|((${val})<<${t});}}`;
    }
    case 'mem': {
      const m = g.design.mems[l.mem];
      const addr = ex(l.addr, Math.max(selfW(l.addr, g), 1), g);
      const a = m.lo ? `(${addr})-${m.lo}` : addr;
      return nb ? `mq.push(${l.mem},${a},${val});` : `M[${l.mem}][${a}]=${val};`;
    }
    case 'concat': {
      const t = `cv${g.tmp++}`;
      let code = `{const ${t}=${val};`;
      let shift = 0;
      for (let i = l.parts.length - 1; i >= 0; i--) {
        const p = l.parts[i];
        const w = lvalWidth(p, g);
        code += writeCode(p, `((${t}/${2 ** shift})&${mask(w)})`.replace(`/${1})`, ')'), nb, g);
        shift += w;
      }
      return code + '}';
    }
  }
}

function stmtCode(s: Stmt, g: Gen): string {
  switch (s.k) {
    case 'assign': {
      const lw = lvalWidth(s.lhs, g);
      const rw = selfW(s.rhs, g);
      const W = Math.max(lw, rw);
      if (W > 32) throw new HdlError(`assignment wider than 32 bits is not supported`, s.loc, 'Synth 8-9999');
      let val = ex(s.rhs, W, g);
      if (W > lw) val = M(val, lw);
      // testbench threads update signals immediately; the scheduler settles the design after each step
      return writeCode(s.lhs, val, s.nb && !g.inTb, g);
    }
    case 'delay':
      if (!g.inTb) throw new HdlError('delays are only allowed in testbench code', undefined, 'Synth 8-9999');
      return `yield ${ex(s.t, 32, g)};lg=0;`;
    case 'wait': {
      if (!g.inTb) throw new HdlError(`'wait' is only allowed in testbench code`, undefined, 'Synth 8-9999');
      if (!s.on.length && !s.until) return 'yield -1;';
      const edge = { pos: 1, neg: 2, any: 0 };
      const u = s.until ? `()=>${ex(s.until, selfW(s.until, g) || 32, g)}!==0` : 'null';
      return `yield {w:[${s.on.map((o) => o.id).join(',')}],e:[${s.on.map((o) => edge[o.edge]).join(',')}],u:${u},l:${s.level ? 1 : 0}};lg=0;`;
    }
    case 'print': {
      if (g.inComb) return '';
      const idx = g.prints.length;
      g.prints.push(s.parts.map((p) => ('s' in p ? p : { ...p, e: { k: 'const', value: 0, width: 0 } })));
      g.printSev.push(s.sev);
      const vals = s.parts.filter((p) => !('s' in p)).map((p) => ('e' in p ? ex(p.e, Math.max(p.width, 1), g) : '0'));
      return s.monitor ? `H.mon(${idx},()=>[${vals.join(',')}]);` : `H.pr(${idx},[${vals.join(',')}]);`;
    }
    case 'finish':
      return g.inTb ? 'H.fin();return;' : 'H.fin();';
    case 'loop': {
      const guard = `if(++lg>1000000)throw new Error('a loop runs forever without a delay or wait');`;
      const body = s.body.map((x) => stmtCode(x, g)).join('');
      if (s.count) {
        const t = `rp${g.tmp++}`;
        return `for(let ${t}=${ex(s.count, selfW(s.count, g) || 32, g)};${t}>0;${t}--){${guard}${body}}`;
      }
      if (s.cond) return `while(${ex(s.cond, selfW(s.cond, g) || 32, g)}!==0){${guard}${body}}`;
      return `for(;;){${guard}${body}}`;
    }
    case 'sched': {
      const t = `sv${g.tmp++}`;
      const lw = lvalWidth(s.lhs, g);
      const vals = s.items.map((i) => M(ex(i.rhs, Math.max(lw, selfW(i.rhs, g)), g), lw));
      let code = `{const ${t}=[${vals.join(',')}];`;
      s.items.forEach((i, k) => {
        code += `H.sch(${ex(i.t, 32, g)},()=>{${writeCode(s.lhs, `${t}[${k}]`, false, g)}});`;
      });
      return code + '}';
    }
    case 'if':
      return `if(${ex(s.c, selfW(s.c, g) || 32, g)}!==0){${s.t.map((x) => stmtCode(x, g)).join('')}}${s.f.length ? `else{${s.f.map((x) => stmtCode(x, g)).join('')}}` : ''}`;
    case 'case': {
      let cw = selfW(s.sel, g);
      for (const it of s.items) for (const l of it.labels) cw = Math.max(cw, selfW(l, g));
      if (cw <= 0) cw = 32;
      const t = `cs${g.tmp++}`;
      let code = `{const ${t}=${ex(s.sel, cw, g)};`;
      let first = true;
      for (const it of s.items) {
        const conds = it.labels.map((l) => {
          if (s.wild && l.k === 'const' && l.dc) {
            const care = ~l.dc & mask(cw);
            return `((${t}&${care >>> 0})===${(l.value & care) >>> 0})`;
          }
          return `${t}===${ex(l, cw, g)}`;
        });
        code += `${first ? '' : 'else '}if(${conds.join('||')}){${it.body.map((x) => stmtCode(x, g)).join('')}}`;
        first = false;
      }
      if (s.def) code += first ? s.def.map((x) => stmtCode(x, g)).join('') : `else{${s.def.map((x) => stmtCode(x, g)).join('')}}`;
      return code + '}';
    }
    case 'for':
      return `for(${stmtCode(s.init, g).replace(/;$/, '')};${ex(s.cond, selfW(s.cond, g) || 32, g)}!==0;){if(++lg>100000)throw new Error('for loop does not terminate');${s.body.map((x) => stmtCode(x, g)).join('')}${stmtCode(s.step, g)}}`;
    case 'block':
      return s.body.map((x) => stmtCode(x, g)).join('');
  }
}

// ---- dependency analysis ----
function collectReads(e: Expr, out: Set<number>, nSigs: number) {
  switch (e.k) {
    case 'sig':
      out.add(e.id);
      break;
    case 'mem':
      out.add(nSigs + e.mem);
      collectReads(e.addr, out, nSigs);
      break;
    case 'sel':
      collectReads(e.a, out, nSigs);
      collectReads(e.lo, out, nSigs);
      break;
    case 'un':
    case 'cast':
    case 'resize':
      collectReads(e.a, out, nSigs);
      break;
    case 'bin':
      collectReads(e.a, out, nSigs);
      collectReads(e.b, out, nSigs);
      break;
    case 'cond':
      collectReads(e.c, out, nSigs);
      collectReads(e.t, out, nSigs);
      collectReads(e.f, out, nSigs);
      break;
    case 'concat':
      e.parts.forEach((p) => collectReads(p, out, nSigs));
      break;
    case 'others':
      collectReads(e.bit, out, nSigs);
      break;
    case 'edge':
    case 'event':
      out.add(e.id);
      break;
  }
}

function collectLval(l: LVal, reads: Set<number>, writes: Set<number>, nSigs: number) {
  switch (l.k) {
    case 'sig':
      writes.add(l.id);
      break;
    case 'sel':
      writes.add(l.id);
      collectReads(l.lo, reads, nSigs);
      break;
    case 'mem':
      writes.add(nSigs + l.mem);
      collectReads(l.addr, reads, nSigs);
      break;
    case 'concat':
      l.parts.forEach((p) => collectLval(p, reads, writes, nSigs));
      break;
  }
}

function analyzeStmts(list: Stmt[], reads: Set<number>, writes: Set<number>, nSigs: number) {
  for (const s of list) {
    switch (s.k) {
      case 'assign':
        collectReads(s.rhs, reads, nSigs);
        collectLval(s.lhs, reads, writes, nSigs);
        break;
      case 'if':
        collectReads(s.c, reads, nSigs);
        analyzeStmts(s.t, reads, writes, nSigs);
        analyzeStmts(s.f, reads, writes, nSigs);
        break;
      case 'case':
        collectReads(s.sel, reads, nSigs);
        for (const it of s.items) {
          it.labels.forEach((l) => collectReads(l, reads, nSigs));
          analyzeStmts(it.body, reads, writes, nSigs);
        }
        if (s.def) analyzeStmts(s.def, reads, writes, nSigs);
        break;
      case 'for':
        analyzeStmts([s.init, s.step, ...s.body], reads, writes, nSigs);
        collectReads(s.cond, reads, nSigs);
        break;
      case 'block':
        analyzeStmts(s.body, reads, writes, nSigs);
        break;
      case 'delay':
        collectReads(s.t, reads, nSigs);
        break;
      case 'wait':
        s.on.forEach((o) => reads.add(o.id));
        if (s.until) collectReads(s.until, reads, nSigs);
        break;
      case 'print':
        s.parts.forEach((p) => 'e' in p && collectReads(p.e, reads, nSigs));
        break;
      case 'loop':
        if (s.count) collectReads(s.count, reads, nSigs);
        if (s.cond) collectReads(s.cond, reads, nSigs);
        analyzeStmts(s.body, reads, writes, nSigs);
        break;
      case 'sched':
        s.items.forEach((i) => {
          collectReads(i.rhs, reads, nSigs);
          collectReads(i.t, reads, nSigs);
        });
        collectLval(s.lhs, reads, writes, nSigs);
        break;
    }
  }
}

function lvalIds(l: LVal, out: Set<number>) {
  if (l.k === 'sig' || l.k === 'sel') out.add(l.id);
  else if (l.k === 'concat') l.parts.forEach((p) => lvalIds(p, out));
}

function assignTargets(list: Stmt[], nb: boolean, out: Set<number>) {
  for (const s of list) {
    if (s.k === 'assign') {
      if (s.nb === nb) lvalIds(s.lhs, out);
    } else if (s.k === 'if') {
      assignTargets(s.t, nb, out);
      assignTargets(s.f, nb, out);
    } else if (s.k === 'case') {
      s.items.forEach((it) => assignTargets(it.body, nb, out));
      if (s.def) assignTargets(s.def, nb, out);
    } else if (s.k === 'for') assignTargets([s.init, s.step, ...s.body], nb, out);
    else if (s.k === 'block' || s.k === 'loop') assignTargets(s.body, nb, out);
    else if (s.k === 'sched' && !nb) lvalIds(s.lhs, out);
  }
}

function orderComb(procs: Proc[]): { order: Proc[]; cyclic: boolean } {
  const writers = new Map<number, number[]>();
  procs.forEach((p, i) => p.writes!.forEach((w) => (writers.get(w) ?? writers.set(w, []).get(w)!).push(i)));
  const indeg = new Array(procs.length).fill(0);
  const succ: number[][] = procs.map(() => []);
  procs.forEach((p, j) => {
    const preds = new Set<number>();
    p.reads!.forEach((r) => writers.get(r)?.forEach((i) => i !== j && preds.add(i)));
    preds.forEach((i) => {
      succ[i].push(j);
      indeg[j]++;
    });
  });
  const queue: number[] = [];
  indeg.forEach((d, i) => d === 0 && queue.push(i));
  const order: number[] = [];
  while (queue.length) {
    const i = queue.shift()!;
    order.push(i);
    for (const j of succ[i]) if (--indeg[j] === 0) queue.push(j);
  }
  const cyclic = order.length < procs.length;
  if (cyclic) procs.forEach((_, i) => !order.includes(i) && order.push(i));
  return { order: order.map((i) => procs[i]), cyclic };
}

export interface CompiledSim {
  v: Uint32Array;
  mems: Uint32Array[];
  reset(): void;
  settle(): void;
  // runs `cycles` full clock periods on `clk`; calls onOut(cycleIndex) whenever a watched output changes
  run(cycles: number): number;
  // call after writing v/mems from another instance of the same design (between cycles) to adopt that state
  sync(): void;
  // testbench threads (generators); each yields a delay in ps, -1 to stop, or a wait descriptor
  threads: (() => Generator<TbYield, void, void>)[];
  // message templates for H.pr / H.mon, and their severities (0 note .. 3 failure)
  prints: Part[][];
  printSev: number[];
  source: string;
}

export type TbYield = number | { w: number[]; e: number[]; u: (() => boolean) | null; l: number };

// Callbacks the generated code uses for simulation-only statements.
export interface TbHost {
  t: number; // current simulation time in ps
  pr(template: number, vals: number[]): void;
  mon(template: number, vals: () => number[]): void;
  sch(delay: number, fn: () => void): void;
  fin(): void;
}

const NO_HOST: TbHost = { t: 0, pr() {}, mon() {}, sch() {}, fin() {} };

export function compileDesign(
  design: Design,
  opts: { clock?: number; watch?: number[]; onOut?: (cycle: number) => void; probe?: number[]; onProbe?: (cycle: number) => void; host?: TbHost } = {},
): CompiledSim {
  const nSigs = design.sigs.length;
  const slots = new Map<number, number>();
  for (const p of design.procs) {
    const reads = new Set<number>();
    const writes = new Set<number>();
    analyzeStmts(p.body, reads, writes, nSigs);
    p.reads = reads;
    p.writes = writes;
    if (p.kind === 'seq') for (const t of p.triggers) if (!slots.has(t.id)) slots.set(t.id, slots.size);
  }
  for (const p of design.ports) {
    if (p.dir === 'input') {
      for (const pr of design.procs) if (pr.writes!.has(p.id)) throw new HdlError(`input port '${p.name}' cannot be assigned`, pr.loc, 'Synth 8-6104');
    }
  }
  const nbTargets = new Set<number>();
  const blocking = new Set<number>();
  for (const p of design.procs) {
    if (p.kind === 'seq') assignTargets(p.body, true, nbTargets);
    assignTargets(p.body, false, blocking);
  }
  const staticNb = new Set([...nbTargets].filter((id) => !blocking.has(id)));
  const g: Gen = { design, slots, inSeq: false, tmp: 0, staticNb, inTb: false, inComb: true, prints: [], printSev: [] };
  const comb = design.procs.filter((p) => p.kind === 'comb');
  const seq = design.procs.filter((p) => p.kind === 'seq');
  const inits = design.procs.filter((p) => p.kind === 'init');
  const { order, cyclic } = orderComb(comb);
  const combBody = order.map((p) => stmtCode({ k: 'block', body: p.body }, g)).join('\n');
  const combFn = cyclic
    ? `function comb(){let lg=0;for(let it=0;it<64;it++){snap.set(v);${combBody}\nlet same=true;for(let i=0;i<v.length;i++){if(snap[i]!==v[i]){same=false;break;}}if(same)return;}throw new Error('combinational loop does not settle');}`
    : `function comb(){let lg=0;${combBody}}`;
  // combinational logic that (transitively) depends on clocked state: the only part that must re-run after a clock edge
  const affected = new Set<number>();
  for (const p of seq) p.writes!.forEach((w) => affected.add(w));
  const clkOrder = cyclic
    ? order
    : order.filter((p) => {
        if (![...p.reads!].some((r) => affected.has(r))) return false;
        p.writes!.forEach((w) => affected.add(w));
        return true;
      });
  const combClkFn = cyclic ? 'function combClk(){comb();}' : `function combClk(){let lg=0;${clkOrder.map((p) => stmtCode({ k: 'block', body: p.body }, g)).join('\n')}}`;

  g.inComb = false;
  g.inSeq = true;
  const slotIds = [...slots.keys()];
  let settleBody = '';
  const seqCode = seq.map((p) => stmtCode({ k: 'block', body: p.body }, g));
  slotIds.forEach((id, s) => {
    settleBody += `const c${s}=v[${id}];const e${s}=c${s}!==p${s};const r${s}=e${s}&&(c${s}&1)===1&&(p${s}&1)===0;const f${s}=e${s}&&(c${s}&1)===0&&(p${s}&1)===1;p${s}=c${s};`;
  });
  settleBody += 'let fired=false;';
  for (const p of seq) {
    const cond = p.triggers
      .map((t) => {
        const s = slots.get(t.id)!;
        return t.edge === 'pos' ? `r${s}` : t.edge === 'neg' ? `f${s}` : `e${s}`;
      })
      .join('||');
    settleBody += `if(${cond}){fired=true;${seqCode[seq.indexOf(p)]}}\n`;
  }
  g.inSeq = false;
  const initBody = inits.map((p) => stmtCode({ k: 'block', body: p.body }, g)).join('\n');
  g.inTb = true;
  const tbCode = design.procs
    .filter((p) => p.kind === 'tb')
    .map((p) => `function*(){let lg=0;${stmtCode({ k: 'block', body: p.body }, g)}}`)
    .join(',\n');
  g.inTb = false;
  const decl = slotIds.map((_, s) => `let p${s}=0;`).join('');
  const resetPrev = slotIds.map((id, s) => `p${s}=v[${id}];`).join('');

  const clk = opts.clock;
  const watch = opts.watch ?? [];
  const clockReadByComb = clk !== undefined && comb.some((p) => p.reads!.has(clk));
  let runFn = 'function run(N){return 0;}';
  if (clk !== undefined) {
    const check = (ids: number[], p: string, fn: string) =>
      ids.length ? `if(${ids.map((id, i) => `v[${id}]!==${p}${i}`).join('||')}){${ids.map((id, i) => `${p}${i}=v[${id}];`).join('')}${fn}(c);}` : '';
    // extra signals the logic analyzer samples; outputs already watched need no second check
    const probe = (opts.probe ?? []).filter((id) => !watch.includes(id));
    const wDecl = watch.map((id, i) => `let o${i}=v[${id}];`).join('') + probe.map((id, i) => `let q${i}=v[${id}];`).join('');
    const wCheck = check(watch, 'o', 'onOut') + check(probe, 'q', 'onProbe');
    const onlyClk = slots.size === 1 && slots.get(clk) === 0 && !clockReadByComb;
    if (slots.size === 0 && !clockReadByComb) {
      runFn = 'function run(N){return N;}';
    } else if (onlyClk) {
      // fast path: a single clock domain. No trigger detection or delta loop is needed.
      const rise = seq.filter((p) => p.triggers.some((t) => t.edge !== 'neg')).map((p) => seqCode[seq.indexOf(p)]).join('');
      const fall = seq.filter((p) => p.triggers.some((t) => t.edge !== 'pos')).map((p) => seqCode[seq.indexOf(p)]).join('');
      const fallCode = fall ? `{const e0=true,r0=false,f0=true;${fall}}if(dn||mq.length${[...staticNb].map((i) => `||n[${i}]!==v[${i}]`).join('')}){commit();combClk();}` : '';
      runFn = `function run(N){let lg=0;${wDecl}for(let c=0;c<N;c++){v[${clk}]=1;{const e0=true,r0=true,f0=false;${rise}}commit();combClk();v[${clk}]=0;${fallCode}${wCheck}}p0=v[${clk}];return N;}`;
    } else {
      runFn = `function run(N){${wDecl}for(let c=0;c<N;c++){v[${clk}]=1;settle(${clockReadByComb});v[${clk}]=0;settle(${clockReadByComb});${wCheck}}return N;}`;
    }
  }

  const source = `
const n=new Uint32Array(v.length), d=new Uint8Array(v.length), snap=new Uint32Array(v.length);
const dl=new Int32Array(v.length+1), mq=[];let dn=0;
${decl}
function par(x){x^=x>>>16;x^=x>>>8;x^=x>>>4;x^=x>>>2;x^=x>>>1;return x&1;}
${combFn}
${combClkFn}
function commit(){${[...staticNb].map((i) => `v[${i}]=n[${i}];`).join('')}for(let k=0;k<dn;k++){const i=dl[k];v[i]=n[i];d[i]=0;}dn=0;if(mq.length){for(let k=0;k<mq.length;k+=3){M[mq[k]][mq[k+1]]=mq[k+2];}mq.length=0;}}
function settle(doComb){let lg=0;if(doComb!==false)comb();for(let it=0;it<1000;it++){${settleBody}if(!fired)return;commit();combClk();}throw new Error('design does not settle (oscillation between clocked processes)');}
function reset(){for(let i=0;i<v.length;i++)v[i]=init[i];for(let m=0;m<M.length;m++)M[m].fill(minit[m]);dn=0;mq.length=0;d.fill(0);let lg=0;${initBody}
comb();n.set(v);${resetPrev}settle();}
function sync(){n.set(v);d.fill(0);dn=0;mq.length=0;${resetPrev}}
${runFn}
const threads=[${tbCode}];
return {reset, settle, run, sync, threads};`;

  const v = new Uint32Array(nSigs);
  const init = new Uint32Array(design.sigs.map((s) => s.init >>> 0));
  const mems = design.mems.map((m) => new Uint32Array(m.length));
  const minit = design.mems.map((m) => m.init >>> 0);
  let fns: { reset(): void; settle(): void; run(n: number): number; sync(): void; threads: CompiledSim['threads'] };
  try {
    fns = new Function('v', 'M', 'init', 'minit', 'onOut', 'onProbe', 'H', source)(v, mems, init, minit, opts.onOut ?? (() => {}), opts.onProbe ?? (() => {}), opts.host ?? NO_HOST);
  } catch (err) {
    throw new HdlError(`internal simulator compile error: ${(err as Error).message}`);
  }
  return { v, mems, reset: fns.reset, settle: fns.settle, run: fns.run, sync: fns.sync, threads: fns.threads, prints: g.prints, printSev: g.printSev, source };
}
