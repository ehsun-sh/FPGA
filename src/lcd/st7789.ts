// A model of the 1.3-inch IPS LCD on the EBAZ4205 extension board, assumed to be a 240x240 ST7789 on 4-wire SPI
// (docs/EBAZ4205-ROADMAP.md, E4.1). It is fed the LCD lines every time one of them changes, decodes the SPI bytes
// (sampled on the rising edge of SCL, D/C read with the last bit, as in SPI mode 0 or 3) and runs the commands a
// lesson needs into an RGB565 frame memory: SWRESET, SLPIN/SLPOUT, COLMOD, MADCTL, INVOFF/INVON, CASET, RASET,
// RAMWR, DISPOFF/DISPON. Mistakes a real panel punishes silently (no SLPOUT, too short a wait, wrong colour mode)
// are reported as warnings instead.

export const LCD_W = 240;
export const LCD_H = 240;

export interface LcdLines {
  scl: number;
  sda: number;
  dc: number;
  cs: number; // 0 = selected (modules without a CS pin are always selected)
  res: number; // 0 = in reset
  blk: number; // backlight, 1 = on
}

export interface LcdWarning {
  code: string;
  text: string;
}

const CMD_NAMES: Record<number, string> = {
  0x01: 'SWRESET',
  0x10: 'SLPIN',
  0x11: 'SLPOUT',
  0x13: 'NORON',
  0x20: 'INVOFF',
  0x21: 'INVON',
  0x28: 'DISPOFF',
  0x29: 'DISPON',
  0x2a: 'CASET',
  0x2b: 'RASET',
  0x2c: 'RAMWR',
  0x36: 'MADCTL',
  0x3a: 'COLMOD',
};
export const cmdName = (c: number) => CMD_NAMES[c] ?? `0x${c.toString(16).toUpperCase().padStart(2, '0')}`;

// RGB565 -> 8-bit channels
export const rgb565 = (p: number): [number, number, number] => [((p >> 11) & 31) * 255 / 31, ((p >> 5) & 63) * 255 / 63, (p & 31) * 255 / 31].map(Math.round) as [number, number, number];

export class St7789 {
  // the frame memory as written (RGB565, row-major, 240 x 240)
  fb = new Uint16Array(LCD_W * LCD_H);
  dirty = true;
  // state the lesson and the checker can read
  sleeping = true;
  displayOn = false;
  inverted = false;
  colmod = 0x66; // 18-bit colour after reset
  madctl = 0;
  bytes = 0; // SPI bytes received
  pixels = 0; // pixels written since the last RAMWR
  onWarn: (w: LcdWarning) => void = () => {};
  warnings: LcdWarning[] = [];

  private l: LcdLines = { scl: 0, sda: 0, dc: 0, cs: 1, res: 1, blk: 1 };
  private shift = 0;
  private nbits = 0;
  private cmd = -1;
  private params: number[] = [];
  private xs = 0;
  private xe = LCD_W - 1;
  private ys = 0;
  private ye = LCD_H - 1;
  private x = 0;
  private y = 0;
  private part: number[] = [];
  private resetAt = 0; // board cycle the last reset (hardware or SWRESET) ended
  private sleepOutAt = -1;
  private seen = new Set<string>();

  // strict: report too-short waits (off for checkers, which shrink the delays)
  constructor(
    private clockHz: number,
    private strict = true,
  ) {
    this.powerOn(0);
  }

  // power-on: the frame memory holds noise until it is written
  powerOn(t: number) {
    let s = 0x2545f491;
    for (let i = 0; i < this.fb.length; i++) {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      this.fb[i] = s & 0xffff;
    }
    this.seen.clear();
    this.warnings = [];
    this.bytes = 0;
    this.reset(t);
  }

  // hardware or software reset: registers to their defaults, the frame memory keeps its contents
  private reset(t: number) {
    this.sleeping = true;
    this.displayOn = false;
    this.inverted = false;
    this.colmod = 0x66;
    this.madctl = 0;
    this.xs = this.ys = 0;
    this.xe = LCD_W - 1;
    this.ye = LCD_H - 1;
    this.cmd = -1;
    this.params = [];
    this.part = [];
    this.shift = this.nbits = 0;
    this.resetAt = t;
    this.sleepOutAt = -1;
    this.dirty = true;
  }

  // starts again with the lines' current levels (a new run of the design)
  restart(t: number, l: LcdLines) {
    this.l = { ...l };
    this.powerOn(t);
  }

  private warn(code: string, text: string) {
    if (this.seen.has(code)) return;
    this.seen.add(code);
    const w = { code, text };
    this.warnings.push(w);
    this.onWarn(w);
  }

  private ms(t: number, since: number) {
    return ((t - since) / this.clockHz) * 1000;
  }

  feed(t: number, l: LcdLines) {
    const prev = this.l;
    this.l = { ...l };
    if (prev.res !== l.res) {
      if (!l.res) this.reset(t);
      else this.resetAt = t;
      this.dirty = true;
    }
    if (prev.blk !== l.blk) this.dirty = true;
    if (!l.res) return;
    // CS high ends a transfer: a half-received byte is dropped
    if (l.cs) {
      this.nbits = 0;
      this.shift = 0;
      return;
    }
    if (!prev.scl && l.scl) {
      this.shift = ((this.shift << 1) | (l.sda & 1)) & 0xff;
      if (++this.nbits === 8) {
        this.nbits = 0;
        this.bytes++;
        if (l.dc) this.data(t, this.shift);
        else this.command(t, this.shift);
      }
    }
  }

  private command(t: number, c: number) {
    if (this.strict && this.ms(t, this.resetAt) < 5)
      this.warn('LCD 2', `${cmdName(c)} came ${this.ms(t, this.resetAt).toFixed(2)} ms after a reset; the ST7789 needs 5 ms before the next command`);
    if (this.strict && this.sleepOutAt >= 0 && this.ms(t, this.sleepOutAt) < 5)
      this.warn('LCD 3', `${cmdName(c)} came ${this.ms(t, this.sleepOutAt).toFixed(2)} ms after SLPOUT; wait at least 5 ms (120 ms before the picture is stable)`);
    this.cmd = c;
    this.params = [];
    this.part = [];
    switch (c) {
      case 0x01:
        this.reset(t);
        break;
      case 0x10:
        this.sleeping = true;
        this.dirty = true;
        break;
      case 0x11:
        if (this.strict && this.ms(t, this.resetAt) < 120)
          this.warn('LCD 4', `SLPOUT came ${this.ms(t, this.resetAt).toFixed(1)} ms after the reset; the ST7789 needs 120 ms`);
        this.sleeping = false;
        this.sleepOutAt = t;
        this.dirty = true;
        break;
      case 0x20:
      case 0x21:
        this.inverted = c === 0x21;
        this.dirty = true;
        break;
      case 0x28:
      case 0x29:
        this.displayOn = c === 0x29;
        if (this.displayOn && this.sleeping) this.warn('LCD 5', 'DISPON while the display sleeps: send SLPOUT (0x11) first, or the screen stays dark');
        this.dirty = true;
        break;
      case 0x2c:
        this.x = this.xs;
        this.y = this.ys;
        this.pixels = 0;
        if (this.sleeping) this.warn('LCD 6', 'RAMWR while the display sleeps: pixels are stored, but nothing shows until SLPOUT (0x11)');
        if ((this.colmod & 7) !== 5) this.warn('LCD 7', `the colour mode is 0x${this.colmod.toString(16)} (18-bit, 3 bytes per pixel); send COLMOD (0x3A) with 0x55 for 16-bit RGB565`);
        break;
    }
  }

  private data(_t: number, b: number) {
    const c = this.cmd;
    if (c < 0) {
      this.warn('LCD 1', 'a data byte (D/C = 1) came before any command: D/C must be 0 for command bytes');
      return;
    }
    if (c === 0x2c) {
      this.part.push(b);
      const n = (this.colmod & 7) === 5 ? 2 : 3;
      if (this.part.length < n) return;
      const p = n === 2 ? (this.part[0] << 8) | this.part[1] : ((this.part[0] >> 3) << 11) | ((this.part[1] >> 2) << 5) | (this.part[2] >> 3);
      this.part = [];
      this.put(p);
      return;
    }
    this.params.push(b);
    const p = this.params;
    if (c === 0x2a && p.length === 4) {
      this.xs = (p[0] << 8) | p[1];
      this.xe = (p[2] << 8) | p[3];
    } else if (c === 0x2b && p.length === 4) {
      this.ys = (p[0] << 8) | p[1];
      this.ye = (p[2] << 8) | p[3];
    } else if (c === 0x3a && p.length === 1) this.colmod = b;
    else if (c === 0x36 && p.length === 1) this.madctl = b;
  }

  // one pixel at the write pointer, which walks the CASET/RASET window row by row (MADCTL MY, MX, MV respected)
  private put(p: number) {
    let col = this.x;
    let row = this.y;
    const m = this.madctl;
    if (m & 0x20) [col, row] = [row, col];
    if (m & 0x40) col = LCD_W - 1 - col;
    if (m & 0x80) row = LCD_H - 1 - row;
    if (col >= 0 && col < LCD_W && row >= 0 && row < LCD_H) {
      this.fb[row * LCD_W + col] = p;
      this.dirty = true;
    }
    this.pixels++;
    if (++this.x > this.xe) {
      this.x = this.xs;
      if (++this.y > this.ye) this.y = this.ys;
    }
  }

  // what the panel shows: dark without backlight, in reset, asleep or with the display off. An IPS panel shows
  // the frame memory's colours inverted unless INVON was sent.
  get lit() {
    return !!(this.l.res && this.l.blk && !this.sleeping && this.displayOn);
  }

  // the visible picture as RGBA (240 x 240)
  render(out: Uint8ClampedArray) {
    this.dirty = false;
    const on = this.lit;
    for (let i = 0, j = 0; i < this.fb.length; i++, j += 4) {
      if (!on) {
        out[j] = out[j + 1] = out[j + 2] = 8;
      } else {
        const [r, g, b] = rgb565(this.inverted ? this.fb[i] : ~this.fb[i] & 0xffff);
        out[j] = r;
        out[j + 1] = g;
        out[j + 2] = b;
      }
      out[j + 3] = 255;
    }
  }

  // the colour a pixel shows (RGB565, after inversion); -1 when the panel is dark
  shown(x: number, y: number): number {
    if (!this.lit) return -1;
    const p = this.fb[y * LCD_W + x];
    return this.inverted ? p : ~p & 0xffff;
  }
}

// Reads the LCD lines of a mapped design from the simulator's signal values.
export interface LcdTap {
  sigs: number[];
  read(v: Uint32Array | number[]): LcdLines;
}

export function lcdTap(bindings: { sig: number; bit: number; device: { kind: string } }[]): LcdTap | null {
  const lcd = bindings.filter((b) => b.device.kind === 'lcd') as { sig: number; bit: number; device: { kind: 'lcd'; line: string } }[];
  const get = (n: string) => lcd.find((b) => b.device.line === n);
  const scl = get('scl');
  const sda = get('sda');
  if (!scl || !sda) return null;
  const lines = ['dc', 'cs', 'res', 'blk'].map(get);
  // missing lines: no CS pin = always selected, no RES / BLK = not in reset and lit; no DC = every byte a command
  const def = [0, 0, 1, 1];
  const bit = (v: Uint32Array | number[], b: { sig: number; bit: number }) => (v[b.sig] >>> b.bit) & 1;
  return {
    sigs: [...new Set(lcd.map((b) => b.sig))],
    read(v) {
      const [dc, cs, res, blk] = lines.map((b, i) => (b ? bit(v, b) : def[i]));
      return { scl: bit(v, scl), sda: bit(v, sda), dc, cs, res, blk };
    },
  };
}
