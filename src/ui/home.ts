// The landing page: hero with the live 3D board, how a lesson works, and the course as chapter cards with progress.
import type { Chapter } from '../lessons/course';
import type { Lesson } from '../lessons/lessons';
import { icon, type IconName } from './icons';
import { HOME, num, UI, type UiLang } from './strings';

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

// the top bar, shared by the landing page and the workbench; `extra` goes before the language switch
export function homeNav(lang: UiLang, extra = ''): string {
  const u = UI[lang];
  return `<button class="brand" data-act="home" title="${u.home}"><span class="logo"></span><b>FPGA Lab</b><span class="dim brand-sep">|</span><span class="dim">${u.tagline}</span></button>
  <nav class="nav-links">
    <button data-act="home">${icon('home')}<span>${u.home}</span></button>
    <button data-act="go-lessons">${icon('book')}<span>${u.lessons}</span></button>
    <button data-act="playground">${icon('flask')}<span>${u.playground}</span></button>
    <button data-act="lab">${icon('cpu')}<span>${u.lab}</span></button>
  </nav>
  <span class="grow"></span>${extra}
  <div class="seg-ctl lang-ctl" role="group" aria-label="Site language">${langBtn('en', lang)}${langBtn('fa', lang)}</div>`;
}

// flags drawn inline so they look the same everywhere (Windows has no flag emoji)
const FLAG: Record<UiLang, string> = {
  en: '<svg class="flag" viewBox="0 0 60 30" aria-hidden="true"><clipPath id="fl-uk"><path d="M0 0v30h60V0z"/></clipPath><g clip-path="url(#fl-uk)"><path d="M0 0v30h60V0z" fill="#012169"/><path d="M0 0l60 30m0-30L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30m0-30L0 30" stroke="#C8102E" stroke-width="2"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6"/></g></svg>',
  fa: '<svg class="flag" viewBox="0 0 60 30" aria-hidden="true"><path d="M0 0h60v10H0z" fill="#239f40"/><path d="M0 10h60v10H0z" fill="#fff"/><path d="M0 20h60v10H0z" fill="#da0000"/><circle cx="30" cy="15" r="3.2" fill="none" stroke="#da0000" stroke-width="1.2"/></svg>',
};
const LANG_NAME: Record<UiLang, string> = { en: 'English', fa: 'فارسی' };

function langBtn(l: UiLang, cur: UiLang): string {
  return `<button data-ui="${l}" class="${l === cur ? 'active' : ''}" title="${LANG_NAME[l]}" lang="${l}">${FLAG[l]}<span>${l === 'en' ? 'EN' : 'فا'}</span></button>`;
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
          return `<li><button data-lesson="${l.id}" class="${d.done(l) ? 'done' : ''}"><span class="n">${d.done(l) ? icon('check', 13) : n(k)}</span><span class="t">${esc(d.title(l))}</span></button></li>`;
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
<footer class="home-foot">${h.footer}</footer>`;
}
