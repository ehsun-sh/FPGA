// Lesson instruments as UI: small icons on a lesson in the course lists and the "tools in this lesson" box.
import { lessonTools, TOOLS } from '../lessons/tools';
import type { Lesson } from '../lessons/lessons';
import { icon } from './icons';

type L = 'fa' | 'en';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

// the icons after a lesson's title (empty when it uses none)
export function toolIcons(l: Lesson): string {
  const ts = lessonTools(l);
  if (!ts.length) return '';
  const names = ts.map((t) => TOOLS[t].name);
  return `<span class="lt-tools" title="${esc(names.join(' · '))}">${ts.map((t) => icon(TOOLS[t].icon, 12)).join('')}<span class="sr-only"> (${esc(names.join(', '))})</span></span>`;
}

// the box at the top of a lesson: each instrument, what it shows here, and a button that opens it
export function toolsBox(l: Lesson, lang: L): string {
  const ts = lessonTools(l);
  if (!ts.length) return '';
  const head = lang === 'fa' ? 'ابزارهای این درس' : 'Tools in this lesson';
  const open = lang === 'fa' ? 'باز کردن' : 'Open';
  return `<aside class="lesson-tools" aria-label="${head}"><h2>${head}</h2><ul>${ts
    .map((t) => {
      const x = TOOLS[t];
      return `<li><span class="ti">${icon(x.icon, 16)}</span><div><b dir="ltr">${x.name}</b><p>${esc(x.desc(l, lang))}</p></div><button data-act="${x.act}">${open}</button></li>`;
    })
    .join('')}</ul></aside>`;
}
