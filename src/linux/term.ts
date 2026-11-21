// The simulated terminal of the chapter "Linux on Zynq": a card in the lesson with two consoles, the board's serial
// port (J7, 115200 8N1) and a PC on the network cable, over the ZynqSim model (src/linux/sim.ts). The LEDs it drives
// show on the 3D board, and the 3D board's keys are what the AXI GPIO reads. The task list below the screen ticks off
// what the lesson asks for; ticked tasks are kept as a bitmask in lxterm:<lesson>.
import { icon } from '../ui/icons';
import { SCENARIOS, type Scenario } from './scenarios';
import { ZynqSim, type Con, type Out } from './sim';

type L = 'fa' | 'en';
export interface TermDeps {
  lang(): L;
  // the LEDs to show on the 3D board ([LED_R, LED_G, LED1, LED2, LED3]); null = give the board back to the simulator
  setLeds(leds: number[] | null): void;
  pressed(name: string): boolean;
  get(k: string): string | null;
  set(k: string, v: string): void;
}

const T = {
  fa: {
    head: 'ترمینال شبیه‌سازی‌شده',
    lead: 'دستورها را اینجا تمرین کنید، قبل از اینکه روی برد واقعی بروید. LEDها و کلیدهای برد سه‌بعدی به همین ترمینال وصل‌اند.',
    serial: 'سریال (J7)',
    pc: 'PC (شبکه)',
    power: 'روشن/خاموش',
    ctrlc: 'Ctrl+C',
    clear: 'پاک کردن',
    restart: 'شروع دوباره',
    tasks: 'کارهای این درس',
    optional: 'اختیاری',
    done: (n: number, m: number) => `${n} از ${m}`,
    off: 'برد خاموش است. دکمه‌ی ⏻ را بزنید.',
    note: 'شبیه‌سازی است: دستورها و خروجی‌ها از روی ایمیج Buildroot پروژه‌ی blkf2016/ebaz4205 ساخته شده‌اند و برد واقعی جزئیات بیشتری چاپ می‌کند.',
    hint: 'روی صفحه کلیک کنید و بنویسید. help فهرست دستورها را می‌دهد.',
  },
  en: {
    head: 'Simulated terminal',
    lead: 'Practise the commands here before you try them on the real board. The LEDs and keys of the 3D board are wired to this terminal.',
    serial: 'Serial (J7)',
    pc: 'PC (network)',
    power: 'Power',
    ctrlc: 'Ctrl+C',
    clear: 'Clear',
    restart: 'Start over',
    tasks: 'Tasks in this lesson',
    optional: 'optional',
    done: (n: number, m: number) => `${n} of ${m}`,
    off: 'The board is off. Press ⏻.',
    note: 'A simulation: the commands and their output follow the Buildroot image of blkf2016/ebaz4205; a real board prints more detail.',
    hint: 'Click the screen and type. help lists the commands.',
  },
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const MAX_LINES = 600;

// the placeholder a lesson body puts where the terminal goes
export const termSlot = (id: string) => `<div class="lxterm" data-lxterm="${id}"></div>`;

export class LinuxTerm {
  private sim!: ZynqSim;
  private con: Con;
  private lines: Record<Con, Out[]> = { serial: [], pc: [] };
  private hist: Record<Con, string[]> = { serial: [], pc: [] };
  private hpos: Record<Con, number> = { serial: 0, pc: 0 };
  private raf = 0;
  private last = 0;
  private mask: number;
  private screen!: HTMLElement;
  private input!: HTMLInputElement;
  private promptEl!: HTMLElement;
  private dirty: Record<Con, boolean> = { serial: true, pc: true };

  constructor(
    private el: HTMLElement,
    private id: string,
    private sc: Scenario,
    private d: TermDeps,
  ) {
    this.con = sc.con;
    this.mask = Number(d.get(`lxterm:${id}`) ?? 0);
    this.reset();
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  }

  private reset() {
    this.sim = new ZynqSim(this.sc.cfg, { pressed: (n) => this.d.pressed(n) });
    this.sim.onFlag = (f) => this.onFlag(f);
    for (const f of this.sim.flags) this.onFlag(f);
    this.lines = { serial: [], pc: [] };
    this.dirty = { serial: true, pc: true };
  }

  private onFlag(f: string) {
    const i = this.sc.tasks.findIndex((t) => t.flag === f);
    if (i < 0 || this.mask & (1 << i)) return;
    this.mask |= 1 << i;
    this.d.set(`lxterm:${this.id}`, String(this.mask));
    this.renderTasks();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.d.setLeds(null);
  }

  private loop = (t: number) => {
    const dt = this.last ? Math.min(100, t - this.last) : 16;
    this.last = t;
    this.sim.tick(dt);
    for (const c of ['serial', 'pc'] as Con[]) {
      const q = this.sim.out[c];
      if (!q.length) continue;
      for (const o of q) {
        if (o.replace && this.lines[c].length) this.lines[c][this.lines[c].length - 1] = o;
        else this.lines[c].push(o);
      }
      q.length = 0;
      if (this.lines[c].length > MAX_LINES) this.lines[c].splice(0, this.lines[c].length - MAX_LINES);
      this.dirty[c] = true;
    }
    if (this.dirty[this.con]) this.paint();
    this.paintPrompt();
    this.d.setLeds(this.sim.on() ? this.sim.leds() : null);
    this.el.querySelector('.lx-pwr')?.classList.toggle('on', this.sim.on());
    if (this.el.isConnected) this.raf = requestAnimationFrame(this.loop);
    else this.dispose();
  };

  private render() {
    const x = T[this.d.lang()];
    const tab = (c: Con, label: string) =>
      `<button type="button" role="tab" class="lx-tab${c === this.con ? ' active' : ''}" data-lx-con="${c}" aria-selected="${c === this.con}">${icon(c === 'serial' ? 'terminal' : 'monitor', 13)}${label}</button>`;
    this.el.innerHTML = `<h3>${icon('terminal', 16)}${x.head}</h3><p class="lx-lead">${x.lead}</p>
<div class="lx-win" dir="ltr">
  <div class="lx-bar" role="tablist">${tab('serial', x.serial)}${tab('pc', x.pc)}<span class="grow"></span>
    <button type="button" class="lx-btn lx-pwr" data-lx="power" title="${x.power}" aria-label="${x.power}">${icon('power', 14)}</button>
    <button type="button" class="lx-btn" data-lx="ctrlc" title="${x.ctrlc}">^C</button>
    <button type="button" class="lx-btn" data-lx="clear" title="${x.clear}" aria-label="${x.clear}">${icon('reset', 13)}</button>
  </div>
  <div class="lx-screen" tabindex="-1"><pre class="lx-out"></pre><div class="lx-line"><span class="lx-prompt"></span><input class="lx-in" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${x.head}"></div></div>
</div>
<p class="lx-note dim">${x.note} ${x.hint}</p>
<div class="lx-tasks"></div>`;
    this.screen = this.el.querySelector('.lx-screen')!;
    this.input = this.el.querySelector('.lx-in')!;
    this.promptEl = this.el.querySelector('.lx-prompt')!;
    this.el.addEventListener('click', this.onClick);
    this.screen.addEventListener('mouseup', () => {
      if (!window.getSelection()?.toString()) this.input.focus({ preventScroll: true });
    });
    this.input.addEventListener('keydown', this.onKey);
    this.renderTasks();
    this.paint();
  }

  private renderTasks() {
    const box = this.el.querySelector('.lx-tasks');
    if (!box) return;
    const lang = this.d.lang();
    const x = T[lang];
    const req = this.sc.tasks.filter((t) => !t.optional);
    const n = req.filter((t) => this.mask & (1 << this.sc.tasks.indexOf(t))).length;
    box.innerHTML = `<div class="lx-th"><b>${x.tasks}</b><span class="dim">${x.done(n, req.length)}</span><button type="button" class="link-btn" data-lx="restart">${icon('reset', 12)}${x.restart}</button></div><ol>${this.sc.tasks
      .map((t, i) => `<li class="${this.mask & (1 << i) ? 'done' : ''}"><i>${this.mask & (1 << i) ? icon('check', 12) : ''}</i><span>${t[lang]}${t.optional ? ` <em class="dim">(${x.optional})</em>` : ''}</span></li>`)
      .join('')}</ol>`;
  }

  private paint() {
    const out = this.el.querySelector('.lx-out')!;
    const ls = this.lines[this.con];
    out.innerHTML = ls.map((o) => (o.cls ? `<span class="${o.cls}">${esc(o.text)}</span>` : esc(o.text))).join('\n') + (ls.length ? '\n' : '');
    if (this.con === 'serial' && !this.sim.on() && !ls.length) out.innerHTML = `<span class="note">${esc(T[this.d.lang()].off)}</span>\n`;
    this.dirty[this.con] = false;
    this.screen.scrollTop = this.screen.scrollHeight;
  }

  private paintPrompt() {
    const p = this.sim.prompt(this.con);
    if (this.promptEl.textContent !== p) this.promptEl.textContent = p;
    const secret = this.sim.secret(this.con);
    if ((this.input.type === 'password') !== secret) this.input.type = secret ? 'password' : 'text';
    const show = this.sim.ready(this.con) || (this.con === 'serial' && this.sim.board === 'countdown');
    this.el.querySelector('.lx-line')!.classList.toggle('hidden', !show);
  }

  private onClick = (ev: MouseEvent) => {
    const t = ev.target as HTMLElement;
    const tab = t.closest<HTMLElement>('[data-lx-con]');
    if (tab) {
      this.con = tab.dataset.lxCon as Con;
      this.el.querySelectorAll<HTMLElement>('[data-lx-con]').forEach((b) => {
        b.classList.toggle('active', b === tab);
        b.setAttribute('aria-selected', String(b === tab));
      });
      this.paint();
      this.input.focus({ preventScroll: true });
      return;
    }
    const act = t.closest<HTMLElement>('[data-lx]')?.dataset.lx;
    if (act === 'power') {
      this.sim.power(!this.sim.on());
      if (!this.sim.on()) this.sim.out.serial.push({ text: '(power off)', cls: 'note' });
      this.con = 'serial';
      this.el.querySelectorAll<HTMLElement>('[data-lx-con]').forEach((b) => b.classList.toggle('active', b.dataset.lxCon === 'serial'));
      this.lines.serial = [];
      this.paint();
      this.input.focus({ preventScroll: true });
    } else if (act === 'ctrlc') {
      this.sim.interrupt(this.con);
      this.input.focus({ preventScroll: true });
    } else if (act === 'clear') {
      this.lines[this.con] = [];
      this.paint();
      this.input.focus({ preventScroll: true });
    } else if (act === 'restart') {
      this.mask = 0;
      this.d.set(`lxterm:${this.id}`, '0');
      this.reset();
      this.renderTasks();
      this.paint();
    }
  };

  private onKey = (ev: KeyboardEvent) => {
    const c = this.con;
    if (c === 'serial' && this.sim.board === 'countdown') {
      ev.preventDefault();
      this.sim.key();
      return;
    }
    if (ev.key === 'c' && ev.ctrlKey) {
      ev.preventDefault();
      this.sim.interrupt(c);
      this.input.value = '';
      return;
    }
    if (ev.key === 'l' && ev.ctrlKey) {
      ev.preventDefault();
      this.lines[c] = [];
      this.paint();
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      const v = this.input.value;
      this.input.value = '';
      const secret = this.sim.secret(c);
      if (!secret && v.trim()) {
        this.hist[c].push(v);
        this.hpos[c] = this.hist[c].length;
      }
      if (/^\s*(clear|cls)\s*$/.test(v) && !secret && this.sim.ready(c)) {
        this.lines[c] = [];
        this.dirty[c] = true;
      }
      this.sim.enter(c, v);
      return;
    }
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      const h = this.hist[c];
      this.hpos[c] = Math.max(0, Math.min(h.length, this.hpos[c] + (ev.key === 'ArrowUp' ? -1 : 1)));
      this.input.value = h[this.hpos[c]] ?? '';
      return;
    }
    if (ev.key === 'Tab') {
      ev.preventDefault();
      this.complete();
    }
  };

  // Tab: complete the last word from a few command names and the files the lesson hands out
  private complete() {
    const v = this.input.value;
    const m = v.match(/(\S*)$/)!;
    const w = m[1];
    if (!w) return;
    const words = ['fatls', 'fatload', 'ext4ls', 'ext4load', 'bootz', 'printenv', 'setenv', 'devmem', 'insmod', 'rmmod', 'lsmod', 'dmesg', 'reboot', 'scp', 'ssh', '/sys/class/leds/', '/sys/class/fpga_manager/fpga0/', '/sys/bus/platform/devices/41200000.leds/', '/lib/firmware/', '/proc/cmdline', '/boot/', 'brightness', 'trigger', 'root@192.168.100.1', ...SCENARIO_FILES];
    const hit = words.filter((x) => x.startsWith(w) || x.startsWith(w.replace(/^\.\//, '')));
    if (hit.length === 1) this.input.value = v.slice(0, v.length - w.length) + (w.startsWith('./') ? './' : '') + hit[0].replace(/^\.\//, '') + (hit[0].endsWith('/') ? '' : ' ');
  }
}

const SCENARIO_FILES = [...new Set(Object.values(SCENARIOS).flatMap((s) => [...(s.cfg.root ?? []), ...(s.cfg.pc ?? [])]))];

let current: LinuxTerm | null = null;
// mounts the terminal of the rendered lesson, if its body has a slot; disposes of the previous one
export function mountLinuxTerms(root: HTMLElement, d: TermDeps) {
  current?.dispose();
  current = null;
  const slot = root.querySelector<HTMLElement>('[data-lxterm]');
  const sc = slot && SCENARIOS[slot.dataset.lxterm!];
  if (!slot || !sc) return;
  current = new LinuxTerm(slot, slot.dataset.lxterm!, sc, d);
}
