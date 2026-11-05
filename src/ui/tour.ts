// A short guided tour: a dimmed page with a hole around one element at a time and a card that explains it.
// One overlay for the whole tour; Esc skips, Tab stays inside the card, and the focus goes back where it was.
import { num } from './strings';

export interface TourStep {
  target: string; // CSS selector; a comma list picks the first match (a fallback)
  title: string;
  body: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
}

const LABELS = {
  fa: { back: 'قبلی', next: 'بعدی', skip: 'رد کردن', done: 'تمام', of: (i: string, n: string) => `${i} از ${n}` },
  en: { back: 'Back', next: 'Next', skip: 'Skip', done: 'Done', of: (i: string, n: string) => `${i} of ${n}` },
};

const PAD = 6;
const GAP = 12;

// the first selector in the list that matches a visible element
function findTarget(sel: string): HTMLElement | null {
  for (const s of sel.split(',')) {
    const el = document.querySelector<HTMLElement>(s.trim());
    if (el && el.getClientRects().length) return el;
  }
  return null;
}

let active: (() => void) | null = null;

export function startTour(steps: TourStep[], opts: { lang: 'fa' | 'en'; onDone(): void }): void {
  active?.(); // one tour at a time
  const L = LABELS[opts.lang];
  const back = document.activeElement as HTMLElement | null;
  const root = document.createElement('div');
  root.className = 'tour';
  root.dir = opts.lang === 'fa' ? 'rtl' : 'ltr';
  root.lang = opts.lang;
  root.innerHTML = `<div class="tour-hole"></div>
<div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-t" aria-describedby="tour-b" tabindex="-1">
  <h2 id="tour-t"></h2><p id="tour-b"></p>
  <div class="tour-foot"><span class="tour-count"></span><span class="grow"></span>
    <button type="button" class="tour-skip">${L.skip}</button>
    <button type="button" class="tour-back">${L.back}</button>
    <button type="button" class="tour-next primary"></button></div>
</div>`;
  document.body.appendChild(root);
  const hole = root.querySelector<HTMLElement>('.tour-hole')!;
  const card = root.querySelector<HTMLElement>('.tour-card')!;
  const btnBack = root.querySelector<HTMLButtonElement>('.tour-back')!;
  const btnNext = root.querySelector<HTMLButtonElement>('.tour-next')!;
  let i = 0;
  let target: HTMLElement | null = null;

  const place = () => {
    const r = target?.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!r) {
      // nothing to point at: a centred card on a dimmed page
      hole.style.cssText = `left:${vw / 2}px;top:${vh / 2}px;width:0;height:0`;
      card.style.left = `${Math.max(8, (vw - card.offsetWidth) / 2)}px`;
      card.style.top = `${Math.max(8, (vh - card.offsetHeight) / 2)}px`;
      return;
    }
    hole.style.cssText = `left:${r.left - PAD}px;top:${r.top - PAD}px;width:${r.width + 2 * PAD}px;height:${r.height + 2 * PAD}px`;
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const room = { bottom: vh - r.bottom, top: r.top, right: vw - r.right, left: r.left };
    let side = steps[i].placement ?? 'auto';
    if (side === 'auto') {
      side = room.bottom >= ch + GAP + PAD ? 'bottom' : room.top >= ch + GAP + PAD ? 'top' : room.right >= room.left ? 'right' : 'left';
    }
    let x: number;
    let y: number;
    if (side === 'bottom' || side === 'top') {
      x = r.left + r.width / 2 - cw / 2;
      y = side === 'bottom' ? r.bottom + PAD + GAP : r.top - PAD - GAP - ch;
    } else {
      y = r.top + r.height / 2 - ch / 2;
      x = side === 'right' ? r.right + PAD + GAP : r.left - PAD - GAP - cw;
    }
    // keep the card on screen; over a big target it may cover part of it, which is fine
    card.style.left = `${Math.min(Math.max(8, x), vw - cw - 8)}px`;
    card.style.top = `${Math.min(Math.max(8, y), vh - ch - 8)}px`;
  };

  const show = (k: number) => {
    i = k;
    const s = steps[i];
    target = findTarget(s.target);
    target?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    root.querySelector('#tour-t')!.textContent = s.title;
    root.querySelector('#tour-b')!.textContent = s.body;
    root.querySelector('.tour-count')!.textContent = L.of(num(i + 1, opts.lang), num(steps.length, opts.lang));
    btnBack.hidden = i === 0;
    btnNext.textContent = i === steps.length - 1 ? L.done : L.next;
    place();
    btnNext.focus();
  };

  const close = () => {
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
    document.removeEventListener('keydown', onKey, true);
    root.remove();
    active = null;
    back?.focus?.({ preventScroll: true });
    opts.onDone();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      // keep the focus inside the card
      const f = [...card.querySelectorAll<HTMLElement>('button:not([hidden])')];
      const k = f.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length]?.focus();
    }
  };

  root.querySelector('.tour-skip')!.addEventListener('click', close);
  btnBack.addEventListener('click', () => show(Math.max(0, i - 1)));
  btnNext.addEventListener('click', () => (i === steps.length - 1 ? close() : show(i + 1)));
  // clicks on the dimmed page do nothing (the page underneath is not part of the tour)
  root.addEventListener('click', (e) => e.stopPropagation());
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place, true);
  document.addEventListener('keydown', onKey, true);
  active = close;
  show(0);
}
