// The quick-check quiz: three concept questions per course lesson. Option order and answers match across languages;
// the wrong options are common misconceptions.
import type { Question } from './predict';

const q = (text: string, options: string[], answer: number, why: string): Question => ({ q: text, options, answer, why });

export const QUIZ: Record<string, { fa: Question[]; en: Question[] }> = {
  intro: {
    fa: [
      q('بخش‌های یک طرح FPGA چطور کار می‌کنند؟', ['همه هم‌زمان، چون مدار واقعی ساخته می‌شود', 'یکی‌یکی، مثل دستورهای یک برنامه', 'به ترتیب خط‌های کد', 'فقط وقتی کلاک ۱۰۰ مگاهرتز است'], 0, 'FPGA دستور اجرا نمی‌کند؛ مدار ساخته می‌شود و همهٔ بخش‌ها موازی کار می‌کنند.'),
      q('فایل XDC چه کاری انجام می‌دهد؟', ['منطق مدار را توصیف می‌کند', 'پورت‌های طرح را به پایه‌های تراشه وصل می‌کند', 'طرح را شبیه‌سازی می‌کند', 'bitstream را می‌سازد'], 1, 'XDC قیدهاست: کدام پورت روی کدام پایه، و کلاک چه فرکانسی دارد.'),
      q('LUT در FPGA چیست؟', ['یک بیت حافظه که با کلاک به‌روز می‌شود', 'یک جدول کوچک که هر تابع منطقی چند ورودی را پیاده می‌کند', 'سیم‌کشی بین بلوک‌ها', 'یک ضرب‌کنندهٔ آماده'], 1, 'LUT جدول درستی تابع را نگه می‌دارد؛ Flip-Flop حافظه است و Routing سیم‌کشی.'),
    ],
    en: [
      q('How do the parts of an FPGA design work?', ['All at the same time, because a real circuit is built', 'One after another, like the instructions of a program', 'In the order of the code lines', 'Only while the clock is 100 MHz'], 0, 'An FPGA runs no instructions; a circuit is built and every part works in parallel.'),
      q('What does the XDC file do?', ['It describes the circuit’s logic', 'It connects the design’s ports to the chip’s pins', 'It simulates the design', 'It builds the bitstream'], 1, 'The XDC holds constraints: which port goes to which pin, and the clock’s frequency.'),
      q('What is a LUT in an FPGA?', ['One bit of memory updated by the clock', 'A small table that implements any logic function of a few inputs', 'The wiring between blocks', 'A ready-made multiplier'], 1, 'A LUT stores the function’s truth table; the flip-flop is memory and routing is wiring.'),
    ],
  },
  gates: {
    fa: [
      q('خروجی XOR دو ورودی کی ۱ است؟', ['وقتی هر دو ۱ باشند', 'وقتی ورودی‌ها با هم فرق داشته باشند', 'وقتی دست‌کم یکی ۱ باشد', 'وقتی هر دو ۰ باشند'], 1, 'XOR یعنی «یا این یا آن، نه هر دو»؛ برای ۱ و ۱ صفر است.'),
      q('Vivado پنج گیت این درس را روی تراشه چطور می‌سازد؟', ['پنج گیت جدا روی سیلیکون', 'تابع‌ها را در LUTها جا می‌دهد', 'با Flip-Flopها', 'با بلوک DSP'], 1, 'FPGA گیت جدا ندارد؛ سنتز هر تابع را در LUT می‌گذارد و چند گیت را در یک LUT جمع می‌کند.'),
      q('معادل <code>~(a &amp; b)</code> در VHDL کدام است؟', ['<code>a nor b</code>', '<code>a nand b</code>', '<code>not a and b</code>', '<code>a xnor b</code>'], 1, 'NOT روی AND همان NAND است. <code>not a and b</code> فقط a را معکوس می‌کند.'),
    ],
    en: [
      q('When is the XOR of two inputs 1?', ['When both are 1', 'When the inputs differ', 'When at least one is 1', 'When both are 0'], 1, 'XOR means “one or the other, not both”; for 1 and 1 it is 0.'),
      q('How does Vivado build this lesson’s gates on the chip?', ['As separate gates on the silicon', 'It packs the functions into LUTs', 'With flip-flops', 'With a DSP block'], 1, 'An FPGA has no separate gates; synthesis puts each function in LUTs and merges several gates into one.'),
      q('Which VHDL expression equals <code>~(a &amp; b)</code>?', ['<code>a nor b</code>', '<code>a nand b</code>', '<code>not a and b</code>', '<code>a xnor b</code>'], 1, 'NOT of an AND is NAND. <code>not a and b</code> inverts only a.'),
    ],
  },
  mux: {
    fa: [
      q('یک مالتی‌پلکسر ۸ به ۱ چند بیت انتخاب لازم دارد؟', ['۸', '۳', '۲', '۴'], 1, '۲ به توان ۳ می‌شود ۸؛ هر بیت انتخاب تعداد ورودی‌ها را دو برابر می‌کند.'),
      q('اگر در یک <code>always @(*)</code> برای یکی از حالت‌ها مقدار ندهید چه می‌شود؟', ['خروجی صفر می‌شود', 'سنتز یک latch می‌سازد', 'خطای سنتز می‌گیرید', 'هیچ اتفاقی نمی‌افتد'], 1, 'خروجی باید مقدار قبلی را نگه دارد، پس حافظهٔ ناخواسته (latch) ساخته می‌شود.'),
      q('کدام روش در VHDL یک مالتی‌پلکسر نمی‌سازد؟', ['<code>when … else</code>', '<code>with … select</code>', '<code>case</code> در یک process', 'هر سه مالتی‌پلکسر می‌سازند'], 3, 'هر سه روش، توصیف‌های مختلف همان مدار انتخاب‌کننده‌اند.'),
    ],
    en: [
      q('How many select bits does an 8-to-1 multiplexer need?', ['8', '3', '2', '4'], 1, '2 to the power 3 is 8; each select bit doubles the number of inputs.'),
      q('What happens if one case gets no value in an <code>always @(*)</code> block?', ['The output becomes 0', 'Synthesis infers a latch', 'You get a synthesis error', 'Nothing happens'], 1, 'The output must keep its old value, so unwanted memory (a latch) is built.'),
      q('Which VHDL construct does not describe a multiplexer?', ['<code>when … else</code>', '<code>with … select</code>', '<code>case</code> in a process', 'All three describe a multiplexer'], 3, 'All three are different ways to write the same selecting circuit.'),
    ],
  },
  adder: {
    fa: [
      q('جمع‌کنندهٔ کامل با a = 1، b = 1 و cin = 1 چه خروجی دارد؟', ['s = 1، cout = 1', 's = 0، cout = 1', 's = 1، cout = 0', 's = 0، cout = 0'], 0, '۱ + ۱ + ۱ = ۳ یعنی دودویی 11: جمع ۱ و رقم نقلی ۱.'),
      q('در جمع‌کنندهٔ ripple-carry چه چیزی سرعت را محدود می‌کند؟', ['تعداد LEDها', 'رقم نقلی باید از همهٔ طبقه‌ها یکی‌یکی بگذرد', 'فرکانس کلاک', 'پهنای ورودی B'], 1, 'هر طبقه منتظر رقم نقلی طبقهٔ قبل است، پس تأخیر با تعداد بیت‌ها زیاد می‌شود.'),
      q('در طرح‌های واقعی جمع را معمولاً چطور می‌نویسیم؟', ['با نمونه‌های full_adder', 'با عملگر <code>+</code>', 'با یک جدول case بزرگ', 'با Flip-Flopها'], 1, 'سنتز <code>+</code> را روی زنجیرهٔ سریع CARRY4 می‌برد؛ ساختار دستی برای یادگرفتن است.'),
    ],
    en: [
      q('What does a full adder output for a = 1, b = 1 and cin = 1?', ['s = 1, cout = 1', 's = 0, cout = 1', 's = 1, cout = 0', 's = 0, cout = 0'], 0, '1 + 1 + 1 = 3, binary 11: sum 1 and carry 1.'),
      q('What limits the speed of a ripple-carry adder?', ['The number of LEDs', 'The carry must pass through every stage in turn', 'The clock frequency', 'The width of input B'], 1, 'Each stage waits for the previous carry, so the delay grows with the number of bits.'),
      q('How is addition usually written in real designs?', ['With full_adder instances', 'With the <code>+</code> operator', 'With a big case table', 'With flip-flops'], 1, 'Synthesis maps <code>+</code> onto the fast CARRY4 chain; the structural version is for learning.'),
    ],
  },
  seg7: {
    fa: [
      q('در Nexys A7 برای روشن کردن یک سگمنت چه مقداری می‌گذارید؟', ['۱', '۰', '<code>z</code>', 'بستگی به رقم دارد'], 1, 'نمایشگر آند مشترک است و کاتدها فعال‌پایین‌اند: ۰ یعنی روشن.'),
      q('اگر AN = 11111100 باشد چه می‌بینید؟', ['رقم‌های ۰ و ۱ دو عدد مختلف نشان می‌دهند', 'رقم‌های ۰ و ۱ یک نماد را نشان می‌دهند', 'همهٔ رقم‌ها خاموش‌اند', 'فقط رقم ۷ روشن است'], 1, 'همهٔ رقم‌ها خطوط سگمنت مشترک دارند، پس هر رقم روشن همان نماد را نشان می‌دهد.'),
      q('رمزگشای هفت‌قسمتی این درس چه نوع مداری است؟', ['ترتیبی، با کلاک', 'ترکیبی، یک جدول جست‌وجو در LUTها', 'یک ماشین حالت', 'یک شمارنده'], 1, 'خروجی فقط به ورودی فعلی بستگی دارد؛ <code>case</code> یک ROM کوچک می‌سازد.'),
    ],
    en: [
      q('On the Nexys A7, what value lights a segment?', ['1', '0', '<code>z</code>', 'It depends on the digit'], 1, 'The display is common anode and the cathodes are active-low: 0 means on.'),
      q('What do you see with AN = 11111100?', ['Digits 0 and 1 show two different numbers', 'Digits 0 and 1 show the same symbol', 'All digits are off', 'Only digit 7 is on'], 1, 'All digits share the segment lines, so every enabled digit shows the same symbol.'),
      q('What kind of circuit is this lesson’s seven-segment decoder?', ['Sequential, with a clock', 'Combinational, a look-up table in LUTs', 'A state machine', 'A counter'], 1, 'The output depends only on the current input; <code>case</code> builds a small ROM.'),
    ],
  },
  decoder: {
    fa: [
      q('دیکودر ۳ به ۸ وقتی فعال است چند خروجی روشن دارد؟', ['دقیقاً یکی', 'سه تا', 'هشت تا', 'به ورودی بستگی دارد، از صفر تا هشت'], 0, 'دیکودر عدد ورودی را به یکی از خروجی‌ها تبدیل می‌کند: one-hot.'),
      q('در انکودر اولویت‌دار، اگر SW13 و SW10 هر دو روشن باشند کد چیست؟', ['کد SW10', 'کد SW13', 'OR دو کد', 'خطا'], 1, 'شرط‌ها به ترتیب بررسی می‌شوند و بالاترین درخواست برنده است.'),
      q('چرا انکودر اولویت‌دار خروجی valid دارد؟', ['تا سریع‌تر شود', 'چون «بدون درخواست» و «فقط SW8» هر دو کد 000 دارند', 'برای ریست', 'چون Vivado آن را لازم دارد'], 1, 'بدون valid این دو حالت از روی کد قابل تشخیص نیستند.'),
    ],
    en: [
      q('How many outputs of an enabled 3-to-8 decoder are on?', ['Exactly one', 'Three', 'Eight', 'It depends on the input, zero to eight'], 0, 'A decoder turns its input number into one active output: one-hot.'),
      q('In the priority encoder, SW13 and SW10 are both on. What is the code?', ['SW10’s code', 'SW13’s code', 'The OR of both codes', 'An error'], 1, 'The conditions are tested in order and the highest request wins.'),
      q('Why does the priority encoder have a valid output?', ['To make it faster', 'Because “no request” and “only SW8” both give code 000', 'For the reset', 'Because Vivado needs it'], 1, 'Without valid those two cases cannot be told apart from the code.'),
    ],
  },
  shifter: {
    fa: [
      q('فرق چرخش (rotate) با شیفت منطقی چیست؟', ['چرخش بیت‌های بیرون‌افتاده را از سمت دیگر برمی‌گرداند', 'شیفت سریع‌تر است', 'چرخش فقط به چپ است', 'فرقی ندارند'], 0, 'در شیفت منطقی جای خالی با صفر پر می‌شود؛ در چرخش بیت‌ها دور می‌زنند.'),
      q('یک barrel shifter هشت‌بیتی چند طبقهٔ مالتی‌پلکسر دارد؟', ['۸', '۳', '۲', '۷'], 1, 'log₂(8) = 3؛ طبقه‌ها به اندازهٔ ۱، ۲ و ۴ می‌چرخانند.'),
      q('چرخش به چپ به اندازهٔ ۳ در ۸ بیت برابر کدام است؟', ['چرخش به راست به اندازهٔ ۳', 'چرخش به راست به اندازهٔ ۵', 'شیفت به راست به اندازهٔ ۵', 'چرخش به راست به اندازهٔ ۱۱'], 1, 'چرخش به چپ k همان چرخش به راست 8 − k است.'),
    ],
    en: [
      q('How does a rotate differ from a logical shift?', ['A rotate brings the bits that fall off back in at the other end', 'A shift is faster', 'A rotate only goes left', 'There is no difference'], 0, 'A logical shift fills with zeros; in a rotate the bits wrap around.'),
      q('How many mux stages does an 8-bit barrel shifter have?', ['8', '3', '2', '7'], 1, 'log₂(8) = 3; the stages rotate by 1, 2 and 4.'),
      q('Rotating 8 bits left by 3 equals which of these?', ['Rotating right by 3', 'Rotating right by 5', 'Shifting right by 5', 'Rotating right by 11'], 1, 'Rotating left by k is rotating right by 8 − k.'),
    ],
  },
  alu: {
    fa: [
      q('ALU در سخت‌افزار عمل انتخاب‌شده را چطور حساب می‌کند؟', ['فقط همان یک عمل را حساب می‌کند', 'همهٔ عمل‌ها را موازی حساب می‌کند و یک مالتی‌پلکسر یکی را برمی‌دارد', 'عمل‌ها را یکی‌یکی در چند کلاک', 'با یک پردازنده'], 1, 'همهٔ مدارها همیشه هستند؛ op فقط خروجی مالتی‌پلکسر را انتخاب می‌کند.'),
      q('پرچم صفر برای A = 8، B = 8 و ADD چیست؟', ['۱، چون چهار بیت پایین نتیجه صفرند', '۰، چون نتیجه ۱۶ است', '۱، چون A برابر B است', 'تعریف نشده'], 0, '8 + 8 = 10000؛ چهار بیت پایین صفرند و رقم نقلی در بیت ۴ است.'),
      q('در VHDL چرا عملوندها را با <code>resize</code> پنج‌بیتی می‌کنیم؟', ['تا رقم نقلی جمع از دست نرود', 'چون VHDL عدد چهاربیتی ندارد', 'برای سرعت', 'تا LEDها روشن‌تر شوند'], 0, 'VHDL پهنا را از عملوندها می‌گیرد؛ جمع دو عدد چهاربیتی بدون پهن کردن، بیت پنجم را دور می‌ریزد.'),
    ],
    en: [
      q('How does an ALU compute the selected operation in hardware?', ['It computes only that one operation', 'It computes every operation in parallel and a mux picks one', 'One operation per clock, in turn', 'With a processor'], 1, 'All the circuits are always there; op only chooses the multiplexer output.'),
      q('What is the zero flag for A = 8, B = 8 and ADD?', ['1, because the low four result bits are zero', '0, because the result is 16', '1, because A equals B', 'Undefined'], 0, '8 + 8 = 10000; the low four bits are zero and the carry is in bit 4.'),
      q('Why are the VHDL operands widened to five bits with <code>resize</code>?', ['So the carry of the sum is not lost', 'Because VHDL has no 4-bit numbers', 'For speed', 'To make the LEDs brighter'], 0, 'VHDL takes the width from the operands; adding two 4-bit numbers without widening drops bit 5.'),
    ],
  },
  ff: {
    fa: [
      q('Flip-Flop نوع D کی مقدار D را ذخیره می‌کند؟', ['هر وقت D عوض شود', 'فقط روی لبهٔ بالارونده کلاک', 'وقتی کلاک ۱ است', 'وقتی ریست فشرده است'], 1, 'Flip-Flop به لبه حساس است؛ بین دو لبه مقدارش ثابت می‌ماند.'),
      q('در بلوک کلاک‌دار Verilog کدام انتساب را باید به کار ببرید؟', ['<code>=</code>', '<code>&lt;=</code>', '<code>assign</code>', 'فرقی ندارد'], 1, 'با <code>&lt;=</code> همهٔ Flip-Flopها مقدار قبلی را می‌خوانند و با هم به‌روز می‌شوند.'),
      q('ریست «همگام» یعنی چه؟', ['ریست فوراً، بدون کلاک، اثر می‌کند', 'ریست فقط روی لبهٔ کلاک اثر می‌کند', 'ریست همهٔ بردها را با هم ریست می‌کند', 'ریست فعال‌بالاست'], 1, 'در این درس شرط ریست داخل <code>rising_edge</code> است، پس با لبهٔ بعدی کلاک اثر می‌کند.'),
    ],
    en: [
      q('When does a D flip-flop store D?', ['Whenever D changes', 'Only on the rising clock edge', 'While the clock is 1', 'While reset is pressed'], 1, 'A flip-flop is edge-triggered; between edges its value stays put.'),
      q('Which assignment belongs in a clocked Verilog block?', ['<code>=</code>', '<code>&lt;=</code>', '<code>assign</code>', 'Either one'], 1, 'With <code>&lt;=</code> every flip-flop reads the old values and they all update together.'),
      q('What does a “synchronous” reset mean?', ['The reset acts at once, without the clock', 'The reset takes effect only on a clock edge', 'The reset resets every board together', 'The reset is active-high'], 1, 'Here the reset test sits inside <code>rising_edge</code>, so it acts on the next clock edge.'),
    ],
  },
  counter: {
    fa: [
      q('برای یک رویداد هر ۱ میلی‌ثانیه در ۱۰۰ مگاهرتز تا چند باید بشمارید؟', ['۱۰۰٬۰۰۰', '۱٬۰۰۰', '۱۰۰٬۰۰۰٬۰۰۰', '۱۰٬۰۰۰'], 0, '۰٫۰۰۱ ثانیه × ۱۰۰٬۰۰۰٬۰۰۰ هرتز = ۱۰۰٬۰۰۰ کلاک.'),
      q('شمارنده‌ای که تا ۵۰ میلیون می‌شمارد دست‌کم چند بیت می‌خواهد؟', ['۲۴', '۲۶', '۳۲', '۵۰'], 1, '۲ به توان ۲۶ حدود ۶۷ میلیون است و ۲ به توان ۲۵ کمتر از ۵۰ میلیون.'),
      q('چرا به جای ساختن یک کلاک کند، از یک پالس فعال‌ساز (tick) استفاده می‌کنیم؟', ['تا همه‌چیز روی همان یک کلاک بماند', 'چون FPGA فقط یک کلاک دارد', 'چون tick سریع‌تر است', 'فرقی ندارد'], 0, 'طرح با یک کلاک ساده و قابل اعتماد است؛ tick فقط می‌گوید کی کار انجام شود.'),
    ],
    en: [
      q('At 100 MHz, how far must you count for an event every 1 ms?', ['100,000', '1,000', '100,000,000', '10,000'], 0, '0.001 s × 100,000,000 Hz = 100,000 clocks.'),
      q('How many bits does a counter that reaches 50 million need at least?', ['24', '26', '32', '50'], 1, '2 to the 26 is about 67 million, and 2 to the 25 is under 50 million.'),
      q('Why use an enable pulse (tick) instead of making a slow clock?', ['So everything stays on the one clock', 'Because an FPGA has only one clock', 'Because a tick is faster', 'It makes no difference'], 0, 'A one-clock design is simple and reliable; the tick only says when to act.'),
    ],
  },
  testbench: {
    fa: [
      q('Testbench چند پورت دارد؟', ['هیچ', 'همان پورت‌های طرح', 'فقط کلاک', 'یک پورت برای هر سیگنال'], 0, 'Testbench بالاترین سطح است و به هیچ پایه‌ای وصل نیست؛ DUT را داخل خودش نمونه می‌سازد.'),
      q('اگر <code>#10</code> را داخل خود طرح بنویسید چه می‌شود؟', ['۱۰ نانوثانیه تأخیر روی برد', 'خطای سنتز، چون تأخیر سنتز نمی‌شود', 'کلاک ۱۰ برابر کند می‌شود', 'هیچ‌چیز'], 1, 'تأخیرها فقط در شبیه‌سازی معنا دارند؛ سخت‌افزار چیزی به اسم «صبر کن ۱۰ نانوثانیه» ندارد.'),
      q('چرا Testbench مقدار DIV را ۴ می‌گذارد؟', ['تا شبیه‌سازی به جای میلیون‌ها کلاک فقط چند کلاک طول بکشد', 'چون روی برد هم ۴ است', 'چون DIV بزرگ خطا می‌دهد', 'برای کم کردن LUTها'], 0, 'رفتار شمارنده همان است، فقط سریع‌تر؛ روی برد مقدار پیش‌فرض می‌ماند.'),
    ],
    en: [
      q('How many ports does a testbench have?', ['None', 'The same as the design', 'Only the clock', 'One per signal'], 0, 'The testbench is the top level and connects to no pins; it instantiates the DUT inside.'),
      q('What happens if you write <code>#10</code> inside the design itself?', ['A 10 ns delay on the board', 'A synthesis error, delays are not synthesized', 'The clock gets ten times slower', 'Nothing'], 1, 'Delays only mean something in simulation; hardware has no “wait 10 ns” element.'),
      q('Why does the testbench set DIV to 4?', ['So the simulation takes a few clocks instead of millions', 'Because the board uses 4 too', 'Because a large DIV is an error', 'To save LUTs'], 0, 'The counter behaves the same, only faster; the board keeps the default.'),
    ],
  },
  shiftreg: {
    fa: [
      q('در شیفت رجیستر <code>sr &lt;= {sr[6:0], SW[0]}</code> بیت تازه کجا وارد می‌شود؟', ['بیت ۰', 'بیت ۷', 'وسط', 'هر بار جای تصادفی'], 0, 'SW[0] پایین‌ترین بیت می‌شود و بقیه یک خانه بالا می‌روند.'),
      q('اگر LFSR صفر شود چه می‌شود؟', ['دوباره از ۱ شروع می‌کند', 'برای همیشه صفر می‌ماند', 'به حالت تصادفی می‌رود', 'خطای سنتز'], 1, 'XOR صفرها صفر است، پس بیت تازه همیشه صفر است و LFSR گیر می‌کند.'),
      q('یک LFSR هشت‌بیتی با tapهای درست چند حالت پیش از تکرار می‌گذراند؟', ['۲۵۶', '۲۵۵', '۱۲۸', '۸'], 1, 'همهٔ ۲۵۶ حالت به جز صفر، یعنی ۲۵۵.'),
    ],
    en: [
      q('In the shift register <code>sr &lt;= {sr[6:0], SW[0]}</code>, where does the new bit enter?', ['Bit 0', 'Bit 7', 'The middle', 'A random place each time'], 0, 'SW[0] becomes the lowest bit and the others move up one place.'),
      q('What happens if an LFSR becomes zero?', ['It starts again from 1', 'It stays zero forever', 'It jumps to a random state', 'A synthesis error'], 1, 'The XOR of zeros is zero, so the new bit is always zero and the LFSR is stuck.'),
      q('How many states does an 8-bit LFSR with the right taps pass before repeating?', ['256', '255', '128', '8'], 1, 'All 256 states except zero, so 255.'),
    ],
  },
  multiplex: {
    fa: [
      q('چرا نمی‌شود چهار رقم مختلف را هم‌زمان روشن کرد؟', ['چون رقم‌ها خطوط سگمنت مشترک دارند', 'چون جریان کافی نیست', 'چون AN فقط یک بیت است', 'می‌شود، فقط گران است'], 0, 'همهٔ رقم‌ها همان CA..CG را می‌بینند؛ پس هر بار یک رقم روشن می‌شود.'),
      q('اگر سرعت refresh خیلی کم شود (مثلاً ۵ بار در ثانیه) چه می‌بینید؟', ['همه ثابت ولی کم‌نور', 'رقم‌ها یکی‌یکی چشمک می‌زنند', 'همه خاموش‌اند', 'همه یک عدد نشان می‌دهند'], 1, 'زیر حدود ۶۰ بار در ثانیه چشم روشن و خاموش شدن هر رقم را می‌بیند.'),
      q('در این طرح چند رمزگشای هفت‌قسمتی لازم است؟', ['یکی', 'چهار', 'هشت', 'به تعداد LEDها'], 0, 'در هر لحظه فقط یک رقم روشن است، پس یک رمزگشا نیبل همان رقم را رمزگشایی می‌کند.'),
    ],
    en: [
      q('Why can four different digits not be lit at the same time?', ['The digits share their segment lines', 'There is not enough current', 'AN is only one bit', 'They can, it is just expensive'], 0, 'Every digit sees the same CA..CG, so one digit is lit at a time.'),
      q('What do you see if the refresh is very slow, say 5 times a second?', ['All steady but dim', 'The digits flash one by one', 'All off', 'All show the same number'], 1, 'Below about 60 times a second the eye sees each digit turn on and off.'),
      q('How many seven-segment decoders does this design need?', ['One', 'Four', 'Eight', 'One per LED'], 0, 'Only one digit is lit at a time, so one decoder handles the active digit’s nibble.'),
    ],
  },
  stopwatch: {
    fa: [
      q('عدد ۵۷ در BCD چطور نوشته می‌شود؟', ['0101 0111', '0011 1001', '0111 0101', '0101 1001'], 0, 'هر رقم دهدهی جدا در ۴ بیت: ۵ = 0101 و ۷ = 0111. عدد دوم ۵۷ دودویی است.'),
      q('فایدهٔ BCD در این زمان‌سنج چیست؟', ['هر رقم مستقیم به رمزگشا می‌رود و تقسیم بر ۱۰ لازم نیست', 'Flip-Flop کمتری می‌خواهد', 'سریع‌تر می‌شمارد', 'دقیق‌تر است'], 0, 'BCD چند بیت بیشتر از دودویی می‌خواهد، ولی نمایشش ساده است.'),
      q('رقم ثانیه کی یکی به رقم ده‌ثانیه اضافه می‌کند؟', ['هر ثانیه', 'وقتی از ۹ به ۰ برمی‌گردد', 'وقتی به ۵ می‌رسد', 'هر ۰٫۱ ثانیه'], 1, 'مثل کیلومترشمار: رقم وقتی از ۹ رد می‌شود صفر می‌شود و به رقم بعد یکی می‌دهد.'),
    ],
    en: [
      q('How is 57 written in BCD?', ['0101 0111', '0011 1001', '0111 0101', '0101 1001'], 0, 'Each decimal digit in its own 4 bits: 5 = 0101 and 7 = 0111. The second option is 57 in binary.'),
      q('What does BCD buy this stopwatch?', ['Each digit goes straight to a decoder, no division by 10', 'It needs fewer flip-flops', 'It counts faster', 'It is more accurate'], 0, 'BCD takes a few more bits than binary, but it is easy to display.'),
      q('When does the seconds digit carry into the tens of seconds?', ['Every second', 'When it wraps from 9 to 0', 'When it reaches 5', 'Every 0.1 s'], 1, 'Like an odometer: a digit going past 9 returns to 0 and adds one to the next.'),
    ],
  },
  fsm: {
    fa: [
      q('در ماشین Moore خروجی به چه بستگی دارد؟', ['فقط به حالت فعلی', 'به حالت و ورودی‌ها', 'فقط به ورودی‌ها', 'به کلاک'], 0, 'در ماشین Mealy خروجی به ورودی‌ها هم بستگی دارد؛ در Moore فقط به حالت.'),
      q('در چراغ راهنمایی، اگر BTNC را در حالت RED بزنید چه می‌شود؟', ['فوراً زرد می‌شود', 'هیچ، فقط در GREEN اثر دارد', 'به GREEN می‌رود', 'ریست می‌شود'], 1, 'شرط BTNC فقط در شاخهٔ GREEN بررسی می‌شود.'),
      q('چرا حالت‌ها را با نام (enum) تعریف می‌کنیم؟', ['کد خواناتر است و سنتز خودش کدگذاری را انتخاب می‌کند', 'چون عدد مجاز نیست', 'تا Flip-Flop لازم نباشد', 'برای سرعت شبیه‌سازی'], 0, 'Vivado کدگذاری (مثلاً one-hot) را خودش انتخاب می‌کند و در گزارش FSM نشان می‌دهد.'),
    ],
    en: [
      q('In a Moore machine, what do the outputs depend on?', ['Only the current state', 'The state and the inputs', 'Only the inputs', 'The clock'], 0, 'In a Mealy machine the outputs also depend on the inputs; in Moore only on the state.'),
      q('In the traffic light, what happens if you press BTNC during RED?', ['It turns yellow at once', 'Nothing, it only matters in GREEN', 'It goes to GREEN', 'It resets'], 1, 'The BTNC condition is only tested in the GREEN branch.'),
      q('Why define the states by name (an enum)?', ['The code reads better and synthesis picks the encoding', 'Because numbers are not allowed', 'So no flip-flops are needed', 'To speed up simulation'], 0, 'Vivado chooses an encoding (one-hot, say) and shows it in the FSM report.'),
    ],
  },
  debounce: {
    fa: [
      q('چرا یک فشار دکمه بدون debouncer چند بار شمرده می‌شود؟', ['تماس‌های فلزی چند میلی‌ثانیه می‌لرزند و مدار سریع هر لرزش را می‌بیند', 'چون کلاک خیلی کند است', 'چون دکمه فعال‌پایین است', 'چون شمارنده اشتباه است'], 0, 'در ۱۰۰ مگاهرتز یک لرزش ۱ میلی‌ثانیه‌ای ۱۰۰ هزار کلاک است.'),
      q('آشکارساز لبه برای یک فشار طولانی چند پالس می‌دهد؟', ['یکی', 'یکی در هر کلاک تا رها شود', 'دو تا، فشار و رها', 'هیچ'], 0, '<code>level &amp; ~prev</code> فقط در کلاکی که دکمه تازه پایین رفته ۱ است.'),
      q('debouncer این درس ورودی را کی می‌پذیرد؟', ['بعد از ۱۰ میلی‌ثانیه بدون تغییر', 'در اولین لبه', 'وقتی دکمه رها شود', 'هر ۱۰ میلی‌ثانیه یک بار، هر چه باشد'], 0, 'در حالت‌های WAIT اگر ورودی پیش از ۱۰ میلی‌ثانیه برگردد، FSM به حالت قبل برمی‌گردد.'),
    ],
    en: [
      q('Why does one press count several times without a debouncer?', ['The contacts bounce for milliseconds and a fast circuit sees every bounce', 'Because the clock is too slow', 'Because the button is active-low', 'Because the counter is wrong'], 0, 'At 100 MHz a 1 ms bounce lasts 100 thousand clocks.'),
      q('How many pulses does the edge detector give for one long press?', ['One', 'One per clock until release', 'Two, press and release', 'None'], 0, '<code>level &amp; ~prev</code> is 1 only in the clock where the button has just gone down.'),
      q('When does this lesson’s debouncer accept the input?', ['After 10 ms without a change', 'On the first edge', 'When the button is released', 'Every 10 ms, whatever it is'], 0, 'In the WAIT states, if the input changes back before 10 ms, the FSM returns to the old state.'),
    ],
  },
  bin2bcd: {
    fa: [
      q('در FSMD چه چیزی کار محاسبه را انجام می‌دهد؟', ['مسیر داده (ثبات‌ها و واحدهای حسابی)', 'ماشین حالت', 'کلاک', 'نمایشگر'], 0, 'ماشین حالت فقط ترتیب کارها را کنترل می‌کند؛ محاسبه در مسیر داده است.'),
      q('در double dabble، پیش از شیفت با رقمی که ۷ است چه می‌کنیم؟', ['۳ اضافه می‌کنیم', '۶ اضافه می‌کنیم', 'هیچ کاری', 'صفرش می‌کنیم'], 0, 'رقم ۵ یا بیشتر بعد از شیفت از ۹ می‌گذرد؛ ۳ پیش از شیفت همان ۶ بعد از شیفت است.'),
      q('چرا به جای تقسیم بر ۱۰ از double dabble استفاده می‌کنیم؟', ['تقسیم‌کننده در سخت‌افزار بزرگ و کند است', 'تقسیم در Verilog مجاز نیست', 'double dabble دقیق‌تر است', 'چون FPGA عدد اعشاری ندارد'], 0, 'شیفت و جمع با ۳ مدار کوچکی می‌سازد که هر کلاک یک قدم برمی‌دارد.'),
    ],
    en: [
      q('In an FSMD, what does the computing?', ['The datapath (registers and arithmetic units)', 'The state machine', 'The clock', 'The display'], 0, 'The state machine only sequences the steps; the work happens in the datapath.'),
      q('In double dabble, what do you do with a digit of 7 before the shift?', ['Add 3', 'Add 6', 'Nothing', 'Clear it'], 0, 'A digit of 5 or more passes 9 after the shift; 3 before the shift is 6 after it.'),
      q('Why use double dabble instead of dividing by 10?', ['A hardware divider is large and slow', 'Division is not allowed in Verilog', 'Double dabble is more accurate', 'Because an FPGA has no decimals'], 0, 'Shifting and adding 3 makes a small circuit that takes one step per clock.'),
    ],
  },
  uart: {
    fa: [
      q('خط UART در حالت بیکار چه مقداری دارد؟', ['۱', '۰', '<code>z</code>', 'هر بار فرق می‌کند'], 0, 'بیت شروع ۰ است، پس گیرنده افتادن خط از ۱ به ۰ را شروع قاب می‌داند.'),
      q('در قاب 8N1 کدام بیت داده اول فرستاده می‌شود؟', ['کم‌ارزش‌ترین بیت (LSB)', 'پرارزش‌ترین بیت (MSB)', 'بیت توازن', 'به baud بستگی دارد'], 0, 'UART داده را از LSB می‌فرستد؛ N یعنی بدون بیت توازن.'),
      q('یک قاب 8N1 در ۱۱۵۲۰۰ baud چقدر طول می‌کشد؟', ['حدود ۸۷ میکروثانیه (۱۰ بیت)', 'حدود ۷۰ میکروثانیه (۸ بیت)', '۸٫۶۸ میکروثانیه', '۱ میلی‌ثانیه'], 0, 'شروع + ۸ داده + پایان = ۱۰ بیت، هرکدام ۸٫۶۸ میکروثانیه.'),
    ],
    en: [
      q('What level does a UART line idle at?', ['1', '0', '<code>z</code>', 'It varies'], 0, 'The start bit is 0, so the receiver takes the fall from 1 to 0 as the start of a frame.'),
      q('Which data bit goes first in an 8N1 frame?', ['The least significant bit (LSB)', 'The most significant bit (MSB)', 'The parity bit', 'It depends on the baud rate'], 0, 'UART sends data LSB first; N means no parity bit.'),
      q('How long is one 8N1 frame at 115200 baud?', ['About 87 µs (10 bits)', 'About 70 µs (8 bits)', '8.68 µs', '1 ms'], 0, 'Start + 8 data + stop = 10 bits of 8.68 µs each.'),
    ],
  },
  uart_rx: {
    fa: [
      q('چرا ورودی RX از دو Flip-Flop پشت سر هم می‌گذرد؟', ['چون با کلاک ما هم‌زمان نیست و ممکن است Flip-Flop اول ناپایدار شود', 'برای دو برابر کردن سرعت', 'برای حذف لرزش', 'چون UART دو سیم دارد'], 0, 'synchronizer خطر metastability را پیش از رسیدن سیگنال به منطق کم می‌کند.'),
      q('گیرنده هر بیت را کجا نمونه می‌گیرد؟', ['وسط بیت', 'اول بیت', 'آخر بیت', 'روی هر لبه'], 0, 'وسط بیت از لبه‌ها دورترین نقطه است و اختلاف سرعت کوچک را تحمل می‌کند.'),
      q('ثبات <code>pend</code> چرا لازم است؟', ['بایت بعدی ممکن است برسد وقتی فرستنده هنوز مشغول است', 'برای تبدیل به حروف بزرگ', 'برای شمردن بایت‌ها', 'لازم نیست'], 0, 'گیرنده و فرستنده هم‌زمان کار می‌کنند؛ pend بایت را تا آزاد شدن فرستنده نگه می‌دارد.'),
    ],
    en: [
      q('Why does the RX input pass through two flip-flops in a row?', ['It is not aligned with our clock and the first flip-flop may go metastable', 'To double the speed', 'To remove bounce', 'Because UART has two wires'], 0, 'A synchronizer reduces the risk of metastability before the signal reaches the logic.'),
      q('Where does the receiver sample each bit?', ['In the middle of the bit', 'At its start', 'At its end', 'On every edge'], 0, 'The middle is the farthest point from the edges and tolerates a small speed difference.'),
      q('Why is the <code>pend</code> register needed?', ['The next byte can arrive while the transmitter is still busy', 'To convert to upper case', 'To count bytes', 'It is not needed'], 0, 'Receiver and transmitter run at once; pend keeps a byte until the transmitter is free.'),
    ],
  },
  spi: {
    fa: [
      q('چرا دو طرف SPI لازم نیست از قبل روی سرعت توافق کنند؟', ['چون master کلاک را روی سیم جدا (SCLK) می‌فرستد', 'چون SPI همیشه ۱ مگاهرتز است', 'چون بیت شروع دارد', 'چون دستگاه سرعت را تشخیص می‌دهد'], 0, 'SPI همگام است: دستگاه روی لبه‌های SCLK نمونه می‌گیرد، هر سرعتی که باشد.'),
      q('در حالت ۰، داده روی کدام لبهٔ SCLK نمونه‌برداری می‌شود؟', ['لبهٔ بالارونده', 'لبهٔ پایین‌رونده', 'هر دو لبه', 'وقتی CS بالا می‌رود'], 0, 'CPOL = 0 و CPHA = 0: نمونه روی لبهٔ بالارونده، بیت بعد روی لبهٔ پایین‌رونده.'),
      q('در یک انتقال SPI هشت‌بیتی، master چند بیت دریافت می‌کند؟', ['۸', '۰، چون فقط می‌فرستد', '۱، فقط ACK', '۱۶'], 0, 'هر کلاک یک بیت روی MOSI می‌رود و یک بیت روی MISO برمی‌گردد.'),
    ],
    en: [
      q('Why don’t the two SPI sides need to agree on a speed in advance?', ['The master sends the clock on its own wire (SCLK)', 'SPI is always 1 MHz', 'It has a start bit', 'The device detects the speed'], 0, 'SPI is synchronous: the device samples on the SCLK edges, whatever their rate.'),
      q('In mode 0, on which SCLK edge is data sampled?', ['The rising edge', 'The falling edge', 'Both edges', 'When CS goes high'], 0, 'CPOL = 0 and CPHA = 0: sample on the rising edge, shift on the falling edge.'),
      q('In an 8-bit SPI transfer, how many bits does the master receive?', ['8', '0, it only sends', '1, just an ACK', '16'], 0, 'Every clock sends one bit on MOSI and brings one back on MISO.'),
    ],
  },
  i2c: {
    fa: [
      q('در I²C چه کسی خط SDA را به ۱ می‌برد؟', ['مقاومت pull-up', 'master', 'دستگاهی که داده می‌فرستد', 'هیچ‌کس، خط همیشه ۰ است'], 0, 'دستگاه‌ها فقط خط را پایین می‌کشند یا رها می‌کنند؛ pull-up آن را ۱ می‌کند.'),
      q('شرط START در I²C چیست؟', ['افتادن SDA وقتی SCL بالاست', 'افتادن SCL وقتی SDA بالاست', 'یک بیت ۰ مثل UART', 'بالا رفتن SDA وقتی SCL بالاست'], 0, 'در حالت عادی SDA فقط وقتی SCL پایین است عوض می‌شود؛ START و STOP استثنا هستند.'),
      q('اگر هیچ دستگاهی آدرس را نشناسد، بیت ACK چه می‌شود؟', ['۱ می‌ماند (NAK)', '۰ می‌شود', 'master خطای سنتز می‌گیرد', 'خط قفل می‌شود'], 0, 'کسی خط را پایین نمی‌کشد، پس pull-up آن را ۱ نگه می‌دارد.'),
    ],
    en: [
      q('In I²C, who drives SDA to 1?', ['The pull-up resistor', 'The master', 'Whichever device is sending', 'Nobody, the line is always 0'], 0, 'Devices only pull the line low or let go; the pull-up makes it 1.'),
      q('What is an I²C START condition?', ['SDA falling while SCL is high', 'SCL falling while SDA is high', 'A 0 bit like in UART', 'SDA rising while SCL is high'], 0, 'Normally SDA changes only while SCL is low; START and STOP are the exceptions.'),
      q('If no device recognises the address, what is the ACK bit?', ['It stays 1 (a NAK)', 'It becomes 0', 'The master gets a synthesis error', 'The bus locks up'], 0, 'Nobody pulls the line low, so the pull-up keeps it at 1.'),
    ],
  },
  pwm: {
    fa: [
      q('با W = 8 و duty = 64 نسبت روشن بودن چقدر است؟', ['۲۵٪', '۶۴٪', '۵۰٪', '۸٪'], 0, '64 / 256 = 0.25.'),
      q('چرا چشم LED را کم‌نور می‌بیند و چشمک نمی‌بیند؟', ['چون PWM صدها هزار بار در ثانیه روشن و خاموش می‌شود و چشم میانگین را می‌بیند', 'چون ولتاژ LED کم می‌شود', 'چون LED نیمه‌روشن است', 'چون شبیه‌ساز کند است'], 0, 'در حدود ۳۹۰ کیلوهرتز چشم فقط میانگین نور را حس می‌کند.'),
      q('فایدهٔ <code>parameter</code> یا <code>generic</code> برای W چیست؟', ['همان ماژول با دقت‌های مختلف به کار می‌رود', 'شبیه‌سازی سریع‌تر می‌شود', 'LUT کمتری می‌خواهد', 'روشنایی را بیشتر می‌کند'], 0, 'هر نمونه می‌تواند W خودش را داشته باشد بدون اینکه کد ماژول عوض شود.'),
    ],
    en: [
      q('With W = 8 and duty = 64, what is the duty cycle?', ['25%', '64%', '50%', '8%'], 0, '64 / 256 = 0.25.'),
      q('Why does the eye see a dim LED rather than a blinking one?', ['PWM switches hundreds of thousands of times a second and the eye averages it', 'The LED voltage drops', 'The LED is half on', 'The simulator is slow'], 0, 'At about 390 kHz the eye only senses the average light.'),
      q('What does a <code>parameter</code> or <code>generic</code> for W give you?', ['The same module at different resolutions', 'A faster simulation', 'Fewer LUTs', 'More brightness'], 0, 'Each instance can have its own W without changing the module’s code.'),
    ],
  },
  sensors: {
    fa: [
      q('FPGA برای رها کردن یک خط open-drain چه مقداری روی آن می‌گذارد؟', ['<code>z</code> (امپدانس بالا)', '۱', '۰', 'هیچ، پایه را خاموش می‌کند'], 0, 'با z خروجی قطع می‌شود و pull-up یا دستگاه دیگر سطح خط را تعیین می‌کند.'),
      q('ثبات دمای 0x0C40 چند درجه است؟', ['۲۴٫۵', '۳۱۳۶', '۱۲٫۲۵', '۴۹'], 0, 'بیت‌های ۱۵ تا ۳ یعنی 0x188 = 392؛ 392 / 16 = 24.5.'),
      q('وقتی FPGA خط TMP_SDA را رها کرده و سنسور آن را پایین می‌کشد، خواندن TMP_SDA چه می‌دهد؟', ['۰، سطح واقعی سیم', '۱، چون FPGA آن را رها کرده', '<code>z</code>', 'آخرین مقداری که FPGA نوشته'], 0, 'پورت inout سطح واقعی سیم را می‌خواند؛ ACK سنسور همین‌طور دیده می‌شود.'),
    ],
    en: [
      q('What value does the FPGA put on an open-drain line to let go of it?', ['<code>z</code> (high impedance)', '1', '0', 'Nothing, it turns the pin off'], 0, 'With z the output disconnects and the pull-up or another device sets the line.'),
      q('How many degrees is the temperature register 0x0C40?', ['24.5', '3136', '12.25', '49'], 0, 'Bits 15 to 3 are 0x188 = 392; 392 / 16 = 24.5.'),
      q('The FPGA let go of TMP_SDA and the sensor pulls it low. What does reading TMP_SDA give?', ['0, the real wire level', '1, because the FPGA let go', '<code>z</code>', 'The last value the FPGA wrote'], 0, 'An inout port reads the real wire level; that is how the sensor’s ACK is seen.'),
    ],
  },
  ps2: {
    fa: [
      q('در PS/2 چه کسی کلاک را می‌سازد؟', ['صفحه‌کلید', 'FPGA', 'کلاک ۱۰۰ مگاهرتز برد', 'هیچ‌کس، ناهمگام است'], 0, 'برخلاف SPI، دستگاه (صفحه‌کلید) کلاک حدود ۱۲٫۵ کیلوهرتز را می‌سازد.'),
      q('وقتی کلید A (کد 1C) را رها می‌کنید صفحه‌کلید چه می‌فرستد؟', ['F0 و بعد 1C', 'فقط 1C دوباره', 'E0 1C', 'هیچ'], 0, 'رها کردن کد break است: F0 و بعد همان کد make.'),
      q('هشت بیت داده 0x1C سه تا یک دارند. بیت توازن فرد چیست؟', ['۰', '۱', 'بستگی به بیت شروع دارد', 'PS/2 توازن ندارد'], 0, 'سه یک خودش فرد است، پس بیت توازن ۰ می‌شود تا مجموع فرد بماند.'),
    ],
    en: [
      q('Who makes the clock in PS/2?', ['The keyboard', 'The FPGA', 'The board’s 100 MHz clock', 'Nobody, it is asynchronous'], 0, 'Unlike SPI, the device (the keyboard) makes the clock of about 12.5 kHz.'),
      q('What does the keyboard send when you release A (code 1C)?', ['F0, then 1C', 'Just 1C again', 'E0 1C', 'Nothing'], 0, 'A release is a break code: F0 followed by the same make code.'),
      q('The data byte 0x1C has three ones. What is the odd parity bit?', ['0', '1', 'It depends on the start bit', 'PS/2 has no parity'], 0, 'Three ones is already odd, so the parity bit is 0 to keep the total odd.'),
    ],
  },
  vga: {
    fa: [
      q('در 640×480 در ۶۰ هرتز، هر خط کامل چند پیکسل (کلاک پیکسل) است؟', ['۸۰۰', '۶۴۰', '۵۲۵', '۷۵۲'], 0, '۶۴۰ دیده‌شدنی + ۱۶ + ۹۶ + ۴۸ = ۸۰۰.'),
      q('چرا در porchها و پالس sync رنگ باید صفر باشد؟', ['مانیتور در این بازه سطح سیاه را اندازه می‌گیرد', 'برای صرفه‌جویی در برق', 'چون حافظهٔ تصویر خالی است', 'لازم نیست'], 0, 'اگر رنگ صفر نباشد مانیتور سطح سیاه را اشتباه تنظیم می‌کند.'),
      q('این طرح چقدر حافظهٔ تصویر دارد؟', ['هیچ، رنگ هر پیکسل همان لحظه از x و y حساب می‌شود', 'یک قاب کامل', 'یک خط', '۴۰۹۶ رنگ'], 0, 'کشیدن تصویر یک مدار ترکیبی است که x و y را به رنگ تبدیل می‌کند.'),
    ],
    en: [
      q('At 640×480 and 60 Hz, how many pixel clocks is one full line?', ['800', '640', '525', '752'], 0, '640 visible + 16 + 96 + 48 = 800.'),
      q('Why must the colour be zero in the porches and the sync pulse?', ['The monitor measures the black level then', 'To save power', 'Because the frame buffer is empty', 'It does not have to be'], 0, 'If the colour is not zero the monitor sets its black level wrong.'),
      q('How much picture memory does this design have?', ['None; each pixel’s colour is computed from x and y on the spot', 'One full frame', 'One line', '4096 colours'], 0, 'Drawing is combinational logic that turns x and y into a colour.'),
    ],
  },
  ram: {
    fa: [
      q('در RAM همگام این درس، داده کی روی خروجی می‌آید؟', ['یک کلاک بعد از آدرس', 'فوراً، بدون کلاک', 'دو کلاک بعد', 'وقتی BTNC فشرده است'], 0, 'خواندن هم روی لبهٔ کلاک ثبت می‌شود؛ Block RAM فقط این نوع خواندن را دارد.'),
      q('چرا لازم نیست Block RAM را دستی نمونه‌سازی کنید؟', ['Vivado حافظه را از الگوی استاندارد تشخیص می‌دهد', 'چون FPGA حافظه ندارد', 'چون Flip-Flopها کافی‌اند', 'باید دستی نمونه‌سازی کرد'], 0, 'به این کار inference می‌گویند؛ الگو را درست بنویسید، Vivado منبع مناسب را انتخاب می‌کند.'),
      q('اگر we = 0 باشد و کلاک بزند، در حافظه چه می‌شود؟', ['هیچ چیز نوشته نمی‌شود، فقط خوانده می‌شود', 'صفر نوشته می‌شود', 'آدرس پاک می‌شود', 'همهٔ حافظه پاک می‌شود'], 0, 'نوشتن فقط با we = 1 روی لبهٔ کلاک انجام می‌شود.'),
    ],
    en: [
      q('In this lesson’s synchronous RAM, when does the data appear on the output?', ['One clock after the address', 'At once, without a clock', 'Two clocks later', 'While BTNC is pressed'], 0, 'The read is registered on the clock edge too; block RAM only supports this kind of read.'),
      q('Why don’t you need to instantiate a block RAM by hand?', ['Vivado recognises memory from the standard template', 'An FPGA has no memory', 'Flip-flops are enough', 'You do have to'], 0, 'This is inference; write the template right and Vivado picks the resource.'),
      q('With we = 0, what happens to the memory on a clock edge?', ['Nothing is written, it is only read', 'A zero is written', 'The address is cleared', 'All of memory is cleared'], 0, 'A write happens only with we = 1 on the clock edge.'),
    ],
  },
  softcore: {
    fa: [
      q('در Tiny8 هر دستور چند کلاک طول می‌کشد؟', ['۲: fetch و execute', '۱', '۴', 'بستگی به دستور دارد'], 0, 'FSM دوحالته: یک کلاک دستور را می‌آورد و کلاک بعد اجرا می‌کند.'),
      q('دستور <code>JZ a</code> کی پرش می‌کند؟', ['وقتی پرچم Z برابر ۱ است', 'همیشه', 'وقتی A برابر a است', 'وقتی پرچم C برابر ۱ است'], 0, 'پرچم Z یعنی نتیجهٔ آخر صفر بود؛ JC به پرچم C نگاه می‌کند.'),
      q('پردازندهٔ نرم چه فرقی با یک مدار مخصوص دارد؟', ['کار را از برنامهٔ داخل ROM می‌گیرد، پس با عوض کردن برنامه کار عوض می‌شود', 'سریع‌تر است', 'LUT کمتری می‌خواهد', 'فرقی ندارد'], 0, 'سخت‌افزار ثابت می‌ماند و رفتار با برنامه تعیین می‌شود؛ مدار مخصوص معمولاً سریع‌تر است.'),
    ],
    en: [
      q('How many clocks does each Tiny8 instruction take?', ['2: fetch and execute', '1', '4', 'It depends on the instruction'], 0, 'A two-state FSM: one clock fetches the instruction and the next runs it.'),
      q('When does <code>JZ a</code> jump?', ['When the Z flag is 1', 'Always', 'When A equals a', 'When the C flag is 1'], 0, 'Z means the last result was zero; JC looks at the C flag.'),
      q('How does a soft core differ from a dedicated circuit?', ['It takes its job from a program in ROM, so changing the program changes the job', 'It is faster', 'It needs fewer LUTs', 'There is no difference'], 0, 'The hardware stays fixed and the program sets the behaviour; a dedicated circuit is usually faster.'),
    ],
  },
};
