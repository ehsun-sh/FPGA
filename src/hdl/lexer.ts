import { HdlError, type Loc } from './ast';

export interface Tok {
  t: 'id' | 'num' | 'str' | 'op' | 'sys' | 'chr' | 'bits' | 'eof';
  v: string;
  loc: Loc;
  // original text of a VHDL string literal (the lexer also reads it as a bit string)
  raw?: string;
}

// Multi-character operators, longest first.
const VERILOG_OPS = [
  '<<<', '>>>', '===', '!==', '~^', '^~', '~&', '~|', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '**', '+:', '-:',
];
const VHDL_OPS = ['<=', '>=', '/=', ':=', '=>', '**'];

export function lex(src: string, lang: 'verilog' | 'vhdl'): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  let line = 1;
  let lineStart = 0;
  const ops = lang === 'verilog' ? VERILOG_OPS : VHDL_OPS;
  const loc = (): Loc => ({ line, col: i - lineStart + 1 });
  const n = src.length;

  while (i < n) {
    const c = src[i];
    if (c === '\n') {
      line++;
      i++;
      lineStart = i;
      continue;
    }
    if (c === ' ' || c === '\t' || c === '\r') {
      i++;
      continue;
    }
    // Comments
    if (lang === 'verilog' && c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (lang === 'verilog' && c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') {
          line++;
          lineStart = i + 1;
        }
        i++;
      }
      i += 2;
      continue;
    }
    if (lang === 'vhdl' && c === '-' && src[i + 1] === '-') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    // Verilog compiler directives (`timescale, `define ...) are ignored line-wise.
    if (lang === 'verilog' && c === '`') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    const start = loc();
    // Identifiers / keywords
    if (/[A-Za-z_]/.test(c) || (lang === 'verilog' && c === '$')) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      let word = src.slice(i, j);
      // VHDL based bit-string literal: x"FF", b"0101", o"17"
      if (lang === 'vhdl' && /^[xXbBoO]$/.test(word) && src[j] === '"') {
        let k = j + 1;
        while (k < n && src[k] !== '"') k++;
        const digits = src.slice(j + 1, k).replace(/_/g, '');
        i = k + 1;
        toks.push({ t: 'bits', v: word.toLowerCase() + ':' + digits, loc: start });
        continue;
      }
      i = j;
      if (word[0] === '$') {
        toks.push({ t: 'sys', v: word, loc: start });
      } else {
        if (lang === 'vhdl') word = word.toLowerCase();
        toks.push({ t: 'id', v: word, loc: start });
      }
      continue;
    }
    // Numbers
    if (/[0-9]/.test(c) || (lang === 'verilog' && c === "'" && /[sSbBoOdDhH]/.test(src[i + 1] ?? ''))) {
      if (lang === 'verilog') {
        // size'base digits | plain decimal | 'base digits
        let j = i;
        while (j < n && /[0-9_]/.test(src[j])) j++;
        let k = j;
        while (k < n && (src[k] === ' ' || src[k] === '\t')) k++;
        if (src[k] === "'" && /[sSbBoOdDhH]/.test(src[k + 1] ?? '')) {
          k++;
          if (/[sS]/.test(src[k])) k++;
          k++; // base char
          while (k < n && (src[k] === ' ' || src[k] === '\t')) k++;
          while (k < n && /[0-9a-fA-FxXzZ?_]/.test(src[k])) k++;
          toks.push({ t: 'num', v: src.slice(i, k).replace(/\s+/g, ''), loc: start });
          i = k;
        } else {
          // real literals are not supported; allow 1.5 to fail at parse time
          toks.push({ t: 'num', v: src.slice(i, j), loc: start });
          i = j;
        }
      } else {
        // VHDL: decimal or based 16#FF#
        let j = i;
        while (j < n && /[0-9_]/.test(src[j])) j++;
        if (src[j] === '#') {
          let k = j + 1;
          while (k < n && src[k] !== '#') k++;
          toks.push({ t: 'num', v: src.slice(i, k + 1), loc: start });
          i = k + 1;
        } else {
          if (src[j] === '.' && /[0-9]/.test(src[j + 1] ?? '')) {
            j++;
            while (j < n && /[0-9_]/.test(src[j])) j++;
          }
          toks.push({ t: 'num', v: src.slice(i, j), loc: start });
          i = j;
        }
      }
      continue;
    }
    if (lang === 'vhdl' && c === "'" && src[i + 2] === "'" && src[i + 1] !== undefined) {
      // character literal '0' '1' (an attribute tick like clk'event never has a closing tick 2 chars later)
      toks.push({ t: 'chr', v: src[i + 1], loc: start });
      i += 3;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== '"' && src[j] !== '\n') j += lang === 'verilog' && src[j] === '\\' ? 2 : 1;
      const s = src.slice(i + 1, j);
      toks.push({ t: lang === 'vhdl' ? 'bits' : 'str', v: lang === 'vhdl' ? 'b:' + s.replace(/_/g, '') : s, loc: start, raw: s });
      i = j + 1;
      continue;
    }
    let matched = false;
    for (const op of ops) {
      if (src.startsWith(op, i)) {
        toks.push({ t: 'op', v: op, loc: start });
        i += op.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if ('()[]{};:,.=+-*/%&|^~!<>?@#\''.includes(c)) {
      toks.push({ t: 'op', v: c, loc: start });
      i++;
      continue;
    }
    throw new HdlError(`unexpected character '${c}'`, start);
  }
  toks.push({ t: 'eof', v: '<EOF>', loc: loc() });
  return toks;
}

export class TokStream {
  p = 0;
  constructor(public toks: Tok[]) {}
  peek(o = 0): Tok {
    return this.toks[Math.min(this.p + o, this.toks.length - 1)];
  }
  next(): Tok {
    const t = this.toks[this.p];
    if (this.p < this.toks.length - 1) this.p++;
    return t;
  }
  is(v: string, o = 0): boolean {
    const t = this.peek(o);
    return (t.t === 'op' || t.t === 'id') && t.v === v;
  }
  accept(v: string): boolean {
    if (this.is(v)) {
      this.next();
      return true;
    }
    return false;
  }
  expect(v: string): Tok {
    const t = this.peek();
    if (!this.is(v)) throw new HdlError(`syntax error near '${t.v}': expected '${v}'`, t.loc);
    return this.next();
  }
  ident(): Tok {
    const t = this.peek();
    if (t.t !== 'id') throw new HdlError(`syntax error near '${t.v}': expected identifier`, t.loc);
    return this.next();
  }
}
