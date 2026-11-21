// Chapters per board (docs/EBAZ4205-ROADMAP.md, E1.1).
import { describe, expect, it } from 'vitest';
import { ALL_LESSONS, CHAPTERS, COURSE_LESSONS, PLAYGROUND, chaptersFor, courseLessonsFor, lessonBoards, lessonOnBoard } from '../src/lessons/course';
import { applyBoardVariants, hasVariant, VARIANTS } from '../src/lessons/boards';
import { BOARDS } from '../src/boards';
import type { LessonText } from '../src/lessons/en';

describe('course per board', () => {
  it('the Nexys sees the whole course, unchanged', () => {
    expect(chaptersFor('nexys-a7-100t')).toEqual(CHAPTERS.filter((c) => !c.boards?.includes('ebaz4205')));
    expect(courseLessonsFor('nexys-a7-100t')).toEqual(COURSE_LESSONS.filter((l) => !/^[zx]-/.test(l.id)));
    expect(courseLessonsFor('nexys-a7-100t').length).toBe(32);
  });

  it('the EBAZ4205 sees its own chapters, its versions of Nexys lessons and the Lab', () => {
    const ch = chaptersFor('ebaz4205');
    expect(ch.map((c) => c.title.en)).toEqual(['Zynq and the EBAZ4205', 'Extension board: LEDs, keys, serial, buzzer and LCD', 'Core lessons on the EBAZ4205', 'HDMI', 'Lab']);
    expect(courseLessonsFor('ebaz4205').map((l) => l.id)).toEqual([
      'z-intro', 'z-blink', 'z-bootflow', 'z-ps-hello', 'z-ethernet',
      'x-leds', 'x-keys', 'x-uart', 'x-buzzer', 'x-lcd',
      'counter', 'fsm', 'debounce', 'uart', 'uart_rx', 'pwm',
      'x-hdmi-tmds', 'x-hdmi-bars',
    ]);
    expect(lessonOnBoard(PLAYGROUND, 'ebaz4205')).toBe(true);
    const gates = ALL_LESSONS.find((l) => l.id === 'gates')!;
    expect(lessonOnBoard(gates, 'ebaz4205')).toBe(false);
    expect(lessonBoards(gates)).toEqual(['nexys-a7-100t']);
    // a lesson with an EBAZ4205 version runs there, but still belongs to its Nexys chapter
    const counter = ALL_LESSONS.find((l) => l.id === 'counter')!;
    expect(lessonOnBoard(counter, 'ebaz4205')).toBe(true);
    expect(lessonBoards(counter)).toEqual(['nexys-a7-100t']);
    // the Nexys does not list the EBAZ4205's chapter of versions
    expect(chaptersFor('nexys-a7-100t').some((c) => c.variants)).toBe(false);
  });

  it('every lesson id is unique across boards', () => {
    const ids = BOARDS.flatMap((b) => chaptersFor(b.id).flatMap((c) => c.lessons.map((l) => l.id)));
    const unique = new Set(ALL_LESSONS.map((l) => l.id));
    expect(unique.size).toBe(ALL_LESSONS.length);
    for (const id of ids) expect(unique.has(id)).toBe(true);
  });

  it('variants rewrite a lesson for one board only, in both languages', () => {
    expect(hasVariant('playground', 'ebaz4205')).toBe(true);
    expect(hasVariant('playground', 'nexys-a7-100t')).toBe(false);
    const l = { ...PLAYGROUND };
    const en: Record<string, LessonText> = { playground: { title: 'Playground', summary: 's', body: 'nexys', tryIt: 't' } as LessonText };
    applyBoardVariants('ebaz4205', [l], en);
    expect(l.verilog).toContain('LED_R');
    expect(l.xdc).toEqual({ led: true });
    expect(l.body).toContain('FCLK_CLK0');
    expect(en.playground.body).toContain('FCLK_CLK0');
    expect(en.playground.title).toBe('Playground');
    expect(PLAYGROUND.verilog).toContain('CLK100MHZ');
    for (const v of Object.values(VARIANTS.playground)) expect(v.en?.body).toBeTruthy();
  });
});
