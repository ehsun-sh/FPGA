// The tests read a few repository files directly; @types/node is not installed, so declare the bit they use.
declare module 'node:fs' {
  export function readFileSync(path: URL | string, encoding: 'utf8'): string;
  export function readFileSync(path: URL | string): Uint8Array;
}
