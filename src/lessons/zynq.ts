// Chapter Z (docs/EBAZ4205-ROADMAP.md, Phase E2): Zynq and the EBAZ4205. Five lessons, shown only on that board.
// z-blink runs in the simulator and has a checker; the other four are guided real-board lessons like `realboard`
// (no checker: done when the quiz is passed). Facts come from docs/ebaz4205/CONTENT.md; every lesson ends with the
// Sources box of docs/ebaz4205/SOURCES.md. Everything for the chapter (Persian lessons, English text, goals, quiz,
// prerequisites) lives here and is merged into the course tables by course.ts.
import { Z_BLINK_V, Z_BLINK_VHD } from '../boards/ebaz4205/code';
import type { LessonText } from './en';
import { figBootFlow, figMii, figure, figZynq } from './figures';
import type { Level } from './goals';
import { part, ref, term, truth } from './helpers';
import type { Lesson } from './lessons';
import type { Question } from './predict';

type Goals = { objectives: string[]; takeaways: string[] };
const q = (text: string, options: string[], answer: number, why: string): Question => ({ q: text, options, answer, why });

// ---------------------------------------------------------------- shared pieces
export type Src = 'codeasm' | 'zynq1' | 'zynq2' | 'xjtuecho' | 'keitetsu' | 'elrori' | 'blkf' | 'extsch' | 'vendorlcd' | 'dvi' | 'st7789' | 'buildroot' | 'uboot' | 'pg144' | 'fpgamgr' | 'dtspec' | 'ldd';
const CREDITS: Record<Src, [string, string]> = {
  codeasm: ['https://gist.github.com/CodeAsm/57d5856370546adbc41941ca716988f8', 'Board notes: CodeAsm, gist EBAZ4205'],
  zynq1: ['https://hhuysqt.github.io/zynq1/', 'Vivado/SDK walkthrough after hhuysqt, zynq[1] (CC BY-NC-SA 4.0)'],
  zynq2: ['https://hhuysqt.github.io/zynq2/', 'Linux build after hhuysqt, zynq[2] (CC BY-NC-SA 4.0)'],
  xjtuecho: ['https://github.com/xjtuecho/EBAZ4205', 'Pin map: xjtuecho/EBAZ4205 (MIT)'],
  keitetsu: ['https://github.com/KeitetsuWorks/EBAZ4205', 'Block design: KeitetsuWorks/EBAZ4205 (MIT)'],
  elrori: ['https://github.com/Elrori/EBAZ4205', 'Core board schematic and EBAZEXT: Elrori/EBAZ4205'],
  blkf: ['https://github.com/blkf2016/ebaz4205', 'U-Boot and Buildroot notes: blkf2016/ebaz4205'],
  // no link: the board vendor's files (not published online), and two documents without a stable public address
  extsch: ['', 'Extension board pins: the vendor\u2019s adapter-board schematic (REV 1.0, 2022-03-20) and example XDC files'],
  vendorlcd: ['', 'Display start-up: the vendor\u2019s example project 04_PS_LCD_test (ST7789 driven over EMIO)'],
  dvi: ['', 'TMDS encoding: Digital Visual Interface (DVI) 1.0 specification, DDWG, 1999, section 3.2'],
  st7789: ['', 'Display commands and reset timing: Sitronix ST7789V datasheet'],
  buildroot: ['https://buildroot.org/downloads/manual/manual.html', 'The Buildroot user manual'],
  uboot: ['https://docs.u-boot.org/en/latest/', 'The U-Boot documentation (commands, distro boot, script images)'],
  pg144: ['https://docs.amd.com/v/u/en-US/pg144-axi-gpio', 'AXI GPIO registers: AMD LogiCORE IP AXI GPIO product guide (PG144)'],
  fpgamgr: ['https://docs.kernel.org/driver-api/fpga/fpga-mgr.html', 'The Linux kernel documentation: FPGA Manager'],
  dtspec: ['https://www.devicetree.org/specifications/', 'The Devicetree Specification'],
  ldd: ['https://docs.kernel.org/driver-api/driver-model/platform.html', 'The Linux kernel documentation: platform devices and drivers'],
};
// the "Sources" box at the end of every EBAZ4205 lesson; the credit lines stay in English in both languages
export function sourcesBox(lang: 'fa' | 'en', ...ids: Src[]): string {
  const h = lang === 'fa' ? 'منابع' : 'Sources';
  const note =
    lang === 'fa'
      ? 'متن این درس را خودمان نوشته‌ایم؛ از این منابع فقط واقعیت‌ها (شماره‌ی پایه‌ها، تنظیمات و ترتیب مراحل) آمده است.'
      : 'The text of this lesson is our own; only facts (pin numbers, settings, the order of steps) come from these sources.';
  return `<aside class="sources" dir="${lang === 'fa' ? 'rtl' : 'ltr'}"><h3>${h}</h3><ul>${ids
    .map((id) => `<li dir="ltr">${CREDITS[id][0] ? `<a href="${CREDITS[id][0]}" target="_blank" rel="noopener">${CREDITS[id][1]}</a>` : CREDITS[id][1]}</li>`)
    .join('')}</ul><p class="dim">${note}</p></aside>`;
}

// E2.4: "Prepare your board", ticked items are kept as a bitmask in prep:ebaz4205 (main.ts restores them)
const PREP: { fa: string; en: string }[] = [
  { fa: `هدر ۳ پایه‌ی ${part('J7')} (UART) را لحیم کنید و یک مبدل USB به TTL سه‌ولتی وصل کنید: TX برد به RX مبدل، RX برد به TX مبدل، GND به GND.`, en: `Solder the 3-pin header ${part('J7')} (UART) and connect a 3.3 V USB-TTL adapter: board TX to adapter RX, board RX to adapter TX, GND to GND.` },
  { fa: `اسلات microSD را در ${part('U7')} لحیم کنید و مقاومت صفر اهمی را از ${part('R2584')} (بوت NAND) به ${part('R2577')} (بوت SD) ببرید.`, en: `Solder a microSD slot at ${part('U7')} and move the 0 Ω resistor from ${part('R2584')} (NAND boot) to ${part('R2577')} (SD boot).` },
  { fa: `برای JTAG هدر ۱۴ پایه‌ی ${part('J8')} را لحیم کنید (اختیاری، برای Vivado Hardware Manager).`, en: `For JTAG, solder the 14-pin header ${part('J8')} (optional, for Vivado Hardware Manager).` },
  { fa: `تغذیه: ۵ ولت از برد توسعه یا از پایه‌های تغذیه‌ی یکی از هدرهای ${part('DATA1')} تا ${part('DATA3')}.`, en: `Power: 5 V from the extension board or into the power pins of one of the headers ${part('DATA1')} to ${part('DATA3')}.` },
];
const prepList = (lang: 'fa' | 'en') =>
  `<div class="prep" data-prep="ebaz4205"><h3>${lang === 'fa' ? 'برد خود را آماده کنید' : 'Prepare your board'}</h3><ul>${PREP.map(
    (p, i) => `<li><label><input type="checkbox" data-prep-bit="${i}"> <span>${p[lang]}</span></label></li>`,
  ).join('')}</ul></div>`;

// jumps to the "Build it in Vivado" box at the end of the lesson (src/ui/vivado.ts), which saves or builds the project
const dlButton = (lang: 'fa' | 'en', extra: string) =>
  `<p><button class="btn primary small" data-jump="sec-vivado">${lang === 'fa' ? 'ساخت یا دانلود پروژه‌ی Vivado ↓' : 'Build or download the Vivado project ↓'}</button> <span class="dim">${extra}</span></p>`;

// the four real-board lessons keep the blinker in the editor, so Run still shows the board doing something
const BLINK = { verilog: Z_BLINK_V, vhdl: Z_BLINK_VHD, xdc: { led: true } };

// ---------------------------------------------------------------- Persian lessons
export const ZYNQ_LESSONS: Lesson[] = [
  {
    id: 'z-intro',
    title: 'آشنایی با Zynq و برد EBAZ4205',
    summary: 'یک برد ماینر بازیافتی که هم پردازنده‌ی ARM دارد و هم FPGA.',
    body: `
<p>EBAZ4205 برد کنترل ماینر بیت‌کوین Ebit E9+ است. بعد از افت استخراج، این بردها دست‌دوم و بسیار ارزان فروخته شدند و حالا ارزان‌ترین برد Zynq موجودند. روی آن یک تراشه‌ی ${term('ps', 'Zynq-7010')} است: دو هسته‌ی ARM و یک FPGA در یک بسته.</p>
<h3>۱. مشخصات</h3>
${truth(
  ['بخش', 'مقدار'],
  [
    ['تراشه', '<code>XC7Z010CLG400-1</code>: دو هسته‌ی Cortex-A9 و منطقی هم‌خانواده‌ی Artix-7 (۱۷٬۶۰۰ LUT)'],
    ['حافظه', '۲۵۶ مگابایت DDR3 با گذرگاه ۱۶ بیتی؛ ۱۲۸ مگابایت NAND'],
    ['شبکه', '۱۰/۱۰۰ مگابیت با PHY مدل IP101GA، وصل به پایه‌های PL'],
    ['سریال', `UART1 روی MIO 24/25، هدر ${part('J7')}، سرعت 115200`],
    ['LED', `${part('LED_R')} روی W14 و ${part('LED_G')} روی W13`],
    ['کلاک PL', `ندارد؛ جای خالی ${part('X5')} روی N18. کلاک از PS می‌آید (FCLK_CLK0)`],
    ['هدرها', `${part('DATA1')}، ${part('DATA2')} و ${part('DATA3')} با گام ۲ میلی‌متر، هر کدام ۱۴ پایه‌ی FPGA`],
  ],
)}
<h3>۲. PS و PL</h3>
<ul>
  <li><b>PS</b> (سامانه‌ی پردازشی): دو هسته‌ی ARM، کنترلر DDR و تجهیزات سخت مثل UART، SD، NAND و MAC شبکه. PS بدون PL هم کار می‌کند و می‌تواند لینوکس اجرا کند.</li>
  <li><b>PL</b> (منطق برنامه‌پذیر): همان LUT، فلیپ‌فلاپ، BRAM و DSP که در Nexys A7 دیدید. طرح‌های Verilog و VHDL شما اینجا اجرا می‌شوند.</li>
  <li>تجهیزات PS پایه‌های ثابتی به نام ${term('mio', 'MIO')} دارند (۵۴ پایه). اگر یک تجهیز باید به پایه‌های PL برسد، از مسیر ${term('emio', 'EMIO')} از داخل FPGA عبور می‌کند. MAC شبکه‌ی این برد همین کار را می‌کند، چون PHY به پایه‌های PL وصل است.</li>
  <li>PS با گذرگاه ${term('axi', 'AXI')} با منطق PL حرف می‌زند و تا چهار کلاک (${term('fclk', 'FCLK_CLK0..3')}) به PL می‌دهد.</li>
</ul>
${figure(figZynq({ title: 'Zynq-7010: بخش PS و بخش PL در یک تراشه', ps: 'PS (سامانه‌ی پردازشی)', pl: 'PL (منطق برنامه‌پذیر)', mio: 'MIO: ۵۴ پایه‌ی ثابت (J7، SD، NAND)', plPins: 'پایه‌های PL: LEDها، DATA1-3، PHY' }), 'PS و PL با AXI، کلاک‌های FCLK و EMIO به هم وصل‌اند.')}
${prepList('fa')}
<p class="note">⚠️ فریمور اصلی برد تلاش می‌کند به استخر ماینینگ وصل شود و در لاگ بوتش اطلاعات ورود دیده می‌شود. NAND را پاک کنید یا نادیده بگیرید و هرگز از آن اطلاعات استفاده نکنید. برای قطع بوت خودکار، در خط فرمان U-Boot کلید <code>d</code> را بزنید.</p>
${sourcesBox('fa', 'codeasm', 'zynq1', 'xjtuecho', 'keitetsu', 'elrori')}`,
    ...BLINK,
    tryIt: `<p>روی برد سه‌بعدی ${part('J7')}، ${part('J8')}، ${part('U7')} و مقاومت‌های ${part('R2584')} و ${part('R2577')} را پیدا کنید. بعد <span class="kbd">▶ Run</span> را بزنید تا دو LED با کلاک PS چشمک بزنند.</p>`,
  },
  {
    id: 'z-blink',
    title: 'اولین طرح PL: چشمک‌زن با کلاک PS',
    summary: 'LED قرمز و سبز را با کلاک ۵۰ مگاهرتزی FCLK_CLK0 به نوبت روشن کنید.',
    body: `
<p>PL برد EBAZ4205 نوسان‌ساز ندارد (جای ${part('X5')} خالی است). پس کلاک طرح شما از PS می‌آید: ${term('fclk', 'FCLK_CLK0')} با فرکانس ۵۰ مگاهرتز. در شبیه‌ساز، پورت <code>clk</code> خودکار به این کلاک وصل می‌شود.</p>
<h3>۱. تقسیم کلاک</h3>
<p>برای نیم ثانیه در ۵۰ مگاهرتز باید تا ۲۵٬۰۰۰٬۰۰۰ بشمارید. شمارنده هر بار که به <code>DIV - 1</code> می‌رسد صفر می‌شود و <code>tick</code> برعکس می‌شود. ${part('LED_R')} خود <code>tick</code> را نشان می‌دهد و ${part('LED_G')} برعکس آن را، پس دو LED به نوبت روشن می‌شوند. همین کار را با ۱۰۰ مگاهرتز در ${ref('counter')} دیدید.</p>
<h3>۲. XDC بدون پایه‌ی کلاک</h3>
<p>در XDC فقط دو خط برای <code>W14</code> و <code>W13</code> هست. خط <code>create_clock</code> و پایه‌ی کلاک وجود ندارد، چون کلاک از داخل تراشه می‌آید و Vivado محدودیت آن را از تنظیمات PS می‌داند.</p>
<h3>۳. روی برد واقعی</h3>
<p>یک bitstream به‌تنهایی کافی نیست: FCLK_CLK0 فقط بعد از اجرای <code>ps7_init</code> روی PS روشن می‌شود. پس حتی یک چشمک‌زن هم یک block design با ZYNQ7 Processing System لازم دارد. کادر «ساخت روی برد واقعی با Vivado» پایین هر درس این block design را خودکار می‌سازد. بعد با JTAG از Vitis (با تیک Program FPGA) یا با BOOT.bin روی کارت SD اجرا کنید (${ref('z-bootflow')}).</p>
${sourcesBox('fa', 'xjtuecho', 'keitetsu', 'zynq1')}`,
    ...BLINK,
    tryIt: `<p><span class="kbd">▶ Run</span> را بزنید: ${part('LED_R')} و ${part('LED_G')} به نوبت چشمک می‌زنند. در کنسول خط <code>clk is driven by FCLK_CLK0</code> را می‌بینید.</p>`,
    exercise: `<p>کاری کنید ${part('LED_G')} دو برابر سریع‌تر از ${part('LED_R')} چشمک بزند.</p>`,
  },
  {
    id: 'z-bootflow',
    title: 'Zynq چطور بوت می‌شود؟ BootROM، FSBL و BOOT.bin',
    summary: 'از روشن شدن تا اجرای برنامه، قدم به قدم.',
    body: `
<p>FPGAی Nexys A7 با روشن شدن bitstream را از فلش می‌خواند و تمام. Zynq فرق دارد: اول پردازنده روشن می‌شود و خود پردازنده PL را برنامه‌ریزی می‌کند. این کار سه مرحله دارد.</p>
${figure(figBootFlow({ title: 'بوت Zynq: BootROM، بعد FSBL در OCM، بعد bitstream و برنامه در DDR', straps: 'مقاومت‌های بوت (R2584 / R2577)', ocm: '← OCM (۲۵۶ کیلوبایت)', plc: '← PL پیکربندی شد', ddr: 'راه‌اندازی DDR، بعد ← DDR', boot: 'BOOT.bin روی کارت SD (FAT)' }), 'سه بخش BOOT.bin به ترتیب اجرا می‌شوند.')}
<ol>
  <li><b>${term('bootrom', 'BootROM')}</b> داخل تراشه است و تغییر نمی‌کند. مقاومت‌های بوت (${part('R2584')} یا ${part('R2577')}) را می‌خواند، تصویر بوت را روی NAND، SD یا QSPI پیدا می‌کند (یا منتظر JTAG می‌ماند) و ${term('fsbl', 'FSBL')} را در حافظه‌ی داخلی ${term('ocm', 'OCM')} کپی می‌کند.</li>
  <li><b>FSBL</b> (بوت‌لودر مرحله‌ی اول) کلاک‌ها، MIO و DDR را با کدی که Vivado ساخته (<code>ps7_init.c</code>) راه می‌اندازد، اگر bitstream در تصویر باشد PL را پیکربندی می‌کند و برنامه‌ی بعدی را در DDR بار می‌کند.</li>
  <li><b>برنامه</b>: یک برنامه‌ی bare-metal، یا U-Boot که بعد لینوکس را اجرا می‌کند.</li>
</ol>
<h3>BOOT.bin و فایل bif</h3>
<p>${term('bootbin', 'BOOT.bin')} همین سه بخش را به ترتیب دارد. ابزار <code>bootgen</code> آن را از یک فایل <code>.bif</code> می‌سازد:</p>
<pre dir="ltr"><code>the_ROM_image:
{
    [bootloader] fsbl.elf
    system_wrapper.bit
    app.elf
}</code></pre>
<p>روی کارت SD، BOOT.bin فقط یک فایل در پارتیشن FAT است؛ BootROM سیستم فایل دیگری نمی‌شناسد.</p>
<h3>منبع بوت در EBAZ4205</h3>
${truth(
  ['منبع', 'چطور انتخاب می‌شود'],
  [
    ['NAND', `پیش‌فرض (مقاومت روی ${part('R2584')})`],
    ['SD', `مقاومت را به ${part('R2577')} ببرید و اسلات ${part('U7')} را لحیم کنید`],
    ['JTAG', 'وقتی هیچ دستگاه بوتی جواب ندهد'],
    ['QSPI', 'احتمالاً روی این برد سیم‌کشی نشده'],
  ],
)}
<p class="note">💡 FSBL هر چیزی را می‌تواند بار کند. پروژه‌ی blkf2016 یک FSBL تغییریافته دارد که فایل <code>u-boot.bin</code> را از کارت SD می‌خواند، در آدرس <code>0x04000000</code> از DDR می‌گذارد و اجرا می‌کند. این‌طوری با کپی یک فایل U-Boot عوض می‌شود و BOOT.bin دوباره ساخته نمی‌شود.</p>
${sourcesBox('fa', 'zynq1', 'zynq2', 'codeasm', 'blkf')}`,
    ...BLINK,
    tryIt: `<p>در این درس شبیه‌سازی جدیدی نیست. در کادر «ساخت روی برد واقعی با Vivado» پایین همین درس پروژه را ذخیره کنید و فایل <code>boot.bif</code> آن را با شکل بالا مقایسه کنید.</p>`,
  },
  {
    id: 'z-ps-hello',
    title: 'اولین برنامه روی ARM: Hello World از طریق UART',
    summary: 'با Vivado و Vitis برنامه‌ای بسازید که روی J7 پیام بفرستد و LEDها را چشمک بزند.',
    body: `
<p>تا اینجا فقط PL را برنامه‌ریزی کردید. حالا یک برنامه‌ی C روی هسته‌ی ARM اجرا می‌کنید که روی ${part('J7')} پیام چاپ می‌کند و LEDها را از طریق ${term('emio', 'EMIO')} GPIO چشمک می‌زند.</p>
<h3>۱. تنظیمات PS برای این برد</h3>
${truth(
  ['تنظیم', 'مقدار'],
  [
    ['Part', '<code>xc7z010clg400-1</code>'],
    ['DDR', '<code>MT41K128M16 JT-125</code>، گذرگاه 16 Bit'],
    ['NAND', 'فعال، MIO 0 و 2-14، هشت بیتی'],
    ['SD0', 'MIO 40-45، تشخیص کارت روی MIO 34'],
    ['UART1', 'MIO 24-25'],
    ['QSPI و USB0', 'غیرفعال'],
    ['GPIO', 'MIO GPIO و EMIO GPIO (دو بیت) برای LEDها'],
    ['کلاک', 'FCLK_CLK0 = 50MHz'],
  ],
)}
<h3>۲. مراحل</h3>
<ol>
  <li>${dlButton('fa', 'پروژه‌ی آماده با همین تنظیمات و <code>vitis/ps_hello.c</code>')} یا خودتان: پروژه‌ی جدید، Create Block Design، افزودن ZYNQ7 Processing System، تنظیمات بالا، Run Block Automation.</li>
  <li>در Vivado Tcl Shell: <code>cd C:/fpga/fpga_lab_z-ps-hello</code> و بعد <code>vivado -mode batch -source create_project.tcl -tclargs build</code>. خروجی bitstream و <code>system.xsa</code> است (همراه bitstream).</li>
  <li>در Vitis از <code>system.xsa</code> یک platform بسازید (FSBL هم ساخته می‌شود)، بعد یک برنامه از قالب Empty Application (C) و فایل <code>ps_hello.c</code> را در آن بگذارید.</li>
  <li>Create Boot Image: FSBL، bitstream و برنامه، به همین ترتیب، و BOOT.bin بسازید.</li>
  <li>BOOT.bin را روی کارت FAT بریزید، کارت را بگذارید، ترمینال را روی 115200 8N1 باز کنید و برد را روشن کنید.</li>
</ol>
<h3>۳. LEDها از PS</h3>
<p>در این پروژه LEDها را منطق PL نمی‌راند. EMIO GPIO دو بیت دارد و بلوک‌های <code>xlslice</code> بیت ۰ را به ${part('LED_R')} و بیت ۱ را به ${part('LED_G')} می‌برند. شماره‌ی GPIO اولین پایه‌ی EMIO ۵۴ است (بعد از ۵۴ پایه‌ی MIO)، پس برنامه پایه‌های ۵۴ و ۵۵ را می‌نویسد.</p>
<pre dir="ltr"><code>printf("Hello from the Zynq PS on the EBAZ4205!\\r\\n");
XGpioPs_WritePin(&amp;gpio, 54, n &amp; 1);   // LED_R</code></pre>
<p class="note">💡 مسیر پروژه را بدون فاصله و پرانتز انتخاب کنید (مثل <code>C:/fpga</code>)؛ <code>vivado.bat</code> با این نویسه‌ها مشکل دارد. پشتیبانی دستگاه Zynq-7000 هم باید در Vivado نصب باشد.</p>
${sourcesBox('fa', 'zynq1', 'keitetsu', 'codeasm')}`,
    ...BLINK,
    tryIt: `<p>شبیه‌ساز PS را اجرا نمی‌کند. روی برد واقعی بعد از بوت در ترمینال <code>Hello from the Zynq PS on the EBAZ4205!</code> و بعد هر ثانیه یک خط <code>tick</code> می‌بینید و LEDها به نوبت روشن می‌شوند.</p>`,
  },
  {
    id: 'z-ethernet',
    title: 'شبکه از طریق EMIO: سرور اکو با lwIP',
    summary: 'MAC پردازنده را از داخل FPGA به PHY برسانید و با telnet تست کنید.',
    body: `
<p>MAC شبکه‌ی PS (به نام GEM0) روی این برد نمی‌تواند از MIO استفاده کند، چون PHY به پایه‌های PL وصل است. پس GEM0 از ${term('emio', 'EMIO')} وارد PL می‌شود و XDC پایه‌های شبکه را مشخص می‌کند.</p>
<h3>۱. GMII و MII</h3>
<p>گذرگاه‌های ${term('gmii', 'GMII')} پردازنده ۸ بیتی‌اند، اما ${term('phy', 'PHY')} مدل IP101GA فقط MII چهار بیتی (۱۰۰ مگابیت) دارد. دو بلوک کوچک این فاصله را پر می‌کنند:</p>
${figure(figMii({ title: 'GMII به MII: ‏xlslice بیت‌های TXD[3:0] را نگه می‌دارد و xlconcat بیت‌های RXD[7:4] را صفر می‌کند', zero: "4'b0000" }), 'بدون این دو بلوک، مرحله‌ی bitstream با خطای پایه‌های بی‌جا متوقف می‌شود.')}
<ul>
  <li><code>xlslice</code> با <code>DIN_WIDTH 8</code> بیت‌های ۳ تا ۰ از <code>ENET0_GMII_TXD</code> را جدا می‌کند.</li>
  <li><code>xlconcat</code> دو ورودی چهار بیتی دارد: پایینی RXD از PHY، بالایی صفر.</li>
  <li><code>GMII_RX_CLK</code>، <code>GMII_TX_CLK</code>، <code>TX_EN</code>، <code>RX_DV</code> و ${term('mdio', 'MDIO')} مستقیم خارجی می‌شوند.</li>
</ul>
<h3>۲. XDC شبکه</h3>
${truth(
  ['سیگنال', 'پایه'],
  [
    ['RX_CLK / TX_CLK', 'U14 / U15'],
    ['TX_EN / RX_DV', 'W19 / W16'],
    ['TXD[3:0]', 'Y19 V18 Y18 W18'],
    ['RXD[3:0]', 'Y17 V17 V16 Y16'],
    ['MDC / MDIO', 'W15 / Y14'],
    ['FCLK_CLK3 (۲۵ مگاهرتز برای PHY)', 'U18، فقط اگر کریستال Y3 روی برد نیست'],
  ],
)}
<h3>۳. سرور اکو</h3>
<ol>
  <li>${dlButton('fa', 'block design با ENET0 روی EMIO، slice و concat، FCLK_CLK3 و XDC شبکه')}</li>
  <li>در Vivado Tcl Shell با <code>-tclargs build</code> بسازید و در Vitis از <code>system.xsa</code> برنامه‌ای با قالب <b>lwIP Echo Server</b> بسازید.</li>
  <li>BOOT.bin را بسازید و بوت کنید. برد آدرس IP را روی ${part('J7')} چاپ می‌کند. PHY روی آدرس MDIO صفر است.</li>
  <li>از کامپیوتر: <code>telnet &lt;board-ip&gt; 7</code>. هر خطی که بنویسید برمی‌گردد.</li>
</ol>
<p class="note">💡 قدم بعدی لینوکس است: U-Boot، کرنل و device tree مخصوص این برد. فصل «لینوکس روی Zynq» از ${ref('lx-boot')} شروع می‌شود و همین طرح شبکه را نگه می‌دارد.</p>
${sourcesBox('fa', 'zynq1', 'zynq2', 'keitetsu', 'xjtuecho')}`,
    ...BLINK,
    tryIt: `<p>شبیه‌ساز شبکه ندارد. روی برد واقعی با <code>telnet</code> به پورت ۷ وصل شوید؛ هر چه تایپ کنید برمی‌گردد.</p>`,
  },
];

// ---------------------------------------------------------------- English
export const ZYNQ_EN: Record<string, LessonText> = {
  'z-intro': {
    title: 'Meet the Zynq and the EBAZ4205',
    summary: 'A recycled miner board with both ARM cores and an FPGA.',
    body: `
<p>The EBAZ4205 is the control board of the Ebit E9+ Bitcoin miner. After the mining downturn these boards were sold second-hand for a few dollars, which makes them the cheapest Zynq board around. It carries a ${term('ps', 'Zynq-7010')}: two ARM cores and an FPGA in one package.</p>
<h3>1. Specs</h3>
${truth(
  ['Item', 'Value'],
  [
    ['Chip', '<code>XC7Z010CLG400-1</code>: dual Cortex-A9 plus Artix-7-class logic (17,600 LUTs)'],
    ['Memory', '256 MB DDR3 on a 16-bit bus; 128 MB NAND'],
    ['Network', '10/100 Mbit, IP101GA PHY wired to PL pins'],
    ['Serial', `UART1 on MIO 24/25, header ${part('J7')}, 115200 baud`],
    ['LEDs', `${part('LED_R')} on W14 and ${part('LED_G')} on W13`],
    ['PL clock', `none; empty footprint ${part('X5')} on N18. The clock comes from the PS (FCLK_CLK0)`],
    ['Headers', `${part('DATA1')}, ${part('DATA2')} and ${part('DATA3')}, 2.0 mm pitch, 14 FPGA pins each`],
  ],
)}
<h3>2. PS and PL</h3>
<ul>
  <li>The <b>PS</b> (processing system): two ARM cores, the DDR controller and hard peripherals such as UART, SD, NAND and the Ethernet MAC. The PS works without the PL and can run Linux.</li>
  <li>The <b>PL</b> (programmable logic): the same LUTs, flip-flops, BRAM and DSP you met on the Nexys A7. Your Verilog and VHDL designs run here.</li>
  <li>PS peripherals have fixed pins called ${term('mio', 'MIO')} (54 of them). When a peripheral must reach PL pins, it goes through the fabric over ${term('emio', 'EMIO')}. This board's Ethernet MAC does exactly that, because the PHY is wired to PL pins.</li>
  <li>The PS talks to PL logic over ${term('axi', 'AXI')} and gives the PL up to four clocks (${term('fclk', 'FCLK_CLK0..3')}).</li>
</ul>
${figure(figZynq(), 'The PS and the PL are linked by AXI, the FCLK clocks and EMIO.')}
${prepList('en')}
<p class="note">⚠️ The stock firmware tries to reach a mining pool and its boot log shows a pool login. Wipe or ignore the NAND and never reuse those credentials. To stop autoboot, press <code>d</code> at the U-Boot prompt.</p>
${sourcesBox('en', 'codeasm', 'zynq1', 'xjtuecho', 'keitetsu', 'elrori')}`,
    tryIt: `<p>Find ${part('J7')}, ${part('J8')}, ${part('U7')} and the resistors ${part('R2584')} and ${part('R2577')} on the 3D board. Then press <span class="kbd">▶ Run</span> and the two LEDs blink from the PS clock.</p>`,
  },
  'z-blink': {
    title: 'First PL design: a blinker clocked by the PS',
    summary: 'Blink the red and green LEDs in turn from the 50 MHz FCLK_CLK0.',
    body: `
<p>The PL of the EBAZ4205 has no oscillator (the ${part('X5')} footprint is empty). So your design's clock comes from the PS: ${term('fclk', 'FCLK_CLK0')} at 50 MHz. In the simulator the <code>clk</code> port is wired to it automatically.</p>
<h3>1. Dividing the clock</h3>
<p>Half a second at 50 MHz is 25,000,000 counts. The counter wraps to zero when it reaches <code>DIV - 1</code>, and <code>tick</code> flips. ${part('LED_R')} shows <code>tick</code> and ${part('LED_G')} its inverse, so the two LEDs take turns. You did the same at 100 MHz in ${ref('counter')}.</p>
<h3>2. An XDC with no clock pin</h3>
<p>The XDC has only two lines, for <code>W14</code> and <code>W13</code>. There is no clock pin and no <code>create_clock</code>: the clock comes from inside the chip and Vivado knows its constraint from the PS settings.</p>
<h3>3. On the real board</h3>
<p>A bitstream alone is not enough: FCLK_CLK0 only starts after the PS has run <code>ps7_init</code>. So even a blinker needs a block design with the ZYNQ7 Processing System. The box "Build it on a real board with Vivado" at the end of each lesson builds that block design for you. Then run it over JTAG from Vitis (with Program FPGA ticked) or from a BOOT.bin on an SD card (${ref('z-bootflow')}).</p>
${sourcesBox('en', 'xjtuecho', 'keitetsu', 'zynq1')}`,
    tryIt: `<p>Press <span class="kbd">▶ Run</span>: ${part('LED_R')} and ${part('LED_G')} blink in turn. The console shows <code>clk is driven by FCLK_CLK0</code>.</p>`,
    exercise: `<p>Make ${part('LED_G')} blink twice as fast as ${part('LED_R')}.</p>`,
  },
  'z-bootflow': {
    title: 'How a Zynq boots: BootROM, FSBL and BOOT.bin',
    summary: 'From power-on to your program, step by step.',
    body: `
<p>The Nexys A7's FPGA reads its bitstream from flash at power-on, and that is all. A Zynq is different: the processor starts first, and the processor configures the PL. This takes three stages.</p>
${figure(figBootFlow(), 'The three parts of BOOT.bin run in order.')}
<ol>
  <li>The <b>${term('bootrom', 'BootROM')}</b> is inside the chip and cannot change. It reads the boot straps (${part('R2584')} or ${part('R2577')}), finds the boot image on NAND, SD or QSPI (or waits for JTAG) and copies the ${term('fsbl', 'FSBL')} into the on-chip memory, ${term('ocm', 'OCM')}.</li>
  <li>The <b>FSBL</b> (first-stage boot loader) sets up the clocks, MIO and DDR with the code Vivado generated (<code>ps7_init.c</code>), configures the PL if the image holds a bitstream, and loads the next program into DDR.</li>
  <li>The <b>application</b>: a bare-metal program, or U-Boot, which then starts Linux.</li>
</ol>
<h3>BOOT.bin and the bif file</h3>
<p>${term('bootbin', 'BOOT.bin')} holds those three parts in order. The <code>bootgen</code> tool builds it from a <code>.bif</code> file:</p>
<pre dir="ltr"><code>the_ROM_image:
{
    [bootloader] fsbl.elf
    system_wrapper.bit
    app.elf
}</code></pre>
<p>On an SD card BOOT.bin is just a file on a FAT partition; the BootROM knows no other file system.</p>
<h3>Boot sources on the EBAZ4205</h3>
${truth(
  ['Source', 'How it is chosen'],
  [
    ['NAND', `the default (resistor at ${part('R2584')})`],
    ['SD', `move the resistor to ${part('R2577')} and solder the ${part('U7')} slot`],
    ['JTAG', 'when no boot device answers'],
    ['QSPI', 'probably not wired on this board'],
  ],
)}
<p class="note">💡 The FSBL can load anything. The blkf2016 project has a modified FSBL that reads <code>u-boot.bin</code> from the SD card, puts it in DDR at <code>0x04000000</code> and jumps there. U-Boot can then be replaced by copying a file, without rebuilding BOOT.bin.</p>
${sourcesBox('en', 'zynq1', 'zynq2', 'codeasm', 'blkf')}`,
    tryIt: `<p>There is no new simulation in this lesson. Save the project from "Build it on a real board with Vivado" at the end of this lesson and compare its <code>boot.bif</code> with the figure above.</p>`,
  },
  'z-ps-hello': {
    title: 'First program on the ARM: Hello World over UART',
    summary: 'Use Vivado and Vitis to print on J7 and blink the LEDs.',
    body: `
<p>So far you have only programmed the PL. Now you run a C program on an ARM core that prints on ${part('J7')} and blinks the LEDs through ${term('emio', 'EMIO')} GPIO.</p>
<h3>1. PS settings for this board</h3>
${truth(
  ['Setting', 'Value'],
  [
    ['Part', '<code>xc7z010clg400-1</code>'],
    ['DDR', '<code>MT41K128M16 JT-125</code>, 16 Bit bus'],
    ['NAND', 'enabled, MIO 0 and 2-14, 8-bit'],
    ['SD0', 'MIO 40-45, card detect on MIO 34'],
    ['UART1', 'MIO 24-25'],
    ['QSPI, USB0', 'disabled'],
    ['GPIO', 'MIO GPIO and EMIO GPIO (2 bits) for the LEDs'],
    ['Clock', 'FCLK_CLK0 = 50 MHz'],
  ],
)}
<h3>2. Steps</h3>
<ol>
  <li>${dlButton('en', 'a ready project with these settings and <code>vitis/ps_hello.c</code>')} Or by hand: new project, Create Block Design, add ZYNQ7 Processing System, apply the settings above, Run Block Automation.</li>
  <li>In the Vivado Tcl Shell: <code>cd C:/fpga/fpga_lab_z-ps-hello</code>, then <code>vivado -mode batch -source create_project.tcl -tclargs build</code>. It writes the bitstream and <code>system.xsa</code> (bitstream included).</li>
  <li>In Vitis create a platform from <code>system.xsa</code> (this builds the FSBL), then an application from the Empty Application (C) template, and put <code>ps_hello.c</code> in it.</li>
  <li>Create Boot Image: FSBL, bitstream and application, in that order, into BOOT.bin.</li>
  <li>Copy BOOT.bin to a FAT card, insert it, open a terminal at 115200 8N1 and power on.</li>
</ol>
<h3>3. LEDs from the PS</h3>
<p>In this project no PL logic drives the LEDs. EMIO GPIO is two bits wide, and <code>xlslice</code> blocks take bit 0 to ${part('LED_R')} and bit 1 to ${part('LED_G')}. The first EMIO pin is GPIO number 54 (after the 54 MIO pins), so the program writes pins 54 and 55.</p>
<pre dir="ltr"><code>printf("Hello from the Zynq PS on the EBAZ4205!\\r\\n");
XGpioPs_WritePin(&amp;gpio, 54, n &amp; 1);   // LED_R</code></pre>
<p class="note">💡 Pick a project path without spaces or parentheses (such as <code>C:/fpga</code>); <code>vivado.bat</code> breaks on them. Zynq-7000 device support must also be installed in Vivado.</p>
${sourcesBox('en', 'zynq1', 'keitetsu', 'codeasm')}`,
    tryIt: `<p>The simulator does not run the PS. On the real board, after boot the terminal shows <code>Hello from the Zynq PS on the EBAZ4205!</code>, then a <code>tick</code> line every second, and the LEDs take turns.</p>`,
  },
  'z-ethernet': {
    title: 'Ethernet through EMIO: an lwIP echo server',
    summary: 'Route the PS MAC through the fabric to the PHY and test it with telnet.',
    body: `
<p>The PS Ethernet MAC (GEM0) cannot use MIO on this board, because the PHY is wired to PL pins. So GEM0 enters the PL over ${term('emio', 'EMIO')}, and the XDC places the Ethernet pins.</p>
<h3>1. GMII and MII</h3>
<p>The processor's ${term('gmii', 'GMII')} buses are 8 bits wide, but the IP101GA ${term('phy', 'PHY')} only speaks 4-bit MII (100 Mbit). Two small blocks bridge the gap:</p>
${figure(figMii(), 'Without these two blocks, the bitstream step stops on unplaced pins.')}
<ul>
  <li>An <code>xlslice</code> with <code>DIN_WIDTH 8</code> takes bits 3 to 0 of <code>ENET0_GMII_TXD</code>.</li>
  <li>An <code>xlconcat</code> has two 4-bit inputs: the lower one is RXD from the PHY, the upper one zero.</li>
  <li><code>GMII_RX_CLK</code>, <code>GMII_TX_CLK</code>, <code>TX_EN</code>, <code>RX_DV</code> and ${term('mdio', 'MDIO')} are made external directly.</li>
</ul>
<h3>2. The Ethernet XDC</h3>
${truth(
  ['Signal', 'Pin'],
  [
    ['RX_CLK / TX_CLK', 'U14 / U15'],
    ['TX_EN / RX_DV', 'W19 / W16'],
    ['TXD[3:0]', 'Y19 V18 Y18 W18'],
    ['RXD[3:0]', 'Y17 V17 V16 Y16'],
    ['MDC / MDIO', 'W15 / Y14'],
    ['FCLK_CLK3 (25 MHz for the PHY)', 'U18, only if crystal Y3 is missing'],
  ],
)}
<h3>3. The echo server</h3>
<ol>
  <li>${dlButton('en', 'a block design with ENET0 over EMIO, the slice and concat, FCLK_CLK3 and the Ethernet XDC')}</li>
  <li>Build it in the Vivado Tcl Shell with <code>-tclargs build</code>, and in Vitis create an application from <code>system.xsa</code> with the <b>lwIP Echo Server</b> template.</li>
  <li>Make BOOT.bin and boot. The board prints its IP address on ${part('J7')}. The PHY sits at MDIO address 0.</li>
  <li>On your computer: <code>telnet &lt;board-ip&gt; 7</code>. Every line you type comes back.</li>
</ol>
<p class="note">💡 The next step is Linux: U-Boot, a kernel and a device tree for this board. The chapter "Linux on Zynq" starts at ${ref('lx-boot')} and keeps this Ethernet design.</p>
${sourcesBox('en', 'zynq1', 'zynq2', 'keitetsu', 'xjtuecho')}`,
    tryIt: `<p>The simulator has no network. On the real board, <code>telnet</code> to port 7; whatever you type comes back.</p>`,
  },
};

// ---------------------------------------------------------------- learning loop
export const ZYNQ_LEVEL: Record<string, Level> = {
  'z-intro': 'intro',
  'z-blink': 'intro',
  'z-bootflow': 'core',
  'z-ps-hello': 'core',
  'z-ethernet': 'advanced',
};
export const ZYNQ_PREREQ: Record<string, string[]> = {
  'z-blink': ['z-intro'],
  'z-bootflow': ['z-blink'],
  'z-ps-hello': ['z-bootflow'],
  'z-ethernet': ['z-ps-hello'],
};

export const ZYNQ_GOALS: Record<string, { fa: Goals; en: Goals }> = {
  'z-intro': {
    fa: {
      objectives: ['PS و PL را از هم تشخیص دهید و بگویید MIO و EMIO چیستند.', 'LEDها، هدرهای DATA، J7، J8 و مقاومت‌های بوت را روی برد پیدا کنید.', 'برد را برای بوت از کارت SD و کنسول سریال آماده کنید.'],
      takeaways: ['PS پردازنده و تجهیزات سخت است؛ PL منطق برنامه‌پذیر شماست.', 'تجهیزات PS پایه‌های MIO دارند و از EMIO به پایه‌های PL می‌رسند.', 'PL این برد نوسان‌ساز ندارد؛ کلاک آن <code>FCLK_CLK0</code> از PS است.'],
    },
    en: {
      objectives: ['Tell the PS and the PL apart and say what MIO and EMIO are.', 'Find the LEDs, DATA headers, J7 (UART), J8 (JTAG) and the boot resistors on the board.', 'Prepare a board for SD-card boot and a serial console.'],
      takeaways: ['The PS is the processor and hard peripherals; the PL is your programmable logic.', 'PS peripherals have MIO pins and reach PL pins through EMIO.', 'This board\u2019s PL has no oscillator; its clock is <code>FCLK_CLK0</code> from the PS.'],
    },
  },
  'z-blink': {
    fa: {
      objectives: ['توضیح دهید چرا کلاک PL روی این برد از PS می‌آید.', 'یک تقسیم‌کننده‌ی کلاک برای ۵۰ مگاهرتز بنویسید.', 'دو خط LED را در XDC بخوانید.'],
      takeaways: ['نیم ثانیه در ۵۰ مگاهرتز یعنی ۲۵٬۰۰۰٬۰۰۰ کلاک.', 'XDC این برد پایه‌ی کلاک و <code>create_clock</code> ندارد.', 'bitstream تنها کافی نیست؛ PS باید اول <code>ps7_init</code> را اجرا کند.'],
    },
    en: {
      objectives: ['Explain why the PL clock comes from the PS on this board.', 'Write a clock divider for 50 MHz.', 'Read the two LED lines in the XDC.'],
      takeaways: ['Half a second at 50 MHz is 25,000,000 clocks.', 'This board\u2019s XDC has no clock pin and no <code>create_clock</code>.', 'A bitstream alone is not enough; the PS must run <code>ps7_init</code> first.'],
    },
  },
  'z-bootflow': {
    fa: {
      objectives: ['سه مرحله‌ی بوت و آنچه هر کدام بار می‌کند را نام ببرید.', 'یک فایل <code>.bif</code> را بخوانید.', 'روی EBAZ4205 بوت از NAND، SD یا JTAG را انتخاب کنید.'],
      takeaways: ['BootROM ‏FSBL را در OCM کپی می‌کند.', 'FSBL ‏DDR را راه می‌اندازد، PL را پیکربندی می‌کند و برنامه را بار می‌کند.', 'BOOT.bin به ترتیب FSBL، bitstream و برنامه را دارد.', 'جابه‌جایی مقاومت از R2584 به R2577 بوت را به SD می‌برد.'],
    },
    en: {
      objectives: ['Name the three boot stages and what each loads.', 'Read a <code>.bif</code> file.', 'Choose NAND, SD or JTAG boot on the EBAZ4205.'],
      takeaways: ['The BootROM copies the FSBL into OCM.', 'The FSBL starts DDR, configures the PL and loads the application.', 'BOOT.bin holds the FSBL, the bitstream and the application, in that order.', 'Moving the resistor from R2584 to R2577 switches boot to SD.'],
    },
  },
  'z-ps-hello': {
    fa: {
      objectives: ['ZYNQ7 PS را برای این برد تنظیم کنید (DDR، UART1، SD0، NAND).', 'سخت‌افزار را export کنید و در Vitis یک FSBL و یک برنامه بسازید.', 'BOOT.bin بسازید و از کارت SD بوت کنید.'],
      takeaways: ['UART1 روی MIO 24/25 و هدر J7 است، با سرعت 115200.', 'فایل <code>.xsa</code> باید bitstream را هم داشته باشد.', 'اولین پایه‌ی EMIO GPIO شماره‌ی ۵۴ است.'],
    },
    en: {
      objectives: ['Configure the ZYNQ7 PS for this board (DDR, UART1, SD0, NAND).', 'Export the hardware and build an FSBL and an application in Vitis.', 'Make BOOT.bin and boot it from SD.'],
      takeaways: ['UART1 is on MIO 24/25 and header J7, at 115200.', 'The <code>.xsa</code> must include the bitstream.', 'The first EMIO GPIO pin is number 54.'],
    },
  },
  'z-ethernet': {
    fa: {
      objectives: ['GMII و MII و چسب slice/concat را توضیح دهید.', 'پایه‌های شبکه را در XDC محدود کنید.', 'سرور اکوی lwIP را اجرا و با telnet تست کنید.'],
      takeaways: ['PHY به پایه‌های PL وصل است، پس GEM0 از EMIO می‌رود.', 'xlslice ‏TXD[3:0] را نگه می‌دارد؛ xlconcat ‏RXD را با چهار صفر پر می‌کند.', 'بدون کریستال Y3، کلاک ۲۵ مگاهرتزی PHY از <code>FCLK_CLK3</code> روی U18 می‌آید.', 'سرور اکو روی پورت ۷ است.'],
    },
    en: {
      objectives: ['Explain GMII vs MII and the slice/concat glue.', 'Constrain the Ethernet pins.', 'Run the lwIP echo server and test it with telnet.'],
      takeaways: ['The PHY is wired to PL pins, so GEM0 goes through EMIO.', 'An xlslice keeps TXD[3:0]; an xlconcat pads RXD with four zeros.', 'Without crystal Y3 the PHY\u2019s 25 MHz comes from <code>FCLK_CLK3</code> on U18.', 'The echo server listens on port 7.'],
    },
  },
};

export const ZYNQ_QUIZ: Record<string, { fa: Question[]; en: Question[] }> = {
  'z-intro': {
    fa: [
      q('کدام بخش Zynq لینوکس اجرا می‌کند؟', ['PS (هسته‌های ARM)', 'PL (منطق برنامه‌پذیر)', 'PHY شبکه', 'BootROM'], 0, 'لینوکس روی هسته‌های Cortex-A9 در PS اجرا می‌شود؛ PL منطق سخت‌افزاری است.'),
      q('MAC شبکه در PS است. چرا پایه‌های شبکه در XDC می‌آیند؟', ['چون PHY به پایه‌های PL وصل است و MAC از EMIO عبور می‌کند', 'چون PS پایه ندارد', 'چون XDC همه‌ی پایه‌های تراشه را دارد', 'چون شبکه در PL شبیه‌سازی می‌شود'], 0, 'سیگنال‌هایی که از EMIO می‌روند به پایه‌های PL می‌رسند و XDC جایشان را تعیین می‌کند.'),
      q('جابه‌جایی مقاومت از R2584 به R2577 چه چیزی را عوض می‌کند؟', ['منبع بوت را از NAND به کارت SD', 'ولتاژ تغذیه را', 'سرعت UART را', 'فرکانس FCLK_CLK0 را'], 0, 'این مقاومت‌ها حالت بوت را به BootROM می‌گویند.'),
    ],
    en: [
      q('Which part of a Zynq runs Linux?', ['The PS (the ARM cores)', 'The PL (programmable logic)', 'The Ethernet PHY', 'The BootROM'], 0, 'Linux runs on the Cortex-A9 cores in the PS; the PL is hardware logic.'),
      q('The Ethernet MAC is in the PS. Why are the Ethernet pins in the XDC?', ['The PHY is wired to PL pins, so the MAC goes through EMIO', 'The PS has no pins', 'The XDC lists every pin of the chip', 'The network is simulated in the PL'], 0, 'Signals routed over EMIO come out on PL pins, and the XDC places them.'),
      q('What does moving the resistor from R2584 to R2577 change?', ['The boot source, from NAND to the SD card', 'The supply voltage', 'The UART speed', 'The FCLK_CLK0 frequency'], 0, 'These resistors tell the BootROM which boot mode to use.'),
    ],
  },
  'z-blink': {
    fa: [
      q('چرا در XDC این درس <code>create_clock</code> روی یک پایه نیست؟', ['کلاک FCLK_CLK0 از داخل تراشه (PS) می‌آید', 'چون طرح کلاک ندارد', 'چون Vivado کلاک را حدس می‌زند', 'چون LEDها کلاک لازم ندارند'], 0, 'کلاک از PS می‌آید و Vivado محدودیت آن را از تنظیمات PS می‌داند.'),
      q('FCLK_CLK0 چیست؟', ['یکی از چهار کلاکی که PS به PL می‌دهد', 'نوسان‌ساز روی X5', 'کلاک UART', 'کلاک DDR'], 0, 'PS تا چهار کلاک FCLK_CLK0..3 به PL می‌دهد.'),
      q('اگر DIV برابر ۵۰٬۰۰۰٬۰۰۰ باشد، هر LED چند وقت یک بار عوض می‌شود؟', ['هر ۱ ثانیه', 'هر ۰٫۵ ثانیه', 'هر ۲ ثانیه', 'هر ۱۰ میلی‌ثانیه'], 0, '۵۰ میلیون کلاک در ۵۰ مگاهرتز یعنی یک ثانیه.'),
    ],
    en: [
      q('Why is there no <code>create_clock</code> on a pin in this lesson\u2019s XDC?', ['FCLK_CLK0 comes from inside the chip (the PS)', 'The design has no clock', 'Vivado guesses the clock', 'LEDs need no clock'], 0, 'The clock comes from the PS, and Vivado knows its constraint from the PS settings.'),
      q('What is FCLK_CLK0?', ['One of the four clocks the PS gives the PL', 'The oscillator at X5', 'The UART clock', 'The DDR clock'], 0, 'The PS gives the PL up to four clocks, FCLK_CLK0..3.'),
      q('With DIV = 50,000,000, how often does each LED change?', ['Every 1 second', 'Every 0.5 seconds', 'Every 2 seconds', 'Every 10 ms'], 0, '50 million clocks at 50 MHz is one second.'),
    ],
  },
  'z-bootflow': {
    fa: [
      q('FSBL چه کاری می‌کند که BootROM نمی‌تواند؟', ['DDR را راه می‌اندازد و PL را پیکربندی می‌کند', 'مقاومت‌های بوت را می‌خواند', 'خود را در OCM کپی می‌کند', 'برنامه را کامپایل می‌کند'], 0, 'BootROM ثابت است و تنظیمات برد را نمی‌داند؛ FSBL کد ps7_init را دارد.'),
      q('ترتیب درست داخل BOOT.bin کدام است؟', ['FSBL، bitstream، برنامه', 'bitstream، FSBL، برنامه', 'برنامه، FSBL، bitstream', 'FSBL، برنامه، bitstream'], 0, 'BootROM اول باید FSBL را پیدا کند؛ FSBL بعد PL و برنامه را بار می‌کند.'),
      q('چرا کارت SD باید FAT باشد؟', ['BootROM فقط FAT را می‌خواند', 'چون لینوکس فقط FAT دارد', 'چون FAT سریع‌تر است', 'چون Vitis فقط FAT می‌سازد'], 0, 'BootROM فایل BOOT.bin را در پارتیشن FAT جست‌وجو می‌کند.'),
    ],
    en: [
      q('What does the FSBL do that the BootROM cannot?', ['Start the DDR and configure the PL', 'Read the boot straps', 'Copy itself into OCM', 'Compile the application'], 0, 'The BootROM is fixed and knows nothing of the board; the FSBL has the ps7_init code.'),
      q('What is the order inside BOOT.bin?', ['FSBL, bitstream, application', 'Bitstream, FSBL, application', 'Application, FSBL, bitstream', 'FSBL, application, bitstream'], 0, 'The BootROM must find the FSBL first; the FSBL then loads the PL and the application.'),
      q('Why must the SD card be FAT?', ['The BootROM only reads FAT', 'Linux only has FAT', 'FAT is faster', 'Vitis only writes FAT'], 0, 'The BootROM looks for BOOT.bin on a FAT partition.'),
    ],
  },
  'z-ps-hello': {
    fa: [
      q('UART1 این برد روی کدام پایه‌ها است؟', ['MIO 24 و 25', 'MIO 40 تا 45', 'W13 و W14', 'H16 و H17'], 0, 'UART1 روی MIO 24 (TX) و 25 (RX) و هدر J7 است.'),
      q('چرا فایل <code>.xsa</code> باید bitstream را هم داشته باشد؟', ['Create Boot Image آن را در BOOT.bin می‌گذارد', 'چون FSBL بدون آن ساخته نمی‌شود', 'چون UART در PL است', 'لازم نیست'], 0, 'Vitis bitstream را از xsa برمی‌دارد و کنار FSBL در BOOT.bin می‌گذارد.'),
      q('شماره‌ی GPIO اولین پایه‌ی EMIO چیست؟', ['۵۴', '۰', '۳۲', '۶۴'], 0, '۵۴ پایه‌ی اول MIO هستند، پس EMIO از ۵۴ شروع می‌شود.'),
    ],
    en: [
      q('Which pins does this board\u2019s UART1 use?', ['MIO 24 and 25', 'MIO 40 to 45', 'W13 and W14', 'H16 and H17'], 0, 'UART1 is on MIO 24 (TX) and 25 (RX), header J7.'),
      q('Why must the <code>.xsa</code> include the bitstream?', ['Create Boot Image puts it into BOOT.bin', 'The FSBL cannot be built without it', 'The UART is in the PL', 'It need not'], 0, 'Vitis takes the bitstream from the xsa and puts it next to the FSBL in BOOT.bin.'),
      q('What GPIO number does the first EMIO pin have?', ['54', '0', '32', '64'], 0, 'The first 54 are MIO pins, so EMIO starts at 54.'),
    ],
  },
  'z-ethernet': {
    fa: [
      q('چرا GEM0 روی این برد نمی‌تواند از MIO استفاده کند؟', ['PHY به پایه‌های PL وصل است', 'MIO برای شبکه سرعت ندارد', 'GEM0 در PL است', 'MIO فقط برای UART است'], 0, 'سیم‌کشی برد PHY را به پایه‌های PL برده، پس مسیر EMIO لازم است.'),
      q('بدون xlconcat چه می‌شود؟', ['RXD هشت بیتی پر نمی‌شود و ساخت متوقف می‌شود', 'شبکه دو برابر سریع می‌شود', 'هیچ اتفاقی نمی‌افتد', 'UART از کار می‌افتد'], 0, 'PHY فقط چهار بیت می‌دهد؛ بیت‌های بالا باید صفر شوند.'),
      q('سرور اکوی lwIP روی کدام پورت است؟', ['۷', '۲۲', '۸۰', '۲۳'], 0, 'پروتکل Echo پورت ۷ را دارد؛ با telnet به همین پورت وصل شوید.'),
    ],
    en: [
      q('Why can GEM0 not use MIO on this board?', ['The PHY is wired to PL pins', 'MIO is too slow for Ethernet', 'GEM0 is in the PL', 'MIO is only for the UART'], 0, 'The board routes the PHY to PL pins, so the EMIO path is needed.'),
      q('What happens without the xlconcat?', ['The 8-bit RXD is not filled and the build stops', 'The network gets twice as fast', 'Nothing', 'The UART stops'], 0, 'The PHY gives only four bits; the upper bits must be zero.'),
      q('Which port does the lwIP echo server use?', ['7', '22', '80', '23'], 0, 'The Echo protocol is on port 7; telnet to that port.'),
    ],
  },
};
