// "Build it in Vivado": the box in every lesson that turns the lesson's code into a real Vivado project on the
// learner's computer. Three levels, best first:
//   1. the FPGA Lab helper is running (src/synth/helper.ts): the site writes the project into the helper's folder
//      and runs Vivado itself; the log streams into the box and the Tcl Console
//   2. a Chromium browser on a desktop: the site writes the unzipped project into a folder the learner picks, and
//      they double-click build.bat in it
//   3. anything else: the .zip download (also build.bat inside)
import { icon } from './icons';
import { helper, helperZip, phaseOf, type HelperStatus, type Phase } from '../synth/helper';
import { canPickFolder, pickFolder, savedFolder, writeFiles } from '../util/fsdir';

type L = 'fa' | 'en';
type Level = 'info' | 'warning' | 'error' | 'cmd' | 'ok' | 'plain';

export interface VivadoDeps {
  lang(): L;
  // the current lesson's project: its folder name, files ("<dir>/<path>"), the zip and the board
  project(): { dir: string; files: { name: string; data: string }[]; zip: Uint8Array; board: string; canProgram: boolean };
  log(text: string, level?: Level): void;
  download(name: string, data: Uint8Array, type: string): void;
  get(k: string): string | null;
  set(k: string, v: string): void;
}

const T = {
  fa: {
    head: 'ساخت روی برد واقعی با Vivado',
    lead: (b: string) => `کد همین درس را به یک پروژه‌ی کامل Vivado روی کامپیوتر خودتان تبدیل کنید و بیت‌استریم ${b} را بسازید.`,
    folder: 'پوشه‌ی پروژه‌ها',
    noFolder: 'هنوز انتخاب نشده',
    choose: 'انتخاب پوشه',
    change: 'تغییر پوشه',
    build: 'ساخت در Vivado',
    save: 'ذخیره‌ی پروژه در پوشه',
    zipOnly: 'دانلود پروژه (zip)',
    zip: 'دانلود zip',
    program: 'برنامه‌ریزی برد',
    stop: 'توقف',
    gui: 'باز کردن در Vivado',
    open: 'باز کردن پوشه',
    phases: { project: 'پروژه', synth: 'سنتز', impl: 'پیاده‌سازی و بیت‌استریم', done: 'آماده' } as Record<Phase, string>,
    autoOn: (v: string) => `ساخت خودکار روشن است${v ? ` (Vivado ${v})` : ''}`,
    autoOff: 'ساخت خودکار خاموش است: بعد از ذخیره، روی build.bat دوبار کلیک کنید.',
    setup: 'راه‌اندازی ساخت خودکار',
    saved: (f: string, d: string) => `پروژه در ${iso(`${f}/${d}`)} ذخیره شد. برای ساخت، در آن پوشه روی build.bat (ویندوز) دوبار کلیک کنید یا sh build.sh را اجرا کنید.`,
    zipped: (d: string) => `${iso(`${d}.zip`)} دانلود شد. آن را باز کنید و روی build.bat (ویندوز) دوبار کلیک کنید یا sh build.sh را اجرا کنید.`,
    noFs: 'این مرورگر نمی‌تواند مستقیم در پوشه بنویسد (Chrome یا Edge روی کامپیوتر می‌تواند)، پس پروژه به صورت zip دانلود می‌شود.',
    running: (d: string) => `Vivado در حال ساخت ${iso(d)} است. چند دقیقه طول می‌کشد.`,
    programming: 'در حال برنامه‌ریزی برد…',
    ok: (d: string) => `ساخت ${iso(d)} تمام شد.`,
    okZynq: 'بیت‌استریم و system.xsa آماده‌اند. مرحله‌ی بعد (Vitis و BOOT.bin) در README.txt پروژه است.',
    okProg: 'برد برنامه‌ریزی شد.',
    fail: (c: number | null) => `کار Vivado با خطا تمام شد${c != null ? ` (کد ${c})` : ''}. خطوط ERROR بالا را ببینید.`,
    stopped: 'متوقف شد.',
    lost: 'ارتباط با helper قطع شد. پنجره‌ی آن هنوز باز است؟',
    busy: 'Vivado مشغول کار دیگری است.',
    perm: 'اجازه‌ی نوشتن در پوشه داده نشد.',
    // the set-up dialog
    dlgHead: 'ساخت خودکار با یک کلیک',
    dlgWhy: 'صفحه‌ی وب به‌تنهایی نمی‌تواند برنامه‌ای مثل Vivado را روی کامپیوتر شما اجرا کند؛ این محدودیت امنیتی همه‌ی مرورگرهاست. برای همین یک برنامه‌ی کوچک به اسم <b>FPGA Lab helper</b> هست که یک بار دانلودش می‌کنید. با Tcl خود Vivado کار می‌کند، پس نصب چیز دیگری لازم نیست.',
    dlgSteps: [
      'helper را دانلود و جایی با مسیر ساده باز کنید، مثلا <code dir="ltr">C:\\fpga\\helper</code> (مسیر پرانتز نداشته باشد).',
      'ویندوز: روی <code>start-helper.bat</code> دوبار کلیک کنید. لینوکس و مک: <code dir="ltr">sh start-helper.sh</code>. پنجره‌ای باز می‌شود؛ تا وقتی کار می‌کنید بازش بگذارید.',
      '«اتصال» را بزنید. اگر مرورگر پرسید این سایت به برنامه‌های این دستگاه دسترسی داشته باشد، اجازه دهید.',
    ],
    dlgSafe: 'helper فقط روی همین کامپیوتر (127.0.0.1) در دسترس است، فقط به این سایت جواب می‌دهد، فقط در پوشه‌ای که خودتان انتخاب می‌کنید می‌نویسد و فقط Vivado را روی اسکریپت‌های پروژه اجرا می‌کند. با بستن پنجره‌اش متوقف می‌شود.',
    dlgNo: 'بدون helper هم می‌شود: پروژه را در پوشه ذخیره کنید و روی build.bat دوبار کلیک کنید.',
    getHelper: 'دانلود helper',
    connect: 'اتصال',
    connecting: 'در حال اتصال…',
    connected: (v: string, r: string) => `وصل شد${v ? `: Vivado ${v}` : ''}. پوشه‌ی پروژه‌ها: ${iso(r)}`,
    notFound: 'helper پیدا نشد. پنجره‌ی start-helper باز است و نوشته «is running»؟ اگر مرورگر اجازه خواست، اجازه دادید؟',
    close: 'بستن',
  },
  en: {
    head: 'Build it on a real board with Vivado',
    lead: (b: string) => `Turn this lesson's code into a complete Vivado project on your own computer and build the bitstream for the ${b}.`,
    folder: 'Projects folder',
    noFolder: 'not chosen yet',
    choose: 'Choose folder',
    change: 'Change folder',
    build: 'Build in Vivado',
    save: 'Save project to folder',
    zipOnly: 'Download project (.zip)',
    zip: 'Download .zip',
    program: 'Program the board',
    stop: 'Stop',
    gui: 'Open in Vivado',
    open: 'Open folder',
    phases: { project: 'Project', synth: 'Synthesis', impl: 'Implementation and bitstream', done: 'Ready' } as Record<Phase, string>,
    autoOn: (v: string) => `Automatic build is on${v ? ` (Vivado ${v})` : ''}`,
    autoOff: 'Automatic build is off: after saving, double-click build.bat.',
    setup: 'Set up automatic build',
    saved: (f: string, d: string) => `Saved to ${f}/${d}. To build, double-click build.bat in that folder (Windows) or run sh build.sh.`,
    zipped: (d: string) => `${d}.zip downloaded. Unzip it and double-click build.bat (Windows) or run sh build.sh.`,
    noFs: 'This browser cannot write into a folder (Chrome or Edge on a computer can), so the project downloads as a .zip.',
    running: (d: string) => `Vivado is building ${d}. This takes a few minutes.`,
    programming: 'Programming the board…',
    ok: (d: string) => `${d} is built.`,
    okZynq: 'The bitstream and system.xsa are ready. The next steps (Vitis and BOOT.bin) are in the project\'s README.txt.',
    okProg: 'The board is programmed.',
    fail: (c: number | null) => `Vivado stopped with an error${c != null ? ` (exit code ${c})` : ''}. See the ERROR lines above.`,
    stopped: 'Stopped.',
    lost: 'Lost the connection to the helper. Is its window still open?',
    busy: 'Vivado is busy with another job.',
    perm: 'The browser was not allowed to write to the folder.',
    dlgHead: 'One-click builds',
    dlgWhy: 'A web page cannot start a program such as Vivado on your computer by itself: every browser blocks that for safety. So there is a small program, the <b>FPGA Lab helper</b>, that you download once. It runs on the Tcl inside Vivado, so there is nothing else to install.',
    dlgSteps: [
      'Download the helper and unzip it to a plain path, for example <code>C:\\fpga\\helper</code> (no parentheses in the path).',
      'Windows: double-click <code>start-helper.bat</code>. Linux and macOS: <code>sh start-helper.sh</code>. A window opens; keep it open while you work.',
      'Press Connect. If the browser asks whether this site may reach apps on this device, allow it.',
    ],
    dlgSafe: 'The helper is reachable from this computer only (127.0.0.1), answers this website only, writes only into the folder you choose and only runs Vivado on the project\'s scripts. Closing its window stops it.',
    dlgNo: 'It works without the helper too: save the project to a folder and double-click build.bat.',
    getHelper: 'Download the helper',
    connect: 'Connect',
    connecting: 'Connecting…',
    connected: (v: string, r: string) => `Connected${v ? `: Vivado ${v}` : ''}. Projects folder: ${r}`,
    notFound: 'The helper did not answer. Is the start-helper window open and does it say "is running"? If the browser asked for permission, did you allow it?',
    close: 'Close',
  },
};

// keeps a path or a name in a Persian sentence in one piece (Unicode first-strong isolate)
const iso = (s: string) => `\u2068${s}\u2069`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const PHASES: Phase[] = ['project', 'synth', 'impl', 'done'];

interface Job {
  id: number;
  what: 'build' | 'program';
  dir: string;
  from: number;
  phase: Phase;
  done: boolean;
  code: number | null;
  stopped?: boolean;
}

export function createVivado(d: VivadoDeps) {
  let status: HelperStatus | null = null;
  let probed = false;
  let folder: string | null = null; // the File System Access folder's name
  let job: Job | null = null;
  let tail: string[] = [];
  let note: { text: string; level: 'ok' | 'err' | 'info' } | null = null;
  let dlgNote: { text: string; level: 'ok' | 'err' | 'info' } | null = null;
  let poll = 0;
  let pending = false; // writing the files or starting Vivado

  const t = () => T[d.lang()];
  const wanted = () => d.get('helper') === '1';

  function card(): string {
    return `<section class="vv-card" id="sec-vivado" aria-labelledby="vv-h"><h2 id="vv-h">${icon('cpu', 18)}${t().head}</h2><div id="vv-body">${body()}</div></section>`;
  }

  function body(): string {
    const x = t();
    const p = d.project();
    const fs = canPickFolder();
    const running = pending || (!!job && !job.done);
    const where = status ? status.root : folder;
    const btn = (act: string, label: string, ic: Parameters<typeof icon>[0], cls = '', dis = false) =>
      `<button type="button" class="vv-btn ${cls}" data-act="${act}"${dis ? ' disabled' : ''}>${icon(ic, 14)}<span>${label}</span></button>`;
    const main = status ? x.build : fs ? x.save : x.zipOnly;
    const folderRow =
      status || fs
        ? `<div class="vv-folder"><span class="vv-k">${x.folder}</span><code dir="ltr" class="${where ? '' : 'dim'}">${where ? esc(where) : x.noFolder}</code>${btn('vv-pick', where ? x.change : x.choose, 'file', 'ghost', running)}</div>`
        : `<p class="vv-note info">${x.noFs}</p>`;
    const actions = [
      btn('vv-build', main, status ? 'play' : 'download', 'primary', running),
      job && !job.done ? btn('vv-stop', x.stop, 'stop', 'ghost') : '',
      status && p.canProgram ? btn('vv-program', x.program, 'zap', '', running) : '',
    ].join('');
    const link = (act: string, label: string, ic: Parameters<typeof icon>[0]) =>
      `<button type="button" class="link-btn" data-act="${act}">${icon(ic, 13)}${label}</button>`;
    const more = [
      status ? link('vv-gui', x.gui, 'external') : '',
      status ? link('vv-open', x.open, 'file') : '',
      status || fs ? link('vv-zip', x.zip, 'download') : '',
    ].join('');
    const phases =
      job && job.what === 'build'
        ? `<ol class="vv-phases" aria-label="${x.head}">${PHASES.map((ph) => {
            const i = PHASES.indexOf(ph);
            const cur = PHASES.indexOf(job!.phase);
            const st = job!.done && job!.code !== 0 ? (i === cur ? 'err' : i < cur ? 'done' : '') : i < cur || (ph === 'done' && job!.phase === 'done') ? 'done' : i === cur ? 'now' : '';
            return `<li class="${st}"><i></i>${x.phases[ph]}</li>`;
          }).join('')}</ol>`
        : '';
    const log = tail.length ? `<pre class="vv-log" dir="ltr" tabindex="0">${tail.map((l) => `<span class="${lineClass(l)}">${esc(l)}</span>`).join('\n')}</pre>` : '';
    const auto = status
      ? `<p class="vv-auto on"><i></i>${x.autoOn(status.vivado)}</p>`
      : `<p class="vv-auto"><i></i>${x.autoOff} <button type="button" class="link-btn" data-act="vv-setup">${x.setup}</button></p>`;
    return `<p class="vv-lead">${x.lead(`<bdi dir="ltr">${esc(p.board)}</bdi>`)}</p>${folderRow}<div class="vv-actions">${actions}</div>${more ? `<div class="vv-more">${more}</div>` : ''}${phases}${note ? `<p class="vv-note ${note.level}" role="status">${esc(note.text)}</p>` : ''}${log}${auto}`;
  }

  const lineClass = (l: string) => (/^ERROR|^CRITICAL WARNING/.test(l) ? 'e' : /^WARNING/.test(l) ? 'w' : /^#/.test(l) ? 'c' : /^(Bitstream|XSA):|^Programmed /.test(l) ? 'o' : '');

  function update() {
    const el = document.getElementById('vv-body');
    if (el) el.innerHTML = body();
    const pre = el?.querySelector('.vv-log');
    if (pre) pre.scrollTop = pre.scrollHeight;
    const dlg = document.getElementById('vv-dlg') as HTMLDialogElement | null;
    if (dlg?.open) dlg.innerHTML = dialog();
  }

  async function probe() {
    status = await helper.status();
    probed = true;
    update();
    return status;
  }

  // after the lesson is drawn: find the helper (only if the learner set it up: probing would otherwise make Chrome
  // ask about local network access on every lesson) and the remembered folder
  async function mount() {
    if (!folder) folder = (await savedFolder())?.name ?? null;
    if (wanted() && !probed) await probe();
    else update();
  }

  function addLines(lines: string[]) {
    for (const l of lines) {
      d.log(l, lineClass(l) === 'e' ? 'error' : lineClass(l) === 'w' ? 'warning' : lineClass(l) === 'o' ? 'ok' : 'plain');
      if (job) job.phase = phaseOf(l, job.phase);
    }
    tail = [...tail, ...lines].slice(-200);
  }

  async function follow() {
    if (!job || job.done) return;
    try {
      const r = await helper.log(job.id, job.from);
      addLines(r.lines);
      job.from = r.next;
      if (r.done) {
        job.done = true;
        job.code = r.code;
        const x = t();
        if (job.stopped) note = { text: x.stopped, level: 'info' };
        else if (r.code === 0) {
          if (job.what === 'build') job.phase = 'done';
          note = { text: job.what === 'program' ? x.okProg : d.project().canProgram ? x.ok(job.dir) : `${x.ok(job.dir)} ${x.okZynq}`, level: 'ok' };
        } else note = { text: x.fail(r.code), level: 'err' };
        d.log(`# ${job.what} ${job.dir}: ${r.code === 0 ? 'done' : `exit code ${r.code}`}`, r.code === 0 ? 'ok' : 'error');
      }
    } catch {
      job.done = true;
      note = { text: t().lost, level: 'err' };
      status = null;
    }
    update();
    if (job && !job.done) poll = window.setTimeout(follow, 800);
  }

  async function run(what: 'build' | 'program') {
    const p = d.project();
    const x = t();
    if (!status) await probe();
    if (!status) return;
    pending = true;
    try {
      if (what === 'build') {
        tail = [];
        note = { text: x.running(p.dir), level: 'info' };
        update();
        await helper.write(p.dir, p.files);
      } else note = { text: x.programming, level: 'info' };
      const r = await helper.start(p.dir, what);
      d.log(`# ${what === 'build' ? 'build_project' : 'program_board'} ${r.path}`, 'cmd');
      job = { id: r.job, what, dir: p.dir, from: 0, phase: 'project', done: false, code: null };
      pending = false;
      clearTimeout(poll);
      follow();
    } catch (e) {
      const m = (e as Error).message;
      note = { text: /already running/.test(m) ? x.busy : m, level: 'err' };
      if (/fetch|network/i.test(m)) status = null;
    }
    pending = false;
    update();
  }

  async function save() {
    const p = d.project();
    const x = t();
   
    if (!canPickFolder()) {
      d.download(`${p.dir}.zip`, p.zip, 'application/zip');
      note = { text: x.zipped(p.dir), level: 'ok' };
      update();
      return;
    }
    try {
      folder = await writeFiles(p.files);
      note = { text: x.saved(folder, p.dir), level: 'ok' };
      d.log(`# write_project ${folder}/${p.dir}`, 'cmd');
    } catch (e) {
      const err = e as Error;
      if (err.name === 'AbortError') return; // the learner closed the folder picker
      note = { text: err.message === 'permission' ? x.perm : err.message, level: 'err' };
    }
    update();
  }

  function dialog(): string {
    const x = t();
    const lang = d.lang();
    return `<form method="dialog" dir="${lang === 'fa' ? 'rtl' : 'ltr'}" lang="${lang}"><h2>${x.dlgHead}</h2><p>${x.dlgWhy}</p>
<ol class="vv-steps">${x.dlgSteps.map((s) => `<li>${s}</li>`).join('')}</ol>
<div class="vv-actions"><button type="button" class="vv-btn" data-act="vv-helper-zip">${icon('download', 14)}<span>${x.getHelper}</span></button><button type="button" class="vv-btn primary" data-act="vv-connect">${icon('plug', 14)}<span>${x.connect}</span></button></div>
${dlgNote ? `<p class="vv-note ${dlgNote.level}" role="status">${esc(dlgNote.text)}</p>` : ''}
<p class="dim small">${x.dlgSafe}</p><p class="dim small">${x.dlgNo}</p>
<button>${x.close}</button></form>`;
  }

  function openDialog() {
    let dlg = document.getElementById('vv-dlg') as HTMLDialogElement | null;
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'vv-dlg';
      dlg.className = 'help-dlg vv-dlg';
      document.body.appendChild(dlg);
    }
    dlgNote = status ? { text: t().connected(status.vivado, status.root), level: 'ok' } : null;
    dlg.innerHTML = dialog();
    dlg.showModal();
  }

  async function act(name: string): Promise<boolean> {
    const x = t();
    switch (name) {
      case 'vv-build':
        if (status || (wanted() && (await probe()))) await run('build');
        else await save();
        return true;
      case 'vv-program':
        await run('program');
        return true;
      case 'vv-stop':
        if (job && !job.done) {
          job.stopped = true;
          await helper.stop(job.id).catch(() => {});
        }
        return true;
      case 'vv-pick':
        try {
          if (status) {
            const r = await helper.pick();
            if (r.picked) status = { ...status, root: r.root };
          } else {
            folder = (await pickFolder()).name;
          }
          note = null;
        } catch (e) {
          if ((e as Error).name !== 'AbortError') note = { text: (e as Error).message, level: 'err' };
        }
        update();
        return true;
      case 'vv-zip': {
        const p = d.project();
        d.download(`${p.dir}.zip`, p.zip, 'application/zip');
        note = { text: x.zipped(p.dir), level: 'ok' };
        update();
        return true;
      }
      case 'vv-gui':
      case 'vv-open':
        try {
          const dir = d.project().dir;
          await (name === 'vv-gui' ? helper.gui(dir) : helper.open(dir));
        } catch (e) {
          note = { text: (e as Error).message, level: 'err' };
          update();
        }
        return true;
      case 'vv-setup':
        openDialog();
        return true;
      case 'vv-helper-zip':
        d.download('fpgalab-helper.zip', helperZip([location.origin]), 'application/zip');
        return true;
      case 'vv-connect':
        dlgNote = { text: x.connecting, level: 'info' };
        update();
        d.set('helper', '1');
        await probe();
        dlgNote = status ? { text: x.connected(status.vivado, status.root), level: 'ok' } : { text: x.notFound, level: 'err' };
        if (status) note = null;
        update();
        return true;
    }
    return false;
  }

  return { card, mount, act, update };
}
