// The EBAZ4205 extension board (docs/EBAZ4205-ROADMAP.md, Phases E3 and E4): its pins, the HDMI decoder, the LCD
// model, the board-library serializer in the Vivado project, and the HDMI exercise's testbench checker.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getBoard, setEbazExtension } from '../src/boards';
import { BUZZER, KEYS, LCD, masterXdc, pinsFor } from '../src/boards/ebaz4205/pins';
import * as X from '../src/boards/ebaz4205/extcode';
import { TMDS_SERIALIZER_V, withLibrary } from '../src/boards/library';
import { compileDesign, synthesize } from '../src/hdl';
import { BoardHarness } from '../src/grade/harness';
import { gradeExercise } from '../src/grade/grade';
import { EXERCISES } from '../src/grade/exercises';
import { ALL_LESSONS } from '../src/lessons/course';
import { St7789, type LcdLines } from '../src/lcd/st7789';
import { projectFiles, type ProjectSpec } from '../src/synth/project';
import { tmdsDecode, TMDS_CTL } from '../src/vga/hdmi';

const EBAZ = getBoard('ebaz4205');

describe('extension board pins (vendor schematic)', () => {
  it('has five active-low keys, the buzzer on D18 and the LCD without a CS pin', () => {
    expect(KEYS).toEqual([
      ['KEY1', 'T19'],
      ['KEY2', 'P19'],
      ['KEY3', 'U20'],
      ['KEY4', 'U19'],
      ['KEY5', 'V20'],
    ]);
    expect(BUZZER).toEqual(['BUZZER', 'D18']);
    expect(Object.fromEntries(LCD.map(([n, p]) => [n, p]))).toEqual({ LCD_SCL: 'R19', LCD_SDA: 'P20', LCD_RES: 'N17', LCD_DC: 'R18', LCD_BLK: 'T20' });
    const pins = pinsFor(true);
    for (const [n, p] of KEYS) expect(pins[p]).toEqual({ kind: 'btn', name: n, activeLow: true });
    expect(pins.D18).toEqual({ kind: 'buzzer', name: 'BUZZER' });
    // every pin is used once
    const used = [...KEYS.map(([, p]) => p), BUZZER[1], ...LCD.map(([, p]) => p), 'E19', 'K17', 'H18', 'H16', 'H17', 'F19', 'F20', 'D19', 'D20', 'C20', 'B20', 'B19', 'A20'];
    expect(new Set(used).size).toBe(used.length);
  });

  it('writes a master XDC with no guessed pins', () => {
    const xdc = masterXdc({ key: true, buzzer: true, lcd: true, hdmi: true });
    expect(xdc).not.toMatch(/to be confirmed|assumed/);
    expect(xdc).toContain('PACKAGE_PIN T19 IOSTANDARD LVCMOS33 } [get_ports { KEY1 }]');
    expect(xdc).toContain('PACKAGE_PIN D18 IOSTANDARD LVCMOS33 } [get_ports { BUZZER }]');
    expect(xdc).toContain('PACKAGE_PIN F19 IOSTANDARD TMDS_33 } [get_ports { HDMI_CLK_P }]');
    expect(xdc).not.toContain('LCD_CS');
  });

  it('takes the extension board off and puts it back', () => {
    setEbazExtension(false);
    expect(EBAZ.io.buttons).toEqual([]);
    expect(EBAZ.io.leds).toBe(2);
    expect(EBAZ.pins.T19).toEqual({ kind: 'pin', name: 'DATA3_18' });
    setEbazExtension(true);
    expect(EBAZ.io.buttons).toEqual(['KEY1', 'KEY2', 'KEY3', 'KEY4', 'KEY5']);
    expect(EBAZ.io.leds).toBe(5);
  });
});

// a reference TMDS encoder (DVI 1.0 section 3.2.2) is in test/ebaz-drafts.test.ts; here the decoder is checked
// against the lesson drafts' encoder, symbol by symbol
describe('HDMI decoder', () => {
  for (const [f, lang] of [
    ['x_tmds.v', 'verilog'],
    ['x_tmds.vhd', 'vhdl'],
  ] as const)
    it(`round-trips 10,000 random symbols through ${f}`, () => {
      const d = synthesize(readFileSync(new URL(`../docs/ebaz4205/code/${f}`, import.meta.url), 'utf8'), lang);
      const port = (n: string) => d.ports.find((p) => p.name.toLowerCase() === n)!.id;
      const s = compileDesign(d, { clock: port('clk') });
      s.reset();
      const set = (n: string, v: number) => {
        s.v[port(n)] = v >>> 0;
        s.settle();
      };
      let seed = 4242;
      const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff) >>> 8;
      let bal = 0;
      for (let i = 0; i < 10000; i++) {
        const de = rnd() % 8 ? 1 : 0;
        const byte = rnd() & 0xff;
        const c = rnd() & 3;
        set('d', byte);
        set('c', c);
        set('de', de);
        s.run(1);
        const q = s.v[port('q')] & 0x3ff;
        const r = tmdsDecode(q);
        if (de) {
          expect(r, `symbol ${i}`).toEqual({ ctl: -1, byte });
          let ones = 0;
          for (let k = 0; k < 10; k++) ones += (q >> k) & 1;
          bal += 2 * ones - 10;
          expect(Math.abs(bal), `DC balance after symbol ${i}`).toBeLessThanOrEqual(10);
        } else {
          expect(q).toBe(TMDS_CTL[c]);
          expect(r.ctl).toBe(c);
          bal = 0;
        }
      }
    });

  it('shows "No signal", not a crash, for corrupt symbols', () => {
    const src = `module top (input wire clk, output wire HDMI_CLK_P, HDMI_CLK_N, HDMI_D0_P, HDMI_D0_N, HDMI_D1_P, HDMI_D1_N, HDMI_D2_P, HDMI_D2_N);
    reg [9:0] n = 0;
    always @(posedge clk) n <= n * 5 + 1;
    tmds_serializer ser (.clk(clk), .d0(n), .d1(~n), .d2(n ^ 10'h155),
        .clk_p(HDMI_CLK_P), .clk_n(HDMI_CLK_N), .d0_p(HDMI_D0_P), .d0_n(HDMI_D0_N),
        .d1_p(HDMI_D1_P), .d1_n(HDMI_D1_N), .d2_p(HDMI_D2_P), .d2_n(HDMI_D2_N));
endmodule
`;
    const h = new BoardHarness(synthesize(withLibrary(src, 'verilog'), 'verilog'), EBAZ.masterXdc({ hdmi: true }), EBAZ);
    const m = h.hdmi(1)!;
    expect(m).not.toBeNull();
    expect(m.state(h.cycles)).not.toBe('ok');
  });
});

// bit-bangs SPI bytes into the model: SDA set while SCL is low, read on the rising edge
function lcdBus(lcd: St7789) {
  let t = 0;
  const l: LcdLines = { scl: 0, sda: 0, dc: 0, cs: 0, res: 1, blk: 1 };
  lcd.restart(0, l);
  const tick = (n = 1) => {
    t += n;
    lcd.feed(t, l);
  };
  const byte = (b: number, dc: number) => {
    l.dc = dc;
    for (let i = 7; i >= 0; i--) {
      l.sda = (b >> i) & 1;
      l.scl = 0;
      tick();
      l.scl = 1;
      tick();
    }
    l.scl = 0;
    tick();
  };
  return {
    cmd: (c: number, ...data: number[]) => {
      byte(c, 0);
      for (const d of data) byte(d, 1);
    },
    wait: (ms: number) => tick(ms * 50_000),
    reset: () => {
      l.res = 0;
      tick(50_000 * 10);
      l.res = 1;
      tick();
      tick(50_000 * 120);
    },
  };
}

describe('ST7789 model', () => {
  it('shows a picture after the vendor-style start-up (no CS line, COLMOD 0x05, INVON, SLPOUT, DISPON)', () => {
    const lcd = new St7789(50e6);
    const b = lcdBus(lcd);
    b.reset();
    b.cmd(0x36, 0x00);
    b.cmd(0x3a, 0x05);
    b.cmd(0x21);
    b.cmd(0x11);
    b.wait(120);
    b.cmd(0x29);
    b.cmd(0x2a, 0, 0, 0, 239);
    b.cmd(0x2b, 0, 0, 0, 239);
    b.cmd(0x2c, 0xf8, 0x00, 0x07, 0xe0);
    expect(lcd.warnings).toEqual([]);
    expect(lcd.lit).toBe(true);
    expect(lcd.shown(0, 0)).toBe(0xf800);
    expect(lcd.shown(1, 0)).toBe(0x07e0);
  });

  it('gives a readable warning and stays dark when SLPOUT is missing', () => {
    const lcd = new St7789(50e6);
    const b = lcdBus(lcd);
    b.reset();
    b.cmd(0x3a, 0x55);
    b.cmd(0x29);
    b.cmd(0x2c, 0xff, 0xff);
    expect(lcd.lit).toBe(false);
    expect(lcd.shown(0, 0)).toBe(-1);
    expect(lcd.warnings.map((w) => w.code)).toEqual(['LCD 5', 'LCD 6']);
    expect(lcd.warnings[0].text).toMatch(/SLPOUT \(0x11\)/);
  });

  it('shows inverted colours on the IPS panel without INVON', () => {
    const lcd = new St7789(50e6);
    const b = lcdBus(lcd);
    b.reset();
    b.cmd(0x11);
    b.wait(120);
    b.cmd(0x3a, 0x55);
    b.cmd(0x29);
    b.cmd(0x2c, 0xff, 0xff);
    expect(lcd.shown(0, 0)).toBe(0x0000);
  });
});

describe('the HDMI lessons in Vivado and in the checker', () => {
  it('adds the real tmds_serializer to the project when the design uses it', () => {
    for (const lang of ['verilog', 'vhdl'] as const) {
      const spec: ProjectSpec = {
        name: 'fpga_lab_x-hdmi-bars',
        lang,
        top: 'top',
        src: lang === 'verilog' ? X.X_BARS_V : X.X_BARS_VHD,
        xdc: EBAZ.masterXdc({ hdmi: true }),
        xdcName: 'ebaz4205.xdc',
        part: EBAZ.part,
        board: 'EBAZ4205',
        internalClock: EBAZ.internalClock,
      };
      const fs = projectFiles(spec);
      const lib = fs.find((f) => f.name === 'fpga_lab_x-hdmi-bars/src/tmds_serializer.v');
      expect(lib?.data).toBe(TMDS_SERIALIZER_V);
      expect(fs.find((f) => f.name.endsWith('create_project.tcl'))!.data).toContain('add_files -norecurse $origin/src/tmds_serializer.v');
      // the learner's file keeps only their own code
      expect(fs.find((f) => /\/src\/top\.vhdl?$|\/src\/top\.v$/.test(f.name))!.data).not.toContain('fpgalab_hdmi_tap');
    }
    const plain = projectFiles({ name: 'x', lang: 'verilog', top: 'top', src: X.X_LEDS_V, xdc: '', xdcName: 'e.xdc', part: EBAZ.part, board: 'EBAZ4205', internalClock: EBAZ.internalClock });
    expect(plain.some((f) => f.name.includes('tmds_serializer'))).toBe(false);
  });

  it('uses OSERDESE2, OBUFDS and an MMCM in the real serializer', () => {
    expect(TMDS_SERIALIZER_V).toMatch(/MMCME2_BASE/);
    expect(TMDS_SERIALIZER_V.match(/OSERDESE2/g)!.length).toBeGreaterThanOrEqual(2);
    expect(TMDS_SERIALIZER_V).toMatch(/OBUFDS/);
    expect(TMDS_SERIALIZER_V).toContain("10'b0000011111");
  });

  for (const lang of ['verilog', 'vhdl'] as const)
    it(`x-hdmi-tmds (${lang}): the lesson's testbench misses the broken stage 2, the solution's catches it`, () => {
      const l = ALL_LESSONS.find((x) => x.id === 'x-hdmi-tmds')!;
      const run = (tb: string) => gradeExercise(l.id, { lang, src: l[lang], xdc: EBAZ.masterXdc(l.xdc), tb, original: l[lang] }, EBAZ);
      expect(run(l.tb![lang]).passed).toBe(false);
      const good = run(EXERCISES['x-hdmi-tmds'].solution![lang]);
      expect(good.passed, JSON.stringify(good.items, null, 1)).toBe(true);
    });
});
