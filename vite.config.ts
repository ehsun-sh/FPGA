import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
// the commit the build was made from, shown next to the version (none outside a git checkout)
let commit = '';
try {
  commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  /* not a git checkout */
}

// Cloudflare Web Analytics (Phase 4.6): only when VITE_CF_BEACON holds a site token at build time. No cookies, no
// other vendor; without the variable nothing is added to the page.
function cfBeacon(): Plugin {
  const token = process.env.VITE_CF_BEACON;
  return {
    name: 'cf-beacon',
    transformIndexHtml() {
      if (!token) return [];
      return [
        {
          tag: 'script',
          attrs: {
            defer: true,
            src: 'https://static.cloudflareinsights.com/beacon.min.js',
            'data-cf-beacon': JSON.stringify({ token }),
          },
          injectTo: 'body',
        },
      ];
    },
  };
}

export default defineConfig({
  // real URLs (/fa/lesson/<id>) need an absolute base: '/' in dev, VITE_BASE=/fpga/ for the Cloudflare build
  base: process.env.VITE_BASE ?? '/',
  plugins: [cfBeacon()],
  build: { chunkSizeWarningLimit: 1500 },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_COMMIT__: JSON.stringify(commit),
  },
});
