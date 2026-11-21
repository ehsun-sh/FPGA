// Keeps the prepared EBAZ4205 lesson drafts in docs/ebaz4205/code compiling and behaving in the FPGA Lab simulator.
// The TMDS encoders are checked against a reference model of DVI 1.0 section 3.2.2.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { compileDesign, synthesize } from '../src/hdl';
const dir = new URL('../docs/ebaz4205/code/', import.meta.url);
const src = (f: string) => readFileSync(new URL(f, dir), 'utf8');
function sim(f: string, lang: 'verilog' | 'vhdl', params?: Record<string, number>) {
  const d = synthesize(src(f), lang, undefined, params);
  const port = (n: string) => d.ports.find((p) => p.name.toLowerCase() === n.toLowerCase())!;
  const s = compileDesign(d, { clock: port('clk').id });
  s.reset();
  return { d, s, port, get: (n: string) => s.v[port(n).id], set: (n: string, v: number) => { s.v[port(n).id] = v >>> 0; s.settle(); } };
}
function refTmds() {
  let cnt = 0;
  return (d: number, c: number, de: number) => {
    if (!de) { cnt = 0; return [0b1101010100, 0b0010101011, 0b0101010100, 0b1010101011][c]; }
    const bit = (v: number, i: number) => (v >> i) & 1;
    let n1d = 0; for (let i = 0; i < 8; i++) n1d += bit(d, i);
    const x = n1d > 4 || (n1d === 4 && bit(d, 0) === 0) ? 1 : 0;
    let qm = bit(d, 0);
    for (let i = 1; i < 8; i++) qm |= ((bit(qm, i - 1) ^ bit(d, i) ^ x) << i);
    const q8 = x ? 0 : 1; qm |= q8 << 8;
    let n1 = 0; for (let i = 0; i < 8; i++) n1 += bit(qm, i);
    const n0 = 8 - n1; const lo = qm & 0xff; let q;
    if (cnt === 0 || n1 === n0) {
      q = ((q8 ^ 1) << 9) | (q8 << 8) | (q8 ? lo : ~lo & 0xff);
      cnt += q8 ? n1 - n0 : n0 - n1;
    } else if ((cnt > 0 && n1 > n0) || (cnt < 0 && n0 > n1)) {
      q = (1 << 9) | (q8 << 8) | (~lo & 0xff); cnt += 2 * q8 + n0 - n1;
    } else { q = (q8 << 8) | lo; cnt += -2 * (q8 ^ 1) + n1 - n0; }
    return q;
  };
}
describe('ebaz drafts', () => {
  for (const [f, lang] of [['z_blink.v', 'verilog'], ['z_blink.vhd', 'vhdl']] as const) it('blink ' + lang, () => {
    const h = sim(f, lang, { DIV: 4 });
    const seen: number[] = [];
    for (let i = 0; i < 20; i++) { h.s.run(1); seen.push(h.get('LED_R')); expect(h.get('LED_G')).toBe(h.get('LED_R') ^ 1); }
    expect(seen.join('')).toMatch(/00001111/);
  });
  for (const [f, lang] of [['x_tone.v', 'verilog'], ['x_tone.vhd', 'vhdl']] as const) it('tone ' + lang, () => {
    const h = sim(f, lang, { CLK_HZ: 52400, NOTE_TICKS: 4000 });
    h.set('KEY0', 1);
    const halfs: number[] = []; let last = h.get('AUDIO_L'), run = 0;
    for (let i = 0; i < 4000 * 14; i++) { h.s.run(1); const b = h.get('AUDIO_L'); run++; if (b !== last) { halfs.push(run); run = 0; last = b; } }
    const freq = new Map<number, number>(); for (const x of halfs) freq.set(x, (freq.get(x) ?? 0) + 1); const uniq = [...freq].filter(([, n]) => n >= 5).map(([x]) => x).sort((a, b) => b - a);
    // C4 half period = 52400/524 = 100 cycles, C5 = 50
    expect(uniq[0]).toBe(100);
    expect(uniq).toContain(50);
    h.set('KEY0', 0); h.s.run(300); expect(h.get('AUDIO_L')).toBe(0); expect(h.get('AUDIO_R')).toBe(0);
  });
  for (const [f, lang] of [['x_tmds.v', 'verilog'], ['x_tmds.vhd', 'vhdl']] as const) it('tmds ' + lang, () => {
    const h = sim(f, lang);
    const ref = refTmds();
    let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 8;
    for (let i = 0; i < 3000; i++) {
      const de = i % 50 < 40 ? 1 : 0; const d = rnd() & 0xff; const c = rnd() & 3;
      h.set('d', d); h.set('c', c); h.set('de', de); h.s.run(1);
      expect(h.get('q'), `step ${i} d=${d} de=${de}`).toBe(ref(d, c, de));
    }
  });
});
