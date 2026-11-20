// Search (Phase 4.2): Persian normalisation, ranking and snippets; the glossary's size and links.
import { describe, expect, it } from 'vitest';
import { buildIndex, normalize, search, snippet, stripTags, type SearchDoc } from '../src/ui/search';
import { GLOSSARY, sortedGlossary } from '../src/lessons/glossary';
import { ALL_LESSONS, CHAPTERS } from '../src/lessons/course';
import { EN } from '../src/lessons/en';

describe('normalize', () => {
  it('folds Arabic letter forms, ZWNJ, diacritics and digits', () => {
    expect(normalize('كيك')).toBe('کیک');
    expect(normalize('می‌شود')).toBe('میشود');
    expect(normalize('۱۲۳ ٤٥')).toBe('123 45');
    expect(normalize('دَرس')).toBe('درس');
    expect(normalize('Débounce')).toBe('debounce');
  });
});

// the same index the app builds: lessons with their glossary terms, plus the glossary itself
function index(lang: 'fa' | 'en') {
  const docs: SearchDoc[] = [];
  for (const c of CHAPTERS)
    for (const l of c.lessons) {
      const t = lang === 'en' && EN[l.id] ? EN[l.id] : l;
      docs.push({ kind: 'lesson', id: l.id, chapter: c.title[lang], title: t.title, terms: GLOSSARY.filter((g) => g.lesson === l.id).map((g) => g.term[lang]).join(' · '), summary: stripTags(t.summary), body: stripTags(t.body) });
    }
  for (const g of GLOSSARY) docs.push({ kind: 'term', id: g.id, chapter: '', title: g.term[lang], terms: g.term.fa + ' ' + g.term.en, summary: stripTags(g.def[lang]), lesson: g.lesson });
  return buildIndex(docs);
}

describe('search', () => {
  it('finds the debounce lesson first for «دیباونس» and "debounce"', () => {
    const fa = search(index('fa'), 'دیباونس');
    expect(fa[0].doc).toMatchObject({ kind: 'lesson', id: 'debounce' });
    const en = search(index('en'), 'debounce');
    expect(en[0].doc).toMatchObject({ kind: 'lesson', id: 'debounce' });
    // typed with an Arabic yeh and no ZWNJ it still matches
    expect(search(index('fa'), 'ديباونس')[0].doc.id).toBe('debounce');
  });
  it('ranks a title match above a body match', () => {
    const r = search(index('en'), 'block ram');
    expect(r[0].doc.id).toBe('bram');
  });
  it('needs every word of the query', () => {
    expect(search(index('en'), 'debounce zzzqqq')).toEqual([]);
  });
  it('highlights the match in a short snippet', () => {
    const s = snippet('x'.repeat(200) + ' the debounce state machine ' + 'y'.repeat(200), 'debounce');
    expect(s).toContain('<mark>debounce</mark>');
    expect(s.replace(/<[^>]+>/g, '').length).toBeLessThanOrEqual(92);
  });
});

describe('glossary', () => {
  it('has at least 45 terms with short definitions in both languages', () => {
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(45);
    const ids = GLOSSARY.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of GLOSSARY)
      for (const l of ['fa', 'en'] as const) {
        expect(g.term[l], g.id).toBeTruthy();
        expect(stripTags(g.def[l]).split(/\s+/).length, `${g.id} ${l}`).toBeLessThanOrEqual(40);
      }
  });
  it('links each term to a lesson that exists', () => {
    for (const g of GLOSSARY) if (g.lesson) expect(ALL_LESSONS.some((l) => l.id === g.lesson), g.id).toBe(true);
  });
  it('sorts alphabetically in the page language', () => {
    const en = sortedGlossary('en').map((g) => g.term.en.toLowerCase());
    expect(en).toEqual([...en].sort((a, b) => a.localeCompare(b, 'en')));
  });
  it('lessons use term() only with known ids', () => {
    const all = ALL_LESSONS.flatMap((l) => [l.body, EN[l.id]?.body ?? '']).join('\n');
    const used = [...all.matchAll(/data-term="([^"]+)"/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThanOrEqual(10);
    for (const id of used) expect(GLOSSARY.some((g) => g.id === id), id).toBe(true);
  });
});
