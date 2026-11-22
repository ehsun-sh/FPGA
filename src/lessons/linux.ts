// Chapter L: "Linux on Zynq", shown on the EBAZ4205. Five guided real-board lessons (no checker: done when the quiz is
// passed), each with the simulated terminal of src/linux/term.ts in its "Try it" section, so the commands can be
// practised before the real board. The software is the Buildroot image of blkf2016/ebaz4205 (U-Boot 2019.07-rc4,
// Linux 5.1.5, Buildroot 2019.05); the Vivado projects come from src/synth/linux.ts. Everything for the chapter
// (Persian lessons, English text, goals, quiz, levels, prerequisites) lives here and is merged in by course.ts.
import { Z_BLINK_V, Z_BLINK_VHD } from '../boards/ebaz4205/code';
import { X_LEDS_V, X_LEDS_VHD } from '../boards/ebaz4205/extcode';
import { termSlot } from '../linux/term';
import type { LessonText } from './en';
import { figAxiMap, figLinuxBoot, figure } from './figures';
import type { Level } from './goals';
import { part, ref, term, truth } from './helpers';
import type { Lesson } from './lessons';
import type { Question } from './predict';
import { sourcesBox } from './zynq';

type Goals = { objectives: string[]; takeaways: string[] };
const q = (text: string, options: string[], answer: number, why: string): Question => ({ q: text, options, answer, why });
const pre = (s: string) => `<pre dir="ltr"><code>${s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
const vv = (lang: 'fa' | 'en', extra: string) =>
  `<p><button class="btn primary small" data-jump="sec-vivado">${lang === 'fa' ? 'ساخت یا دانلود پروژه‌ی Vivado ↓' : 'Build or download the Vivado project ↓'}</button> <span class="dim">${extra}</span></p>`;

// the lessons keep the PS-clocked blinker in the editor (Run still shows the PL doing something); lx-fpgamgr has the
// second design itself, the running light on LED1-LED3
const BLINK = { verilog: Z_BLINK_V, vhdl: Z_BLINK_VHD, xdc: { led: true } };
const LIGHT = { verilog: X_LEDS_V, vhdl: X_LEDS_VHD, xdc: { ext_led: true } };

const BOOT_SCR = `ext4load mmc 0:2 0x2000000 /boot/zImage
ext4load mmc 0:2 0x1f00000 /boot/zynq-ebaz4205.dtb
setenv bootargs "root=/dev/mmcblk0p2 rootwait"
bootz 0x2000000 - 0x1f00000`;
const BUILDROOT = `git clone https://github.com/blkf2016/ebaz4205.git
wget https://buildroot.org/downloads/buildroot-2019.05.tar.gz
tar xf buildroot-2019.05.tar.gz && cd buildroot-2019.05
cp -r ../ebaz4205/buildroot/board/ebaz4205 board/
cp ../ebaz4205/buildroot/configs/zynq-ebaz4205_defconfig configs/
make zynq-ebaz4205_defconfig
make                       # an hour or more; the result: output/images/sdcard.img`;
const DD = `sudo dd if=sdcard.img of=/dev/sdX bs=4M conv=fsync status=progress`;
const LEDS = `cat /sys/class/leds/led_r/trigger           # [heartbeat] is the current one
echo none > /sys/class/leds/led_r/trigger
echo 1 > /sys/class/leds/led_g/brightness    # LED_G on
echo timer > /sys/class/leds/led_r/trigger   # blink: delay_on / delay_off in ms
echo 100 > /sys/class/leds/led_r/delay_on`;
const DEVMEM = `devmem 0x41200000 32 5      # GPIO_DATA = 101: LED1 and LED3 on
devmem 0x41200000           # read it back: 0x00000005
devmem 0x41200008           # GPIO2_DATA: 0x0000001F, no key pressed
devmem 0x41200008           # KEY2 held: 0x0000001D (bit 1 = 0)`;
const MMAP = `int fd = open("/dev/mem", O_RDWR | O_SYNC);
volatile uint32_t *gpio = mmap(NULL, 0x10000, PROT_READ | PROT_WRITE,
                               MAP_SHARED, fd, 0x41200000);
gpio[0] = 5;                    /* GPIO_DATA:  LED1 and LED3 on */
uint32_t keys = ~gpio[2] & 0x1f; /* GPIO2_DATA: 1 = pressed */`;
const DTSI = `/ {
	fpgalab_leds: leds@41200000 {
		compatible = "fpgalab,axi-leds";
		reg = <0x41200000 0x10000>;
	};
};`;
const PROBE = `static int fpgalab_probe(struct platform_device *pdev)
{
	struct resource *res = platform_get_resource(pdev, IORESOURCE_MEM, 0);
	p->base = devm_ioremap_resource(&pdev->dev, res);   /* reg from the device tree */
	...
	return devm_device_add_group(&pdev->dev, &fpgalab_group);   /* leds, keys */
}
static const struct of_device_id fpgalab_of_match[] = {
	{ .compatible = "fpgalab,axi-leds" }, { }
};`;
const DRIVER_STEPS = `make modules dtb                     # on the PC, in the project's linux/ folder
scp fpgalab_leds.ko root@192.168.100.1:/root/
scp zynq-ebaz4205.dtb root@192.168.100.1:/boot/
ssh root@192.168.100.1 reboot
# after the reboot, on the board:
insmod fpgalab_leds.ko
dmesg | tail -1                      # fpgalab_leds 41200000.leds: LED1-LED3 and KEY1-KEY5 at 0x41200000
echo 5 > /sys/bus/platform/devices/41200000.leds/leds
cat /sys/bus/platform/devices/41200000.leds/keys`;
const XLNX = `echo 0 > /sys/class/fpga_manager/fpga0/flags        # 0 = full reconfiguration
echo running_light.bin > /sys/class/fpga_manager/fpga0/firmware`;
const LOAD = `mkdir -p /lib/firmware
cp running_light.bin /lib/firmware/
rmmod fpgalab_leds                    # its AXI GPIO is about to disappear
insmod fpgalab_load.ko firmware=running_light.bin
dmesg | tail -2
rmmod fpgalab_load                    # ready for the next load`;
const LOADC = `info = fpga_image_info_alloc(&mgr->dev);
info->flags = 0;                                   /* full reconfiguration */
info->firmware_name = devm_kstrdup(&mgr->dev, firmware, GFP_KERNEL);
fpga_mgr_lock(mgr);
ret = fpga_mgr_load(mgr, info);                    /* request_firmware: /lib/firmware */
fpga_mgr_unlock(mgr);`;

// ---------------------------------------------------------------- Persian lessons
export const LINUX_LESSONS: Lesson[] = [
  {
    id: 'lx-boot',
    title: 'بوت لینوکس روی EBAZ4205 با U-Boot و کارت SD',
    summary: 'از BootROM تا خط فرمان لینوکس: کارت SD را بنویسید، U-Boot را بشناسید و کرنل را با دست اجرا کنید.',
    body: `
<p>در ${ref('z-bootflow')} دیدید که BootROM فایل FSBL را اجرا می‌کند و FSBL برنامه‌ی بعدی را. برای لینوکس آن برنامه ${term('uboot', 'U-Boot')} است: یک بوت‌لودر با خط فرمان که کرنل لینوکس و ${term('devicetree', 'device tree')} را از کارت SD می‌خواند و اجرا می‌کند. کرنل هم در آخر ${term('rootfs', 'فایل‌سیستم ریشه')} را از همان کارت سوار می‌کند.</p>
${figure(figLinuxBoot({ title: 'زنجیره‌ی بوت لینوکس روی Zynq و جای هر بخش روی کارت SD', p1: 'پارتیشن ۱ · FAT', p2: 'پارتیشن ۲ · ext4 (root=/dev/mmcblk0p2)' }), 'هر مرحله مرحله‌ی بعد را بار می‌کند؛ خط‌چین‌ها نشان می‌دهند هر کدام از کدام پارتیشن می‌آید.')}
<h3>۱. چه لازم دارید</h3>
<ul>
  <li>بردی که در ${ref('z-intro')} آماده کردید: اسلات microSD در ${part('U7')}، مقاومت بوت روی ${part('R2577')} و مبدل USB به سریال روی ${part('J7')}.</li>
  <li>یک کارت microSD (یک گیگابایت کافی است) و ایمیج آماده‌ی پروژه‌ی blkf2016/ebaz4205: فایل <code>buildroot-sdcard.img.7z</code>. نسخه‌ها: U-Boot 2019.07، کرنل 5.1.5 و Buildroot 2019.05.</li>
  <li>یک برنامه‌ی ترمینال سریال روی 115200 8N1، مثل PuTTY در ویندوز یا <code>picocom</code> در لینوکس.</li>
</ul>
<h3>۲. نوشتن کارت</h3>
<p>فایل 7z را باز کنید و <code>sdcard.img</code> را با balenaEtcher یا Win32 Disk Imager روی کارت بنویسید. در لینوکس:</p>
${pre(DD)}
<p class="note">⚠️ <code>/dev/sdX</code> را با دقت انتخاب کنید (با <code>lsblk</code>). dd هر دیسکی را که بگویید بدون سؤال پاک می‌کند.</p>
<p>کارت حالا دو پارتیشن دارد:</p>
${truth(
  ['پارتیشن', 'نوع', 'محتوا'],
  [
    ['۱', 'FAT، هشت مگابایت', '<code>boot.bin</code> (FSBL و bitstream)، <code>u-boot.bin</code> و <code>boot.scr</code>'],
    ['۲', 'ext4', 'لینوکس: <code>/boot/zImage</code>، <code>/boot/zynq-ebaz4205.dtb</code>، <code>/bin</code>، <code>/etc</code> و بقیه'],
  ],
)}
<p>BootROM فقط FAT را می‌شناسد، پس <code>boot.bin</code> در پارتیشن ۱ است. FSBL این پروژه تغییر کرده و <code>u-boot.bin</code> را از همان پارتیشن در آدرس <code>0x04000000</code> می‌گذارد (${ref('z-bootflow')}).</p>
<h3>۳. U-Boot و boot.scr</h3>
<p>با روشن شدن برد، U-Boot چند خط چاپ می‌کند و بعد دو ثانیه می‌شمارد: <code>Hit any key to stop autoboot</code>. اگر کلیدی نزنید، فرمان پیش‌فرض <code>bootcmd</code> اجرا می‌شود. این فرمان کارت را می‌گردد، اسکریپت <code>boot.scr</code> را پیدا و اجرا می‌کند. محتوای آن چهار خط است:</p>
${pre(BOOT_SCR)}
<ol>
  <li><code>ext4load</code> فایل کرنل را از پارتیشن ۲ (<code>mmc 0:2</code>) در آدرس <code>0x2000000</code> از DDR می‌گذارد.</li>
  <li>همین کار برای device tree، در آدرس <code>0x1f00000</code>.</li>
  <li><code>bootargs</code> خط فرمان کرنل است: فایل‌سیستم ریشه پارتیشن ۲ است و <code>rootwait</code> می‌گوید کرنل صبر کند تا کارت آماده شود.</li>
  <li><code>bootz</code> کرنل را اجرا می‌کند. خط تیره‌ی وسط یعنی initramfs نداریم.</li>
</ol>
<p><code>boot.scr</code> متن خالص نیست: همان متن است با یک سرآیند ۶۴ بایتی که ابزار <code>mkimage</code> اضافه می‌کند. پس برای تغییرش باید <code>boot.cmd</code> را عوض کنید و دوباره <code>boot.scr</code> بسازید. پروژه‌ی Vivado این درس این کار را خودکار انجام می‌دهد.</p>
<h3>۴. همین کار با دست</h3>
${truth(
  ['فرمان', 'کار'],
  [
    ['<code>printenv</code>', 'متغیرهای U-Boot، از جمله <code>bootcmd</code> و آدرس‌های <code>kernel_addr_r</code> و <code>fdt_addr_r</code>'],
    ['<code>fatls mmc 0:1</code>', 'فایل‌های پارتیشن FAT'],
    ['<code>ext4ls mmc 0:2 /boot</code>', 'پوشه‌ی boot در پارتیشن لینوکس'],
    ['<code>ext4load mmc 0:2 ADDR FILE</code>', 'یک فایل را در DDR بار می‌کند؛ اندازه‌اش در <code>filesize</code> می‌ماند'],
    ['<code>setenv bootargs "…"</code>', 'خط فرمان کرنل را عوض می‌کند (تا خاموش شدن)'],
    ['<code>bootz KERNEL - DTB</code>', 'کرنل را با device tree اجرا می‌کند'],
  ],
)}
<p>اگر <code>root=</code> را جا بیندازید، کرنل بالا می‌آید ولی آخر کار با <code>Kernel panic … Unable to mount root fs</code> می‌ایستد. این خطا را در ترمینال پایین امتحان کنید؛ روی برد واقعی هم همین را می‌بینید.</p>
<h3>۵. device tree در یک بند</h3>
<p>روی ARM کرنل سخت‌افزار را جست‌وجو نمی‌کند؛ فایل <code>zynq-ebaz4205.dtb</code> به او می‌گوید چه چیزی کجاست. در device tree این برد حافظه ۲۵۶ مگابایت است، UART1 با نام <code>serial0</code> می‌آید و در لینوکس <code>ttyPS0</code> می‌شود، MAC شبکه و کارت SD فعال‌اند و دو LED روی GPIO شماره‌ی ۵۴ و ۵۵ (همان EMIO درس ${ref('z-ps-hello')}) تعریف شده‌اند. در ${ref('lx-driver')} یک گره‌ی تازه به آن اضافه می‌کنید.</p>
<h3>۶. ساختن ایمیج با Buildroot (اختیاری، ولی برای درس‌های بعد لازم)</h3>
<p>ایمیج آماده برای شروع کافی است. برای کامپایل برنامه و درایور در درس‌های بعد، کامپایلر و کرنلی را لازم دارید که همین ایمیج با آن‌ها ساخته شده. روی یک کامپیوتر لینوکسی (یا WSL):</p>
${pre(BUILDROOT)}
<p>بعد از ساخت، کامپایلر متقاطع در <code>output/host/bin/arm-buildroot-linux-gnueabihf-gcc</code> و درخت کرنل در <code>output/build/linux-5.1.5</code> است.</p>
<h3>۷. BOOT.bin خودتان</h3>
<p>پروژه‌ی Vivado این درس همان PL را می‌سازد که لینوکس این برد لازم دارد: مسیر شبکه از EMIO (${ref('z-ethernet')}) و دو LED روی EMIO GPIO. فایل <code>boot.bif</code> آن U-Boot را هم داخل BOOT.bin می‌گذارد (با آدرس بار <code>0x04000000</code>)، پس FSBL معمولی Vitis کافی است. <code>boot.scr</code> آن دو چیز به خط فرمان کرنل اضافه می‌کند: <code>console=ttyPS0,115200</code> و <code>clk_ignore_unused</code>؛ دومی را در ${ref('lx-gpio')} لازم دارید.</p>
${vv('fa', 'block design لینوکس، boot.bif با U-Boot و sd/boot.scr')}
<p class="note">💡 قبل از جایگزینی، <code>boot.bin</code> اصلی کارت را با نام دیگری نگه دارید تا همیشه راه برگشت داشته باشید.</p>
${sourcesBox('fa', 'blkf', 'zynq2', 'uboot', 'buildroot')}`,
    ...BLINK,
    tryIt: `${termSlot('lx-boot')}<p>روی برد واقعی همین کارها را از ترمینال سریال ${part('J7')} انجام دهید. بعد از ورود، ${part('LED_R')} با ریتم ضربان قلب (trigger از نوع heartbeat) چشمک می‌زند.</p>`,
  },
  {
    id: 'lx-console',
    title: 'کنسول سریال و SSH: کار با لینوکس برد از کامپیوتر',
    summary: 'از J7 وارد شوید، شبکه‌ی برد را بشناسید، با SSH وصل شوید و LEDها را از sysfs روشن کنید.',
    body: `
<p>لینوکس دو راه برای حرف زدن با شما دارد: کنسول سریال روی ${part('J7')} که از لحظه‌ی بوت کار می‌کند، و SSH از طریق کابل شبکه که بعد از بالا آمدن شبکه در دسترس است. اولی برای دیدن بوت و نجات برد است، دومی برای کار روزمره و کپی فایل.</p>
<h3>۱. کنسول سریال</h3>
<p>UART1 روی MIO 24/25 است. device tree آن را <code>serial0</code> نامیده، پس لینوکس به آن <code>/dev/ttyPS0</code> می‌گوید و کنسول کرنل و پیام <code>buildroot login:</code> همین‌جا می‌آیند.</p>
${truth(
  ['سیستم', 'برنامه'],
  [
    ['ویندوز', 'PuTTY: نوع اتصال Serial، پورت COM مبدل (در Device Manager)، سرعت 115200'],
    ['لینوکس', '<code>picocom -b 115200 /dev/ttyUSB0</code> (خروج: Ctrl+A و بعد Ctrl+X)'],
    ['مک', '<code>screen /dev/tty.usbserial-* 115200</code>'],
  ],
)}
<p>کاربر <code>root</code> و رمز <code>root</code> است. این رمز فقط برای آزمایشگاه مناسب است؛ اگر برد را به شبکه‌ی دیگری وصل می‌کنید، با <code>passwd</code> عوضش کنید.</p>
<h3>۲. شبکه‌ی برد</h3>
<p>فایل <code>/etc/network/interfaces</code> این ایمیج به <code>eth0</code> آدرس ثابت <code>192.168.100.1</code> می‌دهد و برنامه‌ی <code>dnsmasq</code> روی برد به هر دستگاهی که به آن وصل شود آدرسی بین <code>192.168.100.2</code> و <code>192.168.100.10</code> می‌دهد. پس ساده‌ترین کار این است: کابل شبکه را مستقیم از کامپیوتر به برد بزنید. کامپیوتر خودش آدرس می‌گیرد.</p>
<p class="note">⚠️ برد را به مودم یا روتر خانه وصل نکنید: dnsmasq روی برد با DHCP روتر رقابت می‌کند و دستگاه‌های دیگر خانه ممکن است آدرس اشتباه بگیرند. اگر برد را روی شبکه‌ی خانه می‌خواهید، در <code>interfaces</code> خط‌های <code>eth0</code> را به <code>iface eth0 inet dhcp</code> تغییر دهید و dnsmasq را خاموش کنید.</p>
<p>روی برد <code>ip addr</code> آدرس را نشان می‌دهد. MAC شبکه را U-Boot در هر بوت تصادفی می‌سازد، ولی چون آدرس IP ثابت است، این روی اتصال اثری ندارد.</p>
<h3>۳. SSH و کپی فایل</h3>
<p>روی ایمیج OpenSSH نصب است و ورود root با رمز را اجازه می‌دهد. ویندوز ۱۰ و ۱۱ هم <code>ssh</code> و <code>scp</code> را داخل PowerShell دارند:</p>
${pre(`ssh root@192.168.100.1                     # first time: answer yes to the fingerprint question
scp gpio_mem root@192.168.100.1:/root/     # copy a file to the board
scp root@192.168.100.1:/boot/zynq-ebaz4205.dtb .   # and back`)}
<p>از این به بعد هر فایلی که روی کامپیوتر می‌سازید (برنامه، درایور، device tree، bitstream) را با <code>scp</code> روی برد می‌برید.</p>
<h3>۴. اولین سخت‌افزار از لینوکس: LEDها در sysfs</h3>
<p>در لینوکس سخت‌افزار هم فایل است. درایور <code>gpio-leds</code> برای هر LEDی که device tree تعریف کرده یک پوشه در ${term('sysfs', 'sysfs')} می‌سازد: <code>/sys/class/leds/led_r</code> و <code>led_g</code>. هر LED یک «trigger» دارد که خودکار روشن و خاموشش می‌کند؛ ${part('LED_R')} روی <code>heartbeat</code> است.</p>
${pre(LEDS)}
<p>این LEDها را کد شما در PL نمی‌راند: GPIO شماره‌ی ۵۴ و ۵۵ از EMIO مستقیم به ${part('LED_R')} و ${part('LED_G')} می‌روند و طرح PL فقط سیم‌کشی است. در درس بعد سخت‌افزار خودتان را در PL می‌گذارید.</p>
${vv('fa', 'همان طرح پایه‌ی درس قبل؛ اگر کارت SD را از قبل دارید لازم نیست دوباره بسازید')}
${sourcesBox('fa', 'blkf', 'buildroot')}`,
    ...BLINK,
    tryIt: `${termSlot('lx-console')}<p>در ترمینال بالا زبانه‌ی <b>PC</b> همان کامپیوتر شماست که با کابل شبکه به برد وصل است. روی برد واقعی، ${part('LED_G')} با دستور <code>echo 1</code> روشن می‌شود.</p>`,
  },
  {
    id: 'lx-gpio',
    title: 'LEDها و کلیدهای PL از لینوکس: AXI GPIO و /dev/mem',
    summary: 'یک AXI GPIO در PL بگذارید و LED1 تا LED3 و KEY1 تا KEY5 برد توسعه را از خط فرمان لینوکس بخوانید و بنویسید.',
    body: `
<p>تا اینجا لینوکس فقط سخت‌افزار سخت PS را می‌شناخت. حالا یک بلوک در PL می‌سازید که پردازنده بتواند مثل حافظه بخواند و بنویسد: ${term('axi', 'AXI')} GPIO. سه خروجی آن به ${part('LED1')} تا ${part('LED3')} برد توسعه می‌روند و پنج ورودی‌اش از ${part('KEY1')} تا ${part('KEY5')} می‌آیند.</p>
${figure(figAxiMap({ title: 'از لینوکس تا پایه‌ها: /dev/mem یا درایور، گذرگاه M_AXI_GP0، رجیسترهای AXI GPIO در 0x41200000', leds: 'LED1-LED3 (E19 K17 H18)', keys: 'KEY1-KEY5 (فعال‌پایین)' }), 'هر نوشتن در 0x41200000 یک تراکنش AXI روی M_AXI_GP0 است که به رجیستر GPIO_DATA می‌رسد.')}
<h3>۱. سخت‌افزار</h3>
<p>block design پروژه‌ی این درس همان طرح لینوکس ${ref('lx-boot')} است به‌اضافه‌ی سه بلوک:</p>
<ul>
  <li><b>AXI GPIO</b> با دو کانال: کانال ۱ سه بیت خروجی (<code>EXT_LED</code>) و کانال ۲ پنج بیت ورودی (<code>KEY</code>).</li>
  <li><b>SmartConnect</b> بین پورت <code>M_AXI_GP0</code> پردازنده و AXI GPIO. GP0 از نوع AXI3 است و AXI GPIO از نوع AXI4-Lite؛ SmartConnect این دو را به هم تبدیل می‌کند.</li>
  <li><b>Processor System Reset</b> که ریست هم‌گام با ${term('fclk', 'FCLK_CLK0')} می‌سازد. همه‌ی این بلوک‌ها با همین کلاک ۵۰ مگاهرتزی کار می‌کنند.</li>
</ul>
<p>Vivado به AXI GPIO یک آدرس در فضای GP0 (از <code>0x40000000</code>) می‌دهد؛ اسکریپت پروژه آن را <code>0x41200000</code> با اندازه‌ی ۶۴ کیلوبایت می‌گذارد. رجیسترهای آن:</p>
${truth(
  ['آفست', 'نام', 'کار'],
  [
    ['<code>0x0</code>', 'GPIO_DATA', 'کانال ۱: هر بیت یک LED (۱ = روشن)'],
    ['<code>0x4</code>', 'GPIO_TRI', 'جهت کانال ۱ (۰ = خروجی)'],
    ['<code>0x8</code>', 'GPIO2_DATA', 'کانال ۲: کلیدها، فعال‌پایین (فشرده = ۰)'],
    ['<code>0xC</code>', 'GPIO2_TRI', 'جهت کانال ۲ (۱ = ورودی)'],
  ],
)}
<h3>۲. بوت با طرح تازه</h3>
<p>پروژه را بسازید، در Vitis از <code>system.xsa</code> یک FSBL بسازید و با <code>boot.bif</code> فایل BOOT.bin را درست کنید (README پروژه قدم‌به‌قدم می‌گوید). آن را با نام <code>boot.bin</code> و <code>sd/boot.scr</code> را با نام <code>boot.scr</code> در پارتیشن FAT بریزید.</p>
<p class="note">⚠️ <b>clk_ignore_unused مهم است.</b> لینوکس در آخر بوت کلاک‌هایی را که هیچ درایوری نخواسته خاموش می‌کند تا برق کمتری مصرف شود. کرنل نمی‌داند منطق PL شما با FCLK_CLK0 کار می‌کند، پس آن را هم خاموش می‌کند. بعد از آن AXI GPIO هرگز به خواندن جواب نمی‌دهد و پردازنده برای همیشه منتظر می‌ماند. <code>boot.scr</code> این پروژه <code>clk_ignore_unused</code> را به خط فرمان کرنل اضافه می‌کند؛ با <code>cat /proc/cmdline</code> مطمئن شوید هست.</p>
<h3>۳. devmem: یک رجیستر از خط فرمان</h3>
<p><code>devmem</code> از BusyBox یک آدرس فیزیکی را از طریق <code>/dev/mem</code> می‌خواند یا می‌نویسد:</p>
${pre(DEVMEM)}
<p>عدد <code>0x1F</code> یعنی پنج بیت یک: هیچ کلیدی فشرده نیست. با نگه داشتن ${part('KEY2')} بیت ۱ صفر می‌شود و <code>0x1D</code> می‌خوانید.</p>
<h3>۴. همین کار در C</h3>
<p>یک برنامه با <code>mmap</code> همان ۶۴ کیلوبایت را در فضای آدرس خودش می‌گذارد و بعد مثل یک آرایه با آن کار می‌کند. <code>volatile</code> لازم است تا کامپایلر خواندن‌ها را حذف یا جابه‌جا نکند:</p>
${pre(MMAP)}
<p>برنامه‌ی کامل <code>linux/gpio_mem.c</code> در پروژه است و سه حالت دارد: <code>leds 5</code>، <code>keys</code> و <code>mirror</code> (کلیدها LEDها را می‌رانند). با کامپایلر Buildroot روی کامپیوتر بسازید (<code>make gpio_mem</code>)، با <code>scp</code> روی برد ببرید و اجرا کنید.</p>
${vv('fa', 'طرح لینوکس با AXI GPIO، XDC کلیدها و LEDها، و linux/gpio_mem.c')}
<h3>۵. خطر /dev/mem</h3>
<p>اگر آدرسی را بخوانید که هیچ IPی پشتش نیست (مثلاً <code>0x43C00000</code>)، یا PL برنامه‌ریزی نشده باشد، یا کلاکش خاموش باشد، تراکنش AXI هیچ‌وقت تمام نمی‌شود و کل برد قفل می‌شود؛ فقط خاموش و روشن کردن نجاتش می‌دهد. <code>/dev/mem</code> برای آزمایش عالی است ولی هیچ محافظتی ندارد. راه درست یک درایور است: ${ref('lx-driver')}.</p>
${sourcesBox('fa', 'pg144', 'blkf', 'keitetsu')}`,
    ...BLINK,
    tryIt: `${termSlot('lx-gpio')}<p>در شبیه‌ساز، کلیدها را روی برد توسعه‌ی سه‌بعدی فشار دهید (یا با Tab انتخاب و با Space نگه دارید) و LEDهای آن را ببینید. اگر برد توسعه را برداشته‌اید، اول آن را بگذارید.</p>`,
  },
  {
    id: 'lx-driver',
    title: 'درایور ساده‌ی کرنل و device tree برای سخت‌افزار خودمان',
    summary: 'یک گره به device tree اضافه کنید و یک ماژول کرنل بنویسید که AXI GPIO را با دو فایل در sysfs نشان دهد.',
    body: `
<p>برنامه‌ی ${ref('lx-gpio')} آدرس <code>0x41200000</code> را در کد خودش داشت، باید با root اجرا می‌شد و هیچ‌کس جلوی دو برنامه‌ی هم‌زمان را نمی‌گرفت. در لینوکس این کار درایور است: کدی در کرنل که سخت‌افزار را می‌شناسد و یک رابط ساده (اینجا دو فایل) به بقیه‌ی سیستم می‌دهد.</p>
<h3>۱. کرنل از کجا می‌فهمد سخت‌افزار کجاست؟</h3>
<p>از ${term('devicetree', 'device tree')}. هر گره یک دستگاه را توصیف می‌کند. مهم‌ترین ویژگی‌ها <code>compatible</code> (این دستگاه چیست) و <code>reg</code> (کجاست) هستند. این گره را اضافه می‌کنید:</p>
${pre(DTSI)}
<p>وقتی کرنل این dtb را می‌خواند، یک «platform device» به نام <code>41200000.leds</code> می‌سازد. هر درایوری که بگوید <code>fpgalab,axi-leds</code> را می‌شناسد، به آن وصل (bind) می‌شود. آدرس در device tree است، نه در کد درایور؛ اگر در Vivado آدرس را عوض کنید، فقط dtb عوض می‌شود.</p>
<p>فایل <code>linux/fpgalab-leds.dtsi</code> پروژه یک خط دیگر هم دارد: <code>fclk-enable = &lt;0x1&gt;</code> روی گره‌ی کلاک. این راه دقیق‌تری از <code>clk_ignore_unused</code> است و فقط FCLK_CLK0 را روشن نگه می‌دارد.</p>
<h3>۲. ماژول کرنل</h3>
<p>درایور یک ${term('kmod', 'ماژول کرنل')} است (<code>fpgalab_leds.ko</code>) که با <code>insmod</code> بار می‌شود. سه بخش اصلی دارد:</p>
${pre(PROBE)}
<ul>
  <li><b>جدول تطبیق</b> (<code>of_device_id</code>): رشته‌ای که باید با <code>compatible</code> یکی باشد.</li>
  <li><b>probe</b>: وقتی کرنل دستگاه و درایور را جفت کرد صدا زده می‌شود. <code>reg</code> را می‌گیرد و با <code>devm_ioremap_resource</code> آدرس فیزیکی را به آدرسی در کرنل نگاشت می‌کند؛ بعد با <code>ioread32</code> و <code>iowrite32</code> رجیسترها را می‌خواند و می‌نویسد.</li>
  <li><b>دو فایل در sysfs</b>: <code>leds</code> (خواندن و نوشتن، عدد ۰ تا ۷) و <code>keys</code> (فقط خواندن، ۱ = فشرده). کرنل متن را به تابع‌های <code>leds_store</code> و <code>keys_show</code> می‌دهد. پیشوند <code>devm_</code> یعنی با جدا شدن دستگاه همه‌چیز خودکار آزاد می‌شود.</li>
</ul>
<h3>۳. ساختن و نصب</h3>
<p>ماژول باید دقیقاً با همان کرنلی ساخته شود که روی برد است (کرنل نسخه و تنظیماتش را در <code>vermagic</code> ماژول چک می‌کند). پس از درخت کرنل Buildroot ${ref('lx-boot')} استفاده کنید. <code>Makefile</code> پوشه‌ی <code>linux/</code> هر دو را انجام می‌دهد:</p>
${pre(DRIVER_STEPS)}
<p>هدف <code>make dtb</code> فایل dtb فعلی برد را (که کنار Makefile کپی کرده‌اید) با <code>dtc</code> به متن برمی‌گرداند، گره را به آخرش اضافه می‌کند و دوباره کامپایل می‌کند. در Buildroot می‌توانید همان متن را به <code>board/ebaz4205/zynq-ebaz4205.dts</code> اضافه کنید.</p>
<p class="note">💡 اگر ماژول را با dtb قدیمی بار کنید، هیچ خطایی نمی‌بینید: ماژول بار می‌شود ولی دستگاهی برای وصل شدن پیدا نمی‌کند. علامتش این است که در dmesg پیام probe نیست و پوشه‌ی <code>/sys/bus/platform/drivers/fpgalab_leds</code> خالی است.</p>
${vv('fa', 'طرح AXI GPIO به‌همراه linux/fpgalab_leds.c، fpgalab-leds.dtsi و Makefile')}
${sourcesBox('fa', 'ldd', 'dtspec', 'pg144', 'buildroot')}`,
    ...BLINK,
    tryIt: `${termSlot('lx-driver')}<p>در زبانه‌ی PC فایل‌های <code>zynq-ebaz4205.dtb</code> و <code>fpgalab_leds.ko</code> را آماده دارید (همان خروجی <code>make modules dtb</code>).</p>`,
  },
  {
    id: 'lx-fpgamgr',
    title: 'بارگذاری bitstream تازه از داخل لینوکس، بدون ریست برد',
    summary: 'با FPGA manager کرنل کل PL را در حالی که لینوکس کار می‌کند با یک طرح دیگر عوض کنید.',
    body: `
<p>تا اینجا bitstream را FSBL در لحظه‌ی بوت بار می‌کرد. پردازنده‌ی Zynq می‌تواند PL را هر وقت بخواهد دوباره برنامه‌ریزی کند و لینوکس برای این کار یک چارچوب دارد: ${term('fpgamgr', 'FPGA manager')}. این درس کل PL را با طرح چراغ رونده‌ی ${ref('x-leds')} عوض می‌کند، در حالی که SSH باز است.</p>
<h3>۱. FPGA manager</h3>
<p>درایور <code>zynq-fpga</code> بلوک پیکربندی Zynq (devcfg) را به کار می‌گیرد و خودش را در <code>/sys/class/fpga_manager/fpga0</code> نشان می‌دهد. <code>cat …/name</code> و <code>cat …/state</code> وضعیت را می‌گویند (<code>operating</code> یعنی PL برنامه‌ریزی شده و کار می‌کند). قبل از برنامه‌ریزی، درایور پل‌های بین PS و PL را می‌بندد و بعد دوباره باز می‌کند.</p>
<h3>۲. bit یا bin؟</h3>
<p>فایل <code>.bit</code> یک سرآیند متنی (نام طرح، قطعه، تاریخ) و بعد داده‌ی پیکربندی دارد. درایور Zynq فقط داده را می‌خواهد و هر کلمه‌ی ۳۲ بیتی را با ترتیب بایت برعکس. ساخت پروژه این فایل را خودش می‌نویسد (<code>running_light.bin</code>، با تابع Tcl <code>fpgalab_bit2bin</code>). راه رسمی‌تر <code>bootgen -process_bitstream bin</code> است و همان نتیجه را می‌دهد.</p>
<h3>۳. شروع بار کردن</h3>
<p>کرنل Xilinx (همان که PetaLinux استفاده می‌کند) دو فایل اضافه در sysfs دارد و کار با آن‌ها یک خط است:</p>
${pre(XLNX)}
<p>کرنل این ایمیج (لینوکس 5.1.5 اصلی) FPGA manager را دارد ولی این دو فایل را ندارد؛ نوشتن در <code>firmware</code> خطای <code>Permission denied</code> می‌دهد. پس یک ماژول کوچک (<code>linux/fpgalab_load.c</code>) همان تابعی را صدا می‌زند که آن فایل صدا می‌زد:</p>
${pre(LOADC)}
<p>تابع <code>fpga_mgr_load</code> فایل را با <code>request_firmware</code> از <code>/lib/firmware</code> می‌خواند. قدم‌ها روی برد:</p>
${pre(LOAD)}
<h3>۴. قواعد پیکربندی کامل</h3>
<ul>
  <li><b>کل PL عوض می‌شود.</b> شبکه‌ی این برد از PL می‌گذرد (${ref('z-ethernet')})؛ اگر طرح تازه مسیر EMIO شبکه را نداشته باشد، SSH همان لحظه قطع می‌شود. پروژه‌ی این درس آن را به‌همراه سیم‌کشی LEDهای EMIO دارد.</li>
  <li><b>AXI GPIO درس قبل دیگر نیست.</b> قبل از بار کردن، <code>fpgalab_leds</code> را با <code>rmmod</code> بردارید و تا برگشتن طرح قبلی به <code>0x41200000</code> دست نزنید؛ خواندن آن برد را قفل می‌کند.</li>
  <li><b>کلاک هنوز لازم است.</b> طرح تازه هم با FCLK_CLK0 کار می‌کند، پس <code>clk_ignore_unused</code> یا <code>fclk-enable</code> سر جایشان می‌مانند.</li>
  <li><b>برگشتن</b> همان کار است با <code>axi_gpio.bin</code> که ساخت ${ref('lx-gpio')} نوشته.</li>
</ul>
<p>کد ویرایشگر در این درس همان طرح دوم است: چراغ رونده‌ی LED1 تا LED3 با کلاک FCLK_CLK0. پروژه‌ی Vivado آن را کنار مسیر شبکه و LEDهای EMIO می‌گذارد و فایل bin را می‌سازد.</p>
<p class="note">💡 بدون لینوکس هم می‌شود: U-Boot فرمان <code>fpga loadb 0 ADDR SIZE</code> دارد که یک .bit را قبل از اجرای کرنل در PL بار می‌کند. قدم‌های بعدی این موضوع پیکربندی جزئی (فقط یک ناحیه از PL) و device tree overlay هستند که هم bitstream و هم گره‌ی درایورش را با هم اضافه می‌کند.</p>
${vv('fa', 'طرح چراغ رونده با مسیر شبکه، running_light.bin و linux/fpgalab_load.c')}
${sourcesBox('fa', 'fpgamgr', 'blkf', 'uboot', 'zynq2')}`,
    ...LIGHT,
    tryIt: `${termSlot('lx-fpgamgr')}<p>با <span class="kbd">▶ Run</span> همین طرح را جدا از لینوکس در شبیه‌ساز PL هم می‌بینید.</p>`,
  },
];

// ---------------------------------------------------------------- English
export const LINUX_EN: Record<string, LessonText> = {
  'lx-boot': {
    title: 'Booting Linux on the EBAZ4205 with U-Boot and an SD card',
    summary: 'From the BootROM to a Linux prompt: write the SD card, meet U-Boot and start the kernel by hand.',
    body: `
<p>In ${ref('z-bootflow')} you saw the BootROM start the FSBL, and the FSBL start the next program. For Linux that program is ${term('uboot', 'U-Boot')}: a boot loader with a command line that reads the Linux kernel and its ${term('devicetree', 'device tree')} from the SD card and starts them. At the end the kernel mounts the ${term('rootfs', 'root file system')} from the same card.</p>
${figure(figLinuxBoot(), 'Each stage loads the next one; the dashed lines show which partition each comes from.')}
<h3>1. What you need</h3>
<ul>
  <li>The board you prepared in ${ref('z-intro')}: the microSD slot at ${part('U7')}, the boot resistor at ${part('R2577')} and a USB-serial adapter on ${part('J7')}.</li>
  <li>A microSD card (one gigabyte is plenty) and the ready image of blkf2016/ebaz4205, <code>buildroot-sdcard.img.7z</code>. Versions: U-Boot 2019.07, Linux 5.1.5 and Buildroot 2019.05.</li>
  <li>A serial terminal at 115200 8N1, such as PuTTY on Windows or <code>picocom</code> on Linux.</li>
</ul>
<h3>2. Writing the card</h3>
<p>Unpack the 7z file and write <code>sdcard.img</code> to the card with balenaEtcher or Win32 Disk Imager. On Linux:</p>
${pre(DD)}
<p class="note">⚠️ Pick <code>/dev/sdX</code> with care (check with <code>lsblk</code>). dd overwrites whatever disk you name, without asking.</p>
<p>The card now has two partitions:</p>
${truth(
  ['Partition', 'Type', 'Contents'],
  [
    ['1', 'FAT, 8 MB', '<code>boot.bin</code> (FSBL and bitstream), <code>u-boot.bin</code> and <code>boot.scr</code>'],
    ['2', 'ext4', 'Linux: <code>/boot/zImage</code>, <code>/boot/zynq-ebaz4205.dtb</code>, <code>/bin</code>, <code>/etc</code> and the rest'],
  ],
)}
<p>The BootROM only reads FAT, so <code>boot.bin</code> is on partition 1. This project's FSBL is modified to put <code>u-boot.bin</code> from the same partition at <code>0x04000000</code> (${ref('z-bootflow')}).</p>
<h3>3. U-Boot and boot.scr</h3>
<p>At power-on U-Boot prints a few lines, then counts down for two seconds: <code>Hit any key to stop autoboot</code>. If you press nothing, the default command <code>bootcmd</code> runs. It scans the card, finds the script <code>boot.scr</code> and runs it. The script is four lines:</p>
${pre(BOOT_SCR)}
<ol>
  <li><code>ext4load</code> puts the kernel from partition 2 (<code>mmc 0:2</code>) into DDR at <code>0x2000000</code>.</li>
  <li>The same for the device tree, at <code>0x1f00000</code>.</li>
  <li><code>bootargs</code> is the kernel command line: the root file system is partition 2, and <code>rootwait</code> tells the kernel to wait until the card is ready.</li>
  <li><code>bootz</code> starts the kernel. The dash in the middle means there is no initramfs.</li>
</ol>
<p><code>boot.scr</code> is not plain text: it is the text with a 64-byte header that the <code>mkimage</code> tool adds. To change it you edit <code>boot.cmd</code> and make <code>boot.scr</code> again. This lesson's Vivado project does that for you.</p>
<h3>4. The same, by hand</h3>
${truth(
  ['Command', 'What it does'],
  [
    ['<code>printenv</code>', 'U-Boot’s variables, among them <code>bootcmd</code> and the addresses <code>kernel_addr_r</code> and <code>fdt_addr_r</code>'],
    ['<code>fatls mmc 0:1</code>', 'the files on the FAT partition'],
    ['<code>ext4ls mmc 0:2 /boot</code>', 'the boot folder on the Linux partition'],
    ['<code>ext4load mmc 0:2 ADDR FILE</code>', 'loads a file into DDR; its size is left in <code>filesize</code>'],
    ['<code>setenv bootargs "…"</code>', 'changes the kernel command line (until power-off)'],
    ['<code>bootz KERNEL - DTB</code>', 'starts the kernel with the device tree'],
  ],
)}
<p>Leave out <code>root=</code> and the kernel starts, but stops at the end with <code>Kernel panic … Unable to mount root fs</code>. Try it in the terminal below; a real board shows the same.</p>
<h3>5. The device tree in one paragraph</h3>
<p>On ARM the kernel does not search for hardware; the file <code>zynq-ebaz4205.dtb</code> tells it what is where. This board's device tree gives 256 MB of memory, names UART1 <code>serial0</code> (so Linux calls it <code>ttyPS0</code>), turns on the Ethernet MAC and the SD card, and describes two LEDs on GPIO 54 and 55 (the EMIO of ${ref('z-ps-hello')}). In ${ref('lx-driver')} you add a node of your own.</p>
<h3>6. Building the image with Buildroot (optional, but the next lessons need it)</h3>
<p>The ready image is enough to start. To compile a program and a driver in the next lessons, you need the compiler and the kernel the image was built with. On a Linux PC (or WSL):</p>
${pre(BUILDROOT)}
<p>Afterwards the cross compiler is <code>output/host/bin/arm-buildroot-linux-gnueabihf-gcc</code> and the kernel tree is <code>output/build/linux-5.1.5</code>.</p>
<h3>7. Your own BOOT.bin</h3>
<p>This lesson's Vivado project builds the PL that Linux on this board needs: the Ethernet path through EMIO (${ref('z-ethernet')}) and the two LEDs on EMIO GPIO. Its <code>boot.bif</code> also puts U-Boot inside BOOT.bin (with the load address <code>0x04000000</code>), so the ordinary Vitis FSBL is enough. Its <code>boot.scr</code> adds two things to the kernel command line: <code>console=ttyPS0,115200</code> and <code>clk_ignore_unused</code>; you need the second in ${ref('lx-gpio')}.</p>
${vv('en', 'the Linux block design, boot.bif with U-Boot and sd/boot.scr')}
<p class="note">💡 Before you replace it, keep the card's original <code>boot.bin</code> under another name, so there is always a way back.</p>
${sourcesBox('en', 'blkf', 'zynq2', 'uboot', 'buildroot')}`,
    tryIt: `${termSlot('lx-boot')}<p>On the real board, do the same from the serial terminal on ${part('J7')}. After login, ${part('LED_R')} blinks like a heartbeat (the heartbeat trigger).</p>`,
  },
  'lx-console': {
    title: 'Serial console and SSH: working with the board’s Linux from your PC',
    summary: 'Log in on J7, get to know the board’s network, connect over SSH and switch the LEDs from sysfs.',
    body: `
<p>Linux has two ways to talk to you: the serial console on ${part('J7')}, which works from the first moment of the boot, and SSH over the network cable, once the network is up. The first is for watching the boot and rescuing the board, the second for daily work and copying files.</p>
<h3>1. The serial console</h3>
<p>UART1 is on MIO 24/25. The device tree calls it <code>serial0</code>, so Linux names it <code>/dev/ttyPS0</code>, and the kernel console and the <code>buildroot login:</code> prompt appear there.</p>
${truth(
  ['System', 'Program'],
  [
    ['Windows', 'PuTTY: connection type Serial, the adapter’s COM port (see Device Manager), speed 115200'],
    ['Linux', '<code>picocom -b 115200 /dev/ttyUSB0</code> (quit: Ctrl+A, then Ctrl+X)'],
    ['macOS', '<code>screen /dev/tty.usbserial-* 115200</code>'],
  ],
)}
<p>The user is <code>root</code> with the password <code>root</code>. That is only fine for a lab bench; if the board goes on any other network, change it with <code>passwd</code>.</p>
<h3>2. The board’s network</h3>
<p>This image’s <code>/etc/network/interfaces</code> gives <code>eth0</code> the fixed address <code>192.168.100.1</code>, and <code>dnsmasq</code> on the board hands any device that connects an address between <code>192.168.100.2</code> and <code>192.168.100.10</code>. So the simplest setup is a cable straight from your PC to the board; the PC gets its address by itself.</p>
<p class="note">⚠️ Do not plug the board into your home router: dnsmasq on the board competes with the router’s DHCP, and other devices in the house may get a wrong address. To put the board on your home network, change the <code>eth0</code> lines in <code>interfaces</code> to <code>iface eth0 inet dhcp</code> and turn dnsmasq off.</p>
<p>On the board, <code>ip addr</code> shows the address. U-Boot makes up a random MAC address at every boot, but because the IP address is fixed, that does not affect the connection.</p>
<h3>3. SSH and copying files</h3>
<p>The image has OpenSSH, and root may log in with the password. Windows 10 and 11 have <code>ssh</code> and <code>scp</code> in PowerShell too:</p>
${pre(`ssh root@192.168.100.1                     # first time: answer yes to the fingerprint question
scp gpio_mem root@192.168.100.1:/root/     # copy a file to the board
scp root@192.168.100.1:/boot/zynq-ebaz4205.dtb .   # and back`)}
<p>From now on, everything you build on the PC (a program, a driver, a device tree, a bitstream) goes to the board with <code>scp</code>.</p>
<h3>4. First hardware from Linux: the LEDs in sysfs</h3>
<p>In Linux, hardware is files too. The <code>gpio-leds</code> driver makes a folder in ${term('sysfs', 'sysfs')} for each LED the device tree describes: <code>/sys/class/leds/led_r</code> and <code>led_g</code>. Each LED has a "trigger" that switches it by itself; ${part('LED_R')} is on <code>heartbeat</code>.</p>
${pre(LEDS)}
<p>No logic of yours drives these LEDs: GPIO 54 and 55 go from EMIO straight to ${part('LED_R')} and ${part('LED_G')}, and the PL design is only wiring. In the next lesson you put your own hardware into the PL.</p>
${vv('en', 'the same base design as the previous lesson; if your SD card is ready, there is no need to build it again')}
${sourcesBox('en', 'blkf', 'buildroot')}`,
    tryIt: `${termSlot('lx-console')}<p>In the terminal above, the <b>PC</b> tab is your computer on the network cable to the board. On the real board, ${part('LED_G')} lights up with the <code>echo 1</code> command.</p>`,
  },
  'lx-gpio': {
    title: 'PL LEDs and keys from Linux: an AXI GPIO and /dev/mem',
    summary: 'Put an AXI GPIO into the PL and read and write the extension board’s LED1-LED3 and KEY1-KEY5 from the Linux command line.',
    body: `
<p>So far Linux only knew the hard peripherals of the PS. Now you build a block in the PL that the processor can read and write like memory: an ${term('axi', 'AXI')} GPIO. Its three outputs go to the extension board’s ${part('LED1')} to ${part('LED3')} and its five inputs come from ${part('KEY1')} to ${part('KEY5')}.</p>
${figure(figAxiMap(), 'Every write to 0x41200000 is an AXI transaction on M_AXI_GP0 that reaches the GPIO_DATA register.')}
<h3>1. The hardware</h3>
<p>This lesson’s block design is the Linux design of ${ref('lx-boot')} plus three blocks:</p>
<ul>
  <li>An <b>AXI GPIO</b> with two channels: channel 1 is three output bits (<code>EXT_LED</code>), channel 2 five input bits (<code>KEY</code>).</li>
  <li>A <b>SmartConnect</b> between the processor’s <code>M_AXI_GP0</code> port and the AXI GPIO. GP0 speaks AXI3 and the AXI GPIO AXI4-Lite; the SmartConnect converts between them.</li>
  <li>A <b>Processor System Reset</b> that makes a reset in step with ${term('fclk', 'FCLK_CLK0')}. All these blocks run on that 50 MHz clock.</li>
</ul>
<p>Vivado gives the AXI GPIO an address in the GP0 space (from <code>0x40000000</code>); the project script sets it to <code>0x41200000</code>, 64 KB long. Its registers:</p>
${truth(
  ['Offset', 'Name', 'Use'],
  [
    ['<code>0x0</code>', 'GPIO_DATA', 'channel 1: one bit per LED (1 = on)'],
    ['<code>0x4</code>', 'GPIO_TRI', 'channel 1 direction (0 = output)'],
    ['<code>0x8</code>', 'GPIO2_DATA', 'channel 2: the keys, active low (pressed = 0)'],
    ['<code>0xC</code>', 'GPIO2_TRI', 'channel 2 direction (1 = input)'],
  ],
)}
<h3>2. Booting the new design</h3>
<p>Build the project, make an FSBL from <code>system.xsa</code> in Vitis and put BOOT.bin together with <code>boot.bif</code> (the project’s README goes step by step). Copy it to the FAT partition as <code>boot.bin</code>, and <code>sd/boot.scr</code> as <code>boot.scr</code>.</p>
<p class="note">⚠️ <b>clk_ignore_unused matters.</b> At the end of the boot Linux turns off every clock no driver asked for, to save power. The kernel does not know your PL logic runs on FCLK_CLK0, so it turns that off as well. After that the AXI GPIO never answers a read, and the processor waits forever. This project’s <code>boot.scr</code> adds <code>clk_ignore_unused</code> to the kernel command line; check it is there with <code>cat /proc/cmdline</code>.</p>
<h3>3. devmem: one register from the command line</h3>
<p>BusyBox’s <code>devmem</code> reads or writes a physical address through <code>/dev/mem</code>:</p>
${pre(DEVMEM)}
<p><code>0x1F</code> is five one bits: no key is pressed. Hold ${part('KEY2')} and bit 1 drops to zero: you read <code>0x1D</code>.</p>
<h3>4. The same in C</h3>
<p>With <code>mmap</code> a program puts the same 64 KB into its own address space and then uses it like an array. <code>volatile</code> keeps the compiler from dropping or reordering the reads:</p>
${pre(MMAP)}
<p>The whole program, <code>linux/gpio_mem.c</code>, is in the project and has three modes: <code>leds 5</code>, <code>keys</code> and <code>mirror</code> (the keys drive the LEDs). Build it on the PC with Buildroot’s compiler (<code>make gpio_mem</code>), copy it with <code>scp</code> and run it.</p>
${vv('en', 'the Linux design with the AXI GPIO, the key and LED XDC, and linux/gpio_mem.c')}
<h3>5. The danger of /dev/mem</h3>
<p>Read an address with no IP behind it (say <code>0x43C00000</code>), or with the PL not programmed, or with its clock off, and the AXI transaction never finishes: the whole board locks up and only a power cycle brings it back. <code>/dev/mem</code> is great for experiments but protects nothing. The proper way is a driver: ${ref('lx-driver')}.</p>
${sourcesBox('en', 'pg144', 'blkf', 'keitetsu')}`,
    tryIt: `${termSlot('lx-gpio')}<p>In the simulator, press the keys on the 3D extension board (or Tab to one and hold Space) and watch its LEDs. If you took the extension board off, put it back first.</p>`,
  },
  'lx-driver': {
    title: 'A simple kernel driver and a device tree for our own hardware',
    summary: 'Add a node to the device tree and write a kernel module that shows the AXI GPIO as two files in sysfs.',
    body: `
<p>The program of ${ref('lx-gpio')} had the address <code>0x41200000</code> in its code, had to run as root, and nothing stopped two programs at once. In Linux this is a driver’s job: code in the kernel that knows the hardware and gives the rest of the system a simple interface (here, two files).</p>
<h3>1. How does the kernel know where the hardware is?</h3>
<p>From the ${term('devicetree', 'device tree')}. Each node describes one device. The key properties are <code>compatible</code> (what this device is) and <code>reg</code> (where it is). You add this node:</p>
${pre(DTSI)}
<p>When the kernel reads this dtb, it creates a "platform device" named <code>41200000.leds</code>. Any driver that says it knows <code>fpgalab,axi-leds</code> binds to it. The address lives in the device tree, not in the driver; move it in Vivado and only the dtb changes.</p>
<p>The project’s <code>linux/fpgalab-leds.dtsi</code> has one more line: <code>fclk-enable = &lt;0x1&gt;</code> on the clock node. That is a more precise fix than <code>clk_ignore_unused</code>: it keeps just FCLK_CLK0 running.</p>
<h3>2. The kernel module</h3>
<p>The driver is a ${term('kmod', 'kernel module')} (<code>fpgalab_leds.ko</code>) that <code>insmod</code> loads. It has three main parts:</p>
${pre(PROBE)}
<ul>
  <li><b>The match table</b> (<code>of_device_id</code>): the string that must equal <code>compatible</code>.</li>
  <li><b>probe</b>: called when the kernel has paired the device with the driver. It takes <code>reg</code> and maps the physical address into the kernel with <code>devm_ioremap_resource</code>; from then on <code>ioread32</code> and <code>iowrite32</code> read and write the registers.</li>
  <li><b>Two files in sysfs</b>: <code>leds</code> (read and write, a number from 0 to 7) and <code>keys</code> (read only, 1 = pressed). The kernel hands the text to the functions <code>leds_store</code> and <code>keys_show</code>. The <code>devm_</code> prefix means everything is released automatically when the device goes away.</li>
</ul>
<h3>3. Building and installing</h3>
<p>The module must be built against exactly the kernel on the board (the kernel checks the version and settings in the module’s <code>vermagic</code>). So use the Buildroot kernel tree of ${ref('lx-boot')}. The <code>Makefile</code> in <code>linux/</code> does both:</p>
${pre(DRIVER_STEPS)}
<p>The <code>make dtb</code> target turns the board’s current dtb (copy it next to the Makefile first) back into text with <code>dtc</code>, appends the node and compiles it again. With Buildroot you can add the same text to <code>board/ebaz4205/zynq-ebaz4205.dts</code>.</p>
<p class="note">💡 Load the module with the old dtb and you see no error at all: the module loads but finds no device to bind to. The signs are that dmesg has no probe message and <code>/sys/bus/platform/drivers/fpgalab_leds</code> is empty.</p>
${vv('en', 'the AXI GPIO design with linux/fpgalab_leds.c, fpgalab-leds.dtsi and the Makefile')}
${sourcesBox('en', 'ldd', 'dtspec', 'pg144', 'buildroot')}`,
    tryIt: `${termSlot('lx-driver')}<p>The PC tab already has <code>zynq-ebaz4205.dtb</code> and <code>fpgalab_leds.ko</code> (what <code>make modules dtb</code> writes).</p>`,
  },
  'lx-fpgamgr': {
    title: 'Loading a new bitstream from Linux, without resetting the board',
    summary: 'Use the kernel’s FPGA manager to replace the whole PL with another design while Linux keeps running.',
    body: `
<p>So far the FSBL loaded the bitstream at boot. A Zynq’s processor can program the PL again whenever it likes, and Linux has a framework for it: the ${term('fpgamgr', 'FPGA manager')}. This lesson swaps the whole PL for the running light of ${ref('x-leds')} while an SSH session stays open.</p>
<h3>1. The FPGA manager</h3>
<p>The <code>zynq-fpga</code> driver drives the Zynq’s configuration block (devcfg) and shows up as <code>/sys/class/fpga_manager/fpga0</code>. <code>cat …/name</code> and <code>cat …/state</code> tell you its state (<code>operating</code> means the PL is programmed and running). Before programming, the driver closes the bridges between the PS and the PL and opens them again afterwards.</p>
<h3>2. bit or bin?</h3>
<p>A <code>.bit</code> file has a text header (design name, part, date) and then the configuration data. The Zynq driver wants only the data, with every 32-bit word in the opposite byte order. The project build writes that file for you (<code>running_light.bin</code>, with the Tcl function <code>fpgalab_bit2bin</code>). The official way is <code>bootgen -process_bitstream bin</code>, which gives the same result.</p>
<h3>3. Starting a load</h3>
<p>The Xilinx kernel (the one PetaLinux uses) has two extra files in sysfs, and a load is one line:</p>
${pre(XLNX)}
<p>This image’s kernel (mainline Linux 5.1.5) has the FPGA manager but not these two files; writing to <code>firmware</code> fails with <code>Permission denied</code>. So a small module (<code>linux/fpgalab_load.c</code>) calls the same function that file would:</p>
${pre(LOADC)}
<p><code>fpga_mgr_load</code> reads the file with <code>request_firmware</code> from <code>/lib/firmware</code>. The steps on the board:</p>
${pre(LOAD)}
<h3>4. The rules of a full reconfiguration</h3>
<ul>
  <li><b>The whole PL is replaced.</b> This board’s network goes through the PL (${ref('z-ethernet')}); if the new design lacks the EMIO Ethernet path, SSH drops at that instant. This lesson’s project keeps it, along with the wiring of the EMIO LEDs.</li>
  <li><b>The AXI GPIO of the last lesson is gone.</b> Remove <code>fpgalab_leds</code> with <code>rmmod</code> before the load, and leave <code>0x41200000</code> alone until the old design is back; reading it locks the board.</li>
  <li><b>The clock is still needed.</b> The new design runs on FCLK_CLK0 too, so <code>clk_ignore_unused</code> or <code>fclk-enable</code> stay.</li>
  <li><b>Going back</b> is the same with <code>axi_gpio.bin</code>, which the build of ${ref('lx-gpio')} wrote.</li>
</ul>
<p>The editor’s code in this lesson is that second design: a running light on LED1-LED3 clocked by FCLK_CLK0. The Vivado project puts it next to the Ethernet path and the EMIO LEDs and writes the bin file.</p>
<p class="note">💡 It also works without Linux: U-Boot has <code>fpga loadb 0 ADDR SIZE</code>, which loads a .bit into the PL before the kernel starts. The next steps from here are partial reconfiguration (one region of the PL only) and device-tree overlays, which add a bitstream and its driver’s node together.</p>
${vv('en', 'the running light with the Ethernet path, running_light.bin and linux/fpgalab_load.c')}
${sourcesBox('en', 'fpgamgr', 'blkf', 'uboot', 'zynq2')}`,
    tryIt: `${termSlot('lx-fpgamgr')}<p>With <span class="kbd">▶ Run</span> you can also watch the same design in the PL simulator, without Linux.</p>`,
  },
};

// ---------------------------------------------------------------- learning loop
export const LINUX_LEVEL: Record<string, Level> = {
  'lx-boot': 'core',
  'lx-console': 'core',
  'lx-gpio': 'advanced',
  'lx-driver': 'advanced',
  'lx-fpgamgr': 'advanced',
};
export const LINUX_PREREQ: Record<string, string[]> = {
  'lx-boot': ['z-bootflow', 'z-ethernet'],
  'lx-console': ['lx-boot'],
  'lx-gpio': ['lx-console', 'x-keys'],
  'lx-driver': ['lx-gpio'],
  'lx-fpgamgr': ['lx-driver', 'x-leds'],
};

export const LINUX_GOALS: Record<string, { fa: Goals; en: Goals }> = {
  'lx-boot': {
    fa: {
      objectives: ['کارت SD را با ایمیج لینوکس بنویسید و دو پارتیشن آن را بشناسید.', 'در U-Boot بوت خودکار را متوقف کنید و کرنل را با ext4load و bootz اجرا کنید.', 'نقش bootargs، device tree و boot.scr را توضیح دهید.'],
      takeaways: ['زنجیره: BootROM، FSBL، U-Boot، boot.scr، کرنل با dtb، و فایل‌سیستم ریشه.', 'پارتیشن ۱ FAT است (boot.bin، u-boot.bin، boot.scr) و پارتیشن ۲ ext4 (لینوکس).', 'بدون <code>root=/dev/mmcblk0p2 rootwait</code> کرنل با panic می‌ایستد.', 'boot.scr متن با سرآیند mkimage است؛ برای تغییر، boot.cmd را عوض کنید.'],
    },
    en: {
      objectives: ['Write the SD card with a Linux image and name its two partitions.', 'Stop autoboot in U-Boot and start the kernel with ext4load and bootz.', 'Explain what bootargs, the device tree and boot.scr do.'],
      takeaways: ['The chain: BootROM, FSBL, U-Boot, boot.scr, the kernel with its dtb, then the root file system.', 'Partition 1 is FAT (boot.bin, u-boot.bin, boot.scr), partition 2 ext4 (Linux).', 'Without <code>root=/dev/mmcblk0p2 rootwait</code> the kernel stops with a panic.', 'boot.scr is text with an mkimage header; to change it, edit boot.cmd.'],
    },
  },
  'lx-console': {
    fa: {
      objectives: ['از کنسول سریال J7 (ttyPS0) وارد لینوکس برد شوید.', 'آدرس‌های شبکه را بشناسید و از PC با SSH وصل شوید و با scp فایل بفرستید.', 'LEDهای برد را از /sys/class/leds و triggerها کنترل کنید.'],
      takeaways: ['UART1 در لینوکس <code>/dev/ttyPS0</code> است، با 115200 8N1.', 'برد <code>192.168.100.1</code> است و با dnsmasq به PC آدرس می‌دهد؛ کابل را مستقیم بزنید.', 'در sysfs هر LED یک پوشه است: <code>brightness</code> و <code>trigger</code>.'],
    },
    en: {
      objectives: ['Log in to the board’s Linux on the serial console J7 (ttyPS0).', 'Know the network addresses, connect from the PC with SSH and copy files with scp.', 'Control the board’s LEDs through /sys/class/leds and its triggers.'],
      takeaways: ['UART1 is <code>/dev/ttyPS0</code> in Linux, at 115200 8N1.', 'The board is <code>192.168.100.1</code> and gives the PC an address with dnsmasq; use a direct cable.', 'In sysfs each LED is a folder: <code>brightness</code> and <code>trigger</code>.'],
    },
  },
  'lx-gpio': {
    fa: {
      objectives: ['یک AXI GPIO را با SmartConnect به M_AXI_GP0 وصل کنید و آدرسش را بدانید.', 'با devmem رجیسترهای GPIO_DATA و GPIO2_DATA را بنویسید و بخوانید.', 'با mmap روی /dev/mem یک برنامه‌ی C برای همین کار بنویسید.'],
      takeaways: ['AXI GPIO در <code>0x41200000</code> است: <code>+0x0</code> LEDها، <code>+0x8</code> کلیدها.', 'کلیدها فعال‌پایین‌اند: <code>0x1F</code> یعنی هیچ کلیدی فشرده نیست.', 'بدون <code>clk_ignore_unused</code> لینوکس FCLK_CLK0 را خاموش می‌کند و AXI GPIO جواب نمی‌دهد.', 'خواندن آدرسی بدون IP یا با PL خالی کل برد را قفل می‌کند.'],
    },
    en: {
      objectives: ['Connect an AXI GPIO to M_AXI_GP0 through a SmartConnect and know its address.', 'Write and read GPIO_DATA and GPIO2_DATA with devmem.', 'Write a C program that does the same with mmap on /dev/mem.'],
      takeaways: ['The AXI GPIO is at <code>0x41200000</code>: <code>+0x0</code> the LEDs, <code>+0x8</code> the keys.', 'The keys are active low: <code>0x1F</code> means no key is pressed.', 'Without <code>clk_ignore_unused</code> Linux stops FCLK_CLK0 and the AXI GPIO stops answering.', 'Reading an address with no IP, or with an empty PL, locks the whole board.'],
    },
  },
  'lx-driver': {
    fa: {
      objectives: ['یک گره با compatible و reg به device tree اضافه کنید و dtb را دوباره بسازید.', 'بخش‌های یک platform driver را بشناسید: جدول تطبیق، probe و فایل‌های sysfs.', 'ماژول را با کرنل Buildroot بسازید، بار کنید و bind شدنش را بررسی کنید.'],
      takeaways: ['کرنل درایور را با رشته‌ی <code>compatible</code> به دستگاه وصل می‌کند.', 'آدرس از <code>reg</code> device tree می‌آید؛ <code>devm_ioremap_resource</code> آن را نگاشت می‌کند.', 'ماژول باید با همان کرنل برد ساخته شود (vermagic).', 'بدون گره در dtb، ماژول بی‌صدا بار می‌شود ولی probe صدا زده نمی‌شود.'],
    },
    en: {
      objectives: ['Add a node with compatible and reg to the device tree and rebuild the dtb.', 'Name the parts of a platform driver: the match table, probe and the sysfs files.', 'Build the module against the Buildroot kernel, load it and check that it binds.'],
      takeaways: ['The kernel pairs a driver with a device through the <code>compatible</code> string.', 'The address comes from the device tree’s <code>reg</code>; <code>devm_ioremap_resource</code> maps it.', 'A module must be built against the board’s own kernel (vermagic).', 'With no node in the dtb, the module loads silently but probe is never called.'],
    },
  },
  'lx-fpgamgr': {
    fa: {
      objectives: ['نقش FPGA manager و فایل‌های آن در /sys/class/fpga_manager را توضیح دهید.', 'یک .bit را به .bin تبدیل کنید و از /lib/firmware بار کنید.', 'قواعد پیکربندی کامل را رعایت کنید: مسیر شبکه، درایورها و کلاک.'],
      takeaways: ['FPGA manager با devcfg کل PL را در حالی که لینوکس کار می‌کند برنامه‌ریزی می‌کند.', 'درایور Zynq فایل bin می‌خواهد: داده‌ی بدون سرآیند، با کلمه‌های بایت‌برعکس.', 'کرنل اصلی 5.1 فایل firmware در sysfs ندارد؛ <code>fpga_mgr_load</code> همان کار را می‌کند.', 'طرح تازه باید مسیر EMIO شبکه را داشته باشد وگرنه SSH قطع می‌شود.'],
    },
    en: {
      objectives: ['Explain the FPGA manager and its files in /sys/class/fpga_manager.', 'Turn a .bit into a .bin and load it from /lib/firmware.', 'Follow the rules of a full reconfiguration: the network path, the drivers and the clock.'],
      takeaways: ['The FPGA manager programs the whole PL through devcfg while Linux keeps running.', 'The Zynq driver wants a bin: the data without the header, every word byte-swapped.', 'Mainline 5.1 has no firmware file in sysfs; <code>fpga_mgr_load</code> does the same job.', 'The new design must keep the EMIO Ethernet path, or SSH drops.'],
    },
  },
};

export const LINUX_QUIZ: Record<string, { fa: Question[]; en: Question[] }> = {
  'lx-boot': {
    fa: [
      q('U-Boot فایل boot.scr را از کجا اجرا می‌کند؟', ['bootcmd پیش‌فرض کارت را می‌گردد و آن را پیدا می‌کند', 'BootROM آن را مستقیم اجرا می‌کند', 'کرنل بعد از بوت آن را اجرا می‌کند', 'FSBL آن را در OCM کپی می‌کند'], 0, 'وقتی شمارش معکوس تمام شود، bootcmd اجرا می‌شود و اسکریپت را روی پارتیشن FAT پیدا می‌کند.'),
      q('اگر در bootargs گزینه‌ی root= نباشد چه می‌شود؟', ['کرنل بالا می‌آید ولی با panic می‌ایستد، چون فایل‌سیستم ریشه را پیدا نمی‌کند', 'U-Boot کرنل را بار نمی‌کند', 'برد از NAND بوت می‌شود', 'هیچ اتفاقی نمی‌افتد'], 0, 'کرنل باید بداند فایل‌سیستم ریشه کجاست؛ بدون آن panic می‌کند.'),
      q('در bootz 0x2000000 - 0x1f00000 خط تیره یعنی چه؟', ['initramfs نداریم', 'آدرس کرنل را حدس بزن', 'device tree نداریم', 'خروجی را دور بریز'], 0, 'آرگومان دوم آدرس initramfs است و خط تیره یعنی خالی.'),
    ],
    en: [
      q('How does U-Boot get to run boot.scr?', ['The default bootcmd scans the card and finds it', 'The BootROM runs it directly', 'The kernel runs it after booting', 'The FSBL copies it into OCM'], 0, 'When the countdown ends, bootcmd runs and finds the script on the FAT partition.'),
      q('What happens if bootargs has no root= option?', ['The kernel starts but stops with a panic: it cannot find the root file system', 'U-Boot does not load the kernel', 'The board boots from NAND', 'Nothing'], 0, 'The kernel must know where the root file system is; without it, it panics.'),
      q('In bootz 0x2000000 - 0x1f00000, what does the dash mean?', ['There is no initramfs', 'Guess the kernel address', 'There is no device tree', 'Throw the output away'], 0, 'The second argument is the initramfs address, and a dash means none.'),
    ],
  },
  'lx-console': {
    fa: [
      q('کنسول سریال J7 در لینوکس چه نامی دارد؟', ['/dev/ttyPS0', '/dev/ttyUSB0', '/dev/ttyS1', '/dev/mem'], 0, 'device tree، UART1 را serial0 نامیده و درایور xuartps آن را ttyPS0 می‌کند.'),
      q('چرا نباید برد را با این ایمیج به روتر خانه وصل کرد؟', ['dnsmasq روی برد با DHCP روتر رقابت می‌کند', 'روتر SSH را می‌بندد', 'برد آدرس IP ندارد', 'کابل شبکه سریال را قطع می‌کند'], 0, 'برد خودش سرور DHCP دارد و ممکن است به دستگاه‌های دیگر آدرس اشتباه بدهد.'),
      q('با کدام فایل LED_G روشن می‌شود؟', ['/sys/class/leds/led_g/brightness', '/proc/cmdline', '/etc/network/interfaces', '/dev/ttyPS0'], 0, 'درایور gpio-leds برای هر LED یک پوشه با فایل brightness می‌سازد.'),
    ],
    en: [
      q('What does Linux call the serial console on J7?', ['/dev/ttyPS0', '/dev/ttyUSB0', '/dev/ttyS1', '/dev/mem'], 0, 'The device tree calls UART1 serial0, and the xuartps driver makes it ttyPS0.'),
      q('Why not plug the board with this image into your home router?', ['dnsmasq on the board competes with the router’s DHCP', 'The router blocks SSH', 'The board has no IP address', 'The network cable cuts the serial line'], 0, 'The board runs its own DHCP server and may hand other devices wrong addresses.'),
      q('Which file turns LED_G on?', ['/sys/class/leds/led_g/brightness', '/proc/cmdline', '/etc/network/interfaces', '/dev/ttyPS0'], 0, 'The gpio-leds driver makes a folder with a brightness file for each LED.'),
    ],
  },
  'lx-gpio': {
    fa: [
      q('devmem 0x41200008 مقدار 0x1D می‌دهد. کدام کلید فشرده است؟', ['KEY2', 'KEY1', 'KEY3', 'هیچ‌کدام'], 0, '0x1D یعنی ۱۱۱۰۱؛ بیت ۱ صفر است و کلیدها فعال‌پایین‌اند، پس KEY2.'),
      q('چرا boot.scr این پروژه clk_ignore_unused دارد؟', ['تا لینوکس FCLK_CLK0 را به‌عنوان کلاک بی‌استفاده خاموش نکند', 'تا بوت سریع‌تر شود', 'تا UART کار کند', 'تا dnsmasq روشن شود'], 0, 'کرنل نمی‌داند PL از این کلاک استفاده می‌کند و آن را در آخر بوت خاموش می‌کند.'),
      q('خواندن آدرسی که هیچ IPی پشتش نیست چه می‌کند؟', ['تراکنش AXI تمام نمی‌شود و برد قفل می‌شود', 'صفر برمی‌گرداند', 'پیام خطا چاپ می‌کند', 'PL را ریست می‌کند'], 0, 'پردازنده منتظر جواب AXI می‌ماند که هرگز نمی‌آید؛ فقط خاموش و روشن کردن کمک می‌کند.'),
    ],
    en: [
      q('devmem 0x41200008 reads 0x1D. Which key is pressed?', ['KEY2', 'KEY1', 'KEY3', 'None'], 0, '0x1D is 11101; bit 1 is zero and the keys are active low, so KEY2.'),
      q('Why does this project’s boot.scr have clk_ignore_unused?', ['So Linux does not stop FCLK_CLK0 as an unused clock', 'To boot faster', 'For the UART', 'To start dnsmasq'], 0, 'The kernel does not know the PL uses that clock and turns it off at the end of the boot.'),
      q('What does reading an address with no IP behind it do?', ['The AXI transaction never ends and the board locks up', 'It returns zero', 'It prints an error', 'It resets the PL'], 0, 'The processor waits for an AXI answer that never comes; only a power cycle helps.'),
    ],
  },
  'lx-driver': {
    fa: [
      q('کرنل از کجا می‌فهمد درایور fpgalab_leds به کدام دستگاه تعلق دارد؟', ['از رشته‌ی compatible در device tree', 'از نام فایل .ko', 'از آدرس داخل کد درایور', 'از /dev/mem'], 0, 'جدول of_device_id درایور با compatible گره‌ی device tree مقایسه می‌شود.'),
      q('ماژول با dtb قدیمی بار شد و خطایی نداد. چه اتفاقی افتاده؟', ['دستگاهی برای bind نبود، پس probe صدا زده نشد', 'LEDها روشن شدند', 'کرنل panic کرد', 'ماژول خودش گره را ساخت'], 0, 'بدون گره‌ی fpgalab,axi-leds هیچ دستگاهی با درایور جفت نمی‌شود.'),
      q('چرا ماژول باید با درخت کرنل Buildroot ساخته شود؟', ['کرنل نسخه و تنظیمات را در vermagic ماژول چک می‌کند', 'چون Buildroot سریع‌تر است', 'چون dtc فقط آنجاست', 'لازم نیست'], 0, 'ماژولی که با کرنل دیگری ساخته شده بار نمی‌شود.'),
    ],
    en: [
      q('How does the kernel know which device the fpgalab_leds driver is for?', ['From the compatible string in the device tree', 'From the .ko file name', 'From an address in the driver code', 'From /dev/mem'], 0, 'The driver’s of_device_id table is compared with the node’s compatible.'),
      q('The module loaded with the old dtb and gave no error. What happened?', ['There was no device to bind to, so probe was never called', 'The LEDs lit up', 'The kernel panicked', 'The module made the node itself'], 0, 'Without a fpgalab,axi-leds node, no device pairs with the driver.'),
      q('Why must the module be built against the Buildroot kernel tree?', ['The kernel checks the version and settings in the module’s vermagic', 'Buildroot is faster', 'dtc is only there', 'It need not'], 0, 'A module built for another kernel will not load.'),
    ],
  },
  'lx-fpgamgr': {
    fa: [
      q('چرا طرح دوم باید مسیر EMIO شبکه را هم داشته باشد؟', ['پیکربندی کامل کل PL را عوض می‌کند و شبکه از PL می‌گذرد', 'چون FPGA manager شبکه لازم دارد', 'چون bin بدون آن ساخته نمی‌شود', 'لازم نیست'], 0, 'بدون آن مسیر، MAC به PHY نمی‌رسد و SSH قطع می‌شود.'),
      q('فرق .bin با .bit برای درایور Zynq چیست؟', ['سرآیند ندارد و بایت‌های هر کلمه برعکس‌اند', 'فشرده است', 'فقط برای U-Boot است', 'هیچ فرقی ندارد'], 0, 'درایور zynq-fpga داده‌ی خام را با کلمه‌های بایت‌برعکس می‌خواهد.'),
      q('قبل از بار کردن running_light.bin چرا fpgalab_leds را برمی‌داریم؟', ['AXI GPIO با طرح قبلی از بین می‌رود و دسترسی به آن برد را قفل می‌کند', 'چون حافظه کم است', 'چون FPGA manager آن را لازم دارد', 'چون LEDها می‌سوزند'], 0, 'درایوری که به سخت‌افزار رفته دست بزند، منتظر جوابی می‌ماند که نمی‌آید.'),
    ],
    en: [
      q('Why must the second design keep the EMIO Ethernet path?', ['A full reconfiguration replaces the whole PL, and the network goes through it', 'The FPGA manager needs the network', 'The bin cannot be built without it', 'It need not'], 0, 'Without that path the MAC cannot reach the PHY and SSH drops.'),
      q('How does a .bin differ from a .bit for the Zynq driver?', ['It has no header and the bytes of each word are swapped', 'It is compressed', 'It is only for U-Boot', 'There is no difference'], 0, 'The zynq-fpga driver wants raw data with byte-swapped words.'),
      q('Why remove fpgalab_leds before loading running_light.bin?', ['The AXI GPIO goes with the old design, and touching it locks the board', 'Memory is short', 'The FPGA manager needs it', 'The LEDs would burn out'], 0, 'A driver that touches hardware that is gone waits for an answer that never comes.'),
    ],
  },
};
