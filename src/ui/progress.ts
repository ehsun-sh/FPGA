// Progress export / import and the course certificate (Phase 4.5). The file format and the merge are pure functions
// (tested in test/progress.test.ts); the certificate is an SVG drawn here and turned into a PNG on a canvas.
import { logoCells } from './logo';

export const PREFIX = 'fpgalab:';
export interface ProgressFile {
  version: 1;
  exported?: string; // ISO date, for people reading the file
  keys: Record<string, string>; // localStorage keys without the prefix
}

// every fpgalab: key of a storage, without the prefix
export function collect(storage: { length: number; key(i: number): string | null; getItem(k: string): string | null }): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (!k?.startsWith(PREFIX)) continue;
    const v = storage.getItem(k);
    if (v !== null) out[k.slice(PREFIX.length)] = v;
  }
  return out;
}

export const makeFile = (keys: Record<string, string>, now = new Date()): ProgressFile => ({ version: 1, exported: now.toISOString(), keys });

// the shape check: { version: 1, keys: Record<string, string> }; returns the keys or null
export function parseFile(text: string): Record<string, string> | null {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    return null;
  }
  if (!j || typeof j !== 'object') return null;
  const f = j as { version?: unknown; keys?: unknown };
  if (f.version !== 1 || !f.keys || typeof f.keys !== 'object' || Array.isArray(f.keys)) return null;
  const keys: Record<string, string> = {};
  for (const [k, v] of Object.entries(f.keys as Record<string, unknown>)) {
    if (typeof v !== 'string' || k.length > 200 || v.length > 1_000_000) return null;
    keys[k] = v;
  }
  return keys;
}

const LIST_KEYS = new Set(['solved', 'seen', 'solved-help']);
const list = (s: string | undefined) => (s ?? '').split(',').filter(Boolean);
// editor text has a companion time stamp: at:src:<id>:<lang> (and at:tb:…, at:xdc:…)
const isCode = (k: string) => /^(src|tb|xdc):/.test(k);
export const stampKey = (k: string) => `at:${k}`;

// merge an imported file into the local keys: lists (solved, seen) and passed quizzes are united, project
// milestones are OR-ed, editor text keeps the newer copy by its time stamp, anything else takes the imported
// value only when there is no local one
export function merge(local: Record<string, string>, incoming: Record<string, string>): Record<string, string> {
  const out = { ...local };
  for (const [k, v] of Object.entries(incoming)) {
    if (k.startsWith('at:')) continue; // handled with its code key
    if (LIST_KEYS.has(k)) out[k] = [...new Set([...list(local[k]), ...list(v)])].join(',');
    else if (k.startsWith('quiz:')) out[k] = local[k] === '1' || v === '1' ? '1' : v;
    else if (k.startsWith('ms:')) out[k] = String((Number(local[k]) | 0) | (Number(v) | 0));
    else if (isCode(k)) {
      const tl = Number(local[stampKey(k)] ?? 0);
      const ti = Number(incoming[stampKey(k)] ?? 0);
      if (!(k in local) || ti > tl) {
        out[k] = v;
        if (incoming[stampKey(k)] !== undefined) out[stampKey(k)] = incoming[stampKey(k)];
      }
    } else if (!(k in local)) out[k] = v;
  }
  return out;
}

// ---------------------------------------------------------------- certificate
// a short visual seal from the name and the date (FNV-1a), not a signature: the certificate is self-attested
export function seal(name: string, date: string): string {
  let h = 2166136261;
  for (const c of `${name.trim()}|${date}`) h = Math.imul(h ^ c.codePointAt(0)!, 16777619) >>> 0;
  return h.toString(16).toUpperCase().padStart(8, '0');
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface CertText {
  title: string;
  presented: string;
  line: string; // "completed the FPGA Lab course: 32 lessons, Verilog and VHDL"
  dateLabel: string;
  sealLabel: string;
  note: string;
  rtl: boolean;
}

export function certificateSvg(name: string, date: string, url: string, t: CertText): string {
  const s = seal(name, date);
  const dir = t.rtl ? ' direction="rtl"' : '';
  const font = t.rtl ? "Vazirmatn, Tahoma, sans-serif" : "Inter, 'Segoe UI', sans-serif";
  // the seal: a ring of 16 ticks whose lengths come from the hash
  const ticks = [...s.repeat(2)]
    .map((ch, i) => {
      const a = (i / 16) * Math.PI * 2;
      const r1 = 46;
      const r2 = 46 + 4 + (parseInt(ch, 16) % 8);
      return `<path d="M${(1040 + r1 * Math.cos(a)).toFixed(1)} ${(560 + r1 * Math.sin(a)).toFixed(1)}L${(1040 + r2 * Math.cos(a)).toFixed(1)} ${(560 + r2 * Math.sin(a)).toFixed(1)}"/>`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800" font-family="${font}">
<rect width="1200" height="800" fill="#fbf6ec"/>
<rect x="28" y="28" width="1144" height="744" rx="18" fill="none" stroke="#1f6f5c" stroke-width="4"/>
<rect x="44" y="44" width="1112" height="712" rx="12" fill="none" stroke="#c9a227" stroke-width="1.5"/>
<g transform="translate(570 84) scale(3)">${logoCells((bit, hot) => `fill="${hot ? '#e8742a' : bit ? '#1f6f5c' : '#e2dccd'}"`)}</g>
<text x="600" y="238" text-anchor="middle" font-size="50" font-weight="800" fill="#16302a"${dir}>${esc(t.title)}</text>
<text x="600" y="300" text-anchor="middle" font-size="24" fill="#4a5a55"${dir}>${esc(t.presented)}</text>
<text x="600" y="390" text-anchor="middle" font-size="58" font-weight="700" fill="#1f6f5c" direction="${/[֐-ࣿ]/.test(name) ? 'rtl' : 'ltr'}">${esc(name.trim())}</text>
<path d="M300 420H900" stroke="#c9a227" stroke-width="2"/>
<text x="600" y="476" text-anchor="middle" font-size="26" fill="#16302a"${dir}>${esc(t.line)}</text>
<text x="160" y="640" font-size="20" fill="#4a5a55"${dir}>${esc(t.dateLabel)}: ${esc(date)}</text>
<text x="160" y="676" font-size="20" fill="#4a5a55">${esc(url)}</text>
<text x="160" y="712" font-size="15" fill="#7a8a85"${dir}>${esc(t.note)}</text>
<g stroke="#c9a227" stroke-width="3" stroke-linecap="round">${ticks}</g>
<circle cx="1040" cy="560" r="44" fill="#1f6f5c"/>
<text x="1040" y="556" text-anchor="middle" font-size="13" fill="#fbf6ec"${dir}>${esc(t.sealLabel)}</text>
<text x="1040" y="578" text-anchor="middle" font-size="15" font-family="'JetBrains Mono', monospace" fill="#fbf6ec">${s}</text>
</svg>`;
}

// draws the SVG on a canvas and returns a PNG blob (in the browser)
export function svgToPng(svgText: string, w = 1200, h = 800): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w * 2;
      c.height = h * 2;
      const g = c.getContext('2d')!;
      g.scale(2, 2);
      g.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('no PNG'))), 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('the SVG did not load'));
    };
    img.src = url;
  });
}
