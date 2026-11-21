// The EBAZ4205 board plug-in (docs/EBAZ4205-ROADMAP.md, Phase E1): pins against the prepared master XDC, the
// internal FCLK_CLK0 clock, the prepared z-blink design on the board, and its Vivado project.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BOARDS, deviceLabel, getBoard } from '../src/boards';
import { mapPorts, parseXdc } from '../src/boards/mapping';
import { expandParts } from '../src/boards/parts';
import { Z_BLINK_V, Z_BLINK_VHD } from '../src/boards/ebaz4205/code';
import { synthesize } from '../src/hdl';
import { BoardHarness as Harness } from '../src/grade/harness';
import { projectFiles } from '../src/synth/project';

const ebaz = getBoard('ebaz4205');
const doc = (f: string) => readFileSync(new URL(`../docs/ebaz4205/${f}`, import.meta.url), 'utf8');
// every PACKAGE_PIN of the core board in the prepared master XDC (above the extension-board and Ethernet parts)
const corePins = () => {
  const text = doc('ebaz4205-master.xdc');
  const core = text.slice(0, text.indexOf('-- Ethernet'));
  return new Set([...core.matchAll(/PACKAGE_PIN\s+([A-Z]+\d+)/g)].map((m) => m[1]));
};

describe('EBAZ4205 board', () => {
  it('is registered next to the Nexys, which stays the default', () => {
    expect(BOARDS.map((b) => b.id)).toEqual(['nexys-a7-100t', 'ebaz4205']);
    expect(getBoard(null).id).toBe('nexys-a7-100t');
    expect(ebaz.part).toBe('xc7z010clg400-1');
    expect(ebaz.boardPart).toBeUndefined();
    expect(ebaz.clockHz).toBe(50e6);
    expect(ebaz.internalClock).toEqual({ port: 'clk', source: 'FCLK_CLK0', hz: 50e6 });
  });

  it('has exactly the pins of the prepared master XDC (core board)', () => {
    expect(new Set(Object.keys(ebaz.pins))).toEqual(corePins());
  });

  it('its own master XDC maps the same pins, and LED_R/LED_G when asked', () => {
    const all = ebaz.masterXdc({ led: true, fan: true, data: true });
    const pins = new Set([...all.matchAll(/PACKAGE_PIN\s+([A-Z]+\d+)/g)].map((m) => m[1]));
    expect(pins).toEqual(corePins());
    const leds = parseXdc(ebaz.masterXdc({ led: true }), ebaz).pins;
    expect(leds.get('led_r')?.pin).toBe('W14');
    expect(leds.get('led_g')?.pin).toBe('W13');
    expect(leds.has('data1_5')).toBe(false);
    expect(ebaz.masterXdc({})).toContain('Copyright (c) xjtuecho');
    expect(deviceLabel(ebaz.pins.W14, ebaz)).toBe('LED_R');
  });

  it('DATA headers use the silkscreen numbers, 14 signal pins each', () => {
    expect(ebaz.headers.map((h) => h.name)).toEqual(['DATA1', 'DATA2', 'DATA3']);
    for (const h of ebaz.headers) expect(Object.keys(h.pins).map(Number)).toEqual([5, 6, 7, 8, 9, 11, 13, 14, 15, 16, 17, 18, 19, 20]);
    expect(ebaz.headers[2].pins[16]).toBe('T20');
    expect(ebaz.defaultNames.DATA3_16).toBe('T20');
  });

  it('binds an unconstrained clk to FCLK_CLK0; a constraint to N18 wins', () => {
    const d = synthesize(Z_BLINK_V, 'verilog');
    const m = mapPorts(d, ebaz.masterXdc({ led: true }), ebaz);
    expect(m.clock).toBe(d.ports.find((p) => p.name === 'clk')!.id);
    expect(m.messages.find((x) => x.code === 'FPGA Lab')?.msg).toBe('clk is driven by FCLK_CLK0 (50 MHz) from the PS');
    expect(m.messages.some((x) => x.level !== 'info')).toBe(false);
    const x5 = mapPorts(d, `${ebaz.masterXdc({ led: true })}\nset_property -dict { PACKAGE_PIN N18 IOSTANDARD LVCMOS33 } [get_ports { clk }]`, ebaz);
    expect(x5.bindings.find((b) => b.port === 'clk')?.pin).toBe('N18');
    expect(x5.messages.some((x) => x.code === 'FPGA Lab')).toBe(false);
    // the Nexys has no internal clock: clk stays unconnected there
    const nexys = mapPorts(d, '', getBoard('nexys-a7-100t'));
    expect(nexys.clock).toBeUndefined();
  });

  it('runs z_blink on the EBAZ harness (Verilog and VHDL)', () => {
    for (const [src, lang] of [[Z_BLINK_V, 'verilog'], [Z_BLINK_VHD, 'vhdl']] as const) {
      const h = new Harness(synthesize(src, lang, undefined, { DIV: 4 }), ebaz.masterXdc({ led: true }), ebaz);
      const seen: number[] = [];
      for (let i = 0; i < 20; i++) {
        h.run(1);
        seen.push(h.led());
      }
      expect(seen.join(''), lang).toMatch(/1111222211112222/);
    }
  });

  it('keeps the playground code equal to the prepared drafts', () => {
    expect(Z_BLINK_V).toBe(doc('code/z_blink.v'));
    expect(Z_BLINK_VHD).toBe(doc('code/z_blink.vhd'));
  });

  it('parts: EBAZ names on the EBAZ, Nexys names unchanged', () => {
    expect(expandParts(['led_r', 'DATA2', 'R2577', 'SW0'], 'ebaz4205')).toEqual(['LED_R', 'DATA2', 'R2577']);
    expect(expandParts(['SW1..SW0'])).toEqual(['SW1', 'SW0']);
  });
});

describe('EBAZ4205 Vivado project', () => {
  const files = (lang: 'verilog' | 'vhdl', xdc = ebaz.masterXdc({ led: true })) =>
    projectFiles({
      name: 'fpga_lab_playground',
      lang,
      top: 'top',
      src: lang === 'verilog' ? Z_BLINK_V : Z_BLINK_VHD,
      xdc,
      xdcName: 'ebaz4205.xdc',
      part: ebaz.part,
      board: `${ebaz.vendor} ${ebaz.name}`,
      internalClock: ebaz.internalClock,
    });
  const get = (fs: { name: string; data: string }[], n: string) => fs.find((f) => f.name.endsWith(n))!.data;

  it('builds a PS7 block design with FCLK_CLK0 on clk and the rest external', () => {
    const fs = files('verilog');
    expect(fs.map((f) => f.name)).toEqual([
      'fpga_lab_playground/src/top.v',
      'fpga_lab_playground/constrs/ebaz4205.xdc',
      'fpga_lab_playground/create_project.tcl',
      'fpga_lab_playground/boot.bif',
      'fpga_lab_playground/vitis/app.c',
      'fpga_lab_playground/README.txt',
    ]);
    const tcl = get(fs, 'create_project.tcl');
    expect(tcl).toContain('create_project $proj_name $origin/vivado -part xc7z010clg400-1 -force');
    expect(tcl).not.toContain('board_part');
    expect(tcl).toContain('processing_system7');
    expect(tcl).toContain('CONFIG.PCW_UIPARAM_DDR_PARTNO {MT41K128M16 JT-125}');
    expect(tcl).toContain('CONFIG.PCW_FPGA0_PERIPHERAL_FREQMHZ {50}');
    expect(tcl).toContain('create_bd_cell -type module -reference top user_top');
    expect(tcl).toContain('connect_bd_net [get_bd_pins ps7/FCLK_CLK0] [get_bd_pins user_top/clk]');
    expect(tcl).toContain('make_bd_pins_external -name $n $pin');
    expect(tcl).toContain('set_property top system_wrapper [current_fileset]');
    expect(tcl).toContain('write_hw_platform -fixed -include_bit -force $origin/system.xsa');
    // balanced braces and brackets, so the script parses
    for (const [a, b] of [['{', '}'], ['[', ']']]) expect(tcl.split(a).length, a).toBe(tcl.split(b).length);
    expect(get(fs, 'boot.bif')).toContain('[bootloader] fsbl.elf');
    const readme = get(fs, 'README.txt');
    expect(readme).toContain('FCLK_CLK0 = 50 MHz');
    expect(readme).toContain('کارت SD');
    expect(get(files('vhdl'), 'create_project.tcl')).toContain('set_property file_type {VHDL 2008}');
  });

  it('drops a clock pin from the XDC (the clock is internal)', () => {
    const xdc = get(files('verilog', `set_property -dict { PACKAGE_PIN N18 IOSTANDARD LVCMOS33 } [get_ports { clk }]\ncreate_clock -period 20 [get_ports clk]\nset_property -dict { PACKAGE_PIN W14 IOSTANDARD LVCMOS33 } [get_ports { LED_R }]`), 'ebaz4205.xdc');
    const live = xdc.split('\n').filter((l) => !l.startsWith('#'));
    expect(live).toEqual(['set_property -dict { PACKAGE_PIN W14 IOSTANDARD LVCMOS33 } [get_ports { LED_R }]']);
  });
});
