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
  | { k: 'attr'; base: AExpr; attr: string; loc: Loc };

export type AStmt =
  | { k: 'assign'; lhs: AExpr; rhs: AExpr; nb: boolean; loc: Loc }
  | { k: 'if'; cond: AExpr; then: AStmt[]; els: AStmt[]; loc: Loc }
  | { k: 'case'; sel: AExpr; items: { labels: AExpr[]; body: AStmt[] }[]; def: AStmt[] | null; wild: boolean; loc: Loc }
  | { k: 'for'; init: AStmt; cond: AExpr; step: AStmt; body: AStmt[]; loc: Loc }
  | { k: 'vfor'; v: string; from: AExpr; to: AExpr; down: boolean; body: AStmt[]; loc: Loc }
  | { k: 'block'; body: AStmt[]; loc: Loc };

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
}
