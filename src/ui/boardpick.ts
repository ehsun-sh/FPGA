// The board picker (landing page and the View menu), the banner shown when a lesson URL switched the board for a
// visit, and the board's line in the course progress.
import type { BoardDef } from '../boards/types';
import { num, type UiLang } from './strings';

export const BOARD_UI = {
  fa: {
    yours: 'برد شما',
    switched: (name: string) => `این درس برای برد ${name} است؛ برد به‌طور موقت عوض شد.`,
    back: (name: string) => `برگشت به ${name}`,
    empty: 'درس‌های این برد به‌زودی اضافه می‌شوند.',
    emptyLead: 'تا آن موقع در زمین بازی طرح خودتان را روی این برد اجرا کنید.',
    progress: (name: string, done: string, all: string) => `${name}: ${done} از ${all} درس`,
    menu: 'برد',
    eyebrow: 'EBAZ4205 · Zynq-7010',
    live: 'طرح زمین بازی روی این برد اجرا می‌شود: LEDها چشمک می‌زنند.',
    idle: 'برای چرخاندن بکشید · برای بزرگ‌نمایی اسکرول کنید',
  },
  en: {
    yours: 'Your board',
    switched: (name: string) => `This lesson is for the ${name}; the board was switched for now.`,
    back: (name: string) => `Back to the ${name}`,
    empty: 'Lessons for this board are coming soon.',
    emptyLead: 'Until then, run your own design on this board in the playground.',
    progress: (name: string, done: string, all: string) => `${name}: ${done} of ${all} lessons`,
    menu: 'Board',
    eyebrow: 'EBAZ4205 · Zynq-7010',
    live: 'The playground design is running on this board: the LEDs blink.',
    idle: 'Drag to rotate · scroll to zoom',
  },
};

// short notes under the two options (the roadmap's wording)
const NOTES: Record<string, { fa: string; en: string }> = {
  'nexys-a7-100t': { fa: 'برد آموزشی Digilent؛ کلید، LED و نمایشگر هفت‌قسمتی', en: 'Digilent trainer: switches, LEDs, 7-segment' },
};
export const boardNote = (b: BoardDef, lang: UiLang) => (b.note ?? NOTES[b.id])?.[lang] ?? '';
export const boardTitle = (b: BoardDef) => (b.id === 'ebaz4205' ? 'EBAZ4205 (Zynq-7010)' : b.name);

// a segmented control: one radio button per board; picking one switches the board (data-board)
export function boardPicker(boards: BoardDef[], current: string, lang: UiLang): string {
  const u = BOARD_UI[lang];
  return `<div class="board-pick" role="radiogroup" aria-label="${u.yours}"><span class="bp-label">${u.yours}</span><div class="bp-opts">${boards
    .map(
      (b) =>
        `<button role="radio" aria-checked="${b.id === current}" data-board="${b.id}" class="${b.id === current ? 'on' : ''}"><b dir="ltr">${boardTitle(b)}</b><span>${boardNote(b, lang)}</span></button>`,
    )
    .join('')}</div></div>`;
}

export function boardBanner(lang: UiLang, visiting: BoardDef, saved: BoardDef): string {
  const u = BOARD_UI[lang];
  return `<div class="board-banner" role="status" dir="${lang === 'fa' ? 'rtl' : 'ltr'}" lang="${lang}"><span>${u.switched(boardTitle(visiting))}</span><button class="btn small" data-board-back="${saved.id}">${u.back(boardTitle(saved))}</button><button class="bb-close" data-board-dismiss aria-label="✕">✕</button></div>`;
}

export const progressLine = (lang: UiLang, b: BoardDef, done: number, all: number) => BOARD_UI[lang].progress(boardTitle(b), num(done, lang), num(all, lang));
