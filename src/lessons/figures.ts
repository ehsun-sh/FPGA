// Lesson figures (Phase 3.3): small inline SVG diagrams, no external files. Colours come from classes styled in
// style.css (.fig …) with theme tokens, so every figure works in the light and the dark theme. Text labels are
// parameters: the English lessons use the defaults, the Persian lessons pass Persian labels.
// Each figure function returns one <svg>; figure() wraps it with a caption for the lesson body.

let uid = 0;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const r1 = (n: number) => Math.round(n * 10) / 10;

function svg(w: number, h: number, title: string, body: string, role = 'img'): string {
  const id = `fig-t${++uid}`;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="${role}" aria-labelledby="${id}" xmlns="http://www.w3.org/2000/svg" style="font-family:var(--ui)"><title id="${id}">${esc(title)}</title>${body}</svg>`;
}
// text: a = where x is (s: left edge, m: middle, e: right edge), c = extra classes. A Persian label is set
// right-to-left (so numbers and Latin words inside it read in the right order); in RTL, text-anchor "start" is the
// right edge, so the anchor flips to keep x on the same side.
const RTL = /[\u0600-\u06ff]/;
function T(x: number, y: number, s: string, c = '', a: 's' | 'm' | 'e' = 'm'): string {
  const rtl = RTL.test(s);
  const anchor = a === 'm' ? 'middle' : (a === 's') === rtl ? 'end' : 'start';
  return `<text x="${r1(x)}" y="${r1(y)}"${anchor === 'start' ? '' : ` text-anchor="${anchor}"`}${rtl ? ' direction="rtl"' : ''}${c ? ` class="${c}"` : ''}>${esc(s)}</text>`;
}
const L = (x1: number, y1: number, x2: number, y2: number, c = 'ln') =>
  `<path class="${c}" d="M${r1(x1)} ${r1(y1)}L${r1(x2)} ${r1(y2)}"/>`;
const R = (x: number, y: number, w: number, h: number, c = 'bx', rx = 4) =>
  `<rect class="${c}" x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${rx}"/>`;
// a filled arrowhead at (x, y) pointing along angle a (radians)
function head(x: number, y: number, a: number, c = 'fa', s = 7): string {
  const p = (d: number, k: number) => `${r1(x - s * Math.cos(a + d) * k)} ${r1(y - s * Math.sin(a + d) * k)}`;
  return `<path class="${c}" d="M${r1(x)} ${r1(y)}L${p(0.45, 1)}L${p(-0.45, 1)}Z"/>`;
}
const arrow = (x1: number, y1: number, x2: number, y2: number, c = 'ln', hc = 'ft') =>
  L(x1, y1, x2, y2, c) + head(x2, y2, Math.atan2(y2 - y1, x2 - x1), hc);

// a figure with its caption (in the page language); the drawing itself is always left-to-right
export const figure = (svgHtml: string, caption: string) =>
  `<figure class="fig" dir="ltr">${svgHtml}<figcaption dir="auto">${caption}</figcaption></figure>`;

// ---------------------------------------------------------------- timing diagrams
// b: a digital signal, one character per unit ('0', '1'); bus: segments of [units, label] ('' = undefined)
interface Sig {
  n: string;
  b?: string;
  bus?: [number, string][];
  c?: string; // stroke class
}
function timing(rows: Sig[], x0: number, y0: number, u: number, h = 22, gap = 16): string {
  let out = '';
  rows.forEach((s, i) => {
    const top = y0 + i * (h + gap);
    out += T(x0 - 8, top + h / 2 + 4, s.n, 'mono', 'e');
    if (s.b) {
      let d = '';
      let prev = '';
      [...s.b].forEach((ch, k) => {
        const y = ch === '1' ? top : top + h;
        const x = x0 + k * u;
        d += k === 0 ? `M${r1(x)} ${r1(y)}` : ch !== prev ? `V${r1(y)}` : '';
        d += `H${r1(x + u)}`;
        prev = ch;
      });
      out += `<path class="${s.c ?? 'la'}" d="${d}"/>`;
    }
    if (s.bus) {
      let x = x0;
      for (const [n, lab] of s.bus) {
        const xe = x + n * u;
        const k = Math.min(4, (xe - x) / 2);
        out += `<path class="${lab ? 'bus' : 'bus none'}" d="M${r1(x)} ${top + h / 2}L${r1(x + k)} ${top}H${r1(xe - k)}L${r1(xe)} ${top + h / 2}L${r1(xe - k)} ${top + h}H${r1(x + k)}Z"/>`;
        if (lab) out += T((x + xe) / 2, top + h / 2 + 4, lab, 'sm mono');
        x = xe;
      }
    }
  });
  return out;
}
// dashed vertical markers at unit positions
const marks = (xs: number[], x0: number, u: number, y1: number, y2: number, c = 'lm ld') =>
  xs.map((k) => L(x0 + k * u, y1, x0 + k * u, y2, c)).join('');

// ---------------------------------------------------------------- 1. LUT and flip-flop
export function figLut(o: { title?: string; lut?: string; ff?: string; out?: string; sel?: string } = {}): string {
  const lab = { title: 'A 4-input LUT: 16 stored bits and a 16:1 multiplexer, next to a D flip-flop', lut: '4-input LUT', ff: 'D flip-flop', out: 'out', sel: 'inputs', ...o };
  const bits = '0110100110010110'; // example: the parity of A B C D
  let b = R(24, 14, 232, 326, 'lm ld', 10) + T(32, 30, lab.lut, 'ta b', 's');
  for (let i = 0; i < 16; i++) {
    const y = 44 + i * 15;
    b += T(78, y + 4, i.toString(2).padStart(4, '0'), 'sm mono tm', 'e');
    b += R(86, y - 6, 18, 13, bits[i] === '1' ? 'bxa' : 'bx', 2) + T(95, y + 4, bits[i], 'sm mono');
    b += L(104, y, 170, y, 'lm');
  }
  b += `<path class="bx" d="M170 36L222 70V248L170 282Z"/>` + T(196, 162, '16:1', 'sm');
  ['A', 'B', 'C', 'D'].forEach((n, i) => {
    const x = 176 + i * 13;
    b += L(x, 282 - (x - 170) * (34 / 52), x, 302, 'la') + T(x, 314, n, 'sm ta');
  });
  b += T(196, 330, lab.sel, 'sm tm');
  b += arrow(222, 159, 296, 159);
  b += R(298, 120, 86, 100, 'bxb', 6) + T(341, 110, lab.ff, 'sm tb') + T(308, 163, 'D', 'sm', 's') + T(374, 163, 'Q', 'sm', 'e');
  b += `<path class="ln" d="M298 196l10 8-10 8"/>` + L(270, 204, 298, 204) + T(266, 208, 'clk', 'sm mono', 'e');
  b += arrow(384, 159, 448, 159) + T(452, 163, lab.out, 'sm', 's');
  return svg(480, 346, lab.title, b);
}

// ---------------------------------------------------------------- 2. the seven gates
const GATE: Record<string, { d: string; x: number; back?: number; bub?: boolean; one?: boolean }> = {
  AND: { d: 'M0 0H22A15 15 0 0 1 22 30H0Z', x: 37 },
  OR: { d: 'M0 0Q10 15 0 30Q26 30 40 15Q26 0 0 0Z', x: 40 },
  NOT: { d: 'M0 0L30 15L0 30Z', x: 30, bub: true, one: true },
  NAND: { d: 'M0 0H22A15 15 0 0 1 22 30H0Z', x: 37, bub: true },
  NOR: { d: 'M0 0Q10 15 0 30Q26 30 40 15Q26 0 0 0Z', x: 40, bub: true },
  XOR: { d: 'M6 0Q16 15 6 30Q32 30 46 15Q32 0 6 0Z', x: 46, back: 1 },
  XNOR: { d: 'M6 0Q16 15 6 30Q32 30 46 15Q32 0 6 0Z', x: 46, back: 1, bub: true },
};
export function figGates(o: { title?: string; a?: string; b?: string } = {}): string {
  const lab = { title: 'The seven basic gates with inputs A and B and their outputs LD0 to LD6', a: 'A', b: 'B', ...o };
  let b = '';
  Object.entries(GATE).forEach(([name, g], i) => {
    const x = (i % 4) * 150 + 10;
    const y = Math.floor(i / 4) * 100 + 6;
    const gx = x + 44;
    const gy = y + 34;
    b += T(gx + 22, y + 18, name, 'b');
    if (g.one) b += L(x + 14, gy + 15, gx + 2, gy + 15) + T(x + 8, gy + 19, lab.a, 'sm', 'e');
    else
      for (const [k, yy] of [
        [0, 8],
        [1, 22],
      ])
        b += L(x + 14, gy + yy, gx + 4, gy + yy) + T(x + 8, gy + yy + 4, k ? lab.b : lab.a, 'sm', 'e');
    b += `<g transform="translate(${gx} ${gy})"><path class="bx" d="${g.d}"/>`;
    if (g.back) b += `<path class="ln" d="M0 0Q10 15 0 30"/>`;
    if (g.bub) b += `<circle class="bx" cx="${g.x + 4}" cy="15" r="4"/>`;
    b += '</g>';
    const xo = gx + g.x + (g.bub ? 8 : 0);
    b += L(xo, gy + 15, x + 112, gy + 15) + T(x + 116, gy + 19, `LD${i}`, 'sm mono tb', 's');
  });
  return svg(600, 206, lab.title, b);
}

// ---------------------------------------------------------------- 3. multiplexers
export function figMux(o: { title?: string } = {}): string {
  const title = o.title ?? 'A 2:1 multiplexer with select SW15 and a 4:1 multiplexer with select SW5 SW4';
  let b = `<path class="bx" d="M70 40L120 62V128L70 150Z"/>`;
  b += L(28, 70, 70, 70) + T(24, 74, 'SW0', 'sm mono', 'e') + T(78, 74, '0', 'sm tm', 's');
  b += L(28, 120, 70, 120) + T(24, 124, 'SW1', 'sm mono', 'e') + T(78, 124, '1', 'sm tm', 's');
  b += L(95, 139, 95, 172, 'la') + T(95, 186, 'SW15 (sel)', 'sm mono ta');
  b += arrow(120, 95, 166, 95) + T(170, 99, 'LD0', 'sm mono tb', 's');
  b += `<path class="bx" d="M290 20L350 46V164L290 190Z"/>`;
  ['SW0', 'SW1', 'SW2', 'SW3'].forEach((n, i) => {
    const y = 46 + i * 38;
    b += L(248, y, 290, y) + T(244, y + 4, n, 'sm mono', 'e') + T(297, y + 4, i.toString(2).padStart(2, '0'), 'sm tm', 's');
  });
  b += L(308, 182, 308, 212, 'la') + T(308, 226, 'SW5', 'sm mono ta');
  b += L(332, 172, 332, 212, 'la') + T(336, 226, 'SW4', 'sm mono ta', 's');
  b += arrow(350, 105, 396, 105) + T(400, 109, 'LD1', 'sm mono tb', 's');
  return svg(440, 234, title, b);
}

// ---------------------------------------------------------------- 4. full adder and ripple-carry adder
export function figAdder(o: { title?: string; fa?: string; chain?: string } = {}): string {
  const lab = { title: 'A full adder, and four of them chained into a 4-bit ripple-carry adder', fa: 'full adder', chain: '4-bit ripple-carry adder', ...o };
  let b = R(200, 16, 90, 70, 'bxa', 6) + T(245, 56, 'FA', 'b');
  for (const [n, y] of [
    ['a', 32],
    ['b', 51],
    ['cin', 70],
  ] as const)
    b += L(150, y, 200, y) + T(146, y + 4, n, 'sm mono', 'e');
  b += arrow(290, 38, 330, 38) + T(334, 42, 's', 'sm mono', 's') + arrow(290, 66, 330, 66) + T(334, 70, 'cout', 'sm mono', 's');
  b += T(245, 104, lab.fa, 'sm tm');
  b += T(20, 126, lab.chain, 'sm tm', 's');
  for (let i = 0; i < 4; i++) {
    const x = 410 - i * 120;
    b += R(x, 170, 80, 50, 'bx', 6) + T(x + 40, 200, `FA${i}`, 'sm b');
    b += arrow(x + 22, 150, x + 22, 170) + T(x + 22, 146, `a${i}`, 'sm mono', 'm');
    b += arrow(x + 58, 150, x + 58, 170) + T(x + 58, 146, `b${i}`, 'sm mono', 'm');
    b += arrow(x + 40, 220, x + 40, 244) + T(x + 40, 258, `s${i}`, 'sm mono tb');
    const xn = x - 40; // the next stage's right edge
    if (i < 3) b += arrow(x, 195, xn, 195, 'la', 'fa') + T(x - 20, 189, `c${i + 1}`, 'sm mono ta');
  }
  b += arrow(530, 195, 490, 195, 'la', 'fa') + T(512, 189, 'c0=0', 'sm mono ta');
  b += arrow(50, 195, 14, 195, 'la', 'fa') + T(32, 216, 'cout', 'sm mono ta');
  return svg(540, 266, lab.title, b);
}

// ---------------------------------------------------------------- 5. seven-segment digit (interactive)
// segments a..g as hexagons; data-seg lets src/main.ts toggle them and update the pattern line
const HEX: Record<number, string> = {
  0: '0111111', 1: '0000110', 2: '1011011', 3: '1001111', 4: '1100110', 5: '1101101', 6: '1111101', 7: '0000111', 8: '1111111', 9: '1101111',
};
export const segPattern = (on: Record<string, boolean>) => [...'gfedcba'].map((s) => (on[s] ? '0' : '1')).join('');
export function figSeg7(value = 8, o: { title?: string; code?: string; hint?: string } = {}): string {
  const lab = { title: 'A seven-segment digit with segments a to g and dp; click a segment to switch it', code: 'gfedcba', hint: '0 = on · click a segment', ...o };
  const lit = HEX[value] ?? HEX[8]; // as gfedcba, 1 = lit
  const on: Record<string, boolean> = {};
  [...'gfedcba'].forEach((s, i) => (on[s] = lit[i] === '1'));
  const L0 = 90;
  const W = 16;
  const x0 = 60;
  const y0 = 24;
  const hz = (x: number, y: number) =>
    `M${x} ${y}l${W / 2} ${-W / 2}h${L0 - W}l${W / 2} ${W / 2}l${-W / 2} ${W / 2}h${W - L0}z`;
  const vt = (x: number, y: number) =>
    `M${x} ${y}l${W / 2} ${W / 2}v${L0 - W}l${-W / 2} ${W / 2}l${-W / 2} ${-W / 2}v${W - L0}z`;
  const segs: [string, string, number, number][] = [
    ['a', hz(x0, y0), x0 + L0 / 2, y0 - 12],
    ['b', vt(x0 + L0, y0), x0 + L0 + 18, y0 + L0 / 2],
    ['c', vt(x0 + L0, y0 + L0), x0 + L0 + 18, y0 + 1.5 * L0],
    ['d', hz(x0, y0 + 2 * L0), x0 + L0 / 2, y0 + 2 * L0 + 24],
    ['e', vt(x0, y0 + L0), x0 - 18, y0 + 1.5 * L0],
    ['f', vt(x0, y0), x0 - 18, y0 + L0 / 2],
    ['g', hz(x0, y0 + L0), x0 + L0 / 2, y0 + L0 + 26],
  ];
  let b = '';
  for (const [s, d, lx, ly] of segs)
    b += `<path class="seg${on[s] ? ' on' : ''}" data-seg="${s}" d="${d}" tabindex="0" role="button" aria-pressed="${on[s]}" aria-label="${s}"/>` + T(lx, ly + 4, s, 'sm tm');
  b += `<circle class="seg" data-seg="dp" cx="${x0 + L0 + 22}" cy="${y0 + 2 * L0 + 4}" r="7" tabindex="0" role="button" aria-pressed="false" aria-label="dp"/>`;
  b += T(x0 + L0 + 40, y0 + 2 * L0 + 8, 'dp', 'sm tm', 's');
  b += `<text x="230" y="110" class="seg-code mono" data-prefix="${esc(lab.code)} = ">${esc(lab.code)} = ${segPattern(on)}</text>`;
  b += T(230, 134, lab.hint, 'sm tm', 's');
  return svg(430, 236, lab.title, b, 'group');
}

// ---------------------------------------------------------------- 6. D flip-flop timing
export function figFlipFlop(o: { title?: string } = {}): string {
  const title = o.title ?? 'D flip-flop timing: Q takes the value of D at each rising clock edge and holds it';
  const clk = '0011'.repeat(9);
  const d = '000001111111100000000001111100011111';
  let q = '';
  let cur = '0';
  for (let k = 0; k < clk.length; k++) {
    if (k % 4 === 2) cur = d[k];
    q += cur;
  }
  const x0 = 50;
  const u = 12;
  const edges = Array.from({ length: 9 }, (_, i) => i * 4 + 2);
  let b = marks(edges, x0, u, 10, 150);
  b += timing([{ n: 'clk', b: clk, c: 'ln' }, { n: 'd', b: d }, { n: 'q', b: q, c: 'lb' }], x0, 18, u, 24, 22);
  for (const k of edges) b += head(x0 + k * u, 26, -Math.PI / 2, 'ft', 6);
  return svg(500, 160, title, b);
}

// ---------------------------------------------------------------- 7. clock divider
export function figDivider(o: { title?: string; count?: string; tick?: string; blink?: string; note?: string } = {}): string {
  const lab = { title: 'A clock divider: the counter counts to N−1, tick is high for one clock, blink toggles on each tick', count: 'count', tick: 'tick', blink: 'blink', note: 'N = 4 here; the lesson uses 50,000,000', ...o };
  const n = 4;
  const P = 14; // periods
  const x0 = 64;
  const u = 14; // half period
  const bus: [number, string][] = [];
  let tick = '';
  let blink = '';
  let bl = '0';
  for (let p = 0; p < P; p++) {
    const c = p % n;
    bus.push([2, c === n - 1 ? 'N−1' : String(c)]);
    tick += c === n - 1 ? '11' : '00';
    blink += bl + bl;
    if (c === n - 1) bl = bl === '0' ? '1' : '0';
  }
  let b = timing(
    [
      { n: 'clk', b: '01'.repeat(P), c: 'ln' },
      { n: lab.count, bus },
      { n: lab.tick, b: tick, c: 'lb' },
      { n: lab.blink, b: blink },
    ],
    x0,
    12,
    u,
    20,
    16,
  );
  b += T(x0, 164, lab.note, 'sm tm', 's');
  return svg(x0 + 2 * P * u + 10, 172, lab.title, b);
}

// ---------------------------------------------------------------- 8. display multiplexing
export function figMultiplex(o: { title?: string; seg?: string; slot?: string; digit?: string } = {}): string {
  const lab = { title: 'Display multiplexing: one AN line is low at a time while the segment bus carries that digit', seg: 'CA..CG', slot: '≈ 0.65 ms', digit: 'digit', ...o };
  const x0 = 64;
  const u = 52;
  const rows: Sig[] = [3, 2, 1, 0].map((k) => ({
    n: `AN${k}`,
    b: [...Array(8)].map((_, s) => (s % 4 === k ? '0' : '1')).join(''),
    c: 'la',
  }));
  rows.push({ n: lab.seg, bus: [...Array(8)].map((_, s) => [1, `${lab.digit} ${s % 4}`] as [number, string]) });
  let b = timing(rows, x0, 12, u, 18, 14);
  b += `<path class="lm" d="M${x0} 182v8M${x0 + u} 182v8M${x0} 186H${x0 + u}"/>` + T(x0 + u / 2, 202, lab.slot, 'sm tm');
  return svg(x0 + 8 * u + 10, 210, lab.title, b);
}

// ---------------------------------------------------------------- 9. state diagram
export interface FsmOpts {
  title?: string;
  w?: number;
  h?: number;
  r?: number; // radius of the circle the states sit on
  start?: number; // index of the reset state
  sub?: string[]; // a second line per state (e.g. the Moore output)
  angle?: number; // where the first state sits, in degrees (180 = left)
}
export function figFsm(states: string[], edges: [number, number, string][], o: FsmOpts = {}): string {
  const w = o.w ?? 460;
  const h = o.h ?? 300;
  const R0 = o.r ?? Math.min(w, h) / 2 - 64;
  const nr = 34;
  const cx = w / 2;
  const cy = h / 2;
  const a0 = ((o.angle ?? 180) * Math.PI) / 180;
  const pos = states.map((_, i) => {
    const a = a0 + (i * 2 * Math.PI) / states.length;
    return { x: cx + R0 * Math.cos(a), y: cy + R0 * Math.sin(a), a };
  });
  let b = '';
  for (const [f, t, lab] of edges) {
    const A = pos[f];
    const B = pos[t];
    if (f === t) {
      // a self-loop on the outside of the state
      const p = (d: number, k: number) => [A.x + k * Math.cos(A.a + d), A.y + k * Math.sin(A.a + d)];
      const [sx, sy] = p(-0.38, nr);
      const [ex, ey] = p(0.38, nr);
      const [c1x, c1y] = p(-0.7, nr + 44);
      const [c2x, c2y] = p(0.7, nr + 44);
      b += `<path class="ln" d="M${r1(sx)} ${r1(sy)}C${r1(c1x)} ${r1(c1y)} ${r1(c2x)} ${r1(c2y)} ${r1(ex)} ${r1(ey)}"/>`;
      b += head(ex, ey, Math.atan2(ey - c2y, ex - c2x), 'ft');
      const [lx, ly] = p(0, nr + 46);
      b += T(lx, ly + 4, lab, 'sm halo');
      continue;
    }
    // curve to the side when the reverse edge also exists, so the two arrows do not overlap
    const both = edges.some(([f2, t2]) => f2 === t && t2 === f);
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    const bend = both ? 26 : 0;
    const mx = (A.x + B.x) / 2 + nx * bend;
    const my = (A.y + B.y) / 2 + ny * bend;
    const ang = (px: number, py: number) => Math.atan2(py, px);
    const s = ang(mx - A.x, my - A.y);
    const e = ang(mx - B.x, my - B.y);
    const sx = A.x + nr * Math.cos(s);
    const sy = A.y + nr * Math.sin(s);
    const ex = B.x + nr * Math.cos(e);
    const ey = B.y + nr * Math.sin(e);
    b += `<path class="ln" d="M${r1(sx)} ${r1(sy)}Q${r1(mx)} ${r1(my)} ${r1(ex)} ${r1(ey)}"/>`;
    b += head(ex, ey, Math.atan2(ey - my, ex - mx), 'ft');
    // label beside the curve's middle, on the outer side
    const lx = (sx + 2 * mx + ex) / 4 + nx * (both ? 12 : 10);
    const ly = (sy + 2 * my + ey) / 4 + ny * (both ? 12 : 10);
    if (lab) b += T(lx, ly + 4, lab, 'sm halo');
  }
  const st = o.start ?? 0;
  pos.forEach((p, i) => {
    b += `<circle class="${i === st ? 'bxb' : 'bxa'}" cx="${r1(p.x)}" cy="${r1(p.y)}" r="${nr}"/>`;
    const sub = o.sub?.[i];
    b += T(p.x, p.y + (sub ? 0 : 4), states[i], 'sm b');
    if (sub) b += T(p.x, p.y + 14, sub, 'sm tm');
  });
  // reset marker: a dot and an arrow from outside into the start state
  const S = pos[st];
  // point the marker away from a self-loop on the start state
  const sa = S.a + (edges.some(([f, t]) => f === st && t === st) ? -1.1 : 0);
  const ox = Math.cos(sa);
  const oy = Math.sin(sa);
  b += `<circle class="ft" cx="${r1(S.x + ox * (nr + 30))}" cy="${r1(S.y + oy * (nr + 30))}" r="4"/>`;
  b += arrow(S.x + ox * (nr + 30), S.y + oy * (nr + 30), S.x + ox * nr, S.y + oy * nr);
  return svg(w, h, o.title ?? `State diagram: ${states.join(', ')}`, b);
}

// ---------------------------------------------------------------- 10. UART frame
export function figUartFrame(o: { title?: string; idle?: string; start?: string; stop?: string; bit?: string } = {}): string {
  const lab = { title: 'A UART frame (8N1): idle high, a start bit, eight data bits LSB first, a stop bit', idle: 'idle', start: 'start', stop: 'stop', bit: '1 bit = 1/115200 s ≈ 8.68 µs = 868 clocks', ...o };
  const x0 = 46;
  const u = 34;
  const data = '00010010'; // 'H' = 0x48, LSB first
  const bits = '1' + '0' + data + '1' + '1';
  const names = [lab.idle, lab.start, ...[...Array(8)].map((_, i) => `D${i}`), lab.stop, lab.idle];
  let b = marks([1, 2, 10, 11], x0, u, 22, 96);
  names.forEach((n, i) => (b += T(x0 + (i + 0.5) * u, 18, n, `sm ${i === 1 || i === 10 ? 'tb' : i > 1 && i < 10 ? 'ta' : 'tm'}`)));
  b += timing([{ n: 'TX', b: bits }], x0, 40, u, 36);
  b += `<path class="lm" d="M${x0 + 2 * u} 100v10M${x0 + 3 * u} 100v10M${x0 + 2 * u} 105H${x0 + 3 * u}"/>`;
  b += T(x0 + 3 * u + 8, 109, lab.bit, 'sm tm', 's');
  return svg(x0 + 12 * u + 10, 124, lab.title, b);
}

// ---------------------------------------------------------------- 11. SPI mode 0
export function figSpi(o: { title?: string; sample?: string } = {}): string {
  const lab = { title: 'SPI mode 0: CS low for one byte, data changes on the falling SCLK edge and is read on the rising edge, MSB first', sample: 'read on ↑', ...o };
  const x0 = 56;
  const u = 10; // a quarter of a clock period
  const cs = '1111' + '0'.repeat(32) + '1111';
  const sclk = '0000' + '0110'.repeat(8) + '0000';
  const bus = (p: string): [number, string][] => [[4, ''], ...[...Array(8)].map((_, i) => [4, `${p}${7 - i}`] as [number, string]), [4, '']];
  let b = marks(Array.from({ length: 8 }, (_, i) => 5 + i * 4), x0, u, 34, 168);
  b += timing(
    [
      { n: 'CS', b: cs, c: 'lb' },
      { n: 'SCLK', b: sclk, c: 'ln' },
      { n: 'MOSI', bus: bus('') },
      { n: 'MISO', bus: bus('') },
    ],
    x0,
    20,
    u,
    20,
    16,
  );
  b += T(x0 + 5 * u, 182, lab.sample, 'sm tm');
  return svg(x0 + 40 * u + 10, 190, lab.title, b);
}

// ---------------------------------------------------------------- 12. I2C transaction
export function figI2c(o: { title?: string; addr?: string; data?: string; note?: string; rw?: 'W' | 'R' } = {}): string {
  const lab = { title: 'An I2C write: START, 7-bit address, R/W, ACK, a data byte, ACK, STOP', addr: 'address', data: 'data', note: 'S = START: SDA falls while SCL is high · P = STOP: SDA rises while SCL is high', rw: 'W', ...o };
  const x0 = 44;
  const u = 6; // a quarter of a bit
  const names = ['S', 'A6', 'A5', 'A4', 'A3', 'A2', 'A1', 'A0', 'R/W', 'ACK', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0', 'ACK', 'P'];
  const scl = '1110' + '0110'.repeat(18) + '0111';
  const sda: [number, string][] = names.map((n) => [4, n === 'S' || n === 'P' ? '' : n.replace('R/W', lab.rw)]);
  // SDA as a level: START and STOP are drawn as real edges, the bits as a bus
  let b = `<path class="la" d="M${x0} 66H${x0 + 2 * u}V88H${x0 + 4 * u}"/><path class="la" d="M${x0 + 76 * u} 88H${x0 + 78 * u}V66H${x0 + 80 * u}"/>`;
  b += timing([{ n: 'SCL', b: scl, c: 'ln' }], x0, 24, u, 22);
  b += timing([{ n: '', bus: sda.slice(1, -1) }], x0 + 4 * u, 66, u, 22);
  b += T(x0 - 8, 81, 'SDA', 'mono', 'e');
  b += T(x0 + 2 * u, 16, 'S', 'sm tb') + T(x0 + 78 * u, 16, 'P', 'sm tb');
  for (const k of [9, 18]) b += R(x0 + k * 4 * u + 1, 64, 4 * u - 2, 26, 'hl', 3);
  b += `<path class="lm" d="M${x0 + 4 * u} 104v6H${x0 + 36 * u}v-6M${x0 + 40 * u} 104v6H${x0 + 72 * u}v-6"/>`;
  b += T(x0 + 20 * u, 124, lab.addr, 'sm tm') + T(x0 + 56 * u, 124, lab.data, 'sm tm');
  b += T(x0, 146, lab.note, 'sm tm', 's');
  return svg(x0 + 80 * u + 12, 154, lab.title, b);
}

// ---------------------------------------------------------------- 13. VGA timing
export function figVga(
  o: { title?: string; visible?: string; fp?: string; bp?: string; line?: string; frame?: string; px?: string; lines?: string; scale?: string } = {},
): string {
  const lab = {
    title: 'VGA 640×480 timing: each line and each frame has a visible part, a front porch, a sync pulse and a back porch',
    visible: 'visible 640 × 480',
    fp: 'FP',
    bp: 'BP',
    line: 'one line = 800 pixels = 32 µs',
    frame: 'one frame = 525 lines ≈ 16.8 ms (60 Hz)',
    px: 'px',
    lines: 'lines',
    scale: 'not to scale',
    ...o,
  };
  const x0 = 24;
  const y0 = 46;
  const vw = 270;
  const vh = 176;
  const cols: [number, string, string, string][] = [
    [40, lab.fp, '16', 'bx'],
    [64, 'HSYNC', '96', 'bxb'],
    [46, lab.bp, '48', 'bx'],
  ];
  const rows: [number, string, string, string][] = [
    [20, lab.fp, '10', 'bx'],
    [16, 'VSYNC', '2', 'bxb'],
    [26, lab.bp, '33', 'bx'],
  ];
  let b = R(x0, y0, vw, vh, 'bxa', 0) + T(x0 + vw / 2, y0 + vh / 2 + 4, lab.visible, 'b ta');
  let x = x0 + vw;
  for (const [wd, n, v, c] of cols) {
    b += R(x, y0, wd, vh, c, 0) + T(x + wd / 2, y0 - 18, n, 'sm b') + T(x + wd / 2, y0 - 6, `${v} ${lab.px}`, 'sm tm');
    x += wd;
  }
  const xe = x;
  let y = y0 + vh;
  for (const [ht, n, v, c] of rows) {
    b += R(x0, y, xe - x0, ht, c, 0) + T(xe + 6, y + ht / 2 + 4, `${n} ${v} ${lab.lines}`, 'sm', 's');
    y += ht;
  }
  b += T(x0, y0 - 30, lab.line, 'sm tm', 's');
  // the HSYNC wave under the columns (active-low)
  const wy = y + 24;
  const sx = x0 + vw + cols[0][0];
  b += `<path class="lb" d="M${x0} ${wy}H${sx}V${wy + 14}H${sx + cols[1][0]}V${wy}H${xe}"/>` + T(xe + 6, wy + 10, 'HSYNC', 'sm mono', 's');
  b += T(x0, wy + 36, `${lab.frame} · ${lab.scale}`, 'sm tm', 's');
  return svg(560, wy + 46, lab.title, b);
}

// ---------------------------------------------------------------- 14. Tiny8 block diagram
export function figTiny8(
  o: { title?: string; rom?: string; ram?: string; ctl?: string; acc?: string; inp?: string; out?: string } = {},
): string {
  const lab = {
    title: 'Tiny8 block diagram: PC addresses the program ROM, the instruction register feeds the control, the accumulator A works with the ALU, RAM and I/O',
    rom: 'program ROM 64×12',
    ram: 'RAM 16×8',
    ctl: 'control (fetch/execute)',
    acc: 'A (Z, C)',
    inp: 'IN: switches',
    out: 'OUT: LEDs, display',
    ...o,
  };
  const box = (x: number, y: number, w: number, t: string, c = 'bx', h = 40) => R(x, y, w, h, c, 6) + T(x + w / 2, y + h / 2 + 4, t, 'sm b');
  let b = box(16, 24, 60, 'PC', 'bxa') + box(110, 24, 130, lab.rom) + box(274, 24, 60, 'IR', 'bxa') + box(368, 24, 170, lab.ctl, 'bxb');
  b += arrow(76, 44, 110, 44) + arrow(240, 44, 274, 44) + arrow(334, 44, 368, 44);
  // control lines (dashed) down to the datapath and back to the PC
  b += `<path class="lb ld" d="M453 64V102H46V64M200 102V150M342 102V150M446 102V150"/>`;
  b += box(16, 150, 100, lab.inp) + box(150, 150, 100, lab.acc, 'bxa');
  b += `<path class="bx" d="M290 150H370L360 190H300Z"/>` + T(330, 175, 'ALU', 'sm b');
  b += box(404, 150, 84, lab.ram);
  b += arrow(116, 170, 150, 170); // IN -> A
  b += arrow(250, 162, 292, 162); // A -> ALU
  b += `<path class="ln" d="M330 190V214H220V190"/>` + head(220, 190, -Math.PI / 2, 'ft'); // ALU -> A
  b += arrow(404, 164, 368, 164); // RAM -> ALU
  b += `<path class="ln" d="M180 190V236H446V190"/>` + head(446, 190, -Math.PI / 2, 'ft'); // A -> RAM
  b += `<path class="ln" d="M180 236V270H404"/>` + head(404, 270, 0, 'ft') + box(404, 250, 134, lab.out); // A -> OUT
  // the instruction's 8-bit operand k goes straight to the ALU
  b += `<path class="la" d="M304 64V88H318V150"/>` + head(318, 150, Math.PI / 2, 'fa') + T(322, 84, 'k', 'sm mono ta', 's');
  return svg(550, 300, lab.title, b);
}

// ---------------------------------------------------------------- 15. LFSR
export function figShiftReg(o: { title?: string; fb?: string } = {}): string {
  const lab = { title: 'An 8-bit shift register as an LFSR: the bits move one place each clock and Q7 ⊕ Q5 ⊕ Q4 ⊕ Q3 feeds Q0', fb: 'feedback', ...o };
  const x0 = 44;
  const sp = 60;
  const taps = [7, 5, 4, 3];
  let b = '';
  for (let i = 0; i < 8; i++) {
    const x = x0 + i * sp;
    b += R(x, 30, 40, 40, taps.includes(i) ? 'bxb' : 'bx', 4) + T(x + 20, 55, `Q${i}`, 'sm b');
    b += `<path class="lm" d="M${x} 58l6 5-6 5"/>`;
    if (i < 7) b += arrow(x + 40, 50, x + sp, 50);
  }
  const xr = x0 + 7 * sp + 40;
  // each tap drops to its own level and runs into the back of a 4-input XOR (drawn pointing left);
  // the leftmost tap takes the highest level, so no two wires cross
  const back = x0 + 2.5 * sp + 46;
  [3, 4, 5, 7].forEach((t, k) => {
    const x = t === 7 ? xr + 12 : x0 + t * sp + 50;
    const y = 116 + k * 8;
    b += `<path class="lb" d="M${t === 7 ? xr : x} 50H${x}V${y}H${back + 4}"/><circle class="fb" cx="${x}" cy="50" r="2.5"/>`;
  });
  b += `<g transform="translate(${back} 108) scale(-1 1.333)"><path class="bxb" d="${GATE.XOR.d}"/><path class="lb" d="M0 0Q10 15 0 30"/></g>`;
  b += T(back - 22, 132, '⊕', 'tb');
  b += `<path class="la" d="M${back - 46} 128H${x0 - 24}V50H${x0 - 6}"/>` + head(x0, 50, 0, 'fa');
  b += T(x0 + 40, 146, lab.fb, 'sm ta');
  return svg(xr + 30, 160, lab.title, b);
}
