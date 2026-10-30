// The landing page: hero with the live 3D board, how a lesson works, and the course as chapter cards with progress.
import type { Chapter } from '../lessons/course';
import type { Lesson } from '../lessons/lessons';
import { icon, type IconName } from './icons';
import { HOME, num, UI, type UiLang } from './strings';
import { versionLabel } from '../version';

export interface HomeData {
  lang: UiLang;
  chapters: Chapter[];
  playground: Lesson;
  title: (l: Lesson) => string;
  summary: (l: Lesson) => string;
  done: (l: Lesson) => boolean;
  resume: Lesson | null; // the lesson to continue, or null for a first visit
  live: boolean; // a design is running on the hero board
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// the top bar, shared by the landing page and the workbench; `extra` goes before the language menu.
// Labels stay in the buttons' accessible names when phones show only the icons.
export type NavPage = 'home' | 'lab' | 'playground';
export function homeNav(lang: UiLang, extra = '', current: NavPage = 'home'): string {
  const u = UI[lang];
  const item = (act: string, ic: IconName, label: string) =>
    `<button data-act="${act}" aria-label="${label}"${act === current ? ' aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button>`;
  return `<button class="brand" data-act="home" aria-label="FPGA Lab · ${u.home}"><span class="logo"></span><b>FPGA Lab</b><span class="dim brand-sep">|</span><span class="dim">${u.tagline}</span></button>
  <nav class="nav-links" aria-label="${u.mainNav}">
    ${item('home', 'home', u.home)}
    ${item('go-lessons', 'book', u.lessons)}
    ${item('lab', 'cpu', u.lab)}
    ${item('playground', 'flask', u.playground)}
  </nav>
  <span class="grow"></span>${extra}
  ${langMenu(lang, u.language, current === 'home' ? 'home' : 'lab')}`;
}

// flags drawn inline so they look the same everywhere (Windows has no flag emoji)
const FLAG: Record<UiLang, string> = {
  en: '<svg class="flag" viewBox="0 0 60 30" aria-hidden="true"><clipPath id="fl-uk"><path d="M0 0v30h60V0z"/></clipPath><g clip-path="url(#fl-uk)"><path d="M0 0v30h60V0z" fill="#012169"/><path d="M0 0l60 30m0-30L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30m0-30L0 30" stroke="#C8102E" stroke-width="2"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6"/></g></svg>',
  fa: '<svg class="flag" viewBox="0 0 60 30" aria-hidden="true"><path d="M0 0h60v10H0z" fill="#239f40"/><path d="M0 10h60v10H0z" fill="#fff"/><path d="M0 20h60v10H0z" fill="#da0000"/><circle cx="30" cy="15" r="3.2" fill="none" stroke="#da0000" stroke-width="1.2"/></svg>',
};
const LANG_NAME: Record<UiLang, string> = { en: 'English', fa: 'فارسی' };

// language menu: a button with the current language's flag and name; picking an item (data-ui) switches the site.
// `where` keeps the ids apart, as the landing page and the workbench each have one.
function langMenu(cur: UiLang, label: string, where: string): string {
  const items = (['fa', 'en'] as UiLang[])
    .map(
      (l) =>
        `<button role="menuitemradio" aria-checked="${l === cur}" data-ui="${l}" tabindex="-1">${FLAG[l]}<span lang="${l}">${LANG_NAME[l]}</span>${icon('check', 14)}</button>`,
    )
    .join('');
  return `<div class="lang-dd">
    <button class="lang-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="lang-menu-${where}" aria-label="${label}: ${LANG_NAME[cur]}" title="${label}">${FLAG[cur]}<span class="ln" lang="${cur}">${LANG_NAME[cur]}</span>${icon('chevronDown', 14)}</button>
    <div class="lang-menu" id="lang-menu-${where}" role="menu" aria-label="${label}" hidden>${items}</div>
  </div>`;
}

// opens and closes the language menus (bound once: the menus are rebuilt with the top bar). Enter, Space or the
// arrow keys open a menu, the arrows move through it, Escape or a click elsewhere closes it.
export function bindLangMenu() {
  const close = (dd: Element, refocus = false) => {
    dd.classList.remove('open');
    dd.querySelector('.lang-menu')?.setAttribute('hidden', '');
    const b = dd.querySelector<HTMLElement>('.lang-btn');
    b?.setAttribute('aria-expanded', 'false');
    if (refocus) b?.focus();
  };
  const items = (dd: Element) => [...dd.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
  const open = (dd: Element, focus: 'checked' | 'last') => {
    dd.classList.add('open');
    dd.querySelector('.lang-menu')?.removeAttribute('hidden');
    dd.querySelector('.lang-btn')?.setAttribute('aria-expanded', 'true');
    const all = items(dd);
    (focus === 'last' ? all[all.length - 1] : (all.find((i) => i.getAttribute('aria-checked') === 'true') ?? all[0]))?.focus();
  };
  // capturing: a picked language rebuilds the page in the bubbling handler, so look at the item before that
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as HTMLElement;
      document.querySelectorAll('.lang-dd.open').forEach((dd) => !dd.contains(t) && close(dd));
      const b = t.closest('.lang-btn');
      if (b) {
        const dd = b.parentElement!;
        if (dd.classList.contains('open')) close(dd);
        else open(dd, 'checked');
        return;
      }
      // a language was picked: the top bar is rebuilt, so give the focus to the new menu button
      const pick = t.closest('.lang-dd [data-ui]');
      if (pick) {
        const where = pick.closest('#home') ? '#home' : '#titlebar';
        setTimeout(() => document.querySelector<HTMLElement>(`${where} .lang-btn`)?.focus());
      }
    },
    true,
  );
  document.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    const dd = t.closest('.lang-dd');
    if (!dd) return;
    if (t.classList.contains('lang-btn')) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        open(dd, e.key === 'ArrowUp' ? 'last' : 'checked');
      } else if (e.key === 'Escape' && dd.classList.contains('open')) {
        e.stopPropagation();
        close(dd);
      }
      return;
    }
    const all = items(dd);
    const i = all.indexOf(t);
    if (i < 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      all[(i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length].focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      all[e.key === 'Home' ? 0 : all.length - 1].focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(dd, true);
    } else if (e.key === 'Tab') close(dd);
  });
  document.addEventListener('focusout', (e) => {
    const dd = (e.target as HTMLElement).closest?.('.lang-dd.open');
    // only when the focus went somewhere else: a click outside is handled above (Safari does not focus clicked buttons)
    if (dd && e.relatedTarget && !dd.contains(e.relatedTarget as Node)) close(dd);
  });
}

export function renderHome(d: HomeData): string {
  const h = HOME[d.lang];
  const n = (x: number) => num(x, d.lang);
  const course = d.chapters.filter((c) => !c.lessons.includes(d.playground));
  const all = course.flatMap((c) => c.lessons);
  const doneAll = all.filter(d.done).length;
  let i = 0;
  const cards = course
    .map((c, ci) => {
      const done = c.lessons.filter(d.done).length;
      const pct = Math.round((100 * done) / c.lessons.length);
      const items = c.lessons
        .map((l) => {
          const k = ++i;
          const here = l === d.resume;
          const state = d.done(l) ? `<span class="sr-only"> · ${h.done}</span>` : '';
          return `<li><button data-lesson="${l.id}" class="${d.done(l) ? 'done' : ''}${here ? ' here' : ''}"><span class="n">${d.done(l) ? icon('check', 13) : n(k)}</span><span class="t">${esc(d.title(l))}${state}</span>${here ? `<span class="here-tag">${h.here}</span>` : ''}</button></li>`;
        })
        .join('');
      return `<article class="ch-card">
  <header><span class="ch-no">${h.chapter(n(ci + 1))}</span><span class="ch-count" title="${pct}%">${n(done)}/${n(c.lessons.length)}</span></header>
  <h3>${esc(c.title[d.lang])}</h3>
  <div class="bar"><i style="width:${pct}%"></i></div>
  <ol>${items}</ol>
</article>`;
    })
    .join('');
  const resume = d.resume && d.resume !== all[0];
  const cta = resume
    ? `<button class="btn primary" data-lesson="${d.resume!.id}">${icon('play', 15)}<span>${esc(h.resume(d.title(d.resume!)))}</span></button>`
    : `<button class="btn primary" data-lesson="${all[0].id}">${icon('play', 15)}<span>${h.start}</span></button>`;
  return `
<header class="home-nav">${homeNav(d.lang)}</header>
<main class="home-main">
<section class="hero">
  <div class="hero-copy">
    <span class="eyebrow" dir="ltr">${h.eyebrow}</span>
    <h1>${h.title}</h1>
    <p class="motto">${h.motto.map((m) => `<span>${m}</span>`).join('<i>·</i>')}</p>
    <p class="lead">${h.lead}</p>
    <div class="cta">${cta}<button class="btn ghost" data-act="playground">${icon('flask', 15)}<span>${h.openPlayground}</span></button></div>
    <ul class="facts">${h
      .facts(n(all.length), n(course.length))
      .map(([v, k]) => `<li><b>${v}</b><span>${k}</span></li>`)
      .join('')}</ul>
  </div>
  <div class="hero-stage">
    <div class="stage" id="hero-stage"></div>
    <div class="stage-tools" role="toolbar" aria-label="${h.viewTools}">
      <button data-act="view-reset" title="${h.view3d}">${icon('cube', 14)}<span>${h.view3d}</span></button>
      <button data-act="view-top" title="${h.viewTop}">${icon('top', 14)}<span>${h.viewTop}</span></button>
      <button data-act="view-fit" title="${h.viewFit}">${icon('fit', 14)}<span>${h.viewFit}</span></button>
    </div>
    <p class="stage-hint">${d.live ? `<span class="live-dot"></span>${h.live}` : h.idle}</p>
  </div>
</section>
<section class="how">
  <h2>${h.howTitle}</h2>
  <div class="steps">${h.steps
    .map(
      ([ic, t, p], k) =>
        `<div class="step"><span class="step-ico">${icon(ic as IconName, 20)}</span><span class="step-no">${n(k + 1)}</span><h3>${t}</h3><p>${p}</p></div>`,
    )
    .join('')}</div>
</section>
<section class="course" id="home-lessons">
  <div class="course-h"><h2>${h.lessonsTitle}</h2><span class="dim">${h.lessonsSub(n(doneAll), n(all.length))}</span></div>
  <div class="bar big"><i style="width:${Math.round((100 * doneAll) / all.length)}%"></i></div>
  <div class="ch-grid">${cards}
    <article class="ch-card lab-card">
      <header><span class="ch-no">${h.lab}</span></header>
      <h3>${esc(d.title(d.playground))}</h3>
      <p class="dim">${esc(d.summary(d.playground))}</p>
      <button class="btn primary small" data-act="playground">${h.openPlayground}</button>
      <button class="btn ghost small" data-act="lab">${h.openLab}</button>
    </article>
  </div>
</section>
</main>
<footer class="home-foot">${h.footer} <span class="home-ver" dir="ltr">${versionLabel}</span></footer>`;
}
