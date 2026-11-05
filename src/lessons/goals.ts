// What every course lesson promises (objectives) and what it leaves behind (takeaways), plus its level and the
// lessons it builds on. Kept apart from the lesson bodies so the long texts stay readable; course.ts merges them
// into the Persian Lesson objects and the English LessonText objects.

export type Level = 'intro' | 'core' | 'advanced';

interface Goals {
  objectives: string[];
  takeaways: string[];
}

export const PREREQ: Record<string, string[]> = {
  mux: ['gates'],
  adder: ['gates'],
  seg7: ['mux'],
  decoder: ['mux'],
  shifter: ['mux'],
  alu: ['adder', 'mux'],
  counter: ['ff'],
  testbench: ['counter'],
  shiftreg: ['ff'],
  multiplex: ['seg7', 'counter'],
  stopwatch: ['multiplex'],
  fsm: ['counter'],
  debounce: ['fsm', 'counter'],
  bin2bcd: ['fsm', 'shiftreg'],
  uart: ['fsm', 'counter'],
  uart_rx: ['uart'],
  spi: ['fsm', 'shiftreg'],
  i2c: ['fsm', 'spi'],
  pwm: ['counter'],
  sensors: ['i2c'],
  ps2: ['shiftreg', 'debounce'],
  vga: ['counter'],
  ram: ['ff'],
  softcore: ['ram', 'fsm', 'alu'],
};

export const GOALS: Record<string, { fa: Goals; en: Goals }> = {
  intro: {
    fa: {
      objectives: [
        'توضیح دهید FPGA چه فرقی با پردازنده دارد و LUT و Flip-Flop چه هستند.',
        'مراحل جریان طراحی Vivado را از Design Sources تا Program Device نام ببرید.',
        'یک طرح ساده را روی برد اجرا کنید و کلیدها را به LEDها وصل کنید.',
      ],
      takeaways: [
        'در FPGA مدار واقعی ساخته می‌شود و همهٔ بخش‌ها هم‌زمان کار می‌کنند.',
        'فایل XDC پورت‌های طرح را به پایه‌های تراشه وصل می‌کند.',
        '<code>assign</code> در Verilog و <code>&lt;=</code> در VHDL یک اتصال دائمی (ترکیبی) می‌سازند.',
      ],
    },
    en: {
      objectives: [
        'You can explain how an FPGA differs from a processor and what LUTs and flip-flops are.',
        'You can name the Vivado flow steps from Design Sources to Program Device.',
        'You can run a simple design on the board that wires switches to LEDs.',
      ],
      takeaways: [
        'An FPGA becomes a real circuit; all of its parts work at the same time.',
        'The XDC file connects the design’s ports to the chip’s pins.',
        '<code>assign</code> in Verilog and <code>&lt;=</code> in VHDL make a permanent (combinational) connection.',
      ],
    },
  },
  gates: {
    fa: {
      objectives: [
        'هفت گیت پایه را با عملگرهای Verilog و VHDL بنویسید.',
        'جدول درستی یک گیت را روی LEDها بخوانید.',
        'توضیح دهید چرا FPGA گیت جدا نمی‌سازد و LUT چه می‌کند.',
      ],
      takeaways: [
        'یک LUT هر تابعی از ورودی‌هایش را پیاده می‌کند؛ سنتز چند گیت را در یک LUT جا می‌دهد.',
        '<code>&amp;</code>، <code>|</code>، <code>~</code> و <code>^</code> در Verilog همان <code>and</code>، <code>or</code>، <code>not</code> و <code>xor</code> در VHDL هستند.',
        'هر <code>assign</code> یا <code>&lt;=</code> هم‌روند یک سیم است که همیشه ارزیابی می‌شود.',
      ],
    },
    en: {
      objectives: [
        'You can write the seven basic gates with Verilog and VHDL operators.',
        'You can read a gate’s truth table off the LEDs.',
        'You can explain why an FPGA builds no separate gates and what a LUT does.',
      ],
      takeaways: [
        'A LUT implements any function of its inputs; the synthesizer packs several gates into one LUT.',
        '<code>&amp;</code>, <code>|</code>, <code>~</code>, <code>^</code> in Verilog map to <code>and</code>, <code>or</code>, <code>not</code>, <code>xor</code> in VHDL.',
        'Every <code>assign</code> / concurrent <code>&lt;=</code> is a wire, evaluated all the time.',
      ],
    },
  },
  mux: {
    fa: {
      objectives: [
        'مالتی‌پلکسر ۲ به ۱ و ۴ به ۱ را با سه روش توصیف کنید.',
        'با سیگنال انتخاب یکی از چند ورودی را به خروجی ببرید.',
        'توضیح دهید چرا یک بلوک ترکیبی ناقص latch می‌سازد.',
      ],
      takeaways: [
        'مالتی‌پلکسر مثل کلید چرخان است: انتخاب تعیین می‌کند کدام ورودی به خروجی برسد.',
        'عملگر شرطی، <code>case</code> و <code>with … select</code> همه یک مالتی‌پلکسر می‌سازند.',
        'در بلوک ترکیبی همیشه <code>default</code> یا <code>when others</code> بنویسید تا latch ساخته نشود.',
      ],
    },
    en: {
      objectives: [
        'You can describe a 2-to-1 and a 4-to-1 multiplexer in three different ways.',
        'You can route one of several inputs to an output with a select signal.',
        'You can explain why an incomplete combinational block infers a latch.',
      ],
      takeaways: [
        'A multiplexer is a rotary switch: the select signal decides which input reaches the output.',
        'The conditional operator, <code>case</code> and <code>with … select</code> all describe a multiplexer.',
        'Always write <code>default</code> or <code>when others</code> in a combinational block, or you get a latch.',
      ],
    },
  },
  adder: {
    fa: {
      objectives: [
        'جمع‌کنندهٔ کامل را با معادله‌های جمع و رقم نقلی بنویسید.',
        'با چهار نمونه از یک ماژول یک جمع‌کنندهٔ ۴ بیتی سلسله‌مراتبی بسازید.',
        'جمع ساختاری را با عملگر <code>+</code> مقایسه کنید.',
      ],
      takeaways: [
        'جمع = a ⊕ b ⊕ cin و رقم نقلی = a·b + cin·(a ⊕ b).',
        'در جمع‌کنندهٔ ripple-carry هر طبقه رقم نقلی را به طبقهٔ بعد می‌دهد.',
        'در عمل <code>+</code> می‌نویسیم و سنتز آن را روی زنجیرهٔ سریع CARRY4 می‌برد.',
      ],
    },
    en: {
      objectives: [
        'You can write a full adder from its sum and carry equations.',
        'You can build a hierarchical 4-bit adder from four instances of one module.',
        'You can compare the structural adder with the <code>+</code> operator.',
      ],
      takeaways: [
        'Sum = a ⊕ b ⊕ cin and carry-out = a·b + cin·(a ⊕ b).',
        'In a ripple-carry adder every stage passes its carry to the next one.',
        'In practice we write <code>+</code>; synthesis maps it onto the fast CARRY4 chain.',
      ],
    },
  },
  seg7: {
    fa: {
      objectives: [
        'یک عدد ۴ بیتی را با <code>case</code> به سگمنت‌های یک رقم هگز تبدیل کنید.',
        'سیگنال‌های فعال‌پایین سگمنت و AN را درست مقدار دهید.',
        'توضیح دهید چرا همهٔ رقم‌ها یک نماد را نشان می‌دهند وقتی چند AN صفرند.',
      ],
      takeaways: [
        'در Nexys A7 هم سگمنت‌ها (CA..CG، DP) و هم AN فعال‌پایین‌اند: 0 یعنی روشن.',
        'همهٔ رقم‌ها خطوط سگمنت مشترک دارند؛ AN فقط رقم را روشن یا خاموش می‌کند.',
        'رمزگشای هفت‌قسمتی یک جدول جست‌وجوی ترکیبی (ROM کوچک) در LUTهاست.',
      ],
    },
    en: {
      objectives: [
        'You can turn a 4-bit value into the segments of one hex digit with <code>case</code>.',
        'You can drive the active-low segment and AN signals correctly.',
        'You can explain why every enabled digit shows the same symbol.',
      ],
      takeaways: [
        'On the Nexys A7 both the segments (CA..CG, DP) and AN are active-low: 0 means on.',
        'All digits share the segment lines; AN only turns a digit on or off.',
        'A seven-segment decoder is a combinational look-up table (a small ROM) in LUTs.',
      ],
    },
  },
  decoder: {
    fa: {
      objectives: [
        'یک دیکودر ۳ به ۸ با ورودی فعال‌ساز بنویسید.',
        'یک انکودر اولویت‌دار با <code>casez</code> یا <code>when … else</code> بسازید.',
        'توضیح دهید چرا انکودر اولویت‌دار به خروجی valid نیاز دارد.',
      ],
      takeaways: [
        'دیکودر یک عدد را می‌گیرد و دقیقاً یکی از خروجی‌ها را فعال می‌کند: <code>8\'b1 &lt;&lt; sel</code>.',
        'در انکودر اولویت‌دار اولین شرط درست برنده است و ترتیب شرط‌ها همان اولویت است.',
        'بدون valid نمی‌شود «هیچ درخواستی» را از «فقط SW8» تشخیص داد.',
      ],
    },
    en: {
      objectives: [
        'You can write a 3-to-8 decoder with an enable input.',
        'You can build a priority encoder with <code>casez</code> or <code>when … else</code>.',
        'You can explain why a priority encoder needs a valid output.',
      ],
      takeaways: [
        'A decoder takes a number and turns on exactly one output: <code>8\'b1 &lt;&lt; sel</code>.',
        'In a priority encoder the first true condition wins, so the order of the conditions is the priority.',
        'Without valid, “no request” and “only SW8” look the same.',
      ],
    },
  },
  shifter: {
    fa: {
      objectives: [
        'یک شیفت‌دهندهٔ چرخشی ۸ بیتی را با سه طبقه مالتی‌پلکسر بسازید.',
        'چرخش به چپ را با منفی کردن مقدار شیفت از چرخش به راست بسازید.',
        'توضیح دهید چرا n بیت فقط log₂(n) طبقه لازم دارد.',
      ],
      takeaways: [
        'Barrel shifter در یک گام ترکیبی، بدون کلاک، به هر مقدار می‌چرخاند.',
        'هر طبقه با یک بیت مقدار شیفت به اندازهٔ ۱، ۲ یا ۴ می‌چرخاند و فقط مالتی‌پلکسر ۲ به ۱ است.',
        'چرخش به چپ به اندازهٔ k همان چرخش به راست به اندازهٔ 8 − k است.',
      ],
    },
    en: {
      objectives: [
        'You can build an 8-bit barrel rotator from three stages of multiplexers.',
        'You can rotate left by negating the amount and reusing the right rotator.',
        'You can explain why n bits need only log₂(n) stages.',
      ],
      takeaways: [
        'A barrel shifter rotates by any amount in one combinational step, without a clock.',
        'Each stage rotates by 1, 2 or 4 under one amount bit and is just a 2-to-1 mux per bit.',
        'Rotating left by k equals rotating right by 8 − k.',
      ],
    },
  },
  alu: {
    fa: {
      objectives: [
        'یک ALU چهاربیتی با هشت عمل و یک مالتی‌پلکسر خروجی بنویسید.',
        'پرچم صفر را از نتیجه بسازید و روی LED نشان دهید.',
        'پهنای عبارت‌ها را در Verilog و <code>resize</code> را در VHDL برای نگه داشتن رقم نقلی به کار ببرید.',
      ],
      takeaways: [
        'در سخت‌افزار همهٔ عمل‌ها موازی ساخته می‌شوند و یک مالتی‌پلکسر یکی را برمی‌دارد.',
        'پرچم صفر یعنی چهار بیت پایین نتیجه صفرند؛ پردازنده‌ها با آن پرش شرطی می‌کنند.',
        'Verilog پهنای محاسبه را از سمت چپ می‌گیرد؛ در VHDL عملوندها را خودمان پهن می‌کنیم.',
      ],
    },
    en: {
      objectives: [
        'You can write a 4-bit ALU with eight operations and an output multiplexer.',
        'You can derive a zero flag from the result and show it on an LED.',
        'You can keep the carry with Verilog expression widths and VHDL <code>resize</code>.',
      ],
      takeaways: [
        'In hardware every operation is built in parallel and a multiplexer picks one.',
        'The zero flag means the low four result bits are zero; processors branch on it.',
        'Verilog takes the width from the left side; in VHDL you widen the operands yourself.',
      ],
    },
  },
  ff: {
    fa: {
      objectives: [
        'یک ثبات ۱۶ بیتی با لبهٔ بالارونده کلاک، فعال‌ساز و ریست همگام بنویسید.',
        'فرق مدار ترکیبی و ترتیبی را روی برد ببینید.',
        'توضیح دهید چرا در بلوک‌های کلاک‌دار از <code>&lt;=</code> استفاده می‌کنیم.',
      ],
      takeaways: [
        'Flip-Flop نوع D در هر لبهٔ بالارونده کلاک D را در Q ذخیره می‌کند و تا لبهٔ بعد نگه می‌دارد.',
        'کلاک برد ۱۰۰ مگاهرتز است: هر ۱۰ نانوثانیه یک لبه.',
        'انتساب غیرمسدودکننده (<code>&lt;=</code>) باعث می‌شود همهٔ Flip-Flopها با هم به‌روز شوند.',
      ],
    },
    en: {
      objectives: [
        'You can write a 16-bit register with a rising clock edge, an enable and a synchronous reset.',
        'You can see the difference between combinational and sequential logic on the board.',
        'You can explain why clocked blocks use <code>&lt;=</code>.',
      ],
      takeaways: [
        'A D flip-flop stores D into Q on every rising clock edge and holds it until the next one.',
        'The board clock is 100 MHz: one edge every 10 nanoseconds.',
        'Non-blocking assignments (<code>&lt;=</code>) make all flip-flops update together.',
      ],
    },
  },
  counter: {
    fa: {
      objectives: [
        'تعداد کلاک‌های لازم برای یک بازهٔ زمانی را حساب کنید.',
        'با یک شمارنده کلاک را تقسیم کنید و یک LED را با ۱ هرتز چشمک بزنید.',
        'یک شمارندهٔ ۸ بیتی را با هر تیک یکی زیاد کنید و روی LEDها ببینید.',
      ],
      takeaways: [
        'نیم ثانیه در ۱۰۰ مگاهرتز یعنی ۵۰ میلیون کلاک و یک شمارندهٔ ۲۶ بیتی.',
        'تقسیم کلاک یعنی شمردن کلاک‌ها و کاری انجام دادن وقتی شمارنده به یک مقدار می‌رسد.',
        'برای شبیه‌سازی سریع مقدار تقسیم را کوچک می‌کنیم؛ روی برد مقدار واقعی می‌ماند.',
      ],
    },
    en: {
      objectives: [
        'You can work out how many clocks a time interval takes.',
        'You can divide the clock with a counter and blink an LED at 1 Hz.',
        'You can increment an 8-bit counter on every tick and watch it on the LEDs.',
      ],
      takeaways: [
        'Half a second at 100 MHz is 50 million clocks, which needs a 26-bit counter.',
        'Clock division means counting clocks and acting when the counter reaches a value.',
        'Simulations shrink the divider to run fast; the board keeps the real value.',
      ],
    },
  },
  testbench: {
    fa: {
      objectives: [
        'یک Testbench با نمونهٔ DUT، مولد کلاک و ورودی‌های زمان‌بندی‌شده بنویسید.',
        'خروجی‌ها را با <code>$error</code> یا <code>assert</code> بررسی کنید.',
        'سیگنال‌ها را در نمای موج بخوانید و یک بازهٔ زمانی را اندازه بگیرید.',
      ],
      takeaways: [
        'Testbench یک ماژول بدون پورت است که ورودی‌ها را تغییر می‌دهد و خروجی‌ها را بررسی می‌کند.',
        'تأخیرها (<code>#10</code>، <code>wait for</code>) فقط در شبیه‌سازی معنا دارند و سنتز نمی‌شوند.',
        'با <code>parameter</code> یا <code>generic</code> تقسیم‌کننده را در Testbench کوچک کنید تا سریع اجرا شود.',
      ],
    },
    en: {
      objectives: [
        'You can write a testbench with a DUT instance, a clock generator and timed stimulus.',
        'You can check outputs with <code>$error</code> or <code>assert</code>.',
        'You can read signals in the waveform view and measure an interval.',
      ],
      takeaways: [
        'A testbench is a module with no ports that drives the inputs and checks the outputs.',
        'Delays (<code>#10</code>, <code>wait for</code>) exist only in simulation; they are not synthesized.',
        'A <code>parameter</code> or <code>generic</code> lets the testbench shrink the divider so it runs fast.',
      ],
    },
  },
  shiftreg: {
    fa: {
      objectives: [
        'یک شیفت رجیستر سریال به موازی بنویسید.',
        'یک LFSR با XOR چند بیت خودش بسازید و دنبالهٔ شبه‌تصادفی آن را ببینید.',
        'با فعال‌ساز کلاک یک مدار کند بسازید که هنوز با یک کلاک کار می‌کند.',
      ],
      takeaways: [
        'در شیفت رجیستر با هر تیک همهٔ بیت‌ها یک خانه جابه‌جا می‌شوند و یک بیت تازه وارد می‌شود.',
        'LFSR هشت‌بیتی با tapهای درست از همهٔ ۲۵۵ حالت غیرصفر می‌گذرد.',
        'LFSR هرگز نباید صفر شود، چون همان‌جا می‌ماند؛ برای همین مقدار اولیه 01 است.',
      ],
    },
    en: {
      objectives: [
        'You can write a serial-to-parallel shift register.',
        'You can build an LFSR from the XOR of some of its own bits and watch its sequence.',
        'You can slow a circuit down with a clock enable while it still uses one clock.',
      ],
      takeaways: [
        'In a shift register every tick moves all bits one place and lets a new bit in.',
        'An 8-bit LFSR with the right taps walks through all 255 non-zero states.',
        'An LFSR must never be zero, or it stays there; that is why it starts at 01.',
      ],
    },
  },
  multiplex: {
    fa: {
      objectives: [
        'با مالتی‌پلکس زمانی چهار رقم مختلف را روی نمایشگر نشان دهید.',
        'با بیت‌های بالای یک شمارندهٔ refresh رقم فعال را انتخاب کنید.',
        'شمارنده، مالتی‌پلکسر و رمزگشا را در یک طرح سلسله‌مراتبی کنار هم بگذارید.',
      ],
      takeaways: [
        'رقم‌ها یکی‌یکی روشن می‌شوند و اگر سریع‌تر از حدود ۶۰ بار در ثانیه باشد، چشم همه را ثابت می‌بیند.',
        'بیت‌های بالای شمارنده هم رقم فعال و هم نیبل مربوط به آن را انتخاب می‌کنند.',
        'یک رمزگشا برای همهٔ رقم‌ها کافی است، چون در هر لحظه فقط یک رقم روشن است.',
      ],
    },
    en: {
      objectives: [
        'You can show four different digits with time multiplexing.',
        'You can pick the active digit with the top bits of a refresh counter.',
        'You can combine a counter, a multiplexer and a decoder in one hierarchical design.',
      ],
      takeaways: [
        'Digits light one at a time; faster than about 60 times a second the eye sees them all steady.',
        'The top counter bits select both the active digit and its nibble.',
        'One decoder serves every digit, because only one digit is lit at any moment.',
      ],
    },
  },
  stopwatch: {
    fa: {
      objectives: [
        'یک تیک دقیق ۰٫۱ ثانیه از کلاک ۱۰۰ مگاهرتز بسازید.',
        'شمارنده‌های BCD را آبشاری کنید تا هر رقم از ۹ به ۰ برگردد و به رقم بعد اضافه کند.',
        'زمان‌سنج را با یک کلید و یک دکمه کنترل کنید و روی نمایشگر نشان دهید.',
      ],
      takeaways: [
        'در BCD هر رقم دهدهی جدا در ۴ بیت نگه داشته می‌شود (۰ تا ۹).',
        'شمارنده‌های آبشاری مثل کیلومترشمار ماشین کار می‌کنند.',
        'هر رقم BCD مستقیم به رمزگشای هفت‌قسمتی می‌رود و تقسیم بر ۱۰ لازم نیست.',
      ],
    },
    en: {
      objectives: [
        'You can make an accurate 0.1 s tick from the 100 MHz clock.',
        'You can cascade BCD counters so each digit wraps from 9 to 0 and carries.',
        'You can control the stopwatch with a switch and a button and show it on the display.',
      ],
      takeaways: [
        'In BCD every decimal digit is kept separately in 4 bits (0 to 9).',
        'Cascaded counters work like a car’s odometer.',
        'Each BCD digit goes straight to a seven-segment decoder, with no division by 10.',
      ],
    },
  },
  fsm: {
    fa: {
      objectives: [
        'یک ماشین حالت Moore را با حالت‌های شمارشی و یک تایمر بنویسید.',
        'ثبت حالت و خروجی‌ها را در دو بلوک جدا توصیف کنید.',
        'با یک ورودی (BTNC) مسیر ماشین حالت را عوض کنید.',
      ],
      takeaways: [
        'FSM همیشه در یکی از چند حالت است و بر اساس ورودی‌ها و زمان به حالت بعد می‌رود.',
        'در ماشین Moore خروجی فقط به حالت بستگی دارد.',
        'حالت‌ها در Verilog با <code>localparam</code> و در VHDL با <code>type … is (…)</code> تعریف می‌شوند.',
      ],
    },
    en: {
      objectives: [
        'You can write a Moore state machine with named states and a timer.',
        'You can describe the state register and the outputs in two separate blocks.',
        'You can change the machine’s path with an input (BTNC).',
      ],
      takeaways: [
        'An FSM is always in one of a few states and moves on based on inputs and time.',
        'In a Moore machine the outputs depend only on the state.',
        'States are a <code>localparam</code> list in Verilog and a <code>type … is (…)</code> in VHDL.',
      ],
    },
  },
  debounce: {
    fa: {
      objectives: [
        'توضیح دهید چرا لرزش دکمه در ۱۰۰ مگاهرتز چند فشار به نظر می‌رسد.',
        'یک FSM بنویسید که ورودی را فقط بعد از ۱۰ میلی‌ثانیه ثبات بپذیرد.',
        'با یک آشکارساز لبه برای هر فشار دقیقاً یک پالس یک‌کلاکی بسازید.',
      ],
      takeaways: [
        'تماس‌های فلزی دکمه چند میلی‌ثانیه می‌لرزند و مدار سریع هر لرزش را یک فشار می‌بیند.',
        'debouncer ورودی را فقط وقتی می‌پذیرد که مدتی ثابت مانده باشد.',
        'آشکارساز لبه: <code>tick = level &amp; ~prev</code>، فقط یک کلاک ۱ است.',
      ],
    },
    en: {
      objectives: [
        'You can explain why button bounce looks like many presses at 100 MHz.',
        'You can write an FSM that accepts the input only after 10 ms of stability.',
        'You can make exactly one one-clock pulse per press with an edge detector.',
      ],
      takeaways: [
        'Button contacts bounce for a few milliseconds and a fast circuit sees every bounce as a press.',
        'A debouncer accepts the input only once it has stayed stable for a while.',
        'Edge detector: <code>tick = level &amp; ~prev</code> is 1 for exactly one clock.',
      ],
    },
  },
  bin2bcd: {
    fa: {
      objectives: [
        'یک الگوریتم را به یک FSMD، یعنی مسیر داده و ماشین حالت، تبدیل کنید.',
        'الگوریتم double dabble را برای تبدیل دودویی به BCD اجرا کنید.',
        'توضیح دهید چرا پیش از هر شیفت به رقم‌های ۵ یا بیشتر ۳ اضافه می‌شود.',
      ],
      takeaways: [
        'FSMD یعنی مسیر داده کار را انجام می‌دهد و ماشین حالت آن را قدم‌به‌قدم جلو می‌برد.',
        'double dabble با شیفت و جمع با ۳ بدون تقسیم بر ۱۰ به دهدهی می‌رسد.',
        'هر قدم یک کلاک می‌گیرد، پس تبدیل ۱۳ بیتی حدود ۱۵ کلاک طول می‌کشد.',
      ],
    },
    en: {
      objectives: [
        'You can turn an algorithm into an FSMD: a datapath plus a state machine.',
        'You can run the double-dabble algorithm to convert binary to BCD.',
        'You can explain why 3 is added to digits of 5 or more before each shift.',
      ],
      takeaways: [
        'In an FSMD the datapath does the work and the state machine steps it along.',
        'Double dabble reaches decimal by shifting and adding 3, with no division by 10.',
        'Each step takes one clock, so a 13-bit conversion takes about 15 clocks.',
      ],
    },
  },
  uart: {
    fa: {
      objectives: [
        'قاب 8N1 یک UART را با بیت شروع، داده و بیت پایان شرح دهید.',
        'زمان یک بیت را برای ۱۱۵۲۰۰ باود بر حسب کلاک حساب کنید.',
        'سیگنال TX را با Logic Analyzer ببینید، رمزگشایی کنید و زمان یک بیت را اندازه بگیرید.',
      ],
      takeaways: [
        'خط UART در حالت بیکار ۱ است؛ قاب با بیت شروع ۰ آغاز و با بیت پایان ۱ تمام می‌شود.',
        'داده‌ها از کم‌ارزش‌ترین بیت (LSB) فرستاده می‌شوند.',
        'در ۱۱۵۲۰۰ باود هر بیت حدود ۸۶۸ کلاک یا ۸٫۶۸ میکروثانیه است.',
      ],
    },
    en: {
      objectives: [
        'You can describe an 8N1 UART frame: start bit, data bits and stop bit.',
        'You can work out one bit time at 115200 baud in clocks.',
        'You can capture TX with the logic analyzer, decode it and measure a bit time.',
      ],
      takeaways: [
        'A UART line idles at 1; a frame starts with a 0 start bit and ends with a 1 stop bit.',
        'Data bits go out least significant bit (LSB) first.',
        'At 115200 baud one bit is about 868 clocks, or 8.68 µs.',
      ],
    },
  },
  uart_rx: {
    fa: {
      objectives: [
        'یک ورودی ناهمگام را با دو Flip-Flop همگام کنید.',
        'یک گیرندهٔ UART بنویسید که وسط هر بیت نمونه بگیرد.',
        'بایت‌های دریافتی را با کنسول سریال به حروف بزرگ برگردانید.',
      ],
      takeaways: [
        'ورودی بیرونی با کلاک ما هم‌زمان نیست و باید از یک synchronizer دوفلیپ‌فلاپی بگذرد.',
        'نمونه‌برداری در وسط بیت اختلاف سرعت کوچک دو طرف را تحمل می‌کند.',
        'ثبات نگه‌دارنده (<code>pend</code>) بایت تازه را تا آزاد شدن فرستنده نگه می‌دارد.',
      ],
    },
    en: {
      objectives: [
        'You can synchronise an asynchronous input with two flip-flops.',
        'You can write a UART receiver that samples the middle of every bit.',
        'You can echo received bytes in upper case through the serial console.',
      ],
      takeaways: [
        'An outside input is not aligned with our clock, so it passes a two-flip-flop synchronizer.',
        'Sampling in the middle of each bit tolerates a small speed difference between the sides.',
        'A holding register (<code>pend</code>) keeps a new byte until the transmitter is free.',
      ],
    },
  },
  spi: {
    fa: {
      objectives: [
        'چهار سیم SPI و جهت هرکدام را نام ببرید.',
        'یک SPI master در حالت ۰ بنویسید که با MSB شروع کند.',
        'تبادل دوطرفه را با Logic Analyzer ببینید و فرکانس SCLK را اندازه بگیرید.',
      ],
      takeaways: [
        'SPI همگام است: کلاک روی سیم جداست، پس دو طرف لازم نیست سرعت را از قبل بدانند.',
        'در حالت ۰ کلاک در بیکاری ۰ است؛ روی لبهٔ بالارونده نمونه و روی لبهٔ پایین‌رونده بیت بعد.',
        'هر کلاک یک بیت می‌فرستد و یک بیت برمی‌گرداند؛ هر انتقال دوطرفه است.',
      ],
    },
    en: {
      objectives: [
        'You can name the four SPI wires and their directions.',
        'You can write a mode 0 SPI master that sends the MSB first.',
        'You can watch the two-way transfer in the logic analyzer and measure SCLK.',
      ],
      takeaways: [
        'SPI is synchronous: the clock has its own wire, so no speed is agreed in advance.',
        'In mode 0 the clock idles low; sample on the rising edge, shift on the falling edge.',
        'Every clock sends one bit and brings one back, so every transfer is two-way.',
      ],
    },
  },
  i2c: {
    fa: {
      objectives: [
        'خط open-drain و نقش مقاومت pull-up را توضیح دهید.',
        'شرط‌های START و STOP، آدرس ۷ بیتی و بیت ACK را در یک قاب I²C پیدا کنید.',
        'یک ثبات را در دستگاه بنویسید، دوباره بخوانید و NAK را تشخیص دهید.',
      ],
      takeaways: [
        'در I²C هیچ‌کس خط را ۱ نمی‌کند؛ خط AND همهٔ دستگاه‌هاست و pull-up آن را ۱ می‌کند.',
        'START یعنی افتادن SDA وقتی SCL بالاست؛ STOP یعنی بالا رفتن SDA وقتی SCL بالاست.',
        'گیرنده بعد از هر بایت ACK (۰) می‌فرستد؛ اگر کسی جواب ندهد خط ۱ می‌ماند: NAK.',
      ],
    },
    en: {
      objectives: [
        'You can explain an open-drain line and the role of the pull-up resistor.',
        'You can find START, STOP, the 7-bit address and the ACK bit in an I²C frame.',
        'You can write a device register, read it back and recognise a NAK.',
      ],
      takeaways: [
        'In I²C nobody drives a 1; the line is the AND of all devices and a pull-up makes it 1.',
        'START is SDA falling while SCL is high; STOP is SDA rising while SCL is high.',
        'The receiver ACKs (0) after every byte; if nobody answers the line stays 1: a NAK.',
      ],
    },
  },
  pwm: {
    fa: {
      objectives: [
        'با مدولاسیون پهنای پالس (PWM) نور یک LED را کم و زیاد کنید.',
        'یک ماژول پارامتری با <code>parameter</code> یا <code>generic</code> بنویسید.',
        'با ترکیب قرمز و سبز LED رنگی، نارنجی و زرد بسازید.',
      ],
      takeaways: [
        'خروجی PWM وقتی شمارنده کمتر از duty است ۱ است: <code>pwm = cnt &lt; duty</code>.',
        'نسبت روشن بودن، یعنی duty / 2^W، روشنایی را تعیین می‌کند و چشم فقط میانگین را می‌بیند.',
        'پهنای شمارنده یک پارامتر است، پس همان ماژول با دقت‌های مختلف به کار می‌رود.',
      ],
    },
    en: {
      objectives: [
        'You can dim an LED with pulse-width modulation (PWM).',
        'You can write a module parameterised with <code>parameter</code> or <code>generic</code>.',
        'You can mix red and green on the RGB LED into orange and yellow.',
      ],
      takeaways: [
        'A PWM output is 1 while the counter is below duty: <code>pwm = cnt &lt; duty</code>.',
        'The duty cycle, duty / 2^W, sets the brightness; the eye only sees the average.',
        'The counter width is a parameter, so one module serves different resolutions.',
      ],
    },
  },
  sensors: {
    fa: {
      objectives: [
        'یک پایهٔ open-drain را با مقدار <code>z</code> و پورت <code>inout</code> توصیف کنید.',
        'دمای ADT7420 را با یک خواندن دوبایتی I²C بخوانید و به درجه تبدیل کنید.',
        'با پنل Modules دما را تغییر دهید و ماژول تازه به Pmod وصل کنید.',
      ],
      takeaways: [
        'برای رها کردن خط، خروجی حالت سوم یعنی امپدانس بالا (<code>z</code>) را می‌گیرد.',
        'خواندن یک پایهٔ <code>inout</code> سطح واقعی سیم را می‌دهد، حتی وقتی FPGA آن را رها کرده است.',
        'بیت‌های ۱۵ تا ۳ ثبات دما یک عدد علامت‌دار با گام ۱/۱۶ درجه‌اند.',
      ],
    },
    en: {
      objectives: [
        'You can describe an open-drain pin with the value <code>z</code> and an <code>inout</code> port.',
        'You can read the ADT7420 with a two-byte I²C read and turn it into degrees.',
        'You can change the temperature in the Modules panel and add a module on a Pmod.',
      ],
      takeaways: [
        'To let go of a line, the output takes the third state, high impedance (<code>z</code>).',
        'Reading an <code>inout</code> pin gives the real wire level, even when the FPGA let go.',
        'Bits 15 to 3 of the temperature register are a signed number in 1/16 degree steps.',
      ],
    },
  },
  ps2: {
    fa: {
      objectives: [
        'قاب ۱۱ بیتی PS/2 را با بیت شروع، داده، توازن فرد و پایان شرح دهید.',
        'کلاک کند صفحه‌کلید را همگام و فیلتر کنید و بیت‌ها را روی لبهٔ پایین‌رونده بخوانید.',
        'کدهای make، break (F0) و extended (E0) را روی نمایشگر تشخیص دهید.',
      ],
      takeaways: [
        'در PS/2 صفحه‌کلید خودش کلاک را می‌سازد و FPGA روی لبهٔ پایین‌رونده می‌خواند.',
        'توازن فرد یعنی تعداد یک‌ها در هشت بیت داده و بیت توازن روی هم فرد است.',
        'صفحه‌کلید شمارهٔ کلید را می‌فرستد، نه حرف را؛ تبدیل کد به حرف کار طرح شماست.',
      ],
    },
    en: {
      objectives: [
        'You can describe the 11-bit PS/2 frame: start, data, odd parity and stop.',
        'You can synchronise and filter the slow keyboard clock and read bits on its falling edge.',
        'You can recognise make, break (F0) and extended (E0) codes on the display.',
      ],
      takeaways: [
        'In PS/2 the keyboard makes the clock and the FPGA reads on its falling edge.',
        'Odd parity: the ones in the eight data bits plus the parity bit add up to an odd number.',
        'The keyboard sends key numbers, not letters; turning codes into letters is your design’s job.',
      ],
    },
  },
  vga: {
    fa: {
      objectives: [
        'زمان‌بندی 640×480 در ۶۰ هرتز را با ناحیهٔ دیده‌شدنی، porch و پالس sync شرح دهید.',
        'سیگنال‌های HS و VS را از دو شمارندهٔ x و y بسازید.',
        'رنگ هر پیکسل را با یک مدار ترکیبی از x و y بکشید.',
      ],
      takeaways: [
        'هر خط ۸۰۰ پیکسل و هر قاب ۵۲۵ خط است؛ کلاک پیکسل حدود ۲۵ مگاهرتز است.',
        'پالس‌های sync در این حالت فعال‌پایین‌اند و بیرون از ناحیهٔ دیده‌شدنی رنگ باید سیاه باشد.',
        'حافظهٔ تصویر لازم نیست؛ رنگ هر نقطه همان لحظه از x و y حساب می‌شود.',
      ],
    },
    en: {
      objectives: [
        'You can describe 640×480 at 60 Hz timing: visible area, porches and sync pulses.',
        'You can build the HS and VS signals from two counters, x and y.',
        'You can draw by turning x and y into a colour with combinational logic.',
      ],
      takeaways: [
        'A line is 800 pixels and a frame 525 lines; the pixel clock is about 25 MHz.',
        'In this mode the sync pulses are active-low and the colour must be black outside the visible area.',
        'No picture memory is needed; each pixel’s colour is computed from x and y on the spot.',
      ],
    },
  },
  ram: {
    fa: {
      objectives: [
        'یک RAM همگام را با الگوی استانداردی که Vivado می‌شناسد توصیف کنید.',
        'روی لبهٔ کلاک و فقط با <code>we = 1</code> بنویسید و همگام بخوانید.',
        'در گزارش Utilization ببینید حافظه از کدام منبع استفاده کرده است.',
      ],
      takeaways: [
        'FPGA حافظهٔ آماده دارد: Block RAM و Distributed RAM ساخته‌شده از LUT.',
        'در خواندن همگام داده یک کلاک بعد از آدرس آماده است.',
        'Vivado حافظه را از الگو تشخیص می‌دهد (inference) و لازم نیست دستی نمونه‌سازی شود.',
      ],
    },
    en: {
      objectives: [
        'You can describe a synchronous RAM with the standard template Vivado recognises.',
        'You can write on the clock edge only when <code>we = 1</code> and read synchronously.',
        'You can see in the Utilization report which resource the memory uses.',
      ],
      takeaways: [
        'An FPGA has ready-made memory: block RAM and distributed RAM built from LUTs.',
        'With a synchronous read, the data is ready one clock after the address.',
        'Vivado recognises memory from the template (inference); no manual instantiation is needed.',
      ],
    },
  },
  softcore: {
    fa: {
      objectives: [
        'بخش‌های یک پردازندهٔ نرم را نام ببرید: ROM، PC، انباره، پرچم‌ها و RAM.',
        'چرخهٔ fetch و execute را در یک FSM دوحالته دنبال کنید.',
        'یک برنامهٔ کوچک با مجموعه‌دستور Tiny8 بنویسید و روی برد اجرا کنید.',
      ],
      takeaways: [
        'پردازندهٔ نرم یعنی پردازنده‌ای که از منطق FPGA ساخته شده و کار را با برنامه می‌گیرد.',
        'هر دستور دو کلاک می‌گیرد: fetch دستور را در <code>ir</code> می‌گذارد و execute آن را اجرا می‌کند.',
        'پرش فقط PC را عوض می‌کند؛ پرش شرطی به پرچم Z یا C نگاه می‌کند.',
      ],
    },
    en: {
      objectives: [
        'You can name the parts of a soft core: ROM, PC, accumulator, flags and RAM.',
        'You can follow the fetch and execute cycle in a two-state FSM.',
        'You can write a small Tiny8 program and run it on the board.',
      ],
      takeaways: [
        'A soft core is a processor built from FPGA logic that gets its job from a program.',
        'Every instruction takes two clocks: fetch loads <code>ir</code> and execute runs it.',
        'A jump only changes the PC; a conditional jump looks at the Z or C flag.',
      ],
    },
  },
};
