// Every exercise checker must accept a correct solution and reject the lesson's unchanged code.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD, type XdcGroup } from '../src/boards';
import { EXERCISES } from '../src/grade/exercises';
import { gradeExercise, type GradeResult } from '../src/grade/grade';
import { ALL_LESSONS } from '../src/lessons/course';
import type { Lesson } from '../src/lessons/lessons';

const lesson = (id: string) => ALL_LESSONS.find((l) => l.id === id)!;

// extra XDC groups a solution needs beyond the lesson's own
const EXTRA: Record<string, Partial<Record<XdcGroup, boolean>>> = {
  decoder: { seg: true },
  alu: { seg: true },
  fsm: { sw: true },
  bin2bcd: { btn: true },
  sensors: { rgb: true },
};

function grade(l: Lesson, src: string, lang: 'verilog' | 'vhdl' = 'verilog', tb?: string): GradeResult {
  return gradeExercise(
    l.id,
    { lang, src, xdc: DEFAULT_BOARD.masterXdc({ ...l.xdc, ...EXTRA[l.id] }), tb, original: lang === 'verilog' ? l.verilog : l.vhdl },
    DEFAULT_BOARD,
  );
}

const show = (r: GradeResult) => r.items.map((i) => `${i.ok ? '✓' : '✗'} ${i.en}`).join('\n');

describe('exercise checkers', () => {
  it('every lesson but the playground has an exercise', () => {
    for (const l of ALL_LESSONS) if (l.id !== 'playground') expect(EXERCISES[l.id], l.id).toBeDefined();
  });

  for (const [id, ex] of Object.entries(EXERCISES)) {
    if (ex.testbench) continue;
    for (const lang of ['verilog', 'vhdl'] as const)
      it(`${id} (${lang}): accepts the solution and rejects the lesson code`, () => {
        const l = lesson(id);
        expect(ex.solution, `${id} has a solution`).toBeDefined();
        const good = grade(l, ex.solution![lang], lang);
        expect(good.passed, show(good)).toBe(true);
        const bad = grade(l, l[lang], lang);
        expect(bad.passed, show(bad)).toBe(false);
      });
  }

  it('every exercise has exactly 2 hints in both languages', () => {
    for (const [id, ex] of Object.entries(EXERCISES)) {
      expect(ex.hints?.length, id).toBe(2);
      for (const h of ex.hints!) {
        expect(h.fa.length, id).toBeGreaterThan(10);
        expect(h.en.length, id).toBeGreaterThan(10);
      }
    }
  });

  for (const lang of ['verilog', 'vhdl'] as const)
    it(`testbench (${lang}): the solution's reset check catches the broken design`, () => {
      const l = lesson('testbench');
      const tb = l.tb![lang];
      const good = grade(l, l[lang], lang, EXERCISES.testbench.solution![lang]);
      expect(good.passed, show(good)).toBe(true);
      const bad = grade(l, l[lang], lang, tb);
      expect(bad.passed, show(bad)).toBe(false);
    });

  it('reports a design that does not synthesize', () => {
    const r = grade(lesson('intro'), 'module top(input wire [15:0] SW, output wire [15:0] LED); assign LED = ; endmodule');
    expect(r.passed).toBe(false);
    expect(r.items[0].en).toMatch(/does not synthesize/);
  });

  it('asks for a missing parameter', () => {
    const r = grade(lesson('counter'), lesson('counter').verilog);
    expect(r.items[0].en).toMatch(/parameter\/generic named DIV/);
    expect(r.items[0].ok).toBe(false);
  });
});

