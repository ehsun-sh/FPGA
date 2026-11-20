// Real URLs (Phase 4.1): parse and urlFor round-trip, the old hash links, and the base path.
import { describe, expect, it } from 'vitest';
import { legacyHash, normBase, parse, urlFor, withLang, type Route } from '../src/ui/router';
import { ALL_LESSONS } from '../src/lessons/course';

const routes: Route[] = [
  { page: 'home' },
  ...(['fa', 'en'] as const).flatMap((lang): Route[] => [
    { page: 'home', lang },
    { page: 'lab', lang },
    { page: 'playground', lang },
    { page: 'glossary', lang },
    ...ALL_LESSONS.map((l): Route => ({ page: 'lesson', lang, id: l.id })),
  ]),
];

describe('router', () => {
  for (const base of ['/', '/fpga/'])
    it(`round-trips every route under ${base}`, () => {
      for (const r of routes) expect(parse(urlFor(r, base), base), urlFor(r, base)).toEqual(r);
    });
  it('builds the URLs the roadmap names', () => {
    expect(urlFor({ page: 'lesson', lang: 'fa', id: 'counter' }, '/fpga/')).toBe('/fpga/fa/lesson/counter');
    expect(urlFor({ page: 'home', lang: 'en' }, '/fpga/')).toBe('/fpga/en/');
    expect(urlFor({ page: 'glossary', lang: 'en' }, '/')).toBe('/en/glossary');
  });
  it('accepts a trailing slash, index.html and the bare base', () => {
    expect(parse('/fpga/fa/lesson/counter/', '/fpga/')).toEqual({ page: 'lesson', lang: 'fa', id: 'counter' });
    expect(parse('/fpga/en/lesson/counter/index.html', '/fpga/')).toEqual({ page: 'lesson', lang: 'en', id: 'counter' });
    expect(parse('/fpga', '/fpga/')).toEqual({ page: 'home' });
    expect(parse('/fpga/index.html', '/fpga/')).toEqual({ page: 'home' });
  });
  it('rejects paths outside the base and unknown pages', () => {
    expect(parse('/other/fa/lab', '/fpga/')).toBeNull();
    expect(parse('/de/lab', '/')).toBeNull();
    expect(parse('/fa/lesson', '/')).toBeNull();
    expect(parse('/fa/lesson/<x>', '/')).toBeNull();
    expect(parse('/fa/settings', '/')).toBeNull();
  });
  it('maps the old hash links', () => {
    expect(legacyHash('#lesson/counter', 'fa')).toEqual({ page: 'lesson', lang: 'fa', id: 'counter' });
    expect(legacyHash('#lab', 'en')).toEqual({ page: 'lab', lang: 'en' });
    expect(legacyHash('#term-fsm', 'en')).toBeNull();
    expect(legacyHash('', 'en')).toBeNull();
  });
  it('switches language by rewriting the language segment', () => {
    const r = withLang({ page: 'lesson', lang: 'fa', id: 'uart_rx' }, 'en');
    expect(urlFor(r, '/fpga/')).toBe('/fpga/en/lesson/uart_rx');
  });
  it('normalises the base', () => {
    expect(normBase(undefined)).toBe('/');
    expect(normBase('./')).toBe('/');
    expect(normBase('/fpga')).toBe('/fpga/');
    expect(normBase('fpga/')).toBe('/fpga/');
  });
});
