// The logic-analyzer window: a virtual bench instrument (in the spirit of a USB logic analyzer and its PC software)
// whose probes clip onto the board's header pins, on-board devices or internal design signals.
import { deviceLabel, isBoardInput, type BoardDef, type BoardView } from '../boards';
import type { Mapping } from '../boards/mapping';
import type { Design } from '../hdl';
import type { Runner } from '../sim/runner';
import { Acquisition, type Edge, type Source, type Trace } from './capture';
import { decodeBus, decodeI2c, decodePs2, decodeSpi, decodeUart, type Ann } from './decode';

export interface ChanCfg {
  name: string;
  probe: string; // 'pin:<package pin>' | 'sig:<signal name>:<bit>' | ''
}

export type DecCfg =
  | { type: 'uart'; name: string; ch: number; baud: number; bits: number; parity: 'none' | 'even' | 'odd'; stop: 1 | 2 }
  | { type: 'spi'; name: string; clk: number; mosi: number; miso: number | null; cs: number | null; mode: 0 | 1 | 2 | 3; bits: number; msbFirst: boolean }
  | { type: 'i2c'; name: string; scl: number; sda: number }
  | { type: 'ps2'; name: string; clk: number; data: number }
  | { type: 'bus'; name: string; chans: number[] };

export interface LaConfig {
  chans: ChanCfg[];
  decs: DecCfg[];
  base: number; // seconds per division
  pos: number; // window centre relative to the trigger, in divisions
  trig: { ch: number; edge: Edge } | null;
}

const MAX_CH = 32;
const COLORS = ['#f5c542', '#5ad1f0', '#f07ad1', '#7af07e', '#f0925a', '#a88cf5', '#f05a6e', '#5af0c3', '#e6f05a', '#5a8df0', '#f0b35a', '#c3f05a'];
const color = (i: number) => COLORS[i % COLORS.length];
const BASES = [1e-7, 2e-7, 5e-7, 1e-6, 2e-6, 5e-6, 1e-5, 2e-5, 5e-5, 1e-4, 2e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2, 5e-2, 0.1, 0.2, 0.5, 1];
const AXIS_H = 22;
const CH_H = 24;
const DEC_H = 26;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function fmtTime(s: number): string {
  const a = Math.abs(s);
  const [d, u] = a === 0 ? [1, 's'] : a < 1e-6 ? [1e-9, 'ns'] : a < 1e-3 ? [1e-6, 'µs'] : a < 1 ? [1e-3, 'ms'] : [1, 's'];
  const v = s / d;
  return `${+v.toFixed(Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2)} ${u}`;
}
const fmtHz = (f: number) => (f >= 1e6 ? `${+(f / 1e6).toFixed(3)} MHz` : f >= 1e3 ? `${+(f / 1e3).toFixed(3)} kHz` : `${+f.toFixed(2)} Hz`);

export function defaultConfig(board: BoardDef): LaConfig {
  const ja = board.headers[0];
  const chans = ja ? Object.values(ja.pins).map((p, i) => ({ name: `DIO ${i}`, probe: `pin:${p}` })) : [];
  return { chans, decs: [], base: 1e-3, pos: 0, trig: null };
}

export class LogicAnalyzer {
  el: HTMLElement;
  private acq = new Acquisition();
  private cfg: LaConfig;
  private design: Design | null = null;
  private mapping: Mapping | null = null;
  private srcs: (Source | null)[] = [];
  private canvas: HTMLCanvasElement;
  private side: HTMLElement;
  private events: HTMLElement;
  private dirty = true;
  private hoverX: number | null = null;
  private cursors: [number | null, number | null] = [null, null];
  private drag: { x: number; pos: number } | null = null;
  onChange: (cfg: LaConfig) => void = () => {};

  constructor(
    parent: HTMLElement,
    private board: BoardDef,
    private view: BoardView,
    private runner: Runner,
  ) {
    this.cfg = defaultConfig(board);
    this.el = document.createElement('div');
    this.el.className = 'la-win';
    this.el.hidden = true;
    this.el.innerHTML = `
<div class="la-title"><span class="la-ico"></span><b>Logic Analyzer</b><span class="dim">virtual USB logic analyzer · up to ${MAX_CH} channels · 1 sample per board clock (${board.clockHz / 1e6} MS/s)</span><span class="grow"></span><button class="la-close" title="Close">✕</button></div>
<div class="la-tools">
  <button data-la="single" title="Capture once">Single</button><button data-la="run" class="primary" title="Capture repeatedly">Run</button><button data-la="stop">Stop</button>
  <span class="la-state" id="la-state">Stopped</span>
  <span class="sep"></span>
  <label>Trigger <select id="la-trig"></select></label>
  <select id="la-edge"><option value="rise">↑ Rise</option><option value="fall">↓ Fall</option><option value="either">↕ Either</option></select>
  <span class="sep"></span>
  <label>Base <select id="la-base">${BASES.map((b) => `<option value="${b}">${fmtTime(b)}/div</option>`).join('')}</select></label>
  <label>Position <span id="la-pos"></span></label><button data-la="center" title="Trigger at centre">⊙</button>
  <span class="sep"></span>
  <div class="la-add"><button data-la="add">＋ Add ▾</button><div class="la-menu" hidden>
    <button data-add="signal">Signal</button><button data-add="bus">Bus</button><hr/>
    <button data-add="uart">UART decoder</button><button data-add="spi">SPI decoder</button><button data-add="i2c">I²C decoder</button><button data-add="ps2">PS/2 decoder</button><hr/>
    <button data-add="outputs">Probe all design outputs</button><button data-add="preset">Load lesson setup</button><button data-add="clear">Remove all</button>
  </div></div>
  <span class="grow"></span>
  <span class="la-meas" id="la-meas"></span>
</div>
<div class="la-main"><div class="la-side"></div><canvas class="la-plot"></canvas></div>
<div class="la-events"></div>`;
    parent.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas')!;
    this.side = this.el.querySelector('.la-side')!;
    this.events = this.el.querySelector('.la-events')!;
    this.wire();
    new ResizeObserver(() => (this.dirty = true)).observe(this.el);
  }

  get open() {
    return !this.el.hidden;
  }

  show() {
    this.el.hidden = false;
    this.attach();
    this.renderAll();
  }

  hide() {
    this.el.hidden = true;
    this.acq.stop();
    this.detach();
    this.view.setProbes?.([]);
  }

  // per-lesson configuration (the caller stores it; see onChange)
  load(cfg: LaConfig) {
    this.cfg = structuredClone(cfg);
    this.cursors = [null, null];
    this.resolve();
    if (this.open) this.renderAll();
  }

  get config(): LaConfig {
    return this.cfg;
  }

  presetFor: () => LaConfig = () => defaultConfig(this.board);

  setDesign(design: Design | null, mapping: Mapping | null) {
    this.design = design;
    this.mapping = mapping;
    this.resolve();
    if (this.open) this.renderAll();
  }

  // ------------------------------------------------------------------ plumbing to the simulator
  private attach() {
    this.runner.setProbe('la', {
      sigs: this.srcs.filter((s): s is Source => !!s).map((s) => s.sig),
      onSample: (t) => {
        if (this.runner.sim) this.acq.sample(t, this.runner.sim.v);
      },
      onRestart: () => {
        this.acq.restart();
        this.dirty = true;
      },
    });
    if (this.runner.sim) this.acq.sample(this.runner.now, this.runner.sim.v);
  }

  private detach() {
    this.runner.setProbe('la', null);
  }

  private resolve() {
    this.srcs = this.cfg.chans.map((c) => this.source(c.probe));
    this.acq.rec.setSources(this.srcs);
    this.acq.trigger = this.cfg.trig && this.cfg.trig.ch < this.cfg.chans.length ? this.cfg.trig : null;
    this.acq.base = this.cfg.base * this.board.clockHz;
    this.acq.pos = this.cfg.pos * this.acq.base;
    if (this.open) this.attach();
    this.view.setProbes?.(
      this.open
        ? this.cfg.chans.flatMap((c, i) => {
            const pin = c.probe.startsWith('pin:') ? c.probe.slice(4) : '';
            return pin ? [{ pin, color: color(i) }] : [];
          })
        : [],
    );
    this.dirty = true;
  }

  private source(probe: string): Source | null {
    if (!probe || !this.design) return null;
    if (probe.startsWith('pin:')) {
      const b = this.mapping?.bindings.find((x) => x.pin === probe.slice(4));
      return b && b.device.kind !== 'clk' ? { sig: b.sig, bit: b.bit } : null;
    }
    const [, name, bit] = probe.split(':');
    const s = this.design.sigs.find((x) => x.name === name);
    return s && +bit < s.width ? { sig: s.id, bit: +bit } : null;
  }

  private save() {
    this.onChange(this.cfg);
  }

  // called every animation frame
  frame() {
    if (!this.open) return;
    if (this.acq.tick(this.runner.now)) this.dirty = true;
    const st = this.acq.state;
    const label = st === 'armed' ? 'Armed — waiting for trigger' : st === 'triggered' ? 'Triggered' : st === 'auto' ? 'Running (auto)' : this.acq.captured ? 'Stopped' : 'Ready';
    const stEl = this.el.querySelector('#la-state')!;
    if (stEl.textContent !== label) {
      stEl.textContent = label;
      stEl.className = `la-state ${st}`;
    }
    if (this.dirty) {
      this.dirty = false;
      this.draw();
    }
  }

  // ------------------------------------------------------------------ UI
  private wire() {
    const q = <T extends HTMLElement>(s: string) => this.el.querySelector(s) as T;
    q('.la-close').addEventListener('click', () => this.hide());
    // drag the window by its title bar
    q('.la-title').addEventListener('pointerdown', (e) => {
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
    this.el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const act = t.closest<HTMLElement>('[data-la]')?.dataset.la;
      const menu = q<HTMLElement>('.la-menu');
      if (act === 'add') {
        menu.hidden = !menu.hidden;
        return;
      }
      if (!t.closest('.la-menu')) menu.hidden = true;
      if (act === 'single' || act === 'run') {
        this.acq.run(this.runner.now, act === 'single');
        this.dirty = true;
      } else if (act === 'stop') this.acq.stop();
      else if (act === 'center') {
        this.cfg.pos = 0;
        this.applyTiming();
      }
      const add = t.closest<HTMLElement>('[data-add]')?.dataset.add;
      if (add) {
        menu.hidden = true;
        this.add(add);
      }
    });
    q<HTMLSelectElement>('#la-trig').addEventListener('change', (e) => {
      const v = (e.target as HTMLSelectElement).value;
      this.cfg.trig = v === '' ? null : { ch: +v, edge: q<HTMLSelectElement>('#la-edge').value as Edge };
      this.resolve();
      this.save();
    });
    q<HTMLSelectElement>('#la-edge').addEventListener('change', (e) => {
      if (this.cfg.trig) this.cfg.trig.edge = (e.target as HTMLSelectElement).value as Edge;
      this.resolve();
      this.save();
    });
    q<HTMLSelectElement>('#la-base').addEventListener('change', (e) => {
      this.cfg.base = +(e.target as HTMLSelectElement).value;
      this.applyTiming();
    });
    // side panel edits
    this.side.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement | HTMLSelectElement;
      const row = t.closest<HTMLElement>('[data-row]');
      if (!row) return;
      const [kind, idx] = row.dataset.row!.split(':');
      const i = +idx;
      if (kind === 'ch') {
        if (t.classList.contains('nm')) this.cfg.chans[i].name = t.value;
        if (t.classList.contains('pr')) this.cfg.chans[i].probe = t.value;
      } else {
        const d = this.cfg.decs[i] as unknown as Record<string, unknown>;
        const f = t.dataset.f!;
        if (f === 'name') d.name = t.value;
        else if (f === 'chans') d.chans = t.value.split(/[\s,]+/).filter(Boolean).map(Number).filter((n) => n >= 0 && n < this.cfg.chans.length);
        else if (f === 'parity') d.parity = t.value;
        else if (f === 'msbFirst') d.msbFirst = t.value === '1';
        else d[f] = t.value === '' ? null : +t.value;
      }
      this.resolve();
      this.save();
      this.renderAll();
    });
    this.side.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const row = t.closest<HTMLElement>('[data-row]');
      if (!row) return;
      const [kind, idx] = row.dataset.row!.split(':');
      if (t.closest('.x')) {
        if (kind === 'ch') this.removeChannel(+idx);
        else this.cfg.decs.splice(+idx, 1);
        this.resolve();
        this.save();
        this.renderAll();
      } else if (t.closest('.cfg')) {
        row.classList.toggle('open');
        this.renderAll(row.dataset.row);
      }
    });
    // plot: hover, cursors, wheel zoom, drag pan
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => {
      const x = e.offsetX;
      if (this.drag) {
        const px = this.cyclesPerPx();
        this.cfg.pos = (this.drag.pos * this.acq.base - (x - this.drag.x) * px) / this.acq.base;
        this.applyTiming(false);
      }
      this.hoverX = x;
      this.dirty = true;
    });
    c.addEventListener('pointerleave', () => {
      this.hoverX = null;
      this.dirty = true;
    });
    c.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.offsetX, pos: this.cfg.pos };
      c.setPointerCapture(e.pointerId);
      (c as HTMLElement & { moved?: boolean }).moved = false;
    });
    c.addEventListener('pointerup', (e) => {
      const moved = this.drag && Math.abs(e.offsetX - this.drag.x) > 3;
      this.drag = null;
      if (moved) {
        this.save();
        return;
      }
      const t = this.xToT(e.offsetX);
      if (e.shiftKey || e.button === 2) this.cursors[1] = t;
      else this.cursors[0] = t;
      this.dirty = true;
    });
    c.addEventListener('dblclick', () => {
      this.cursors = [null, null];
      this.dirty = true;
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const i = BASES.indexOf(this.cfg.base);
        const ni = Math.max(0, Math.min(BASES.length - 1, i + (e.deltaY > 0 ? 1 : -1)));
        if (ni === i) return;
        const tMouse = this.xToT(e.offsetX);
        const ref = this.acq.ref;
        const frac = (e.offsetX - this.plotX0()) / this.plotW();
        this.cfg.base = BASES[ni];
        const span = 10 * this.cfg.base * this.board.clockHz;
        // keep the time under the mouse fixed
        this.cfg.pos = (tMouse - ref - (frac - 0.5) * span) / (this.cfg.base * this.board.clockHz);
        this.applyTiming();
      },
      { passive: false },
    );
  }

  private applyTiming(save = true) {
    this.acq.base = this.cfg.base * this.board.clockHz;
    this.acq.pos = this.cfg.pos * this.acq.base;
    (this.el.querySelector('#la-base') as HTMLSelectElement).value = String(this.cfg.base);
    this.el.querySelector('#la-pos')!.textContent = fmtTime(this.cfg.pos * this.cfg.base);
    this.dirty = true;
    if (save) this.save();
  }

  private removeChannel(i: number) {
    this.cfg.chans.splice(i, 1);
    const fix = (c: number) => (c === i ? -1 : c > i ? c - 1 : c);
    if (this.cfg.trig) {
      const n = fix(this.cfg.trig.ch);
      this.cfg.trig = n < 0 ? null : { ...this.cfg.trig, ch: n };
    }
    this.cfg.decs = this.cfg.decs.flatMap((d): DecCfg[] => {
      if (d.type === 'uart') return fix(d.ch) < 0 ? [] : [{ ...d, ch: fix(d.ch) }];
      if (d.type === 'i2c') return fix(d.scl) < 0 || fix(d.sda) < 0 ? [] : [{ ...d, scl: fix(d.scl), sda: fix(d.sda) }];
      if (d.type === 'ps2') return fix(d.clk) < 0 || fix(d.data) < 0 ? [] : [{ ...d, clk: fix(d.clk), data: fix(d.data) }];
      if (d.type === 'spi') {
        if (fix(d.clk) < 0 || fix(d.mosi) < 0) return [];
        const o = (x: number | null) => (x === null || fix(x) < 0 ? null : fix(x));
        return [{ ...d, clk: fix(d.clk), mosi: fix(d.mosi), miso: o(d.miso), cs: o(d.cs) }];
      }
      return [{ ...d, chans: d.chans.map(fix).filter((c) => c >= 0) }];
    });
  }

  private nextChan(probe = '') {
    if (this.cfg.chans.length >= MAX_CH) return -1;
    this.cfg.chans.push({ name: `DIO ${this.cfg.chans.length}`, probe });
    return this.cfg.chans.length - 1;
  }

  private add(what: string) {
    const n = this.cfg.chans.length;
    const ch = (k: number) => Math.min(k, Math.max(0, n - 1));
    if (what === 'signal') this.nextChan();
    else if (what === 'bus') this.cfg.decs.push({ type: 'bus', name: 'Bus', chans: Array.from({ length: Math.min(n, 8) }, (_, i) => i) });
    else if (what === 'uart') this.cfg.decs.push({ type: 'uart', name: 'UART', ch: 0, baud: 115200, bits: 8, parity: 'none', stop: 1 });
    else if (what === 'spi') this.cfg.decs.push({ type: 'spi', name: 'SPI', clk: 0, mosi: ch(1), miso: n > 2 ? 2 : null, cs: n > 3 ? 3 : null, mode: 0, bits: 8, msbFirst: true });
    else if (what === 'i2c') this.cfg.decs.push({ type: 'i2c', name: 'I2C', scl: 0, sda: ch(1) });
    else if (what === 'ps2') this.cfg.decs.push({ type: 'ps2', name: 'PS/2', clk: 0, data: ch(1) });
    else if (what === 'outputs') {
      const outs = (this.mapping?.bindings ?? []).filter((b) => !isBoardInput(b.device)).slice(0, MAX_CH);
      if (outs.length) {
        this.cfg.chans = outs.map((b) => ({ name: deviceLabel(b.device, this.board), probe: `pin:${b.pin}` }));
        this.cfg.decs = [];
        this.cfg.trig = null;
      }
    } else if (what === 'preset') {
      this.cfg = structuredClone(this.presetFor());
    } else if (what === 'clear') {
      this.cfg.chans = [];
      this.cfg.decs = [];
      this.cfg.trig = null;
    }
    this.resolve();
    this.save();
    this.renderAll();
  }

  // probe <option>s: header pins, on-board devices and design signals
  private probeOptions(): string {
    const groups = new Map<string, string[]>();
    const add = (g: string, value: string, label: string) => {
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(`<option value="${esc(value)}">${esc(label)}</option>`);
    };
    for (const h of this.board.headers) for (const [num, pin] of Object.entries(h.pins)) add(`Pmod ${h.name}`, `pin:${pin}`, `${h.name}${num} (${pin})`);
    const kinds: Record<string, string> = { uart: 'USB-UART', pin: 'Other pins', led: 'LEDs', rgb: 'RGB LEDs', seg: '7-segment', an: '7-segment', sw: 'Switches', btn: 'Buttons', reset: 'Buttons', vga: 'VGA' };
    const inHeader = new Set(this.board.headers.flatMap((h) => Object.values(h.pins)));
    const order = ['uart', 'pin', 'vga', 'led', 'rgb', 'seg', 'an', 'sw', 'btn', 'reset'];
    const entries = Object.entries(this.board.pins)
      .filter(([p, d]) => d.kind !== 'clk' && !inHeader.has(p))
      .sort((a, b) => order.indexOf(a[1].kind) - order.indexOf(b[1].kind) || ('index' in a[1] && 'index' in b[1] ? a[1].index - b[1].index : 0));
    for (const [pin, d] of entries) add(kinds[d.kind] ?? 'Other pins', `pin:${pin}`, `${deviceLabel(d, this.board)} (${pin})`);
    let count = 0;
    for (const s of this.design?.sigs ?? []) {
      if (s.width > 32 || count > 600 || s.id === this.mapping?.clock) continue;
      for (let b = s.width - 1; b >= 0; b--) {
        const idx = s.left >= s.right ? b + s.right : s.right - b;
        add('Design signals (debug probe)', `sig:${s.name}:${b}`, s.width > 1 ? `${s.name}[${idx}]` : s.name);
        count++;
      }
    }
    return `<option value="">— not connected —</option>` + [...groups].map(([g, o]) => `<optgroup label="${esc(g)}">${o.join('')}</optgroup>`).join('');
  }

  private decRows(d: DecCfg) {
    return d.type === 'spi' && d.miso !== null ? 2 : 1;
  }

  renderAll(openRow?: string) {
    const opts = this.probeOptions();
    const chOpts = (sel: number | null, allowNone = false) =>
      (allowNone ? `<option value="" ${sel === null ? 'selected' : ''}>none</option>` : '') + this.cfg.chans.map((c, i) => `<option value="${i}" ${sel === i ? 'selected' : ''}>${i}: ${esc(c.name)}</option>`).join('');
    const open = new Set([...this.side.querySelectorAll<HTMLElement>('.open')].map((r) => r.dataset.row));
    if (openRow && !open.has(openRow)) open.add(openRow);
    else if (openRow) open.delete(openRow);
    let html = `<div class="la-hdr" style="height:${AXIS_H}px">Channels</div>`;
    this.cfg.chans.forEach((c, i) => {
      const floating = !this.srcs[i] && this.design;
      html += `<div class="la-row ch" data-row="ch:${i}" style="height:${CH_H}px"><i style="background:${color(i)}"></i><input class="nm" value="${esc(c.name)}" title="Channel name"><select class="pr ${floating ? 'nc' : ''}" title="Where this probe is clipped">${opts}</select><button class="x" title="Remove">✕</button></div>`;
    });
    this.cfg.decs.forEach((d, i) => {
      const key = `dec:${i}`;
      const isOpen = open.has(key);
      const f = (label: string, field: string, inner: string) => `<label>${label}<select data-f="${field}">${inner}</select></label>`;
      const num = (label: string, field: string, v: number) => `<label>${label}<input data-f="${field}" type="number" value="${v}"></label>`;
      let form = '';
      if (d.type === 'uart')
        form =
          f('RX', 'ch', chOpts(d.ch)) +
          num('Baud', 'baud', d.baud) +
          num('Bits', 'bits', d.bits) +
          f('Parity', 'parity', ['none', 'even', 'odd'].map((p) => `<option ${d.parity === p ? 'selected' : ''}>${p}</option>`).join('')) +
          f('Stop', 'stop', [1, 2].map((s) => `<option ${d.stop === s ? 'selected' : ''}>${s}</option>`).join(''));
      else if (d.type === 'spi')
        form =
          f('SCLK', 'clk', chOpts(d.clk)) +
          f('MOSI', 'mosi', chOpts(d.mosi)) +
          f('MISO', 'miso', chOpts(d.miso, true)) +
          f('CS', 'cs', chOpts(d.cs, true)) +
          f('Mode', 'mode', [0, 1, 2, 3].map((m) => `<option ${d.mode === m ? 'selected' : ''}>${m}</option>`).join('')) +
          num('Bits', 'bits', d.bits) +
          f('Order', 'msbFirst', `<option value="1" ${d.msbFirst ? 'selected' : ''}>MSB first</option><option value="0" ${d.msbFirst ? '' : 'selected'}>LSB first</option>`);
      else if (d.type === 'i2c') form = f('SCL', 'scl', chOpts(d.scl)) + f('SDA', 'sda', chOpts(d.sda));
      else if (d.type === 'ps2') form = f('CLK', 'clk', chOpts(d.clk)) + f('DATA', 'data', chOpts(d.data));
      else form = `<label>Channels (LSB first)<input data-f="chans" value="${d.chans.join(' ')}"></label>`;
      html += `<div class="la-row dec ${isOpen ? 'open' : ''}" data-row="${key}"><div class="la-dec-line" style="height:${DEC_H * this.decRows(d)}px"><b class="tag">${d.type.toUpperCase()}</b><input data-f="name" value="${esc(d.name)}"><button class="cfg" title="Settings">⚙</button><button class="x" title="Remove">✕</button></div><div class="la-form">${form}</div></div>`;
    });
    if (!this.cfg.chans.length) html += `<div class="la-empty">No channels. Use ＋ Add.</div>`;
    this.side.innerHTML = html;
    this.side.querySelectorAll<HTMLSelectElement>('.la-row.ch select.pr').forEach((s, i) => {
      const p = this.cfg.chans[i].probe;
      if (p && ![...s.options].some((o) => o.value === p)) s.insertAdjacentHTML('beforeend', `<option value="${esc(p)}">${esc(p.split(':')[1] ?? p)} (not in design)</option>`);
      s.value = p;
    });
    // toolbar
    const trig = this.el.querySelector('#la-trig') as HTMLSelectElement;
    trig.innerHTML = `<option value="">None (auto)</option>` + this.cfg.chans.map((c, i) => `<option value="${i}">${i}: ${esc(c.name)}</option>`).join('');
    trig.value = this.cfg.trig ? String(this.cfg.trig.ch) : '';
    (this.el.querySelector('#la-edge') as HTMLSelectElement).value = this.cfg.trig?.edge ?? 'rise';
    this.applyTiming(false);
    this.dirty = true;
  }

  // ------------------------------------------------------------------ drawing
  private plotX0() {
    return 0;
  }
  private plotW() {
    return Math.max(1, this.canvas.clientWidth);
  }
  private cyclesPerPx() {
    return this.acq.span / this.plotW();
  }
  private xToT(x: number) {
    const [t0] = this.acq.window;
    return t0 + (x - this.plotX0()) * this.cyclesPerPx();
  }

  private rowLayout() {
    // y positions follow the side panel rows so names line up with traces
    const rows: { kind: 'ch' | 'dec'; i: number; y: number; h: number }[] = [];
    this.side.querySelectorAll<HTMLElement>('[data-row]').forEach((r) => {
      const [kind, i] = r.dataset.row!.split(':');
      const line = kind === 'ch' ? r : (r.querySelector('.la-dec-line') as HTMLElement);
      rows.push({ kind: kind as 'ch' | 'dec', i: +i, y: r.offsetTop, h: line.offsetHeight });
    });
    return rows;
  }

  private draw() {
    const c = this.canvas;
    const rows = this.rowLayout();
    const needH = Math.max(this.side.scrollHeight, rows.length ? rows[rows.length - 1].y + rows[rows.length - 1].h + 8 : 0);
    const W = c.clientWidth;
    const H = Math.max(needH, (c.parentElement?.clientHeight ?? 200) - 2);
    c.style.height = `${H}px`;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#15191e';
    g.fillRect(0, 0, W, H);
    const [t0, t1] = this.acq.window;
    const hz = this.board.clockHz;
    const px = (t: number) => ((t - t0) / (t1 - t0)) * W;
    // grid + axis
    g.fillStyle = '#20262d';
    g.fillRect(0, 0, W, AXIS_H);
    g.font = '10px system-ui, sans-serif';
    g.textBaseline = 'middle';
    const ref = this.acq.ref;
    for (let k = 0; k <= 10; k++) {
      const x = Math.round((k / 10) * W) + 0.5;
      g.strokeStyle = k === 5 ? '#39424d' : '#2a3139';
      g.beginPath();
      g.moveTo(x, AXIS_H);
      g.lineTo(x, H);
      g.stroke();
      const t = (t0 + (k / 10) * (t1 - t0) - ref) / hz;
      g.fillStyle = '#9aa5b1';
      g.textAlign = k === 0 ? 'left' : k === 10 ? 'right' : 'center';
      g.fillText(this.acq.captured ? fmtTime(t) : '', k === 0 ? 3 : k === 10 ? W - 3 : x, AXIS_H / 2);
    }
    const tr = this.acq.captured ? this.acq.rec.extract(t0 - (t1 - t0), t1) : null;
    // trigger marker
    if (tr && this.acq.trigger && ref >= t0 && ref <= t1) {
      const x = px(ref);
      g.strokeStyle = '#f0a33a';
      g.setLineDash([4, 3]);
      g.beginPath();
      g.moveTo(x, AXIS_H);
      g.lineTo(x, H);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#f0a33a';
      g.beginPath();
      g.moveTo(x - 5, 0);
      g.lineTo(x + 5, 0);
      g.lineTo(x, 7);
      g.fill();
    }
    const evs: { t: number; dec: string; text: string; err: boolean }[] = [];
    for (const r of rows) {
      if (r.kind === 'ch') this.drawChannel(g, r.i, r.y, r.h, tr, px, W);
      else {
        const d = this.cfg.decs[r.i];
        if (!d || !tr) continue;
        const anns = this.decode(d, tr);
        const nRows = this.decRows(d);
        const rh = r.h / nRows;
        for (const a of anns) {
          if (a.t1 < t0 || a.t0 > t1) continue;
          this.drawAnn(g, a, r.y + (a.row ?? 0) * rh, rh, px, W);
          if (d.type !== 'bus' && a.t0 >= t0 && evs.length < 400) evs.push({ t: a.t0, dec: d.name, text: a.text, err: a.kind === 'err' });
        }
      }
    }
    // cursors
    const cur = (t: number | null, col: string, label: string) => {
      if (t === null || t < t0 || t > t1) return;
      const x = Math.round(px(t)) + 0.5;
      g.strokeStyle = col;
      g.beginPath();
      g.moveTo(x, AXIS_H);
      g.lineTo(x, H);
      g.stroke();
      g.fillStyle = col;
      g.textAlign = 'left';
      g.fillText(label, x + 3, AXIS_H + 8);
    };
    cur(this.cursors[0], '#4fc3f7', 'A');
    cur(this.cursors[1], '#ff8a65', 'B');
    if (this.hoverX !== null && tr) {
      const x = this.hoverX + 0.5;
      g.strokeStyle = 'rgba(255,255,255,.35)';
      g.beginPath();
      g.moveTo(x, AXIS_H);
      g.lineTo(x, H);
      g.stroke();
      const t = (this.xToT(this.hoverX) - ref) / hz;
      const label = fmtTime(t);
      g.font = '11px system-ui, sans-serif';
      const w = g.measureText(label).width + 8;
      const lx = Math.min(W - w, Math.max(0, x - w / 2));
      g.fillStyle = '#e8eef4';
      g.fillRect(lx, 2, w, AXIS_H - 4);
      g.fillStyle = '#15191e';
      g.textAlign = 'center';
      g.fillText(label, lx + w / 2, AXIS_H / 2);
    }
    // measurement readout
    const [a, b] = this.cursors;
    const meas = this.el.querySelector('#la-meas')!;
    if (a !== null && b !== null && a !== b) {
      const dt = Math.abs(b - a) / hz;
      meas.textContent = `ΔT = ${fmtTime(dt)} · 1/ΔT = ${fmtHz(1 / dt)}`;
    } else meas.textContent = a !== null ? `A = ${fmtTime((a - ref) / hz)} · shift+click for B` : 'click: cursor A · shift+click: B · wheel: zoom · drag: pan';
    this.renderEvents(evs, ref, hz, tr);
  }

  private decode(d: DecCfg, tr: Trace): Ann[] {
    const hz = this.board.clockHz;
    if (d.type === 'uart') return decodeUart(tr, d, hz);
    if (d.type === 'spi') return decodeSpi(tr, d);
    if (d.type === 'i2c') return decodeI2c(tr, d);
    if (d.type === 'ps2') return decodePs2(tr, d);
    return decodeBus(tr, d.chans);
  }

  private drawChannel(g: CanvasRenderingContext2D, i: number, y: number, h: number, tr: Trace | null, px: (t: number) => number, W: number) {
    const hi = y + 5;
    const lo = y + h - 5;
    g.strokeStyle = '#232a31';
    g.beginPath();
    g.moveTo(0, y + h + 0.5);
    g.lineTo(W, y + h + 0.5);
    g.stroke();
    if (!tr) return;
    const col = color(i);
    if (!this.srcs[i]) {
      // floating probe: high impedance
      g.strokeStyle = '#6b7580';
      g.setLineDash([3, 3]);
      g.beginPath();
      g.moveTo(0, (hi + lo) / 2);
      g.lineTo(W, (hi + lo) / 2);
      g.stroke();
      g.setLineDash([]);
      return;
    }
    const startX = Math.max(0, px(tr.known));
    if (startX >= W) return;
    let lv = (tr.init >>> i) & 1;
    let x = startX;
    g.strokeStyle = col;
    g.fillStyle = col + '55';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(x, lv ? hi : lo);
    let lastCol = -1;
    let busy = -1;
    for (let k = 0; k < tr.times.length; k++) {
      const b = (tr.vals[k] >>> i) & 1;
      if (b === lv) continue;
      const nx = Math.max(startX, px(tr.times[k]));
      if (nx > W) break;
      const colPx = Math.floor(nx);
      if (colPx === lastCol) {
        // several edges in one pixel: draw a filled block
        busy = colPx;
      }
      g.lineTo(nx, lv ? hi : lo);
      g.lineTo(nx, b ? hi : lo);
      lv = b;
      x = nx;
      lastCol = colPx;
    }
    g.lineTo(W, lv ? hi : lo);
    g.stroke();
    g.lineWidth = 1;
    if (busy >= 0) {
      // shade regions with sub-pixel activity
      let run = -1;
      let prev = -2;
      let lvl = (tr.init >>> i) & 1;
      const cols = new Set<number>();
      let lc = -1;
      for (let k = 0; k < tr.times.length; k++) {
        const b = (tr.vals[k] >>> i) & 1;
        if (b === lvl) continue;
        lvl = b;
        const cp = Math.floor(px(tr.times[k]));
        if (cp === lc) cols.add(cp);
        lc = cp;
      }
      for (const cp of [...cols].sort((p, q) => p - q)) {
        if (cp !== prev + 1) {
          if (run >= 0) g.fillRect(run, hi, prev - run + 1, lo - hi);
          run = cp;
        }
        prev = cp;
      }
      if (run >= 0) g.fillRect(run, hi, prev - run + 1, lo - hi);
    }
  }

  private drawAnn(g: CanvasRenderingContext2D, a: Ann, y: number, h: number, px: (t: number) => number, W: number) {
    const x0 = Math.max(-10, px(a.t0));
    const x1 = Math.min(W + 10, px(a.t1));
    const top = y + 3;
    const bot = y + h - 3;
    const mid = (top + bot) / 2;
    const e = Math.min(4, (x1 - x0) / 2);
    const fill = a.kind === 'err' ? '#7a2630' : a.kind === 'ctrl' ? '#2f5d3a' : '#27415e';
    const stroke = a.kind === 'err' ? '#f05a6e' : a.kind === 'ctrl' ? '#7af07e' : '#6fb2f5';
    g.fillStyle = fill;
    g.strokeStyle = stroke;
    g.beginPath();
    g.moveTo(x0, mid);
    g.lineTo(x0 + e, top);
    g.lineTo(x1 - e, top);
    g.lineTo(x1, mid);
    g.lineTo(x1 - e, bot);
    g.lineTo(x0 + e, bot);
    g.closePath();
    g.fill();
    g.stroke();
    g.font = '11px "JetBrains Mono", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const avail = x1 - x0 - 2 * e - 2;
    const label = g.measureText(a.text).width <= avail ? a.text : g.measureText(a.short).width <= avail ? a.short : '';
    if (label) {
      g.fillStyle = '#eef3f8';
      g.fillText(label, (Math.max(0, x0) + Math.min(W, x1)) / 2, mid + 0.5);
    }
  }

  private renderEvents(evs: { t: number; dec: string; text: string; err: boolean }[], ref: number, hz: number, tr: Trace | null) {
    const uart = tr ? this.cfg.decs.filter((d) => d.type === 'uart') : [];
    let text = '';
    for (const d of uart) {
      const [t0, t1] = this.acq.window;
      const s = decodeUart(tr!, d as Extract<DecCfg, { type: 'uart' }>, hz)
        .filter((a) => a.t0 >= t0 && a.t0 <= t1 && a.kind === 'data')
        .map((a) => {
          const m = /0x([0-9A-F]+)/.exec(a.text);
          const v = m ? parseInt(m[1], 16) : 0;
          return v >= 0x20 && v < 0x7f ? String.fromCharCode(v) : v === 10 ? '↵' : v === 13 ? '' : '·';
        })
        .join('');
      text += `<div class="la-text"><b>${esc(d.name)} text:</b> <code>${esc(s) || '—'}</code></div>`;
    }
    const rows = evs
      .sort((a, b) => a.t - b.t)
      .map((e) => `<tr class="${e.err ? 'err' : ''}"><td>${fmtTime((e.t - ref) / hz)}</td><td>${esc(e.dec)}</td><td>${esc(e.text)}</td></tr>`)
      .join('');
    const html = text + (evs.length ? `<table><thead><tr><th>Time</th><th>Decoder</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>` : this.cfg.decs.some((d) => d.type !== 'bus') ? '<div class="dim">No decoded data in this window.</div>' : '<div class="dim">Add a UART, SPI or I²C decoder to list decoded data here.</div>');
    if (this.events.innerHTML !== html) this.events.innerHTML = html;
  }
}
