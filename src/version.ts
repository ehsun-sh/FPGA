// The app's version (package.json) and the commit it was built from, set by vite.config.ts.
declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;

export const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
export const COMMIT = typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : '';
// "v0.2.0 (1a2b3c4)"
export const versionLabel = `v${VERSION}${COMMIT ? ` (${COMMIT})` : ''}`;
