// The glossary page (/<lang>/glossary) and the term tooltips in the lessons (Phase 4.2).
import { GLOSSARY, glossaryTerm, sortedGlossary } from '../lessons/glossary';
import { homeNav } from './home';
import { logo } from './logo';
import { HOME, num, type UiLang } from './strings';
import { versionLabel } from '../version';

export const GLOSSARY_UI = {
  fa: {
    title: 'واژه‌نامه',
    lead: 'واژه‌های اصلی طراحی FPGA، هر کدام با یک تعریف کوتاه و درسی که آن را معرفی می‌کند.',
    count: (n: string) => `${n} واژه`,
    seeLesson: 'در درس:',
    back: 'بازگشت به صفحهٔ اصلی',
  },
  en: {
    title: 'Glossary',
    lead: 'The key words of FPGA design, each with a short definition and the lesson that introduces it.',
    count: (n: string) => `${n} terms`,
    seeLesson: 'Introduced in:',
    back: 'Back to the home page',
  },
} satisfies Record<UiLang, unknown>;

// first letter used for the index (Latin letters are grouped under the Latin letter, also in Persian)
const initial = (s: string) => s.replace(/^[^\p{L}\p{N}]+/u, '').charAt(0).toUpperCase();

export function renderGlossary(lang: UiLang, lessonTitle: (id: string) => string): string {
  const g = GLOSSARY_UI[lang];
  const terms = sortedGlossary(lang);
  const letters: string[] = [];
  const items = terms
    .map((t) => {
      const L = initial(t.term[lang]);
      const head = letters.includes(L) ? '' : (letters.push(L), ` data-letter="${L}"`);
      const lt = t.lesson ? lessonTitle(t.lesson) : '';
      return `<div class="gl-item" id="term-${t.id}"${head}>
  <dt><a class="gl-anchor" href="#${t.id}" aria-label="#${t.id}">#</a><span${lang === 'fa' ? '' : ' dir="ltr"'}>${t.term[lang]}</span></dt>
  <dd><p>${t.def[lang]}</p>${lt ? `<p class="gl-lesson">${g.seeLesson} <a href="#lesson/${t.lesson}" data-lesson="${t.lesson}">${lt}</a></p>` : ''}</dd>
</div>`;
    })
    .join('');
  const index = letters.map((L) => `<a href="#term-${terms.find((t) => initial(t.term[lang]) === L)!.id}">${L}</a>`).join('');
  return `
<header class="home-nav">${homeNav(lang)}</header>
<main class="home-main glossary-page">
  <article class="gl-article">
    <p class="gl-back"><button class="btn ghost small" data-act="home">${g.back}</button></p>
    <h1>${g.title}</h1>
    <p class="lead">${g.lead} <span class="dim">(${g.count(num(GLOSSARY.length, lang))})</span></p>
    <nav class="gl-index" aria-label="${g.title}">${index}</nav>
    <dl class="gl-list">${items}</dl>
  </article>
</main>
<footer class="home-foot"><span class="logo">${logo(16, true)}</span>${HOME[lang].footer} <span class="home-ver" dir="ltr">${versionLabel}</span></footer>`;
}

// ---------------------------------------------------------------- term tooltips
// <abbr class="term" data-term="id"> (from term() in helpers.ts) shows its definition on hover and keyboard focus;
// Escape hides it. One tooltip element is shared by the whole page.
export function bindTermTips(lang: () => UiLang) {
  let tip: HTMLElement | null = null;
  let owner: HTMLElement | null = null;
  const hide = () => {
    if (!tip || !owner) return;
    tip.hidden = true;
    owner.removeAttribute('aria-describedby');
    owner = null;
  };
  const show = (el: HTMLElement) => {
    const t = glossaryTerm(el.dataset.term!);
    if (!t) return;
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'term-tip';
      tip.className = 'term-tip';
      tip.setAttribute('role', 'tooltip');
      document.body.appendChild(tip);
    }
    const l = lang();
    tip.dir = l === 'fa' ? 'rtl' : 'ltr';
    tip.lang = l;
    tip.innerHTML = `<b>${t.term[l]}</b> ${t.def[l]}`;
    tip.hidden = false;
    owner = el;
    el.setAttribute('aria-describedby', 'term-tip');
    const r = el.getBoundingClientRect();
    const w = Math.min(320, window.innerWidth - 16);
    tip.style.maxWidth = `${w}px`;
    const tr = tip.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - tr.width - 8, r.left + r.width / 2 - tr.width / 2));
    const below = r.bottom + 8 + tr.height < window.innerHeight;
    tip.style.left = `${left}px`;
    tip.style.top = `${below ? r.bottom + 6 : r.top - tr.height - 6}px`;
  };
  const termOf = (e: Event) => (e.target as HTMLElement).closest?.('.term[data-term]') as HTMLElement | null;
  document.addEventListener('mouseover', (e) => {
    const el = termOf(e);
    if (el && el !== owner) show(el);
    else if (!el && owner && document.activeElement !== owner) hide();
  });
  document.addEventListener('focusin', (e) => {
    const el = termOf(e);
    if (el) show(el);
    else hide();
  });
  document.addEventListener('focusout', (e) => {
    if (termOf(e) === owner) hide();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && owner) {
      e.stopPropagation();
      hide();
    }
  }, true);
  document.addEventListener('scroll', hide, true);
}
