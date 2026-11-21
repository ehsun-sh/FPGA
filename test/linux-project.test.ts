// The Vivado projects of the chapter "Linux on Zynq" (src/synth/linux.ts) and the plain-Tcl helpers they build the
// SD card files with (src/linux/files/fpgalab.tcl): boot.scr must be the bytes mkimage writes, and the .bin the
// bytes zynq-fpga wants.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { crc32 } from 'node:zlib';
import { getBoard } from '../src/boards';
import { projectFiles, type ProjectSpec } from '../src/synth/project';
import { binName, type LinuxMode } from '../src/synth/linux';

const ebaz = getBoard('ebaz4205');
const spec = (mode: LinuxMode): ProjectSpec => ({
  name: 'fpga_lab_lx',
  lang: 'verilog',
  top: 'top',
  src: 'module top(input clk, output [2:0] ext_led); endmodule',
  xdc: '',
  xdcName: 'ebaz4205.xdc',
  part: ebaz.part,
  board: 'EBAZ4205',
  internalClock: ebaz.internalClock,
  ps: { mode },
});
const files = (mode: LinuxMode) => new Map(projectFiles(spec(mode)).map((f) => [f.name.replace('fpga_lab_lx/', ''), f.data]));

describe('Linux on Zynq projects', () => {
  for (const mode of ['linux', 'axigpio', 'linux-pl'] as const)
    it(`${mode}: has the boot files, the Linux sources and the double-click build`, () => {
      const f = files(mode);
      for (const n of ['create_project.tcl', 'boot.bif', 'sd/boot.cmd', 'linux/fpgalab.tcl', 'linux/gpio_mem.c', 'linux/fpgalab_leds.c', 'linux/fpgalab_load.c', 'linux/fpgalab-leds.dtsi', 'linux/Makefile', 'README.txt', 'build.bat', 'build.sh'])
        expect(f.has(n), n).toBe(true);
      // U-Boot goes into BOOT.bin at its link address, after the FSBL and the bitstream
      expect(f.get('boot.bif')).toMatch(/\[bootloader\][^\n]*fsbl\.elf[\s\S]*system_wrapper\.bit[\s\S]*\[load=0x04000000, startup=0x04000000\] u-boot\.bin/);
      expect(f.get('sd/boot.cmd')).toContain('clk_ignore_unused');
      const tcl = f.get('create_project.tcl')!;
      expect(tcl).toContain('fpgalab_mkscr');
      expect(tcl).toContain(binName(mode));
      // the network goes through EMIO, so every design keeps the Ethernet path
      expect(tcl).toContain('CONFIG.PCW_ENET0_PERIPHERAL_ENABLE {1}');
      // the Makefile's recipes need tabs
      expect(f.get('linux/Makefile')).toMatch(/\n\t\$\(MAKE\) -C \$\(KDIR\)/);
    });

  it('axigpio puts an AXI GPIO at 0x41200000 with LED1-LED3 and KEY1-KEY5', () => {
    const f = files('axigpio');
    const tcl = f.get('create_project.tcl')!;
    expect(tcl).toContain('xilinx.com:ip:axi_gpio');
    expect(tcl).toContain('0x41200000');
    expect(tcl).toContain('CONFIG.PCW_USE_M_AXI_GP0 {1}');
    for (const pin of ['E19', 'K17', 'H18', 'T19', 'P19', 'U20', 'U19', 'V20']) expect(f.get('constrs/ebaz4205.xdc'), pin).toContain(pin);
    expect(f.has('src/top.v')).toBe(false);
  });

  it('linux-pl puts the lesson code next to the PS, clocked by FCLK_CLK0', () => {
    const f = files('linux-pl');
    expect(f.get('src/top.v')).toContain('module top');
    expect(f.get('create_project.tcl')).toContain('create_bd_cell -type module -reference top');
  });

  it('the device tree fragment and the driver agree on the compatible string', () => {
    const f = files('axigpio');
    expect(f.get('linux/fpgalab-leds.dtsi')).toContain('compatible = "fpgalab,axi-leds"');
    expect(f.get('linux/fpgalab_leds.c')).toContain('"fpgalab,axi-leds"');
    expect(f.get('linux/fpgalab-leds.dtsi')).toContain('fclk-enable = <0x1>');
  });
});

// tclsh runs the helpers the same way Vivado's Tcl does; skip where it is not installed
let tclsh = true;
try {
  execFileSync('tclsh', [], { input: 'exit\n' });
} catch {
  tclsh = false;
}

describe.skipIf(!tclsh)('fpgalab.tcl', () => {
  const tcl = files('linux').get('linux/fpgalab.tcl')!;
  const run = (dir: string, cmd: string) => execFileSync('tclsh', [], { input: `source ${dir}/fpgalab.tcl\n${cmd}\n`, encoding: 'utf8' });

  const bytes = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
  const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  const cat = (...parts: Uint8Array[]) => {
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.length;
    }
    return out;
  };

  it('makes the same boot.scr as mkimage -T script', () => {
    const dir = mkdtempSync(`${tmpdir()}/lx-`);
    try {
      const cmd = files('linux').get('sd/boot.cmd')!;
      writeFileSync(`${dir}/fpgalab.tcl`, tcl);
      writeFileSync(`${dir}/boot.cmd`, cmd);
      run(dir, `fpgalab_mkscr ${dir}/boot.cmd ${dir}/boot.scr 1700000000`);
      const got = readFileSync(`${dir}/boot.scr`);
      // the legacy image: 64-byte header (big endian), then the size list (one size, a zero) and the script
      const text = bytes(cmd);
      const data = new Uint8Array(8 + text.length);
      new DataView(data.buffer).setUint32(0, text.length);
      data.set(text, 8);
      const head = new Uint8Array(64);
      const h = new DataView(head.buffer);
      h.setUint32(0, 0x27051956);
      h.setUint32(8, 1700000000);
      h.setUint32(12, data.length);
      h.setUint32(24, crc32(data));
      head.set([5, 2, 6, 0], 28); // linux, ARM, script, no compression
      h.setUint32(4, crc32(head));
      expect(hex(got)).toBe(hex(cat(head, data)));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('turns a .bit into the byte-swapped .bin the FPGA manager loads', () => {
    const dir = mkdtempSync(`${tmpdir()}/lx-`);
    try {
      writeFileSync(`${dir}/fpgalab.tcl`, tcl);
      // a .bit header field: the key, a 2-byte length and a zero-terminated text
      const field = (key: string, s: string) => {
        const b = new Uint8Array(3 + s.length + 1);
        b[0] = key.charCodeAt(0);
        new DataView(b.buffer).setUint16(1, s.length + 1);
        b.set(bytes(s), 3);
        return b;
      };
      // a dummy word, the sync word and three configuration words
      const cfg = Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xaa, 0x99, 0x55, 0x66, 0x20, 0, 0, 0, 0x30, 0x00, 0x80, 0x01, 0, 0, 0, 0x07]);
      const len = new Uint8Array(5);
      len[0] = 'e'.charCodeAt(0);
      new DataView(len.buffer).setUint32(1, cfg.length);
      const bit = cat(
        Uint8Array.from([0, 9, 0x0f, 0xf0, 0x0f, 0xf0, 0x0f, 0xf0, 0x0f, 0xf0, 0, 0, 1]),
        field('a', 'system_wrapper;UserID=0XFFFFFFFF'),
        field('b', '7z010clg400'),
        field('c', '2026/11/21'),
        field('d', '12:00:00'),
        len,
        cfg,
      );
      writeFileSync(`${dir}/x.bit`, bit);
      expect(run(dir, `puts [fpgalab_bit2bin ${dir}/x.bit ${dir}/x.bin]`).trim()).toBe(String(cfg.length));
      const want = cfg.slice();
      for (let i = 0; i < want.length; i += 4) want.subarray(i, i + 4).reverse();
      const bin = readFileSync(`${dir}/x.bin`);
      expect(hex(bin)).toBe(hex(want));
      // the sync word lands as 66 55 99 AA
      expect(hex(bin.subarray(4, 8))).toBe('665599aa');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
