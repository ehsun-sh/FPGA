// Screenshot smoke test (not part of the build): serves dist/ with `vite preview` and captures a few pages at desktop
// and phone size, in both site languages and both workbench modes, into screenshots/ (git-ignored).
// Usage: npm run build && node scripts/screenshots.cjs
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');

let playwright;
try {
  playwright = require('playwright');
} catch {
  console.log('Playwright is not installed. To use this script:\n  npm i -D playwright && npx playwright install chromium\nthen run it again.');
  process.exit(0);
}

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'screenshots');
const PAGES = [
  ['home', ''],
  ['intro', '#lesson/intro'],
  ['counter', '#lesson/counter'],
];
const SIZES = [
  ['desk', 1440, 900],
  ['phone', 390, 844],
];

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

async function waitFor(url, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no answer from ${url}`);
}

(async () => {
  if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
    console.log('dist/ is missing: run `npm run build` first.');
    process.exit(1);
  }
  fs.mkdirSync(out, { recursive: true });
  const port = await freePort();
  const vite = spawn(process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(port), '--strictPort'], {
    cwd: root,
    stdio: 'ignore',
  });
  const base = `http://localhost:${port}/`;
  let failed = false;
  try {
    await waitFor(base);
    const browser = await playwright.chromium.launch();
    for (const [size, w, h] of SIZES)
      for (const lang of ['fa', 'en'])
        for (const mode of ['learn', 'vivado']) {
          const ctx = await browser.newContext({ viewport: { width: w, height: h } });
          // a returning visitor: no tour, the chosen language and mode
          await ctx.addInitScript(
            ([l, m]) => {
              localStorage.setItem('fpgalab:ui-lang', l);
              localStorage.setItem('fpgalab:mode', m);
              localStorage.setItem('fpgalab:tour-done', '1');
            },
            [lang, mode],
          );
          const page = await ctx.newPage();
          page.on('pageerror', (e) => {
            failed = true;
            console.error(`page error (${size} ${lang} ${mode}): ${e.message}`);
          });
          for (const [name, hash] of PAGES) {
            if (name === 'home' && mode === 'vivado') continue; // the landing page has no mode
            await page.goto(base + hash);
            await page.waitForTimeout(1200);
            const file = path.join(out, `${name}-${size}-${lang}${name === 'home' ? '' : '-' + mode}.png`);
            await page.screenshot({ path: file });
            console.log('saved', path.relative(root, file));
          }
          await ctx.close();
        }
    await browser.close();
  } finally {
    vite.kill();
  }
  process.exit(failed ? 1 : 0);
})();
