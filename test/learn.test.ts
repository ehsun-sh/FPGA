// The learning loop data: objectives, takeaways, levels, prerequisites, predict-first and the quiz.
import { describe, expect, it } from 'vitest';
import { ALL_LESSONS, PLAYGROUND } from '../src/lessons/course';
import { EN } from '../src/lessons/en';
import { EXERCISES } from '../src/grade/exercises';

const plain = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, 'x');
const course = ALL_LESSONS.filter((l) => l !== PLAYGROUND);

describe('objectives, takeaways, level and prerequisites', () => {
  it('there are 27 course lessons', () => expect(course.length).toBe(27));
  for (const l of course)
    it(`${l.id}: 3 objectives, 3–4 takeaways in both languages, a level, valid prerequisites`, () => {
      for (const t of [l, EN[l.id]]) {
        expect(t.objectives?.length, l.id).toBe(3);
        expect(t.takeaways!.length).toBeGreaterThanOrEqual(3);
        expect(t.takeaways!.length).toBeLessThanOrEqual(4);
        // length of the text a reader sees (inline <code> markup does not count)
        for (const s of [...t.objectives!, ...t.takeaways!]) expect(plain(s).length, s).toBeLessThanOrEqual(160);
      }
      expect(['intro', 'core', 'advanced']).toContain(l.level);
      const at = ALL_LESSONS.indexOf(l);
      for (const p of l.prereq ?? []) {
        const i = ALL_LESSONS.findIndex((x) => x.id === p);
        expect(i, `${l.id} needs ${p}`).toBeGreaterThanOrEqual(0);
        expect(i, `${p} comes before ${l.id}`).toBeLessThan(at);
      }
    });
});

describe('cross-references', () => {
  // a lesson number in running text; «آدرس ۷» is not one, so «درس» must start a word
  const NUM = /(?<![\u0600-\u06FF])درس\s*[۰-۹0-9]+|\blesson\s*[0-9]+/i;
  const fields = ['body', 'tryIt', 'exercise', 'objectives', 'takeaways'] as const;
  const texts = (id: string) =>
    [ALL_LESSONS.find((l) => l.id === id)!, EN[id]].filter(Boolean).flatMap((t) => fields.flatMap((f) => [t[f as keyof typeof t]].flat())).filter((s): s is string => typeof s === 'string');
  it('no lesson text hard-codes a lesson number', () => {
    const hits: string[] = [];
    for (const l of ALL_LESSONS)
      for (const s of texts(l.id)) {
        const m = NUM.exec(s);
        if (m) hits.push(`${l.id}: …${s.slice(Math.max(0, m.index - 30), m.index + 20)}…`);
      }
    for (const [id, ex] of Object.entries(EXERCISES))
      for (const s of [ex.fa, ex.en]) {
        const m = NUM.exec(s);
        if (m) hits.push(`exercise ${id}: …${s.slice(Math.max(0, m.index - 30), m.index + 20)}…`);
      }
    expect(hits).toEqual([]);
  });
  it('every data-ref points at a lesson', () => {
    const all = [...ALL_LESSONS.flatMap((l) => texts(l.id)), ...Object.values(EXERCISES).flatMap((e) => [e.fa, e.en])].join('\n');
    const ids = [...all.matchAll(/data-ref="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) expect(ALL_LESSONS.some((l) => l.id === id), id).toBe(true);
  });
});

describe('predict first', () => {
  const ids = ['intro', 'gates', 'mux', 'adder', 'seg7', 'decoder', 'shifter', 'alu', 'ff', 'counter', 'testbench', 'shiftreg', 'multiplex', 'stopwatch'];
  for (const id of ids)
    it(`${id}: 1–2 questions in both languages with matching options`, () => {
      const l = ALL_LESSONS.find((x) => x.id === id)!;
      const fa = l.predict!;
      const en = EN[id].predict!;
      expect(fa.length).toBeGreaterThanOrEqual(1);
      expect(fa.length).toBeLessThanOrEqual(2);
      expect(en.length).toBe(fa.length);
      fa.forEach((q, i) => {
        expect(en[i].options.length).toBe(q.options.length);
        expect(en[i].answer).toBe(q.answer);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
      });
    });
});

describe('quick-check quiz', () => {
  const words = (s: string) => s.replace(/<[^>]+>/g, '').trim().split(/\s+/).length;
  for (const l of course)
    it(`${l.id}: 3 questions in both languages`, () => {
      const fa = l.quiz!;
      const en = EN[l.id].quiz!;
      expect(fa.length).toBe(3);
      expect(en.length).toBe(3);
      fa.forEach((q, i) => {
        expect(q.options.length).toBeGreaterThanOrEqual(3);
        expect(q.options.length).toBeLessThanOrEqual(4);
        expect(en[i].options.length).toBe(q.options.length);
        expect(en[i].answer).toBe(q.answer);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
        for (const w of [q.why, en[i].why]) expect(words(w!), w).toBeLessThanOrEqual(25);
        for (const o of [...q.options, ...en[i].options]) expect(o).not.toMatch(/all of the above|همهٔ موارد/i);
      });
    });
  it('the right answers are spread over the options', () => {
    const at = course.flatMap((l) => l.quiz!.map((q) => q.answer));
    for (const k of [0, 1, 2]) expect(at.filter((a) => a === k).length).toBeGreaterThan(10);
  });
});
