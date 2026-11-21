// The EBAZ4205 versions of Nexys lessons (docs/EBAZ4205-ROADMAP.md, E3.4): every version has text in both languages,
// its checker accepts the solution and rejects the lesson's own code, and the lesson code does what the text says.
import { describe, expect, it } from 'vitest';
import { getBoard, setEbazExtension } from '../src/boards';
import { withLibrary } from '../src/boards/library';
import { BOARD_EXERCISES } from '../src/grade/variants';
import { EXERCISES, uartEcho } from '../src/grade/exercises';
import { exerciseOn, gradeExercise, type GradeResult } from '../src/grade/grade';
import { BoardHarness } from '../src/grade/harness';
import { synthesize, type Lang } from '../src/hdl';
import { EBAZ_VARIANTS } from '../src/lessons/ebaz-variants';
import { applyBoardVariants, VARIANTS } from '../src/lessons/boards';
import { partsIn } from '../src/lessons/helpers';
import { EBAZ_PARTS } from '../src/boards/ebaz4205/parts';
import { ALL_LESSONS } from '../src/lessons/course';
import { EN, type LessonText } from '../src/lessons/en';

setEbazExtension(true);
const ebaz = getBoard('ebaz4205');
const nexys = getBoard('nexys-a7-100t');
const IDS = Object.keys(EBAZ_VARIANTS);
const show = (r: GradeResult) => r.items.map((i) => `${i.ok ? '✓' : '✗'} ${i.en}`).join('\n');

function harness(id: string, lang: Lang = 'verilog', src?: string) {
  const v = EBAZ_VARIANTS[id];
  const d = synthesize(withLibrary(src ?? v[lang]!, lang), lang);
  return new BoardHarness(d, ebaz.masterXdc(v.xdc!), ebaz);
}

describe('EBAZ4205 versions of Nexys lessons', () => {
  it('cover at least six lessons, each with code, text and an exercise in both languages', () => {
    expect(IDS.length).toBeGreaterThanOrEqual(6);
    for (const id of IDS) {
      const v = EBAZ_VARIANTS[id];
      expect(ALL_LESSONS.some((l) => l.id === id), id).toBe(true);
      expect(VARIANTS[id].ebaz4205, id).toBe(v);
      for (const k of ['body', 'tryIt', 'verilog', 'vhdl', 'xdc'] as const) expect(v[k], `${id} ${k}`).toBeTruthy();
      expect(v.en?.body && v.en?.tryIt, id).toBeTruthy();
      const ex = BOARD_EXERCISES.ebaz4205[id];
      expect(ex.fa && ex.en && ex.solution && ex.hints?.length === 2, id).toBeTruthy();
      expect(exerciseOn(id, ebaz)).toBe(ex);
      expect(exerciseOn(id, nexys)).toBe(EXERCISES[id]);
      // the text names parts of this board only
      for (const html of [v.body!, v.tryIt!, v.en!.body!, v.en!.tryIt!, ex.fa, ex.en]) for (const p of partsIn(html)) expect(EBAZ_PARTS, `${id}: ${p}`).toContain(p);
      // nothing in the text speaks of the Nexys clock or its parts
      for (const html of [v.body!, v.tryIt!, v.en!.body!, v.en!.tryIt!, ex.fa, ex.en]) expect(html, id).not.toMatch(/100 ?MHz|CLK100MHZ|BTN[CUDLR]|\bLD1?\d\b|\bSW\d/);
    }
  });

  for (const id of IDS)
    for (const lang of ['verilog', 'vhdl'] as const)
      it(`${id} (${lang}): the checker accepts the solution and rejects the lesson code`, () => {
        const v = EBAZ_VARIANTS[id];
        const ex = BOARD_EXERCISES.ebaz4205[id];
        const xdc = ebaz.masterXdc(v.xdc!);
        const good = gradeExercise(id, { lang, src: ex.solution![lang], xdc }, ebaz);
        expect(good.passed, show(good)).toBe(true);
        const bad = gradeExercise(id, { lang, src: v[lang]!, xdc }, ebaz);
        expect(bad.passed, show(bad)).toBe(false);
      });

  it('applying the versions rewrites the lessons for the EBAZ4205 in both languages', () => {
    const lessons = ALL_LESSONS.filter((l) => IDS.includes(l.id)).map((l) => ({ ...l }));
    const en: Record<string, LessonText> = Object.fromEntries(IDS.map((id) => [id, { ...EN[id] }]));
    applyBoardVariants('ebaz4205', lessons, en);
    for (const l of lessons) {
      expect(l.verilog, l.id).toContain('module top');
      expect(l.verilog, l.id).not.toContain('CLK100MHZ');
      expect(l.body, l.id).toContain(EBAZ_VARIANTS[l.id].body!);
      expect(en[l.id].body, l.id).toBe(EBAZ_VARIANTS[l.id].en!.body);
      expect(en[l.id].title, l.id).toBe(EN[l.id].title);
    }
    // the Nexys lessons themselves are unchanged
    expect(ALL_LESSONS.find((l) => l.id === 'counter')!.verilog).toContain('CLK100MHZ');
  });

  for (const lang of ['verilog', 'vhdl'] as const) {
    it(`counter (${lang}): KEY1 holds the counter at zero`, () => {
      const h = harness('counter', lang);
      h.btn('KEY1', 1);
      h.run(100);
      expect(h.led() & 31).toBe(0);
      h.btn('KEY1', 0);
      h.run(100);
      expect(h.led() & 31).toBe(0);
    });

    it(`fsm (${lang}): starts at red on LED1`, () => {
      const h = harness('fsm', lang);
      h.run(10);
      expect((h.led() >> 2) & 7).toBe(1);
    });

    it(`debounce (${lang}): a bouncy press counts several times raw and once debounced`, () => {
      const h = harness('debounce', lang);
      h.run(10);
      for (let i = 0; i < 7; i++) {
        h.btn('KEY3', i % 2 === 0 ? 1 : 0);
        h.run(5_000);
      }
      h.run(1_000_000);
      expect((h.led() >> 2) & 7).toBe(1);
      expect(h.led() & 3).toBe(0); // four raw presses: 4 mod 4
      h.btn('KEY2', 1);
      h.run(10);
      expect(h.led() & 31).toBe(0);
    });

    it(`pwm (${lang}): LED1-LED3 at about 6 %, 25 % and 100 %`, () => {
      const h = harness('pwm', lang);
      const on = [0, 0, 0];
      for (let i = 0; i < 2048; i++) {
        h.run(1);
        for (let k = 0; k < 3; k++) on[k] += (h.led() >> (2 + k)) & 1;
      }
      expect(on.map((n) => Math.round((n / 2048) * 100))).toEqual([6, 25, 100]);
    });

    it(`uart (${lang}): KEY3 sends "Hello FPGA!" at 115200 baud`, () => {
      const h = harness('uart', lang);
      const r = h.uartOut('H17', 14 * 10 * 434 + 5000, 115200, () => h.btn('KEY3', 1));
      expect(r).toEqual({ text: 'Hello FPGA!\r\n', errors: 0 });
    });

    it(`uart_rx (${lang}): echoes in upper case and shows the last byte on LED1-LED3`, () => {
      const h = harness('uart_rx', lang);
      h.pin('H16', 1);
      h.run(1000);
      expect(uartEcho(h, 'ebaz!', 115200, 'H16', 'H17')).toEqual({ text: 'EBAZ!', errors: 0 });
      expect((h.led() >> 2) & 7).toBe('!'.charCodeAt(0) & 7);
    });
  }
});
