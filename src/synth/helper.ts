// The FPGA Lab helper (src/helper/fpgalab-helper.tcl): a small HTTP server that runs inside Vivado's own Tcl on the
// learner's computer, so the website can write a project into a folder and run Vivado on it with one click. A web
// page cannot start programs by itself; this is the one-time piece that can. It listens on 127.0.0.1 only and answers
// only the origins baked into it when it is downloaded.
import helperTcl from '../helper/fpgalab-helper.tcl?raw';
import { zip } from '../util/zip';
import { startHelperBat, startHelperSh } from './scripts';

export const HELPER_PORT = 47474;
export const HELPER_URL = `http://127.0.0.1:${HELPER_PORT}`;
// the published site; the page that downloads the helper adds its own origin too
export const SITE_ORIGINS = ['https://learn.shahmohammadi.dev'];

const README = `FPGA Lab helper
===============
Lets the FPGA Lab website build its Vivado projects on this computer: you press "Build in Vivado" on a lesson and
Vivado runs here, with no command to type. It uses the Tcl inside Vivado, so there is nothing else to install.

1. Unzip this folder somewhere with a plain path, for example C:\\fpga\\helper (no parentheses in the path).
2. Windows: double-click start-helper.bat.  Linux / macOS: sh start-helper.sh
   A window opens and says "FPGA Lab helper ... is running". Keep it open while you work.
3. On the website press "Connect". The browser may ask to let the site reach apps on this device: allow it.

What it can do: listen on 127.0.0.1:${HELPER_PORT} (not reachable from other computers), answer only the FPGA Lab
website, write project files into the folder you choose, run Vivado in batch mode on a project's
create_project.tcl or program_board.tcl, and open a project folder or the Vivado GUI. Read fpgalab-helper.tcl to
check. Close the window to stop it.

-------------------------------------------------------------------------------------------------- فارسی
این برنامه‌ی کوچک به سایت FPGA Lab اجازه می‌دهد پروژه‌ی Vivado را روی همین کامپیوتر بسازد: در درس دکمه‌ی
«ساخت در Vivado» را می‌زنید و Vivado همین‌جا اجرا می‌شود، بدون تایپ دستور. با Tcl خود Vivado کار می‌کند و
نصب چیز دیگری لازم نیست.

۱. این پوشه را جایی با مسیر ساده باز کنید، مثلا C:\\fpga\\helper (مسیر پرانتز نداشته باشد).
۲. ویندوز: روی start-helper.bat دوبار کلیک کنید. لینوکس و مک: sh start-helper.sh
   پنجره‌ای باز می‌شود و می‌گوید helper در حال اجراست. تا وقتی کار می‌کنید بازش بگذارید.
۳. در سایت «اتصال» را بزنید. اگر مرورگر پرسید سایت به برنامه‌های این دستگاه دسترسی داشته باشد، اجازه دهید.

فقط روی 127.0.0.1 گوش می‌دهد (از کامپیوترهای دیگر در دسترس نیست)، فقط به سایت FPGA Lab جواب می‌دهد، فایل‌ها را
فقط در پوشه‌ای که خودتان انتخاب می‌کنید می‌نویسد و فقط Vivado را روی اسکریپت‌های پروژه اجرا می‌کند. برای متوقف
کردن، پنجره را ببندید.
`;

export function helperTclFor(origins: string[]): string {
  const list = [...new Set([...SITE_ORIGINS, ...origins])].filter((o) => /^https?:\/\/[\w.:[\]-]+$/.test(o));
  return helperTcl.replace('@ORIGINS@', list.join(' ')).replaceAll('@PORT@', String(HELPER_PORT));
}

export function helperZip(origins: string[]): Uint8Array {
  return zip([
    { name: 'fpgalab-helper/fpgalab-helper.tcl', data: helperTclFor(origins) },
    { name: 'fpgalab-helper/start-helper.bat', data: startHelperBat() },
    { name: 'fpgalab-helper/start-helper.sh', data: startHelperSh() },
    { name: 'fpgalab-helper/README.txt', data: README },
  ]);
}

// ---------------------------------------------------------------- the client
export interface HelperStatus {
  ok: boolean;
  helper: number;
  vivado: string;
  root: string;
  os: 'windows' | 'mac' | 'linux';
  busy: boolean;
}
export interface JobLog {
  lines: string[];
  next: number;
  done: boolean;
  code: number | null;
}

async function call<T>(method: 'GET' | 'POST', path: string, q: Record<string, string> = {}, body?: string, timeout = 0): Promise<T> {
  const qs = new URLSearchParams(q).toString();
  const r = await fetch(`${HELPER_URL}${path}${qs ? `?${qs}` : ''}`, {
    method,
    // text/plain keeps a POST a "simple" request (no preflight); the helper checks the Origin itself
    headers: body === undefined ? undefined : { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
    cache: 'no-store',
    signal: timeout ? AbortSignal.timeout(timeout) : undefined,
  });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export const helper = {
  // null when the helper is not running (or the browser did not allow the page to reach it)
  async status(): Promise<HelperStatus | null> {
    try {
      return await call<HelperStatus>('GET', '/status', {}, undefined, 2500);
    } catch {
      return null;
    }
  },
  pick: () => call<{ ok: boolean; picked: boolean; root: string }>('POST', '/pick'),
  async write(dir: string, files: { name: string; data: string }[]) {
    // names come as "<dir>/<path>" from projectFiles
    for (const f of files) await call('POST', '/file', { dir, path: f.name.slice(f.name.indexOf('/') + 1) }, f.data);
  },
  start: (dir: string, what: 'build' | 'program') => call<{ ok: boolean; job: number; path: string }>('POST', '/build', { dir, what }),
  log: (job: number, from: number) => call<JobLog>('GET', '/log', { job: String(job), from: String(from) }),
  stop: (job: number) => call('POST', '/stop', { job: String(job) }),
  open: (dir: string) => call('POST', '/open', { dir }),
  gui: (dir: string) => call('POST', '/gui', { dir }),
};

// the build's progress from Vivado's own log lines; it only moves forward
export type Phase = 'project' | 'synth' | 'impl' | 'done';
const ORDER: Phase[] = ['project', 'synth', 'impl', 'done'];
export function phaseOf(line: string, cur: Phase): Phase {
  const p: Phase = /^(Bitstream|XSA):|^Programmed /.test(line) ? 'done' : /\bimpl_1\b/.test(line) ? 'impl' : /\bsynth_1\b|synth_design/.test(line) ? 'synth' : 'project';
  return ORDER.indexOf(p) > ORDER.indexOf(cur) ? p : cur;
}
