// Serial console: the PC side of the board's USB-UART bridge. It decodes what the design sends on
// UART_RXD_OUT and types bytes into UART_TXD_IN, like a terminal program on a COM port.
import type { BoardDef } from '../boards';
import type { Mapping } from '../boards/mapping';
import type { Runner, SerialFormat } from '../sim/runner';

// Live UART receiver working on line transitions (times in board cycles).
export class UartStream {
  private T = 1;
  private level = 1;
  private start = -1; // time of the start bit being received, or -1 when idle
  private edges: { t: number; lv: number }[] = [];
  onByte: (b: number, error: boolean) => void = () => {};

  constructor(
    private f: SerialFormat,
    private hz: number,
  ) {
    this.setFormat(f);
  }

  setFormat(f: SerialFormat) {
    this.f = f;
    this.T = this.hz / f.baud;
    this.reset();
  }

  reset(level = 1) {
    this.level = level;
    this.start = -1;
    this.edges = [];
  }

  private frameBits() {
    return 1 + this.f.bits + (this.f.parity === 'none' ? 0 : 1) + this.f.stop;
  }

  private levelAt(t: number) {
    let lv = 1;
    for (const e of this.edges) {
      if (e.t > t) break;
      lv = e.lv;
    }
    return lv;
  }

  edge(t: number, lv: number) {
    this.advance(t);
    if (lv === this.level) return;
    this.level = lv;
    if (this.start >= 0) this.edges.push({ t, lv });
    else if (lv === 0) {
      this.start = t;
      this.edges = [{ t, lv }];
    }
  }

  // decode every frame whose last stop bit has been sampled by `now`
  advance(now: number) {
    const T = this.T;
    while (this.start >= 0) {
      const s = this.start;
      const last = s + (this.frameBits() - 0.5) * T; // middle of the last stop bit
      if (now < last) return;
      let cut = last;
      if (this.levelAt(s + T / 2) !== 0) {
        cut = s + T / 2; // glitch, not a start bit
      } else {
        let b = 0;
        let ones = 0;
        for (let k = 0; k < this.f.bits; k++)
          if (this.levelAt(s + (1.5 + k) * T)) {
            b |= 1 << k;
            ones++;
          }
        let p = s + (1.5 + this.f.bits) * T;
        let ok = true;
        if (this.f.parity !== 'none') {
          ok = ((ones + this.levelAt(p)) & 1) === (this.f.parity === 'even' ? 0 : 1);
          p += T;
        }
        for (let k = 0; k < this.f.stop; k++) ok = ok && this.levelAt(p + k * T) === 1;
        this.onByte(b, !ok);
      }
      // look for the next start bit among the transitions already seen
      const next = this.edges.findIndex((e) => e.t > cut && e.lv === 0);
      if (next < 0) {
        this.start = -1;
        this.edges = [];
      } else {
        this.start = this.edges[next].t;
        this.edges = this.edges.slice(next);
      }
    }
  }
}

const FORMATS: Record<string, Omit<SerialFormat, 'baud'>> = {
  '8N1': { bits: 8, parity: 'none', stop: 1 },
  '8E1': { bits: 8, parity: 'even', stop: 1 },
  '8O1': { bits: 8, parity: 'odd', stop: 1 },
  '8N2': { bits: 8, parity: 'none', stop: 2 },
  '7E1': { bits: 7, parity: 'even', stop: 1 },
};
const BAUDS = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
const ENDINGS: Record<string, number[]> = { none: [], cr: [13], lf: [10], crlf: [13, 10] };
const MAX_LOG = 20000;

interface Entry {
  b: number;
  dir: 'rx' | 'tx'; // rx = from the FPGA, tx = typed by the user (local echo)
  err: boolean;
}

export interface SerialSettings {
  baud: number;
  format: string;
  view: 'text' | 'hex';
  ending: string;
  echo: boolean;
}

export class SerialConsole {
  el: HTMLElement;
  private log: Entry[] = [];
  private fresh: Entry[] = [];
  private stream: UartStream;
  private mapping: Mapping | null = null;
  private term: HTMLElement;
  private rxBytes = 0;
  private txBytes = 0;
  private col = 0; // bytes on the current hex line
  private note = '';
  settings: SerialSettings = { baud: 115200, format: '8N1', view: 'text', ending: 'crlf', echo: false };
  onSettings: (s: SerialSettings) => void = () => {};

  constructor(
    parent: HTMLElement,
    board: BoardDef,
    private runner: Runner,
  ) {
    this.stream = new UartStream(this.format(), board.clockHz);
    this.stream.onByte = (b, err) => {
      this.rxBytes++;
      this.push({ b, dir: 'rx', err });
    };
    this.el = document.createElement('div');
    this.el.className = 'la-win serial-win';
    this.el.hidden = true;
    this.el.innerHTML = `
<div class="la-title"><span class="la-ico serial-ico"></span><b>Serial Console</b><span class="dim">USB-UART · receives UART_RXD_OUT (D4) · sends to UART_TXD_IN (C4)</span><span class="grow"></span><button class="la-close" title="Close">✕</button></div>
<div class="la-tools">
  <label>Baud <select data-s="baud">${BAUDS.map((b) => `<option>${b}</option>`).join('')}</select></label>
  <select data-s="format" title="Data bits, parity, stop bits">${Object.keys(FORMATS).map((f) => `<option>${f}</option>`).join('')}</select>
  <span class="sep"></span>
  <label>View <select data-s="view"><option value="text">Text</option><option value="hex">Hex</option></select></label>
  <label>Send with <select data-s="ending"><option value="none">no line ending</option><option value="cr">CR</option><option value="lf">LF</option><option value="crlf">CR+LF</option></select></label>
  <label title="Also show what you type"><input type="checkbox" data-s="echo"> Local echo</label>
  <span class="sep"></span>
  <button data-c="clear">Clear</button>
  <span class="grow"></span>
  <span class="la-meas" data-c="stats"></span>
</div>
<pre class="serial-term" tabindex="0"></pre>
<form class="serial-send"><input placeholder="Type a message and press Enter" autocomplete="off" spellcheck="false"><button type="submit" class="primary">Send</button></form>`;
    parent.appendChild(this.el);
    this.term = this.el.querySelector('.serial-term')!;
    this.wire();
  }

  get open() {
    return !this.el.hidden;
  }

  private format(): SerialFormat {
    return { baud: this.settings.baud, ...FORMATS[this.settings.format] };
  }

  load(s: Partial<SerialSettings>) {
    this.settings = { ...this.settings, ...s };
    this.stream.setFormat(this.format());
    this.syncControls();
  }

  show() {
    this.el.hidden = false;
    this.syncControls();
    this.fresh = []; // render() draws everything received while the window was closed
    this.render();
    this.updateStats();
    (this.el.querySelector('.serial-send input') as HTMLInputElement).focus();
  }

  hide() {
    this.el.hidden = true; // keep listening, so nothing the design sends meanwhile is lost
  }

  setDesign(mapping: Mapping | null) {
    this.mapping = mapping;
    this.stream.reset();
    this.attach();
    this.updateStats();
  }

  private txBinding() {
    return this.mapping?.bindings.find((b) => b.device.kind === 'uart' && b.device.dir === 'out');
  }
  private rxBinding() {
    return this.mapping?.bindings.find((b) => b.device.kind === 'uart' && b.device.dir === 'in');
  }

  private attach() {
    const b = this.txBinding();
    if (!b || !this.runner.sim) {
      this.runner.setProbe('serial', null);
      return;
    }
    const read = () => (this.runner.sim ? (this.runner.sim.v[b.sig] >>> b.bit) & 1 : 1);
    this.stream.reset(read());
    this.runner.setProbe('serial', {
      sigs: [b.sig],
      onSample: (t) => this.stream.edge(t, read()),
      onRestart: () => this.stream.reset(read()),
    });
  }

  frame() {
    this.stream.advance(this.runner.now);
    if (!this.open) return;
    if (this.fresh.length) {
      this.append(this.fresh);
      this.fresh = [];
      this.updateStats();
    }
  }

  private push(e: Entry) {
    this.log.push(e);
    this.fresh.push(e);
    if (this.log.length > MAX_LOG * 1.2) {
      this.log = this.log.slice(-MAX_LOG);
      this.fresh = [];
      this.render();
    }
  }

  private wire() {
    this.el.querySelector('.la-close')!.addEventListener('click', () => this.hide());
    const title = this.el.querySelector('.la-title') as HTMLElement;
    title.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      const r = this.el.getBoundingClientRect();
      const dx = e.clientX - r.left;
      const dy = e.clientY - r.top;
      const move = (ev: PointerEvent) => {
        this.el.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, ev.clientX - dx))}px`;
        this.el.style.top = `${Math.max(0, Math.min(window.innerHeight - 40, ev.clientY - dy))}px`;
        this.el.style.right = 'auto';
        this.el.style.bottom = 'auto';
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    this.el.querySelector('.la-tools')!.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement;
      const k = t.dataset.s as keyof SerialSettings | undefined;
      if (!k) return;
      const s = this.settings as unknown as Record<string, unknown>;
      s[k] = k === 'echo' ? t.checked : k === 'baud' ? +t.value : t.value;
      if (k === 'baud' || k === 'format') this.stream.setFormat(this.format());
      if (k === 'view') this.render();
      this.onSettings(this.settings);
    });
    this.el.querySelector('[data-c="clear"]')!.addEventListener('click', () => {
      this.log = [];
      this.fresh = [];
      this.rxBytes = this.txBytes = 0;
      this.render();
      this.updateStats();
    });
    const form = this.el.querySelector('.serial-send') as HTMLFormElement;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input')!;
      const bytes = this.parse(input.value);
      if (bytes === null) {
        this.flash('Hex view: type bytes like 48 65 6C');
        return;
      }
      if (!bytes.length) return;
      if (!this.runner.sendSerial(bytes, this.format())) {
        this.flash('Run a clocked design first');
        return;
      }
      if (!this.rxBinding()) this.flash('The design has no UART_TXD_IN input, so nothing receives these bytes');
      this.txBytes += bytes.length;
      if (this.settings.echo) bytes.forEach((b) => this.push({ b, dir: 'tx', err: false }));
      input.value = '';
      this.updateStats();
    });
    // typing straight into the terminal sends each key immediately, like a terminal program
    this.term.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      let bytes: number[] | null = null;
      if (e.key === 'Enter') bytes = ENDINGS[this.settings.ending].length ? ENDINGS[this.settings.ending] : [13];
      else if (e.key === 'Backspace') bytes = [8];
      else if (e.key === 'Escape') bytes = [27];
      else if (e.key.length === 1) bytes = [...new TextEncoder().encode(e.key)];
      if (!bytes) return;
      e.preventDefault();
      if (!this.runner.sendSerial(bytes, this.format())) return this.flash('Run a clocked design first');
      this.txBytes += bytes.length;
      if (this.settings.echo) bytes.forEach((b) => this.push({ b, dir: 'tx', err: false }));
      this.updateStats();
    });
  }

  private parse(s: string): number[] | null {
    if (this.settings.view === 'hex') {
      const parts = s.trim().split(/[\s,]+/).filter(Boolean);
      if (parts.some((p) => !/^(0x)?[0-9a-f]{1,2}$/i.test(p))) return null;
      return parts.map((p) => parseInt(p.replace(/^0x/i, ''), 16));
    }
    if (!s) return [];
    return [...new TextEncoder().encode(s), ...ENDINGS[this.settings.ending]];
  }

  private flash(msg: string) {
    this.note = msg;
    this.updateStats();
    setTimeout(() => {
      if (this.note === msg) {
        this.note = '';
        this.updateStats();
      }
    }, 3000);
  }

  private updateStats() {
    const el = this.el.querySelector('[data-c="stats"]') as HTMLElement;
    const warn = !this.mapping ? 'not running' : !this.txBinding() ? 'design does not use UART_RXD_OUT' : '';
    el.textContent = this.note || `${warn ? warn + ' · ' : ''}received ${this.rxBytes} B · sent ${this.txBytes} B`;
    el.classList.toggle('warn', !!(this.note || warn));
  }

  private syncControls() {
    const s = this.settings;
    (this.el.querySelector('[data-s="baud"]') as HTMLSelectElement).value = String(s.baud);
    (this.el.querySelector('[data-s="format"]') as HTMLSelectElement).value = s.format;
    (this.el.querySelector('[data-s="view"]') as HTMLSelectElement).value = s.view;
    (this.el.querySelector('[data-s="ending"]') as HTMLSelectElement).value = s.ending;
    (this.el.querySelector('[data-s="echo"]') as HTMLInputElement).checked = s.echo;
    (this.el.querySelector('.serial-send input') as HTMLInputElement).placeholder =
      s.view === 'hex' ? 'Hex bytes, e.g. 48 65 6C 6C 6F — Enter to send' : 'Type a message and press Enter (or click the terminal and type)';
  }

  private render() {
    this.term.textContent = '';
    this.col = 0;
    this.append(this.log);
  }

  // append entries as spans; consecutive bytes of the same kind share a span
  private append(entries: Entry[]) {
    const atBottom = this.term.scrollTop + this.term.clientHeight >= this.term.scrollHeight - 4;
    const frag = document.createDocumentFragment();
    let span: HTMLSpanElement | null = null;
    let cls = '';
    for (const e of entries) {
      const c = e.err ? 'err' : e.dir;
      if (!span || c !== cls) {
        span = document.createElement('span');
        span.className = c;
        cls = c;
        frag.appendChild(span);
      }
      span.textContent += this.settings.view === 'hex' ? this.hex(e.b) : this.char(e.b, e.err);
    }
    this.term.appendChild(frag);
    if (atBottom) this.term.scrollTop = this.term.scrollHeight;
  }

  private hex(b: number) {
    this.col++;
    const s = b.toString(16).toUpperCase().padStart(2, '0');
    if (this.col >= 16 || b === 10) {
      this.col = 0;
      return s + '\n';
    }
    return s + ' ';
  }

  private char(b: number, err: boolean) {
    if (err) return '�';
    if (b === 10) return '\n';
    if (b === 13 || b === 0) return '';
    if (b === 9) return '\t';
    if (b >= 0x20 && b < 0x7f) return String.fromCharCode(b);
    return `·`;
  }
}
