// The learning loop data: objectives, takeaways, levels, prerequisites, predict-first and the quiz.
import { describe, expect, it } from 'vitest';
import { ALL_LESSONS, PLAYGROUND } from '../src/lessons/course';
import { EN } from '../src/lessons/en';

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
