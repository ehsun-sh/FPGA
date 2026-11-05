// The learning loop on a lesson page: objectives with level and prerequisites, key takeaways, predict-first,
// the quick-check quiz, staged hints with a solution, and the checker's expected-vs-yours table.
// Template strings only; main.ts wires the events.
import type { Lesson } from '../lessons/lessons';
import type { Question } from '../lessons/predict';
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
    cols: ['بررسی', 'انتظار', 'شما'],
    showOnBoard: 'نمایش روی برد',
    predict: 'اول حدس بزنید',
    lockIn: 'ثبت حدس',
    reveal: 'نمایش پاسخ',
    runToReveal: 'حالا طرح را اجرا کنید تا پاسخ را ببینید.',
    right: 'درست',
    wrong: 'نادرست',
    quiz: 'خودآزمایی',
    check: 'بررسی',
    quizPassed: '✓ خودآزمایی کامل شد',
    tryAgain: 'دوباره امتحان کنید.',
    quizMark: 'خودآزمایی',
    exMark: 'تمرین',
    passed: 'انجام شد',
    notYet: 'هنوز نه',
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
    cols: ['Check', 'Expected', 'Yours'],
    showOnBoard: 'Show on board',
    predict: 'Predict first',
    lockIn: 'Lock in',
    reveal: 'Reveal',
    runToReveal: 'Now run the design to see the answer.',
    right: 'Right',
    wrong: 'Not quite',
    quiz: 'Quick check',
    check: 'Check',
    quizPassed: '✓ Quick check passed',
    tryAgain: 'Try again.',
    quizMark: 'Quick check',
    exMark: 'Exercise',
    passed: 'passed',
    notYet: 'not yet',
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

// the checker's result: a plain list, or a table with the evidence when any item has it
export interface ResultItem {
  ok: boolean;
  fa: string;
  en: string;
  detail?: { expected: string; actual: string; scene?: { sw?: number; btn?: string } };
}
export function resultHtml(items: ResultItem[], lang: L): string {
  if (!items.some((i) => i.detail)) return `<ul>${items.map((i) => `<li dir="auto" class="${i.ok ? 'ok' : 'bad'}">${i.ok ? '✓' : '✗'} ${esc(i[lang])}</li>`).join('')}</ul>`;
  const u = LEARN_UI[lang];
  const rows = items
    .map((it, n) => {
      const d = it.detail;
      const btn = !it.ok && d?.scene ? `<button class="chip-btn scene-btn" data-scene="${n}">${icon('cpu', 13)}${u.showOnBoard}</button>` : '';
      return `<tr class="${it.ok ? 'ok' : 'bad'}"><td dir="auto"><span class="mk">${it.ok ? '✓' : '✗'}</span> ${esc(it[lang])}${btn}</td><td dir="ltr"><code>${esc(d?.expected ?? '')}</code></td><td dir="ltr"><code>${esc(d?.actual ?? '')}</code></td></tr>`;
    })
    .join('');
  return `<div class="ev-wrap"><table class="evidence"><thead><tr>${u.cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

// radio options for one question; `picked` is the chosen index, `lock` disables them, `mark` shows right/wrong
function optionsHtml(name: string, q: Question, picked: number, lock: boolean, mark: boolean): string {
  return `<div class="q-opts" role="radiogroup">${q.options
    .map((o, i) => {
      const cls = mark && i === q.answer ? ' right' : mark && i === picked ? ' wrong' : '';
      return `<label class="q-opt${cls}" dir="auto"><input type="radio" name="${name}" value="${i}"${i === picked ? ' checked' : ''}${lock ? ' disabled' : ''}/> <span>${o}</span></label>`;
    })
    .join('')}</div>`;
}

// predict-first in the "try it" section. state: the stored picks, whether they are locked, and whether to reveal
export interface PredictState {
  picks: number[]; // -1 = not answered
  locked: boolean;
  revealed: boolean;
  running: boolean;
}
export function predictHtml(qs: Question[] | undefined, st: PredictState, lang: L): string {
  if (!qs?.length) return '';
  const u = LEARN_UI[lang];
  const items = qs
    .map((q, i) => {
      const p = st.picks[i] ?? -1;
      const res = st.revealed
        ? `<p class="q-why ${p === q.answer ? 'ok' : 'bad'}" dir="auto"><b>${p === q.answer ? '✓ ' + u.right : '✗ ' + u.wrong}.</b> ${q.why}</p>`
        : '';
      return `<fieldset class="q" data-q="${i}"><legend dir="auto">${q.q}</legend>${optionsHtml(`pred-${i}`, q, p, st.locked, st.revealed)}${res}</fieldset>`;
    })
    .join('');
  const all = qs.every((_, i) => (st.picks[i] ?? -1) >= 0);
  const foot = !st.locked
    ? `<button class="chip-btn" data-act="predict-lock"${all ? '' : ' disabled'}>${icon('check', 13)}${u.lockIn}</button>`
    : !st.revealed
      ? st.running
        ? `<button class="chip-btn" data-act="predict-reveal">${icon('zap', 13)}${u.reveal}</button>`
        : `<span class="dim">${u.runToReveal}</span>`
      : '';
  return `<div class="predict" id="predict"><h3>${icon('target', 15)}${u.predict}</h3>${items}<div class="help-btns">${foot}</div></div>`;
}

// the quick-check quiz. answers: what the learner picked and checked per question (-1 = not checked yet)
export interface QuizState {
  picks: number[]; // current radio choice
  checked: number[]; // the choice that was last checked, -1 if none
  passed: boolean; // stored: passed once
}
export function quizHtml(qs: Question[] | undefined, st: QuizState, lang: L): string {
  if (!qs?.length) return '';
  const u = LEARN_UI[lang];
  const items = qs
    .map((q, i) => {
      const c = st.checked[i] ?? -1;
      const ok = c === q.answer;
      const res = c >= 0 ? `<p class="q-why ${ok ? 'ok' : 'bad'}" dir="auto" role="status"><b>${ok ? '✓ ' + u.right : '✗ ' + u.wrong}.</b> ${ok ? q.why ?? '' : u.tryAgain}</p>` : '';
      const pick = st.picks[i] ?? -1;
      return `<fieldset class="q" data-q="${i}"><legend dir="auto">${num(i + 1, lang)}. ${q.q}</legend>${optionsHtml(`quiz-${i}`, q, pick, ok, ok)}<div class="help-btns">${ok ? '' : `<button class="chip-btn" data-act="quiz-check" data-qi="${i}"${pick < 0 ? ' disabled' : ''}>${icon('check', 13)}${u.check}</button>`}</div>${res}</fieldset>`;
    })
    .join('');
  const done = st.passed ? `<span class="quiz-pass">${u.quizPassed}</span>` : '';
  return `<section class="quiz" id="sec-quiz"><h2>${icon('list', 18)}${u.quiz}${done}</h2>${items}</section>`;
}
const num = (n: number, lang: L) => (lang === 'fa' ? String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]) : String(n));

// the two progress marks on a landing-page lesson row: quiz and exercise, filled when passed
export function progressMarks(hasQuiz: boolean, quizOk: boolean, hasEx: boolean, exOk: boolean, lang: L): string {
  const u = LEARN_UI[lang];
  const m = (has: boolean, ok: boolean, ic: 'list' | 'target', label: string) =>
    has ? `<span class="pm${ok ? ' ok' : ''}" title="${label}: ${ok ? u.passed : u.notYet}">${icon(ic, 12)}<span class="sr-only">${label}: ${ok ? u.passed : u.notYet}</span></span>` : '';
  const out = m(hasQuiz, quizOk, 'list', u.quizMark) + m(hasEx, exOk, 'target', u.exMark);
  return out ? `<span class="pmarks">${out}</span>` : '';
}

export { esc as escLearn };
