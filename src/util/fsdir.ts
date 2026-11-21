// Writing a project straight into a folder on the learner's computer with the File System Access API (Chrome, Edge
// and other Chromium browsers on desktop). The chosen folder is remembered in IndexedDB, so the next lesson writes
// next to the last one; the browser asks again for permission after a restart.

interface DirHandle {
  name: string;
  kind: 'directory';
  getDirectoryHandle(name: string, o?: { create?: boolean }): Promise<DirHandle>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<{ createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void> }> }>;
  queryPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
}
type Picker = (o?: { id?: string; mode?: 'readwrite'; startIn?: string }) => Promise<DirHandle>;

export const canPickFolder = () => typeof window !== 'undefined' && typeof (window as unknown as { showDirectoryPicker?: Picker }).showDirectoryPicker === 'function';

const DB = 'fpgalab-fs';
function idb<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return new Promise((res) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => open.result.createObjectStore('h');
      open.onerror = () => res(undefined);
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction('h', mode);
          const r = f(tx.objectStore('h'));
          r.onsuccess = () => res(r.result);
          r.onerror = () => res(undefined);
        } catch {
          res(undefined);
        }
      };
    } catch {
      res(undefined);
    }
  });
}

let current: DirHandle | null = null;

// the remembered folder (without asking for permission), or null
export async function savedFolder(): Promise<DirHandle | null> {
  if (current) return current;
  if (!canPickFolder()) return null;
  current = ((await idb('readonly', (s) => s.get('root'))) as DirHandle | undefined) ?? null;
  return current;
}

export async function pickFolder(): Promise<DirHandle> {
  current = await (window as unknown as { showDirectoryPicker: Picker }).showDirectoryPicker({ id: 'fpgalab-projects', mode: 'readwrite', startIn: 'documents' });
  await idb('readwrite', (s) => s.put(current, 'root'));
  return current;
}

// must run inside a click (the browser may show its permission prompt)
async function writable(h: DirHandle): Promise<boolean> {
  if (!h.queryPermission) return true;
  if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return (await h.requestPermission?.({ mode: 'readwrite' })) === 'granted';
}

// writes "<dir>/<path>" entries under the folder; returns the folder's name
export async function writeFiles(files: { name: string; data: string }[]): Promise<string> {
  const root = (await savedFolder()) ?? (await pickFolder());
  if (!(await writable(root))) throw new Error('permission');
  // folders once each, then all the files at the same time
  const dirs = new Map<string, Promise<DirHandle>>([['', Promise.resolve(root)]]);
  const dirOf = (path: string): Promise<DirHandle> => {
    let p = dirs.get(path);
    if (!p) {
      const i = path.lastIndexOf('/');
      p = dirOf(i < 0 ? '' : path.slice(0, i)).then((d) => d.getDirectoryHandle(path.slice(i + 1), { create: true }));
      dirs.set(path, p);
    }
    return p;
  };
  await Promise.all(
    files.map(async (f) => {
      const i = f.name.lastIndexOf('/');
      const d = await dirOf(i < 0 ? '' : f.name.slice(0, i));
      const w = await (await d.getFileHandle(f.name.slice(i + 1), { create: true })).createWritable();
      await w.write(f.data);
      await w.close();
    }),
  );
  return root.name;
}
