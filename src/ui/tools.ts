// Lesson instruments as UI: small icons on a lesson in the course lists and the "tools in this lesson" box.
import { lessonTools, TOOLS, type Tool } from '../lessons/tools';
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

const SHORT: Record<Tool, Record<L, string>> = {
  la: { fa: 'لاجیک‌آنالایزر', en: 'Logic analyzer' },
  serial: { fa: 'کنسول سریال', en: 'Serial console' },
  vga: { fa: 'مانیتور VGA', en: 'VGA monitor' },
  modules: { fa: 'ماژول‌ها', en: 'Modules' },
};

// what the tool icons in the lesson lists mean: every instrument some lesson uses. `compact` is the Flow Navigator's
// version (icon and short name only).
export function toolLegend(lessons: Lesson[], lang: L, compact = false): string {
  const used = new Set(lessons.flatMap(lessonTools));
  const ts = (Object.keys(TOOLS) as Tool[]).filter((t) => used.has(t));
  if (!ts.length) return '';
  const head = lang === 'fa' ? 'ابزارهای درس:' : 'Lesson tools:';
  const item = (t: Tool) => {
    const x = TOOLS[t];
    const short = SHORT[t][lang];
    // in English the short description repeats the name, so the name alone is enough
    const label = compact
      ? `<span>${short}</span>`
      : lang === 'fa'
        ? `<b dir="ltr">${x.name}</b><span>${short}</span>`
        : `<b>${x.name}</b>`;
    return `<li>${icon(x.icon, compact ? 12 : 14)}${label}</li>`;
  };
  return `<div class="legend-wrap${compact ? ' compact' : ''}"><span class="legend-h">${head}</span><ul class="legend">${ts.map(item).join('')}</ul></div>`;
}
