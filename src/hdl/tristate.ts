// Tri-state top-level ports. The simulator is 2-state, so an `inout` port of the top module is split into what the
// design drives (`<port>.o`) and whether it drives it (`<port>.oe`, per bit). Reading the port gives the level on the
// wire, which the board (and the modules attached to it) computes. Assigning 'z' releases the wire:
//   assign SDA = sda_low ? 1'b0 : 1'bz;        SDA <= '0' when sda_low = '1' else 'Z';
import type { Design, Expr, LVal, Sig, Stmt } from './ir';
import { mask } from './ir';

export interface TriPort {
  port: number; // the port signal: the level on the wire (written by the board)
  o: number; // value the design drives
  oe: number; // 1 = the design drives that bit
}

// a 'z' (or 'x') literal: an all-don't-care constant, possibly resized or replicated
function isZ(e: Expr): boolean {
  if (e.k === 'const') return !!e.dc && e.value === 0;
  if (e.k === 'resize' || e.k === 'cast') return isZ(e.a);
  if (e.k === 'others') return isZ(e.bit);
  if (e.k === 'concat') return e.parts.length > 0 && e.parts.every(isZ);
  return false;
}

const ones = (w: number): Expr => ({ k: 'const', value: mask(w), width: w });
const zero = (w: number): Expr => ({ k: 'const', value: 0, width: w });

export function splitTristate(d: Design): TriPort[] {
  const tri: TriPort[] = [];
  for (const p of d.ports) {
    if (p.dir !== 'inout') continue;
    const mk = (suffix: string): number => {
      const s: Sig = { ...p, id: d.sigs.length, name: `${p.name}.${suffix}`, dir: undefined, init: 0 };
      d.sigs.push(s);
      return s.id;
    };
    const t: TriPort = { port: p.id, o: mk('o'), oe: mk('oe') };
    for (const pr of d.procs) {
      if (pr.kind === 'tb') continue;
      const out = rewrite(pr.body, p, t);
      if (out) pr.body = out;
    }
    tri.push(t);
  }
  return tri;
}

// the part of the port an assignment writes: the whole port or a constant bit range
function target(l: LVal, p: Sig): { lo: Expr; width: number } | null | 'other' {
  if (l.k === 'sig') return l.id === p.id ? { lo: { k: 'const', value: 0, width: 32 }, width: p.width } : 'other';
  if (l.k === 'sel') return l.id === p.id ? { lo: l.lo, width: l.width } : 'other';
  return 'other';
}

// returns a new body when it assigns the port, otherwise null
function rewrite(body: Stmt[], p: Sig, t: TriPort): Stmt[] | null {
  let changed = false;
  const walk = (ss: Stmt[]): Stmt[] =>
    ss.map((s): Stmt => {
      switch (s.k) {
        case 'assign': {
          const tg = target(s.lhs, p);
          if (tg === 'other' || tg === null) {
            if (s.lhs.k === 'concat' && s.lhs.parts.some((x) => target(x, p) !== 'other'))
              throw new Error(`inout port '${p.name}' cannot be assigned as part of a concatenation`);
            return s;
          }
          changed = true;
          const lv = (id: number): LVal => (s.lhs.k === 'sig' ? { k: 'sig', id } : { k: 'sel', id, lo: tg.lo, width: tg.width });
          const w = tg.width;
          const set = (rhs: Expr, oe: Expr): Stmt => ({ k: 'block', body: [{ ...s, lhs: lv(t.o), rhs }, { ...s, lhs: lv(t.oe), rhs: oe }] });
          const r = s.rhs;
          if (isZ(r)) return { ...s, lhs: lv(t.oe), rhs: zero(w) };
          if (r.k === 'cond' && isZ(r.f)) return set(r.t, { k: 'cond', c: r.c, t: ones(w), f: zero(w) });
          if (r.k === 'cond' && isZ(r.t)) return set(r.f, { k: 'cond', c: r.c, t: zero(w), f: ones(w) });
          return set(r, ones(w));
        }
        case 'if':
          return { ...s, t: walk(s.t), f: walk(s.f) };
        case 'case':
          return { ...s, items: s.items.map((it) => ({ ...it, body: walk(it.body) })), def: s.def ? walk(s.def) : null };
        case 'for':
          return { ...s, body: walk(s.body) };
        case 'block':
          return { ...s, body: walk(s.body) };
        case 'loop':
          return { ...s, body: walk(s.body) };
        default:
          return s;
      }
    });
  const out = walk(body);
  return changed ? out : null;
}
