// Modules attached to board pins, driven through a design that passes switches to the pins and pins to the LEDs.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD } from '../src/boards';
import { BoardHarness } from '../src/grade/harness';
import { synthesize } from '../src/hdl';

const XDC = DEFAULT_BOARD.masterXdc({ clk: true, sw: true, led: true, pmod: true, tmp: true, acl: true });
const board = (src: string) => new BoardHarness(synthesize(src, 'verilog'), XDC, DEFAULT_BOARD);

describe('ADT7420 temperature sensor (I²C, open drain)', () => {
  // SW0 releases SCL, SW1 releases SDA; LED0 shows SDA on the wire
  const h = () =>
    board(`module top (input wire CLK100MHZ, input wire [15:0] SW, inout wire TMP_SCL, inout wire TMP_SDA, output wire [15:0] LED);
    assign TMP_SCL = SW[0] ? 1'bz : 1'b0;
    assign TMP_SDA = SW[1] ? 1'bz : 1'b0;
    assign LED = {14'b0, TMP_SCL, TMP_SDA};
endmodule`);

  function master(b: BoardHarness) {
    let scl = 1;
    let sda = 1;
    const set = () => {
      b.sw(scl | (sda << 1));
      b.run(50);
    };
    const bit = (v: number) => {
      sda = v;
      set();
      scl = 1;
      set();
      const r = b.led() & 1;
      scl = 0;
      set();
      return r;
    };
    return {
      start() {
        sda = 1;
        scl = 1;
        set();
        sda = 0;
        set();
        scl = 0;
        set();
      },
      stop() {
        sda = 0;
        set();
        scl = 1;
        set();
        sda = 1;
        set();
      },
      write(byte: number): boolean {
        for (let i = 7; i >= 0; i--) bit((byte >> i) & 1);
        return bit(1) === 0; // ACK
      },
      read(ackIt: boolean): number {
        let v = 0;
        for (let i = 0; i < 8; i++) v = (v << 1) | bit(1);
        bit(ackIt ? 0 : 1);
        return v;
      },
    };
  }

  it('answers at 0x4B with the temperature and its ID', () => {
    const b = h();
    const t = b.attach('adt7420', undefined, { temp: 25.5 });
    const m = master(b);
    b.sw(3);
    b.run(100);
    expect(b.led() & 3).toBe(3); // released: the pull-ups hold both lines high
    m.start();
    expect(m.write((0x4b << 1) | 1)).toBe(true);
    const hi = m.read(true);
    const lo = m.read(false);
    m.stop();
    expect(((hi << 8) | lo) >> 3).toBe(25.5 * 16);
    // pointer to the ID register, then a repeated-start read
    m.start();
    expect(m.write(0x4b << 1)).toBe(true);
    expect(m.write(0x0b)).toBe(true);
    m.start();
    expect(m.write((0x4b << 1) | 1)).toBe(true);
    expect(m.read(false)).toBe(0xcb);
    m.stop();
    // another address gets no ACK
    m.start();
    expect(m.write(0x48 << 1)).toBe(false);
    m.stop();
    // the slider changes the reading
    t.set!('temp', -5);
    m.start();
    m.write(0x4b << 1);
    m.write(0x00);
    m.start();
    m.write((0x4b << 1) | 1);
    const raw = (m.read(true) << 8) | m.read(false);
    m.stop();
    expect(((raw << 16) >> 16) >> 3).toBe(-5 * 16);
  });
});

describe('ADXL362 accelerometer (SPI mode 0)', () => {
  const src = `module top (input wire CLK100MHZ, input wire [15:0] SW, input wire ACL_MISO, output wire ACL_SCLK, ACL_MOSI, ACL_CSN, output wire [15:0] LED);
    assign ACL_SCLK = SW[0];
    assign ACL_MOSI = SW[1];
    assign ACL_CSN  = ~SW[2];
    assign LED = {15'b0, ACL_MISO};
endmodule`;

  function xfer(b: BoardHarness, bytes: number[]): number[] {
    const out: number[] = [];
    let sw = 4; // CS low
    b.sw(sw);
    b.run(20);
    for (const byte of bytes) {
      let r = 0;
      for (let i = 7; i >= 0; i--) {
        sw = (sw & ~3) | (((byte >> i) & 1) << 1);
        b.sw(sw);
        b.run(10);
        r = (r << 1) | (b.led() & 1); // sample MISO at the rising edge
        b.sw(sw | 1);
        b.run(10);
        b.sw(sw);
        b.run(10);
      }
      out.push(r);
    }
    b.sw(0);
    b.run(20);
    return out;
  }

  it('reads its ID, and X/Y/Z once measuring', () => {
    const b = board(src);
    const acl = b.attach('adxl362', undefined, { x: 0.5, y: -0.25, z: 1 });
    expect(xfer(b, [0x0b, 0x00, 0, 0, 0])).toEqual([0, 0, 0xad, 0x1d, 0xf2]);
    expect(xfer(b, [0x0b, 0x08, 0])[2]).toBe(0); // standby
    xfer(b, [0x0a, 0x2d, 0x02]); // POWER_CTL: measure
    const [, , x, y, z] = xfer(b, [0x0b, 0x08, 0, 0, 0]);
    expect([x, y, (z << 24) >> 24]).toEqual([(500 >> 4) & 0xff, (-250 >> 4) & 0xff, 1000 >> 4]);
    const d = xfer(b, [0x0b, 0x0e, 0, 0]);
    expect(((d[3] << 8) | d[2]) & 0xffff).toBe(500);
    acl.set!('x', -1);
    const e = xfer(b, [0x0b, 0x0e, 0, 0]);
    expect((((e[3] << 8) | e[2]) << 16) >> 16).toBe(-1000);
  });
});

describe('external modules', () => {
  const src = `module top (input wire CLK100MHZ, input wire [15:0] SW, input wire [4:1] JB, output wire [4:1] JA, output wire [15:0] LED);
    assign JA  = SW[3:0];
    assign LED = {12'b0, JB};
endmodule`;
  const JA = (n: number) => DEFAULT_BOARD.headers[0].pins[n];
  const JB = (n: number) => DEFAULT_BOARD.headers[1].pins[n];

  it('HC-SR04 answers a trigger pulse with an echo 58 µs per cm', () => {
    const b = board(src);
    b.attach('hcsr04', { trig: JA(1), echo: JB(1) }, { cm: 100 });
    b.run(100);
    b.sw(1);
    b.run(1000); // 10 µs
    b.sw(0);
    let start = -1;
    let end = -1;
    for (let i = 0; i < 20000 && end < 0; i++) {
      b.run(100);
      const e = b.led() & 1;
      if (e && start < 0) start = b.cycles;
      if (!e && start >= 0) end = b.cycles;
    }
    expect(Math.abs((end - start) / 100 - 5800)).toBeLessThan(15); // µs
  });

  it('Pmod BTN, Pmod SWT and the encoder drive FPGA inputs', () => {
    const b = board(src);
    const btn = b.attach('pmod_btn', { btn0: JB(1), btn1: JB(2), btn2: JB(3), btn3: JB(4) });
    expect(b.led() & 15).toBe(0);
    btn.set!('btn2', 1);
    expect(b.led() & 15).toBe(4);
    btn.set!('btn2', 0);
    expect(b.led() & 15).toBe(0);

    const c = board(src);
    const enc = c.attach('pmod_enc', { a: JB(1), b: JB(2), btn: JB(3), swt: JB(4) });
    expect(c.led() & 3).toBe(3);
    enc.set!('cw', 1);
    const seen: number[] = [3];
    for (let i = 0; i < 50; i++) {
      c.run(10_000);
      const ab = c.led() & 3;
      if (seen[seen.length - 1] !== ab) seen.push(ab);
    }
    // A (bit 0) falls first when turning clockwise
    expect(seen).toEqual([3, 2, 0, 1, 3]);
    expect(enc.read!('pos')).toBe('1');
  });

  it('Pmod 8LD shows the share of time each LED is on, and the servo reads the pulse width', () => {
    const b = board(src);
    const ld = b.attach('pmod_8ld', { ld0: JA(1), ld1: JA(2), ld2: JA(3), ld3: JA(4), ld4: JA(7), ld5: JA(8), ld6: JA(9), ld7: JA(10) });
    b.sw(0b0011);
    b.run(1000);
    ld.read!('leds');
    for (let i = 0; i < 10; i++) {
      b.sw(0b0001);
      b.run(250);
      b.sw(0b0101);
      b.run(750);
    }
    const l = ld.read!('leds') as number[];
    expect(l[0]).toBeCloseTo(1, 2);
    expect(l[1]).toBe(0);
    expect(l[2]).toBeCloseTo(0.75, 2);

    const s = board(src);
    const servo = s.attach('servo', { pwm: JA(1) });
    for (let i = 0; i < 3; i++) {
      s.sw(1);
      s.run(150_000);
      s.sw(0);
      s.run(1_850_000);
    }
    expect(servo.read!('angle')).toBe('90° (1.50 ms, 50 Hz)');
  });
});
