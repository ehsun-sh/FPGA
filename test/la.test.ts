import { describe, expect, it } from 'vitest';
import { Acquisition, Recorder } from '../src/la/capture';
import { decodeBus, decodeI2c, decodeSpi, decodeUart } from '../src/la/decode';

// builds a trace from per-channel level changes: [time, channel, level]
function trace(changes: [number, number, number][], init: number, t1: number) {
  const r = new Recorder(1 << 12);
  let w = init;
  r.push(0, w);
  for (const [t, ch, lv] of [...changes].sort((a, b) => a[0] - b[0])) {
    w = lv ? w | (1 << ch) : w & ~(1 << ch);
    r.push(t, w >>> 0);
  }
  return r.extract(0, t1);
}

describe('logic analyzer decoders', () => {
  it('UART 8N1', () => {
    const hz = 100e6;
    const T = Math.round(hz / 115200);
    const ch: [number, number, number][] = [];
    let t = 1000;
    for (const byte of [0x48, 0x69, 0x0d]) {
      const bits = [0, ...Array.from({ length: 8 }, (_, i) => (byte >> i) & 1), 1];
      bits.forEach((b, i) => ch.push([t + i * T, 0, b]));
      t += 10 * T + 300;
    }
    const tr = trace(ch, 1, t + 1000);
    const a = decodeUart(tr, { ch: 0, baud: 115200, bits: 8, parity: 'none', stop: 1 }, hz);
    expect(a.map((x) => x.short)).toEqual(["'H'", "'i'", '\\r']);
    expect(a.every((x) => x.kind === 'data')).toBe(true);
  });

  it('SPI mode 0 with chip select', () => {
    // ch0 = SCLK, ch1 = MOSI, ch2 = MISO, ch3 = CS
    const ch: [number, number, number][] = [[100, 3, 0]];
    const mo = 0xa5;
    const mi = 0x3c;
    for (let i = 0; i < 8; i++) {
      const t = 200 + i * 20;
      ch.push([t, 1, (mo >> (7 - i)) & 1], [t, 2, (mi >> (7 - i)) & 1], [t + 10, 0, 1], [t + 20, 0, 0]);
    }
    ch.push([400, 3, 1]);
    const tr = trace(ch, 0b1000, 500);
    const a = decodeSpi(tr, { clk: 0, mosi: 1, miso: 2, cs: 3, mode: 0, bits: 8, msbFirst: true });
    expect(a.map((x) => x.short)).toEqual(['0xA5', '0x3C']);
  });

  it('I2C write', () => {
    // ch0 = SCL, ch1 = SDA; both idle high
    const ch: [number, number, number][] = [[100, 1, 0]]; // start
    let t = 120;
    const bits = [...[0x50 << 1].flatMap((b) => Array.from({ length: 8 }, (_, i) => (b >> (7 - i)) & 1)), 0, ...Array.from({ length: 8 }, (_, i) => (0x12 >> (7 - i)) & 1), 1];
    ch.push([110, 0, 0]);
    for (const b of bits) {
      ch.push([t, 1, b], [t + 10, 0, 1], [t + 20, 0, 0]);
      t += 30;
    }
    ch.push([t, 1, 0], [t + 10, 0, 1], [t + 20, 1, 1]); // stop
    const tr = trace(ch, 0b11, t + 100);
    const a = decodeI2c(tr, { scl: 0, sda: 1 });
    expect(a.map((x) => x.short)).toEqual(['S', '0x50 W', 'A', '0x12', 'N', 'P']);
  });

  it('bus', () => {
    const tr = trace([[10, 0, 1], [20, 1, 1], [30, 0, 0]], 0, 40);
    expect(decodeBus(tr, [0, 1]).map((x) => x.short)).toEqual(['0x0', '0x1', '0x3', '0x2']);
  });

  it('edge trigger captures around the trigger point', () => {
    const acq = new Acquisition();
    acq.base = 10;
    acq.trigger = { ch: 0, edge: 'rise' };
    const v = new Uint32Array(1);
    acq.rec.setSources([{ sig: 0, bit: 0 }]);
    acq.sample(0, v);
    acq.run(0, true);
    v[0] = 1;
    acq.sample(500, v);
    expect(acq.tick(520)).toBe(false);
    expect(acq.tick(560)).toBe(true);
    expect(acq.window).toEqual([450, 550]);
    expect(acq.state).toBe('stopped');
  });
});
