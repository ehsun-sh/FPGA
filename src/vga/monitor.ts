// A virtual VGA monitor. It is fed the five VGA lines (R, G, B, HS, VS) every time one of them changes and paints
// the picture like a real monitor would: it measures the sync timing, picks the matching video mode and turns the
// time since the last horizontal sync into a pixel column and the lines since the last vertical sync into a row.

export interface VgaMode {
  name: string;
  w: number;
  h: number;
  // in pixels / lines: visible area, front porch, sync pulse, back porch
  hFront: number;
  hSync: number;
  hBack: number;
  vFront: number;
  vSync: number;
  vBack: number;
  pixelHz: number;
}

const mode = (name: string, w: number, hf: number, hs: number, hb: number, h: number, vf: number, vs: number, vb: number, pixelHz: number): VgaMode => ({
  name,
  w,
  h,
  hFront: hf,
  hSync: hs,
  hBack: hb,
  vFront: vf,
  vSync: vs,
  vBack: vb,
  pixelHz,
});

export const VGA_MODES: VgaMode[] = [
  mode('640×480 @ 60 Hz', 640, 16, 96, 48, 480, 10, 2, 33, 25.175e6),
  mode('800×600 @ 60 Hz', 800, 40, 128, 88, 600, 1, 4, 23, 40e6),
  mode('1024×768 @ 60 Hz', 1024, 24, 136, 160, 768, 3, 6, 29, 65e6),
];

export const hTotal = (m: VgaMode) => m.w + m.hFront + m.hSync + m.hBack;
export const vTotal = (m: VgaMode) => m.h + m.vFront + m.vSync + m.vBack;

export type VgaState = 'no-signal' | 'out-of-range' | 'ok';

export class VgaMonitor {
  // the picture, RGBA, mode.w × mode.h (only the visible area)
  pixels: Uint8ClampedArray;
  mode: VgaMode = VGA_MODES[0];
  frames = 0; // complete frames seen
  // board cycles per frame / per line, as measured
  framePeriod = 0;
  linePeriod = 0;
  dirty = true;
  // called when the mode changes (the picture size changes)
  onMode: (m: VgaMode) => void = () => {};

  private cpp: number; // board cycles per pixel
  private hs = 1;
  private vs = 1;
  private color = 0; // 12-bit {r, g, b}
  private tLast = 0;
  // sync polarity: the level that means "in the sync pulse"; found from which level is shorter
  private hsPol = 0;
  private vsPol = 0;
  private hsSince = 0;
  private vsSince = 0;
  private hsDur = [0, 0];
  private vsDur = [0, 0];
  private hsLead = -1; // cycle of the last horizontal sync leading edge
  private lines = 0; // horizontal syncs seen
  private vsLine = -1; // value of `lines` at the line that holds the vertical sync leading edge
  private vsLead = -1;
  private lastSyncAt = -Infinity;
  private rangeOk = true;

  constructor(public clockHz: number) {
    this.cpp = clockHz / VGA_MODES[0].pixelHz;
    this.pixels = new Uint8ClampedArray(this.mode.w * this.mode.h * 4);
    this.clear();
  }

  clear() {
    this.pixels.fill(0);
    for (let i = 3; i < this.pixels.length; i += 4) this.pixels[i] = 255;
    this.dirty = true;
  }

  // restart at board cycle t with the given line levels (after a reset or a new design)
  reset(t: number, hs: number, vs: number, color: number) {
    this.hs = hs;
    this.vs = vs;
    this.color = color;
    this.tLast = t;
    this.hsSince = this.vsSince = t;
    this.hsDur = [0, 0];
    this.vsDur = [0, 0];
    this.hsLead = -1;
    this.vsLead = -1;
    this.lines = 0;
    this.vsLine = -1;
    this.frames = 0;
    this.lastSyncAt = -Infinity;
    this.linePeriod = this.framePeriod = 0;
    this.clear();
  }

  // the line levels are (hs, vs, color) from board cycle t on
  feed(t: number, hs: number, vs: number, color: number) {
    if (t > this.tLast) this.paint(this.tLast, t, this.color);
    this.tLast = Math.max(this.tLast, t);
    if (hs !== this.hs) {
      this.hsDur[this.hs] = t - this.hsSince;
      this.hsSince = t;
      if (this.hsDur[0] && this.hsDur[1]) this.hsPol = this.hsDur[0] <= this.hsDur[1] ? 0 : 1;
      this.hs = hs;
      if (hs === this.hsPol) this.hsyncLead(t);
    }
    if (vs !== this.vs) {
      this.vsDur[this.vs] = t - this.vsSince;
      this.vsSince = t;
      if (this.vsDur[0] && this.vsDur[1]) this.vsPol = this.vsDur[0] <= this.vsDur[1] ? 0 : 1;
      this.vs = vs;
      if (vs === this.vsPol) this.vsyncLead(t);
    }
    this.color = color;
  }

  // what the monitor shows at board cycle `now`
  state(now: number): VgaState {
    if (this.linePeriod === 0 || this.framePeriod === 0 || now - this.lastSyncAt > 4 * Math.max(this.framePeriod, this.linePeriod * 600)) return 'no-signal';
    return this.rangeOk ? 'ok' : 'out-of-range';
  }

  get refreshHz() {
    return this.framePeriod ? this.clockHz / this.framePeriod : 0;
  }

  // colour (12-bit) of a visible pixel
  pixel(x: number, y: number): number {
    const i = (y * this.mode.w + x) * 4;
    const p = this.pixels;
    return ((p[i] >> 4) << 8) | ((p[i + 1] >> 4) << 4) | (p[i + 2] >> 4);
  }

  private hsyncLead(t: number) {
    if (this.hsLead >= 0) {
      this.linePeriod = t - this.hsLead;
      this.pickMode();
    }
    this.hsLead = t;
    this.lines++;
    this.lastSyncAt = t;
  }

  private vsyncLead(t: number) {
    // a vertical sync that starts late in a line belongs to the next one
    const late = this.hsLead >= 0 && this.linePeriod > 0 && t - this.hsLead > this.linePeriod / 2;
    this.vsLine = this.lines + (late ? 1 : 0);
    if (this.vsLead >= 0) {
      this.framePeriod = t - this.vsLead;
      this.frames++;
    }
    this.vsLead = t;
    this.dirty = true;
  }

  private pickMode() {
    const us = (this.linePeriod / this.clockHz) * 1e6;
    let best: VgaMode | null = null;
    let err = Infinity;
    for (const m of VGA_MODES) {
      const e = Math.abs(us / ((hTotal(m) / m.pixelHz) * 1e6) - 1);
      if (e < err) {
        err = e;
        best = m;
      }
    }
    this.rangeOk = err < 0.05;
    if (!best || !this.rangeOk) return;
    if (best !== this.mode) {
      this.mode = best;
      this.pixels = new Uint8ClampedArray(best.w * best.h * 4);
      this.clear();
      this.onMode(best);
    }
    this.cpp = this.linePeriod / hTotal(best);
  }

  // paints [a, b) board cycles in the current line with a colour
  private paint(a: number, b: number, color: number) {
    if (this.hsLead < 0 || this.vsLine < 0 || !this.rangeOk) return;
    const m = this.mode;
    const y = this.lines - this.vsLine - m.vSync - m.vBack;
    if (y < 0 || y >= m.h) return;
    const off = m.hSync + m.hBack;
    // pixel p is shown with the colour at the middle of its time slot
    const x0 = Math.max(0, Math.ceil((a - this.hsLead) / this.cpp - off - 0.5));
    const x1 = Math.min(m.w, Math.ceil((b - this.hsLead) / this.cpp - off - 0.5));
    if (x1 <= x0) return;
    const r = ((color >> 8) & 15) * 17;
    const g = ((color >> 4) & 15) * 17;
    const bl = (color & 15) * 17;
    const px = this.pixels;
    for (let x = x0, i = (y * m.w + x0) * 4; x < x1; x++, i += 4) {
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = bl;
    }
    this.dirty = true;
  }
}

// Reads the VGA lines of a mapped design from the simulator's signal values.
export interface VgaTap {
  sigs: number[];
  read(v: Uint32Array | number[]): { hs: number; vs: number; color: number };
}

export function vgaTap(bindings: { sig: number; bit: number; device: { kind: string } }[]): VgaTap | null {
  const vga = bindings.filter((b) => b.device.kind === 'vga') as { sig: number; bit: number; device: { kind: 'vga'; line: 'r' | 'g' | 'b' | 'hs' | 'vs'; bit: number } }[];
  const hs = vga.find((b) => b.device.line === 'hs');
  const vs = vga.find((b) => b.device.line === 'vs');
  if (!hs || !vs) return null;
  const col = vga.filter((b) => b.device.line === 'r' || b.device.line === 'g' || b.device.line === 'b');
  const shift = { r: 8, g: 4, b: 0 } as Record<string, number>;
  return {
    sigs: [...new Set(vga.map((b) => b.sig))],
    read(v) {
      let color = 0;
      for (const b of col) if ((v[b.sig] >>> b.bit) & 1) color |= 1 << (shift[b.device.line] + b.device.bit);
      return { hs: (v[hs.sig] >>> hs.bit) & 1, vs: (v[vs.sig] >>> vs.bit) & 1, color };
    },
  };
}
