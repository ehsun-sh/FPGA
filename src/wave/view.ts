// Waveform viewer for behavioral simulation, in the style of the Vivado simulator:
// scope / object browser, name and value columns, a time ruler, zoom, pan and a cursor.
import { formatTime, TbSim, type Wave, type WaveSig } from '../sim/tbsim';

export type Radix = 'bin' | 'hex' | 'dec' | 'sdec' | 'ascii' | 'enum';

interface Row {
  w: Wave;
  radix: Radix;
}

const ROW_H = 22;
const RULER_H = 24;
const NAME_W = 140;
const VALUE_W = 76;
const C = {
  bg: '#000000',
  grid: '#1b1f24',
  text: '#d7dde5',
  dim: '#7c8794',
  wave: '#3ddc4b',
  bus: '#3ddc4b',
  sel: '#123a5c',
  cursor: '#f1d302',
  ruler: '#11151a',
  sep: '#2b3138',
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function defaultRadix(s: WaveSig): Radix {
  if (s.lits) return 'enum';
  if (s.width === 1) return 'bin';
  if (s.width === 32 && s.signed) return 'sdec';
  return 'hex';
}

export function formatRadix(v: number, s: WaveSig, r: Radix): string {
  const w = s.width;
  switch (r) {
    case 'bin':
      return v.toString(2).padStart(w, '0');
    case 'hex':
      return v.toString(16).toUpperCase().padStart(Math.ceil(w / 4), '0');
    case 'dec':
      return String(v >>> 0);
    case 'sdec':
      return String(w >= 32 ? v | 0 : v >= 2 ** (w - 1) ? v - 2 ** w : v);
    case 'ascii': {
      let t = '';
      for (let i = Math.ceil(w / 8) - 1; i >= 0; i--) {
        const c = (v >>> (i * 8)) & 0xff;
        t += c >= 32 && c < 127 ? String.fromCharCode(c) : '.';
      }
      return t;
    }
    case 'enum':
      return s.lits?.[v] ?? String(v);
  }
}

function niceStep(minPs: number): number {
  const p = 10 ** Math.floor(Math.log10(Math.max(minPs, 1)));
  for (const m of [1, 2, 5, 10]) if (m * p >= minPs) return m * p;
  return 10 * p;
}

export class WaveView {
  el: HTMLElement;
  sim: TbSim | null = null;
  rows: Row[] = [];
  selected = -1;
  cursor: number | null = null;
  // view: time at the left edge and ps per pixel
  private t0 = 0;
  private scale = 10;
  private scrollY = 0;
  private scope = '';
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private menu: HTMLElement;
  private dirty = true;
  // callbacks to the application (it logs the Tcl commands)
  onRestart: () => void = () => {};
  onRunAll: () => void = () => {};
  onRunFor: (ps: number) => void = () => {};

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'wv hidden';
    this.el.innerHTML = `
<div class="wv-tools">
  <button data-wv="restart" title="Restart (restart)">⏮ Restart</button>
  <button data-wv="all" title="Run All (run all)">▶ Run All</button>
  <button data-wv="for" title="Run for the given time (run 1 us)">▶ Run for</button>
  <input class="wv-time" value="1" size="4"/>
  <select class="wv-unit"><option>ns</option><option selected>us</option><option>ms</option></select>
  <span class="wv-sep"></span>
  <button data-wv="zin" title="Zoom in">＋</button>
  <button data-wv="zout" title="Zoom out">－</button>
  <button data-wv="fit" title="Zoom fit">⤢ Fit</button>
  <span class="wv-sep"></span>
  <span class="wv-info"></span>
</div>
<div class="wv-main">
  <aside class="wv-side">
    <div class="wv-h">Scope</div><div class="wv-scopes"></div>
    <div class="wv-h">Objects <span class="dim">(click to add)</span></div><div class="wv-objs"></div>
  </aside>
  <div class="wv-plot"><canvas></canvas></div>
</div>
<div class="wv-menu hidden"></div>
<div class="wv-empty">Run <b>Flow › Run Behavioral Simulation</b> to see the waveforms of your testbench.</div>`;
    parent.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas')!;
    this.ctx = this.canvas.getContext('2d')!;
    this.menu = this.el.querySelector('.wv-menu')!;
    this.bind();
    const loop = () => {
      if (this.dirty && !this.el.classList.contains('hidden')) this.draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    new ResizeObserver(() => (this.dirty = true)).observe(this.el.querySelector('.wv-plot')!);
  }

  show() {
    this.el.classList.remove('hidden');
    this.dirty = true;
  }
  hide() {
    this.el.classList.add('hidden');
  }
  get open() {
    return !this.el.classList.contains('hidden');
  }

  // a new simulation: show the top-level signals, like Vivado does
  setSim(sim: TbSim | null) {
    const keep = new Map(this.rows.map((r) => [r.w.sig.name, r.radix]));
    const sameDesign = this.sim && sim && this.sim.design.top === sim.design.top;
    this.sim = sim;
    this.el.querySelector<HTMLElement>('.wv-empty')!.classList.toggle('hidden', !!sim);
    if (!sim) {
      this.rows = [];
    } else if (sameDesign && keep.size) {
      this.rows = sim.waves.filter((w) => keep.has(w.sig.name)).map((w) => ({ w, radix: keep.get(w.sig.name)! }));
    } else {
      this.rows = sim.waves.filter((w) => w.sig.scope === '').map((w) => ({ w, radix: defaultRadix(w.sig) }));
      this.scope = '';
      this.cursor = null;
    }
    this.selected = -1;
    this.renderSide();
    this.dirty = true;
  }

  // after the simulation advanced
  refresh(fit = false) {
    if (fit) this.fit();
    this.renderInfo();
    this.dirty = true;
  }

  private pendingFit = false;

  fit() {
    if (!this.sim) return;
    if (!this.canvas.clientWidth) {
      // not laid out yet (the view was hidden): fit on the next draw
      this.pendingFit = true;
      this.dirty = true;
      return;
    }
    this.pendingFit = false;
    const w = this.plotWidth();
    this.t0 = 0;
    this.scale = Math.max(this.sim.now, 1000) / Math.max(w, 50);
    this.dirty = true;
  }

  private plotWidth() {
    return Math.max(10, this.canvas.clientWidth - NAME_W - VALUE_W);
  }

  private renderInfo() {
    const info = this.el.querySelector('.wv-info')!;
    if (!this.sim) {
      info.textContent = '';
      return;
    }
    const cur = this.cursor === null ? '' : ` · cursor ${formatTime(this.cursor)}`;
    info.textContent = `${this.sim.design.top} · now ${formatTime(this.sim.now)}${cur}`;
  }

  private scopes(): string[] {
    if (!this.sim) return [];
    const set = new Set<string>(['']);
    for (const w of this.sim.waves) {
      const parts = w.sig.scope.split('.').filter(Boolean);
      for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join('.'));
    }
    return [...set].sort();
  }

  renderSide() {
    const sc = this.el.querySelector('.wv-scopes')!;
    const ob = this.el.querySelector('.wv-objs')!;
    if (!this.sim) {
      sc.innerHTML = '';
      ob.innerHTML = '';
      return;
    }
    sc.innerHTML = this.scopes()
      .map((s) => {
        const depth = s ? s.split('.').length : 0;
        const name = s ? s.split('.').pop()! : this.sim!.design.top;
        return `<div class="wv-scope ${s === this.scope ? 'active' : ''}" data-scope="${esc(s)}" style="padding-left:${6 + depth * 12}px" title="Double-click to add all signals">${depth ? '└ ' : ''}${esc(name)}</div>`;
      })
      .join('');
    const shown = new Set(this.rows.map((r) => r.w));
    ob.innerHTML = this.sim.waves
      .filter((w) => w.sig.scope === this.scope)
      .map((w) => {
        const i = this.sim!.waves.indexOf(w);
        const rng = w.sig.width > 1 ? `[${w.sig.left}:${w.sig.right}]` : '';
        return `<div class="wv-obj ${shown.has(w) ? 'on' : ''}" data-obj="${i}">${shown.has(w) ? '✓' : '+'} ${esc(w.sig.leaf)}<span class="dim">${rng}</span></div>`;
      })
      .join('');
  }

  private addWave(w: Wave) {
    if (this.rows.some((r) => r.w === w)) return;
    this.rows.push({ w, radix: defaultRadix(w.sig) });
  }

  private bind() {
    this.el.addEventListener('click', (ev) => {
      const t = ev.target as HTMLElement;
      const b = t.closest('[data-wv]') as HTMLElement | null;
      if (b) this.tool(b.dataset.wv!);
      const s = t.closest('[data-scope]') as HTMLElement | null;
      if (s) {
        this.scope = s.dataset.scope!;
        this.renderSide();
      }
      const o = t.closest('[data-obj]') as HTMLElement | null;
      if (o && this.sim) {
        const w = this.sim.waves[Number(o.dataset.obj)];
        const i = this.rows.findIndex((r) => r.w === w);
        if (i >= 0) this.rows.splice(i, 1);
        else this.addWave(w);
        this.renderSide();
        this.dirty = true;
      }
      const m = t.closest('[data-radix]') as HTMLElement | null;
      if (m) {
        const r = this.rows[this.selected];
        const v = m.dataset.radix!;
        if (r && v === 'remove') this.rows.splice(this.selected, 1);
        else if (r && v === 'up' && this.selected > 0) {
          [this.rows[this.selected - 1], this.rows[this.selected]] = [r, this.rows[this.selected - 1]];
          this.selected--;
        } else if (r && v === 'down' && this.selected < this.rows.length - 1) {
          [this.rows[this.selected + 1], this.rows[this.selected]] = [r, this.rows[this.selected + 1]];
          this.selected++;
        } else if (r) r.radix = v as Radix;
        this.renderSide();
        this.dirty = true;
      }
      if (!t.closest('.wv-menu')) this.menu.classList.add('hidden');
    });
    this.el.addEventListener('dblclick', (ev) => {
      const s = (ev.target as HTMLElement).closest('[data-scope]') as HTMLElement | null;
      if (s && this.sim) {
        for (const w of this.sim.waves) if (w.sig.scope === s.dataset.scope) this.addWave(w);
        this.renderSide();
        this.dirty = true;
      }
    });
    const cv = this.canvas;
    let drag: { x: number; t0: number; moved: boolean } | null = null;
    cv.addEventListener('pointerdown', (ev) => {
      const r = cv.getBoundingClientRect();
      const x = ev.clientX - r.left;
      const y = ev.clientY - r.top;
      this.menu.classList.add('hidden');
      if (x < NAME_W + VALUE_W) {
        const i = Math.floor((y - RULER_H + this.scrollY) / ROW_H);
        this.selected = y > RULER_H && i < this.rows.length ? i : -1;
        this.dirty = true;
        return;
      }
      cv.setPointerCapture(ev.pointerId);
      drag = { x: ev.clientX, t0: this.t0, moved: false };
    });
    cv.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const dx = ev.clientX - drag.x;
      if (Math.abs(dx) > 3) drag.moved = true;
      if (drag.moved) {
        this.t0 = Math.max(0, drag.t0 - dx * this.scale);
        this.dirty = true;
      }
    });
    cv.addEventListener('pointerup', (ev) => {
      if (drag && !drag.moved) {
        const r = cv.getBoundingClientRect();
        const x = ev.clientX - r.left - NAME_W - VALUE_W;
        this.cursor = Math.max(0, Math.round(this.t0 + x * this.scale));
        const y = ev.clientY - r.top;
        const i = Math.floor((y - RULER_H + this.scrollY) / ROW_H);
        if (y > RULER_H && i < this.rows.length) this.selected = i;
        this.renderInfo();
        this.dirty = true;
      }
      drag = null;
    });
    cv.addEventListener(
      'wheel',
      (ev) => {
        ev.preventDefault();
        const r = cv.getBoundingClientRect();
        const x = ev.clientX - r.left;
        if (x < NAME_W + VALUE_W && !ev.ctrlKey) {
          const max = Math.max(0, this.rows.length * ROW_H - (cv.clientHeight - RULER_H));
          this.scrollY = Math.max(0, Math.min(max, this.scrollY + ev.deltaY));
        } else if (ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) {
          this.t0 = Math.max(0, this.t0 + (ev.deltaX || ev.deltaY) * this.scale);
        } else {
          const px = Math.max(0, x - NAME_W - VALUE_W);
          const at = this.t0 + px * this.scale;
          this.scale = Math.min(1e9, Math.max(0.01, this.scale * Math.exp(ev.deltaY * 0.002)));
          this.t0 = Math.max(0, at - px * this.scale);
        }
        this.dirty = true;
      },
      { passive: false },
    );
    cv.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      const r = cv.getBoundingClientRect();
      const y = ev.clientY - r.top;
      const i = Math.floor((y - RULER_H + this.scrollY) / ROW_H);
      if (y <= RULER_H || i >= this.rows.length) return;
      this.selected = i;
      const s = this.rows[i].w.sig;
      const opts: [string, string][] = [
        ['bin', 'Binary'],
        ['hex', 'Hexadecimal'],
        ['dec', 'Unsigned Decimal'],
        ['sdec', 'Signed Decimal'],
        ['ascii', 'ASCII'],
      ];
      if (s.lits) opts.unshift(['enum', 'State names']);
      const host = this.el.getBoundingClientRect();
      this.menu.innerHTML =
        `<div class="wv-mh">Radix</div>` +
        opts.map(([k, l]) => `<button data-radix="${k}" class="${this.rows[i].radix === k ? 'on' : ''}">${l}</button>`).join('') +
        `<hr/><button data-radix="up">Move up</button><button data-radix="down">Move down</button><button data-radix="remove">Remove</button>`;
      this.menu.style.left = `${ev.clientX - host.left}px`;
      this.menu.style.top = `${ev.clientY - host.top}px`;
      this.menu.classList.remove('hidden');
      this.dirty = true;
    });
    this.el.tabIndex = 0;
    this.el.addEventListener('keydown', (ev) => {
      if ((ev.key === 'Delete' || ev.key === 'Backspace') && this.selected >= 0 && (ev.target as HTMLElement).tagName !== 'INPUT') {
        this.rows.splice(this.selected, 1);
        this.selected = Math.min(this.selected, this.rows.length - 1);
        this.renderSide();
        this.dirty = true;
      }
    });
  }

  private tool(name: string) {
    switch (name) {
      case 'restart':
        this.onRestart();
        break;
      case 'all':
        this.onRunAll();
        break;
      case 'for': {
        const v = Number((this.el.querySelector('.wv-time') as HTMLInputElement).value);
        const u = (this.el.querySelector('.wv-unit') as HTMLSelectElement).value;
        if (v > 0) this.onRunFor(Math.round(v * ({ ns: 1e3, us: 1e6, ms: 1e9 } as Record<string, number>)[u]));
        break;
      }
      case 'zin':
      case 'zout': {
        const mid = this.cursor ?? this.t0 + (this.plotWidth() / 2) * this.scale;
        this.scale *= name === 'zin' ? 0.5 : 2;
        this.t0 = Math.max(0, mid - (this.plotWidth() / 2) * this.scale);
        this.dirty = true;
        break;
      }
      case 'fit':
        this.fit();
        break;
    }
  }

  private draw() {
    this.dirty = false;
    const cv = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth;
    const H = cv.clientHeight;
    if (!W || !H) return;
    if (this.pendingFit) this.fit();
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    }
    const g = this.ctx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = C.bg;
    g.fillRect(0, 0, W, H);
    g.font = '12px "JetBrains Mono", Consolas, monospace';
    g.textBaseline = 'middle';
    const X0 = NAME_W + VALUE_W;
    const pw = W - X0;
    const end = this.sim?.now ?? 0;
    const tx = (t: number) => X0 + (t - this.t0) / this.scale;

    // ruler and grid
    g.fillStyle = C.ruler;
    g.fillRect(0, 0, W, RULER_H);
    const step = niceStep(this.scale * 90);
    g.strokeStyle = C.grid;
    g.fillStyle = C.dim;
    g.textAlign = 'left';
    for (let t = Math.floor(this.t0 / step) * step; t <= this.t0 + pw * this.scale; t += step) {
      const x = Math.round(tx(t)) + 0.5;
      if (x < X0) continue;
      g.beginPath();
      g.moveTo(x, RULER_H - 6);
      g.lineTo(x, H);
      g.stroke();
      g.fillText(formatTime(t), x + 3, RULER_H / 2);
    }
    g.fillStyle = C.text;
    g.fillText('Name', 8, RULER_H / 2);
    g.fillText('Value', NAME_W + 6, RULER_H / 2);

    // rows
    g.save();
    g.beginPath();
    g.rect(0, RULER_H, W, H - RULER_H);
    g.clip();
    const at = this.cursor ?? end;
    this.rows.forEach((row, i) => {
      const y = RULER_H + i * ROW_H - this.scrollY;
      if (y + ROW_H < RULER_H || y > H) return;
      if (i === this.selected) {
        g.fillStyle = C.sel;
        g.fillRect(0, y, W, ROW_H);
      }
      const s = row.w.sig;
      g.fillStyle = C.text;
      g.textAlign = 'left';
      const label = (s.scope ? s.scope + '.' : '') + s.leaf + (s.width > 1 ? `[${s.left}:${s.right}]` : '');
      g.fillText(this.clip(label, NAME_W - 12), 8, y + ROW_H / 2);
      const cur = TbSim.valueAt(row.w, at);
      g.fillStyle = C.wave;
      g.fillText(this.clip(cur === undefined ? '' : formatRadix(cur, s, row.radix), VALUE_W - 10), NAME_W + 6, y + ROW_H / 2);
      this.drawWave(row, y, X0, W, end, tx);
      g.strokeStyle = C.sep;
      g.beginPath();
      g.moveTo(0, y + ROW_H - 0.5);
      g.lineTo(W, y + ROW_H - 0.5);
      g.stroke();
    });
    g.restore();
    // column separators
    g.strokeStyle = C.sep;
    g.beginPath();
    g.moveTo(NAME_W + 0.5, 0);
    g.lineTo(NAME_W + 0.5, H);
    g.moveTo(X0 + 0.5, 0);
    g.lineTo(X0 + 0.5, H);
    g.stroke();
    // cursor
    if (this.cursor !== null) {
      const x = Math.round(tx(this.cursor)) + 0.5;
      if (x >= X0) {
        g.strokeStyle = C.cursor;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, H);
        g.stroke();
        const txt = formatTime(this.cursor);
        g.font = '11px "JetBrains Mono", Consolas, monospace';
        const tw = g.measureText(txt).width + 8;
        g.fillStyle = C.cursor;
        g.fillRect(x, 2, tw, RULER_H - 6);
        g.fillStyle = '#000';
        g.textAlign = 'left';
        g.fillText(txt, x + 4, RULER_H / 2 - 1);
      }
    }
  }

  private clip(s: string, w: number) {
    const g = this.ctx;
    if (g.measureText(s).width <= w) return s;
    while (s.length > 1 && g.measureText(s + '…').width > w) s = s.slice(0, -1);
    return s + '…';
  }

  private drawWave(row: Row, y: number, X0: number, W: number, end: number, tx: (t: number) => number) {
    const g = this.ctx;
    const { t, v } = row.w;
    if (!t.length) return;
    const s = row.w.sig;
    const top = y + 4;
    const bot = y + ROW_H - 5;
    const tEnd = this.t0 + (W - X0) * this.scale;
    // first change at or before the left edge
    let lo = 0;
    let hi = t.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (t[m] <= this.t0) lo = m + 1;
      else hi = m;
    }
    let i = Math.max(0, lo - 1);
    g.save();
    g.beginPath();
    g.rect(X0, y, W - X0, ROW_H);
    g.clip();
    g.strokeStyle = s.width === 1 ? C.wave : C.bus;
    g.lineWidth = 1;
    if (s.width === 1) {
      g.beginPath();
      let prevY = -1;
      for (; i < t.length && t[i] <= tEnd; i++) {
        const x0 = Math.max(X0, tx(t[i]));
        const x1 = Math.min(W, tx(i + 1 < t.length ? t[i + 1] : end));
        const yy = v[i] & 1 ? top : bot;
        if (prevY >= 0 && prevY !== yy) {
          g.moveTo(Math.round(x0) + 0.5, prevY);
          g.lineTo(Math.round(x0) + 0.5, yy);
        }
        g.moveTo(x0, yy + 0.5);
        g.lineTo(Math.max(x0, x1), yy + 0.5);
        prevY = yy;
      }
      g.stroke();
    } else {
      const mid = (top + bot) / 2;
      g.fillStyle = C.bus;
      g.textAlign = 'center';
      for (; i < t.length && t[i] <= tEnd; i++) {
        const a = tx(t[i]);
        const b = tx(i + 1 < t.length ? t[i + 1] : end);
        if (b < X0) continue;
        if (b - a < 3) {
          // too many changes to draw one by one
          g.fillRect(a, top, Math.max(1, b - a), bot - top);
          continue;
        }
        const k = Math.min(3, (b - a) / 2);
        g.beginPath();
        g.moveTo(a, mid);
        g.lineTo(a + k, top + 0.5);
        g.lineTo(b - k, top + 0.5);
        g.lineTo(b, mid);
        g.lineTo(b - k, bot + 0.5);
        g.lineTo(a + k, bot + 0.5);
        g.closePath();
        g.stroke();
        const l = Math.max(a, X0) + 4;
        const r = Math.min(b, W) - 4;
        if (r - l > 14) {
          const txt = this.clip(formatRadix(v[i], s, row.radix), r - l);
          g.fillStyle = C.text;
          g.fillText(txt, (l + r) / 2, mid + 0.5);
          g.fillStyle = C.bus;
        }
      }
    }
    g.restore();
  }
}
