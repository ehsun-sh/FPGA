// Exercises of the board versions of Nexys lessons (docs/EBAZ4205-ROADMAP.md, E3.4). A lesson that has a version for
// a board (lessons/boards.ts) takes its task, checker, hints and solution from here on that board. The EBAZ4205
// checkers run with the extension board attached: LED_R and LED_G are LEDs 0 and 1, LED1-LED3 (EXT_LED) LEDs 2 to 4,
// and the keys are active low (h.btn(name, 1) presses one).
import * as V from '../boards/ebaz4205/varcode';
import { part } from '../lessons/helpers';
import type { BoardHarness } from './harness';
import { uartEcho, type Exercise } from './exercises';

const five = (h: BoardHarness) => h.led() & 31;
const ext = (h: BoardHarness) => (h.led() >> 2) & 7;
const bin = (v: number, n: number) => (v >>> 0).toString(2).padStart(n, '0');
const ones = (v: number) => bin(v, 8).split('').filter((c) => c === '1').length;
const NAMES = ['LED_R', 'LED_G', 'LED1', 'LED2', 'LED3'];

function press(h: BoardHarness, name: string, hold = 4, after = 4) {
  h.btn(name, 1);
  h.run(hold);
  h.btn(name, 0);
  h.run(after);
}

// ---------------------------------------------------------------- counter
const COUNTER: Exercise = {
  fa: `<p>یک چراغ «Knight Rider» روی پنج LED بسازید: ${part('LED_R')} ← ${part('LED_G')} ← ${part('LED1')} ← ${part('LED2')} ← ${part('LED3')} و برگشت. همیشه دقیقاً یک LED روشن است و هر <b>DIV</b> کلاک یک خانه جابه‌جا می‌شود. DIV را به صورت <code>parameter</code> (در VHDL یک <code>generic</code>) با مقدار پیش‌فرض <code>5_000_000</code> (۱۰۰ میلی‌ثانیه در 50MHz) تعریف کنید. بررسی‌کننده آن را کوچک می‌کند تا سریع‌تر تست شود.</p>`,
  en: `<p>Build a “Knight Rider” light on the five LEDs: ${part('LED_R')} → ${part('LED_G')} → ${part('LED1')} → ${part('LED2')} → ${part('LED3')} and back. Exactly one LED is lit at all times, and it moves one position every <b>DIV</b> clocks. Declare DIV as a <code>parameter</code> (a <code>generic</code> in VHDL) with the default <code>5_000_000</code> (100 ms at 50 MHz). The checker makes it small so the test runs fast.</p>`,
  params: { DIV: 64 },
  check(h, t) {
    h.run(32);
    const pos: number[] = [];
    let single = true;
    for (let i = 0; i < 24; i++) {
      const l = five(h);
      if (ones(l) !== 1) single = false;
      pos.push(Math.log2(l || 1));
      h.run(64);
    }
    t.need(single, 'همیشه دقیقاً یک LED روشن است', 'exactly one LED is lit at all times', { expected: '1 LED', actual: single ? '1 LED' : `${ones(five(h))} LED (${bin(five(h), 5)})` });
    let steps = true;
    for (let i = 1; i < pos.length; i++) if (Math.abs(pos[i] - pos[i - 1]) !== 1) steps = false;
    const path = pos.slice(0, 12).map((p) => NAMES[p] ?? '?').join(' ');
    t.ok(steps, 'نور هر DIV کلاک دقیقاً یک خانه جابه‌جا می‌شود', 'the light moves exactly one position every DIV clocks', { expected: 'LED_R LED_G LED1 …', actual: path });
    const seen = new Set(pos);
    t.ok(seen.has(0) && seen.has(4) && seen.size === 5, 'نور از LED_R تا LED3 می‌رود و در دو سر برمی‌گردد', 'the light travels from LED_R to LED3 and bounces at both ends', { expected: 'LED_R … LED3 … LED_R', actual: `${NAMES[Math.min(...pos)]} … ${NAMES[Math.max(...pos)]}` });
  },
  hints: [
    { fa: 'یک ثبات one-hot پنج‌بیتی (یک بیت 1) و یک بیت جهت نگه دارید. هر DIV کلاک ثبات را به چپ یا راست شیفت دهید و در دو سر جهت را برعکس کنید.', en: 'Keep a five-bit one-hot register (a single 1) and a direction bit. Every DIV clocks shift the register left or right, and turn the direction around at both ends.' },
    { fa: '<code>if (!down) begin if (pos[3]) down &lt;= 1; pos &lt;= pos &lt;&lt; 1; end else begin if (pos[1]) down &lt;= 0; pos &lt;= pos &gt;&gt; 1; end</code> و بعد <code>assign LED_R = pos[0]; … assign EXT_LED = pos[4:2];</code>', en: '<code>if (!down) begin if (pos[3]) down &lt;= 1; pos &lt;= pos &lt;&lt; 1; end else begin if (pos[1]) down &lt;= 0; pos &lt;= pos &gt;&gt; 1; end</code>, then <code>assign LED_R = pos[0]; … assign EXT_LED = pos[4:2];</code>' },
  ],
  solution: { verilog: V.V_COUNTER_SOL_V, vhdl: V.V_COUNTER_SOL_VHD },
};

// ---------------------------------------------------------------- fsm
const FSM: Exercise = {
  fa: `<p>یک «حالت شب» اضافه کنید: با یک فشار ${part('KEY2')} حالت شب روشن می‌شود و فقط LED زرد (${part('LED2')}) چشمک می‌زند و هر نیم ثانیه عوض می‌شود. فشار بعدی ${part('KEY2')} حالت شب را خاموش می‌کند و چراغ دوباره از قرمز شروع می‌کند. برای این کار ${part('KEY2')} را به ورودی‌ها اضافه کنید، با یک آشکارساز لبه لحظه‌ی فشردن را پیدا کنید و <code>ONE_SECOND</code> را از <code>localparam</code> به <code>parameter</code> تبدیل کنید.</p>`,
  en: `<p>Add a “night mode”: one press of ${part('KEY2')} switches it on, and then only the yellow LED (${part('LED2')}) flashes, changing every half second. The next press of ${part('KEY2')} switches night mode off, and the light starts again from red. Add ${part('KEY2')} to the inputs, find the moment it goes down with an edge detector, and turn <code>ONE_SECOND</code> from a <code>localparam</code> into a <code>parameter</code>.</p>`,
  params: { ONE_SECOND: 1000 },
  check(h, t) {
    t.need(h.has('btn', 'KEY2'), 'KEY2 به پایه وصل است (خط KEY2 را در XDC فعال کنید)', 'KEY2 is connected to a pin (uncomment the KEY2 line in the XDC)');
    h.run(10);
    press(h, 'KEY2');
    let onlyYellow = true;
    let on = 0;
    let off = 0;
    let changes = 0;
    let prev = -1;
    for (let i = 0; i < 80; i++) {
      const v = ext(h);
      const y = v === 2 ? 1 : v === 0 ? 0 : -1;
      if (y < 0) onlyYellow = false;
      if (y === 1) on++;
      if (y === 0) off++;
      if (prev >= 0 && y !== prev) changes++;
      prev = y;
      h.run(50);
    }
    t.ok(onlyYellow && on > 0 && off > 0, 'بعد از فشار KEY2 فقط LED2 (زرد) چشمک می‌زند', 'after a press of KEY2 only LED2 (yellow) flashes');
    t.ok(changes >= 5 && changes <= 11, `هر نیم ثانیه عوض می‌شود (${changes} تغییر در ۴ ثانیه)`, `it changes every half second (${changes} changes in 4 s)`);
    press(h, 'KEY2');
    let red = false;
    for (let i = 0; i < 60 && !red; i++) {
      red = ext(h) === 1;
      if (!red) h.run(50);
    }
    t.ok(red, 'فشار دوباره‌ی KEY2 چرخه‌ی عادی (قرمز، LED1) را برمی‌گرداند', 'pressing KEY2 again brings back the normal cycle (red, LED1)');
    let green = false;
    for (let i = 0; i < 60 && !green; i++) {
      h.run(50);
      green = ext(h) === 4;
    }
    t.ok(green, 'بعد از قرمز، چراغ مثل قبل سبز می‌شود (LED3)', 'after red the light turns green as before (LED3)');
  },
  hints: [
    { fa: 'یک ثبات <code>night</code> بسازید که با هر فشار KEY2 برعکس شود. فشار را با مقایسه‌ی KEY2 با مقدار کلاک قبلش پیدا کنید (کلید فعال پایین است: 1 بعد 0 یعنی فشار). در حالت شب تایمر هر نیم ثانیه یک بیت <code>flash</code> را برعکس می‌کند.', en: 'Make a register <code>night</code> that flips on every press of KEY2. Find the press by comparing KEY2 with its value one clock before (the key is active low: 1 then 0 is a press). In night mode the timer flips a bit <code>flash</code> every half second.' },
    { fa: "<code>k2 &lt;= KEY2; if (k2 &amp;&amp; !KEY2) begin night &lt;= ~night; state &lt;= RED; timer &lt;= 0; end else if (night) …</code> و در خروجی <code>if (night) EXT_LED = {1'b0, flash, 1'b0};</code>", en: "<code>k2 &lt;= KEY2; if (k2 &amp;&amp; !KEY2) begin night &lt;= ~night; state &lt;= RED; timer &lt;= 0; end else if (night) …</code> and in the output <code>if (night) EXT_LED = {1'b0, flash, 1'b0};</code>" },
  ],
  solution: { verilog: V.V_FSM_SOL_V, vhdl: V.V_FSM_SOL_VHD },
};

// ---------------------------------------------------------------- debounce
const DEBOUNCE: Exercise = {
  fa: `<p>پنج LED را یک ثبات کنید که با <code>00001</code> (فقط ${part('LED_R')}) شروع می‌شود و با هر فشار ${part('KEY2')} دقیقاً یک بیت به چپ می‌چرخد: ${part('LED_R')} ← ${part('LED_G')} ← ${part('LED1')} ← ${part('LED2')} ← ${part('LED3')} و بعد دوباره ${part('LED_R')}. از debouncer همین درس استفاده کنید. ${part('KEY2')} هم لرزش دارد و بدون debouncer یک فشار چند بار ثبات را جابه‌جا می‌کند.</p>`,
  en: `<p>Make the five LEDs a register that starts at <code>00001</code> (only ${part('LED_R')}) and rotates left by exactly one bit on every press of ${part('KEY2')}: ${part('LED_R')} → ${part('LED_G')} → ${part('LED1')} → ${part('LED2')} → ${part('LED3')}, then ${part('LED_R')} again. Use this lesson's debouncer. ${part('KEY2')} bounces too, so without the debouncer one press moves the register several times.</p>`,
  check(h, t) {
    h.run(100);
    t.need(five(h) === 1, `در شروع فقط LED_R روشن است: 00001 (شما: ${bin(five(h), 5)})`, `only LED_R is lit at the start: 00001 (yours: ${bin(five(h), 5)})`);
    const bouncy = (v: number) => {
      for (let i = 0; i < 9; i++) {
        h.btn('KEY2', i % 2 === 0 ? v : 1 - v);
        h.run(7_500);
      }
      h.btn('KEY2', v);
      h.run(1_250_000);
    };
    const got: number[] = [];
    for (let p = 0; p < 3; p++) {
      bouncy(1);
      bouncy(0);
      got.push(five(h));
    }
    const fmt = (xs: number[]) => xs.map((x) => bin(x, 5)).join(', ');
    t.ok(got.join() === [2, 4, 8].join(), `هر فشار (با لرزش) دقیقاً یک بیت: 00010, 00100, 01000 (شما: ${fmt(got)})`, `each bouncy press moves exactly one bit: 00010, 00100, 01000 (yours: ${fmt(got)})`);
  },
  hints: [
    { fa: 'ورودی debouncer باید «1 یعنی فشرده» باشد، پس KEY2 را برعکس کنید. خروجی debouncer را به edge_detect بدهید و با هر tick ثبات را بچرخانید.', en: 'The debouncer wants “1 means pressed”, so invert KEY2. Feed the debouncer output to edge_detect and rotate the register on every tick.' },
    { fa: "<code>debounce u_db (.clk(clk), .sw(~KEY2), .db(db)); edge_detect e (.clk(clk), .level(db), .tick(tick)); always @(posedge clk) if (tick) r &lt;= {r[3:0], r[4]};</code>", en: "<code>debounce u_db (.clk(clk), .sw(~KEY2), .db(db)); edge_detect e (.clk(clk), .level(db), .tick(tick)); always @(posedge clk) if (tick) r &lt;= {r[3:0], r[4]};</code>" },
  ],
  solution: { verilog: V.V_DEBOUNCE_SOL_V, vhdl: V.V_DEBOUNCE_SOL_VHD },
};

// ---------------------------------------------------------------- pwm
const PWM: Exercise = {
  fa: `<p>${part('LED1')} را «نفس‌کشنده» کنید: روشنایی آن آرام از خاموش تا کامل زیاد و بعد دوباره کم شود و این کار تکرار شود. PWM را ۸ بیتی نگه دارید و هر <b>DIV</b> کلاک duty را یک پله بالا یا پایین ببرید. DIV یک <code>parameter</code> با مقدار پیش‌فرض <code>100_000</code> است (۲ میلی‌ثانیه در 50MHz).</p>`,
  en: `<p>Make ${part('LED1')} “breathe”: its brightness rises slowly from off to full, falls again, and repeats. Keep the 8-bit PWM and move the duty one step up or down every <b>DIV</b> clocks. DIV is a <code>parameter</code> with the default <code>100_000</code> (2 ms at 50 MHz).</p>`,
  params: { DIV: 256 },
  check(h, t) {
    const W = 4096;
    const duty: number[] = [];
    for (let w = 0; w < 48; w++) {
      let on = 0;
      for (let i = 0; i < W; i += 4) {
        h.run(4);
        on += ext(h) & 1;
      }
      duty.push(on / (W / 4));
    }
    const lo = Math.min(...duty);
    const hi = Math.max(...duty);
    t.ok(lo < 0.1 && hi > 0.9, `روشنایی LED1 از تقریباً خاموش (${Math.round(lo * 100)}٪) تا تقریباً کامل (${Math.round(hi * 100)}٪) می‌رود`, `LED1 goes from nearly off (${Math.round(lo * 100)}%) to nearly full (${Math.round(hi * 100)}%)`);
    let turns = 0;
    let dir = 0;
    let jumps = 0;
    for (let i = 1; i < duty.length; i++) {
      const d = duty[i] - duty[i - 1];
      if (Math.abs(d) > 0.3) jumps++;
      if (Math.abs(d) < 0.01) continue;
      const s = Math.sign(d);
      if (dir && s !== dir) turns++;
      dir = s;
    }
    t.ok(turns >= 1 && turns <= 6 && jumps === 0, 'روشنایی آرام بالا و پایین می‌رود (بدون پرش ناگهانی)', 'brightness rises and falls smoothly (no sudden jumps)');
  },
  hints: [
    { fa: 'یک شمارنده‌ی کند (تا DIV) و یک ثبات ۸ بیتی level بسازید که در هر tick یکی بالا یا پایین می‌رود. یک بیت جهت در 255 و 0 برعکس می‌شود. level را به duty ماژول pwm بدهید.', en: 'Make a slow counter (up to DIV) and an 8-bit register level that goes up or down by one on every tick. A direction bit turns around at 255 and 0. Feed level into the pwm module’s duty.' },
    { fa: "<code>if (up) begin if (level == 254) up &lt;= 0; level &lt;= level + 1; end else begin if (level == 1) up &lt;= 1; level &lt;= level - 1; end</code> و <code>pwm p (.clk(clk), .duty(level), .pwm_o(p0)); assign EXT_LED = {2'b00, p0};</code>", en: "<code>if (up) begin if (level == 254) up &lt;= 0; level &lt;= level + 1; end else begin if (level == 1) up &lt;= 1; level &lt;= level - 1; end</code> and <code>pwm p (.clk(clk), .duty(level), .pwm_o(p0)); assign EXT_LED = {2'b00, p0};</code>" },
  ],
  solution: { verilog: V.V_PWM_SOL_V, vhdl: V.V_PWM_SOL_VHD },
};

// ---------------------------------------------------------------- uart
const UART: Exercise = {
  fa: `<p>سرعت فرستنده را به <b>9600 baud</b> تغییر دهید. با کلاک 50MHz، <code>CLKS_PER_BIT</code> حالا چند است؟ بعد baud دیکودر UART را در Logic Analyzer و سرعت Serial Console را هم 9600 کنید. اگر فقط یکی از دو طرف عوض شود، حرف‌های اشتباه یا framing error می‌بینید.</p>`,
  en: `<p>Change the transmitter to <b>9600 baud</b>. With the 50 MHz clock, what is <code>CLKS_PER_BIT</code> now? Then set the UART decoder in the logic analyzer and the serial console to 9600 too. If only one side changes, you see wrong characters or framing errors.</p>`,
  check(h, t) {
    t.need(h.hasPin('H17'), 'UART_TX (H17) به طرح وصل است', 'UART_TX (H17) is wired to the design');
    const T = Math.round(h.board.clockHz / 9600);
    const r = h.uartOut('H17', 14 * 10 * T + 20_000, 9600, () => h.btn('KEY3', 1));
    h.btn('KEY3', 0);
    t.ok(r.text === 'Hello FPGA!\r\n' && r.errors === 0, `با 9600 baud پیام "Hello FPGA!" درست دریافت می‌شود (دریافت‌شده: ${JSON.stringify(r.text)})`, `at 9600 baud the message "Hello FPGA!" arrives intact (received: ${JSON.stringify(r.text)})`);
  },
  hints: [
    { fa: 'CLKS_PER_BIT تعداد کلاک‌های یک بیت است: فرکانس کلاک تقسیم بر baud. اینجا کلاک 50MHz است، نه 100MHz.', en: 'CLKS_PER_BIT is the number of clocks in one bit: the clock frequency divided by the baud rate. The clock here is 50 MHz, not 100 MHz.' },
    { fa: '50,000,000 / 9600 ≈ 5208. مقدار پیش‌فرض را در <code>module uart_tx #(parameter CLKS_PER_BIT = 5208)</code> بگذارید (شمارنده‌ی ۱۶ بیتی برای آن کافی است).', en: '50,000,000 / 9600 ≈ 5208. Put it as the default in <code>module uart_tx #(parameter CLKS_PER_BIT = 5208)</code> (the 16-bit counter is wide enough).' },
  ],
  solution: { verilog: V.at9600(V.V_UART_V), vhdl: V.at9600(V.V_UART_VHD) },
};

// ---------------------------------------------------------------- uart_rx
const UART_RX: Exercise = {
  fa: `<p>طرح را (هم گیرنده و هم فرستنده) روی <b>9600 baud</b> ببرید: <code>CLKS_PER_BIT</code> را برای 9600 و کلاک 50MHz درست کنید، سرعت Serial Console را هم 9600 بگذارید، چیزی تایپ کنید و پاسخ را ببینید. قبلش امتحان کنید: اگر کنسول 9600 باشد و طرح 115200، چه چیزی برمی‌گردد و چرا؟</p>`,
  en: `<p>Move the design (receiver and transmitter) to <b>9600 baud</b>: set <code>CLKS_PER_BIT</code> for 9600 at the 50 MHz clock, set the serial console to 9600 too, type something and look at the echo. Try this first: with the console at 9600 and the design at 115200, what comes back, and why?</p>`,
  check(h, t) {
    t.need(h.hasPin('H16') && h.hasPin('H17'), 'UART_RX (H16) و UART_TX (H17) به طرح وصل‌اند', 'UART_RX (H16) and UART_TX (H17) are wired to the design');
    h.pin('H16', 1);
    h.run(1000);
    const out = uartEcho(h, 'fpga', 9600, 'H16', 'H17');
    t.ok(out.text === 'FPGA' && out.errors === 0, `با 9600 baud، "fpga" به صورت "FPGA" برمی‌گردد (دریافت‌شده: ${JSON.stringify(out.text)})`, `at 9600 baud "fpga" comes back as "FPGA" (received: ${JSON.stringify(out.text)})`);
  },
  hints: [
    { fa: 'هر دو ماژول uart_rx و uart_tx پارامتر CLKS_PER_BIT خودشان را دارند؛ هر دو را عوض کنید. کلاک 50MHz است.', en: 'Both uart_rx and uart_tx have their own CLKS_PER_BIT parameter; change both. The clock is 50 MHz.' },
    { fa: '50,000,000 / 9600 ≈ 5208: <code>module uart_rx #(parameter CLKS_PER_BIT = 5208)</code> و همین برای <code>uart_tx</code>.', en: '50,000,000 / 9600 ≈ 5208: <code>module uart_rx #(parameter CLKS_PER_BIT = 5208)</code>, and the same for <code>uart_tx</code>.' },
  ],
  solution: { verilog: V.at9600(V.V_UART_RX_V), vhdl: V.at9600(V.V_UART_RX_VHD) },
};

export const BOARD_EXERCISES: Record<string, Record<string, Exercise>> = {
  ebaz4205: { counter: COUNTER, fsm: FSM, debounce: DEBOUNCE, pwm: PWM, uart: UART, uart_rx: UART_RX },
};
