// A tiny in-memory file system for the simulated Linux on the EBAZ4205 (src/linux/sim.ts). Plain files hold text;
// "virtual" files (procfs, sysfs) compute what they read and decide what a write does, like the kernel's.

export interface VFile {
  // the text a read returns
  read(): string;
  // a write: undefined = accepted, a string = the error message (as the shell prints it after "sh: can't create")
  write?(text: string, append: boolean): string | undefined;
  size?: number; // shown by ls -l (default: the length of the text)
  exec?: boolean; // shown as executable
  dev?: boolean; // a device node (/dev/...)
}

type Node = { kind: 'dir' } | { kind: 'file'; f: VFile };

export const plain = (text: string, exec = false, size?: number): VFile => {
  let t = text;
  return {
    read: () => t,
    write(s, append) {
      t = append ? t + s : s;
      return undefined;
    },
    exec,
    get size() {
      return size ?? t.length;
    },
  };
};

export function normalize(path: string, cwd = '/'): string {
  const parts = (path.startsWith('/') ? path : `${cwd}/${path}`).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return `/${out.join('/')}`;
}
const parent = (p: string) => (p === '/' ? '/' : p.slice(0, p.lastIndexOf('/')) || '/');
export const basename = (p: string) => p.slice(p.lastIndexOf('/') + 1);

export class Vfs {
  private nodes = new Map<string, Node>([['/', { kind: 'dir' }]]);

  mkdir(path: string) {
    const p = normalize(path);
    if (p !== '/' && !this.nodes.has(parent(p))) this.mkdir(parent(p));
    if (!this.nodes.has(p)) this.nodes.set(p, { kind: 'dir' });
  }
  // creates the parent directories too
  put(path: string, f: VFile) {
    const p = normalize(path);
    this.mkdir(parent(p));
    this.nodes.set(p, { kind: 'file', f });
  }
  text(path: string, s: string, exec = false, size?: number) {
    this.put(path, plain(s, exec, size));
  }
  // removes a file or a whole tree
  remove(path: string) {
    const p = normalize(path);
    for (const k of [...this.nodes.keys()]) if (k === p || k.startsWith(`${p}/`)) this.nodes.delete(k);
  }
  isDir(p: string) {
    return this.nodes.get(p)?.kind === 'dir';
  }
  exists(p: string) {
    return this.nodes.has(p);
  }
  file(p: string): VFile | undefined {
    const n = this.nodes.get(p);
    return n?.kind === 'file' ? n.f : undefined;
  }
  parentExists(p: string) {
    return this.isDir(parent(p));
  }
  // the names in a directory, sorted (directories get no marker)
  list(dir: string): string[] {
    const pre = dir === '/' ? '/' : `${dir}/`;
    const names = new Set<string>();
    for (const k of this.nodes.keys()) {
      if (k === dir || !k.startsWith(pre)) continue;
      const rest = k.slice(pre.length);
      if (rest && !rest.includes('/')) names.add(rest);
    }
    return [...names].sort();
  }
}
