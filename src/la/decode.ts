// Protocol decoders for the logic analyzer. They work on a captured Trace (times in clock cycles).
import type { Trace } from './capture';

export interface Ann {
  t0: number;
  t1: number;
  text: string; // full label, e.g. "'H' 0x48"
  short: string; // label for narrow boxes
  kind: 'data' | 'ctrl' | 'err';
  row?: number; // sub-row for decoders with several lines (SPI MOSI/MISO)
}

// transitions of one channel
export class Bits {
  ts: number[] = [];
  lv: number[] = [];
  init: number;
  constructor(tr: Trace, ch: number) {
    this.init = (tr.init >>> ch) & 1;
    let cur = this.init;
    for (let i = 0; i < tr.times.length; i++) {
      const b = (tr.vals[i] >>> ch) & 1;
      if (b !== cur) {
        this.ts.push(tr.times[i]);
        this.lv.push(b);
        cur = b;
      }
    }
  }
  // number of transitions at or before t
  private count(t: number) {
    let lo = 0;
    let hi = this.ts.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (this.ts[m] <= t) lo = m + 1;
      else hi = m;
    }
    return lo;
  }
  at(t: number): number {
    const k = this.count(t);
    return k ? this.lv[k - 1] : this.init;
  }
  // level just before time t (what a flip-flop clocked at t would capture)
  before(t: number) {
    return this.at(t - 0.5);
  }
  // index of the first transition at or after t
  from(t: number) {
    return this.count(t - 0.5);
  }
}

const hex = (v: number, bits: number) => '0x' + v.toString(16).toUpperCase().padStart(Math.ceil(bits / 4), '0');
const printable = (v: number) => (v >= 0x20 && v < 0x7f ? `'${String.fromCharCode(v)}'` : v === 10 ? '\\n' : v === 13 ? '\\r' : '');

export interface UartCfg {
  ch: number;
  baud: number;
  bits: number;
  parity: 'none' | 'even' | 'odd';
  stop: 1 | 2;
}

export function decodeUart(tr: Trace, c: UartCfg, hz: number): Ann[] {
  const b = new Bits(tr, c.ch);
  const T = hz / c.baud;
  const out: Ann[] = [];
  let after = -Infinity;
  for (let i = 0; i < b.ts.length; i++) {
    const s = b.ts[i];
    if (b.lv[i] !== 0 || s < after) continue;
    if (b.at(s + T / 2) !== 0) continue; // glitch, not a start bit
    let data = 0;
    let ones = 0;
    for (let k = 0; k < c.bits; k++) {
      if (b.at(s + (1.5 + k) * T)) {
        data |= 1 << k;
        ones++;
      }
    }
    let p = s + (1.5 + c.bits) * T;
    let parityOk = true;
    if (c.parity !== 'none') {
      const pb = b.at(p);
      parityOk = ((ones + pb) & 1) === (c.parity === 'even' ? 0 : 1);
      p += T;
    }
    const stopOk = b.at(p) === 1 && (c.stop === 1 || b.at(p + T) === 1);
    const end = p + (c.stop - 0.5) * T;
    if (end > tr.t1) break;
    const ch = printable(data);
    const err = !stopOk ? ' framing error' : !parityOk ? ' parity error' : '';
    out.push({ t0: s, t1: end + T / 2, text: `${ch ? ch + ' ' : ''}${hex(data, c.bits)}${err}`, short: ch || hex(data, c.bits), kind: err ? 'err' : 'data' });
    after = p + (c.stop - 1) * T; // the next start bit can begin after the middle of the (last) stop bit
  }
  return out;
}

export interface SpiCfg {
  clk: number;
  mosi: number;
  miso: number | null;
  cs: number | null; // active-low chip select
  mode: 0 | 1 | 2 | 3;
  bits: number;
  msbFirst: boolean;
}

export function decodeSpi(tr: Trace, c: SpiCfg): Ann[] {
  const clk = new Bits(tr, c.clk);
  const mosi = new Bits(tr, c.mosi);
  const miso = c.miso === null ? null : new Bits(tr, c.miso);
  const cs = c.cs === null ? null : new Bits(tr, c.cs);
  const cpol = c.mode >> 1;
  const cpha = c.mode & 1;
  const sampleLevel = cpol ^ cpha ? 0 : 1; // clock level right after the sampling edge
  const out: Ann[] = [];
  let n = 0;
  let wo = 0;
  let wi = 0;
  let first = 0;
  // chip-select edges reset the bit counter
  const events: { t: number; kind: 'clk' | 'cs'; lv: number }[] = [];
  clk.ts.forEach((t, i) => events.push({ t, kind: 'clk', lv: clk.lv[i] }));
  cs?.ts.forEach((t, i) => events.push({ t, kind: 'cs', lv: cs.lv[i] }));
  events.sort((a, b) => a.t - b.t || (a.kind === 'cs' ? -1 : 1));
  for (const e of events) {
    if (e.kind === 'cs') {
      if (e.lv === 1 && n > 0) out.push({ t0: first, t1: e.t, text: `partial (${n} bits)`, short: '?', kind: 'err' });
      n = 0;
      continue;
    }
    if (e.lv !== sampleLevel) continue;
    if (cs && cs.before(e.t) !== 0) continue;
    if (n === 0) {
      first = e.t;
      wo = 0;
      wi = 0;
    }
    const bo = mosi.before(e.t);
    const bi = miso ? miso.before(e.t) : 0;
    if (c.msbFirst) {
      wo = (wo << 1) | bo;
      wi = (wi << 1) | bi;
    } else {
      wo |= bo << n;
      wi |= bi << n;
    }
    n++;
    if (n === c.bits) {
      const end = e.t + 1;
      out.push({ t0: first, t1: end, text: `MOSI ${hex(wo >>> 0, c.bits)}`, short: hex(wo >>> 0, c.bits), kind: 'data', row: 0 });
      if (miso) out.push({ t0: first, t1: end, text: `MISO ${hex(wi >>> 0, c.bits)}`, short: hex(wi >>> 0, c.bits), kind: 'data', row: 1 });
      n = 0;
    }
  }
  return out;
}

export interface I2cCfg {
  scl: number;
  sda: number;
}

export function decodeI2c(tr: Trace, c: I2cCfg): Ann[] {
  const scl = new Bits(tr, c.scl);
  const sda = new Bits(tr, c.sda);
  const events: { t: number; kind: 'scl' | 'sda'; lv: number }[] = [];
  scl.ts.forEach((t, i) => events.push({ t, kind: 'scl', lv: scl.lv[i] }));
  sda.ts.forEach((t, i) => events.push({ t, kind: 'sda', lv: sda.lv[i] }));
  events.sort((a, b) => a.t - b.t);
  const out: Ann[] = [];
  let active = false;
  let n = 0;
  let byte = 0;
  let first = 0;
  let isAddr = false;
  let lastRise = 0;
  let period = 0;
  for (const e of events) {
    if (e.kind === 'sda') {
      if (scl.at(e.t) !== 1) continue;
      if (e.lv === 0) {
        out.push({ t0: e.t, t1: e.t, text: active ? 'Repeated start' : 'Start', short: active ? 'Sr' : 'S', kind: 'ctrl' });
        active = true;
        isAddr = true;
        n = 0;
      } else if (active) {
        out.push({ t0: e.t, t1: e.t, text: 'Stop', short: 'P', kind: 'ctrl' });
        active = false;
      }
      continue;
    }
    if (!active || e.lv !== 1) continue;
    const bit = sda.at(e.t);
    if (lastRise) period = e.t - lastRise;
    lastRise = e.t;
    if (n < 8) {
      if (n === 0) {
        first = e.t;
        byte = 0;
      }
      byte = (byte << 1) | bit;
      n++;
      if (n === 8) {
        const t1 = e.t + Math.max(1, period / 2);
        if (isAddr) {
          const rw = byte & 1 ? 'R' : 'W';
          out.push({ t0: first - period / 2, t1, text: `Address ${hex(byte >> 1, 7)} ${rw}`, short: `${hex(byte >> 1, 7)} ${rw}`, kind: 'data' });
        } else {
          const ch = printable(byte);
          out.push({ t0: first - period / 2, t1, text: `${ch ? ch + ' ' : ''}${hex(byte, 8)}`, short: hex(byte, 8), kind: 'data' });
        }
      }
    } else {
      const t0 = e.t - period / 2;
      out.push({ t0, t1: e.t + period / 2, text: bit ? 'NAK' : 'ACK', short: bit ? 'N' : 'A', kind: bit ? 'err' : 'ctrl' });
      n = 0;
      isAddr = false;
    }
  }
  // zero-width markers get a small box around them
  return out.map((a) => (a.t1 > a.t0 ? a : { ...a, t0: a.t0 - Math.max(1, period / 4), t1: a.t1 + Math.max(1, period / 4) }));
}

// Parallel bus: the value of several channels (LSB first) shown as hex.
export function decodeBus(tr: Trace, chans: number[]): Ann[] {
  const pack = (w: number) => chans.reduce((v, ch, i) => v | (((w >>> ch) & 1) << i), 0) >>> 0;
  const out: Ann[] = [];
  let cur = pack(tr.init);
  let since = tr.t0;
  for (let i = 0; i < tr.times.length; i++) {
    const v = pack(tr.vals[i]);
    if (v === cur) continue;
    out.push({ t0: since, t1: tr.times[i], text: hex(cur, chans.length), short: hex(cur, chans.length), kind: 'data' });
    cur = v;
    since = tr.times[i];
  }
  out.push({ t0: since, t1: tr.t1, text: hex(cur, chans.length), short: hex(cur, chans.length), kind: 'data' });
  return out;
}
