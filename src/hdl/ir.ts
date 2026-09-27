// Flat, elaborated netlist that the simulator compiles to JavaScript.
import type { Lang, Loc } from './ast';

export interface Sig {
  id: number;
  name: string;
  width: number;
  left: number;
  right: number;
  signed: boolean;
  init: number;
  // top-level port direction, if any
  dir?: 'input' | 'output' | 'inout';
  // value names for VHDL enumeration types (index = encoding)
  enumLits?: string[];
  loc?: Loc;
}

export interface Mem {
  id: number;
  name: string;
  width: number;
  lo: number;
  length: number;
  signed: boolean;
  init: number;
}

export type Expr =
  // width 0 = unsized literal that adapts to its context (VHDL integers)
  | { k: 'const'; value: number; width: number; signed?: boolean; dc?: number }
  | { k: 'sig'; id: number }
  // bit/part select of any expression: (a >> lo) & mask(width)
  | { k: 'sel'; a: Expr; lo: Expr; width: number }
  | { k: 'mem'; mem: number; addr: Expr }
  | { k: 'un'; op: string; a: Expr }
  | { k: 'bin'; op: string; a: Expr; b: Expr }
  | { k: 'cond'; c: Expr; t: Expr; f: Expr }
  | { k: 'concat'; parts: Expr[] }
  | { k: 'resize'; a: Expr; width: number; signed: boolean }
  | { k: 'cast'; a: Expr; signed: boolean }
  | { k: 'edge'; id: number; rising: boolean }
  | { k: 'event'; id: number }
  | { k: 'others'; bit: Expr }
  // simulation time in units of `div` ps, and $random
  | { k: 'now'; div: number }
  | { k: 'random' };

export type Part = { s: string } | { e: Expr; f: string; w: number; signed: boolean; width: number; lits?: string[] };

export type LVal =
  | { k: 'sig'; id: number }
  | { k: 'sel'; id: number; lo: Expr; width: number }
  | { k: 'mem'; mem: number; addr: Expr }
  | { k: 'concat'; parts: LVal[] };

export type Stmt =
  | { k: 'assign'; lhs: LVal; rhs: Expr; nb: boolean; loc?: Loc }
  | { k: 'if'; c: Expr; t: Stmt[]; f: Stmt[] }
  | { k: 'case'; sel: Expr; items: { labels: Expr[]; body: Stmt[] }[]; def: Stmt[] | null; wild: boolean }
  | { k: 'for'; init: Stmt; cond: Expr; step: Stmt; body: Stmt[] }
  | { k: 'block'; body: Stmt[] }
  // simulation statements (only in testbench processes, except print / finish)
  | { k: 'delay'; t: Expr }
  | { k: 'wait'; on: { id: number; edge: 'pos' | 'neg' | 'any' }[]; until?: Expr; level?: boolean }
  | { k: 'print'; parts: Part[]; sev: 0 | 1 | 2 | 3; monitor?: boolean; loc?: Loc }
  | { k: 'finish' }
  | { k: 'loop'; count?: Expr; cond?: Expr; body: Stmt[] }
  | { k: 'sched'; lhs: LVal; items: { rhs: Expr; t: Expr }[] };

export interface Proc {
  // tb: a testbench thread (initial / always / process with delays or waits), run by the event scheduler
  kind: 'comb' | 'seq' | 'init' | 'tb';
  triggers: { id: number; edge: 'pos' | 'neg' | 'any' }[];
  body: Stmt[];
  loc?: Loc;
  // signals this process reads / writes (filled by analysis)
  reads?: Set<number>;
  writes?: Set<number>;
}

export interface Design {
  top: string;
  lang: Lang;
  sigs: Sig[];
  mems: Mem[];
  procs: Proc[];
  ports: Sig[];
  modules: string[];
  warnings: { msg: string; loc?: Loc }[];
  // time unit of the top module in ps (Verilog `timescale; 1000 = 1 ns)
  unitPs?: number;
}

export function mask(w: number): number {
  return w >= 32 ? 0xffffffff : 2 ** w - 1;
}

export function bitsFor(n: number): number {
  let w = 1;
  while (w < 32 && 2 ** w <= n) w++;
  return w;
}
