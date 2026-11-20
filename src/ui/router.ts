// Real URLs (Phase 4.1): /<lang>/lesson/<id>, /<lang>/lab, /<lang>/playground, /<lang>/glossary and the landing
// page at / or /<lang>/. Pure functions, so they can be tested in Node; the app calls them with its BASE_URL.
export type RouteLang = 'fa' | 'en';
export type Route =
  | { page: 'home'; lang?: RouteLang } // no lang: the bare root, which keeps the stored language
  | { page: 'lesson'; lang: RouteLang; id: string }
  | { page: 'lab'; lang: RouteLang }
  | { page: 'playground'; lang: RouteLang }
  | { page: 'glossary'; lang: RouteLang };

// the build's base path ('/' in dev, '/fpga/' on Cloudflare), always with a trailing slash
export const normBase = (b: string | undefined) => {
  let s = !b || b === './' || b === '.' ? '/' : b;
  if (!s.startsWith('/')) s = '/' + s;
  return s.endsWith('/') ? s : s + '/';
};
const viteBase = (() => {
  try {
    return (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL;
  } catch {
    return undefined;
  }
})();
export const BASE = normBase(viteBase);

const ID = /^[a-z0-9_-]+$/;

// the path without the base, split into segments; null when the path is outside the base
function segments(pathname: string, base: string): string[] | null {
  const b = normBase(base);
  let p = pathname;
  if (p + '/' === b) p = b; // "/fpga" is the base too
  if (!p.startsWith(b)) return null;
  p = p.slice(b.length).replace(/\/index\.html$/, '').replace(/\/+$/, '');
  try {
    return p ? p.split('/').map(decodeURIComponent) : [];
  } catch {
    return null;
  }
}

// a pathname → its route, or null for an unknown path (the app shows the landing page then)
export function parse(pathname: string, base = BASE): Route | null {
  const s = segments(pathname, base);
  if (!s) return null;
  if (s.length === 0 || (s.length === 1 && s[0] === 'index.html')) return { page: 'home' };
  const lang = s[0];
  if (lang !== 'fa' && lang !== 'en') return null;
  if (s.length === 1) return { page: 'home', lang };
  if (s.length === 2 && (s[1] === 'lab' || s[1] === 'playground' || s[1] === 'glossary')) return { page: s[1], lang };
  if (s.length === 3 && s[1] === 'lesson' && ID.test(s[2])) return { page: 'lesson', lang, id: s[2] };
  return null;
}

// a route → its pathname (with the base)
export function urlFor(r: Route, base = BASE): string {
  const b = normBase(base);
  switch (r.page) {
    case 'home':
      return r.lang ? `${b}${r.lang}/` : b;
    case 'lesson':
      return `${b}${r.lang}/lesson/${r.id}`;
    default:
      return `${b}${r.lang}/${r.page}`;
  }
}

// the old hash scheme (#lesson/<id>, #lab), mapped to a route in the given language; null for any other hash
export function legacyHash(hash: string, lang: RouteLang): Route | null {
  const m = /^#lesson\/([a-z0-9_-]+)$/.exec(hash);
  if (m) return { page: 'lesson', lang, id: m[1] };
  if (hash === '#lab') return { page: 'lab', lang };
  return null;
}

// the same page in the other language (the language switch rewrites the /fa|en/ segment)
export const withLang = (r: Route, lang: RouteLang): Route => ({ ...r, lang });

export const sameRoute = (a: Route, b: Route) => urlFor(a) === urlFor(b);
