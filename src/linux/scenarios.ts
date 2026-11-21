// What the simulated terminal (src/linux/term.ts) starts with in each lesson of the chapter "Linux on Zynq", and the
// tasks it ticks off as the learner does them. A task is done when the simulator raises its flag (src/linux/sim.ts).
import type { Con, SimConfig } from './sim';

export interface Task {
  flag: string;
  fa: string;
  en: string;
  optional?: boolean;
}
export interface Scenario {
  cfg: SimConfig;
  con: Con; // the console shown first
  tasks: Task[];
}

const c = (s: string) => `<code dir="ltr">${s}</code>`;

export const SCENARIOS: Record<string, Scenario> = {
  'lx-boot': {
    cfg: { start: 'off', design: 'stock', script: 'stock', dtb: 'stock' },
    con: 'serial',
    tasks: [
      { flag: 'power', fa: `برد را روشن کنید (دکمه‌ی ${c('⏻')}).`, en: `Power the board on (the ${c('⏻')} button).` },
      { flag: 'stop-autoboot', fa: 'در شمارش معکوس یک کلید بزنید تا در خط فرمان U-Boot بمانید.', en: 'Press a key during the countdown to stay at the U-Boot prompt.' },
      { flag: 'fatls', fa: `فایل‌های پارتیشن FAT را ببینید: ${c('fatls mmc 0:1')}`, en: `List the FAT partition: ${c('fatls mmc 0:1')}` },
      { flag: 'ext4ls', fa: `پوشه‌ی boot در پارتیشن ext4: ${c('ext4ls mmc 0:2 /boot')}`, en: `List /boot on the ext4 partition: ${c('ext4ls mmc 0:2 /boot')}` },
      { flag: 'bootz', fa: `کرنل و dtb را بار کنید، bootargs را بگذارید و با ${c('bootz')} اجرا کنید.`, en: `Load the kernel and the dtb, set bootargs and start it with ${c('bootz')}.` },
      { flag: 'login', fa: `با کاربر ${c('root')} و رمز ${c('root')} وارد شوید.`, en: `Log in as ${c('root')} with the password ${c('root')}.` },
      { flag: 'uname', fa: `نسخه‌ی کرنل: ${c('uname -a')}`, en: `Check the kernel: ${c('uname -a')}` },
    ],
  },
  'lx-console': {
    cfg: { start: 'login', design: 'stock', script: 'stock', dtb: 'stock' },
    con: 'serial',
    tasks: [
      { flag: 'login', fa: 'روی کنسول سریال وارد شوید.', en: 'Log in on the serial console.' },
      { flag: 'ip', fa: `آدرس برد را ببینید: ${c('ip addr')}`, en: `See the board's address: ${c('ip addr')}` },
      { flag: 'pc-ip', fa: `در زبانه‌ی PC آدرسی را که PC گرفته ببینید: ${c('ip addr')}`, en: `On the PC tab, see the address the PC got: ${c('ip addr')}` },
      { flag: 'ssh', fa: `از PC وصل شوید: ${c('ssh root@192.168.100.1')}`, en: `Connect from the PC: ${c('ssh root@192.168.100.1')}` },
      { flag: 'led:led_g', fa: `LED سبز را روشن کنید: ${c('echo 1 > /sys/class/leds/led_g/brightness')}`, en: `Turn the green LED on: ${c('echo 1 > /sys/class/leds/led_g/brightness')}` },
      { flag: 'trigger:timer', fa: `LED قرمز را با trigger از نوع ${c('timer')} چشمک‌زن کنید.`, en: `Make the red LED blink with the ${c('timer')} trigger.` },
    ],
  },
  'lx-gpio': {
    cfg: { start: 'shell', design: 'axigpio', script: 'fpgalab', dtb: 'stock', root: ['gpio_mem', 'gpio_mem.c'] },
    con: 'serial',
    tasks: [
      { flag: 'cmdline', fa: `مطمئن شوید ${c('clk_ignore_unused')} در خط فرمان کرنل هست: ${c('cat /proc/cmdline')}`, en: `Check that ${c('clk_ignore_unused')} is on the kernel command line: ${c('cat /proc/cmdline')}` },
      { flag: 'axi-write', fa: `LED1 و LED3 را روشن کنید: ${c('devmem 0x41200000 32 5')}`, en: `Light LED1 and LED3: ${c('devmem 0x41200000 32 5')}` },
      { flag: 'axi-keys', fa: `یک کلید را روی برد سه‌بعدی نگه دارید و بخوانید: ${c('devmem 0x41200008')}`, en: `Hold a key on the 3D board and read: ${c('devmem 0x41200008')}` },
      { flag: 'gpio-mem-mirror', fa: `${c('./gpio_mem mirror')} را اجرا کنید و KEY1 تا KEY3 را فشار دهید.`, en: `Run ${c('./gpio_mem mirror')} and press KEY1 to KEY3.` },
      { flag: 'hang', optional: true, fa: `اختیاری: آدرسی بدون IP را بخوانید (${c('devmem 0x43C00000')}) و ببینید چه می‌شود.`, en: `Optional: read an address with no IP behind it (${c('devmem 0x43C00000')}) and see what happens.` },
    ],
  },
  'lx-driver': {
    cfg: { start: 'shell', design: 'axigpio', script: 'fpgalab', dtb: 'stock', root: ['fpgalab_leds.ko'], pc: ['zynq-ebaz4205.dtb', 'fpgalab_leds.ko'] },
    con: 'serial',
    tasks: [
      { flag: 'driver-unbound', fa: `${c('insmod fpgalab_leds.ko')}: ماژول بار می‌شود ولی هنوز دستگاهی به آن وصل نمی‌شود.`, en: `${c('insmod fpgalab_leds.ko')}: the module loads, but no device binds to it yet.` },
      { flag: 'rmmod:fpgalab_leds', fa: `ماژول را بردارید: ${c('rmmod fpgalab_leds')}`, en: `Remove it: ${c('rmmod fpgalab_leds')}` },
      { flag: 'scp:zynq-ebaz4205.dtb', fa: `از PC، dtb جدید را بفرستید: ${c('scp zynq-ebaz4205.dtb root@192.168.100.1:/boot/')}`, en: `From the PC, send the new dtb: ${c('scp zynq-ebaz4205.dtb root@192.168.100.1:/boot/')}` },
      { flag: 'reboot', fa: `برد را دوباره راه بیندازید: ${c('reboot')}`, en: `Restart the board: ${c('reboot')}` },
      { flag: 'driver-bound', fa: 'دوباره وارد شوید و ماژول را بار کنید؛ این بار در dmesg پیام probe را می‌بینید.', en: 'Log in again and load the module; this time dmesg shows the probe message.' },
      { flag: 'driver-leds', fa: `${c('echo 5 > /sys/bus/platform/devices/41200000.leds/leds')}`, en: `${c('echo 5 > /sys/bus/platform/devices/41200000.leds/leds')}` },
    ],
  },
  'lx-fpgamgr': {
    cfg: { start: 'shell', design: 'axigpio', script: 'fpgalab', dtb: 'fpgalab', root: ['fpgalab_load.ko', 'running_light.bin', 'axi_gpio.bin'] },
    con: 'serial',
    tasks: [
      { flag: 'fpga-sysfs', fa: `وضعیت FPGA manager: ${c('cat /sys/class/fpga_manager/fpga0/state')}`, en: `The FPGA manager's state: ${c('cat /sys/class/fpga_manager/fpga0/state')}` },
      { flag: 'cp-firmware', fa: `${c('running_light.bin')} را در ${c('/lib/firmware')} کپی کنید (اول ${c('mkdir -p')}).`, en: `Copy ${c('running_light.bin')} into ${c('/lib/firmware')} (${c('mkdir -p')} it first).` },
      { flag: 'fpga-load:light', fa: `${c('insmod fpgalab_load.ko firmware=running_light.bin')}: LED1 تا LED3 روی برد سه‌بعدی می‌دوند.`, en: `${c('insmod fpgalab_load.ko firmware=running_light.bin')}: LED1 to LED3 start running on the 3D board.` },
      { flag: 'fpga-load:axigpio', fa: `برگردید: ${c('rmmod fpgalab_load')}، کپی ${c('axi_gpio.bin')} و بار کردن دوباره با ${c('firmware=axi_gpio.bin')}.`, en: `Go back: ${c('rmmod fpgalab_load')}, copy ${c('axi_gpio.bin')} and load again with ${c('firmware=axi_gpio.bin')}.` },
    ],
  },
};
