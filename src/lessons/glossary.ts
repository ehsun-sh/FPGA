// The course glossary (Phase 4.2): one short definition per term in both languages, and the lesson that introduces
// it. Used by the glossary page, the search dialog and the term() tooltips in the lessons.
type T = { fa: string; en: string };
export interface GlossaryTerm {
  id: string;
  term: T;
  def: T; // plain text, at most 40 words
  lesson?: string; // the lesson that introduces the term
}

const g = (id: string, term: T, def: T, lesson?: string): GlossaryTerm => (lesson ? { id, term, def, lesson } : { id, term, def });

export const GLOSSARY: GlossaryTerm[] = [
  g('fpga', { fa: 'FPGA', en: 'FPGA' }, {
    fa: 'تراشه‌ای از بلوک‌های منطقی و سیم‌کشی قابل برنامه‌ریزی. با یک bitstream به هر مدار دیجیتالی که توصیف کنید تبدیل می‌شود و بعد هم می‌توان آن را دوباره برنامه‌ریزی کرد.',
    en: 'A chip made of programmable logic blocks and wiring. A bitstream turns it into whatever digital circuit you describe, and it can be reprogrammed later.',
  }, 'intro'),
  g('lut', { fa: 'LUT (جدول جست‌وجو)', en: 'LUT (look-up table)' }, {
    fa: 'حافظه‌ای کوچک که جدول درستی یک تابع منطقی را نگه می‌دارد. در Artix-7 هر LUT شش ورودی دارد و هر تابعی از آن شش ورودی را پیاده می‌کند.',
    en: 'A tiny memory that holds the truth table of a logic function. On Artix-7 each LUT has six inputs and implements any function of them.',
  }, 'intro'),
  g('flip-flop', { fa: 'فلیپ‌فلاپ', en: 'Flip-flop' }, {
    fa: 'یک بیت حافظه که فقط در لبهٔ کلاک مقدار ورودی D را می‌گیرد و تا لبهٔ بعد نگه می‌دارد. پایهٔ همهٔ مدارهای ترتیبی است.',
    en: 'One bit of memory that takes its D input only on a clock edge and holds it until the next edge. The base of every sequential circuit.',
  }, 'ff'),
  g('slice', { fa: 'Slice و CLB', en: 'Slice / CLB' }, {
    fa: 'واحد تکرارشوندهٔ منطق در FPGA. در Artix-7 هر slice چهار LUT، هشت فلیپ‌فلاپ و زنجیرهٔ carry دارد و هر CLB دو slice است.',
    en: 'The repeating logic unit of an FPGA. On Artix-7 a slice has four LUTs, eight flip-flops and a carry chain; a CLB holds two slices.',
  }, 'intro'),
  g('bram', { fa: 'BRAM (Block RAM)', en: 'BRAM (block RAM)' }, {
    fa: 'بلوک‌های حافظهٔ آماده در تراشه، هر کدام ۳۶ کیلوبیت در Artix-7. با خواندن همگام و دو درگاه مستقل کار می‌کنند و Vivado آن‌ها را از یک آرایهٔ ساده استنتاج می‌کند.',
    en: 'Ready-made memory blocks on the chip, 36 Kbit each on Artix-7. They have synchronous reads and two independent ports, and Vivado infers them from a plain array.',
  }, 'bram'),
  g('dsp', { fa: 'DSP slice', en: 'DSP slice' }, {
    fa: 'بلوک سخت‌افزاری آماده برای ضرب و جمع سریع (DSP48E1 در Artix-7). ضرب‌های بزرگ به‌جای LUTها در این بلوک‌ها ساخته می‌شوند.',
    en: 'A hard block for fast multiply and add (DSP48E1 on Artix-7). Large multiplications go into these blocks instead of LUTs.',
  }, 'timing'),
  g('routing', { fa: 'سیم‌کشی (Routing)', en: 'Routing' }, {
    fa: 'شبکهٔ سیم‌ها و کلیدهای قابل برنامه‌ریزی که بلوک‌های منطقی را به هم وصل می‌کند. تأخیر سیم‌ها بخش بزرگی از تأخیر مسیرهاست.',
    en: 'The network of programmable wires and switches that connects the logic blocks. Wire delay is a large part of every path’s delay.',
  }, 'intro'),
  g('bitstream', { fa: 'Bitstream', en: 'Bitstream' }, {
    fa: 'فایلی که پیکربندی کامل تراشه را نگه می‌دارد: محتوای همهٔ LUTها و کلیدهای سیم‌کشی. Program Device آن را روی FPGA می‌ریزد.',
    en: 'The file that holds the chip’s whole configuration: every LUT’s contents and every routing switch. Program Device loads it into the FPGA.',
  }, 'intro'),
  g('synthesis', { fa: 'سنتز (Synthesis)', en: 'Synthesis' }, {
    fa: 'مرحله‌ای که کد HDL را به مداری از LUT، فلیپ‌فلاپ و بلوک‌های دیگر تبدیل می‌کند. خروجی آن netlist است.',
    en: 'The step that turns HDL code into a circuit of LUTs, flip-flops and other blocks. Its output is a netlist.',
  }, 'intro'),
  g('implementation', { fa: 'پیاده‌سازی (Implementation)', en: 'Implementation' }, {
    fa: 'مرحلهٔ بعد از سنتز در Vivado: جای‌گذاری و سیم‌کشی netlist روی تراشهٔ واقعی و بررسی زمان‌بندی.',
    en: 'The Vivado step after synthesis: placing and routing the netlist on the real chip and checking timing.',
  }, 'intro'),
  g('place-route', { fa: 'جای‌گذاری و سیم‌کشی', en: 'Place and route' }, {
    fa: 'انتخاب جای هر LUT و فلیپ‌فلاپ روی تراشه (place) و پیدا کردن سیم بین آن‌ها (route). کیفیت آن روی Fmax اثر مستقیم دارد.',
    en: 'Choosing where each LUT and flip-flop sits on the chip (place) and finding wires between them (route). It directly affects Fmax.',
  }, 'timing'),
  g('xdc', { fa: 'XDC (فایل قیود)', en: 'XDC / constraint' }, {
    fa: 'فایل قیدهای Vivado: کدام پورت روی کدام پایهٔ تراشه است، چه استاندارد ولتاژی دارد و کلاک چه دوره‌ای دارد.',
    en: 'Vivado’s constraints file: which port goes to which chip pin, its I/O standard, and the clock’s period.',
  }, 'intro'),
  g('clock', { fa: 'کلاک', en: 'Clock' }, {
    fa: 'سیگنال مربعی منظمی که همهٔ فلیپ‌فلاپ‌ها با لبهٔ آن کار می‌کنند. کلاک برد Nexys A7 صد مگاهرتز است، یعنی هر ۱۰ نانوثانیه یک لبه.',
    en: 'A steady square wave whose edges drive every flip-flop. The Nexys A7 clock is 100 MHz: one rising edge every 10 ns.',
  }, 'ff'),
  g('rising-edge', { fa: 'لبهٔ بالارونده', en: 'Rising edge' }, {
    fa: 'لحظه‌ای که سیگنال از ۰ به ۱ می‌رود. در Verilog با <code>posedge</code> و در VHDL با <code>rising_edge()</code> نوشته می‌شود.',
    en: 'The moment a signal goes from 0 to 1. Written <code>posedge</code> in Verilog and <code>rising_edge()</code> in VHDL.',
  }, 'ff'),
  g('combinational', { fa: 'مدار ترکیبی', en: 'Combinational' }, {
    fa: 'مداری که خروجی آن فقط به ورودی‌های همین لحظه بستگی دارد و حافظه ندارد؛ مثل گیت‌ها، مالتی‌پلکسر و جمع‌کننده.',
    en: 'A circuit whose outputs depend only on its present inputs, with no memory: gates, multiplexers and adders.',
  }, 'gates'),
  g('sequential', { fa: 'مدار ترتیبی', en: 'Sequential' }, {
    fa: 'مداری با حافظه: خروجی به ورودی‌ها و به حالت ذخیره‌شده در فلیپ‌فلاپ‌ها بستگی دارد و با کلاک پیش می‌رود.',
    en: 'A circuit with memory: its outputs depend on the inputs and on the state held in flip-flops, and it advances with the clock.',
  }, 'ff'),
  g('register', { fa: 'رجیستر', en: 'Register' }, {
    fa: 'چند فلیپ‌فلاپ کنار هم که یک عدد چندبیتی را با یک کلاک مشترک نگه می‌دارند.',
    en: 'Several flip-flops side by side that hold a multi-bit value on a shared clock.',
  }, 'ff'),
  g('latch', { fa: 'Latch', en: 'Latch' }, {
    fa: 'حافظه‌ای که به سطح سیگنال حساس است، نه به لبه. اگر در کد ترکیبی به یک سیگنال در همهٔ شاخه‌ها مقدار ندهید، ناخواسته ساخته می‌شود.',
    en: 'Memory that is level-sensitive rather than edge-triggered. Inferred by mistake when combinational code leaves a signal unassigned in some branch.',
  }, 'ff'),
  g('counter', { fa: 'شمارنده', en: 'Counter' }, {
    fa: 'رجیستری که در هر لبهٔ کلاک یکی زیاد (یا کم) می‌شود. پایهٔ تقسیم فرکانس، زمان‌سنجی و تولید آدرس است.',
    en: 'A register that adds (or subtracts) one on every clock edge. The basis of frequency division, timing and address generation.',
  }, 'counter'),
  g('prescaler', { fa: 'تقسیم‌کنندهٔ کلاک (Prescaler)', en: 'Prescaler / clock divider' }, {
    fa: 'شمارنده‌ای که هر N کلاک یک پالس می‌دهد تا رویدادهای کند (مثلاً یک بار در ثانیه) از کلاک سریع ساخته شوند.',
    en: 'A counter that gives one pulse every N clocks, so slow events (once a second, say) come from the fast clock.',
  }, 'counter'),
  g('clock-enable', { fa: 'Clock enable', en: 'Clock enable' }, {
    fa: 'پالسی یک‌کلاکه که به فلیپ‌فلاپ‌ها می‌گوید «این بار به‌روز شو». راه درست کند کردن مدار بدون ساختن کلاک دوم.',
    en: 'A one-clock pulse that tells flip-flops “update this time”. The right way to slow a circuit down without making a second clock.',
  }, 'clocking'),
  g('debounce', { fa: 'دیباونس (Debounce)', en: 'Debounce' }, {
    fa: 'حذف لرزش کنتاکت دکمه: ورودی فقط وقتی پذیرفته می‌شود که چند میلی‌ثانیه ثابت مانده باشد.',
    en: 'Removing a button’s contact bounce: the input is accepted only after it has stayed the same for a few milliseconds.',
  }, 'debounce'),
  g('metastability', { fa: 'شبه‌پایداری (Metastability)', en: 'Metastability' }, {
    fa: 'وقتی ورودی فلیپ‌فلاپ نزدیک لبهٔ کلاک عوض شود، خروجی ممکن است مدتی بین ۰ و ۱ بماند. سیگنال‌های ناهمگام باید از سنکرون‌ساز بگذرند.',
    en: 'When a flip-flop’s input changes too close to the clock edge, its output can hang between 0 and 1 for a while. Asynchronous signals need a synchroniser.',
  }, 'cdc'),
  g('synchronizer', { fa: 'سنکرون‌ساز دو فلیپ‌فلاپی', en: 'Two-flop synchroniser' }, {
    fa: 'دو فلیپ‌فلاپ پشت سر هم روی سیگنالی که از بیرون یا از دامنهٔ کلاک دیگری می‌آید؛ به حالت شبه‌پایدار فرصت می‌دهد تا قبل از استفاده آرام شود.',
    en: 'Two flip-flops in a row on a signal from outside or from another clock domain; they give a metastable value time to settle before use.',
  }, 'cdc'),
  g('cdc', { fa: 'عبور از دامنهٔ کلاک (CDC)', en: 'Clock domain crossing (CDC)' }, {
    fa: 'عبور یک سیگنال از مداری با یک کلاک به مداری با کلاک دیگر (یا از دنیای بیرون). بدون سنکرون‌ساز خطاهای نادر و تصادفی می‌سازد.',
    en: 'A signal passing from logic on one clock to logic on another (or in from the outside world). Without a synchroniser it causes rare, random faults.',
  }, 'cdc'),
  g('fsm', { fa: 'ماشین حالت (FSM)', en: 'FSM (finite state machine)' }, {
    fa: 'مداری با تعداد محدودی حالت که با هر کلاک بر اساس ورودی‌ها از یک حالت به حالت دیگر می‌رود؛ مثل چراغ راهنمایی.',
    en: 'A circuit with a fixed set of states that moves from one to the next on each clock according to its inputs, like a traffic light.',
  }, 'fsm'),
  g('fsmd', { fa: 'FSMD', en: 'FSMD' }, {
    fa: 'ماشین حالت به‌همراه مسیر داده (رجیسترها، جمع‌کننده و …). FSM ترتیب کارها را کنترل می‌کند و مسیر داده محاسبه را انجام می‌دهد.',
    en: 'A state machine with a datapath (registers, adders and so on). The FSM sequences the work and the datapath does the arithmetic.',
  }, 'bin2bcd'),
  g('moore-mealy', { fa: 'مور و میلی', en: 'Moore vs Mealy' }, {
    fa: 'در ماشین مور خروجی فقط به حالت بستگی دارد؛ در ماشین میلی به حالت و ورودی. میلی سریع‌تر واکنش می‌دهد، مور تمیزتر است.',
    en: 'In a Moore machine the outputs depend only on the state; in a Mealy machine on the state and the inputs. Mealy reacts sooner, Moore is cleaner.',
  }, 'fsm'),
  g('testbench', { fa: 'Testbench', en: 'Testbench' }, {
    fa: 'برنامهٔ HDL جداگانه‌ای که ورودی‌های طرح را در زمان‌های مشخص تغییر می‌دهد و خروجی‌ها را بررسی می‌کند. فقط شبیه‌سازی می‌شود، سنتز نمی‌شود.',
    en: 'A separate HDL program that changes the design’s inputs at chosen times and checks its outputs. It is only simulated, never synthesised.',
  }, 'testbench'),
  g('waveform', { fa: 'شکل موج', en: 'Waveform' }, {
    fa: 'نمایش مقدار سیگنال‌ها در طول زمان، حاصل شبیه‌سازی. با آن می‌توان دید هر سیگنال دقیقاً کی عوض شده است.',
    en: 'A plot of signal values over time, produced by simulation. It shows exactly when each signal changed.',
  }, 'testbench'),
  g('timescale', { fa: 'Timescale', en: 'Timescale' }, {
    fa: 'دستور <code>`timescale 1ns/1ps</code> در Verilog: واحد تأخیرهای <code>#</code> و دقت زمانی شبیه‌سازی را تعیین می‌کند.',
    en: 'The Verilog <code>`timescale 1ns/1ps</code> directive: it sets the unit of <code>#</code> delays and the simulation’s time precision.',
  }, 'testbench'),
  g('baud', { fa: 'نرخ باود', en: 'Baud rate' }, {
    fa: 'تعداد بیت‌هایی که در هر ثانیه روی خط سریال فرستاده می‌شود. در ۱۱۵۲۰۰ باود هر بیت حدود ۸٫۷ میکروثانیه طول می‌کشد.',
    en: 'The number of bits per second on a serial line. At 115200 baud each bit lasts about 8.7 µs.',
  }, 'uart'),
  g('uart', { fa: 'UART', en: 'UART' }, {
    fa: 'ارتباط سریال ناهمگام با دو سیم TX و RX و بدون کلاک مشترک؛ دو طرف باید روی نرخ باود توافق کنند.',
    en: 'Asynchronous serial link on two wires, TX and RX, with no shared clock; both ends must agree on the baud rate.',
  }, 'uart'),
  g('start-stop', { fa: 'بیت شروع و پایان', en: 'Start / stop bit' }, {
    fa: 'در UART خط در حالت بیکار ۱ است؛ هر قاب با بیت شروع ۰ آغاز و با بیت پایان ۱ تمام می‌شود تا گیرنده هم‌گام شود.',
    en: 'A UART line idles at 1; each frame begins with a 0 start bit and ends with a 1 stop bit, so the receiver can lock on.',
  }, 'uart'),
  g('parity', { fa: 'بیت توازن (Parity)', en: 'Parity' }, {
    fa: 'بیت اضافه‌ای که تعداد یک‌ها را زوج یا فرد می‌کند تا خطای تک‌بیتی تشخیص داده شود. قاب 8N1 بیت توازن ندارد.',
    en: 'An extra bit that makes the number of ones even or odd, so a single-bit error can be detected. An 8N1 frame has none.',
  }, 'uart'),
  g('spi', { fa: 'SPI', en: 'SPI' }, {
    fa: 'گذرگاه سریال همگام با کلاک SCLK، خط انتخاب CS و دو خط داده. سریع و ساده است و در هر کلاک یک بیت در هر جهت جابه‌جا می‌شود.',
    en: 'A synchronous serial bus with a clock (SCLK), a chip select (CS) and two data lines. Fast and simple: one bit moves each way per clock.',
  }, 'spi'),
  g('mosi-miso', { fa: 'MOSI و MISO', en: 'MOSI / MISO' }, {
    fa: 'دو خط دادهٔ SPI: MOSI از master به slave و MISO از slave به master.',
    en: 'The two SPI data lines: MOSI carries data from master to slave, MISO from slave to master.',
  }, 'spi'),
  g('cpol-cpha', { fa: 'CPOL و CPHA', en: 'CPOL / CPHA' }, {
    fa: 'دو تنظیم SPI: CPOL سطح بیکار کلاک را تعیین می‌کند و CPHA اینکه داده در کدام لبه نمونه‌برداری شود. با هم چهار «mode» می‌سازند.',
    en: 'Two SPI settings: CPOL sets the clock’s idle level and CPHA which edge samples the data. Together they make the four SPI modes.',
  }, 'spi'),
  g('i2c', { fa: 'I²C', en: 'I²C' }, {
    fa: 'گذرگاه دوسیمه (SCL و SDA) با آدرس‌دهی که چند دستگاه روی آن مشترک‌اند. خط‌ها open-drain هستند و با مقاومت pull-up بالا نگه داشته می‌شوند.',
    en: 'A two-wire bus (SCL and SDA) with addresses, shared by several devices. The lines are open-drain and held high by pull-up resistors.',
  }, 'i2c'),
  g('open-drain', { fa: 'Open-drain', en: 'Open-drain' }, {
    fa: 'خروجی‌ای که فقط می‌تواند خط را به ۰ بکشد یا رها کند؛ ۱ را مقاومت pull-up می‌سازد. در HDL با <code>1\'bz</code> یا <code>\'Z\'</code> رها می‌شود.',
    en: 'An output that can only pull the line to 0 or let it go; the pull-up resistor makes the 1. In HDL it is released with <code>1\'bz</code> or <code>\'Z\'</code>.',
  }, 'i2c'),
  g('pull-up', { fa: 'مقاومت Pull-up', en: 'Pull-up' }, {
    fa: 'مقاومتی بین خط و ولتاژ تغذیه که وقتی هیچ دستگاهی خط را پایین نمی‌کشد، آن را ۱ نگه می‌دارد.',
    en: 'A resistor from the line to the supply that holds it at 1 when no device is pulling it low.',
  }, 'i2c'),
  g('ack-nack', { fa: 'ACK و NACK', en: 'ACK / NACK' }, {
    fa: 'بیت نهم هر بایت در I²C: گیرنده با کشیدن SDA به ۰ دریافت را تأیید می‌کند (ACK)؛ اگر خط ۱ بماند یعنی NACK.',
    en: 'The ninth bit of every I²C byte: the receiver pulls SDA to 0 to acknowledge (ACK); if the line stays 1 it is a NACK.',
  }, 'i2c'),
  g('pwm', { fa: 'PWM', en: 'PWM' }, {
    fa: 'مدولاسیون پهنای پالس: خروجی سریع روشن و خاموش می‌شود و نسبت زمان روشن بودن، میانگین توان (مثلاً نور LED) را تعیین می‌کند.',
    en: 'Pulse-width modulation: the output switches on and off quickly, and the fraction of time it is on sets the average power, such as LED brightness.',
  }, 'pwm'),
  g('duty-cycle', { fa: 'Duty cycle', en: 'Duty cycle' }, {
    fa: 'درصد زمانی از هر دورهٔ PWM که خروجی ۱ است. ۰٪ یعنی همیشه خاموش و ۱۰۰٪ یعنی همیشه روشن.',
    en: 'The percentage of each PWM period that the output is 1. 0% is always off, 100% always on.',
  }, 'pwm'),
  g('seven-segment', { fa: 'نمایشگر هفت‌قطعه‌ای', en: 'Seven-segment display' }, {
    fa: 'نمایشگری با هفت LED خطی (a تا g) که با روشن کردن ترکیب‌های مختلف، رقم‌ها را می‌سازد. روی Nexys A7 کاتدها مشترک و فعال‌پایین‌اند.',
    en: 'A display of seven bar LEDs (a to g) that form digits by lighting different combinations. On the Nexys A7 the segments are shared and active-low.',
  }, 'seg7'),
  g('multiplexing', { fa: 'مالتی‌پلکس کردن نمایشگر', en: 'Multiplexing' }, {
    fa: 'روشن کردن رقم‌های نمایشگر یکی‌یکی و بسیار سریع، با سیم‌های قطعهٔ مشترک. به‌جای ۵۶ سیم فقط ۱۵ سیم لازم است.',
    en: 'Lighting the display’s digits one at a time, very fast, on shared segment wires. It needs 15 wires instead of 56.',
  }, 'multiplex'),
  g('pov', { fa: 'ماندگاری تصویر در چشم', en: 'Persistence of vision' }, {
    fa: 'چشم تغییرهای سریع‌تر از حدود ۶۰ بار در ثانیه را نمی‌بیند؛ برای همین رقم‌هایی که نوبتی روشن می‌شوند هم‌زمان دیده می‌شوند.',
    en: 'The eye cannot follow changes faster than about 60 per second, so digits lit in turn look as if they are all on at once.',
  }, 'multiplex'),
  g('mux', { fa: 'مالتی‌پلکسر', en: 'Multiplexer' }, {
    fa: 'مداری ترکیبی که با ورودی انتخاب، یکی از چند ورودی داده را به خروجی می‌فرستد.',
    en: 'A combinational circuit that sends one of several data inputs to its output, chosen by a select input.',
  }, 'mux'),
  g('vga', { fa: 'VGA', en: 'VGA' }, {
    fa: 'استاندارد تصویر آنالوگ: پیکسل‌ها سطر به سطر با سه سیگنال رنگ و دو پالس همگام‌سازی (HSYNC و VSYNC) فرستاده می‌شوند. ۶۴۰×۴۸۰ با کلاک پیکسل ۲۵ مگاهرتز.',
    en: 'An analogue video standard: pixels are sent line by line on three colour signals with two sync pulses (HSYNC, VSYNC). 640×480 uses a 25 MHz pixel clock.',
  }, 'vga'),
  g('porch', { fa: 'Porch', en: 'Porch' }, {
    fa: 'فاصلهٔ سیاه قبل (front porch) و بعد (back porch) از پالس همگام‌سازی در هر خط یا فریم VGA.',
    en: 'The black interval before (front porch) and after (back porch) the sync pulse in every VGA line or frame.',
  }, 'vga'),
  g('sync-pulse', { fa: 'پالس همگام‌سازی', en: 'Sync pulse' }, {
    fa: 'پالس HSYNC در پایان هر خط و VSYNC در پایان هر فریم به مانیتور می‌گوید به ابتدای خط یا صفحه برگردد.',
    en: 'The HSYNC pulse at the end of each line and the VSYNC pulse at the end of each frame tell the monitor to return to the start.',
  }, 'vga'),
  g('bcd', { fa: 'BCD', en: 'BCD' }, {
    fa: 'کد دهدهی دودویی: هر رقم دهدهی جداگانه با چهار بیت نوشته می‌شود؛ برای نمایش اعداد روی نمایشگر لازم است.',
    en: 'Binary-coded decimal: each decimal digit is written separately in four bits; needed to show numbers on a display.',
  }, 'bin2bcd'),
  g('double-dabble', { fa: 'Double dabble', en: 'Double dabble' }, {
    fa: 'روش تبدیل دودویی به BCD: عدد بیت‌به‌بیت به چپ شیفت می‌شود و هر رقم BCD که ۵ یا بیشتر باشد پیش از شیفت ۳ واحد می‌گیرد.',
    en: 'The binary-to-BCD method: shift the number left one bit at a time, adding 3 to any BCD digit that is 5 or more before each shift.',
  }, 'bin2bcd'),
  g('rom-ram', { fa: 'ROM و RAM', en: 'ROM / RAM' }, {
    fa: 'ROM حافظهٔ فقط‌خواندنی است که محتوایش در سنتز ثابت می‌شود؛ RAM را می‌توان هنگام کار هم نوشت. هر دو از یک آرایه در HDL استنتاج می‌شوند.',
    en: 'A ROM is read-only, its contents fixed at synthesis; a RAM can be written while running. Both are inferred from an array in HDL.',
  }, 'ram'),
  g('soft-core', { fa: 'پردازندهٔ نرم (Soft-core)', en: 'Soft-core' }, {
    fa: 'پردازنده‌ای که از منطق FPGA ساخته شده است، نه از سیلیکون جدا؛ مثل MicroBlaze یا Tiny8 همین دوره.',
    en: 'A processor built from FPGA logic rather than its own silicon, such as MicroBlaze or this course’s Tiny8.',
  }, 'softcore'),
  g('opcode', { fa: 'Opcode', en: 'Opcode' }, {
    fa: 'بخشی از دستور ماشین که می‌گوید چه عملی انجام شود (مثلاً ADD یا JMP). در Tiny8 چهار بیت بالای هر دستور است.',
    en: 'The part of a machine instruction that says which operation to do (ADD or JMP, say). In Tiny8 it is the top four bits.',
  }, 'softcore'),
  g('accumulator', { fa: 'انباره (Accumulator)', en: 'Accumulator' }, {
    fa: 'رجیستر اصلی پردازنده‌های ساده: یک طرف همهٔ عمل‌های ALU و محل نتیجهٔ آن‌هاست.',
    en: 'The main register of a simple processor: one operand of every ALU operation and the place its result goes.',
  }, 'softcore'),
  g('pmod', { fa: 'Pmod', en: 'Pmod' }, {
    fa: 'استاندارد کانکتور ۱۲ پایهٔ Digilent برای ماژول‌های جانبی (دکمه، سنسور، نمایشگر و …). Nexys A7 چهار کانکتور Pmod دارد.',
    en: 'Digilent’s 12-pin connector standard for add-on modules (buttons, sensors, displays and more). The Nexys A7 has four Pmod ports.',
  }, 'sensors'),
  g('tcl', { fa: 'Tcl', en: 'Tcl' }, {
    fa: 'زبان اسکریپت Vivado. هر کاری در رابط گرافیکی یک فرمان Tcl دارد (مثل <code>synth_design</code>) و می‌توان آن را در Tcl Console نوشت.',
    en: 'Vivado’s scripting language. Every GUI action has a Tcl command (such as <code>synth_design</code>) that you can type in the Tcl Console.',
  }, 'intro'),
  g('utilization', { fa: 'Utilization', en: 'Utilization' }, {
    fa: 'گزارش منابع مصرف‌شده: چند LUT، فلیپ‌فلاپ، BRAM و DSP از ظرفیت تراشه استفاده شده است.',
    en: 'The resource report: how many of the chip’s LUTs, flip-flops, BRAMs and DSPs the design uses.',
  }, 'ram'),
  g('fmax', { fa: 'Fmax', en: 'Fmax' }, {
    fa: 'بیشترین فرکانس کلاکی که طرح با آن درست کار می‌کند؛ یک تقسیم بر تأخیر طولانی‌ترین مسیر رجیستر به رجیستر.',
    en: 'The highest clock frequency at which the design still works: one over the delay of the longest register-to-register path.',
  }, 'timing'),
  g('setup-hold', { fa: 'زمان Setup و Hold', en: 'Setup / hold time' }, {
    fa: 'ورودی فلیپ‌فلاپ باید مدتی قبل از لبهٔ کلاک (setup) و مدتی بعد از آن (hold) ثابت بماند؛ وگرنه مقدار نادرست یا شبه‌پایدار ذخیره می‌شود.',
    en: 'A flip-flop’s input must be stable for a while before the clock edge (setup) and after it (hold); otherwise a wrong or metastable value is stored.',
  }, 'timing'),
  g('slack', { fa: 'Slack', en: 'Slack' }, {
    fa: 'حاشیهٔ زمانی یک مسیر: دورهٔ کلاک منهای تأخیر مسیر. مثبت یعنی زمان‌بندی برقرار است و منفی یعنی مسیر خیلی کند است (WNS بدترین آن است).',
    en: 'A path’s timing margin: the clock period minus the path delay. Positive means timing is met, negative that the path is too slow (WNS is the worst).',
  }, 'timing'),
  g('pipeline', { fa: 'Pipeline', en: 'Pipeline' }, {
    fa: 'شکستن یک محاسبهٔ طولانی با رجیسترهای میانی؛ هر مرحله کوتاه‌تر می‌شود و Fmax بالا می‌رود، به بهای چند کلاک تأخیر.',
    en: 'Splitting a long calculation with registers in between; each stage gets shorter and Fmax rises, at the cost of a few clocks of latency.',
  }, 'timing'),
  g('mmcm-pll', { fa: 'MMCM و PLL', en: 'MMCM / PLL' }, {
    fa: 'بلوک‌های سخت‌افزاری مدیریت کلاک که از یک کلاک ورودی، کلاک‌های تمیز با فرکانس یا فاز دیگر می‌سازند (مثلاً ۲۵ مگاهرتز برای VGA).',
    en: 'Hard clock-management blocks that make clean clocks of other frequencies or phases from an input clock, for example 25 MHz for VGA.',
  }, 'clocking'),
  g('ps', { fa: 'PS (سامانه‌ی پردازشی)', en: 'PS (processing system)' }, {
    fa: 'بخش پردازنده‌ی تراشه‌ی Zynq: دو هسته‌ی ARM، کنترلر DDR و تجهیزات سخت مثل UART، SD و MAC شبکه. بدون PL هم کار می‌کند.',
    en: 'The processor half of a Zynq: two ARM cores, the DDR controller and hard peripherals such as UART, SD and the Ethernet MAC. It works without the PL.',
  }, 'z-intro'),
  g('pl', { fa: 'PL (منطق برنامه‌پذیر)', en: 'PL (programmable logic)' }, {
    fa: 'بخش FPGAی تراشه‌ی Zynq با LUT، فلیپ‌فلاپ، BRAM و DSP. طرح‌های HDL شما اینجا اجرا می‌شوند و PS آن را پیکربندی می‌کند.',
    en: 'The FPGA half of a Zynq, with LUTs, flip-flops, BRAM and DSP. Your HDL designs run here, and the PS configures it.',
  }, 'z-intro'),
  g('mio', { fa: 'MIO', en: 'MIO' }, {
    fa: '۵۴ پایه‌ی ثابت تجهیزات PS در Zynq، مثل UART، SD و NAND. بدون عبور از PL به بیرون می‌روند.',
    en: 'The 54 fixed pins of the PS peripherals on a Zynq, such as UART, SD and NAND. They reach the outside without passing through the PL.',
  }, 'z-intro'),
  g('emio', { fa: 'EMIO', en: 'EMIO' }, {
    fa: 'مسیری که یک تجهیز PS را از داخل PL به پایه‌های PL می‌برد. MAC شبکه‌ی EBAZ4205 و GPIO برای LEDها از آن استفاده می‌کنند.',
    en: 'The path that takes a PS peripheral through the PL to PL pins. The EBAZ4205 Ethernet MAC and the LED GPIO use it.',
  }, 'z-intro'),
  g('axi', { fa: 'AXI', en: 'AXI' }, {
    fa: 'گذرگاه استاندارد ARM برای خواندن و نوشتن بین PS و منطق PL، با کانال‌های جدا برای آدرس، داده و پاسخ.',
    en: 'ARM’s standard bus for reads and writes between the PS and PL logic, with separate channels for address, data and response.',
  }, 'z-intro'),
  g('fclk', { fa: 'FCLK_CLK0..3', en: 'FCLK_CLK0..3' }, {
    fa: 'چهار کلاکی که PS به PL می‌دهد. روی EBAZ4205 کلاک PL همان FCLK_CLK0 با ۵۰ مگاهرتز است و فقط بعد از ps7_init روشن می‌شود.',
    en: 'The four clocks the PS gives the PL. On the EBAZ4205 the PL clock is FCLK_CLK0 at 50 MHz; it only starts after ps7_init.',
  }, 'z-blink'),
  g('bootrom', { fa: 'BootROM', en: 'BootROM' }, {
    fa: 'کد ثابت داخل Zynq که اول از همه اجرا می‌شود، حالت بوت را می‌خواند و FSBL را در OCM کپی می‌کند.',
    en: 'Fixed code inside the Zynq that runs first, reads the boot mode and copies the FSBL into OCM.',
  }, 'z-bootflow'),
  g('fsbl', { fa: 'FSBL', en: 'FSBL' }, {
    fa: 'بوت‌لودر مرحله‌ی اول: DDR و کلاک‌ها را با ps7_init راه می‌اندازد، bitstream را در PL بار می‌کند و برنامه را در DDR اجرا می‌کند.',
    en: 'First-stage boot loader: starts the DDR and clocks with ps7_init, loads the bitstream into the PL and starts the application in DDR.',
  }, 'z-bootflow'),
  g('ocm', { fa: 'OCM', en: 'OCM' }, {
    fa: 'حافظه‌ی ۲۵۶ کیلوبایتی داخل Zynq. FSBL قبل از راه‌اندازی DDR اینجا اجرا می‌شود.',
    en: 'The 256 KB on-chip memory of a Zynq. The FSBL runs here before the DDR is set up.',
  }, 'z-bootflow'),
  g('bootbin', { fa: 'BOOT.bin', en: 'BOOT.bin' }, {
    fa: 'فایل بوت Zynq که bootgen از یک فایل bif می‌سازد: FSBL، bitstream و برنامه به همین ترتیب. روی کارت SD در پارتیشن FAT است.',
    en: 'The Zynq boot file that bootgen builds from a bif file: FSBL, bitstream and application, in that order. It sits on the FAT partition of an SD card.',
  }, 'z-bootflow'),
  g('xsa', { fa: 'XSA', en: 'XSA' }, {
    fa: 'فایل توصیف سخت‌افزار که Vivado برای Vitis export می‌کند: تنظیمات PS، نقشه‌ی آدرس‌ها و در صورت انتخاب، bitstream.',
    en: 'The hardware description Vivado exports for Vitis: the PS settings, the address map and, if chosen, the bitstream.',
  }, 'z-ps-hello'),
  g('gmii', { fa: 'GMII و MII', en: 'GMII / MII' }, {
    fa: 'رابط‌های بین MAC و PHY شبکه. GMII هشت بیتی است (گیگابیت) و MII چهار بیتی (۱۰۰ مگابیت).',
    en: 'Interfaces between an Ethernet MAC and PHY. GMII is 8 bits wide (gigabit), MII 4 bits (100 Mbit).',
  }, 'z-ethernet'),
  g('phy', { fa: 'PHY', en: 'PHY' }, {
    fa: 'تراشه‌ای که بیت‌های MAC را به سیگنال الکتریکی کابل شبکه تبدیل می‌کند. روی EBAZ4205 مدل IP101GA است.',
    en: 'The chip that turns MAC bits into electrical signals on the network cable. On the EBAZ4205 it is an IP101GA.',
  }, 'z-ethernet'),
  g('mdio', { fa: 'MDIO', en: 'MDIO' }, {
    fa: 'گذرگاه دوسیمه‌ی مدیریت (MDC و MDIO) که MAC با آن رجیسترهای PHY را می‌خواند و می‌نویسد.',
    en: 'The two-wire management bus (MDC and MDIO) the MAC uses to read and write PHY registers.',
  }, 'z-ethernet'),
];

export const glossaryTerm = (id: string) => GLOSSARY.find((t) => t.id === id);

// alphabetical in the page language (Persian collation for fa)
export function sortedGlossary(lang: 'fa' | 'en'): GlossaryTerm[] {
  const coll = new Intl.Collator(lang === 'fa' ? 'fa' : 'en', { sensitivity: 'base' });
  return [...GLOSSARY].sort((a, b) => coll.compare(a.term[lang], b.term[lang]));
}
