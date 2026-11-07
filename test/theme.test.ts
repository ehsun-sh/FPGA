// The design tokens in src/theme.css: one light block, two identical dark blocks, and readable text in both themes.
import { describe, expect, it } from 'vitest';
import { nextTheme, parseTheme, resolveTheme, THEME_COLOR } from '../src/ui/theme';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8');
const style = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const body = (re: RegExp) => {
  const m = css.match(re);
  if (!m) throw new Error(`no block for ${re}`);
  return m[1];
};
const light = tokens(body(/^:root\s*\{([^}]*)\}/m));
const mediaDark = tokens(body(/:root:not\(\[data-theme='light'\]\)\s*\{([^}]*)\}/));
const pickedDark = tokens(body(/^html\[data-theme='dark'\]\s*\{([^}]*)\}/m));
// a dark block lists only what changes; the rest comes from :root
const dark = { ...light, ...pickedDark };

// WCAG 2.x relative luminance and contrast ratio
function lum(hex: string): number {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('theme tokens', () => {
  it('has exactly one :root block, in theme.css only', () => {
    expect(css.match(/^:root/gm)?.length).toBe(1);
    expect(style.match(/^:root/gm)).toBeNull();
  });

  it('defines the same dark values for the system setting and for a picked dark theme', () => {
    expect(mediaDark).toEqual(pickedDark);
  });

  it('every token a dark block changes exists in the light block', () => {
    for (const k of Object.keys(pickedDark)) if (k !== 'color-scheme') expect(light, k).toHaveProperty(k);
  });

  it('style.css only uses tokens that exist', () => {
    const used = new Set([...style.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
    const missing = [...used].filter((k) => !(k in light));
    expect(missing).toEqual([]);
  });

  const pairs: [string, string, number][] = [
    ['text', 'bg', 4.5],
    ['text', 'panel', 4.5],
    ['muted', 'panel', 4.5],
    ['muted', 'panel-2', 4.5],
    ['text-2', 'paper', 4.5],
    ['accent-ink', 'accent-soft', 4.5],
    ['brand-ink', 'brand-soft', 4.5],
    ['ok-ink', 'ok-soft', 4.5],
    ['err-ink', 'err-soft', 4.5],
    ['warn-ink', 'warn-soft', 4.5],
    ['code-text', 'code-bg', 4.5],
    ['on-ink', 'ink', 4.5],
    ['editor-text', 'editor-bg', 4.5],
    ['syn-comment', 'editor-bg', 4.5],
    ['statusbar-text', 'statusbar-bg', 4.5],
    ['sch-text', 'sch-bg', 4.5],
    ['accent', 'panel', 3],
    ['brand', 'panel', 3],
  ];
  for (const [name, map] of [
    ['light', light],
    ['dark', dark],
  ] as const)
    for (const [fg, bg, min] of pairs)
      it(`${name}: ${fg} on ${bg} has contrast ≥ ${min}`, () => {
        const r = ratio(map[`--${fg}`], map[`--${bg}`]);
        expect(r, `${name} ${fg}/${bg} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(min);
      });

  it('meta theme-color matches the paper and the dark background', () => {
    expect(THEME_COLOR.light).toBe(light['--paper']);
    expect(THEME_COLOR.dark).toBe(dark['--bg']);
  });
});

describe('theme preference', () => {
  it('cycles System → Light → Dark → System', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });
  it('reads unknown values as System and resolves System from the OS', () => {
    expect(parseTheme(null)).toBe('system');
    expect(parseTheme('blue')).toBe('system');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
  });
});
