// Chapters "Extension board" and "HDMI" (docs/EBAZ4205-ROADMAP.md, Phases E3 and E4): seven lessons for the
// extension board that sits on the EBAZ4205's DATA headers, shown only on that board. Every lesson runs in the
// simulator and has a checker (src/grade/ext.ts). Every pin comes from the vendor's adapter-board schematic and
// example projects (docs/ebaz4205/CONTENT.md section 5.1). Persian lessons, English text, goals, quiz, levels and prerequisites live here and are merged
// into the course tables by course.ts, like zynq.ts.
import * as X from '../boards/ebaz4205/extcode';
import { LCD } from '../boards/ebaz4205/pins';
import { EXT_EXERCISES } from '../grade/ext';
import type { LessonText } from './en';
import type { Level } from './goals';
import { part, term, truth } from './helpers';
import type { Lesson } from './lessons';
import type { Question } from './predict';
import { sourcesBox } from './zynq';

type Goals = { objectives: string[]; takeaways: string[] };
const q = (text: string, options: string[], answer: number, why: string): Question => ({ q: text, options, answer, why });

const ex = (id: string) => EXT_EXERCISES[id];
const lcdPin = (name: string) => LCD.find(([n]) => n === name)![1];

// ---------------------------------------------------------------- Persian lessons
export const EXT_LESSONS: Lesson[] = [
  {
    id: 'x-leds',
    title: 'برد توسعه: سه LED و چراغ رونده',
    summary: 'برد توسعه را بشناسید و LED1 تا LED3 را یکی‌یکی روشن کنید.',
    body: `
<p>برد توسعه روی سه هدر ${part('DATA1')} تا ${part('DATA3')} برد EBAZ4205 می‌نشیند و چیزهایی را که برد اصلی ندارد اضافه می‌کند: سه LED، پنج کلید، یک بازر، درگاه سریال USB-C، نمایشگر رنگی ۱.۳ اینچی و سوکت HDMI. هر کدام از این‌ها به یکی از پایه‌های PL وصل است، پس با همان Verilog و VHDL که تا اینجا نوشتید کار می‌کنند.</p>
<h3>۱. چه چیزی روی کدام پایه است</h3>
${truth(
  ['بخش', 'پایه‌ها', 'نکته'],
  [
    [`${part('LED1')}، ${part('LED2')}، ${part('LED3')}`, 'E19، K17، H18', '۱ = روشن'],
    [`${part('USB_C')} (سریال CH340C)`, 'RX ‏H16، TX ‏H17', 'همین دو خط روی هدر ۴ پایه‌ی UART_USB_TTL هم هست'],
    [part('HDMI'), 'F19/F20، D19/D20، C20/B20، B19/A20', 'TMDS مستقیم از FPGA'],
    [`${part('KEY1')} تا ${part('KEY5')}`, 'T19، P19، U20، U19، V20', 'فعال‌پایین (فشرده = ۰)'],
    [part('BUZZER'), 'D18', 'پسیو، با ترانزیستور (۱ = جریان)'],
    [part('LCD'), 'SCL ‏R19، SDA ‏P20، DC ‏R18، RES ‏N17، BLK ‏T20', 'CS روی برد به زمین وصل است'],
  ],
)}
<p>در شبیه‌ساز می‌توانید برد توسعه را با گزینه‌ی «برد توسعه» بالای برد سه‌بعدی جدا کنید یا دوباره بگذارید. بدون آن فقط دو LED برد اصلی می‌مانند.</p>
<h3>۲. چراغ رونده</h3>
<p>کد درس یک شمارنده دارد که هر <code>DIV</code> کلاک (۰.۲۵ ثانیه در ۵۰ مگاهرتز) یک بار سر می‌رسد. آن وقت سه بیت <code>EXT_LED</code> یک خانه به چپ می‌چرخند: بیتی که از بالا بیرون می‌رود از پایین برمی‌گردد. با مقدار اولیه‌ی <code>001</code> همیشه دقیقاً یک LED روشن است.</p>
<pre dir="ltr"><code>EXT_LED &lt;= {EXT_LED[1:0], EXT_LED[2]};   // 001 → 010 → 100 → 001</code></pre>
<h3>۳. XDC</h3>
<p>گروه <code>ext_led</code> در XDC اصلی سه خط <code>PACKAGE_PIN</code> با <code>LVCMOS33</code> دارد. نام پورت باید دقیقاً <code>EXT_LED[0]</code> تا <code>EXT_LED[2]</code> باشد. کلاک مثل درس قبل FCLK_CLK0 از PS است و پایه ندارد.</p>
${sourcesBox('fa', 'extsch', 'xjtuecho')}`,
    verilog: X.X_LEDS_V,
    vhdl: X.X_LEDS_VHD,
    xdc: { ext_led: true },
    tryIt: `<p><span class="kbd">▶ Run</span> را بزنید: ${part('LED1')}، ${part('LED2')} و ${part('LED3')} به نوبت روشن می‌شوند. روی هر LED در مدل سه‌بعدی بروید تا نام و پایه‌اش را ببینید.</p>`,
    exercise: ex('x-leds').fa,
  },
  {
    id: 'x-keys',
    title: 'کلیدهای برد توسعه: همگام‌سازی، حذف لرزش و لبه',
    summary: 'هر بار KEY1 را فشار دهید LED1 یک بار عوض شود، نه بیشتر.',
    body: `
<p>${part('KEY1')} تا ${part('KEY5')} پنج کلید فشاری‌اند. هر کلید با یک مقاومت ${term('pull-up', 'pull-up')} به ۳.۳ ولت وصل است و فشار دادن آن پایه را به زمین می‌برد. پس این کلیدها <b>فعال‌پایین</b>اند: رها = ۱، فشرده = ۰. در کد اولین کار برعکس کردن همین است.</p>
<h3>۱. سه مرحله بین کلید و LED</h3>
<ol>
  <li><b>همگام‌سازی:</b> فشار دادن کلید به کلاک ربطی ندارد. دو فلیپ‌فلاپ پشت سر هم (${term('synchronizer', 'synchronizer')}) خطر ${term('metastability', 'ناپایداری')} را از بین می‌برند.</li>
  <li><b>حذف لرزش (${term('debounce', 'debounce')}):</b> کنتاکت فلزی چند میلی‌ثانیه بین ۰ و ۱ می‌لرزد. مقدار جدید فقط وقتی پذیرفته می‌شود که <code>DB</code> کلاک (۱۰ میلی‌ثانیه، یعنی ۵۰۰٬۰۰۰ کلاک) ثابت بماند.</li>
  <li><b>تشخیص لبه:</b> مقدار تمیز را یک کلاک عقب نگه می‌داریم. <code>pressed &amp; ~prev</code> فقط در کلاکی که کلید پایین رفت یک است.</li>
</ol>
<pre dir="ltr"><code>wire raw   = ~sync[1];          // active low
wire press = pressed &amp; ~prev;   // one clock per press</code></pre>
<h3>۲. چرا لبه؟</h3>
<p>اگر LED را با خود <code>pressed</code> عوض کنید، در هر کلاکی که کلید پایین است یک بار عوض می‌شود، یعنی میلیون‌ها بار در ثانیه، و نتیجه تصادفی است. پالس یک‌کلاکی تضمین می‌کند هر فشار دقیقاً یک تغییر بدهد.</p>
<p class="note">💡 در شبیه‌ساز کلیدها را با موس، لمس یا صفحه‌کلید (Tab و بعد Space) فشار دهید. گزینه‌ی «لرزش دکمه‌ها» در بالای برد لرزش واقعی را شبیه‌سازی می‌کند؛ آن را روشن کنید و یک بار <code>DB</code> را کوچک کنید تا ببینید debounce چه کار می‌کند.</p>
${sourcesBox('fa', 'extsch', 'xjtuecho')}`,
    verilog: X.X_KEYS_V,
    vhdl: X.X_KEYS_VHD,
    xdc: { key: true, ext_led: true },
    tryIt: `<p><span class="kbd">▶ Run</span> را بزنید و ${part('KEY1')} را چند بار فشار دهید: ${part('LED1')} با هر فشار یک بار روشن یا خاموش می‌شود، حتی وقتی «لرزش دکمه‌ها» روشن است.</p>`,
    exercise: ex('x-keys').fa,
    la: {
      chans: [
        { name: 'KEY1', probe: 'pin:T19' },
        { name: 'LED1', probe: 'pin:E19' },
      ],
      decs: [],
      base: 5e-3,
      pos: 4,
      trig: { ch: 0, edge: 'fall' },
    },
  },
  {
    id: 'x-uart',
    title: 'درگاه سریال USB-C: اکو و فرمان',
    summary: 'هر حرفی که در ترمینال تایپ کنید برگردد، و 1 تا 3 LEDها را عوض کنند.',
    body: `
<p>روی برد توسعه یک تراشه‌ی CH340C هست که USB را به ${term('uart', 'UART')} تبدیل می‌کند. با یک کابل ${part('USB_C')} برد در کامپیوتر یک درگاه COM (یا <code>/dev/ttyUSB0</code>) می‌شود. خط RX مبدل (از کامپیوتر به FPGA) روی H16 است و TX روی H17. این درگاه با UART1 روی ${part('J7')} فرق دارد: آن مال PS است و این یکی مستقیم به PL شما وصل است.</p>
<h3>۱. سرعت در ۵۰ مگاهرتز</h3>
<p>گیرنده و فرستنده همان ماژول‌های <code>uart_rx</code> و <code>uart_tx</code> درس‌های UART برد Nexys‌اند. فقط کلاک فرق دارد: ۵۰٬۰۰۰٬۰۰۰ ÷ ۱۱۵٬۲۰۰ ≈ <b>۴۳۴</b> کلاک برای هر بیت (در Nexys ‏۸۶۸ بود).</p>
<h3>۲. اکو با یک بایت انتظار</h3>
<p>وقتی بایتی کامل رسید (<code>rx_done</code>)، در <code>hold</code> می‌ماند و <code>pend</code> یک می‌شود. فرستنده هر وقت آزاد شد (<code>!busy</code>) آن را می‌فرستد. چون فرستادن یک بایت درست به اندازه‌ی رسیدن یک بایت طول می‌کشد، یک بایت جا کافی است.</p>
<pre dir="ltr"><code>wire start = pend &amp;&amp; !busy;
uart_tx tx_unit (.clk(clk), .start(start), .data(hold), .tx(UART_TX), .busy(busy));</code></pre>
<h3>۳. فرمان‌ها</h3>
<p>یک <code>case</code> روی کد اسکی بایت رسیده: <code>8'h31</code> ('1') ${part('LED1')} را عوض می‌کند، <code>8'h32</code> ${part('LED2')} و <code>8'h33</code> ${part('LED3')}. بقیه‌ی بایت‌ها فقط برمی‌گردند.</p>
<p class="note">💡 روی برد واقعی هر ترمینالی کار می‌کند (PuTTY، Tera Term، <code>screen /dev/ttyUSB0 115200</code>) با تنظیم 115200 8N1 و بدون کنترل جریان.</p>
${sourcesBox('fa', 'extsch', 'xjtuecho')}`,
    verilog: X.X_UART_V,
    vhdl: X.X_UART_VHD,
    xdc: { ext_uart: true, ext_led: true },
    tryIt: `<p><span class="kbd">▶ Run</span> را بزنید و <span class="kbd">Serial Console</span> را باز کنید. هر چه تایپ کنید برمی‌گردد؛ با <b>1</b>، <b>2</b> و <b>3</b> ${part('LED1')} تا ${part('LED3')} روشن و خاموش می‌شوند. در تحلیلگر منطقی دو خط RX و TX را با رمزگشای UART ببینید.</p>`,
    exercise: ex('x-uart').fa,
    la: {
      chans: [
        { name: 'RX in', probe: 'pin:H16' },
        { name: 'TX out', probe: 'pin:H17' },
      ],
      decs: [
        { type: 'uart', name: 'PC→FPGA', ch: 0, baud: 115200, bits: 8, parity: 'none', stop: 1 },
        { type: 'uart', name: 'FPGA→PC', ch: 1, baud: 115200, bits: 8, parity: 'none', stop: 1 },
      ],
      base: 5e-5,
      pos: 4,
      trig: { ch: 0, edge: 'fall' },
    },
  },
  {
    id: 'x-buzzer',
    title: 'بازر: موج مربعی و یک گام موسیقی',
    summary: 'با یک شمارنده هر فرکانسی بسازید و گام دو ماژور را بنوازید.',
    body: `
<p>${part('BUZZER')} یک ${term('passive-buzzer', 'بازر پسیو')} است: نوسان‌ساز ندارد و همان فرکانسی را پخش می‌کند که به پایه‌اش بدهید. یک ترانزیستور آن را می‌راند، پس ۱ روی پایه یعنی جریان در بازر.</p>
<h3>۱. موج مربعی با شمارنده</h3>
<p>برای نت با فرکانس f، پایه باید هر نیم‌پریود عوض شود: <code>CLK_HZ / (2 × f)</code> کلاک. برای لا (۴۴۰ هرتز) در ۵۰ مگاهرتز می‌شود ۵۶٬۸۱۸ کلاک. شمارنده‌ی <code>pcnt</code> تا این عدد می‌شمارد، صفر می‌شود و <code>BUZZER</code> را برعکس می‌کند.</p>
${truth(
  ['نت', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
  [
    ['هرتز', 262, 294, 330, 349, 392, 440, 494, 523],
    ['نیم‌پریود (کلاک)', '95,420', '85,034', '75,757', '71,633', '63,775', '56,818', '50,607', '47,801'],
  ],
)}
<h3>۲. نت به نت</h3>
<p>شمارنده‌ی دوم، <code>ncnt</code>، طول هر نت را می‌شمارد (<code>NOTE_TICKS</code>، ۰.۲۵ ثانیه). بعد <code>step</code> یکی جلو می‌رود: ۰ تا ۷ بالا و ۶ تا ۱ پایین، چهارده قدم و دوباره از اول. جدول نیم‌پریودها از <code>CLK_HZ</code> حساب می‌شود، پس با عوض کردن یک پارامتر کد برای کلاک دیگر هم درست است.</p>
<p>تا وقتی ${part('KEY1')} فشرده است (۰ روی پایه) بازر ساکت می‌ماند.</p>
<p class="note">💡 در شبیه‌ساز دکمه‌ی <span class="kbd">Buzzer sound</span> در نوار ابزار صدا را از بلندگوی کامپیوتر پخش می‌کند. فرکانسی که می‌شنوید همان است که طرح شما روی پایه می‌سازد.</p>
${sourcesBox('fa', 'extsch', 'xjtuecho')}`,
    verilog: X.X_BUZZER_V,
    vhdl: X.X_BUZZER_VHD,
    xdc: { key: true, buzzer: true },
    tryIt: `<p><span class="kbd">▶ Run</span> را بزنید و <span class="kbd">Buzzer sound</span> را روشن کنید: گام بالا و پایین می‌رود و بازر در مدل سه‌بعدی با هر نت می‌لرزد. ${part('KEY1')} را نگه دارید تا ساکت شود.</p>`,
    exercise: ex('x-buzzer').fa,
    la: {
      chans: [
        { name: 'BUZZER', probe: 'pin:D18' },
        { name: 'KEY1', probe: 'pin:T19' },
      ],
      decs: [],
      base: 2e-3,
      pos: 4,
      trig: { ch: 0, edge: 'rise' },
    },
  },
  {
    id: 'x-lcd',
    title: 'نمایشگر رنگی LCD: راه‌اندازی ST7789 با SPI',
    summary: 'نمایشگر ۲۴۰×۲۴۰ را بیدار کنید و هشت نوار رنگی بکشید.',
    body: `
<p>${part('LCD')} یک نمایشگر IPS ‏۱.۳ اینچی با ۲۴۰×۲۴۰ پیکسل و کنترلر ${term('st7789', 'ST7789')} است. FPGA با ${term('spi', 'SPI')} یک‌طرفه با آن حرف می‌زند: SCL کلاک و SDA داده، و یک پایه‌ی اضافه به نام <b>DC</b> که می‌گوید بایت فرمان است (۰) یا داده (۱). RES ریست است و BLK نور پس‌زمینه را با یک ترانزیستور روشن می‌کند. پایه‌ی CS نمایشگر روی برد به زمین وصل است، پس نمایشگر همیشه انتخاب‌شده است و FPGA پایه‌ای برای آن ندارد.</p>
<h3>۱. ترتیب راه‌اندازی</h3>
${truth(
  ['قدم', 'بایت', 'کار'],
  [
    ['RES = 0', '-', '۱۰ میلی‌ثانیه ریست سخت‌افزاری، بعد ۱۲۰ میلی‌ثانیه صبر'],
    ['SWRESET', '01', 'ریست نرم‌افزاری، ۱۵۰ میلی‌ثانیه صبر'],
    ['SLPOUT', '11', 'بیرون آمدن از خواب، ۱۲۰ میلی‌ثانیه صبر'],
    ['COLMOD', '3A 55', `${term('rgb565', 'RGB565')}: ۱۶ بیت برای هر پیکسل`],
    ['MADCTL', '36 00', 'ترتیب حافظه: چپ به راست، بالا به پایین'],
    ['INVON', '21', 'پنل‌های IPS بدون آن رنگ‌ها را برعکس نشان می‌دهند'],
    ['CASET / RASET', '2A … / 2B …', 'پنجره‌ی نوشتن: ستون و ردیف ۰ تا ۲۳۹'],
    ['DISPON', '29', 'روشن کردن نمایشگر'],
    ['RAMWR', '2C', 'بعد از آن ۲۴۰×۲۴۰×۲ بایت پیکسل'],
  ],
)}
<p>کد این جدول را در یک ROM کوچک نگه می‌دارد. هر خط دو بیت «نوع» (فرمان، داده، صبر، پایان) و هشت بیت مقدار دارد. یک ماشین حالت خط به خط جلو می‌رود.</p>
<h3>۲. یک بایت روی SPI</h3>
<p>در حالت ۰، نمایشگر هر بیت را در لبه‌ی بالارونده‌ی SCL می‌خواند. پس حالت <code>SEND</code> اول SDA را می‌گذارد، بعد SCL را بالا و دوباره پایین می‌برد و بیت بعدی را می‌گذارد. هر بیت دو کلاک طول می‌کشد، پس SCL ‏۲۵ مگاهرتز است. بیت پرارزش اول می‌رود و DC همراه بیت آخر خوانده می‌شود.</p>
<h3>۳. پیکسل‌ها</h3>
<p>بعد از RAMWR هر پیکسل دو بایت است، اول بایت بالا. شمارنده‌های <code>x</code> و <code>y</code> جای پیکسل را نگه می‌دارند و <code>stripe</code> هر ۳۰ ستون یکی جلو می‌رود و رنگ را از جدول انتخاب می‌کند. کل تصویر ۱۱۵٬۲۰۰ بایت است و در ۲۵ مگاهرتز حدود ۳۷ میلی‌ثانیه طول می‌کشد.</p>
<p class="note">💡 مدل نمایشگر در شبیه‌ساز ترتیب فرمان‌ها را بررسی می‌کند. اگر مثلاً SLPOUT را جا بیندازید یا زود پیکسل بفرستید، در کنسول یک پیام خوانا می‌بینید و صفحه تاریک یا با رنگ اشتباه می‌ماند، درست مثل نمایشگر واقعی.</p>
${sourcesBox('fa', 'st7789', 'extsch', 'vendorlcd')}`,
    verilog: X.X_LCD_V,
    vhdl: X.X_LCD_VHD,
    xdc: { lcd: true },
    tryIt: `<p><span class="kbd">▶ Run</span> را بزنید: بعد از حدود ۰.۳ ثانیه‌ی شبیه‌سازی‌شده (ریست و انتظارها) هشت نوار رنگی روی ${part('LCD')} پر می‌شوند. برای امتحان، خط INVON را از ROM بردارید و دوباره اجرا کنید.</p>`,
    exercise: ex('x-lcd').fa,
    la: {
      chans: [
        { name: 'SCL', probe: `pin:${lcdPin('LCD_SCL')}` },
        { name: 'SDA', probe: `pin:${lcdPin('LCD_SDA')}` },
        { name: 'DC', probe: `pin:${lcdPin('LCD_DC')}` },
        { name: 'RES', probe: `pin:${lcdPin('LCD_RES')}` },
      ],
      decs: [{ type: 'spi', name: 'SPI', clk: 0, mosi: 1, miso: null, cs: null, mode: 0, bits: 8, msbFirst: true }],
      base: 2e-7,
      pos: 4,
      trig: { ch: 0, edge: 'rise' },
    },
  },
  {
    id: 'x-hdmi-tmds',
    title: 'HDMI از درون: رمزگذاری TMDS',
    summary: 'هر بایت رنگ چطور به یک نماد ۱۰ بیتی متعادل تبدیل می‌شود، و یک testbench که آن را برمی‌گرداند.',
    body: `
<p>HDMI (و DVI که HDMI بر پایه‌ی آن است) همان زمان‌بندی VGA را دارد، اما رنگ‌ها را آنالوگ نمی‌فرستد. سه زوج سیم داده (آبی، سبز، قرمز) و یک زوج کلاک دارد و هر زوج یک ${term('differential', 'زوج تفاضلی')} است. روش ارسال ${term('tmds', 'TMDS')} نام دارد: هر بایت ۸ بیتی به یک <b>نماد ۱۰ بیتی</b> تبدیل می‌شود.</p>
<h3>۱. مرحله‌ی ۱: تغییرات کم</h3>
<p>بیت اول همان می‌ماند. هر بیت بعدی با بیت قبلی نماد XOR یا XNOR می‌شود. اگر بایت بیش از چهار یک داشته باشد (یا دقیقاً چهار و بیت ۰ صفر باشد) XNOR انتخاب می‌شود، چون تغییرات کمتری می‌دهد. بیت ۸ می‌گوید کدام استفاده شد (۱ = XOR).</p>
<h3>۲. مرحله‌ی ۲: ${term('dc-balance', 'تعادل DC')}</h3>
<p>رمزگذار حساب می‌کند تا حالا چند یک بیشتر از صفر فرستاده (<code>cnt</code>). اگر بایت جدید این اختلاف را بیشتر کند، هشت بیت پایین را برعکس می‌فرستد و بیت ۹ را یک می‌کند. این‌طوری اختلاف همیشه نزدیک صفر می‌ماند.</p>
<h3>۳. نمادهای کنترلی</h3>
<p>در زمان خاموشی (<code>de = 0</code>) به جای رنگ یکی از چهار نماد ویژه می‌رود. روی کانال ۰ (آبی) دو بیت کنترلی همان HSYNC و VSYNC‌اند؛ این‌طوری همگام‌سازی VGA به HDMI می‌رسد.</p>
${truth(
  ['C1 C0', 'نماد'],
  [
    ['00', '<code>1101010100</code>'],
    ['01', '<code>0010101011</code>'],
    ['10', '<code>0101010100</code>'],
    ['11', '<code>1010101011</code>'],
  ],
)}
<h3>۴. Testbench گیرنده</h3>
<p>Testbench این درس نقش گیرنده را بازی می‌کند: بیت ۹ را برمی‌گرداند، زنجیره‌ی XOR را باز می‌کند و بایت به دست آمده را با بایت ورودی مقایسه می‌کند. هر ۲۵۶ مقدار دو بار امتحان می‌شود. طرح کوچک کنار رمزگذار هر نیم ثانیه یک بایت جدید می‌دهد و تصمیم‌های رمزگذار را روی ${part('LED1')} تا ${part('LED3')} نشان می‌دهد.</p>
${sourcesBox('fa', 'dvi')}`,
    verilog: X.X_TMDS_V,
    vhdl: X.X_TMDS_VHD,
    xdc: { ext_led: true },
    tb: { verilog: X.X_TMDS_TB_V, vhdl: X.X_TMDS_TB_VHD },
    tryIt: `<p><span class="kbd">▶ Simulate</span> را بزنید: testbench چهار نماد کنترلی و ۵۱۲ نماد ویدیویی را رمزگشایی می‌کند و در کنسول <code>PASS</code> می‌بینید. با <span class="kbd">▶ Run</span> ${part('LED1')} نشان می‌دهد XOR استفاده شد، ${part('LED2')} برعکس شدن بایت و ${part('LED3')} نماد کنترلی.</p>`,
    exercise: ex('x-hdmi-tmds').fa,
  },
  {
    id: 'x-hdmi-bars',
    title: 'HDMI: نوارهای رنگی ۶۴۰×۴۸۰',
    summary: 'زمان‌بندی VGA، سه رمزگذار TMDS و یک سریال‌کننده: اولین تصویر روی مانیتور HDMI.',
    body: `
<p>حالا همه‌ی تکه‌ها را کنار هم می‌گذاریم: زمان‌بندی ۶۴۰×۴۸۰ در ۶۰ هرتز از درس VGA، سه ${term('tmds', 'رمزگذار TMDS')} از درس قبل، و یک سریال‌کننده که نمادها را با سرعت بالا روی ${part('HDMI')} می‌فرستد.</p>
<h3>۱. کلاک پیکسل</h3>
<p>این حالت ۲۵ مگاهرتز می‌خواهد (استاندارد ۲۵.۱۷۵ است، اما تقریباً همه‌ی مانیتورها ۲۵ را قبول می‌کنند). کلاک ما ۵۰ مگاهرتز است، پس سیگنال <code>pe</code> هر دو کلاک یک بار یک است و شمارنده‌ها و رمزگذارها فقط آن وقت جلو می‌روند (همان ${term('clock-enable', 'clock enable')}).</p>
<h3>۲. سه کانال</h3>
<pre dir="ltr"><code>tmds_encoder enc_b (.clk(clk), .ce(pe), .d(rgb[7:0]),   .c({vs, hs}), .de(de), .q(s0));
tmds_encoder enc_g (.clk(clk), .ce(pe), .d(rgb[15:8]),  .c(2'b00),    .de(de), .q(s1));
tmds_encoder enc_r (.clk(clk), .ce(pe), .d(rgb[23:16]), .c(2'b00),    .de(de), .q(s2));</code></pre>
<p>رنگ هر کانال ۸ بیت است، پس برخلاف VGA برد Nexys (۴ بیت) ۱۶ میلیون رنگ دارید.</p>
<h3>۳. سریال‌کننده</h3>
<p>هر نماد ۱۰ بیت است، پس هر زوج ۲۵۰ مگابیت بر ثانیه دارد. منطق معمولی FPGA به این سرعت نمی‌رسد؛ کنار هر پایه‌ی خروجی یک ${term('oserdes', 'OSERDESE2')} هست که همین کار را می‌کند. ماژول <code>tmds_serializer</code> را FPGA Lab می‌دهد:</p>
<ul>
  <li>یک ${term('mmcm-pll', 'MMCM')} از ۵۰ مگاهرتز دو کلاک می‌سازد: ۲۵ مگاهرتز برای پیکسل و ۱۲۵ مگاهرتز برای سریال (DDR: دو بیت در هر کلاک، ۵ کلاک برای ۱۰ بیت).</li>
  <li>برای هر کانال دو OSERDESE2 (master و slave، چون یکی فقط ۸ بیت می‌گیرد) و یک <code>OBUFDS</code> که زوج P و N را با استاندارد <code>TMDS_33</code> می‌راند.</li>
  <li>کانال کلاک همیشه <code>0000011111</code> می‌فرستد: یک موج ۲۵ مگاهرتزی.</li>
</ul>
<p>در شبیه‌ساز به جای آن یک مدل ساده هست که نمادها را مستقیم به مانیتور HDMI شبیه‌ساز می‌دهد. مانیتور آن‌ها را مثل یک گیرنده‌ی واقعی رمزگشایی می‌کند: اگر نماد خراب باشد «No signal» یا رنگ اشتباه می‌بینید. در پروژه‌ی Vivado نسخه‌ی واقعی به نام <code>src/tmds_serializer.v</code> خودکار اضافه می‌شود.</p>
<p class="note">💡 این طرح فقط سیگنال DVI می‌فرستد (بدون صدا و بسته‌های داده‌ی HDMI). مانیتورها و تلویزیون‌های HDMI آن را نشان می‌دهند. اگر تلویزیون تصویر نداد، ورودی را روی «PC» یا «DVI» بگذارید.</p>
${sourcesBox('fa', 'dvi', 'extsch')}`,
    verilog: X.X_BARS_V,
    vhdl: X.X_BARS_VHD,
    xdc: { hdmi: true },
    tryIt: `<p><span class="kbd">▶ Run</span> را بزنید و <span class="kbd">HDMI Monitor</span> را باز کنید. مانیتور روی ۶۴۰×۴۸۰ قفل می‌شود و هشت نوار سفید، زرد، فیروزه‌ای، سبز، سرخابی، قرمز، آبی و سیاه را نشان می‌دهد.</p>`,
    exercise: ex('x-hdmi-bars').fa,
    time: { read: 15, practice: 25 },
  },
];

// ---------------------------------------------------------------- English
export const EXT_EN: Record<string, LessonText> = {
  'x-leds': {
    title: 'Extension board: three LEDs and a running light',
    summary: 'Meet the extension board and light LED1 to LED3 one after another.',
    body: `
<p>The extension board sits on the EBAZ4205's three headers ${part('DATA1')} to ${part('DATA3')} and adds what the core board lacks: three LEDs, five keys, a buzzer, a USB-C serial port, a 1.3-inch colour display and an HDMI socket. Each of them is wired to a PL pin, so they work with the same Verilog and VHDL you have written so far.</p>
<h3>1. What is on which pin</h3>
${truth(
  ['Part', 'Pins', 'Note'],
  [
    [`${part('LED1')}, ${part('LED2')}, ${part('LED3')}`, 'E19, K17, H18', '1 = on'],
    [`${part('USB_C')} (CH340C serial)`, 'RX H16, TX H17', 'the same two lines are on the 4-pin header UART_USB_TTL'],
    [part('HDMI'), 'F19/F20, D19/D20, C20/B20, B19/A20', 'TMDS straight from the FPGA'],
    [`${part('KEY1')} to ${part('KEY5')}`, 'T19, P19, U20, U19, V20', 'active low (pressed = 0)'],
    [part('BUZZER'), 'D18', 'passive, through a transistor (1 = current)'],
    [part('LCD'), 'SCL R19, SDA P20, DC R18, RES N17, BLK T20', 'CS is tied to ground on the board'],
  ],
)}
<p>In the simulator you can take the extension board off, or put it back, with the "Extension board" box above the 3D board. Without it only the core board's two LEDs remain.</p>
<h3>2. A running light</h3>
<p>The lesson code has a counter that comes round every <code>DIV</code> clocks (0.25 s at 50 MHz). Then the three bits of <code>EXT_LED</code> rotate left by one: the bit that falls off the top comes back at the bottom. Starting from <code>001</code>, exactly one LED is always on.</p>
<pre dir="ltr"><code>EXT_LED &lt;= {EXT_LED[1:0], EXT_LED[2]};   // 001 → 010 → 100 → 001</code></pre>
<h3>3. The XDC</h3>
<p>The <code>ext_led</code> group of the master XDC has three <code>PACKAGE_PIN</code> lines with <code>LVCMOS33</code>. The port must be called exactly <code>EXT_LED[0]</code> to <code>EXT_LED[2]</code>. As in the last lesson the clock is FCLK_CLK0 from the PS and has no pin.</p>
${sourcesBox('en', 'extsch', 'xjtuecho')}`,
    tryIt: `<p>Press <span class="kbd">▶ Run</span>: ${part('LED1')}, ${part('LED2')} and ${part('LED3')} light in turn. Hover an LED on the 3D board to see its name and pin.</p>`,
    exercise: ex('x-leds').en,
  },
  'x-keys': {
    title: 'The extension board keys: sync, debounce and edge',
    summary: 'Each press of KEY1 toggles LED1 once, never more.',
    body: `
<p>${part('KEY1')} to ${part('KEY5')} are five push buttons. Each has a ${term('pull-up', 'pull-up')} resistor to 3.3 V, and pressing it pulls the pin to ground. So these keys are <b>active low</b>: released = 1, pressed = 0. The first thing the code does is invert that.</p>
<h3>1. Three stages between the key and the LED</h3>
<ol>
  <li><b>Synchronise:</b> a key press has nothing to do with the clock. Two flip-flops in a row (a ${term('synchronizer', 'synchronizer')}) remove the risk of ${term('metastability', 'metastability')}.</li>
  <li><b>${term('debounce', 'Debounce')}:</b> the metal contact bounces between 0 and 1 for a few milliseconds. A new level is taken only after it has stayed the same for <code>DB</code> clocks (10 ms, that is 500,000 clocks).</li>
  <li><b>Detect the edge:</b> keep the clean level one clock late. <code>pressed &amp; ~prev</code> is 1 only in the clock where the key went down.</li>
</ol>
<pre dir="ltr"><code>wire raw   = ~sync[1];          // active low
wire press = pressed &amp; ~prev;   // one clock per press</code></pre>
<h3>2. Why the edge?</h3>
<p>If you toggled the LED with <code>pressed</code> itself, it would toggle in every clock the key is down, millions of times a second, and the result would be random. A one-clock pulse makes every press give exactly one change.</p>
<p class="note">💡 In the simulator press the keys with the mouse, by touch or from the keyboard (Tab, then Space). The "Bouncy buttons" box above the board simulates real bounce; turn it on and make <code>DB</code> small once to see what the debouncer does.</p>
${sourcesBox('en', 'extsch', 'xjtuecho')}`,
    tryIt: `<p>Press <span class="kbd">▶ Run</span> and press ${part('KEY1')} a few times: ${part('LED1')} turns on or off once per press, even with "Bouncy buttons" on.</p>`,
    exercise: ex('x-keys').en,
  },
  'x-uart': {
    title: 'The USB-C serial port: echo and commands',
    summary: 'Every character you type in the terminal comes back, and 1 to 3 toggle the LEDs.',
    body: `
<p>The extension board has a CH340C chip that turns USB into a ${term('uart', 'UART')}. With a ${part('USB_C')} cable the board becomes a COM port (or <code>/dev/ttyUSB0</code>) on the computer. The adapter's RX line (computer to FPGA) is on H16 and TX on H17. This port is not UART1 on ${part('J7')}: that one belongs to the PS, while this one is wired straight to your PL.</p>
<h3>1. Baud rate at 50 MHz</h3>
<p>The receiver and transmitter are the <code>uart_rx</code> and <code>uart_tx</code> modules of the Nexys UART lessons. Only the clock differs: 50,000,000 ÷ 115,200 ≈ <b>434</b> clocks per bit (868 on the Nexys).</p>
<h3>2. Echo with one byte of buffer</h3>
<p>When a byte has arrived (<code>rx_done</code>), it waits in <code>hold</code> and <code>pend</code> goes to 1. The transmitter sends it as soon as it is free (<code>!busy</code>). Sending a byte takes exactly as long as receiving one, so one byte of space is enough.</p>
<pre dir="ltr"><code>wire start = pend &amp;&amp; !busy;
uart_tx tx_unit (.clk(clk), .start(start), .data(hold), .tx(UART_TX), .busy(busy));</code></pre>
<h3>3. Commands</h3>
<p>A <code>case</code> on the ASCII code of the received byte: <code>8'h31</code> ('1') toggles ${part('LED1')}, <code>8'h32</code> ${part('LED2')} and <code>8'h33</code> ${part('LED3')}. All other bytes are only echoed.</p>
<p class="note">💡 On the real board any terminal works (PuTTY, Tera Term, <code>screen /dev/ttyUSB0 115200</code>) set to 115200 8N1 with no flow control.</p>
${sourcesBox('en', 'extsch', 'xjtuecho')}`,
    tryIt: `<p>Press <span class="kbd">▶ Run</span> and open the <span class="kbd">Serial Console</span>. Whatever you type comes back; <b>1</b>, <b>2</b> and <b>3</b> turn ${part('LED1')} to ${part('LED3')} on and off. In the logic analyser, see RX and TX with the UART decoder.</p>`,
    exercise: ex('x-uart').en,
  },
  'x-buzzer': {
    title: 'The buzzer: a square wave and a musical scale',
    summary: 'Make any frequency with a counter and play the C-major scale.',
    body: `
<p>${part('BUZZER')} is a ${term('passive-buzzer', 'passive buzzer')}: it has no oscillator and plays whatever frequency you drive into its pin. A transistor drives it, so 1 on the pin means current through the buzzer.</p>
<h3>1. A square wave from a counter</h3>
<p>For a note of frequency f, the pin must flip every half period: <code>CLK_HZ / (2 × f)</code> clocks. For A (440 Hz) at 50 MHz that is 56,818 clocks. The counter <code>pcnt</code> counts up to it, goes back to zero and flips <code>BUZZER</code>.</p>
${truth(
  ['Note', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
  [
    ['Hz', 262, 294, 330, 349, 392, 440, 494, 523],
    ['Half period (clocks)', '95,420', '85,034', '75,757', '71,633', '63,775', '56,818', '50,607', '47,801'],
  ],
)}
<h3>2. Note after note</h3>
<p>A second counter, <code>ncnt</code>, times each note (<code>NOTE_TICKS</code>, 0.25 s). Then <code>step</code> moves on: 0 to 7 going up and 6 to 1 coming down, fourteen steps, then round again. The half-period table is worked out from <code>CLK_HZ</code>, so changing one parameter makes the code right for another clock.</p>
<p>While ${part('KEY1')} is held (0 on the pin) the buzzer is silent.</p>
<p class="note">💡 In the simulator the <span class="kbd">Buzzer sound</span> button in the toolbar plays the sound through your computer's speaker. The pitch you hear is the one your design makes on the pin.</p>
${sourcesBox('en', 'extsch', 'xjtuecho')}`,
    tryIt: `<p>Press <span class="kbd">▶ Run</span> and turn on <span class="kbd">Buzzer sound</span>: the scale goes up and down and the buzzer on the 3D board pulses with each note. Hold ${part('KEY1')} to mute it.</p>`,
    exercise: ex('x-buzzer').en,
  },
  'x-lcd': {
    title: 'The colour LCD: starting an ST7789 over SPI',
    summary: 'Wake the 240 × 240 display and draw eight colour stripes.',
    body: `
<p>${part('LCD')} is a 1.3-inch IPS display with 240 × 240 pixels and an ${term('st7789', 'ST7789')} controller. The FPGA talks to it over one-way ${term('spi', 'SPI')}: SCL is the clock and SDA the data, plus an extra pin called <b>DC</b> that says whether a byte is a command (0) or data (1). RES is the reset, and BLK turns the backlight on through a transistor. The display's CS pin is tied to ground on the board, so it is always selected and the FPGA has no pin for it.</p>
<h3>1. The start-up sequence</h3>
${truth(
  ['Step', 'Bytes', 'What it does'],
  [
    ['RES = 0', '-', 'a 10 ms hardware reset, then wait 120 ms'],
    ['SWRESET', '01', 'software reset, wait 150 ms'],
    ['SLPOUT', '11', 'leave sleep mode, wait 120 ms'],
    ['COLMOD', '3A 55', `${term('rgb565', 'RGB565')}: 16 bits per pixel`],
    ['MADCTL', '36 00', 'memory order: left to right, top to bottom'],
    ['INVON', '21', 'IPS panels show inverted colours without it'],
    ['CASET / RASET', '2A … / 2B …', 'the write window: columns and rows 0 to 239'],
    ['DISPON', '29', 'turn the display on'],
    ['RAMWR', '2C', 'then 240 × 240 × 2 bytes of pixels'],
  ],
)}
<p>The code keeps this table in a small ROM. Each line has two "kind" bits (command, data, wait, end) and eight bits of value. A state machine walks through it line by line.</p>
<h3>2. One byte over SPI</h3>
<p>In mode 0 the display reads each bit on the rising edge of SCL. So the <code>SEND</code> state first sets SDA, then takes SCL high and low again and sets the next bit. Each bit takes two clocks, so SCL runs at 25 MHz. The most significant bit goes first, and DC is read with the last bit.</p>
<h3>3. The pixels</h3>
<p>After RAMWR each pixel is two bytes, high byte first. The counters <code>x</code> and <code>y</code> track the pixel, and <code>stripe</code> moves on every 30 columns and picks the colour from a table. The whole picture is 115,200 bytes and takes about 37 ms at 25 MHz.</p>
<p class="note">💡 The display model in the simulator checks the order of the commands. If you, say, leave out SLPOUT or send pixels too early, you get a readable message in the console and the screen stays dark or shows wrong colours, just like a real display.</p>
${sourcesBox('en', 'st7789', 'extsch', 'vendorlcd')}`,
    tryIt: `<p>Press <span class="kbd">▶ Run</span>: after about 0.3 simulated seconds (the reset and the waits) eight colour stripes fill ${part('LCD')}. As a test, take the INVON line out of the ROM and run again.</p>`,
    exercise: ex('x-lcd').en,
  },
  'x-hdmi-tmds': {
    title: 'Inside HDMI: TMDS encoding',
    summary: 'How each colour byte becomes a balanced 10-bit symbol, and a testbench that turns it back.',
    body: `
<p>HDMI (and DVI, which HDMI builds on) uses the same timing as VGA, but it does not send the colours as analogue levels. It has three data pairs (blue, green, red) and a clock pair, and each one is a ${term('differential', 'differential pair')}. The signalling is called ${term('tmds', 'TMDS')}: every 8-bit byte becomes a <b>10-bit symbol</b>.</p>
<h3>1. Stage 1: few transitions</h3>
<p>The first bit stays as it is. Each following bit is XORed or XNORed with the previous bit of the symbol. If the byte has more than four ones (or exactly four and bit 0 is zero), XNOR is chosen because it gives fewer transitions. Bit 8 records which one was used (1 = XOR).</p>
<h3>2. Stage 2: ${term('dc-balance', 'DC balance')}</h3>
<p>The encoder keeps count of how many more ones than zeros it has sent so far (<code>cnt</code>). If the new byte would push that further, it sends the low eight bits inverted and sets bit 9. That way the difference always stays near zero.</p>
<h3>3. Control symbols</h3>
<p>During blanking (<code>de = 0</code>) one of four special symbols goes out instead of a colour. On channel 0 (blue) the two control bits are HSYNC and VSYNC; that is how the VGA sync gets into HDMI.</p>
${truth(
  ['C1 C0', 'Symbol'],
  [
    ['00', '<code>1101010100</code>'],
    ['01', '<code>0010101011</code>'],
    ['10', '<code>0101010100</code>'],
    ['11', '<code>1010101011</code>'],
  ],
)}
<h3>4. A receiver testbench</h3>
<p>This lesson's testbench plays the receiver: it undoes bit 9, unwinds the XOR chain and compares the byte it gets with the byte that went in. All 256 values are tried twice. The small design next to the encoder feeds it a new byte every half second and shows the encoder's choices on ${part('LED1')} to ${part('LED3')}.</p>
${sourcesBox('en', 'dvi')}`,
    tryIt: `<p>Press <span class="kbd">▶ Simulate</span>: the testbench decodes the four control symbols and 512 video symbols and the console shows <code>PASS</code>. With <span class="kbd">▶ Run</span>, ${part('LED1')} shows that XOR was used, ${part('LED2')} that the byte was inverted and ${part('LED3')} a control symbol.</p>`,
    exercise: ex('x-hdmi-tmds').en,
  },
  'x-hdmi-bars': {
    title: 'HDMI: 640 × 480 colour bars',
    summary: 'VGA timing, three TMDS encoders and a serializer: your first picture on an HDMI monitor.',
    body: `
<p>Now all the pieces come together: the 640 × 480 at 60 Hz timing of the VGA lesson, three ${term('tmds', 'TMDS encoders')} from the last lesson, and a serializer that sends the symbols at high speed out of ${part('HDMI')}.</p>
<h3>1. The pixel clock</h3>
<p>This mode needs 25 MHz (the standard says 25.175, but nearly every monitor takes 25). Our clock is 50 MHz, so the signal <code>pe</code> is 1 every second clock, and the counters and encoders move only then (a ${term('clock-enable', 'clock enable')}).</p>
<h3>2. Three channels</h3>
<pre dir="ltr"><code>tmds_encoder enc_b (.clk(clk), .ce(pe), .d(rgb[7:0]),   .c({vs, hs}), .de(de), .q(s0));
tmds_encoder enc_g (.clk(clk), .ce(pe), .d(rgb[15:8]),  .c(2'b00),    .de(de), .q(s1));
tmds_encoder enc_r (.clk(clk), .ce(pe), .d(rgb[23:16]), .c(2'b00),    .de(de), .q(s2));</code></pre>
<p>Each channel has 8 bits of colour, so unlike the Nexys VGA port (4 bits) you get 16 million colours.</p>
<h3>3. The serializer</h3>
<p>Each symbol is 10 bits, so each pair carries 250 Mbit/s. Ordinary FPGA logic cannot run that fast; next to every output pin there is an ${term('oserdes', 'OSERDESE2')} that does exactly this job. FPGA Lab provides the <code>tmds_serializer</code> module:</p>
<ul>
  <li>An ${term('mmcm-pll', 'MMCM')} makes two clocks from 50 MHz: 25 MHz for the pixels and 125 MHz for the serial side (DDR: two bits per clock, 5 clocks for 10 bits).</li>
  <li>Per channel, two OSERDESE2 (master and slave, since one takes only 8 bits) and an <code>OBUFDS</code> that drives the P and N pins with the <code>TMDS_33</code> standard.</li>
  <li>The clock channel always sends <code>0000011111</code>: a 25 MHz wave.</li>
</ul>
<p>In the simulator a simple stand-in passes the symbols straight to the HDMI Monitor instead. The monitor decodes them like a real receiver: a corrupt symbol gives "No signal" or a wrong colour. The Vivado project gets the real one, <code>src/tmds_serializer.v</code>, added automatically.</p>
<p class="note">💡 This design sends a DVI signal only (no audio and no HDMI data packets). HDMI monitors and TVs show it. If a TV shows nothing, set its input to "PC" or "DVI".</p>
${sourcesBox('en', 'dvi', 'extsch')}`,
    tryIt: `<p>Press <span class="kbd">▶ Run</span> and open the <span class="kbd">HDMI Monitor</span>. It locks at 640 × 480 and shows eight bars: white, yellow, cyan, green, magenta, red, blue and black.</p>`,
    exercise: ex('x-hdmi-bars').en,
  },
};

export const EXT_LEVEL: Record<string, Level> = {
  'x-leds': 'intro',
  'x-keys': 'core',
  'x-uart': 'core',
  'x-buzzer': 'core',
  'x-lcd': 'advanced',
  'x-hdmi-tmds': 'advanced',
  'x-hdmi-bars': 'advanced',
};
export const EXT_PREREQ: Record<string, string[]> = {
  'x-leds': ['z-blink'],
  'x-keys': ['x-leds'],
  'x-uart': ['x-keys'],
  'x-buzzer': ['x-keys'],
  'x-lcd': ['x-uart'],
  'x-hdmi-tmds': ['x-leds'],
  'x-hdmi-bars': ['x-hdmi-tmds'],
};

export const EXT_GOALS: Record<string, { fa: Goals; en: Goals }> = {
  'x-leds': {
    fa: {
      objectives: ['بخش‌های برد توسعه و پایه‌هایشان را بشناسید.', 'سه LED برد توسعه را با یک پورت سه‌بیتی برانید.', 'یک ثبات را با الحاق بیت‌ها بچرخانید.'],
      takeaways: ['LED1 تا LED3 روی E19، K17 و H18‌اند و ۱ یعنی روشن.', '<code>{x[1:0], x[2]}</code> سه بیت را یک خانه به چپ می‌چرخاند.', 'کلیدها فعال‌پایین‌اند و بازر و نور پس‌زمینه‌ی LCD با ترانزیستور روشن می‌شوند (۱ = روشن).'],
    },
    en: {
      objectives: ['Know the parts of the extension board and their pins.', 'Drive the three extension LEDs from one 3-bit port.', 'Rotate a register with a bit concatenation.'],
      takeaways: ['LED1 to LED3 are on E19, K17 and H18, and 1 means on.', '<code>{x[1:0], x[2]}</code> rotates three bits left by one.', 'The keys are active low; the buzzer and the LCD backlight are switched by transistors (1 = on).'],
    },
  },
  'x-keys': {
    fa: {
      objectives: ['کلید فعال‌پایین را درست بخوانید.', 'ورودی را همگام کنید و لرزش آن را حذف کنید.', 'از سطح یک پالس یک‌کلاکی برای هر فشار بسازید.'],
      takeaways: ['با pull-up، فشرده یعنی ۰ روی پایه.', 'دو فلیپ‌فلاپ برای همگام‌سازی، بعد debounce، بعد تشخیص لبه.', '<code>pressed &amp; ~prev</code> در هر فشار فقط یک کلاک یک است.'],
    },
    en: {
      objectives: ['Read an active-low key correctly.', 'Synchronise an input and debounce it.', 'Turn a level into a one-clock pulse per press.'],
      takeaways: ['With a pull-up, pressed means 0 on the pin.', 'Two flip-flops to synchronise, then debounce, then edge detect.', '<code>pressed &amp; ~prev</code> is 1 for one clock per press.'],
    },
  },
  'x-uart': {
    fa: {
      objectives: ['ماژول‌های UART را برای کلاک ۵۰ مگاهرتز تنظیم کنید.', 'یک اکو با یک بایت انتظار بسازید.', 'فرمان‌های تک‌حرفی را با case روی کد اسکی اجرا کنید.'],
      takeaways: ['در ۵۰ مگاهرتز و 115200 هر بیت ۴۳۴ کلاک است.', 'CH340C درگاه USB-C را به RX روی H16 و TX روی H17 می‌برد.', 'فرستنده تا آزاد شدن صبر می‌کند؛ یک بایت جا برای اکو کافی است.'],
    },
    en: {
      objectives: ['Set up the UART modules for a 50 MHz clock.', 'Build an echo with one byte of buffer.', 'Run one-character commands with a case on the ASCII code.'],
      takeaways: ['At 50 MHz and 115200 each bit is 434 clocks.', 'The CH340C brings the USB-C port to RX on H16 and TX on H17.', 'The transmitter waits until it is free; one byte of space is enough for an echo.'],
    },
  },
  'x-buzzer': {
    fa: {
      objectives: ['از فرکانس یک نت نیم‌پریود آن را به کلاک حساب کنید.', 'با یک شمارنده موج مربعی بسازید.', 'با شمارنده‌ی دوم یک دنباله از نت‌ها بنوازید.'],
      takeaways: ['نیم‌پریود = <code>CLK_HZ / (2 × f)</code>.', 'بازر پسیو همان فرکانسی را پخش می‌کند که روی پایه است.', 'یک شمارنده برای صدا و یکی برای طول نت.'],
    },
    en: {
      objectives: ['Work out a note’s half period in clocks from its frequency.', 'Make a square wave with a counter.', 'Play a sequence of notes with a second counter.'],
      takeaways: ['Half period = <code>CLK_HZ / (2 × f)</code>.', 'A passive buzzer plays the frequency on its pin.', 'One counter for the pitch and one for the note length.'],
    },
  },
  'x-lcd': {
    fa: {
      objectives: ['ترتیب راه‌اندازی ST7789 را بخوانید و دنبال کنید.', 'بایت‌ها را با SPI حالت ۰ و پایه‌ی DC بفرستید.', 'یک تصویر RGB565 پیکسل به پیکسل بسازید.'],
      takeaways: ['DC = ۰ فرمان و DC = ۱ داده است.', 'بعد از ریست و SLPOUT باید صبر کرد؛ بدون آن نمایشگر کار نمی‌کند.', 'هر پیکسل RGB565 دو بایت است، اول بایت بالا.', 'پنل IPS به INVON نیاز دارد.'],
    },
    en: {
      objectives: ['Read and follow the ST7789 start-up sequence.', 'Send bytes over SPI mode 0 with the DC pin.', 'Build an RGB565 picture pixel by pixel.'],
      takeaways: ['DC = 0 is a command and DC = 1 data.', 'After the reset and SLPOUT you must wait; without it the display does not work.', 'Each RGB565 pixel is two bytes, high byte first.', 'An IPS panel needs INVON.'],
    },
  },
  'x-hdmi-tmds': {
    fa: {
      objectives: ['دو مرحله‌ی رمزگذاری TMDS را توضیح دهید.', 'نمادهای کنترلی و جای HSYNC و VSYNC را بشناسید.', 'با یک testbench گیرنده رمزگذار را بسنجید.'],
      takeaways: ['مرحله‌ی ۱ تغییرات را کم می‌کند (XOR یا XNOR)، مرحله‌ی ۲ تعادل DC را نگه می‌دارد.', 'بیت ۸ نوع زنجیره و بیت ۹ برعکس شدن را می‌گوید.', 'در خاموشی چهار نماد کنترلی می‌روند؛ HSYNC و VSYNC روی کانال آبی‌اند.'],
    },
    en: {
      objectives: ['Explain the two stages of TMDS encoding.', 'Know the control symbols and where HSYNC and VSYNC go.', 'Check the encoder with a receiver testbench.'],
      takeaways: ['Stage 1 cuts transitions (XOR or XNOR); stage 2 keeps the DC balance.', 'Bit 8 says which chain was used and bit 9 whether the byte was inverted.', 'Blanking sends four control symbols; HSYNC and VSYNC ride on the blue channel.'],
    },
  },
  'x-hdmi-bars': {
    fa: {
      objectives: ['زمان‌بندی VGA را با clock enable به ۲۵ مگاهرتز برسانید.', 'سه رمزگذار را به یک سریال‌کننده وصل کنید.', 'نقش MMCM، OSERDESE2 و OBUFDS را در خروجی HDMI توضیح دهید.'],
      takeaways: ['۶۴۰×۴۸۰ در ۶۰ هرتز یعنی کلاک پیکسل ۲۵ مگاهرتز و ۸۰۰×۵۲۵ کلاک در هر فریم.', 'هر زوج ۱۰ بیت در هر پیکسل، یعنی ۲۵۰ مگابیت بر ثانیه.', 'پایه‌های HDMI استاندارد <code>TMDS_33</code> دارند.', 'سیگنال DVI روی مانیتورهای HDMI هم دیده می‌شود.'],
    },
    en: {
      objectives: ['Bring VGA timing to 25 MHz with a clock enable.', 'Connect three encoders to a serializer.', 'Explain the roles of the MMCM, OSERDESE2 and OBUFDS in an HDMI output.'],
      takeaways: ['640 × 480 at 60 Hz means a 25 MHz pixel clock and 800 × 525 clocks per frame.', 'Each pair carries 10 bits per pixel: 250 Mbit/s.', 'The HDMI pins use the <code>TMDS_33</code> standard.', 'A DVI signal shows on HDMI monitors too.'],
    },
  },
};

export const EXT_QUIZ: Record<string, { fa: Question[]; en: Question[] }> = {
  'x-leds': {
    fa: [
      q('بعد از ۰۰۱ و یک چرخش به چپ، EXT_LED چه می‌شود؟', ['010', '100', '000', '011'], 0, 'بیت‌ها یک خانه بالا می‌روند و بیت ۲ (صفر) به جای بیت ۰ می‌نشیند.'),
      q('چرا XDC این درس پایه‌ی کلاک ندارد؟', ['کلاک FCLK_CLK0 از PS است', 'LEDها کلاک ندارند', 'Vivado خودش کلاک را پیدا می‌کند', 'برد توسعه نوسان‌ساز دارد'], 0, 'PL این برد نوسان‌ساز ندارد و کلاک از داخل تراشه می‌آید.'),
      q('پایه‌ی CS نمایشگر به کجا وصل است؟', ['روی برد به زمین', 'به پایه‌ی T20', 'به PS', 'به هدر UART'], 0, 'CS به زمین وصل است، پس نمایشگر همیشه انتخاب‌شده است؛ T20 نور پس‌زمینه است.'),
    ],
    en: [
      q('After 001 and one rotate left, what is EXT_LED?', ['010', '100', '000', '011'], 0, 'The bits move up one place and bit 2 (zero) lands in bit 0.'),
      q('Why does this lesson’s XDC have no clock pin?', ['The clock is FCLK_CLK0 from the PS', 'LEDs need no clock', 'Vivado finds the clock itself', 'The extension board has an oscillator'], 0, 'This board’s PL has no oscillator; the clock comes from inside the chip.'),
      q('Where is the display\u2019s CS pin wired?', ['To ground on the board', 'To pin T20', 'To the PS', 'To the UART header'], 0, 'CS is tied to ground, so the display is always selected; T20 is the backlight.'),
    ],
  },
  'x-keys': {
    fa: [
      q('وقتی KEY1 فشرده است، روی پایه چه مقداری است؟', ['۰', '۱', 'Z', 'به کلاک بستگی دارد'], 0, 'کلید با pull-up به ۳.۳ ولت وصل است و فشار دادن آن پایه را به زمین می‌برد.'),
      q('اگر LED را با خود pressed (بدون لبه) عوض کنید چه می‌شود؟', ['در هر کلاکی که کلید پایین است عوض می‌شود', 'دقیقاً یک بار عوض می‌شود', 'هیچ‌وقت عوض نمی‌شود', 'فقط با رها کردن عوض می‌شود'], 0, 'سطح ثابت میلیون‌ها کلاک طول می‌کشد؛ فقط لبه یک‌کلاکی است.'),
      q('ده میلی‌ثانیه در ۵۰ مگاهرتز چند کلاک است؟', ['۵۰۰٬۰۰۰', '۵۰٬۰۰۰', '۱٬۰۰۰٬۰۰۰', '۵٬۰۰۰٬۰۰۰'], 0, '۰.۰۱ × ۵۰٬۰۰۰٬۰۰۰ = ۵۰۰٬۰۰۰.'),
    ],
    en: [
      q('What is on the pin while KEY1 is pressed?', ['0', '1', 'Z', 'It depends on the clock'], 0, 'The key has a pull-up to 3.3 V and pressing it pulls the pin to ground.'),
      q('What happens if you toggle the LED with pressed itself (no edge)?', ['It toggles in every clock the key is down', 'It toggles exactly once', 'It never toggles', 'It toggles only on release'], 0, 'The level lasts millions of clocks; only the edge is one clock long.'),
      q('How many clocks is 10 ms at 50 MHz?', ['500,000', '50,000', '1,000,000', '5,000,000'], 0, '0.01 × 50,000,000 = 500,000.'),
    ],
  },
  'x-uart': {
    fa: [
      q('در ۵۰ مگاهرتز و 115200 هر بیت چند کلاک است؟', ['۴۳۴', '۸۶۸', '۱۱۵', '۵۰'], 0, '۵۰٬۰۰۰٬۰۰۰ ÷ ۱۱۵٬۲۰۰ ≈ ۴۳۴؛ در ۱۰۰ مگاهرتز Nexys ‏۸۶۸ بود.'),
      q('کد اسکی رقم 1 چیست؟', ['0x31', '0x01', '0x41', '0x10'], 0, 'رقم‌ها از 0x30 شروع می‌شوند.'),
      q('چرا یک بایت جا برای اکو کافی است؟', ['فرستادن یک بایت همان‌قدر طول می‌کشد که رسیدنش', 'UART همیشه یک بایت دارد', 'CH340C بافر دارد', 'ترمینال آهسته تایپ می‌کند'], 0, 'سرعت دو طرف یکی است، پس فرستنده همیشه پیش از رسیدن بایت بعدی آزاد می‌شود.'),
    ],
    en: [
      q('At 50 MHz and 115200, how many clocks is one bit?', ['434', '868', '115', '50'], 0, '50,000,000 ÷ 115,200 ≈ 434; at the Nexys’s 100 MHz it was 868.'),
      q('What is the ASCII code of the digit 1?', ['0x31', '0x01', '0x41', '0x10'], 0, 'The digits start at 0x30.'),
      q('Why is one byte of space enough for the echo?', ['Sending a byte takes as long as receiving one', 'A UART always has one byte', 'The CH340C has a buffer', 'Terminals type slowly'], 0, 'Both sides run at the same rate, so the transmitter is always free before the next byte arrives.'),
    ],
  },
  'x-buzzer': {
    fa: [
      q('نیم‌پریود لا (۴۴۰ هرتز) در ۵۰ مگاهرتز چند کلاک است؟', ['حدود ۵۶٬۸۱۸', 'حدود ۱۱۳٬۶۳۶', '۴۴۰', 'حدود ۲۸٬۴۰۹'], 0, '۵۰٬۰۰۰٬۰۰۰ ÷ (۲ × ۴۴۰) ≈ ۵۶٬۸۱۸.'),
      q('اگر نیم‌پریود را نصف کنید، صدا چه می‌شود؟', ['یک اکتاو بالاتر', 'یک اکتاو پایین‌تر', 'بلندتر', 'تغییری نمی‌کند'], 0, 'فرکانس دو برابر می‌شود، یعنی یک اکتاو بالاتر.'),
      q('بازر پسیو با پایه‌ی ثابت روی ۱ چه می‌کند؟', ['ساکت است (شاید یک تیک)', 'صدای ۴ کیلوهرتز می‌دهد', 'گام را می‌نوازد', 'می‌سوزد'], 0, 'بازر پسیو فقط تغییرات را صدا می‌کند؛ نوسان‌ساز ندارد.'),
    ],
    en: [
      q('How many clocks is half a period of A (440 Hz) at 50 MHz?', ['about 56,818', 'about 113,636', '440', 'about 28,409'], 0, '50,000,000 ÷ (2 × 440) ≈ 56,818.'),
      q('If you halve the half period, what happens to the sound?', ['One octave higher', 'One octave lower', 'Louder', 'No change'], 0, 'The frequency doubles, which is one octave up.'),
      q('What does a passive buzzer do with its pin held at 1?', ['Stays silent (maybe one click)', 'Plays 4 kHz', 'Plays the scale', 'Burns out'], 0, 'A passive buzzer only sounds changes; it has no oscillator.'),
    ],
  },
  'x-lcd': {
    fa: [
      q('پایه‌ی DC در ST7789 چه می‌گوید؟', ['بایت فرمان است یا داده', 'جهت داده', 'سرعت SPI', 'روشنایی'], 0, 'DC = ۰ فرمان و DC = ۱ داده (پارامتر یا پیکسل).'),
      q('اگر SLPOUT فرستاده نشود چه می‌بینید؟', ['صفحه تاریک می‌ماند', 'رنگ‌ها برعکس می‌شوند', 'تصویر وارونه می‌شود', 'هیچ فرقی نمی‌کند'], 0, 'کنترلر در خواب است و پیکسل‌ها را نشان نمی‌دهد.'),
      q('یک تصویر کامل ۲۴۰×۲۴۰ با RGB565 چند بایت است؟', ['۱۱۵٬۲۰۰', '۵۷٬۶۰۰', '۱۷۲٬۸۰۰', '۲۴۰'], 0, '۲۴۰ × ۲۴۰ پیکسل × ۲ بایت = ۱۱۵٬۲۰۰.'),
    ],
    en: [
      q('What does the ST7789’s DC pin say?', ['Whether the byte is a command or data', 'The data direction', 'The SPI speed', 'The brightness'], 0, 'DC = 0 is a command and DC = 1 data (a parameter or a pixel).'),
      q('What do you see if SLPOUT is never sent?', ['The screen stays dark', 'The colours are inverted', 'The picture is upside down', 'No difference'], 0, 'The controller is asleep and does not show the pixels.'),
      q('How many bytes is a full 240 × 240 RGB565 picture?', ['115,200', '57,600', '172,800', '240'], 0, '240 × 240 pixels × 2 bytes = 115,200.'),
    ],
  },
  'x-hdmi-tmds': {
    fa: [
      q('هر بایت رنگ در TMDS چند بیت می‌شود؟', ['۱۰', '۸', '۹', '۱۲'], 0, 'هشت بیت داده، بیت ۸ برای نوع زنجیره و بیت ۹ برای برعکس شدن.'),
      q('بیت ۹ یک نماد ویدیویی وقتی ۱ است یعنی چه؟', ['هشت بیت پایین برعکس شده‌اند', 'XNOR استفاده شده', 'نماد کنترلی است', 'پیکسل سفید است'], 0, 'مرحله‌ی ۲ برای تعادل DC بایت را برعکس کرده؛ گیرنده آن را برمی‌گرداند.'),
      q('HSYNC و VSYNC در HDMI کجا می‌روند؟', ['در نمادهای کنترلی کانال ۰ (آبی)', 'روی دو پایه‌ی جدا', 'روی کانال کلاک', 'اصلاً فرستاده نمی‌شوند'], 0, 'در خاموشی، C0 و C1 کانال آبی همان HSYNC و VSYNC‌اند.'),
    ],
    en: [
      q('How many bits does TMDS make of each colour byte?', ['10', '8', '9', '12'], 0, 'Eight data bits, bit 8 for the chain type and bit 9 for inversion.'),
      q('What does bit 9 = 1 mean in a video symbol?', ['The low eight bits are inverted', 'XNOR was used', 'It is a control symbol', 'The pixel is white'], 0, 'Stage 2 inverted the byte for DC balance; the receiver turns it back.'),
      q('Where do HSYNC and VSYNC go in HDMI?', ['In the control symbols of channel 0 (blue)', 'On two separate pins', 'On the clock channel', 'They are not sent'], 0, 'During blanking, C0 and C1 of the blue channel are HSYNC and VSYNC.'),
    ],
  },
  'x-hdmi-bars': {
    fa: [
      q('هر زوج داده‌ی HDMI در ۶۴۰×۴۸۰ چند بیت بر ثانیه دارد؟', ['۲۵۰ مگابیت', '۲۵ مگابیت', '۱۲۵ مگابیت', '۲.۵ گیگابیت'], 0, '۲۵ مگاهرتز پیکسل × ۱۰ بیت = ۲۵۰ مگابیت بر ثانیه.'),
      q('چرا برای هر کانال دو OSERDESE2 لازم است؟', ['یکی فقط تا ۸ بیت سریال می‌کند', 'یکی برای P و یکی برای N', 'برای دو رنگ', 'برای صدا'], 0, 'نسبت ۱۰:۱ با زنجیر کردن master و slave به دست می‌آید؛ OBUFDS خودش P و N را می‌سازد.'),
      q('سیگنال pe در این طرح چیست؟', ['clock enable پیکسل: هر دو کلاک یک بار', 'کلاک ۱۲۵ مگاهرتز', 'سیگنال ریست', 'همان de'], 0, 'با کلاک ۵۰ مگاهرتز، pe پیکسل‌ها را به ۲۵ مگاهرتز می‌رساند.'),
    ],
    en: [
      q('How many bits per second does each HDMI data pair carry at 640 × 480?', ['250 Mbit', '25 Mbit', '125 Mbit', '2.5 Gbit'], 0, '25 MHz pixels × 10 bits = 250 Mbit/s.'),
      q('Why does each channel need two OSERDESE2?', ['One serializes only up to 8 bits', 'One for P and one for N', 'For two colours', 'For audio'], 0, '10:1 needs a master and a slave chained; the OBUFDS makes P and N itself.'),
      q('What is pe in this design?', ['The pixel clock enable: once every second clock', 'The 125 MHz clock', 'A reset', 'The same as de'], 0, 'With a 50 MHz clock, pe brings the pixels down to 25 MHz.'),
    ],
  },
};
