// Site theme: System (follow the OS), Light or Dark. The tokens live in src/theme.css; this module only picks which
// set applies by setting <html data-theme>, which index.html also does before first paint so there is no flash.
import type { UiLang } from './strings';
import type { IconName } from './icons';

export type ThemePref = 'system' | 'light' | 'dark';
export type Theme = 'light' | 'dark';

export const THEME_ORDER: ThemePref[] = ['system', 'light', 'dark'];
// the browser chrome colour (meta theme-color) for each theme: the light paper and the dark background
export const THEME_COLOR: Record<Theme, string> = { light: '#f6eddd', dark: '#15171c' };
// the 3D board's backdrop (matches --board-bg in theme.css)
export const BOARD_BG: Record<Theme, string> = { light: '#1d2026', dark: '#111317' };

export const parseTheme = (v: string | null): ThemePref => (v === 'light' || v === 'dark' ? v : 'system');
export const nextTheme = (t: ThemePref): ThemePref => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length];
export const resolveTheme = (t: ThemePref, systemDark: boolean): Theme => (t === 'system' ? (systemDark ? 'dark' : 'light') : t);

const NAME: Record<UiLang, Record<ThemePref, string>> = {
  fa: { system: 'سیستم', light: 'روشن', dark: 'تاریک' },
  en: { system: 'system', light: 'light', dark: 'dark' },
};
export const themeLabel = (t: ThemePref, lang: UiLang) => (lang === 'fa' ? `پوسته: ${NAME.fa[t]}` : `Theme: ${NAME.en[t]}`);
export const THEME_ICON: Record<ThemePref, IconName> = { system: 'monitor', light: 'sun', dark: 'moon' };

// ---------------------------------------------------------------- in the page
// the stored preference (store key `theme`, i.e. localStorage 'fpgalab:theme'); index.html reads the same key
const KEY = 'fpgalab:theme';
let pref: ThemePref = 'system';
try {
  pref = parseTheme(localStorage.getItem(KEY));
} catch {
  /* private mode: follow the system */
}
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
const listeners: ((t: Theme) => void)[] = [];

export const themePref = () => pref;
export const currentTheme = (): Theme => resolveTheme(pref, !!media?.matches);

// the button next to the language menu; the label says the current setting, a click moves to the next one
export function themeButton(lang: UiLang): string {
  const label = themeLabel(pref, lang);
  return `<button class="theme-btn" data-act="theme" aria-label="${label}" title="${label}">${iconSvg(THEME_ICON[pref])}</button>`;
}
let iconSvg: (n: IconName) => string = () => '';
let langOf: () => UiLang = () => 'en';

function apply() {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  const t = currentTheme();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t]);
  document.querySelectorAll<HTMLElement>('.theme-btn').forEach((b) => {
    const label = themeLabel(pref, langOf());
    b.innerHTML = iconSvg(THEME_ICON[pref]);
    b.setAttribute('aria-label', label);
    b.title = label;
  });
  for (const f of listeners) f(t);
}

export function setThemePref(t: ThemePref) {
  pref = t;
  try {
    if (t === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    /* not saved; still applied */
  }
  apply();
}
export const cycleTheme = () => setThemePref(nextTheme(pref));

// wire up once: the icon renderer and the page language (for labels), and a callback for canvas colours
export function initTheme(opts: { icon: (n: IconName) => string; lang: () => UiLang; onChange?: (t: Theme) => void }) {
  iconSvg = opts.icon;
  langOf = opts.lang;
  if (opts.onChange) listeners.push(opts.onChange);
  media?.addEventListener('change', () => pref === 'system' && apply());
  apply();
}
