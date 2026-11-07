// The tests read a few source files (CSS) as text; the project has no @types/node, so declare the one call used.
declare module 'node:fs' {
  export function readFileSync(path: URL | string, encoding: 'utf8'): string;
}
