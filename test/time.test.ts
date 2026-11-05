import { describe, expect, it } from 'vitest';
import { formatMinutes, lessonTime, wordCount } from '../src/lessons/time';
import { ALL_LESSONS, CHAPTERS } from '../src/lessons/course';

const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');

describe('lessonTime', () => {
  it('reads at 180 words a minute, at least two minutes', () => {
    expect(lessonTime({ body: words(900), tryIt: '' }, false, 1).read).toBe(5);
    expect(lessonTime({ body: words(10), tryIt: '' }, false, 1).read).toBe(2);
  });
  it('ignores tags and code blocks', () => {
    expect(wordCount('<p>one <b>two</b></p><pre>a b c d e</pre> three')).toBe(3);
  });
  it('adds practice for the exercise and from chapter 4 on', () => {
    const l = { body: '', tryIt: '' };
    expect(lessonTime(l, false, 1).practice).toBe(5);
    expect(lessonTime(l, true, 3).practice).toBe(15);
    expect(lessonTime(l, true, 4).practice).toBe(20);
  });
  it('uses a lesson override', () => {
    expect(lessonTime({ body: '', tryIt: '', time: { read: 8, practice: 30 } }, true, 7)).toEqual({ read: 8, practice: 30 });
    const soft = ALL_LESSONS.find((l) => l.id === 'softcore')!;
    const i2c = ALL_LESSONS.find((l) => l.id === 'i2c')!;
    expect(soft.time).toEqual({ read: 8, practice: 30 });
    expect(i2c.time).toEqual({ read: 6, practice: 25 });
  });
  it('gives every course chapter a positive total', () => {
    for (const c of CHAPTERS) for (const l of c.lessons) expect(lessonTime(l, true, 1).read).toBeGreaterThan(0);
  });
});

describe('formatMinutes', () => {
  it('formats English', () => {
    expect(formatMinutes(45, 'en')).toBe('≈ 45 min');
    expect(formatMinutes(70, 'en')).toBe('≈ 1 h 10 min');
    expect(formatMinutes(120, 'en')).toBe('≈ 2 h');
  });
  it('formats Persian with Persian digits', () => {
    expect(formatMinutes(45, 'fa')).toBe('≈ ۴۵ دقیقه');
    expect(formatMinutes(70, 'fa')).toBe('≈ ۱ ساعت و ۱۰ دقیقه');
    expect(formatMinutes(120, 'fa')).toBe('≈ ۲ ساعت');
  });
});
