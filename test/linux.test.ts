// The simulated Linux on the EBAZ4205 (src/linux/sim.ts): the flows the chapter "Linux on Zynq" teaches.
import { describe, expect, it } from 'vitest';
import { ZynqSim, type Con, type SimConfig } from '../src/linux/sim';

function make(cfg: Partial<SimConfig> = {}, keys: Record<string, boolean> = {}) {
  const sim = new ZynqSim({ start: 'off', design: 'stock', script: 'stock', dtb: 'stock', ...cfg }, { pressed: (n) => !!keys[n] });
  const run = (ms: number) => {
    for (let t = 0; t < ms; t += 20) sim.tick(20);
  };
  const text = (con: Con = 'serial') => sim.out[con].map((o) => o.text).join('\n');
  const type = (line: string, con: Con = 'serial') => {
    sim.out[con] = [];
    sim.enter(con, line);
    run(100);
    return text(con);
  };
  return { sim, run, text, type, keys };
}

describe('simulated Linux: boot', () => {
  it('boots by itself from boot.scr to the login prompt', () => {
    const { sim, run, text } = make();
    sim.power(true);
    run(12000);
    expect(text()).toContain('Hit any key to stop autoboot');
    expect(text()).toContain('Found U-Boot script /boot.scr');
    expect(text()).toContain('Starting kernel ...');
    expect(text()).toContain('Welcome to Buildroot');
    expect(sim.prompt('serial')).toBe('buildroot login: ');
  });

  it('stops at the U-Boot prompt and boots by hand', () => {
    const { sim, run, type, text } = make();
    sim.power(true);
    run(800);
    sim.key();
    expect(sim.prompt('serial')).toBe('Zynq> ');
    expect(type('fatls mmc 0:1')).toContain('u-boot.bin');
    expect(type('ext4ls mmc 0:2 /boot')).toContain('zImage');
    expect(type('bootz 0x2000000 - 0x1f00000')).toContain('Bad Linux ARM zImage magic!');
    expect(type('ext4load mmc 0:2 0x2000000 /boot/zImage')).toMatch(/bytes read/);
    expect(type('ext4load mmc 0:2 0x1f00000 /boot/zynq-ebaz4205.dtb')).toMatch(/bytes read/);
    type('setenv bootargs "root=/dev/mmcblk0p2 rootwait"');
    type('bootz 0x2000000 - 0x1f00000');
    run(8000);
    expect(text()).toContain('Kernel command line: root=/dev/mmcblk0p2 rootwait');
    expect(sim.prompt('serial')).toBe('buildroot login: ');
    type('root');
    expect(sim.secret('serial')).toBe(true);
    type('root');
    expect(sim.prompt('serial')).toBe('[root@buildroot ~]# ');
    expect(type('uname -r')).toContain('5.1.5');
    for (const f of ['stop-autoboot', 'fatls', 'ext4ls', 'bootz', 'login', 'uname']) expect(sim.flags.has(f), f).toBe(true);
  });

  it('panics without root= in bootargs', () => {
    const { sim, run, type, text } = make();
    sim.power(true);
    run(800);
    sim.key();
    type('ext4load mmc 0:2 0x2000000 /boot/zImage');
    type('ext4load mmc 0:2 0x1f00000 /boot/zynq-ebaz4205.dtb');
    type('bootz 0x2000000 - 0x1f00000');
    run(2000);
    expect(text()).toContain('Kernel panic');
    expect(sim.ready('serial')).toBe(false);
  });
});

describe('simulated Linux: serial and SSH', () => {
  it('logs in from the PC with ssh and scp', () => {
    const { sim, type } = make({ start: 'login', pc: ['fpgalab_leds.ko'] });
    expect(type('ping 192.168.100.1', 'pc')).toContain('PING');
    sim.interrupt('pc');
    type('ssh root@192.168.100.1', 'pc');
    expect(sim.prompt('pc')).toContain('yes/no');
    type('yes', 'pc');
    expect(sim.secret('pc')).toBe(true);
    type('root', 'pc');
    expect(sim.prompt('pc')).toBe('[root@buildroot ~]# ');
    expect(type('ip addr', 'pc')).toContain('192.168.100.1/24');
    expect(type('cat /etc/network/interfaces', 'pc')).toContain('address 192.168.100.1');
    type('exit', 'pc');
    type('scp fpgalab_leds.ko root@192.168.100.1:/root/', 'pc');
    type('root', 'pc');
    expect(sim.flags.has('scp:fpgalab_leds.ko')).toBe(true);
    type('ssh root@192.168.100.1', 'pc');
    type('root', 'pc');
    expect(type('ls', 'pc')).toContain('fpgalab_leds.ko');
  });

  it('drives the heartbeat LED and turns it off through sysfs', () => {
    const { sim, run, type } = make({ start: 'shell' });
    const seen = new Set<number>();
    for (let i = 0; i < 60; i++) {
      run(20);
      seen.add(sim.leds()[0]);
    }
    expect([...seen].sort()).toEqual([0, 1]);
    expect(type('cat /sys/class/leds/led_r/trigger')).toContain('[heartbeat]');
    type('echo none > /sys/class/leds/led_r/trigger');
    type('echo 1 > /sys/class/leds/led_g/brightness');
    run(1500);
    expect(sim.leds().slice(0, 2)).toEqual([0, 1]);
    type('echo timer > /sys/class/leds/led_g/trigger');
    expect(type('ls /sys/class/leds/led_g')).toContain('delay_on');
  });
});

describe('simulated Linux: AXI GPIO', () => {
  it('writes LED1-LED3 and reads the keys with devmem', () => {
    const keys: Record<string, boolean> = {};
    const { sim, type } = make({ start: 'shell', design: 'axigpio', script: 'fpgalab', root: ['gpio_mem'] }, keys);
    type('devmem 0x41200000 32 5');
    expect(sim.leds().slice(2)).toEqual([1, 0, 1]);
    expect(type('devmem 0x41200000')).toContain('0x00000005');
    expect(type('devmem 0x41200008')).toContain('0x0000001F');
    keys.KEY2 = true;
    expect(type('devmem 0x41200008')).toContain('0x0000001D');
    expect(type('./gpio_mem keys')).toContain('KEY2');
    type('./gpio_mem mirror');
    expect(sim.leds().slice(2)).toEqual([0, 1, 0]);
    sim.interrupt('serial');
    expect(type('./gpio_mem leds 3')).toContain('0x3');
  });

  it('hangs on a PL address with no design behind it', () => {
    const { sim, type } = make({ start: 'shell', design: 'stock' });
    type('devmem 0x41200000');
    expect(sim.ready('serial')).toBe(false);
    expect(sim.flags.has('hang')).toBe(true);
  });

  it('hangs when Linux has stopped FCLK_CLK0 (no clk_ignore_unused)', () => {
    const { sim, type } = make({ start: 'shell', design: 'axigpio', script: 'stock' });
    type('devmem 0x41200000');
    expect(sim.flags.has('hang')).toBe(true);
  });
});

describe('simulated Linux: driver and FPGA manager', () => {
  it('binds the driver only with the device-tree node', () => {
    const a = make({ start: 'shell', design: 'axigpio', script: 'fpgalab', root: ['fpgalab_leds.ko'] });
    a.type('insmod fpgalab_leds.ko');
    expect(a.sim.flags.has('driver-unbound')).toBe(true);
    expect(a.type('ls /sys/bus/platform/devices')).not.toContain('41200000.leds');
    const b = make({ start: 'shell', design: 'axigpio', script: 'fpgalab', dtb: 'fpgalab', root: ['fpgalab_leds.ko'] });
    expect(b.type('insmod fpgalab_leds.ko')).toContain('41200000.leds');
    b.type('echo 6 > /sys/bus/platform/devices/41200000.leds/leds');
    expect(b.sim.leds().slice(2)).toEqual([0, 1, 1]);
    expect(b.type('lsmod')).toContain('fpgalab_leds');
  });

  it('a new dtb takes effect after a reboot', () => {
    const { run, type } = make({ start: 'shell', design: 'axigpio', script: 'fpgalab', root: ['zynq-ebaz4205.dtb', 'fpgalab_leds.ko'] });
    type('cp zynq-ebaz4205.dtb /boot/');
    type('reboot');
    run(15000);
    type('root');
    type('root');
    expect(type('insmod fpgalab_leds.ko')).toContain('41200000.leds');
  });

  it('loads a bitstream from /lib/firmware and runs it', () => {
    const { sim, run, type } = make({ start: 'shell', design: 'axigpio', script: 'fpgalab', root: ['fpgalab_load.ko', 'running_light.bin'] });
    expect(type('echo running_light.bin > /sys/class/fpga_manager/fpga0/firmware')).toContain('Permission denied');
    expect(type('insmod fpgalab_load.ko firmware=running_light.bin')).toContain('could not insert');
    type('mkdir -p /lib/firmware');
    type('cp running_light.bin /lib/firmware/');
    type('rmmod fpgalab_load');
    expect(type('insmod fpgalab_load.ko firmware=running_light.bin')).toContain('writing running_light.bin');
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      run(260);
      seen.add(sim.leds().slice(2).join(''));
    }
    expect(seen.size).toBe(3);
    // the AXI GPIO is gone with the old design
    type('devmem 0x41200000');
    expect(sim.flags.has('hang')).toBe(true);
  });
});
