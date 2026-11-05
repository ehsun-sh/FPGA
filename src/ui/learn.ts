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
    hint: (n: string) => `راهنمایی ${n}`,
    showSolution: 'نمایش راه‌حل',
    solutionLocked: 'بعد از دو تلاش یا دیدن هر دو راهنمایی فعال می‌شود',
    solution: 'راه‌حل',
    copyIn: 'گذاشتن در ویرایشگر',
    copyConfirm: 'کد فعلی ویرایشگر جایگزین می‌شود. ادامه؟',
    solvedHelp: 'حل شده با راه‌حل',
  },
  en: {
    objectives: 'By the end of this lesson you can',
    takeaways: 'Key takeaways',
    before: 'Before this:',
    level: { intro: 'Intro', core: 'Core', advanced: 'Advanced' },
    levelTitle: 'Lesson level',
    goalsToc: 'Goals',
    xref: (n: string, title: string) => `lesson ${n}: ${title}`,
    hint: (n: string) => `Hint ${n}`,
    showSolution: 'Show solution',
    solutionLocked: 'Enabled after two attempts or both hints',
    solution: 'Solution',
    copyIn: 'Copy into editor',
    copyConfirm: 'This replaces the code in the editor. Continue?',
    solvedHelp: 'solved with the solution',
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

// staged help for an exercise: hint 1, then hint 2, then the solution once it is unlocked
export interface HelpState {
  attempts: number; // failed checks
  hints: number; // hints open, 0–2
  solution: boolean; // the solution was revealed
}
export const solutionUnlocked = (s: HelpState) => s.attempts >= 2 || s.hints >= 2;

export function helpHtml(
  hints: { fa: string; en: string }[] | undefined,
  solution: string | undefined,
  st: HelpState,
  lang: L,
  num: (n: number) => string,
  code: (src: string) => string,
): string {
  if (!hints?.length && !solution) return '';
  const u = LEARN_UI[lang];
  const open = (hints ?? []).slice(0, st.hints);
  const shown = open.map((h, i) => `<div class="hint" dir="auto"><b>${u.hint(num(i + 1))}</b> ${h[lang]}</div>`).join('');
  const next = hints && st.hints < hints.length ? `<button class="chip-btn" data-act="hint">${icon('book', 13)}${u.hint(num(st.hints + 1))}</button>` : '';
  let sol = '';
  if (solution && st.solution)
    sol = `<div class="solution"><div class="sol-h"><b>${u.solution}</b><button class="chip-btn" data-act="copy-solution">${icon('pencil', 13)}${u.copyIn}</button></div>${code(solution)}</div>`;
  else if (solution) {
    const on = solutionUnlocked(st);
    sol = `<button class="chip-btn" data-act="show-solution"${on ? '' : ` disabled aria-disabled="true" title="${u.solutionLocked}"`}>${icon('code', 13)}${u.showSolution}</button>${on ? '' : `<span class="dim sol-lock">${u.solutionLocked}</span>`}`;
  }
  return `<div class="ex-help" id="ex-help">${shown}<div class="help-btns">${next}${st.solution ? '' : sol}</div>${st.solution ? sol : ''}</div>`;
}

export { esc as escLearn };
