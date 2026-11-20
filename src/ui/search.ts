// Search over the lessons and the glossary (Phase 4.2). The index and ranking are pure functions (tested in
// test/search.test.ts); openSearch() is the Ctrl+K dialog.
export interface SearchDoc {
  kind: 'lesson' | 'term';
  id: string; // lesson id or glossary term id
  chapter: string; // shown above the title
  title: string;
  terms?: string; // glossary term text (weight 4)
  summary?: string; // summary and objectives (weight 3)
  body?: string; // body text, tags stripped (weight 1)
  lesson?: string; // a glossary term: the lesson that introduces it
}
export interface SearchHit {
  doc: SearchDoc;
  score: number;
  snippet: string; // HTML: about 90 characters around the match, the match in <mark>
}

// Persian and Arabic letter forms, ZWNJ, diacritics and digits folded so «دیباونس» matches however it was typed
export function normalize(s: string): string {
  return s
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/[‌‍‎‏]/g, '')
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export const stripTags = (html: string) =>
  html
    .replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// maps each normalised character back to its index in the original text, so a match can be cut from the original
function normMap(s: string): { norm: string; at: number[] } {
  let norm = '';
  const at: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const n = normalize(s[i]);
    for (const ch of n) {
      norm += ch;
      at.push(i);
    }
  }
  return { norm, at };
}

// a ~90-character window around the first match of `q` in `text`, with the match highlighted
export function snippet(text: string, q: string, len = 90): string {
  const { norm, at } = normMap(text);
  const nq = normalize(q.trim());
  const k = nq ? norm.indexOf(nq) : -1;
  if (k < 0) return escHtml(text.length > len ? text.slice(0, len - 1).trimEnd() + '…' : text);
  const a = at[k];
  const b = at[k + nq.length - 1] + 1;
  let from = Math.max(0, a - Math.floor((len - (b - a)) / 2));
  const to = Math.min(text.length, from + len);
  from = Math.max(0, to - len);
  return `${from > 0 ? '…' : ''}${escHtml(text.slice(from, a))}<mark>${escHtml(text.slice(a, b))}</mark>${escHtml(text.slice(b, to))}${to < text.length ? '…' : ''}`;
}

const W = { title: 5, terms: 4, summary: 3, body: 1 } as const;

// prepared index: normalised fields once, so typing stays fast
export interface SearchIndex {
  docs: SearchDoc[];
  norm: { title: string; terms: string; summary: string; body: string }[];
}
export function buildIndex(docs: SearchDoc[]): SearchIndex {
  return {
    docs,
    norm: docs.map((d) => ({
      title: normalize(d.title),
      terms: normalize(d.terms ?? ''),
      summary: normalize(d.summary ?? ''),
      body: normalize(d.body ?? ''),
    })),
  };
}

// every word of the query must appear somewhere in the document; each field that holds a word adds its weight,
// and a title that starts with the query gets a bonus
export function search(ix: SearchIndex, query: string, limit = 12): SearchHit[] {
  const q = normalize(query).trim();
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const hits: SearchHit[] = [];
  ix.docs.forEach((doc, i) => {
    const n = ix.norm[i];
    let score = 0;
    for (const w of words) {
      let s = 0;
      for (const f of ['title', 'terms', 'summary', 'body'] as const) if (n[f].includes(w)) s += W[f];
      if (!s) return;
      score += s;
    }
    if (n.title.startsWith(q)) score += 3;
    if (n.title.includes(q) || n.terms.includes(q)) score += 2;
    const field = [doc.title, doc.terms, doc.summary, doc.body].find((f) => f && normalize(f).includes(words[0])) ?? doc.summary ?? doc.body ?? '';
    hits.push({ doc, score, snippet: snippet(field, words[0]) });
  });
  hits.sort((a, b) => b.score - a.score || (a.doc.kind === 'lesson' ? -1 : 1));
  // a matching term pulls the lesson that introduces it up to just before itself: the lesson is what the
  // learner most likely wants to open, the term's definition is right under it
  for (let i = 0; i < hits.length; i++) {
    const t = hits[i].doc;
    if (t.kind !== 'term' || !t.lesson) continue;
    const j = hits.findIndex((h, k) => k > i && h.doc.kind === 'lesson' && h.doc.id === t.lesson);
    if (j > i) {
      const [l] = hits.splice(j, 1);
      hits.splice(i, 0, l);
      i++;
    }
  }
  return hits.slice(0, limit);
}

// ---------------------------------------------------------------- the dialog
export interface SearchUi {
  placeholder: string;
  empty: string;
  label: string;
  term: string; // "Glossary" label on term results
  dir: 'rtl' | 'ltr';
}

// opens the Ctrl+K dialog; `pick` gets the chosen result
export function openSearch(ix: SearchIndex, ui: SearchUi, pick: (d: SearchDoc) => void) {
  let dlg = document.getElementById('search-dlg') as HTMLDialogElement | null;
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'search-dlg';
    dlg.className = 'search-dlg';
    document.body.appendChild(dlg);
  }
  const d = dlg;
  d.dir = ui.dir;
  d.setAttribute('aria-label', ui.label);
  d.innerHTML = `<div class="search-box"><svg class="i" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
  <input type="search" id="search-q" role="combobox" aria-expanded="true" aria-controls="search-list" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="${escHtml(ui.placeholder)}" aria-label="${escHtml(ui.label)}"/><kbd>Esc</kbd></div>
  <ul id="search-list" role="listbox" aria-label="${escHtml(ui.label)}"></ul>`;
  const input = d.querySelector('input')!;
  const list = d.querySelector('ul')!;
  let hits: SearchHit[] = [];
  let cur = 0;
  const paint = () => {
    list.innerHTML = hits.length
      ? hits
          .map(
            (h, i) =>
              `<li role="option" id="sr-${i}" aria-selected="${i === cur}" data-i="${i}"><span class="sr-ch">${h.doc.kind === 'term' ? escHtml(ui.term) : escHtml(h.doc.chapter)}</span><b>${escHtml(h.doc.title)}</b><span class="sr-snip">${h.snippet}</span></li>`,
          )
          .join('')
      : input.value.trim()
        ? `<li class="sr-empty" role="presentation">${escHtml(ui.empty)}</li>`
        : '';
    if (hits.length) input.setAttribute('aria-activedescendant', `sr-${cur}`);
    else input.removeAttribute('aria-activedescendant');
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };
  const choose = (i: number) => {
    const h = hits[i];
    if (!h) return;
    d.close();
    pick(h.doc);
  };
  input.addEventListener('input', () => {
    hits = search(ix, input.value);
    cur = 0;
    paint();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!hits.length) return;
      cur = (cur + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
      paint();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(cur);
    }
  });
  list.addEventListener('click', (e) => {
    const li = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
    if (li) choose(Number(li.dataset.i));
  });
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close(); // a click on the backdrop
  });
  d.showModal();
  input.focus();
}
