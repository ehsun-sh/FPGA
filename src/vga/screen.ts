// The VGA monitor instrument: listens to the running design's VGA lines, paints the picture into a canvas that the
// 3D scene uses as the monitor screen, and shows the same canvas bigger in a floating window.
import type { BoardDef, BoardView } from '../boards';
import type { Mapping } from '../boards/mapping';
import type { Runner } from '../sim/runner';
import { VgaMonitor, vgaTap, type VgaTap } from './monitor';

const W = 640;
const H = 480;

export class VgaScreen {
  el: HTMLElement;
  canvas = document.createElement('canvas'); // what the monitor shows, always 640×480
  monitor: VgaMonitor;
  private tap: VgaTap | null = null;
  private src = document.createElement('canvas'); // the picture at its real resolution
  private info: HTMLElement;
  private shown: 'ok' | 'no-signal' | 'out-of-range' | '' = '';
  private fpsWin: { t: number; f: number }[] = [];
  onToggle: (open: boolean) => void = () => {};

  constructor(
    parent: HTMLElement,
    board: BoardDef,
    private view: BoardView,
    private runner: Runner,
  ) {
    this.monitor = new VgaMonitor(board.clockHz);
    this.canvas.width = W;
    this.canvas.height = H;
    this.el = document.createElement('div');
    this.el.className = 'la-win vga-win';
    this.el.hidden = true;
    this.el.innerHTML = `
<div class="la-title"><span class="la-ico vga"></span><b>VGA Monitor</b><span class="dim" id="vga-info">No signal</span><span class="grow"></span><button class="la-close" title="Close">✕</button></div>
<div class="vga-body"></div>`;
    this.el.querySelector('.vga-body')!.appendChild(this.canvas);
    this.info = this.el.querySelector('#vga-info')!;
    parent.appendChild(this.el);
    this.el.querySelector('.la-close')!.addEventListener('click', () => this.hide());
    this.drag();
    this.drawStatus('no-signal');
  }

  get open() {
    return !this.el.hidden;
  }
  show() {
    this.el.hidden = false;
    this.onToggle(true);
  }
  hide() {
    this.el.hidden = true;
    this.onToggle(false);
  }

  // true when the design drives the VGA connector
  get connected() {
    return !!this.tap;
  }

  setDesign(mapping: Mapping | null) {
    this.tap = mapping ? vgaTap(mapping.bindings) : null;
    if (!this.tap || !this.runner.sim) {
      this.tap = null;
      this.runner.setProbe('vga', null);
      this.view.setMonitor?.(null);
      this.shown = '';
      return;
    }
    const tap = this.tap;
    const restart = () => {
      const l = tap.read(this.runner.sim!.v);
      this.monitor.reset(this.runner.now, l.hs, l.vs, l.color);
    };
    restart();
    this.runner.setProbe('vga', {
      sigs: tap.sigs,
      onSample: (t) => {
        if (!this.runner.sim) return;
        const l = tap.read(this.runner.sim.v);
        this.monitor.feed(t, l.hs, l.vs, l.color);
      },
      onRestart: restart,
    });
    this.shown = '';
    this.drawStatus('no-signal');
    this.view.setMonitor?.(this.canvas);
  }

  // once per animation frame
  frame() {
    if (!this.tap) return;
    const m = this.monitor;
    const st = this.runner.running ? m.state(this.runner.now) : 'no-signal';
    const now = performance.now();
    this.fpsWin.push({ t: now, f: m.frames });
    while (this.fpsWin.length > 2 && now - this.fpsWin[0].t > 1500) this.fpsWin.shift();
    if (st === 'ok') {
      if (m.dirty || this.shown !== 'ok') this.drawPicture();
    } else if (st !== this.shown) this.drawStatus(st);
    this.shown = st;
    this.view.updateMonitor?.(st === 'ok');
    if (this.open) {
      const w = this.fpsWin;
      const dt = (w[w.length - 1].t - w[0].t) / 1000;
      const fps = dt > 0.3 ? (w[w.length - 1].f - w[0].f) / dt : 0;
      this.info.textContent =
        st === 'ok'
          ? `${m.mode.name} (${m.refreshHz.toFixed(1)} Hz in board time) · ${fps.toFixed(1)} frames/s in the browser`
          : st === 'out-of-range'
            ? `Out of range: line period ${((m.linePeriod / m.clockHz) * 1e6).toFixed(2)} µs`
            : 'No signal';
    }
  }

  private drawPicture() {
    const m = this.monitor;
    m.dirty = false;
    if (this.src.width !== m.mode.w || this.src.height !== m.mode.h) {
      this.src.width = m.mode.w;
      this.src.height = m.mode.h;
    }
    this.src.getContext('2d')!.putImageData(new ImageData(m.pixels as unknown as Uint8ClampedArray<ArrayBuffer>, m.mode.w, m.mode.h), 0, 0);
    const g = this.canvas.getContext('2d')!;
    g.imageSmoothingEnabled = m.mode.w !== W;
    g.drawImage(this.src, 0, 0, W, H);
    this.view.refreshMonitor?.();
  }

  // the on-screen message a monitor shows when it cannot display the signal
  private drawStatus(st: 'no-signal' | 'out-of-range' | 'ok') {
    const g = this.canvas.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    if (st !== 'ok') {
      const text = st === 'no-signal' ? 'No signal' : 'Out of range';
      g.fillStyle = '#10151c';
      g.strokeStyle = '#4b8bd6';
      g.lineWidth = 3;
      g.fillRect(170, 190, 300, 100);
      g.strokeRect(170, 190, 300, 100);
      g.fillStyle = '#e9eef5';
      g.font = 'bold 30px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, 320, 228);
      g.font = '16px sans-serif';
      g.fillStyle = '#9fb0c2';
      g.fillText(st === 'no-signal' ? 'check HS / VS (VGA input)' : 'use 640×480, 800×600 or 1024×768 @ 60 Hz', 320, 264);
    }
    this.view.refreshMonitor?.();
  }

  private drag() {
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
  }
}
