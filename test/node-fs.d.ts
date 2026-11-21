// The tests read a few repository files directly; @types/node is not installed, so declare the bit they use.
declare module 'node:fs' {
  export function readFileSync(path: URL | string, encoding: 'utf8'): string;
  export function readFileSync(path: URL | string): Uint8Array;
}

declare module 'node:fs' {
  export function mkdtempSync(prefix: string): string;
  export function writeFileSync(path: string, data: string | Uint8Array, o?: { mode?: number }): void;
  export function existsSync(path: string): boolean;
  export function rmSync(path: string, o?: { recursive?: boolean; force?: boolean }): void;
}
declare module 'node:child_process' {
  interface Child {
    kill(): void;
    stdout: { on(ev: 'data', f: (b: Uint8Array) => void): void };
  }
  export function spawn(cmd: string, args: string[], o?: { env?: Record<string, string | undefined>; cwd?: string }): Child;
  export function execSync(cmd: string, o?: { stdio?: unknown }): Uint8Array;
  export function execFileSync(cmd: string, args: string[], o: { input: string; encoding?: 'utf8' }): string;
}
declare module 'node:zlib' {
  export function crc32(data: Uint8Array): number;
}
declare module 'node:os' {
  export function tmpdir(): string;
}
declare const process: { env: Record<string, string | undefined> };
