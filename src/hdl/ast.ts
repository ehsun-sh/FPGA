// Language-neutral AST produced by the Verilog and VHDL parsers.
// Names are still unresolved here; elaborate.ts turns this into a flat netlist (ir.ts).

export type Lang = 'verilog' | 'vhdl';

export interface Loc {
  line: number;
  col: number;
}

export class HdlError extends Error {
  constructor(
    message: string,
    public loc?: Loc,
    public code = 'Synth 8-2715',
    // which source file the error is in (set when several files are compiled together)
    public file?: string,
  ) {
    super(message);
  }
}

export type AExpr =
  | { k: 'num'; value: number; width: number | null; dc?: number; loc: Loc }
  | { k: 'id'; name: string; loc: Loc }
  | { k: 'index'; base: AExpr; index: AExpr; loc: Loc }
  | { k: 'slice'; base: AExpr; left: AExpr; right: AExpr; loc: Loc }
  | { k: 'pslice'; base: AExpr; start: AExpr; width: AExpr; up: boolean; loc: Loc }
  | { k: 'un'; op: string; a: AExpr; loc: Loc }
  | { k: 'bin'; op: string; a: AExpr; b: AExpr; loc: Loc }
  | { k: 'cond'; c: AExpr; t: AExpr; f: AExpr; loc: Loc }
  | { k: 'concat'; parts: AExpr[]; loc: Loc }
  | { k: 'repl'; count: AExpr; e: AExpr; loc: Loc }
  // A call is either a function / conversion or, in VHDL, an index into a signal: resolved later.
  | { k: 'call'; name: string; args: AExpr[]; loc: Loc }
  | { k: 'others'; bit: AExpr; loc: Loc }
  | { k: 'attr'; base: AExpr; attr: string; loc: Loc }
  // testbench-only expressions
  | { k: 'str'; value: string; loc: Loc }
  | { k: 'now'; loc: Loc }
  | { k: 'random'; loc: Loc };

// A piece of a $display / report message: literal text or a formatted value.
// f: d h b o c s (Verilog formats), t (time), img (VHDL 'image), w: minimum width (-1 = natural width)
export type APart = { s: string } | { e: AExpr; f: string; w: number };
export type Severity = 'note' | 'warning' | 'error' | 'failure';

export type AStmt =
  | { k: 'assign'; lhs: AExpr; rhs: AExpr; nb: boolean; loc: Loc }
  | { k: 'if'; cond: AExpr; then: AStmt[]; els: AStmt[]; loc: Loc }
  | { k: 'case'; sel: AExpr; items: { labels: AExpr[]; body: AStmt[] }[]; def: AStmt[] | null; wild: boolean; loc: Loc }
  | { k: 'for'; init: AStmt; cond: AExpr; step: AStmt; body: AStmt[]; loc: Loc }
  | { k: 'vfor'; v: string; from: AExpr; to: AExpr; down: boolean; body: AStmt[]; loc: Loc }
  | { k: 'block'; body: AStmt[]; loc: Loc }
  // ---- simulation (testbench) statements ----
  // wait for a time (in ps)
  | { k: 'delay'; t: AExpr; loc: Loc }
  // wait for an edge / change of signals and/or a condition; nothing at all = wait forever.
  // level: Verilog wait(cond) does not block when cond is already true.
  // auto: wait on every signal the preceding statements read (VHDL concurrent assignment with 'after')
  | { k: 'wait'; on: { name: string; edge: 'pos' | 'neg' | 'any'; loc: Loc }[]; until?: AExpr; level?: boolean; auto?: boolean; loc: Loc }
  | { k: 'print'; parts: APart[]; sev: Severity; monitor?: boolean; loc: Loc }
  | { k: 'finish'; loc: Loc }
  // forever (no count/cond), repeat (count) or while (cond)
  | { k: 'loop'; count?: AExpr; cond?: AExpr; body: AStmt[]; loc: Loc }
  // VHDL waveform with 'after': x <= a, b after 10 ns;
  | { k: 'sched'; lhs: AExpr; items: { rhs: AExpr; t: AExpr | null }[]; loc: Loc };

export interface AType {
  // Vector range as written: [left:right] or (left downto/to right). Absent = scalar bit.
  left?: AExpr;
  right?: AExpr;
  signed: boolean;
  // Unpacked array (memory): reg [7:0] mem [0:15];  or a VHDL array type.
  arr?: { left: AExpr; right: AExpr };
  // VHDL enumeration type name.
  enumName?: string;
  // VHDL integer range (lo to hi) or plain integer (32-bit signed).
  intRange?: { lo: AExpr; hi: AExpr } | 'integer';
}

export interface APort {
  name: string;
  dir: 'input' | 'output' | 'inout';
  type: AType;
  isReg: boolean;
  init?: AExpr;
  loc: Loc;
}

export interface ADecl {
  name: string;
  type: AType;
  init?: AExpr;
  kind: 'wire' | 'reg' | 'const';
  loc: Loc;
}

export type ASens = 'comb' | { edges: { name: string; edge: 'pos' | 'neg' | 'any'; loc: Loc }[] };

export type AItem =
  | { k: 'assign'; lhs: AExpr; rhs: AExpr; loc: Loc }
  | { k: 'always'; sens: ASens; body: AStmt[]; decls: ADecl[]; loc: Loc }
  | { k: 'initial'; body: AStmt[]; loc: Loc }
  | {
      k: 'inst';
      module: string;
      name: string;
      params: { name?: string; value: AExpr }[];
      conns: { port?: string; expr?: AExpr }[];
      loc: Loc;
    };

export interface AModule {
  name: string;
  lang: Lang;
  params: { name: string; value: AExpr; local: boolean; loc: Loc }[];
  ports: APort[];
  decls: ADecl[];
  enums: Record<string, string[]>;
  // VHDL array types: name -> element type + index range
  arrayTypes: Record<string, AType>;
  items: AItem[];
  loc: Loc;
  // Verilog `timescale unit in ps (default 1 ns)
  unitPs?: number;
  // source file, when several files are compiled together
  file?: string;
}
