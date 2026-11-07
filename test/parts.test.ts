import { describe, expect, it } from 'vitest';
import { expandParts } from '../src/boards/parts';
import { ALL_LESSONS } from '../src/lessons/course';
import { EN } from '../src/lessons/en';
import { part, partsIn } from '../src/lessons/helpers';
import { EXERCISES } from '../src/grade/exercises';

// Phase 3.4: board parts named in the lesson text are chips that light the part on the 3D board
describe('board part chips', () => {
  it('part() makes a focusable chip with the name, and an optional label', () => {
    expect(part('SW0')).toBe('<b class="pin" data-part="SW0" tabindex="0">SW0</b>');
    expect(part('SW0..SW3', 'SW0 to SW3')).toContain('data-part="SW0..SW3"');
    expect(part('SW0..SW3', 'SW0 to SW3')).toContain('>SW0 to SW3</b>');
    expect(partsIn(`${part('SW1')} and ${part('LD2')} and ${part('SW1')}`)).toEqual(['SW1', 'LD2']);
  });

  it('expandParts expands ranges in either direction and the reset spellings', () => {
    expect(expandParts(['SW3..SW0'])).toEqual(['SW3', 'SW2', 'SW1', 'SW0']);
    expect(expandParts(['LD0..LD2', 'LD1'])).toEqual(['LD0', 'LD1', 'LD2']);
    expect(expandParts(['AN7..AN4'])).toEqual(['AN7', 'AN6', 'AN5', 'AN4']);
    expect(expandParts(['CPU RESET', 'CPU_RESET', 'cpu_resetn'])).toEqual(['CPU_RESETN']);
    expect(expandParts(['BTNC', 'LD17'])).toEqual(['BTNC', 'LD17']);
    expect(expandParts(['SW16', 'AN8', 'LD18', 'JA1', 'SW1..LD2', ''])).toEqual([]);
  });

  // the prose of every "Try it" and every exercise names parts only through chips (code is left alone)
  const BARE = /(?<![A-Za-z0-9_])(?:SW\d{1,2}|LD\d{1,2}|AN[0-7]|BTN[CULRD]|CPU[ _]RESET)(?![A-Za-z0-9_])/;
  const prose = (html: string) =>
    html
      .replace(/<pre[^>]*>[\s\S]*?<\/pre>|<code>[\s\S]*?<\/code>/g, '')
      .replace(/<b class="pin"[^>]*>[^<]*<\/b>/g, '')
      .replace(/<[^>]+>/g, ' ');
  const texts: [string, string][] = [];
  for (const l of ALL_LESSONS) {
    texts.push([`${l.id} fa tryIt`, l.tryIt], [`${l.id} en tryIt`, EN[l.id]?.tryIt ?? '']);
    if (l.exercise) texts.push([`${l.id} fa exercise`, l.exercise]);
    if (EN[l.id]?.exercise) texts.push([`${l.id} en exercise`, EN[l.id].exercise!]);
  }
  for (const [id, ex] of Object.entries(EXERCISES)) texts.push([`${id} fa task`, ex.fa], [`${id} en task`, ex.en]);
  const intro = ALL_LESSONS.find((l) => l.id === 'intro')!;
  for (const [k, body, h] of [
    ['fa', intro.body, '<h3>آشنایی با برد</h3>'],
    ['en', EN.intro.body, '<h3>A tour of the board</h3>'],
  ]) {
    const at = body.indexOf(h);
    const tour = body.slice(at, body.indexOf('</ul>', at));
    expect(at, k).toBeGreaterThan(0);
    texts.push([`intro ${k} board tour`, tour]);
  }

  it('try-it texts, exercises and the board tour use chips for board parts', () => {
    for (const [id, html] of texts) expect(prose(html), id).not.toMatch(BARE);
  });

  it('every chip names a real part, and the intro tour has chips in both languages', () => {
    for (const [id, html] of texts) for (const p of partsIn(html)) expect(expandParts([p]).length, `${id}: ${p}`).toBeGreaterThan(0);
    for (const body of [intro.body, EN.intro.body]) {
      expect(body).toContain('data-part="SW0..SW15"');
      expect(body).toContain('data-part="CPU RESET"');
      expect(body).toContain('data-part="AN0..AN7"');
    }
  });
});
