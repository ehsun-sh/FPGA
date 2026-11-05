// The learning loop on a lesson page: objectives with level and prerequisites, key takeaways, predict-first,
// the quick-check quiz, staged hints with a solution, and the checker's expected-vs-yours table.
// Template strings only; main.ts wires the events.
import type { Lesson } from '../lessons/lessons';
import { icon } from './icons';

type L = 'fa' | 'en';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export const LEARN_UI = {
  fa: {
    objectives: 'در پایان این درس می‌توانید',
    takeaways: 'نکات کلیدی',
    before: 'پیش‌نیاز:',
    level: { intro: 'مقدماتی', core: 'اصلی', advanced: 'پیشرفته' },
    levelTitle: 'سطح درس',
    goalsToc: 'هدف‌ها',
    xref: (n: string, title: string) => `درس ${n}: ${title}`,
  },
  en: {
    objectives: 'By the end of this lesson you can',
    takeaways: 'Key takeaways',
    before: 'Before this:',
    level: { intro: 'Intro', core: 'Core', advanced: 'Advanced' },
    levelTitle: 'Lesson level',
    goalsToc: 'Goals',
    xref: (n: string, title: string) => `lesson ${n}: ${title}`,
  },
};

export interface LoopText {
  objectives?: string[];
  takeaways?: string[];
}

// the tiny coloured dot for the course lists
export function levelDot(l: Lesson, lang: L): string {
  if (!l.level) return '';
  const name = LEARN_UI[lang].level[l.level];
  return `<span class="lvl-dot ${l.level}" title="${LEARN_UI[lang].levelTitle}: ${name}"><span class="sr-only"> (${name})</span></span>`;
}

// the box under the summary; `ref` renders a cross-reference link to a lesson
export function objectivesHtml(l: Lesson, tx: LoopText, lang: L, ref: (id: string) => string): string {
  if (!tx.objectives?.length && !l.level) return '';
  const u = LEARN_UI[lang];
  const badge = l.level ? `<span class="level ${l.level}">${u.level[l.level]}</span>` : '';
  const pre = l.prereq?.length ? `<p class="prereq">${u.before} ${l.prereq.map(ref).join(lang === 'fa' ? '، ' : ', ')}</p>` : '';
  const list = tx.objectives?.length ? `<ul>${tx.objectives.map((o) => `<li>${o}</li>`).join('')}</ul>` : '';
  return `<section class="objectives" id="sec-goals"><h2>${icon('target', 16)}${u.objectives}${badge}</h2>${list}${pre}</section>`;
}

export function takeawaysHtml(tx: LoopText, lang: L): string {
  if (!tx.takeaways?.length) return '';
  return `<section class="takeaways" id="sec-takeaways"><h2>${icon('list', 18)}${LEARN_UI[lang].takeaways}</h2><ul>${tx.takeaways
    .map((t) => `<li>${t}</li>`)
    .join('')}</ul></section>`;
}

export { esc as escLearn };
