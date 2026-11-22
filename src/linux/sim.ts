// A simulated EBAZ4205 running Linux, for the chapter "Linux on Zynq" (src/lessons/linux.ts). It is a model, not an
// emulator: U-Boot and a BusyBox shell answer the commands the lessons teach, and the hardware behind them (the two
// LEDs on EMIO GPIO 54/55, an AXI GPIO in the PL with the extension board's LED1-LED3 and KEY1-KEY5, the FPGA manager)
// behaves like the real one, including the ways it fails: a read from a PL address with no design behind it hangs
// the board, a kernel without root= panics, a stopped FCLK_CLK0 freezes the PL.
//
// The software it models is the Buildroot image of blkf2016/ebaz4205 (U-Boot 2019.07-rc4, Linux 5.1.5, Buildroot
// 2019.05): SD partition 1 (FAT) holds boot.bin, u-boot.bin and boot.scr, partition 2 (ext4) the root file system
// with /boot/zImage and /boot/zynq-ebaz4205.dtb; eth0 is 192.168.100.1 and dnsmasq hands the PC an address;
// OpenSSH allows root with the password "root". Its device tree puts led_r (heartbeat) and led_g on GPIO 54/55.
//
// No DOM here: src/linux/term.ts draws the two consoles (the serial port J7 and a PC on the network cable) and calls
// tick() every frame. Everything printed goes to `out`, which the terminal drains.
import { basename, normalize, plain, Vfs, type VFile } from './vfs';

export type Con = 'serial' | 'pc';
// what is configured in the PL: blkf2016's own design, FPGA Lab's AXI GPIO design (lx-gpio), the running light of
// lx-fpgamgr, or nothing (an empty PL after a failed load)
export type Design = 'stock' | 'axigpio' | 'light' | 'none';
export interface Out {
  text: string;
  cls?: 'err' | 'dim' | 'ok' | 'note';
  replace?: boolean; // replaces the last line (the U-Boot countdown)
}
export interface SimConfig {
  start: 'off' | 'login' | 'shell';
  design: Design; // the design in BOOT.bin
  script: 'stock' | 'fpgalab'; // boot.scr: blkf2016's, or FPGA Lab's (adds console= and clk_ignore_unused)
  dtb: 'stock' | 'fpgalab'; // /boot/zynq-ebaz4205.dtb: blkf2016's, or one with the fpgalab,axi-leds node
  root?: string[]; // files in /root (names from FILES)
  pc?: string[]; // files on the PC
  pcLoggedIn?: boolean; // the PC console starts inside an ssh session
}
export interface SimDeps {
  // KEY1..KEY5 of the extension board, pressed = true
  pressed(name: string): boolean;
}

export const BOARD_IP = '192.168.100.1';
export const PC_IP = '192.168.100.5';
export const AXI_GPIO = 0x41200000;

// the binary files the lessons hand out, by name: [kind, size in bytes]
const FILES: Record<string, [string, number]> = {
  gpio_mem: ['elf:gpio_mem', 9820],
  'gpio_mem.c': ['src:gpio_mem', 0],
  'fpgalab_leds.ko': ['ko:fpgalab_leds', 6120],
  'fpgalab_load.ko': ['ko:fpgalab_load', 4988],
  'running_light.bin': ['bin:light', 2083740],
  'axi_gpio.bin': ['bin:axigpio', 2083740],
  'zynq-ebaz4205.dtb': ['dtb:fpgalab', 11603],
};
export const fileNames = () => Object.keys(FILES);

type BoardState = 'off' | 'countdown' | 'uboot' | 'booting' | 'login' | 'password' | 'shell' | 'panic' | 'hung';
type PcState = 'pc' | 'ssh-confirm' | 'ssh-pass' | 'ssh' | 'scp-pass';
interface Session {
  cwd: string;
}
interface Job {
  tick(dt: number): void;
  stop(): void;
}
interface Module {
  name: string;
  size: number;
  bound?: boolean;
}

const pad = (s: string | number, n: number) => String(s).padStart(n);

const STOCK_SCR = `ext4load mmc 0:2 0x2000000 /boot/zImage
ext4load mmc 0:2 0x1f00000 /boot/zynq-ebaz4205.dtb
setenv bootargs "root=/dev/mmcblk0p2 rootwait"
bootz 0x2000000 - 0x1f00000`;
// FPGA Lab's boot.cmd (src/synth/linux.ts writes the same one, compiled to boot.scr)
export const FPGALAB_SCR = `ext4load mmc 0:2 0x2000000 /boot/zImage
ext4load mmc 0:2 0x1f00000 /boot/zynq-ebaz4205.dtb
setenv bootargs "console=ttyPS0,115200 root=/dev/mmcblk0p2 rootwait clk_ignore_unused"
bootz 0x2000000 - 0x1f00000`;

export class ZynqSim {
  out: Record<Con, Out[]> = { serial: [], pc: [] };
  // a task was done (src/linux/scenarios.ts ticks them off)
  onFlag: (flag: string) => void = () => {};
  readonly flags = new Set<string>();

  board: BoardState = 'off';
  pcState: PcState = 'pc';
  design: Design = 'none';
  fclk = true; // FCLK_CLK0 still running (Linux stops unused clocks without clk_ignore_unused)
  dtNode = false; // the booted device tree has the fpgalab,axi-leds node
  bootargs = '';
  // LED_R, LED_G (EMIO GPIO 54/55 through gpio-leds) and the AXI GPIO's LED1-LED3
  ledR = 0;
  ledG = 0;
  extLed = 0;
  private trig: Record<'led_r' | 'led_g', string> = { led_r: 'heartbeat', led_g: 'none' };
  private bright: Record<'led_r' | 'led_g', number> = { led_r: 0, led_g: 0 };
  private delay: Record<'led_r' | 'led_g', [number, number]> = { led_r: [500, 500], led_g: [500, 500] };

  private now = 0; // ms since power-on
  private bootAt = 0; // when the kernel started (for dmesg and uptime)
  private timeline: { at: number; fn: () => void }[] = [];
  private fs = new Vfs();
  private fat = new Map<string, [string, number]>(); // SD partition 1: name -> [kind, size]
  private pcFiles = new Map<string, [string, number]>();
  private mem = new Map<number, string>(); // U-Boot: what was loaded where
  private env = new Map<string, string>();
  private dmesg: string[] = [];
  private mods: Module[] = [];
  private sess: Record<Con, Session> = { serial: { cwd: '/root' }, pc: { cwd: '/root' } };
  private job: Partial<Record<Con, Job>> = {};
  private loginUser = '';
  private known = false; // the PC has accepted the board's host key
  private pending: { kind: 'ssh' } | { kind: 'scp'; src: string; dst: string; up: boolean } | null = null;
  private fpgaState = 'operating';
  private lightStep = 0;
  private lightAt = 0;
  private scr: string;
  private cfg: SimConfig;

  constructor(
    cfg: SimConfig,
    private deps: SimDeps,
  ) {
    this.cfg = cfg;
    this.scr = cfg.script === 'fpgalab' ? FPGALAB_SCR : STOCK_SCR;
    this.installFs();
    for (const n of cfg.pc ?? []) this.pcFiles.set(n, FILES[n]);
    if (cfg.start !== 'off') {
      this.power(true, true);
      this.timeline = [];
      this.out.serial = [];
      this.finishBootQuietly();
      if (cfg.start === 'shell') {
        this.board = 'shell';
        this.say('serial', 'Welcome to Buildroot');
        this.say('serial', '(simulator: already logged in as root)', 'note');
      } else this.say('serial', 'Welcome to Buildroot');
      if (cfg.pcLoggedIn) {
        this.known = true;
        this.pcState = 'ssh';
        this.say('pc', `pc$ ssh root@${BOARD_IP}`, 'dim');
        this.say('pc', '(simulator: already logged in over SSH)', 'note');
      }
    }
  }

  // ---------------------------------------------------------------- output and time
  private say(con: Con, text: string, cls?: Out['cls'], replace?: boolean) {
    for (const line of text.split('\n')) this.out[con].push({ text: line, cls, replace });
  }
  private sayBoth(text: string, cls?: Out['cls']) {
    this.say('serial', text, cls);
    if (this.pcState === 'ssh') this.say('pc', text, cls);
  }
  private after(ms: number, fn: () => void) {
    this.timeline.push({ at: this.now + ms, fn });
    this.timeline.sort((a, b) => a.at - b.at);
  }
  private flag(f: string) {
    if (this.flags.has(f)) return;
    this.flags.add(f);
    this.onFlag(f);
  }
  private kt() {
    return (this.now - this.bootAt) / 1000;
  }
  private klog(msg: string, t = this.kt()) {
    const line = `[${pad(t.toFixed(6), 12)}] ${msg}`;
    this.dmesg.push(line);
    return line;
  }

  tick(dt: number) {
    this.now += dt;
    while (this.timeline.length && this.timeline[0].at <= this.now) this.timeline.shift()!.fn();
    for (const c of ['serial', 'pc'] as Con[]) this.job[c]?.tick(dt);
    this.updateLeds();
  }

  // what each console shows before the cursor
  prompt(con: Con): string {
    if (con === 'pc') {
      if (this.pcState === 'ssh') return this.shellPrompt('pc');
      if (this.pcState === 'ssh-confirm') return 'Are you sure you want to continue connecting (yes/no)? ';
      if (this.pcState === 'ssh-pass' || this.pcState === 'scp-pass') return `root@${BOARD_IP}'s password: `;
      return 'pc$ ';
    }
    if (this.job.serial) return '';
    switch (this.board) {
      case 'uboot':
        return 'Zynq> ';
      case 'login':
        return 'buildroot login: ';
      case 'password':
        return 'Password: ';
      case 'shell':
        return this.shellPrompt('serial');
      default:
        return '';
    }
  }
  secret(con: Con) {
    return con === 'pc' ? this.pcState === 'ssh-pass' || this.pcState === 'scp-pass' : this.board === 'password';
  }
  // the console is waiting for a command (not booting, hung or busy)
  ready(con: Con) {
    if (this.job[con]) return false;
    if (con === 'pc') return this.pcState !== 'ssh' || this.linuxUp();
    return ['uboot', 'login', 'password', 'shell'].includes(this.board);
  }
  private shellPrompt(con: Con) {
    const c = this.sess[con].cwd;
    return `[root@buildroot ${c === '/root' ? '~' : c === '/' ? '/' : basename(c)}]# `;
  }

  // ---------------------------------------------------------------- the file systems
  private installFs() {
    const fs = this.fs;
    for (const d of ['/bin', '/dev', '/etc', '/home', '/lib', '/mnt', '/opt', '/proc', '/root', '/run', '/sbin', '/sys', '/tmp', '/usr/bin', '/var/log'])
      fs.mkdir(d);
    fs.text('/etc/hostname', 'buildroot\n');
    fs.text('/etc/issue', 'Welcome to Buildroot\n');
    fs.text('/etc/os-release', 'NAME=Buildroot\nVERSION=2019.05\nID=buildroot\nVERSION_ID=2019.05\nPRETTY_NAME="Buildroot 2019.05"\n');
    fs.text('/etc/network/interfaces', `auto lo\niface lo inet loopback\n\nauto eth0\niface eth0 inet static\n        address ${BOARD_IP}\n        netmask 255.255.255.0\n        broadcast 192.168.100.255\n`);
    fs.text('/etc/dnsmasq.conf', 'interface=eth0\ndhcp-range=192.168.100.2,192.168.100.10,255.255.255.0,12h\ndhcp-option=3\ndhcp-option=6\n');
    fs.text('/etc/passwd', 'root:x:0:0:root:/root:/bin/sh\nsshd:x:1000:1000:SSH drop priv user:/:/bin/false\n');
    fs.text('/boot/zImage', '', false, 4194832);
    this.putDtb(this.cfg.dtb);
    fs.text('/boot/boot.scr', this.scr, false, this.scr.length + 72);
    for (const n of this.cfg.root ?? []) this.putFile(`/root/${n}`, n);
    for (const d of ['mem', 'null', 'zero', 'ttyPS0', 'ttyPS1', 'mmcblk0', 'mmcblk0p1', 'mmcblk0p2', 'mtd0', 'urandom'])
      fs.put(`/dev/${d}`, { read: () => '', write: () => undefined, dev: true });
    this.fat.set('boot.bin', ['bootbin', 2380160]);
    this.fat.set('u-boot.bin', ['uboot', 458712]);
    this.fat.set('boot.scr', ['scr', this.scr.length + 72]);
    this.installProc();
    this.installSys();
  }
  private putDtb(kind: 'stock' | 'fpgalab') {
    this.fs.put('/boot/zynq-ebaz4205.dtb', { ...plain(''), size: kind === 'fpgalab' ? 11603 : 11348, tag: `dtb:${kind}` } as VFile & { tag: string });
  }
  private putFile(path: string, name: string) {
    const [kind, size] = FILES[name];
    if (kind === 'src:gpio_mem') this.fs.text(path, GPIO_MEM_HEAD);
    else this.fs.put(path, { read: () => '\x7fELF\x01\x01\x01', size, exec: kind.startsWith('elf'), tag: kind } as VFile & { tag: string });
  }
  private tagOf(path: string): string | undefined {
    return (this.fs.file(path) as (VFile & { tag?: string }) | undefined)?.tag;
  }

  private installProc() {
    const fs = this.fs;
    const ro = (read: () => string): VFile => ({ read, write: () => 'Permission denied' });
    fs.put('/proc/cpuinfo', ro(() => [0, 1].map((i) => `processor\t: ${i}\nmodel name\t: ARMv7 Processor rev 0 (v7l)\nBogoMIPS\t: 666.66\nFeatures\t: half thumb fastmult vfp edsp neon vfpv3 tls vfpd32\nCPU implementer\t: 0x41\nCPU part\t: 0xc09\n`).join('\n') + '\nHardware\t: Xilinx Zynq Platform\n'));
    fs.put('/proc/meminfo', ro(() => 'MemTotal:         245796 kB\nMemFree:          208404 kB\nMemAvailable:     214552 kB\n'));
    fs.put('/proc/version', ro(() => 'Linux version 5.1.5 (buildroot@buildroot) (gcc version 8.3.0 (Buildroot 2019.05)) #1 SMP PREEMPT\n'));
    fs.put('/proc/cmdline', ro(() => `${this.bootargs}\n`));
    fs.put('/proc/uptime', ro(() => `${this.kt().toFixed(2)} ${(this.kt() * 1.9).toFixed(2)}\n`));
    fs.put('/proc/modules', ro(() => this.mods.map((m) => `${m.name} ${m.size} 0 - Live 0xbf000000 (O)\n`).join('')));
    fs.put('/proc/iomem', ro(() => `00000000-0fffffff : System RAM\n${this.dtNode ? '41200000-4120ffff : 41200000.leds leds@41200000\n' : ''}e0001000-e0001fff : xuartps\ne000b000-e000bfff : e000b000.ethernet ethernet@e000b000\ne0100000-e0100fff : mmc0\nf8007000-f80070ff : f8007000.devcfg devcfg@f8007000\n`));
    fs.put('/proc/device-tree/model', ro(() => 'Zynq ebaz4205 Board'));
    fs.put('/proc/device-tree/compatible', ro(() => 'unknown,zynq-ebaz4205 xlnx,zynq-7000'));
    for (const n of ['aliases', 'chosen', 'cpus', 'memory@0', 'gpio-leds', 'gpio-keys', 'amba', 'clocks']) fs.mkdir(`/proc/device-tree/${n}`);
  }
  private installSys() {
    const fs = this.fs;
    for (const led of ['led_r', 'led_g'] as const) {
      const base = `/sys/class/leds/${led}`;
      fs.put(`${base}/max_brightness`, { read: () => '1\n', write: () => 'Permission denied' });
      fs.put(`${base}/brightness`, {
        read: () => `${this.ledOn(led) ? 1 : 0}\n`,
        write: (s) => {
          const v = parseInt(s, 10);
          if (Number.isNaN(v)) return 'Invalid argument';
          this.bright[led] = v > 0 ? 1 : 0;
          // writing 0 turns a trigger off, as in the kernel
          if (v === 0) this.setTrigger(led, 'none');
          this.flag(`led:${led}`);
          return undefined;
        },
      });
      fs.put(`${base}/trigger`, {
        read: () => `${['none', 'mmc0', 'timer', 'heartbeat', 'default-on', 'panic'].map((t) => (t === this.trig[led] ? `[${t}]` : t)).join(' ')}\n`,
        write: (s) => {
          const t = s.trim();
          if (!['none', 'mmc0', 'timer', 'heartbeat', 'default-on', 'panic'].includes(t)) return 'Invalid argument';
          this.setTrigger(led, t);
          this.flag(`trigger:${t}`);
          return undefined;
        },
      });
    }
    fs.put('/sys/class/fpga_manager/fpga0/name', { read: () => 'Xilinx Zynq FPGA Manager\n', write: () => 'Permission denied' });
    fs.put('/sys/class/fpga_manager/fpga0/state', { read: () => `${this.fpgaState}\n`, write: () => 'Permission denied' });
    fs.put('/sys/class/fpga_manager/fpga0/status', { read: () => '\n', write: () => 'Permission denied' });
    fs.mkdir('/sys/bus/platform/devices/f8007000.devcfg');
    fs.mkdir('/sys/bus/platform/devices/e000b000.ethernet');
    fs.mkdir('/sys/bus/platform/devices/e0001000.serial');
    fs.mkdir('/sys/bus/platform/drivers');
    fs.mkdir('/sys/firmware/devicetree');
  }
  private setTrigger(led: 'led_r' | 'led_g', t: string) {
    this.trig[led] = t;
    const base = `/sys/class/leds/${led}`;
    if (t === 'timer') {
      for (const [i, n] of (['delay_on', 'delay_off'] as const).entries())
        this.fs.put(`${base}/${n}`, {
          read: () => `${this.delay[led][i]}\n`,
          write: (s) => {
            const v = parseInt(s, 10);
            if (Number.isNaN(v) || v < 0) return 'Invalid argument';
            this.delay[led][i] = v;
            this.flag('timer-delay');
            return undefined;
          },
        });
      this.bright[led] = 1;
    } else {
      this.fs.remove(`${base}/delay_on`);
      this.fs.remove(`${base}/delay_off`);
      if (t === 'default-on') this.bright[led] = 1;
    }
  }
  private ledOn(led: 'led_r' | 'led_g'): boolean {
    const t = this.trig[led];
    const k = this.now - this.bootAt;
    if (t === 'heartbeat') {
      const p = k % 1200;
      return p < 70 || (p >= 280 && p < 350);
    }
    if (t === 'timer') {
      const [on, off] = this.delay[led];
      return on + off > 0 && k % (on + off) < on;
    }
    if (t === 'default-on') return true;
    if (t === 'mmc0') return k % 3000 < 40;
    return this.bright[led] > 0 && t === 'none';
  }

  // ---------------------------------------------------------------- the hardware
  private plAlive() {
    return this.design !== 'none' && this.fclk;
  }
  private updateLeds() {
    const linux = ['login', 'password', 'shell'].includes(this.board) || (this.board === 'booting' && this.kt() > 1.7);
    // the PL design routes EMIO GPIO 54/55 to the LEDs; with no design they stay dark
    const routed = this.design !== 'none';
    this.ledR = linux && routed && this.ledOn('led_r') ? 1 : 0;
    this.ledG = linux && routed && this.ledOn('led_g') ? 1 : 0;
    if (this.design === 'light' && this.board !== 'off') {
      if (this.plAlive() && this.now - this.lightAt >= 250) {
        this.lightAt = this.now;
        this.lightStep = (this.lightStep + 1) % 3;
      }
      this.extLed = 1 << this.lightStep;
    } else if (this.design !== 'axigpio' || this.board === 'off') this.extLed = 0;
  }
  // KEY1..KEY5 as the AXI GPIO reads them: active low, bit i = 1 while KEYi+1 is released
  keyBits() {
    let v = 0;
    for (let i = 0; i < 5; i++) if (!this.deps.pressed(`KEY${i + 1}`)) v |= 1 << i;
    return v;
  }
  // the LEDs as the 3D board shows them: [LED_R, LED_G, LED1, LED2, LED3]
  leds(): number[] {
    return [this.ledR, this.ledG, this.extLed & 1, (this.extLed >> 1) & 1, (this.extLed >> 2) & 1];
  }
  on() {
    return this.board !== 'off';
  }

  // a 32-bit bus access from the CPU; undefined = the access never completes (the board hangs)
  private bus(addr: number, value?: number): number | undefined {
    if (addr < 0x10000000) return value === undefined ? 0 : 0; // DDR: nothing interesting stored there
    if (addr >= 0x40000000 && addr < 0x80000000) {
      // M_AXI_GP0: only the AXI GPIO answers, and only while its clock runs
      if (this.design !== 'axigpio' || !this.fclk || addr < AXI_GPIO || addr >= AXI_GPIO + 0x10000) return undefined;
      const off = addr - AXI_GPIO;
      if (value !== undefined) {
        if (off === 0) {
          this.extLed = value & 7;
          this.flag('axi-write');
        }
        return 0;
      }
      if (off === 0) return this.extLed;
      if (off === 4) return 0;
      if (off === 8) {
        this.flag('axi-keys');
        return this.keyBits();
      }
      if (off === 12) return 0x1f;
      return 0;
    }
    return 0;
  }
  private hang(con: Con) {
    this.board = 'hung';
    this.job = {};
    this.say(con, '(simulator: the board has stopped responding. The CPU waits for an AXI answer that never comes. Turn the power off and on again.)', 'note');
    this.flag('hang');
  }

  // ---------------------------------------------------------------- power and boot
  power(on: boolean, quiet = false) {
    this.timeline = [];
    this.job = {};
    if (this.pcState === 'ssh' || this.pcState === 'scp-pass') {
      this.say('pc', `Connection to ${BOARD_IP} closed by remote host.`);
      this.pcState = 'pc';
    }
    if (!on) {
      this.board = 'off';
      this.design = 'none';
      this.extLed = 0;
      this.mods = [];
      this.updateLeds();
      return;
    }
    this.now = 0;
    this.bootAt = 0;
    this.mem.clear();
    this.mods = [];
    this.dmesg = [];
    this.fpgaState = 'operating';
    this.sess.serial.cwd = this.sess.pc.cwd = '/root';
    this.trig = { led_r: 'heartbeat', led_g: 'none' };
    this.bright = { led_r: 0, led_g: 0 };
    this.fs.remove('/sys/bus/platform/devices/41200000.leds');
    this.fs.remove('/sys/bus/platform/drivers/fpgalab_leds');
    // the FSBL configures the PL with the bitstream in BOOT.bin, then starts U-Boot
    this.design = this.cfg.design;
    this.fclk = true;
    this.board = 'booting';
    this.env = new Map(
      Object.entries({
        arch: 'arm',
        baudrate: '115200',
        board: 'zynq',
        bootcmd: 'run distro_bootcmd',
        bootdelay: '2',
        boot_targets: 'mmc0 jtag mmc0 mmc1 qspi nand nor usb0 usb1 pxe dhcp',
        cpu: 'armv7',
        ethaddr: '3e:5c:9a:71:0d:42',
        fdt_addr_r: '0x1f00000',
        kernel_addr_r: '0x2000000',
        scriptaddr: '0x3000000',
        ramdisk_addr_r: '0x3100000',
        soc: 'zynq',
        stderr: 'serial@e0001000',
        stdin: 'serial@e0001000',
        stdout: 'serial@e0001000',
        vendor: 'xilinx',
      }),
    );
    if (quiet) return;
    this.flag('power');
    const lines = [
      '',
      'U-Boot 2019.07-rc4 (simulated)',
      '',
      'CPU:   Zynq 7z010',
      'Silicon: v3.1',
      'Model: Zynq ebaz4205 Board',
      'DRAM:  ECC disabled 256 MiB',
      'NAND:  128 MiB',
      'MMC:   mmc@e0100000: 0',
      'Loading Environment from nowhere... OK',
      'In:    serial@e0001000',
      'Out:   serial@e0001000',
      'Err:   serial@e0001000',
      'Model: Zynq ebaz4205 Board',
      'Net:   ZYNQ GEM: e000b000, phyaddr 0, interface rgmii-id',
      'eth0: ethernet@e000b000',
    ];
    lines.forEach((l, i) => this.after(40 + i * 25, () => this.say('serial', l)));
    const t0 = 40 + lines.length * 25;
    this.after(t0, () => {
      this.board = 'countdown';
      this.say('serial', 'Hit any key to stop autoboot:  2');
    });
    this.after(t0 + 1000, () => this.say('serial', 'Hit any key to stop autoboot:  1', undefined, true));
    this.after(t0 + 2000, () => {
      this.say('serial', 'Hit any key to stop autoboot:  0', undefined, true);
      this.board = 'uboot';
      this.uboot('run distro_bootcmd', false);
    });
  }
  // a key on the serial console: stops the countdown
  key() {
    if (this.board !== 'countdown') return;
    this.timeline = [];
    this.say('serial', 'Hit any key to stop autoboot:  0', undefined, true);
    this.board = 'uboot';
    this.flag('stop-autoboot');
  }
  private finishBootQuietly() {
    this.bootargs = this.cfg.script === 'fpgalab' ? 'console=ttyPS0,115200 root=/dev/mmcblk0p2 rootwait clk_ignore_unused' : 'root=/dev/mmcblk0p2 rootwait';
    this.bootAt = -12000;
    this.now = 0;
    this.kernelState();
    this.dmesgBoot();
    this.board = 'login';
  }
  // what the kernel takes from the device tree and the command line: FPGA Lab's dtb has the fpgalab,axi-leds node
  // and sets fclk-enable = <0x1>; without that or clk_ignore_unused, Linux stops FCLK_CLK0 as an unused clock
  private kernelState() {
    this.dtNode = this.tagOf('/boot/zynq-ebaz4205.dtb') === 'dtb:fpgalab';
    this.fclk = this.bootargs.includes('clk_ignore_unused') || this.dtNode;
  }
  private dmesgBoot() {
    const L = (t: number, m: string) => this.klog(m, t);
    const out = [
      L(0, 'Booting Linux on physical CPU 0x0'),
      L(0, 'Linux version 5.1.5 (buildroot@buildroot) (gcc version 8.3.0 (Buildroot 2019.05)) #1 SMP PREEMPT'),
      L(0, 'CPU: ARMv7 Processor [413fc090] revision 0 (ARMv7), cr=18c5387d'),
      L(0, 'OF: fdt: Machine model: Zynq ebaz4205 Board'),
      L(0, 'Memory: 245796K/262144K available'),
      L(0, `Kernel command line: ${this.bootargs}`),
      L(0.000019, 'zynq_clock_init: clkc starts at (ptrval)'),
      L(0.08, 'smp: Brought up 1 node, 2 CPUs'),
      L(0.62, 'e0001000.serial: ttyPS0 at MMIO 0xe0001000 (irq = 26, base_baud = 6250000) is a xuartps'),
      L(0.63, 'console [ttyPS0] enabled'),
      L(0.64, 'e0000000.serial: ttyPS1 at MMIO 0xe0000000 (irq = 27, base_baud = 6250000) is a xuartps'),
      L(0.71, 'libphy: MACB_mii_bus: probed'),
      L(0.74, 'macb e000b000.ethernet eth0: Cadence GEM rev 0x00020118 at 0xe000b000 irq 28 (3e:5c:9a:71:0d:42)'),
      L(0.8, 'fpga_manager fpga0: Xilinx Zynq FPGA Manager registered'),
      L(0.86, 'ledtrig-cpu: registered to indicate activity on CPUs'),
      L(0.9, 'sdhci-pltfm: SDHCI platform and OF driver helper'),
      L(0.98, 'mmc0: new high speed SDHC card at address aaaa'),
      L(0.99, 'mmcblk0: mmc0:aaaa SC16G 14.8 GiB'),
      L(1.0, ' mmcblk0: p1 p2'),
      L(1.2, this.bootargs.includes('clk_ignore_unused') ? 'clk: Not disabling unused clocks' : 'Freeing unused kernel memory: 1024K'),
      L(1.4, 'EXT4-fs (mmcblk0p2): mounted filesystem with ordered data mode. Opts: (null)'),
      L(1.41, 'VFS: Mounted root (ext4 filesystem) on device 179:2.'),
      L(2.3, 'macb e000b000.ethernet eth0: link up (100/Full)'),
    ];
    return out;
  }
  private bootKernel() {
    this.flag('bootz');
    this.board = 'booting';
    this.bootAt = this.now;
    this.dmesg = [];
    this.kernelState();
    this.say('serial', '');
    this.say('serial', 'Starting kernel ...');
    this.say('serial', '');
    if (!/root=\/dev\/mmcblk0p2\b/.test(this.bootargs) || !/\brootwait\b/.test(this.bootargs)) {
      const why = !/root=/.test(this.bootargs)
        ? 'VFS: Cannot open root device "(null)" or unknown-block(0,0): error -6'
        : 'VFS: Cannot open root device "mmcblk0p2" or unknown-block(0,0): error -6';
      const lines = [
        this.klog('Booting Linux on physical CPU 0x0', 0),
        this.klog(`Kernel command line: ${this.bootargs}`, 0),
        this.klog(why, 0.97),
        this.klog('Please append a correct "root=" boot option; here are the available partitions:', 0.97),
        this.klog('Kernel panic - not syncing: VFS: Unable to mount root fs on unknown-block(0,0)', 0.98),
      ];
      lines.forEach((l, i) => this.after(150 + i * 120, () => this.say('serial', l, i >= 2 ? 'err' : undefined)));
      this.after(800, () => {
        this.board = 'panic';
        this.say('serial', '(simulator: the kernel found no root file system. Check bootargs: root=/dev/mmcblk0p2 rootwait. Turn the power off and on.)', 'note');
        this.flag('panic');
      });
      return;
    }
    const kl = this.dmesgBoot();
    kl.forEach((l, i) => this.after(120 + i * 70, () => this.say('serial', l)));
    const svc = ['Starting syslogd: OK', 'Starting klogd: OK', 'Running sysctl: OK', 'Populating /dev using udev: done', 'Initializing random number generator: OK', 'Saving random seed: OK', 'Starting network: OK', 'Starting dnsmasq: OK', 'Starting sshd: OK', '', 'Welcome to Buildroot'];
    const t1 = 120 + kl.length * 70;
    svc.forEach((l, i) => this.after(t1 + 200 + i * 90, () => this.say('serial', l)));
    this.after(t1 + 200 + svc.length * 90, () => {
      this.board = 'login';
      this.flag('booted');
    });
  }

  // ---------------------------------------------------------------- input
  // a line typed on a console (Enter)
  enter(con: Con, line: string) {
    if (con === 'pc') return this.pcLine(line);
    const shown = this.prompt('serial') + (this.secret('serial') ? '' : line);
    if (this.board === 'countdown') return this.key();
    if (!this.ready('serial')) return;
    this.say('serial', shown, 'dim');
    if (this.board === 'uboot') return this.uboot(line, true);
    if (this.board === 'login') {
      this.loginUser = line.trim();
      if (this.loginUser) this.board = 'password';
      return;
    }
    if (this.board === 'password') {
      if (this.loginUser === 'root' && line === 'root') {
        this.board = 'shell';
        this.flag('login');
      } else {
        this.say('serial', 'Login incorrect');
        this.board = 'login';
      }
      return;
    }
    if (this.board === 'shell') this.shell('serial', line);
  }
  // Ctrl-C
  interrupt(con: Con) {
    const j = this.job[con];
    if (j) {
      j.stop();
      delete this.job[con];
      this.say(con, '^C');
      return;
    }
    if (con === 'serial' && this.board === 'countdown') return this.key();
    if (this.ready(con)) this.say(con, `${this.prompt(con)}^C`, 'dim');
  }

  // ---------------------------------------------------------------- U-Boot
  private uboot(line: string, typed: boolean) {
    const s = (t: string, c?: Out['cls']) => this.say('serial', t, c);
    const env = (k: string) => this.env.get(k) ?? '';
    const expanded = line.replace(/\$\{(\w+)\}|\$(\w+)/g, (_m, a, b) => env(a ?? b));
    const a = splitArgs(expanded);
    if (!a.length) return;
    const cmd = a[0];
    // U-Boot reads every number as hexadecimal
    const num = (x: string) => parseInt(x, 16);
    const dev = (spec: string | undefined, def: string) => spec ?? def;
    switch (cmd) {
      case 'help':
      case '?':
        s(UBOOT_HELP);
        return;
      case 'version':
        s('U-Boot 2019.07-rc4 (simulated)\narm-buildroot-linux-gnueabihf-gcc.br_real (Buildroot 2019.05) 8.3.0');
        return;
      case 'printenv': {
        if (a[1]) {
          const v = this.env.get(a[1]);
          s(v === undefined ? `## Error: "${a[1]}" not defined` : `${a[1]}=${v}`, v === undefined ? 'err' : undefined);
        } else {
          for (const [k, v] of [...this.env.entries()].sort()) s(`${k}=${v}`);
          s('', undefined);
          s(`Environment size: ${[...this.env].reduce((n, [k, v]) => n + k.length + v.length + 2, 0)}/131068 bytes`);
        }
        this.flag('printenv');
        return;
      }
      case 'setenv':
        if (!a[1]) return s('setenv - set environment variables\n\nUsage:\nsetenv [-f] name value ...', 'err');
        if (a.length === 2) this.env.delete(a[1]);
        else this.env.set(a[1], a.slice(2).join(' '));
        if (a[1] === 'bootargs') {
          this.bootargs = this.env.get('bootargs') ?? '';
          if (typed) this.flag('setenv-bootargs');
        }
        return;
      case 'echo':
        s(a.slice(1).join(' '));
        return;
      case 'saveenv':
        s('(simulator: this U-Boot keeps its environment nowhere (CONFIG_ENV_IS_NOWHERE), so changes are lost at power-off. Put lasting changes into boot.scr.)', 'note');
        return;
      case 'bdinfo':
        s('arch_number = 0x00000000\nboot_params = 0x00000000\nDRAM bank   = 0x00000000\n-> start    = 0x00000000\n-> size     = 0x10000000\nbaudrate    = 115200 bps\nrelocaddr   = 0x0ff2f000');
        return;
      case 'coninfo':
        s('List of available devices:\nserial@e0001000 00000007 IO stdin stdout stderr\nserial 00000003 IO');
        return;
      case 'mmc':
        if (a[1] === 'list') s('mmc@e0100000: 0 (SD)');
        else if (a[1] === 'info') s('Device: mmc@e0100000\nManufacturer ID: 3\nOEM: 5344\nName: SC16G\nBus Speed: 50000000\nMode : SD High Speed (50MHz)\nRd Block Len: 512\nSD version 3.0\nHigh Capacity: Yes\nCapacity: 14.8 GiB\nBus Width: 4-bit\nErase Group Size: 512 Bytes');
        else if (a[1] === 'part')
          s('\nPartition Map for MMC device 0  --   Partition Type: DOS\n\nPart\tStart Sector\tNum Sectors\tUUID\t\tType\n  1\t2048      \t16384     \t00000000-01\t0c Boot\n  2\t18432     \t524288    \t00000000-02\t83');
        else if (a[1] === 'dev' || a[1] === 'rescan') s('switch to partitions #0, OK\nmmc0 is current device');
        else s('mmc - MMC sub system\n\nUsage:\nmmc info | list | part | dev [dev] | rescan', 'err');
        this.flag('mmc');
        return;
      case 'fatls': {
        const p = dev(a[2], '0:1');
        if (a[1] !== 'mmc' || !/^0(:1)?$/.test(p)) return s(`** Bad device specification ${a[1] ?? ''} ${p} **`, 'err');
        for (const [n, [, size]] of this.fat) s(`${pad(size, 9)}   ${n}`);
        s(`\n${this.fat.size} file(s), 0 dir(s)\n`);
        this.flag('fatls');
        return;
      }
      case 'ext4ls': {
        const p = dev(a[2], '0:2');
        if (a[1] !== 'mmc' || p !== '0:2') return s(p === '0:1' || p === '0' ? '** Unrecognized filesystem type **' : `** Bad device specification ${a[1] ?? ''} ${p} **`, 'err');
        const dir = normalize(a[3] ?? '/');
        if (!this.fs.isDir(dir)) return s(`** Can not find directory. **`, 'err');
        s('<DIR>       4096 .\n<DIR>       4096 ..');
        for (const n of this.fs.list(dir)) {
          const p2 = `${dir === '/' ? '' : dir}/${n}`;
          const f = this.fs.file(p2);
          s(f ? `${pad(f.size ?? f.read().length, 16)} ${n}` : `<DIR>       4096 ${n}`);
        }
        this.flag('ext4ls');
        return;
      }
      case 'fatload':
      case 'ext4load':
      case 'load': {
        const isFat = cmd === 'fatload' || (cmd === 'load' && (a[2] ?? '').endsWith(':1'));
        const p = a[2] ?? '';
        const addr = a[3] ? num(a[3]) : num(env('loadaddr') || '0x0');
        const name = a[4] ?? '';
        if (a[1] !== 'mmc' || !a[3] || !name) return s(`${cmd} - load binary file from a filesystem\n\nUsage:\n${cmd} <interface> [<dev[:part]> [<addr> [<filename> [bytes [pos]]]]]`, 'err');
        let kind: string | undefined;
        let size = 0;
        if (isFat) {
          if (!/^0(:1)?$/.test(p)) return s('** Unrecognized filesystem type **', 'err');
          const f = this.fat.get(name.replace(/^\//, ''));
          if (f) [kind, size] = f;
        } else {
          if (p !== '0:2') return s('** Unrecognized filesystem type **', 'err');
          const path = normalize(name);
          const f = this.fs.file(path);
          if (f) {
            size = f.size ?? f.read().length;
            kind = path === '/boot/zImage' ? 'zimage' : this.tagOf(path) ?? `file:${path}`;
          }
        }
        if (!kind) return s(`** File not found ${name} **`, 'err');
        this.mem.set(addr, kind);
        this.env.set('filesize', size.toString(16));
        s(`${size} bytes read in ${Math.max(1, Math.round(size / 18000))} ms (${(18000 / 1024 / 1.024).toFixed(1)} MiB/s)`);
        if (typed) this.flag(`load:${kind.split(':')[0]}`);
        return;
      }
      case 'bootz': {
        const k = a[1] ? num(a[1]) : num(env('kernel_addr_r'));
        const f = a[3] ? num(a[3]) : NaN;
        if (this.mem.get(k) !== 'zimage') return s('Bad Linux ARM zImage magic!', 'err');
        s(`Kernel image @ 0x${k.toString(16)} [ 0x000000 - 0x400310 ]`);
        if (Number.isNaN(f) || !(this.mem.get(f) ?? '').startsWith('dtb')) {
          if (!Number.isNaN(f)) s('ERROR: Did not find a cmdline Flattened Device Tree', 'err');
          else s('FDT and ATAGS support not compiled in - hanging\n### ERROR ### Please RESET the board ###', 'err');
          this.board = 'hung';
          return;
        }
        s(`## Flattened Device Tree blob at ${f.toString(16).padStart(8, '0')}\n   Booting using the fdt blob at 0x${f.toString(16)}\n   Loading Device Tree to 0eb1a000, end 0eb1fd52 ... OK`);
        this.bootargs = this.env.get('bootargs') ?? '';
        this.bootKernel();
        return;
      }
      case 'boot':
      case 'run': {
        const what = cmd === 'boot' ? 'bootcmd' : a[1];
        if (!what) return s('run - run commands in an environment variable', 'err');
        if (what === 'bootcmd' || what === 'distro_bootcmd' || what === 'bootcmd_mmc0') {
          s('switch to partitions #0, OK\nmmc0 is current device\nScanning mmc 0:1...\nFound U-Boot script /boot.scr');
          s(`${this.scr.length + 72} bytes read in 9 ms (28.3 KiB/s)\n## Executing script at 03000000`);
          if (typed) this.flag('boot');
          for (const l of this.scr.split('\n')) {
            if (this.board !== 'uboot') break;
            this.uboot(l, false);
          }
          return;
        }
        const v = this.env.get(what);
        if (v === undefined) return s(`## Error: "${what}" not defined`, 'err');
        for (const l of v.split(';')) this.uboot(l.trim(), typed);
        return;
      }
      case 'fpga': {
        if (a[1] === 'info') {
          s('Xilinx Device\nDescriptor @ 0x0ff8e2a4\nFamily:         Zynq PL\nInterface type: Device configuration interface (Zynq)\nDevice Size:    2083740 bytes\nCookie:         0x0 (0)\nDevice name:    7z010');
          this.flag('fpga-info');
          return;
        }
        if (a[1] === 'loadb' || a[1] === 'load') {
          const kind = this.mem.get(num(a[3] ?? '0')) ?? '';
          if (!kind.startsWith('bin:') && !kind.startsWith('bit:')) return s('zynq_validate_bitstream: Bitstream is not validated yet (diff 0)\nzynq_load: Bitstream is not validated', 'err');
          this.design = kind.slice(4) as Design;
          s('  bytes in bitstream = 2083740\nzynq_align_dma_buffer: Align buffer at 1000000 to fff00(swap 0)');
          this.flag('fpga-load-uboot');
          return;
        }
        s('fpga - loadable FPGA image support\n\nUsage:\nfpga [operation type] [device number] [image address] [image size]\nfpga operations:\n  info   list known device information\n  load   Load device from memory buffer\n  loadb  Load device from bitstream buffer (Xilinx only)', 'err');
        return;
      }
      case 'reset':
        s('resetting ...');
        this.power(true);
        return;
      default:
        s(`Unknown command '${cmd}' - try 'help'`, 'err');
    }
  }

  // ---------------------------------------------------------------- the PC
  private pcLine(line: string) {
    const st = this.pcState;
    if (st === 'ssh') {
      if (!this.linuxUp()) return; // the remote side is gone or frozen
      this.say('pc', this.shellPrompt('pc') + line, 'dim');
      return this.shell('pc', line);
    }
    if (this.job.pc) return;
    if (st === 'ssh-confirm') {
      this.say('pc', this.prompt('pc') + line, 'dim');
      if (line.trim() !== 'yes') {
        this.say('pc', 'Host key verification failed.', 'err');
        this.pcState = 'pc';
        this.pending = null;
        return;
      }
      this.known = true;
      this.say('pc', `Warning: Permanently added '${BOARD_IP}' (ECDSA) to the list of known hosts.`);
      this.pcState = this.pending?.kind === 'scp' ? 'scp-pass' : 'ssh-pass';
      return;
    }
    if (st === 'ssh-pass' || st === 'scp-pass') {
      this.say('pc', this.prompt('pc'), 'dim');
      if (line !== 'root') {
        this.say('pc', 'Permission denied, please try again.', 'err');
        return;
      }
      const p = this.pending;
      this.pending = null;
      if (st === 'ssh-pass') {
        this.pcState = 'ssh';
        this.sess.pc.cwd = '/root';
        this.flag('ssh');
      } else if (p?.kind === 'scp') {
        this.pcState = 'pc';
        this.scpDo(p.src, p.dst, p.up);
      }
      return;
    }
    this.say('pc', `pc$ ${line}`, 'dim');
    const a = splitArgs(line);
    if (!a.length) return;
    const reach = () => ['login', 'password', 'shell'].includes(this.board) && this.design !== 'none';
    const sshUp = () => this.board === 'shell' || this.board === 'login' || this.board === 'password';
    switch (a[0]) {
      case 'help':
        this.say('pc', 'A PC on the board\'s network cable. Commands: ssh root@192.168.100.1, scp FILE root@192.168.100.1:/root/, ping 192.168.100.1, ip addr (or ipconfig), ls, clear');
        return;
      case 'ls':
      case 'dir':
        this.say('pc', [...this.pcFiles.keys()].join('  ') || '(empty)');
        return;
      case 'ip':
      case 'ipconfig':
      case 'ifconfig':
        this.say('pc', reach() ? `eth0: ${PC_IP}/24 (from the board's DHCP server, dnsmasq)` : 'eth0: no address (the cable is in, but nothing answers DHCP)');
        this.flag('pc-ip');
        return;
      case 'ping': {
        const host = a.filter((x) => !x.startsWith('-') && !/^\d+$/.test(x)).slice(1)[0] ?? '';
        if (host !== BOARD_IP && host !== 'buildroot') return this.say('pc', `ping: ${host || '(no host)'}: Name or service not known`, 'err');
        this.say('pc', `PING ${BOARD_IP} 56(84) bytes of data.`);
        let n = 0;
        this.job.pc = {
          tick: (dt) => {
            n += dt;
            if (n < 1000) return;
            n -= 1000;
            if (reach()) {
              this.say('pc', `64 bytes from ${BOARD_IP}: icmp_seq=${Math.round(this.now / 1000) % 1000} ttl=64 time=0.4${Math.floor(Math.random() * 9)} ms`);
              this.flag('ping');
            } else this.say('pc', `From ${PC_IP} icmp_seq=${Math.round(this.now / 1000) % 1000} Destination Host Unreachable`);
          },
          stop: () => {},
        };
        this.say('pc', '(simulator: Ctrl+C stops it)', 'note');
        return;
      }
      case 'ssh': {
        const target = a.find((x, i) => i > 0 && !x.startsWith('-')) ?? '';
        const host = target.includes('@') ? target.split('@')[1] : target;
        const user = target.includes('@') ? target.split('@')[0] : 'you';
        if (host !== BOARD_IP) return this.say('pc', `ssh: Could not resolve hostname ${host || '(none)'}: Name or service not known`, 'err');
        if (!sshUp() || this.design === 'none') return this.say('pc', `ssh: connect to host ${BOARD_IP} port 22: ${this.board === 'off' ? 'No route to host' : 'Connection timed out'}`, 'err');
        if (user !== 'root') return this.say('pc', `${user}@${BOARD_IP}: Permission denied (publickey,password).\n(simulator: the image has one user, root)`, 'err');
        this.pending = { kind: 'ssh' };
        if (!this.known) {
          this.say('pc', `The authenticity of host '${BOARD_IP} (${BOARD_IP})' can't be established.\nECDSA key fingerprint is SHA256:Qm4b2c0oXo1Hhq7x3j5u2fJ9v0bL1x8sZcR5a7Uq9kE.`);
          this.pcState = 'ssh-confirm';
        } else this.pcState = 'ssh-pass';
        return;
      }
      case 'scp': {
        const args = a.slice(1).filter((x) => !x.startsWith('-'));
        if (args.length !== 2) return this.say('pc', 'usage: scp FILE root@192.168.100.1:/path/   or   scp root@192.168.100.1:/path/FILE .', 'err');
        const [src, dst] = args;
        const up = dst.includes(':');
        const remote = up ? dst : src;
        if (!remote.startsWith(`root@${BOARD_IP}:`)) return this.say('pc', `ssh: Could not resolve hostname ${remote.split(':')[0].split('@').pop()}: Name or service not known`, 'err');
        if (up && !this.pcFiles.has(src)) return this.say('pc', `${src}: No such file or directory`, 'err');
        if (!sshUp() || this.design === 'none') return this.say('pc', `ssh: connect to host ${BOARD_IP} port 22: Connection timed out`, 'err');
        this.pending = { kind: 'scp', src, dst, up };
        if (!this.known) {
          this.say('pc', `The authenticity of host '${BOARD_IP} (${BOARD_IP})' can't be established.\nECDSA key fingerprint is SHA256:Qm4b2c0oXo1Hhq7x3j5u2fJ9v0bL1x8sZcR5a7Uq9kE.`);
          this.pcState = 'ssh-confirm';
        } else this.pcState = 'scp-pass';
        return;
      }
      case 'clear':
      case 'cls':
        return;
      default:
        this.say('pc', `${a[0]}: command not found (simulator: try help)`, 'err');
    }
  }
  private scpDo(src: string, dst: string, up: boolean) {
    if (up) {
      let path = normalize(dst.slice(dst.indexOf(':') + 1) || '/root');
      if (this.fs.isDir(path)) path = `${path === '/' ? '' : path}/${src}`;
      if (!this.fs.parentExists(path)) return this.say('pc', `scp: ${path}: No such file or directory`, 'err');
      const [kind, size] = this.pcFiles.get(src)!;
      if (kind.startsWith('src:')) this.fs.text(path, GPIO_MEM_HEAD);
      else this.fs.put(path, { read: () => '\x7fELF', size, exec: kind.startsWith('elf'), tag: kind } as VFile & { tag: string });
      this.say('pc', `${src.padEnd(34)} 100% ${Math.round(size / 1024)}KB ${(size / 1024 / 1.6 / 1024 + 0.1).toFixed(1)}MB/s   00:00`);
      this.flag(`scp:${basename(path)}:${path}`);
      this.flag(`scp:${src}`);
    } else {
      const path = normalize(src.slice(src.indexOf(':') + 1));
      const f = this.fs.file(path);
      if (!f) return this.say('pc', `scp: ${path}: No such file or directory`, 'err');
      this.pcFiles.set(basename(path), [this.tagOf(path) ?? 'file', f.size ?? f.read().length]);
      this.say('pc', `${basename(path).padEnd(34)} 100% ${Math.max(1, Math.round((f.size ?? 0) / 1024))}KB   00:00`);
    }
  }

  // ---------------------------------------------------------------- the shell (BusyBox ash)
  private shell(con: Con, line: string) {
    // ; and && separate commands (no quoting across them in this simple model)
    const parts = splitTop(line);
    for (const { cmd, op } of parts) {
      const ok = this.pipeline(con, cmd);
      if (!this.alive(con) || this.job[con]) return;
      if (op === '&&' && !ok) return;
    }
  }
  private pipeline(con: Con, line: string): boolean {
    const stages = splitPipe(line);
    let input: string | null = null;
    let ok = true;
    for (let i = 0; i < stages.length; i++) {
      let st = stages[i].trim();
      if (!st) continue;
      // redirection
      let redir: { path: string; append: boolean } | null = null;
      const m = st.match(/^(.*?)\s*(>>?)\s*(\S+)\s*$/);
      if (m && !/^\s*$/.test(m[1])) {
        st = m[1];
        redir = { path: m[3], append: m[2] === '>>' };
      }
      const last = i === stages.length - 1;
      const res = this.run(con, splitArgs(st), input);
      if (!res) return false;
      ok = res.ok;
      if (!this.alive(con)) return ok;
      if (redir) {
        const p = normalize(redir.path, this.sess[con].cwd);
        const err = this.writeFile(p, res.out, redir.append);
        if (err) {
          this.say(con, `-sh: can't create ${redir.path}: ${err}`, 'err');
          return false;
        }
        input = '';
        continue;
      }
      if (last) {
        if (res.out) this.say(con, res.out.replace(/\n$/, ''));
      } else input = res.out;
      if (res.err) this.say(con, res.err.replace(/\n$/, ''), 'err');
    }
    return ok;
  }
  private writeFile(p: string, text: string, append: boolean): string | undefined {
    const f = this.fs.file(p);
    if (this.fs.isDir(p)) return 'Is a directory';
    if (f) {
      if (!f.write) return 'Permission denied';
      return f.write(text, append);
    }
    if (p.startsWith('/sys/') || p.startsWith('/proc/')) return p.startsWith('/sys/') ? 'Permission denied' : 'No such file or directory';
    if (!this.fs.parentExists(p)) return 'nonexistent directory';
    this.fs.text(p, text);
    return undefined;
  }

  // one command; out = what it prints, err = its error lines; undefined = it took over the console
  private run(con: Con, a: string[], input: string | null): { out: string; err?: string; ok: boolean } | undefined {
    const cwd = this.sess[con].cwd;
    const P = (x: string) => normalize(x, cwd);
    const R = (out: string, ok = true) => ({ out, ok });
    const E = (err: string) => ({ out: '', err, ok: false });
    const cmd = a[0];
    const args = a.slice(1);
    const opts = args.filter((x) => /^-\w/.test(x)).join('');
    const operands = args.filter((x) => !/^-\w/.test(x));
    switch (cmd) {
      case 'help':
        return R(SHELL_HELP);
      case 'pwd':
        return R(`${cwd}\n`);
      case 'cd': {
        const d = P(operands[0] ?? '/root');
        if (!this.fs.isDir(d)) return E(`-sh: cd: can't cd to ${operands[0]}: No such file or directory`);
        this.sess[con].cwd = d;
        return R('');
      }
      case 'ls': {
        const targets = operands.length ? operands : ['.'];
        const lines: string[] = [];
        for (const t of targets) {
          const p = P(t);
          if (this.fs.isDir(p)) {
            const names = this.fs.list(p);
            if (opts.includes('l')) {
              for (const n of names) {
                const q = `${p === '/' ? '' : p}/${n}`;
                const f = this.fs.file(q);
                lines.push(f ? `${f.dev ? 'crw-------' : f.exec ? '-rwxr-xr-x' : '-rw-r--r--'}    1 root     root     ${pad(f.size ?? f.read().length, 8)} Jan  1 00:00 ${n}` : `drwxr-xr-x    2 root     root         4096 Jan  1 00:00 ${n}`);
              }
            } else lines.push(names.join('  '));
          } else if (this.fs.exists(p)) lines.push(t);
          else return E(`ls: ${t}: No such file or directory`);
        }
        return R(lines.filter((l) => l !== '').join('\n') + '\n');
      }
      case 'cat': {
        if (!operands.length) return R(input ?? '');
        let out = '';
        for (const t of operands) {
          const p = P(t);
          if (this.fs.isDir(p)) return E(`cat: read error: Is a directory`);
          const f = this.fs.file(p);
          if (!f) return E(`cat: can't open '${t}': No such file or directory`);
          if (this.isAxiAttr(p) && !this.plAlive()) {
            this.hang(con);
            return undefined;
          }
          const tag = this.tagOf(p);
          if (tag && !tag.startsWith('dtb') && !tag.startsWith('src')) out += '\x7fELF(binary data)\n';
          else if (tag?.startsWith('dtb')) out += '\xd0\x0d\xfe\xed(binary device tree)\n';
          else out += f.read();
          if (p.startsWith('/sys/class/leds')) this.flag('cat-leds');
          if (p === '/proc/cmdline') this.flag('cmdline');
          if (p.startsWith('/sys/class/fpga_manager')) this.flag('fpga-sysfs');
          if (p.startsWith('/sys/bus/platform/devices/41200000.leds/keys')) this.flag('driver-keys');
        }
        return R(out);
      }
      case 'echo': {
        const n = args[0] === '-n';
        const txt = (n ? args.slice(1) : args).join(' ');
        return R(n ? txt : `${txt}\n`);
      }
      case 'touch':
        for (const t of operands) if (!this.fs.exists(P(t))) {
          const e = this.writeFile(P(t), '', false);
          if (e) return E(`touch: ${t}: ${e}`);
        }
        return R('');
      case 'mkdir':
        for (const t of operands) {
          const p = P(t);
          if (this.fs.exists(p) && !opts.includes('p')) return E(`mkdir: can't create directory '${t}': File exists`);
          if (!opts.includes('p') && !this.fs.parentExists(p)) return E(`mkdir: can't create directory '${t}': No such file or directory`);
          this.fs.mkdir(p);
          if (p === '/lib/firmware') this.flag('mkdir-firmware');
        }
        return R('');
      case 'rm':
        for (const t of operands) {
          const p = P(t);
          if (!this.fs.exists(p)) return E(`rm: can't remove '${t}': No such file or directory`);
          if (this.fs.isDir(p) && !opts.includes('r')) return E(`rm: '${t}' is a directory`);
          if (p.startsWith('/sys') || p.startsWith('/proc')) return E(`rm: can't remove '${t}': Operation not permitted`);
          this.fs.remove(p);
        }
        return R('');
      case 'cp':
      case 'mv': {
        if (operands.length !== 2) return E(`BusyBox v1.30.1 multi-call binary.\n\nUsage: ${cmd} SOURCE DEST`);
        const s = P(operands[0]);
        let d = P(operands[1]);
        const f = this.fs.file(s);
        if (!f) return E(`${cmd}: can't stat '${operands[0]}': No such file or directory`);
        if (this.fs.isDir(d)) d = `${d === '/' ? '' : d}/${basename(s)}`;
        if (!this.fs.parentExists(d)) return E(`${cmd}: can't create '${operands[1]}': No such file or directory`);
        const tag = this.tagOf(s);
        if (tag) this.fs.put(d, { read: f.read, size: f.size, exec: f.exec, tag } as VFile & { tag: string });
        else this.fs.text(d, f.read(), f.exec);
        if (cmd === 'mv') this.fs.remove(s);
        if (d.startsWith('/lib/firmware/')) this.flag('cp-firmware');
        if (d === '/boot/zynq-ebaz4205.dtb') this.flag('dtb-installed');
        return R('');
      }
      case 'chmod':
      case 'sync':
      case 'true':
        return R('');
      case 'false':
        return { out: '', ok: false };
      case 'sleep':
        return R('');
      case 'uname': {
        this.flag('uname');
        const r = '5.1.5';
        if (opts.includes('a')) return R(`Linux buildroot ${r} #1 SMP PREEMPT Sat Jun 1 00:00:00 UTC 2019 armv7l GNU/Linux\n`);
        if (opts.includes('r')) return R(`${r}\n`);
        if (opts.includes('m')) return R('armv7l\n');
        return R('Linux\n');
      }
      case 'hostname':
        return R('buildroot\n');
      case 'whoami':
        return R('root\n');
      case 'id':
        return R('uid=0(root) gid=0(root) groups=0(root)\n');
      case 'date':
        return R('Sat Jan  1 00:0' + Math.min(9, Math.floor(this.kt() / 60)) + ':00 UTC 2000\n');
      case 'uptime':
        return R(` 00:0${Math.min(9, Math.floor(this.kt() / 60))}:00 up ${Math.floor(this.kt() / 60)} min,  load average: 0.00, 0.00, 0.00\n`);
      case 'free':
        return R('              total        used        free      shared  buff/cache   available\nMem:         245796       16240      208404          52       21152      214552\nSwap:             0           0           0\n');
      case 'df':
        return R('Filesystem           1K-blocks      Used Available Use% Mounted on\n/dev/root                75138     52164     17222  75% /\ndevtmpfs                122896         0    122896   0% /dev\ntmpfs                   122896         0    122896   0% /dev/shm\n');
      case 'mount': {
        if (!operands.length)
          return R('/dev/root on / type ext4 (rw,relatime)\ndevtmpfs on /dev type devtmpfs (rw,relatime)\nproc on /proc type proc (rw,relatime)\nsysfs on /sys type sysfs (rw,relatime)\n' + (this.fs.exists('/mnt/boot.bin') ? '/dev/mmcblk0p1 on /mnt type vfat (rw,relatime)\n' : ''));
        if (operands[0] === '/dev/mmcblk0p1' && P(operands[1] ?? '') === '/mnt') {
          for (const [n, [, size]] of this.fat) this.fs.put(`/mnt/${n}`, { read: () => '(binary)', size });
          this.flag('mount-boot');
          return R('');
        }
        return E(`mount: mounting ${operands[0]} on ${operands[1] ?? '?'} failed: Invalid argument`);
      }
      case 'umount':
        if (P(operands[0] ?? '') === '/mnt') for (const n of this.fs.list('/mnt')) this.fs.remove(`/mnt/${n}`);
        return R('');
      case 'ps':
        return R('PID   USER     COMMAND\n    1 root     init\n  112 root     /sbin/syslogd -n\n  116 root     /sbin/klogd -n\n  141 root     /sbin/udevd -d\n  203 nobody   /usr/sbin/dnsmasq\n  221 root     /usr/sbin/sshd\n  230 root     -sh\n  245 root     ps\n');
      case 'dmesg':
        this.flag('dmesg');
        return R(this.dmesg.join('\n') + '\n');
      case 'grep': {
        const pat = operands[0];
        if (!pat) return E('Usage: grep PATTERN [FILE]');
        let text = input ?? '';
        if (operands[1]) {
          const f = this.fs.file(P(operands[1]));
          if (!f) return E(`grep: ${operands[1]}: No such file or directory`);
          text = f.read();
        }
        const re = new RegExp(pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), opts.includes('i') ? 'i' : '');
        const lines = text.split('\n').filter((l) => re.test(l));
        return { out: lines.length ? `${lines.join('\n')}\n` : '', ok: lines.length > 0 };
      }
      case 'head':
      case 'tail': {
        const n = Number((args.find((x) => /^-\d+$/.test(x)) ?? '-10').slice(1)) || Number(args[args.indexOf('-n') + 1]) || 10;
        let text = input ?? '';
        const file = operands.find((x) => !/^\d+$/.test(x));
        if (file) {
          const f = this.fs.file(P(file));
          if (!f) return E(`${cmd}: can't open '${file}': No such file or directory`);
          text = f.read();
        }
        const lines = text.replace(/\n$/, '').split('\n');
        return R(`${(cmd === 'head' ? lines.slice(0, n) : lines.slice(-n)).join('\n')}\n`);
      }
      case 'wc':
        return R(`${(input ?? '').replace(/\n$/, '').split('\n').length}\n`);
      case 'ip':
      case 'ifconfig': {
        this.flag('ip');
        const sub = operands[0];
        if (cmd === 'ip' && sub === 'route') return R(`192.168.100.0/24 dev eth0 scope link  src ${BOARD_IP}\n`);
        if (cmd === 'ip' && sub && !/^a(ddr)?$/.test(sub) && sub !== 'link') return E(`ip: invalid argument '${sub}'`);
        return R(
          cmd === 'ip'
            ? `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast qlen 1000\n    link/ether 3e:5c:9a:71:0d:42 brd ff:ff:ff:ff:ff:ff\n    inet ${BOARD_IP}/24 brd 192.168.100.255 scope global eth0\n`
            : `eth0      Link encap:Ethernet  HWaddr 3E:5C:9A:71:0D:42\n          inet addr:${BOARD_IP}  Bcast:192.168.100.255  Mask:255.255.255.0\n          UP BROADCAST RUNNING MULTICAST  MTU:1500  Metric:1\n\nlo        Link encap:Local Loopback\n          inet addr:127.0.0.1  Mask:255.0.0.0\n`,
        );
      }
      case 'ping': {
        const host = operands.find((x) => !/^\d+$/.test(x));
        if (host !== PC_IP && host !== BOARD_IP && host !== '127.0.0.1') return E(`ping: bad address '${host ?? ''}'`);
        return R(`PING ${host} (${host}): 56 data bytes\n64 bytes from ${host}: seq=0 ttl=64 time=0.512 ms\n64 bytes from ${host}: seq=1 ttl=64 time=0.398 ms\n\n--- ${host} ping statistics ---\n2 packets transmitted, 2 packets received, 0% packet loss\n`);
      }
      case 'devmem':
        return this.devmem(con, operands);
      case './gpio_mem':
      case '/root/gpio_mem':
      case 'gpio_mem':
        if (cmd === 'gpio_mem' || !this.fs.file(P(cmd))) return E(`-sh: ${cmd}: not found`);
        return this.gpioMem(con, operands);
      case 'insmod':
        return this.insmod(con, operands);
      case 'rmmod': {
        const n = (operands[0] ?? '').replace(/\.ko$/, '');
        const i = this.mods.findIndex((m) => m.name === n);
        if (i < 0) return E(`rmmod: ERROR: Module ${n} is not currently loaded`);
        this.mods.splice(i, 1);
        if (n === 'fpgalab_leds') {
          this.fs.remove('/sys/bus/platform/devices/41200000.leds/leds');
          this.fs.remove('/sys/bus/platform/devices/41200000.leds/keys');
          this.fs.remove('/sys/bus/platform/devices/41200000.leds/driver');
          this.fs.remove('/sys/bus/platform/drivers/fpgalab_leds');
        }
        this.flag(`rmmod:${n}`);
        return R('');
      }
      case 'lsmod':
        return R(`Module                  Size  Used by\n${this.mods.map((m) => `${m.name.padEnd(24)}${pad(m.size, 4)}  0`).join('\n')}${this.mods.length ? '\n' : ''}`);
      case 'modinfo': {
        const p = P(operands[0] ?? '');
        const tag = this.tagOf(p);
        if (!tag?.startsWith('ko:')) return E(`modinfo: ERROR: Module ${operands[0] ?? ''} not found.`);
        const n = tag.slice(3);
        return R(
          n === 'fpgalab_leds'
            ? `filename:       ${p}\ndescription:    FPGA Lab: LED1-LED3 and KEY1-KEY5 of an AXI GPIO\nlicense:        GPL\nalias:          of:N*T*Cfpgalab,axi-leds\ndepends:\nvermagic:       5.1.5 SMP preempt mod_unload ARMv7 p2v8\n`
            : `filename:       ${p}\ndescription:    FPGA Lab: load a bitstream from /lib/firmware with the FPGA manager\nlicense:        GPL\ndepends:\nvermagic:       5.1.5 SMP preempt mod_unload ARMv7 p2v8\nparm:           firmware:file in /lib/firmware (charp)\n`,
        );
      }
      case 'clear':
        return R('');
      case 'history':
        return R('(simulator: use the Up and Down arrow keys)\n');
      case 'nano':
      case 'vi':
        return E(`(simulator: ${cmd} is a full-screen editor and is not modelled here. Write a file with echo, for example: echo "text" > file)`);
      case 'which':
        return R(operands.map((x) => (['ls', 'cat', 'devmem', 'insmod', 'ip', 'mount'].includes(x) ? `/bin/${x}\n` : '')).join(''));
      case 'fpgautil':
        return E('-sh: fpgautil: not found\n(simulator: fpgautil comes with PetaLinux, not with this Buildroot image)');
      case 'exit':
      case 'logout':
        if (con === 'pc') {
          this.pcState = 'pc';
          this.say('pc', `Connection to ${BOARD_IP} closed.`);
        } else {
          this.board = 'login';
          this.say('serial', '\nWelcome to Buildroot');
        }
        return undefined;
      case 'reboot':
      case 'poweroff':
      case 'halt': {
        const off = cmd !== 'reboot';
        this.sayBoth('Stopping sshd: OK\nStopping dnsmasq: OK\nStopping network: OK\nSaving random seed: OK\nStopping klogd: OK\nStopping syslogd: OK\numount: devtmpfs busy - remounted read-only\nThe system is going down NOW!\nSent SIGTERM to all processes\nSent SIGKILL to all processes');
        this.say('serial', off ? 'Requesting system poweroff\n' + this.klog('reboot: Power down') : 'Requesting system reboot\n' + this.klog('reboot: Restarting system'));
        if (con === 'pc' || this.pcState === 'ssh') {
          this.pcState = 'pc';
          this.say('pc', `Connection to ${BOARD_IP} closed by remote host.`);
        }
        this.board = 'booting';
        this.flag(cmd);
        // poweroff leaves the board running nothing; the Zynq has no power switch of its own
        this.after(400, () => (off ? (this.board = 'off', this.design = 'none') : this.power(true)));
        return undefined;
      }
      default:
        return E(`-sh: ${cmd}: not found`);
    }
  }

  // Linux runs (the serial console may sit at its login prompt while the PC is logged in over SSH)
  private linuxUp() {
    return this.board === 'login' || this.board === 'password' || this.board === 'shell';
  }
  // the console still has a shell
  private alive(con: Con) {
    return con === 'pc' ? this.linuxUp() && this.pcState === 'ssh' : this.board === 'shell';
  }
  private isAxiAttr(p: string) {
    return p.startsWith('/sys/bus/platform/devices/41200000.leds/');
  }

  // BusyBox devmem ADDRESS [WIDTH [VALUE]]
  private devmem(con: Con, a: string[]) {
    if (!a.length) return { out: '', err: 'BusyBox v1.30.1 multi-call binary.\n\nUsage: devmem ADDRESS [WIDTH [VALUE]]\n\nRead/write from physical address\n\n\tADDRESS\tAddress to act upon\n\tWIDTH\tWidth (8/16/...)\n\tVALUE\tData to be written', ok: false };
    const addr = Number(a[0]);
    const width = a[1] ? Number(a[1]) : 32;
    if (Number.isNaN(addr)) return { out: '', err: `devmem: invalid number '${a[0]}'`, ok: false };
    if (![8, 16, 32].includes(width)) return { out: '', err: 'devmem: bad width', ok: false };
    const aligned = addr & ~3;
    if (a[2] !== undefined) {
      const v = Number(a[2]);
      if (Number.isNaN(v)) return { out: '', err: `devmem: invalid number '${a[2]}'`, ok: false };
      if (this.bus(aligned, v) === undefined) {
        this.hang(con);
        return undefined;
      }
      this.flag('devmem-write');
      return { out: '', ok: true };
    }
    const v = this.bus(aligned);
    if (v === undefined) {
      this.hang(con);
      return undefined;
    }
    this.flag('devmem-read');
    const hexw = width / 4;
    return { out: `0x${(v & (width === 32 ? 0xffffffff : (1 << width) - 1)).toString(16).toUpperCase().padStart(hexw, '0')}\n`, ok: true };
  }

  // the lx-gpio program (src/synth/linux.ts has its C source)
  private gpioMem(con: Con, a: string[]) {
    const read = (off: number) => this.bus(AXI_GPIO + off);
    const pressed = (v: number) => ~v & 0x1f;
    const keysLine = (v: number) => `keys pressed: 0x${pressed(v).toString(16).padStart(2, '0')}  [${[0, 1, 2, 3, 4].map((i) => (pressed(v) >> i) & 1 ? `KEY${i + 1}` : '----').join(' ')}]`;
    if (a[0] === 'leds' && a[1] !== undefined) {
      const v = Number(a[1]) & 7;
      if (this.bus(AXI_GPIO, v) === undefined) {
        this.hang(con);
        return undefined;
      }
      this.flag('gpio-mem-leds');
      return { out: `LED1-LED3 <- 0x${v.toString(16)}\n`, ok: true };
    }
    if (a[0] === 'keys') {
      const v = read(8);
      if (v === undefined) {
        this.hang(con);
        return undefined;
      }
      this.flag('gpio-mem-keys');
      return { out: `${keysLine(v)}\n`, ok: true };
    }
    if (a[0] === 'mirror') {
      if (read(8) === undefined) {
        this.hang(con);
        return undefined;
      }
      this.say(con, 'mirroring KEY1-KEY3 onto LED1-LED3, Ctrl+C to stop');
      this.say(con, '(simulator: press KEY1 to KEY3 on the 3D board)', 'note');
      let last = -1;
      this.job[con] = {
        tick: () => {
          const v = read(8);
          if (v === undefined) return;
          const p = pressed(v) & 7;
          this.bus(AXI_GPIO, p);
          if (p !== last) {
            if (last >= 0) this.say(con, keysLine(v));
            last = p;
            if (p) this.flag('gpio-mem-mirror');
          }
        },
        stop: () => {
          this.bus(AXI_GPIO, 0);
        },
      };
      return undefined;
    }
    return { out: '', err: 'usage: gpio_mem leds VALUE | keys | mirror', ok: false };
  }

  private insmod(con: Con, a: string[]) {
    const p = normalize(a[0] ?? '', this.sess[con].cwd);
    const tag = this.tagOf(p);
    if (!a[0]) return { out: '', err: 'Usage: insmod FILE [ARGS]', ok: false };
    if (!this.fs.exists(p)) return { out: '', err: `insmod: ERROR: could not load module ${a[0]}: No such file or directory`, ok: false };
    if (!tag?.startsWith('ko:')) return { out: '', err: `insmod: ERROR: could not insert module ${a[0]}: Invalid module format`, ok: false };
    const name = tag.slice(3);
    if (this.mods.some((m) => m.name === name)) return { out: '', err: `insmod: ERROR: could not insert module ${a[0]}: File exists`, ok: false };
    const say = (m: string) => {
      const l = this.klog(m);
      this.sayBoth(l);
    };
    if (name === 'fpgalab_leds') {
      const mod: Module = { name, size: 16384 };
      this.mods.push(mod);
      this.flag('insmod-leds');
      if (this.dtNode) {
        if (!this.plAlive() || this.design !== 'axigpio') {
          // probe reads the version-free AXI GPIO: with no slave the read never returns
          this.hang(con);
          return undefined;
        }
        mod.bound = true;
        const base = '/sys/bus/platform/devices/41200000.leds';
        this.fs.put(`${base}/leds`, {
          read: () => (this.plAlive() && this.design === 'axigpio' ? `0x${this.extLed.toString(16)}\n` : ''),
          write: (s) => {
            const v = Number(s.trim());
            if (Number.isNaN(v) || v < 0 || v > 7) return 'Invalid argument';
            if (!this.plAlive() || this.design !== 'axigpio') {
              this.hang(con);
              return undefined;
            }
            this.extLed = v;
            this.flag('driver-leds');
            return undefined;
          },
        });
        this.fs.put(`${base}/keys`, { read: () => `0x${(~this.keyBits() & 0x1f).toString(16).padStart(2, '0')}\n`, write: () => 'Permission denied' });
        this.fs.mkdir(`${base}/driver`);
        this.fs.mkdir('/sys/bus/platform/drivers/fpgalab_leds/41200000.leds');
        say('fpgalab_leds 41200000.leds: LED1-LED3 and KEY1-KEY5 at 0x41200000');
        this.flag('driver-bound');
      } else this.flag('driver-unbound');
      return { out: '', ok: true };
    }
    // fpgalab_load firmware=NAME
    const fw = (a.find((x) => x.startsWith('firmware=')) ?? 'firmware=fpgalab.bin').slice(9);
    const path = `/lib/firmware/${fw}`;
    const ftag = this.tagOf(path);
    if (!ftag) {
      say(`fpga_manager fpga0: Direct firmware load for ${fw} failed with error -2`);
      say(`fpga_manager fpga0: Error requesting firmware ${fw}`);
      return { out: '', err: `insmod: ERROR: could not insert module ${a[0]}: No such file or directory`, ok: false };
    }
    if (!ftag.startsWith('bin:')) {
      say('fpga_manager fpga0: Error preparing FPGA for writing');
      this.fpgaState = 'write init error';
      return { out: '', err: `insmod: ERROR: could not insert module ${a[0]}: Invalid argument`, ok: false };
    }
    say(`fpga_manager fpga0: writing ${fw} to Xilinx Zynq FPGA Manager`);
    this.design = ftag.slice(4) as Design;
    this.fpgaState = 'operating';
    this.lightAt = this.now;
    this.mods.push({ name: 'fpgalab_load', size: 16384 });
    say(`fpgalab_load: ${fw}: 0`);
    this.flag(`fpga-load:${this.design}`);
    return { out: '', ok: true };
  }
}

// ---------------------------------------------------------------- parsing
// words, with '...' and "..." quoting
export function splitArgs(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q: string | null = null;
  let any = false;
  for (const c of s) {
    if (q) {
      if (c === q) q = null;
      else cur += c;
    } else if (c === '"' || c === "'") {
      q = c;
      any = true;
    } else if (/\s/.test(c)) {
      if (cur || any) out.push(cur);
      cur = '';
      any = false;
    } else cur += c;
  }
  if (cur || any) out.push(cur);
  return out;
}
// commands separated by ; and && (outside quotes)
function splitTop(s: string): { cmd: string; op: ';' | '&&' }[] {
  const out: { cmd: string; op: ';' | '&&' }[] = [];
  let cur = '';
  let q: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === q) q = null;
      cur += c;
    } else if (c === '"' || c === "'") {
      q = c;
      cur += c;
    } else if (c === ';') {
      out.push({ cmd: cur, op: ';' });
      cur = '';
    } else if (c === '&' && s[i + 1] === '&') {
      out.push({ cmd: cur, op: '&&' });
      cur = '';
      i++;
    } else cur += c;
  }
  out.push({ cmd: cur, op: ';' });
  return out.filter((x) => x.cmd.trim());
}
function splitPipe(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q: string | null = null;
  for (const c of s) {
    if (q) {
      if (c === q) q = null;
      cur += c;
    } else if (c === '"' || c === "'") {
      q = c;
      cur += c;
    } else if (c === '|') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const UBOOT_HELP = `?         - alias for 'help'
bdinfo    - print Board Info structure
boot      - boot default, i.e., run 'bootcmd'
bootz     - boot Linux zImage image from memory
coninfo   - print console devices and information
echo      - echo args to console
ext4load  - load binary file from a Ext4 filesystem
ext4ls    - list files in a directory (default /)
fatload   - load binary file from a dos filesystem
fatls     - list files in a directory (default /)
fpga      - loadable FPGA image support
help      - print command description/usage
mmc       - MMC sub system
printenv  - print environment variables
reset     - Perform RESET of the CPU
run       - run commands in an environment variable
setenv    - set environment variables
version   - print monitor, compiler and linker version
(simulator: the real U-Boot has many more commands)`;

const SHELL_HELP = `Commands in this simulator (BusyBox and friends):
  ls cd pwd cat echo cp mv rm mkdir touch grep head tail
  uname dmesg ip ifconfig ping hostname uptime free df mount ps
  devmem ADDRESS [WIDTH [VALUE]]   insmod rmmod lsmod modinfo
  reboot poweroff exit clear
Redirect with > and >>, chain with ; and &&, pipe into grep/head/tail.`;

// what `cat gpio_mem.c` shows in the simulator (the whole file is in the Vivado project of lx-gpio)
const GPIO_MEM_HEAD = `/* gpio_mem.c: LED1-LED3 and KEY1-KEY5 of the AXI GPIO at 0x41200000, through /dev/mem.
 * (simulator: this is the start of the file; the whole program is in the lesson's Vivado project, linux/gpio_mem.c) */
#define AXI_GPIO_BASE 0x41200000
#define GPIO_DATA     0x0   /* channel 1: LED1-LED3 (outputs) */
#define GPIO2_DATA    0x8   /* channel 2: KEY1-KEY5 (inputs, active low) */

int fd = open("/dev/mem", O_RDWR | O_SYNC);
volatile uint32_t *gpio = mmap(NULL, 0x10000, PROT_READ | PROT_WRITE, MAP_SHARED, fd, AXI_GPIO_BASE);
gpio[GPIO_DATA / 4] = 5;                 /* LED1 and LED3 on */
uint32_t keys = gpio[GPIO2_DATA / 4];    /* bit i = 0 while KEYi+1 is pressed */
`;
