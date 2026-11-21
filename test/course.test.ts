// Chapters per board (docs/EBAZ4205-ROADMAP.md, E1.1).
import { describe, expect, it } from 'vitest';
import { ALL_LESSONS, CHAPTERS, COURSE_LESSONS, PLAYGROUND, chaptersFor, courseLessonsFor, lessonBoards, lessonOnBoard } from '../src/lessons/course';
import { applyBoardVariants, hasVariant, VARIANTS } from '../src/lessons/boards';
import { BOARDS } from '../src/boards';
import type { LessonText } from '../src/lessons/en';

describe('course per board', () => {
  it('the Nexys sees the whole course, unchanged', () => {
    expect(chaptersFor('nexys-a7-100t')).toEqual(CHAPTERS.filter((c) => !c.boards?.includes('ebaz4205')));
    expect(courseLessonsFor('nexys-a7-100t')).toEqual(COURSE_LESSONS.filter((l) => !l.id.startsWith('z-')));
    expect(courseLessonsFor('nexys-a7-100t').length).toBe(32);
  });

  it('the EBAZ4205 sees only its own chapters and the Lab', () => {
    const ch = chaptersFor('ebaz4205');
    expect(ch.map((c) => c.title.en)).toEqual(['Zynq and the EBAZ4205', 'Lab']);
    expect(courseLessonsFor('ebaz4205').map((l) => l.id)).toEqual(['z-intro', 'z-blink', 'z-bootflow', 'z-ps-hello', 'z-ethernet']);
    expect(lessonOnBoard(PLAYGROUND, 'ebaz4205')).toBe(true);
    const gates = ALL_LESSONS.find((l) => l.id === 'gates')!;
    expect(lessonOnBoard(gates, 'ebaz4205')).toBe(false);
    expect(lessonBoards(gates)).toEqual(['nexys-a7-100t']);
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
