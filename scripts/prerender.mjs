// Prerendered pages for crawlers and link previews (Phase 4.1). Run by `npm run build` after `vite build`.
//
// The lesson data is TypeScript, so it is loaded through Vite's own module runner (createServer + ssrLoadModule):
// no extra dependency and no separate lessons.json. For each language it writes the landing page, the glossary and
// every course and project lesson as dist/<lang>/.../index.html: the built index.html with its own <html lang dir>,
// title, description, canonical and hreflang links, Open Graph tags, and the page text in <div id="seo" hidden>
// (the app removes it on boot). It also writes dist/sitemap.xml and dist/robots.txt.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const ORIGIN = (process.env.SITE_ORIGIN ?? 'https://learn.shahmohammadi.dev').replace(/\/$/, '');

const vite = await createServer({
  root,
  logLevel: 'error',
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
let data;
try {
  const [course, en, glossary, strings, router] = await Promise.all(
    ['/src/lessons/course.ts', '/src/lessons/en.ts', '/src/lessons/glossary.ts', '/src/ui/strings.ts', '/src/ui/router.ts'].map((m) => vite.ssrLoadModule(m)),
  );
  data = { course, en, glossary, strings, router };
} finally {
  await vite.close();
}
const { COURSE_CHAPTERS, PROJECTS } = data.course;
const { EN } = data.en;
const { GLOSSARY, sortedGlossary } = data.glossary;
const { HOME } = data.strings;
const { normBase, urlFor } = data.router;

const BASE = normBase(process.env.VITE_BASE ?? '/');
const url = (r) => urlFor(r, BASE);
const abs = (r) => ORIGIN + url(r);
const shell = readFileSync(join(dist, 'index.html'), 'utf8');

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const strip = (h) => String(h).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const text = (l, lang) => (lang === 'en' && EN[l.id] ? EN[l.id] : l);
const titleOf = new Map();

// lesson HTML as a static page: no scripts or event attributes, real links instead of the in-app #lesson/<id>
function clean(html, lang) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/<a class="xref" data-ref="([a-z0-9_-]+)" href="#lesson\/\1"><\/a>/g, (_, id) => `<a href="${url({ page: 'lesson', lang, id })}">${esc(titleOf.get(`${lang}:${id}`) ?? id)}</a>`)
    .replace(/href="#lesson\/([a-z0-9_-]+)"/g, (_, id) => `href="${url({ page: 'lesson', lang, id })}"`);
}

function page(route, { title, desc, seo }) {
  const lang = route.lang;
  const alt = (l) => abs({ ...route, lang: l });
  const head = [
    `<link rel="canonical" href="${alt(lang)}" />`,
    `<link rel="alternate" hreflang="fa" href="${alt('fa')}" />`,
    `<link rel="alternate" hreflang="en" href="${alt('en')}" />`,
    `<link rel="alternate" hreflang="x-default" href="${alt('fa')}" />`,
    `<meta property="og:url" content="${alt(lang)}" />`,
  ].join('\n    ');
  let html = shell
    .replace(/<html[^>]*>/, `<html lang="${lang}" dir="${lang === 'fa' ? 'rtl' : 'ltr'}">`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/, `<meta name="description" content="${esc(desc)}" />`)
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${esc(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${esc(desc)}" />`)
    .replace(/<meta property="og:locale" content="[^"]*"\s*\/?>/, `<meta property="og:locale" content="${lang === 'fa' ? 'fa_IR' : 'en_US'}" />`)
    .replace(/<meta property="og:locale:alternate" content="[^"]*"\s*\/?>/, `<meta property="og:locale:alternate" content="${lang === 'fa' ? 'en_US' : 'fa_IR'}" />`)
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="app"></div>', `<div id="seo" hidden>${seo}</div>\n    <div id="app"></div>`);
  const file = join(dist, url(route).slice(BASE.length), 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  return abs(route);
}

const LANGS = ['fa', 'en'];
const chapters = [...COURSE_CHAPTERS, PROJECTS];
for (const lang of LANGS) for (const c of chapters) for (const l of c.lessons) titleOf.set(`${lang}:${l.id}`, text(l, lang).title);

const urls = [];
for (const lang of LANGS) {
  const h = HOME[lang];
  // landing page: the pitch and the course outline
  const outline = chapters
    .map((c) => `<h2>${esc(c.title[lang])}</h2><ul>${c.lessons.map((l) => `<li><a href="${url({ page: 'lesson', lang, id: l.id })}">${esc(text(l, lang).title)}</a>: ${esc(strip(text(l, lang).summary))}</li>`).join('')}</ul>`)
    .join('');
  urls.push(
    page({ page: 'home', lang }, {
      title: lang === 'fa' ? 'FPGA Lab | آموزش طراحی FPGA در مرورگر' : 'FPGA Lab | learn FPGA design in your browser',
      desc: strip(h.lead),
      seo: `<h1>${esc(strip(h.title))}</h1><p>${esc(strip(h.lead))}</p>${outline}<p><a href="${url({ page: 'glossary', lang })}">${lang === 'fa' ? 'واژه‌نامه' : 'Glossary'}</a></p>`,
    }),
  );
  // glossary
  const gl = sortedGlossary(lang)
    .map((t) => `<dt id="term-${t.id}">${esc(t.term[lang])}</dt><dd>${clean(t.def[lang], lang)}${t.lesson ? ` <a href="${url({ page: 'lesson', lang, id: t.lesson })}">${esc(titleOf.get(`${lang}:${t.lesson}`) ?? '')}</a>` : ''}</dd>`)
    .join('');
  const glTitle = lang === 'fa' ? 'واژه‌نامه' : 'Glossary';
  const glDesc = lang === 'fa' ? `${GLOSSARY.length} واژهٔ اصلی طراحی FPGA با تعریف کوتاه، به فارسی و انگلیسی.` : `${GLOSSARY.length} key terms of FPGA design with short definitions, in English and Persian.`;
  urls.push(page({ page: 'glossary', lang }, { title: `${glTitle} · FPGA Lab`, desc: glDesc, seo: `<h1>${glTitle}</h1><dl>${gl}</dl>` }));
  // lessons
  for (const c of chapters)
    for (const l of c.lessons) {
      const t = text(l, lang);
      const obj = t.objectives?.length ? `<ul>${t.objectives.map((o) => `<li>${clean(o, lang)}</li>`).join('')}</ul>` : '';
      urls.push(
        page({ page: 'lesson', lang, id: l.id }, {
          title: `${strip(t.title)} · FPGA Lab`,
          desc: strip(t.summary),
          seo: `<p>${esc(c.title[lang])}</p><h1>${esc(strip(t.title))}</h1><p>${esc(strip(t.summary))}</p>${obj}${clean(t.body, lang)}`,
        }),
      );
    }
}

const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`,
);
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}${BASE}sitemap.xml\n`);
console.log(`prerender: ${urls.length} pages, sitemap.xml and robots.txt in dist/ (base ${BASE})`);
