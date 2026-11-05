// Two staged hints per exercise: first the idea, then a code skeleton. HTML, Persian and English.
type H = { fa: string; en: string };

export const HINTS: Record<string, [H, H]> = {
  intro: [
    {
      fa: 'ترتیب بیت‌ها را برعکس کنید؛ یعنی بیت ۰ خروجی باید از بیت ۱۵ ورودی بیاید.',
      en: 'Reverse the bit order: output bit 0 must come from input bit 15.',
    },
    {
      fa: 'در Verilog: <code>always @(*) for (i = 0; i < 16; i = i + 1) LED[i] = SW[15 - i];</code> و <code>LED</code> را <code>reg</code> کنید. در VHDL از یک حلقه‌ی <code>for</code> داخل یک process استفاده کنید.',
      en: 'In Verilog: <code>always @(*) for (i = 0; i < 16; i = i + 1) LED[i] = SW[15 - i];</code> and make <code>LED</code> a <code>reg</code>. In VHDL use a <code>for</code> loop inside a process.',
    },
  ],
  gates: [
    {
      fa: 'AND سه‌ورودی فقط وقتی ۱ است که هر سه ورودی ۱ باشند. پهنای پورت‌ها هم باید بزرگ‌تر شود.',
      en: 'A three-input AND is 1 only when all three inputs are 1. The ports have to get wider too.',
    },
    {
      fa: 'SW را <code>[2:0]</code> و LED را <code>[7:0]</code> کنید و بنویسید <code>assign LED[7] = SW[0] &amp; SW[1] &amp; SW[2];</code> (یا <code>&amp;SW</code>). در VHDL: <code>LED(7) &lt;= SW(0) and SW(1) and SW(2);</code>',
      en: 'Make SW <code>[2:0]</code> and LED <code>[7:0]</code>, then write <code>assign LED[7] = SW[0] &amp; SW[1] &amp; SW[2];</code> (or <code>&amp;SW</code>). In VHDL: <code>LED(7) &lt;= SW(0) and SW(1) and SW(2);</code>',
    },
  ],
  mux: [
    {
      fa: 'مالتی‌پلکسر ۸ به ۱ یعنی یک بیت از هشت بیت را با یک عدد ۳ بیتی انتخاب کنید؛ اندیس‌گذاری با متغیر همین کار را می‌کند.',
      en: 'An 8-to-1 mux picks one of eight bits with a 3-bit number; indexing with a variable does exactly that.',
    },
    {
      fa: 'LED را ۳ بیتی کنید و در Verilog بنویسید <code>LED[2] = SW[SW[15:13]];</code>. در VHDL: <code>LED(2) &lt;= SW(to_integer(unsigned(SW(15 downto 13))));</code> و <code>numeric_std</code> را اضافه کنید.',
      en: 'Make LED 3 bits wide and in Verilog write <code>LED[2] = SW[SW[15:13]];</code>. In VHDL: <code>LED(2) &lt;= SW(to_integer(unsigned(SW(15 downto 13))));</code> and add <code>numeric_std</code>.',
    },
  ],
  adder: [
    {
      fa: 'A − B همان A + ~B + 1 است. جمع‌کننده ورودی رقم نقلی دارد و SW8 همین حالا Cin است.',
      en: 'A − B is A + ~B + 1. The adder already has a carry-in, and SW8 is already Cin.',
    },
    {
      fa: 'فقط B را عوض کنید: <code>wire [3:0] b = SW[8] ? ~SW[7:4] : SW[7:4];</code>. با SW8 = 1 هم B معکوس می‌شود و هم ۱ از Cin اضافه می‌شود. در VHDL از <code>when … else</code> استفاده کنید.',
      en: 'Change only B: <code>wire [3:0] b = SW[8] ? ~SW[7:4] : SW[7:4];</code>. With SW8 = 1, B is inverted and Cin adds the 1. In VHDL use <code>when … else</code>.',
    },
  ],
  seg7: [
    {
      fa: 'AN و DP فعال‌پایین‌اند: برای روشن کردن هر هشت رقم همهٔ بیت‌های AN را صفر کنید، و DP باید عکس SW15 باشد.',
      en: 'AN and DP are active-low: to light all eight digits set every AN bit to 0, and DP must be the inverse of SW15.',
    },
    {
      fa: 'SW را ۱۶ بیتی کنید، <code>x = SW[3:0]</code>، <code>assign AN = 8\'b0000_0000;</code> و <code>assign DP = ~SW[15];</code>. در VHDL: <code>AN &lt;= "00000000";</code> و <code>DP &lt;= not SW(15);</code>',
      en: 'Make SW 16 bits, <code>x = SW[3:0]</code>, <code>assign AN = 8\'b0000_0000;</code> and <code>assign DP = ~SW[15];</code>. In VHDL: <code>AN &lt;= "00000000";</code> and <code>DP &lt;= not SW(15);</code>',
    },
  ],
  decoder: [
    {
      fa: 'دیکودر ۲ به ۴ مثل دیکودر درس است، فقط فعال‌پایین: خروجی انتخاب‌شده ۰ است و بقیه ۱.',
      en: 'A 2-to-4 decoder is like the lesson’s decoder, but active-low: the selected output is 0 and the rest are 1.',
    },
    {
      fa: 'یک خروجی <code>output wire [7:0] AN</code> اضافه کنید و بنویسید <code>assign AN = ~(8\'b1 &lt;&lt; SW[1:0]) | 8\'hF0;</code>. خطوط AN را در XDC فعال کنید. در VHDL از <code>with SW(1 downto 0) select</code> استفاده کنید.',
      en: 'Add an output <code>output wire [7:0] AN</code> and write <code>assign AN = ~(8\'b1 &lt;&lt; SW[1:0]) | 8\'hF0;</code>. Uncomment the AN lines in the XDC. In VHDL use <code>with SW(1 downto 0) select</code>.',
    },
  ],
  shifter: [
    {
      fa: 'شیفت منطقی بیت‌هایی را که بیرون می‌افتند دور می‌ریزد و صفر وارد می‌کند. کنار چرخش یک شیفت جدا بسازید و با SW14 یکی را انتخاب کنید.',
      en: 'A logical shift drops the bits that fall off and brings in zeros. Build a shift next to the rotate and pick one with SW14.',
    },
    {
      fa: 'در Verilog: <code>wire [7:0] sh = left ? (a &lt;&lt; SW[10:8]) : (a &gt;&gt; SW[10:8]);</code> و <code>assign LED = {a, SW[14] ? sh : s2};</code>. در VHDL از <code>shift_left</code> و <code>shift_right</code> روی <code>unsigned</code> استفاده کنید.',
      en: 'In Verilog: <code>wire [7:0] sh = left ? (a &lt;&lt; SW[10:8]) : (a &gt;&gt; SW[10:8]);</code> and <code>assign LED = {a, SW[14] ? sh : s2};</code>. In VHDL use <code>shift_left</code> and <code>shift_right</code> on <code>unsigned</code>.',
    },
  ],
  alu: [
    {
      fa: 'رمزگشای هفت‌قسمتی را به صورت یک ماژول جدا بیاورید و چهار بیت پایین نتیجه را به آن بدهید؛ فقط AN0 روشن باشد.',
      en: 'Bring in the seven-segment decoder as a separate module and feed it the low four result bits; only AN0 is on.',
    },
    {
      fa: 'ماژول <code>hex7seg</code> را بالای <code>top</code> بگذارید، خروجی‌های <code>CA..CG</code>، <code>DP</code> و <code>AN</code> را اضافه کنید، <code>hex7seg dec (.x(r[3:0]), .seg(seg));</code> و <code>assign AN = 8\'hFE;</code>. در VHDL: <code>entity work.hex7seg port map (...)</code>.',
      en: 'Put a <code>hex7seg</code> module above <code>top</code>, add the outputs <code>CA..CG</code>, <code>DP</code> and <code>AN</code>, then <code>hex7seg dec (.x(r[3:0]), .seg(seg));</code> and <code>assign AN = 8\'hFE;</code>. In VHDL: <code>entity work.hex7seg port map (...)</code>.',
    },
  ],
  ff: [
    {
      fa: 'شیفت داخل همان بلوک کلاک‌دار انجام می‌شود: در هر لبه، اگر BTNU نگه داشته شده باشد ثبات یک خانه جابه‌جا می‌شود. ترتیب شرط‌ها اولویت را تعیین می‌کند.',
      en: 'The shift happens in the same clocked block: on every edge, while BTNU is held, the register moves one place. The order of the conditions sets the priority.',
    },
    {
      fa: 'بعد از شاخهٔ BTNC اضافه کنید: <code>else if (BTNU) LED &lt;= {LED[14:0], 1\'b0}; else if (BTND) LED &lt;= {1\'b0, LED[15:1]};</code> و BTNU و BTND را به پورت‌ها اضافه کنید. در VHDL از <code>&amp;</code> برای چسباندن بیت‌ها استفاده کنید.',
      en: 'After the BTNC branch add <code>else if (BTNU) LED &lt;= {LED[14:0], 1\'b0}; else if (BTND) LED &lt;= {1\'b0, LED[15:1]};</code> and add BTNU and BTND to the ports. In VHDL use <code>&amp;</code> to join bits.',
    },
  ],
  counter: [
    {
      fa: 'به یک ثبات ۱۶ بیتی با یک بیت روشن و یک بیت جهت نیاز دارید. هر DIV کلاک ثبات یک خانه در جهت فعلی شیفت می‌خورد و در دو سر جهت عوض می‌شود.',
      en: 'You need a 16-bit register with one bit set and a direction bit. Every DIV clocks the register shifts one place in the current direction, and the direction flips at the ends.',
    },
    {
      fa: '<code>module top #(parameter DIV = 10_000_000) (...)</code>؛ در شاخهٔ تیک: <code>if (!dir) begin if (LED[14]) dir &lt;= 1; LED &lt;= LED &lt;&lt; 1; end else begin if (LED[1]) dir &lt;= 0; LED &lt;= LED &gt;&gt; 1; end</code>. در VHDL: <code>generic (DIV : integer := 10_000_000);</code>',
      en: '<code>module top #(parameter DIV = 10_000_000) (...)</code>; in the tick branch: <code>if (!dir) begin if (LED[14]) dir &lt;= 1; LED &lt;= LED &lt;&lt; 1; end else begin if (LED[1]) dir &lt;= 0; LED &lt;= LED &gt;&gt; 1; end</code>. In VHDL: <code>generic (DIV : integer := 10_000_000);</code>',
    },
  ],
  testbench: [
    {
      fa: 'Testbench باید خودش ریست بدهد و بعد مقدار LED را با مقدار درست مقایسه کند. پیش از ریست، شمارنده را با SW0 راه بیندازید تا عددی غیرصفر داشته باشد.',
      en: 'The testbench must apply the reset itself and then compare LED with the right value. Before the reset, start the counter with SW0 so it holds a non-zero value.',
    },
    {
      fa: 'پیش از <code>$finish</code>: <code>SW[0] = 1; repeat (8) @(posedge CLK100MHZ); CPU_RESETN = 0; repeat (3) @(posedge CLK100MHZ); #1; if (LED[7:0] !== 0) $error("…");</code>. در VHDL از <code>wait until rising_edge(CLK100MHZ);</code> و <code>assert … severity error;</code> استفاده کنید.',
      en: 'Before <code>$finish</code>: <code>SW[0] = 1; repeat (8) @(posedge CLK100MHZ); CPU_RESETN = 0; repeat (3) @(posedge CLK100MHZ); #1; if (LED[7:0] !== 0) $error("…");</code>. In VHDL use <code>wait until rising_edge(CLK100MHZ);</code> and <code>assert … severity error;</code>.',
    },
  ],
  shiftreg: [
    {
      fa: 'همان LFSR درس را ۱۶ بیتی کنید: بیت تازه XOR بیت‌های ۱۵، ۱۳، ۱۲ و ۱۰ است و از پایین وارد می‌شود. تیک را با DIV بسازید.',
      en: 'Widen the lesson’s LFSR to 16 bits: the new bit is the XOR of bits 15, 13, 12 and 10 and enters at the bottom. Make the tick from DIV.',
    },
    {
      fa: '<code>wire tick = (cnt == DIV - 1);</code> و <code>else if (tick) q &lt;= {q[14:0], q[15] ^ q[13] ^ q[12] ^ q[10]};</code> با مقدار ریست <code>16\'h0001</code>، و <code>assign LED = q;</code>.',
      en: '<code>wire tick = (cnt == DIV - 1);</code> and <code>else if (tick) q &lt;= {q[14:0], q[15] ^ q[13] ^ q[12] ^ q[10]};</code> with reset value <code>16\'h0001</code>, and <code>assign LED = q;</code>.',
    },
  ],
  multiplex: [
    {
      fa: 'برای هشت رقم، شمارندهٔ refresh یک بیت بیشتر لازم دارد تا سه بیت بالایش رقم را انتخاب کنند. شمارندهٔ ۱۶ بیتی با یک تیک DIV جدا زیاد می‌شود.',
      en: 'For eight digits the refresh counter needs one more bit, so its top three bits pick the digit. The 16-bit counter counts on a separate DIV tick.',
    },
    {
      fa: '<code>reg [18:0] refresh;</code> و <code>wire [2:0] digit = refresh[18:16];</code>؛ در <code>case (digit)</code> حالت‌های ۴ تا ۷ را به <code>cnt[3:0]</code> تا <code>cnt[15:12]</code> بدهید و AN را با <code>~(8\'b1 &lt;&lt; digit)</code> بسازید.',
      en: '<code>reg [18:0] refresh;</code> and <code>wire [2:0] digit = refresh[18:16];</code>; in <code>case (digit)</code> map cases 4 to 7 to <code>cnt[3:0]</code> up to <code>cnt[15:12]</code> and build AN with <code>~(8\'b1 &lt;&lt; digit)</code>.',
    },
  ],
  stopwatch: [
    {
      fa: 'رقم ده‌ثانیه حالا شمارندهٔ پیمانهٔ ۶ است (۰ تا ۵) و وقتی از ۵ به ۰ برمی‌گردد یکی به رقم دقیقه اضافه می‌کند. AN3 را برای دقیقه روشن کنید.',
      en: 'The tens-of-seconds digit now counts modulo 6 (0 to 5) and carries into a minutes digit when it wraps. Light AN3 for the minutes.',
    },
    {
      fa: 'یک <code>d3</code> اضافه کنید و جای <code>d2 &lt;= (d2 == 9) ? 0 : d2 + 1;</code> بنویسید <code>if (d2 != 5) d2 &lt;= d2 + 1; else begin d2 &lt;= 0; d3 &lt;= (d3 == 9) ? 0 : d3 + 1; end</code>. تقسیم‌کننده را <code>parameter DIV</code> کنید.',
      en: 'Add a <code>d3</code> and replace <code>d2 &lt;= (d2 == 9) ? 0 : d2 + 1;</code> with <code>if (d2 != 5) d2 &lt;= d2 + 1; else begin d2 &lt;= 0; d3 &lt;= (d3 == 9) ? 0 : d3 + 1; end</code>. Make the divider a <code>parameter DIV</code>.',
    },
  ],
  fsm: [
    {
      fa: 'حالت شب یک شمارندهٔ جدا برای چشمک نیم‌ثانیه‌ای می‌خواهد. وقتی SW0 روشن است ماشین حالت را در RED نگه دارید تا بعد از خاموش شدن از قرمز شروع کند.',
      en: 'Night mode needs its own counter for the half-second blink. While SW0 is on, hold the state machine in RED so it starts from red when SW0 goes off.',
    },
    {
      fa: 'ریست را <code>if (!CPU_RESETN || SW[0])</code> کنید، یک بیت <code>nb</code> که هر <code>ONE_SECOND / 2</code> کلاک برعکس می‌شود بسازید، و در خروجی‌ها: <code>if (SW[0]) begin LED16_R = nb; LED16_G = nb; end</code>.',
      en: 'Make the reset <code>if (!CPU_RESETN || SW[0])</code>, add a bit <code>nb</code> that toggles every <code>ONE_SECOND / 2</code> clocks, and in the outputs: <code>if (SW[0]) begin LED16_R = nb; LED16_G = nb; end</code>.',
    },
  ],
  debounce: [
    {
      fa: 'زنجیرهٔ BTNC را برای BTNU تکرار کنید: یک debouncer، بعد یک آشکارساز لبه. هر پالس لبه ثبات را یک بار می‌چرخاند.',
      en: 'Repeat the BTNC chain for BTNU: a debouncer, then an edge detector. Each edge pulse rotates the register once.',
    },
    {
      fa: '<code>debounce u_dbu (.clk(CLK100MHZ), .sw(BTNU), .db(dbu)); edge_detect e_dbu (.clk(CLK100MHZ), .level(dbu), .tick(dbu_tick));</code> و <code>if (dbu_tick) r &lt;= {r[14:0], r[15]};</code> با <code>r = 16\'h0001</code>.',
      en: '<code>debounce u_dbu (.clk(CLK100MHZ), .sw(BTNU), .db(dbu)); edge_detect e_dbu (.clk(CLK100MHZ), .level(dbu), .tick(dbu_tick));</code> and <code>if (dbu_tick) r &lt;= {r[14:0], r[15]};</code> with <code>r = 16\'h0001</code>.',
    },
  ],
  bin2bcd: [
    {
      fa: 'مبدل همین حالا ورودی <code>start</code> و خروجی <code>ready</code> دارد. کافی است start را به جای ۱ ثابت به BTNC وصل کنید؛ ثبات خروجی نتیجه را نگه می‌دارد.',
      en: 'The converter already has a <code>start</code> input and a <code>ready</code> output. Connect start to BTNC instead of a constant 1; the output register keeps the result.',
    },
    {
      fa: 'BTNC را به پورت‌ها اضافه کنید، <code>.start(BTNC)</code> بنویسید و <code>assign LED = {ready, 2\'b00, SW[12:0]};</code>. خطوط دکمه‌ها را در XDC فعال کنید.',
      en: 'Add BTNC to the ports, write <code>.start(BTNC)</code> and <code>assign LED = {ready, 2\'b00, SW[12:0]};</code>. Uncomment the button lines in the XDC.',
    },
  ],
  uart: [
    {
      fa: 'زمان یک بیت = فرکانس کلاک ÷ baud. برای 9600 این عدد چند کلاک است؟',
      en: 'One bit time = clock frequency ÷ baud. How many clocks is that at 9600?',
    },
    {
      fa: '100,000,000 ÷ 9600 ≈ 10417. مقدار <code>CLKS_PER_BIT</code> را از 868 به 10417 تغییر دهید و baud دیکودر را هم 9600 بگذارید.',
      en: '100,000,000 ÷ 9600 ≈ 10417. Change <code>CLKS_PER_BIT</code> from 868 to 10417 and set the decoder’s baud to 9600 too.',
    },
  ],
  uart_rx: [
    {
      fa: 'گیرنده و فرستنده هر دو باید با همان سرعت کار کنند؛ نصف زمان بیت گیرنده از همان عدد به دست می‌آید.',
      en: 'The receiver and the transmitter must both use the same speed; the receiver’s half bit time comes from the same number.',
    },
    {
      fa: 'همهٔ <code>CLKS_PER_BIT = 868</code>ها را 10417 کنید (100 MHz ÷ 9600) و سرعت Serial Console را 9600 بگذارید.',
      en: 'Change every <code>CLKS_PER_BIT = 868</code> to 10417 (100 MHz ÷ 9600) and set the serial console to 9600.',
    },
  ],
  spi: [
    {
      fa: 'در mode 3، SCLK در بیکاری ۱ است؛ پس اولین لبه بعد از CS پایین‌رونده است و جای «نمونه‌برداری» و «بیرون دادن بیت» در دو لبه عوض می‌شود.',
      en: 'In mode 3 SCLK idles at 1, so the first edge after CS is a falling one, and the “sample” and “shift out” steps swap edges.',
    },
    {
      fa: '<code>DIV = 5</code> و <code>sclk = 1\'b1</code> در شروع. در XFER: اگر <code>sclk</code> بالاست، پایینش بیاورید و (به جز بیت اول) بیت بعد را بیرون دهید؛ اگر پایین است، بالا ببرید، MISO را نمونه بگیرید و بعد از بیت ۷ به TAIL بروید.',
      en: '<code>DIV = 5</code> and <code>sclk = 1\'b1</code> at the start. In XFER: if <code>sclk</code> is high, pull it low and (except for the first bit) shift out the next bit; if it is low, raise it, sample MISO, and after bit 7 go to TAIL.',
    },
  ],
  i2c: [
    {
      fa: 'باس I²C یک AND سیمی است: هر دستگاه تازه فقط خط را پایین می‌کشد. یک نمونهٔ دیگر از دستگاه با آدرس 0x49 بسازید و سیگنال پایین‌کشیدنش را با بقیه OR کنید.',
      en: 'An I²C bus is a wired AND: a new device only pulls the line low. Add another device instance with address 0x49 and OR its pull-down signal with the others.',
    },
    {
      fa: '<code>i2c_device #(.ADDR(7\'h49)) sensor2 (.clk(CLK100MHZ), .scl(scl), .sda(sda), .sda_low(d2_low), .data(stored2));</code> و <code>wire sda = !(m_low || d_low || d2_low);</code>.',
      en: '<code>i2c_device #(.ADDR(7\'h49)) sensor2 (.clk(CLK100MHZ), .scl(scl), .sda(sda), .sda_low(d2_low), .data(stored2));</code> and <code>wire sda = !(m_low || d_low || d2_low);</code>.',
    },
  ],
  pwm: [
    {
      fa: 'نفس‌کشیدن یعنی duty یک LED را آرام بالا و پایین ببرید. یک شمارنده هر DIV کلاک duty را یک پله در جهت فعلی جابه‌جا می‌کند و در دو سر جهت عوض می‌شود.',
      en: 'Breathing means moving one LED’s duty slowly up and down. A counter steps the duty once every DIV clocks in the current direction, and the direction flips at both ends.',
    },
    {
      fa: 'یک <code>reg [7:0] d</code> و یک بیت <code>up</code>: <code>if (up) begin if (d == 254) up &lt;= 0; d &lt;= d + 1; end else begin if (d == 1) up &lt;= 1; d &lt;= d - 1; end</code>، بعد یک نمونهٔ سوم <code>pwm</code> با <code>.duty(d)</code> برای LD0.',
      en: 'A <code>reg [7:0] d</code> and a bit <code>up</code>: <code>if (up) begin if (d == 254) up &lt;= 0; d &lt;= d + 1; end else begin if (d == 1) up &lt;= 1; d &lt;= d - 1; end</code>, then a third <code>pwm</code> instance with <code>.duty(d)</code> for LD0.',
    },
  ],
  sensors: [
    {
      fa: '30.0 درجه با گام ۱/۱۶ یعنی 30 × 16 = 480. دمای منفی هیچ‌وقت داغ نیست.',
      en: '30.0 degrees in 1/16 steps is 30 × 16 = 480. A negative temperature is never hot.',
    },
    {
      fa: 'خروجی‌های <code>LED16_R/G/B</code> را اضافه کنید و <code>wire hot = !neg &amp;&amp; (t16 &gt;= 13\'d480);</code>، <code>assign LED16_R = hot; assign LED16_G = !hot;</code>. در VHDL روی <code>signed</code> مقایسه کنید: <code>t16 &gt;= 480</code>.',
      en: 'Add the outputs <code>LED16_R/G/B</code> and <code>wire hot = !neg &amp;&amp; (t16 &gt;= 13\'d480);</code>, <code>assign LED16_R = hot; assign LED16_G = !hot;</code>. In VHDL compare as <code>signed</code>: <code>t16 &gt;= 480</code>.',
    },
  ],
  ps2: [
    {
      fa: 'یک ثبات ۱۶ بیتی نگه دارید که با هر کد make یک رقم، چهار بیت به چپ شیفت بخورد و رقم تازه از راست وارد شود. کدی که بعد از F0 می‌آید رها کردن کلید است و نادیده گرفته می‌شود.',
      en: 'Keep a 16-bit register that shifts left by four bits on every digit make code, with the new digit entering on the right. A code after F0 is a release and is ignored.',
    },
    {
      fa: 'یک <code>case (code)</code> کد را به رقم <code>d</code> تبدیل می‌کند؛ بعد <code>if (done &amp;&amp; !brk &amp;&amp; code != 8\'hF0 &amp;&amp; code != 8\'hE0) begin if (isd) num &lt;= {num[11:0], d}; else if (code == 8\'h66) num &lt;= 0; end</code> و <code>show = num</code>.',
      en: 'A <code>case (code)</code> turns the code into a digit <code>d</code>; then <code>if (done &amp;&amp; !brk &amp;&amp; code != 8\'hF0 &amp;&amp; code != 8\'hE0) begin if (isd) num &lt;= {num[11:0], d}; else if (code == 8\'h66) num &lt;= 0; end</code> and <code>show = num</code>.',
    },
  ],
  vga: [
    {
      fa: 'مربع فقط یک شرط روی x و y است. داخل مربع رنگ از کلیدها می‌آید و بیرون آن همان تصویر قبلی می‌ماند.',
      en: 'The square is just a condition on x and y. Inside it the colour comes from the switches; outside, the old picture stays.',
    },
    {
      fa: '<code>wire sq = (x &gt;= 270) &amp;&amp; (x &lt; 370) &amp;&amp; (y &gt;= 190) &amp;&amp; (y &lt; 290);</code> و <code>wire [11:0] rgb = sq ? SW[15:4] : SW[0] ? check : bar;</code>.',
      en: '<code>wire sq = (x &gt;= 270) &amp;&amp; (x &lt; 370) &amp;&amp; (y &gt;= 190) &amp;&amp; (y &lt; 290);</code> and <code>wire [11:0] rgb = sq ? SW[15:4] : SW[0] ? check : bar;</code>.',
    },
  ],
  ram: [
    {
      fa: 'ROM یعنی حافظه‌ای که فقط خوانده می‌شود: محتوا را با یک <code>case</code> روی آدرس بنویسید. آدرس یک شمارندهٔ ۰ تا ۴ است که هر DIV کلاک جلو می‌رود.',
      en: 'A ROM is read-only memory: write its contents as a <code>case</code> on the address. The address is a 0-to-4 counter that steps every DIV clocks.',
    },
    {
      fa: '<code>case (i) 0: ch = 8\'h48; 1: ch = 8\'h45; 2, 3: ch = 8\'h4C; default: ch = 8\'h4F; endcase</code> و در لبهٔ کلاک: <code>if (cnt == DIV - 1) i &lt;= (i == 4) ? 0 : i + 1;</code>. خروجی: <code>LED = {8\'b0, ch}</code>.',
      en: '<code>case (i) 0: ch = 8\'h48; 1: ch = 8\'h45; 2, 3: ch = 8\'h4C; default: ch = 8\'h4F; endcase</code> and on the clock edge: <code>if (cnt == DIV - 1) i &lt;= (i == 4) ? 0 : i + 1;</code>. Output: <code>LED = {8\'b0, ch}</code>.',
    },
  ],
  softcore: [
    {
      fa: 'دو عدد آخر را در RAM نگه دارید (x و y). در هر دور x را نشان دهید، صبر کنید، اگر x برابر 233 بود از اول شروع کنید، وگرنه t = x + y، x = y و y = t.',
      en: 'Keep the last two numbers in RAM (x and y). Each round show x, wait, start over if x is 233, otherwise t = x + y, x = y and y = t.',
    },
    {
      fa: 'برای «اگر x = 233»: <code>XORI 233</code> و بعد <code>JZ 0</code>، چون XOR دو عدد برابر صفر است. شروع: <code>LDI 1; ST 0; LDI 2; ST 1</code>، حلقه: <code>LD 0; OUT 0; WAIT; XORI 233; JZ 0; LD 0; ADD 1; ST 2; LD 1; ST 0; LD 2; ST 1; JMP 4</code>.',
      en: 'For “if x = 233”: <code>XORI 233</code> then <code>JZ 0</code>, because the XOR of two equal numbers is zero. Start: <code>LDI 1; ST 0; LDI 2; ST 1</code>, loop: <code>LD 0; OUT 0; WAIT; XORI 233; JZ 0; LD 0; ADD 1; ST 2; LD 1; ST 0; LD 2; ST 1; JMP 4</code>.',
    },
  ],
};
