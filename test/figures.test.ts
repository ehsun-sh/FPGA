// Lesson figures: well-formed, small, self-contained inline SVG.
import { describe, expect, it } from 'vitest';
import * as F from '../src/lessons/figures';

const all: [string, string][] = [
  ['figLut', F.figLut()],
  ['figGates', F.figGates()],
  ['figMux', F.figMux()],
  ['figAdder', F.figAdder()],
  ['figSeg7', F.figSeg7()],
  ['figFlipFlop', F.figFlipFlop()],
  ['figDivider', F.figDivider()],
  ['figMultiplex', F.figMultiplex()],
  ['figFsm', F.figFsm(['A', 'B', 'C'], [[0, 1, 'x'], [1, 0, 'y'], [1, 2, ''], [2, 2, 'loop']])],
  ['figUartFrame', F.figUartFrame()],
  ['figSpi', F.figSpi()],
  ['figI2c', F.figI2c()],
  ['figVga', F.figVga()],
  ['figTiny8', F.figTiny8()],
  ['figShiftReg', F.figShiftReg()],
  // Persian labels go through the same code
  ['figUartFrame fa', F.figUartFrame({ idle: 'بیکار', start: 'شروع', stop: 'پایان' })],
];
const count = (s: string, re: RegExp) => s.match(re)?.length ?? 0;

describe('figures', () => {
  it('covers every exported figure function', () => {
    const fns = Object.keys(F).filter((k) => /^fig[A-Z]/.test(k));
    expect(fns.sort()).toEqual([...new Set(all.map(([n]) => n.split(' ')[0]))].sort());
  });
  for (const [name, svg] of all)
    it(`${name} is a small, well-formed, accessible SVG`, () => {
      expect(svg.startsWith('<svg')).toBe(true);
      expect(count(svg, /<title[ >]/g)).toBe(1);
      expect(svg).toMatch(/aria-labelledby="([^"]+)"[^>]*>\s*<title id="\1"/);
      expect(count(svg, /<svg[ >]/g)).toBe(count(svg, /<\/svg>/g));
      expect(count(svg, /<g[ >]/g)).toBe(count(svg, /<\/g>/g));
      expect(svg).not.toMatch(/undefined|NaN/);
      expect(new TextEncoder().encode(svg).length).toBeLessThanOrEqual(8192);
      expect(svg).toMatch(/viewBox="0 0 \d+(\.\d+)? \d+(\.\d+)?"/);
      // no external files
      expect(svg).not.toMatch(/href=|src=|url\(/);
    });
  it('gives every figure a unique title id', () => {
    const ids = all.map(([, s]) => s.match(/aria-labelledby="([^"]+)"/)![1]);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('seven-segment pattern is gfedcba, active-low', () => {
    const on = Object.fromEntries([...'abcdef'].map((s) => [s, true]));
    expect(F.segPattern(on)).toBe('1000000'); // the digit 0
    expect(F.segPattern({ b: true, c: true })).toBe('1111001'); // the digit 1
    expect(F.figSeg7(0)).toContain('= 1000000');
  });
});
