// Exercises of the EBAZ4205 extension-board chapters ("Extension board" and "HDMI", docs/EBAZ4205-ROADMAP.md
// Phases E3 and E4). The checkers run on the EBAZ4205 with the extension board attached: LED_R and LED_G are LEDs
// 0 and 1, LED1-LED3 (EXT_LED) are LEDs 2 to 4, the keys are active low (h.btn(name, 1) presses one).
// Solutions are written as edits of the lesson code, so the two stay in step; sub() fails loudly if an edit no
// longer applies.
import * as X from '../boards/ebaz4205/extcode';
import { part } from '../lessons/helpers';
import type { BoardHarness } from './harness';
import type { Exercise } from './exercises';

const sub = (src: string, pairs: [string | RegExp, string][]) =>
  pairs.reduce((s, [a, b]) => {
    const out = s.replace(a, b);
    if (out === s) throw new Error(`solution edit did not apply: ${String(a).slice(0, 60)}`);
    return out;
  }, src);

const ext = (h: BoardHarness) => (h.led() >> 2) & 7;
const bin3 = (v: number) => v.toString(2).padStart(3, '0');

// ---------------------------------------------------------------- x-leds: a 5-bit counter on all five LEDs
const X_LEDS_SOL_V = `// x-leds solution: a 5-bit binary counter on all five LEDs, one step every DIV clocks
module top #(
    parameter DIV = 12_500_000
) (
    input  wire       clk,
    output wire       LED_R,              // bit 0 (core board)
    output wire       LED_G,              // bit 1 (core board)
    output wire [2:0] EXT_LED             // bits 4..2 (LED3..LED1)
);
    reg [23:0] cnt = 0;
    reg [4:0]  n   = 0;
    always @(posedge clk) begin
        if (cnt == DIV - 1) begin
            cnt <= 0;
            n   <= n + 1;
        end else
            cnt <= cnt + 1;
    end
    assign LED_R   = n[0];
    assign LED_G   = n[1];
    assign EXT_LED = n[4:2];
endmodule
`;
const X_LEDS_SOL_VHD = `-- x-leds solution: a 5-bit binary counter on all five LEDs, one step every DIV clocks
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity top is
    generic (DIV : integer := 12500000);
    port (
        clk     : in  std_logic;
        LED_R   : out std_logic;                    -- bit 0 (core board)
        LED_G   : out std_logic;                    -- bit 1 (core board)
        EXT_LED : out std_logic_vector(2 downto 0)  -- bits 4..2 (LED3..LED1)
    );
end entity;

architecture rtl of top is
    signal cnt : unsigned(23 downto 0) := (others => '0');
    signal n   : unsigned(4 downto 0) := (others => '0');
begin
    process (clk)
    begin
        if rising_edge(clk) then
            if cnt = DIV - 1 then
                cnt <= (others => '0');
                n   <= n + 1;
            else
                cnt <= cnt + 1;
            end if;
        end if;
    end process;
    LED_R   <= n(0);
    LED_G   <= n(1);
    EXT_LED <= std_logic_vector(n(4 downto 2));
end architecture;
`;

const X_LEDS_EX: Exercise = {
  fa: `<p>هر پنج LED را یک شمارنده‌ی دودویی ۵ بیتی کنید: ${part('LED_R')} بیت ۰، ${part('LED_G')} بیت ۱ و ${part('LED1')} تا ${part('LED3')} بیت‌های ۲ تا ۴. شمارنده هر <b>DIV</b> کلاک یکی زیاد شود و بعد از ۳۱ به ۰ برگردد. دو خط ${part('LED_R')} و ${part('LED_G')} را هم در XDC از حالت توضیح دربیاورید. بررسی‌کننده DIV را ۴ می‌کند.</p>`,
  en: `<p>Turn all five LEDs into a 5-bit binary counter: ${part('LED_R')} is bit 0, ${part('LED_G')} bit 1 and ${part('LED1')} to ${part('LED3')} bits 2 to 4. It counts up by one every <b>DIV</b> clocks and wraps from 31 to 0. Uncomment the ${part('LED_R')} and ${part('LED_G')} lines in the XDC as well. The checker sets DIV to 4.</p>`,
  params: { DIV: 4 },
  check(h, t) {
    h.run(2);
    const seq: number[] = [];
    for (let i = 0; i < 40; i++) {
      seq.push(h.led() & 31);
      h.run(4);
    }
    const steps = seq.slice(1).every((v, i) => v === ((seq[i] + 1) & 31));
    t.ok(steps, 'هر DIV کلاک عدد روی پنج LED یکی زیاد می‌شود', 'the number on the five LEDs goes up by one every DIV clocks', { expected: 'n, n+1, n+2 …', actual: seq.slice(0, 8).join(', ') });
    t.ok(new Set(seq).size === 32, 'همه‌ی ۳۲ عدد از ۰ تا ۳۱ دیده می‌شوند', 'all 32 values from 0 to 31 show up', { expected: '32 values', actual: `${new Set(seq).size} values` });
  },
  hints: [
    { fa: 'به‌جای چرخاندن یک بیت، یک ثبات ۵ بیتی n را هر DIV کلاک یکی زیاد کنید و بیت‌هایش را به LEDها بدهید.', en: 'Instead of rotating one bit, add one to a 5-bit register n every DIV clocks and send its bits to the LEDs.' },
    { fa: '<code>assign LED_R = n[0]; assign LED_G = n[1]; assign EXT_LED = n[4:2];</code> و در پورت‌ها <code>output wire LED_R, LED_G</code>.', en: '<code>assign LED_R = n[0]; assign LED_G = n[1]; assign EXT_LED = n[4:2];</code> with <code>output wire LED_R, LED_G</code> among the ports.' },
  ],
  solution: { verilog: X_LEDS_SOL_V, vhdl: X_LEDS_SOL_VHD },
};

// ---------------------------------------------------------------- x-keys: count KEY1 presses, KEY2 clears
const X_KEYS_SOL_V = `// x-keys solution: LED1-LED3 count the presses of KEY1 in binary; KEY2 sets the count back to 0.
// Both keys go through their own debouncer. The keys are active low (pressed = 0).
module debounce #(
    parameter DB = 500_000
) (
    input  wire clk,
    input  wire key,                      // the raw pin, active low
    output wire press                     // a one-clock pulse per press
);
    reg [1:0]  sync    = 2'b11;
    reg [19:0] cnt     = 0;
    reg        pressed = 1'b0;
    reg        prev    = 1'b0;
    wire       raw     = ~sync[1];
    always @(posedge clk) begin
        sync <= {sync[0], key};
        if (raw == pressed)
            cnt <= 0;
        else if (cnt == DB - 1) begin
            cnt     <= 0;
            pressed <= raw;
        end else
            cnt <= cnt + 1;
        prev <= pressed;
    end
    assign press = pressed & ~prev;
endmodule

module top #(
    parameter DB = 500_000
) (
    input  wire       clk,
    input  wire       KEY1,
    input  wire       KEY2,
    output reg  [2:0] EXT_LED = 3'b000
);
    wire p0, p1;
    debounce #(.DB(DB)) db0 (.clk(clk), .key(KEY1), .press(p0));
    debounce #(.DB(DB)) db1 (.clk(clk), .key(KEY2), .press(p1));
    always @(posedge clk)
        if (p1)      EXT_LED <= 3'b000;
        else if (p0) EXT_LED <= EXT_LED + 1;
endmodule
`;
const X_KEYS_SOL_VHD = `-- x-keys solution: LED1-LED3 count the presses of KEY1 in binary; KEY2 sets the count back to 0.
-- Both keys go through their own debouncer. The keys are active low (pressed = '0').
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity debounce is
    generic (DB : integer := 500000);
    port (
        clk   : in  std_logic;
        key   : in  std_logic;                      -- the raw pin, active low
        press : out std_logic                       -- a one-clock pulse per press
    );
end entity;

architecture rtl of debounce is
    signal sync    : std_logic_vector(1 downto 0) := "11";
    signal raw     : std_logic;
    signal cnt     : unsigned(19 downto 0) := (others => '0');
    signal pressed : std_logic := '0';
    signal prev    : std_logic := '0';
begin
    raw <= not sync(1);
    process (clk)
    begin
        if rising_edge(clk) then
            sync <= sync(0) & key;
            if raw = pressed then
                cnt <= (others => '0');
            elsif cnt = DB - 1 then
                cnt     <= (others => '0');
                pressed <= raw;
            else
                cnt <= cnt + 1;
            end if;
            prev <= pressed;
        end if;
    end process;
    press <= pressed and not prev;
end architecture;

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity top is
    generic (DB : integer := 500000);
    port (
        clk     : in  std_logic;
        KEY1    : in  std_logic;
        KEY2    : in  std_logic;
        EXT_LED : out std_logic_vector(2 downto 0)
    );
end entity;

architecture rtl of top is
    signal p0, p1 : std_logic;
    signal n      : unsigned(2 downto 0) := "000";
begin
    db0 : entity work.debounce generic map (DB => DB) port map (clk => clk, key => KEY1, press => p0);
    db1 : entity work.debounce generic map (DB => DB) port map (clk => clk, key => KEY2, press => p1);
    process (clk)
    begin
        if rising_edge(clk) then
            if p1 = '1' then
                n <= "000";
            elsif p0 = '1' then
                n <= n + 1;
            end if;
        end if;
    end process;
    EXT_LED <= std_logic_vector(n);
end architecture;
`;

// a press with contact bounce: 9 quick changes, then the level holds
function bouncy(h: BoardHarness, key: string) {
  for (const v of [1, 0]) {
    for (let i = 0; i < 9; i++) {
      h.btn(key, i % 2 === 0 ? v : 1 - v);
      h.run(30);
    }
    h.btn(key, v);
    h.run(1500);
  }
}

const X_KEYS_EX: Exercise = {
  fa: `<p>${part('LED1')} تا ${part('LED3')} تعداد فشارهای ${part('KEY1')} را به‌صورت دودویی بشمارند (۰ تا ۷ و دوباره ۰)، و ${part('KEY2')} شمارش را صفر کند. هر کلید debouncer خودش را لازم دارد؛ یک ماژول <code>debounce</code> بنویسید و دو بار از آن نمونه بسازید. زمان debounce یک <code>parameter</code> به نام <b>DB</b> است؛ بررسی‌کننده آن را ۲۰۰ می‌کند و کلیدها را با لرزش فشار می‌دهد.</p>`,
  en: `<p>Make ${part('LED1')} to ${part('LED3')} count the presses of ${part('KEY1')} in binary (0 to 7, then 0 again), and make ${part('KEY2')} set the count back to 0. Each key needs its own debouncer: write a <code>debounce</code> module and make two instances of it. The debounce time is a <code>parameter</code> named <b>DB</b>; the checker sets it to 200 and presses the keys with bounce.</p>`,
  params: { DB: 200 },
  check(h, t) {
    h.run(100);
    t.need(h.has('btn', 'KEY1'), 'KEY1 به یک پورت ورودی وصل است', 'KEY1 is wired to an input port');
    const got: number[] = [];
    for (let p = 0; p < 3; p++) {
      bouncy(h, 'KEY1');
      got.push(ext(h));
    }
    t.ok(got.join() === '1,2,3', `هر فشار KEY1 (با لرزش) یکی می‌شمارد: 001, 010, 011 (شما: ${got.map(bin3).join(', ')})`, `each bouncy press of KEY1 counts once: 001, 010, 011 (yours: ${got.map(bin3).join(', ')})`, { expected: '001, 010, 011', actual: got.map(bin3).join(', '), scene: { btn: 'KEY1' } });
    t.need(h.has('btn', 'KEY2'), 'KEY2 به یک پورت ورودی وصل است (خط KEY2 در XDC)', 'KEY2 is wired to an input port (the KEY2 line in the XDC)');
    bouncy(h, 'KEY2');
    const cleared = ext(h);
    bouncy(h, 'KEY1');
    const after = ext(h);
    t.ok(cleared === 0 && after === 1, `KEY2 شمارش را صفر می‌کند و بعد دوباره از ۱ شروع می‌شود (شما: ${bin3(cleared)}، بعد ${bin3(after)})`, `KEY2 sets the count to 0 and it starts again from 1 (yours: ${bin3(cleared)}, then ${bin3(after)})`, { expected: '000, then 001', actual: `${bin3(cleared)}, then ${bin3(after)}`, scene: { btn: 'KEY2' } });
  },
  hints: [
    { fa: 'debouncer درس را به یک ماژول جدا با ورودی کلید و خروجی «یک پالس برای هر فشار» تبدیل کنید. بعد شمارنده با پالس KEY1 زیاد و با پالس KEY2 صفر می‌شود.', en: 'Move the lesson’s debouncer into its own module with the key as input and "one pulse per press" as output. Then the counter goes up on the KEY1 pulse and back to zero on the KEY2 pulse.' },
    { fa: '<code>debounce #(.DB(DB)) db0 (.clk(clk), .key(KEY1), .press(p0));</code> و <code>always @(posedge clk) if (p1) EXT_LED &lt;= 0; else if (p0) EXT_LED &lt;= EXT_LED + 1;</code>', en: '<code>debounce #(.DB(DB)) db0 (.clk(clk), .key(KEY1), .press(p0));</code> and <code>always @(posedge clk) if (p1) EXT_LED &lt;= 0; else if (p0) EXT_LED &lt;= EXT_LED + 1;</code>' },
  ],
  solution: { verilog: X_KEYS_SOL_V, vhdl: X_KEYS_SOL_VHD },
};

// ---------------------------------------------------------------- x-uart: '0' turns the LEDs off, echo in upper case
const X_UART_SOL_V = sub(X.X_UART_V, [
  [/\/\/ x-uart:[^\n]*\n\/\/ Every byte typed[^\n]*\n/, '// x-uart solution: the echo comes back in upper case; 1, 2, 3 toggle LED1-LED3 and 0 turns them all off.\n'],
  ["                8'h33:   EXT_LED[2] <= ~EXT_LED[2];   // '3'\n", "                8'h33:   EXT_LED[2] <= ~EXT_LED[2];   // '3'\n                8'h30:   EXT_LED    <= 3'b000;        // '0': all off\n"],
  ['            hold <= rx_data;', "            // lower-case letters a..z become A..Z\n            hold <= (rx_data >= 8'h61 && rx_data <= 8'h7A) ? rx_data - 8'h20 : rx_data;"],
]);
const X_UART_SOL_VHD = sub(X.X_UART_VHD, [
  [/-- x-uart:[^\n]*\n-- Every byte typed[^\n]*\n/, '-- x-uart solution: the echo comes back in upper case; 1, 2, 3 toggle LED1-LED3 and 0 turns them all off.\n'],
  ['                    when x"33"  => led(2) <= not led(2);\n', '                    when x"33"  => led(2) <= not led(2);\n                    when x"30"  => led    <= "000";         -- \'0\': all off\n'],
  ['                hold <= rx_data;', '                -- lower-case letters a..z become A..Z\n                if unsigned(rx_data) >= 97 and unsigned(rx_data) <= 122 then\n                    hold <= std_logic_vector(unsigned(rx_data) - 32);\n                else\n                    hold <= rx_data;\n                end if;'],
]);

// sends text into UART_RX (H16) and decodes what comes back on UART_TX (H17)
function echo(h: BoardHarness, text: string): string {
  const baud = 115200;
  const T = h.board.clockHz / baud;
  const out: number[] = [];
  let acc = 0;
  const step = (n: number) => {
    for (let i = 0; i < n; i++) {
      h.run(1);
      out.push(h.readPin('H17'));
    }
  };
  for (const ch of text)
    for (const bit of [0, ...Array.from({ length: 8 }, (_, k) => (ch.charCodeAt(0) >> k) & 1), 1]) {
      h.pin('H16', bit);
      acc += T;
      const n = Math.round(acc);
      acc -= n;
      step(n);
    }
  step(Math.round(12 * T));
  let s = '';
  for (let i = 1; i < out.length; i++)
    if (out[i - 1] === 1 && out[i] === 0) {
      const mid = (k: number) => out[Math.round(i + (k + 0.5) * T)] ?? 1;
      if (mid(0) !== 0) continue;
      let v = 0;
      for (let k = 0; k < 8; k++) v |= mid(k + 1) << k;
      s += String.fromCharCode(v);
      i = Math.round(i + 9.5 * T);
    }
  return s;
}

const X_UART_EX: Exercise = {
  fa: `<p>دو چیز اضافه کنید: (۱) فرمان <b>0</b> هر سه LED را خاموش کند؛ (۲) حروف کوچک انگلیسی با حروف بزرگ برگردند (a به A، … z به Z) و بقیه‌ی بایت‌ها همان‌طور که هستند. فرمان‌های 1 تا 3 مثل قبل کار کنند.</p>`,
  en: `<p>Add two things: (1) the command <b>0</b> turns all three LEDs off; (2) lower-case letters come back in upper case (a to A, … z to Z) and every other byte comes back as it is. The commands 1 to 3 work as before.</p>`,
  check(h, t) {
    h.pin('H16', 1);
    h.run(2000);
    t.need(h.hasPin('H16') && h.hasPin('H17'), 'UART_RX (H16) و UART_TX (H17) به طرح وصل‌اند', 'UART_RX (H16) and UART_TX (H17) are wired to the design');
    echo(h, '123');
    const all = ext(h);
    echo(h, '2');
    const two = ext(h);
    t.ok(all === 7 && two === 5, `فرمان‌های 1، 2 و 3 هنوز LEDها را عوض می‌کنند (شما: ${bin3(all)} بعد ${bin3(two)})`, `the commands 1, 2 and 3 still toggle the LEDs (yours: ${bin3(all)} then ${bin3(two)})`, { expected: '111 then 101', actual: `${bin3(all)} then ${bin3(two)}` });
    echo(h, '0');
    const off = ext(h);
    t.ok(off === 0, `فرمان 0 هر سه LED را خاموش می‌کند (شما: ${bin3(off)})`, `the command 0 turns all three LEDs off (yours: ${bin3(off)})`, { expected: '000', actual: bin3(off) });
    const back = echo(h, 'ab Z!');
    t.ok(back === 'AB Z!', `"ab Z!" به صورت "AB Z!" برمی‌گردد (دریافت‌شده: ${JSON.stringify(back)})`, `"ab Z!" comes back as "AB Z!" (received: ${JSON.stringify(back)})`, { expected: '"AB Z!"', actual: JSON.stringify(back) });
  },
  hints: [
    { fa: 'برای فرمان 0 یک شاخه‌ی دیگر به case اضافه کنید (کد اسکی 0 برابر 0x30 است). برای حروف، قبل از گذاشتن بایت در <code>hold</code> اگر بین 0x61 و 0x7A بود 0x20 از آن کم کنید.', en: 'For the command 0, add another branch to the case (the ASCII code of 0 is 0x30). For the letters, subtract 0x20 before the byte goes into <code>hold</code> when it is between 0x61 and 0x7A.' },
    { fa: "<code>8'h30: EXT_LED &lt;= 3'b000;</code> و <code>hold &lt;= (rx_data &gt;= 8'h61 &amp;&amp; rx_data &lt;= 8'h7A) ? rx_data - 8'h20 : rx_data;</code>", en: "<code>8'h30: EXT_LED &lt;= 3'b000;</code> and <code>hold &lt;= (rx_data &gt;= 8'h61 &amp;&amp; rx_data &lt;= 8'h7A) ? rx_data - 8'h20 : rx_data;</code>" },
  ],
  solution: { verilog: X_UART_SOL_V, vhdl: X_UART_SOL_VHD },
};

// ---------------------------------------------------------------- x-buzzer: a short silence at the end of each note
const X_BUZZER_SOL_V = sub(X.X_BUZZER_V, [
  ['// x-buzzer: a square-wave', '// x-buzzer solution: a short silence ends every note (the last eighth of NOTE_TICKS).\n// A square-wave'],
  ['        if (ncnt == NOTE_TICKS - 1) begin', '        if (ncnt >= NOTE_TICKS - NOTE_TICKS / 8)\n            BUZZER <= 1\'b0;               // the gap between two notes\n\n        if (ncnt == NOTE_TICKS - 1) begin'],
]);
const X_BUZZER_SOL_VHD = sub(X.X_BUZZER_VHD, [
  ['-- x-buzzer: a square-wave', '-- x-buzzer solution: a short silence ends every note (the last eighth of NOTE_TICKS).\n-- A square-wave'],
  ['            if ncnt = NOTE_TICKS - 1 then', "            if ncnt >= NOTE_TICKS - NOTE_TICKS / 8 then\n                bz <= '0';                          -- the gap between two notes\n            end if;\n\n            if ncnt = NOTE_TICKS - 1 then"],
]);

// half periods of a pin's square wave and the quiet stretches (pin low for at least `quiet` clocks)
function tone(h: BoardHarness, pin: string, cycles: number, quiet: number) {
  const halves: number[] = [];
  let gaps = 0;
  let last = h.readPin(pin);
  let run = 0;
  for (let i = 0; i < cycles; i++) {
    h.run(1);
    const b = h.readPin(pin);
    run++;
    if (b !== last) {
      if (last === 0 && run >= quiet) gaps++;
      else halves.push(run);
      run = 0;
      last = b;
    }
  }
  const count = new Map<number, number>();
  for (const x of halves) count.set(x, (count.get(x) ?? 0) + 1);
  return { periods: [...count].filter(([, n]) => n >= 5).map(([x]) => x), gaps };
}

const X_BUZZER_EX: Exercise = {
  fa: `<p>بین نت‌ها یک سکوت کوتاه بگذارید: در <b>یک‌هشتم آخر</b> هر نت (وقتی <code>ncnt</code> به <code>NOTE_TICKS - NOTE_TICKS/8</code> رسید) ${part('BUZZER')} صفر بماند. بقیه‌ی نت همان صدای قبل را دارد. بررسی‌کننده <code>CLK_HZ = 52400</code> و <code>NOTE_TICKS = 4000</code> می‌گذارد: آن‌وقت نیم‌پریود C4 صد کلاک است و هر سکوت ۵۰۰ کلاک.</p>`,
  en: `<p>Put a short silence between the notes: during the <b>last eighth</b> of every note (once <code>ncnt</code> reaches <code>NOTE_TICKS - NOTE_TICKS/8</code>) ${part('BUZZER')} stays 0. The rest of the note sounds as before. The checker sets <code>CLK_HZ = 52400</code> and <code>NOTE_TICKS = 4000</code>: half a period of C4 is then 100 clocks and every silence 500 clocks.</p>`,
  params: { CLK_HZ: 52400, NOTE_TICKS: 4000 },
  check(h, t) {
    t.need(h.has('buzzer'), 'BUZZER به یک پورت خروجی وصل است', 'BUZZER is wired to an output port');
    const r = tone(h, 'D18', 4000 * 15, 300);
    t.ok(r.periods.includes(100) && r.periods.includes(50), `گام هنوز نواخته می‌شود: نیم‌پریود C4 صد و C5 پنجاه کلاک (دیده‌شده: ${r.periods.sort((a, b) => b - a).join(', ')})`, `the scale still plays: half a period is 100 clocks for C4 and 50 for C5 (seen: ${r.periods.sort((a, b) => b - a).join(', ')})`, { expected: '100 … 50', actual: r.periods.join(', ') });
    t.ok(r.gaps >= 12, `بعد از هر نت سکوتی هست (${r.gaps} سکوت در ۱۵ نت)`, `every note ends in a silence (${r.gaps} silences in 15 notes)`, { expected: '≥ 12 silences', actual: String(r.gaps) });
  },
  hints: [
    { fa: 'شمارنده‌ی طول نت (<code>ncnt</code>) می‌داند کجای نت هستید. وقتی به یک‌هشتم آخر رسید، فقط BUZZER را صفر نگه دارید.', en: 'The note-length counter (<code>ncnt</code>) knows where in the note you are. Once it reaches the last eighth, just hold BUZZER at 0.' },
    { fa: "بعد از شرط <code>pcnt</code>، در همان always: <code>if (ncnt &gt;= NOTE_TICKS - NOTE_TICKS / 8) BUZZER &lt;= 1'b0;</code> (آخرین مقداردهی برنده است).", en: "After the <code>pcnt</code> branch, in the same always block: <code>if (ncnt &gt;= NOTE_TICKS - NOTE_TICKS / 8) BUZZER &lt;= 1'b0;</code> (the last assignment wins)." },
  ],
  solution: { verilog: X_BUZZER_SOL_V, vhdl: X_BUZZER_SOL_VHD },
};

// ---------------------------------------------------------------- x-lcd: a white square in the centre
const X_LCD_SOL_V = sub(X.X_LCD_V, [
  ['// x-lcd: wake', '// x-lcd solution: the stripes with a 40 x 40 white square in the centre (columns and rows 100 to 139).\n// Wake'],
  ['            default: color = 16\'h0000;    // black\n        endcase\n', "            default: color = 16'h0000;    // black\n        endcase\n        if (x >= 100 && x < 140 && y >= 100 && y < 140)\n            color = 16'hFFFF;             // the white square\n"],
]);
const X_LCD_SOL_VHD = sub(X.X_LCD_VHD, [
  ['-- x-lcd: wake', '-- x-lcd solution: the stripes with a 40 x 40 white square in the centre (columns and rows 100 to 139).\n-- Wake'],
  ['    signal color  : std_logic_vector(15 downto 0);', '    signal color  : std_logic_vector(15 downto 0);\n    signal bar    : std_logic_vector(15 downto 0);  -- the stripe\'s colour'],
  ['    with stripe select color <=', '    with stripe select bar <='],
  ['        x"0000" when others;                        -- black\n', '        x"0000" when others;                        -- black\n\n    color <= x"FFFF" when x >= 100 and x < 140 and y >= 100 and y < 140 else bar;   -- the white square\n'],
]);

const hex4 = (v: number) => (v < 0 ? 'dark' : '0x' + v.toString(16).toUpperCase().padStart(4, '0'));
const X_LCD_EX: Exercise = {
  fa: `<p>روی نوارها یک <b>مربع سفید ۴۰×۴۰</b> وسط صفحه بکشید: ستون‌ها و ردیف‌های ۱۰۰ تا ۱۳۹. بقیه‌ی صفحه همان نوارها بماند. بررسی‌کننده <code>CLK_HZ</code> را ۵۰٬۰۰۰ می‌کند تا انتظارها کوتاه شوند و حافظه‌ی نمایشگر را می‌خواند.</p>`,
  en: `<p>Draw a <b>40 × 40 white square</b> in the middle of the stripes: columns and rows 100 to 139. The rest of the screen keeps the stripes. The checker sets <code>CLK_HZ</code> to 50,000 so the waits get short, and reads the display's memory.</p>`,
  params: { CLK_HZ: 50000 },
  check(h, t) {
    const lcd = h.lcd(4_000_000);
    t.need(!!lcd, 'خطوط LCD_SCL و LCD_SDA به طرح وصل‌اند', 'LCD_SCL and LCD_SDA are wired to the design');
    t.need(lcd!.lit, 'نمایشگر روشن است (SLPOUT و DISPON فرستاده شده و نور پس‌زمینه روشن است)', 'the display is on (SLPOUT and DISPON were sent and the backlight is on)', { expected: 'on', actual: 'dark' });
    const pts: [number, number, number][] = [
      [120, 120, 0xffff],
      [100, 100, 0xffff],
      [139, 139, 0xffff],
      [99, 120, 0x07e0],
      [140, 120, 0xf81f],
      [120, 99, 0xf81f],
      [120, 140, 0xf81f],
      [10, 10, 0xffff],
      [200, 200, 0x001f],
    ];
    const bad = pts.find(([x, y, c]) => lcd!.shown(x, y) !== c);
    t.ok(!bad, 'مربع سفید در ستون و ردیف ۱۰۰ تا ۱۳۹ است و بقیه‌ی صفحه نوارها را نشان می‌دهد', 'the white square covers columns and rows 100 to 139, and the rest of the screen shows the stripes', bad ? { expected: `(${bad[0]}, ${bad[1]}) = ${hex4(bad[2])}`, actual: hex4(lcd!.shown(bad[0], bad[1])) } : { expected: 'square', actual: 'square' });
  },
  hints: [
    { fa: 'رنگ هر پیکسل از روی x و y ساخته می‌شود. کافی است وقتی (x, y) داخل مربع است، رنگ را سفید (0xFFFF) کنید.', en: 'The colour of every pixel is made from x and y. Make it white (0xFFFF) whenever (x, y) is inside the square.' },
    { fa: "بعد از <code>endcase</code> در بلوک رنگ: <code>if (x &gt;= 100 &amp;&amp; x &lt; 140 &amp;&amp; y &gt;= 100 &amp;&amp; y &lt; 140) color = 16'hFFFF;</code>", en: "After the <code>endcase</code> of the colour block: <code>if (x &gt;= 100 &amp;&amp; x &lt; 140 &amp;&amp; y &gt;= 100 &amp;&amp; y &lt; 140) color = 16'hFFFF;</code>" },
  ],
  solution: { verilog: X_LCD_SOL_V, vhdl: X_LCD_SOL_VHD },
};

// ---------------------------------------------------------------- x-hdmi-tmds: a testbench that checks the DC balance
const X_TMDS_TB_SOL_V = sub(X.X_TMDS_TB_V, [
  ['// (1) blanking sends the four control symbols and (2) every video byte comes back unchanged.', '// (1) blanking sends the four control symbols, (2) every video byte comes back unchanged and\n// (3) the running disparity (ones minus zeros sent since the blanking) stays within +-10.'],
  ['    integer i;\n', '    integer i;\n    integer k;\n    integer ones;\n    integer bal = 0;                      // ones minus zeros of the video symbols so far\n'],
  ['                errors = errors + 1;\n            end\n        end', '                errors = errors + 1;\n            end\n            ones = 0;\n            for (k = 0; k < 10; k = k + 1) ones = ones + q[k];\n            bal = bal + 2 * ones - 10;\n            if (bal > 10 || bal < -10) begin\n                $error("the DC balance drifts: %0d after byte %h", bal, d);\n                errors = errors + 1;\n            end\n        end'],
  ['$display("PASS: 4 control symbols and 512 video symbols decode correctly");', '$display("PASS: control symbols, 512 video symbols and the DC balance are right");'],
]);
const X_TMDS_TB_SOL_VHD = sub(X.X_TMDS_TB_VHD, [
  ['-- (1) blanking sends the four control symbols and (2) every video byte comes back unchanged.', '-- (1) blanking sends the four control symbols, (2) every video byte comes back unchanged and\n-- (3) the running disparity (ones minus zeros sent since the blanking) stays within +-10.'],
  ['    stim : process\n    begin', '    stim : process\n        variable ones : integer;\n        variable bal  : integer := 0;               -- ones minus zeros of the video symbols so far\n    begin'],
  ['            assert back = d report "byte " & integer\'image(i mod 256) & " came back wrong" severity error;\n', '            assert back = d report "byte " & integer\'image(i mod 256) & " came back wrong" severity error;\n            ones := 0;\n            for k in 0 to 9 loop\n                if q(k) = \'1\' then\n                    ones := ones + 1;\n                end if;\n            end loop;\n            bal := bal + 2 * ones - 10;\n            assert bal <= 10 and bal >= -10 report "the DC balance drifts: " & integer\'image(bal) severity error;\n'],
]);

const X_TMDS_EX: Exercise = {
  fa: `<p>Testbench را کامل کنید تا <b>تعادل DC</b> را هم بسنجد: بعد از هر نماد ویدیویی تعداد یک‌ها منهای صفرهای آن (۲×یک‌ها − ۱۰) را به یک جمع جاری اضافه کنید و اگر جمع از ۱۰+ بیشتر یا از ۱۰− کمتر شد خطا بدهید. بررسی‌کننده Testbench شما را دو بار اجرا می‌کند: با رمزگذار درست باید بدون خطا تمام شود، و با رمزگذاری که مرحله‌ی دوم را خراب کرده (هیچ‌وقت بایت را برعکس نمی‌کند) باید خطا بدهد. Testbench فعلی این خرابی را نمی‌بیند، چون رمزگشایی هنوز درست است.</p>`,
  en: `<p>Complete the testbench so it checks the <b>DC balance</b> too: after every video symbol, add its ones minus zeros (2 × ones − 10) to a running sum, and report an error when the sum goes above +10 or below −10. The checker runs your testbench twice: with the correct encoder it must finish without errors, and with an encoder whose stage 2 is broken (it never inverts the byte) it must report an error. The testbench as it is misses that fault, because the symbols still decode correctly.</p>`,
  testbench: {
    mutate: {
      verilog: [/end else if \(\(cnt_pos && more1\) \|\| \(cnt_neg && more0\)\) begin/, "end else if (1'b0) begin"],
      vhdl: [/elsif \(cnt > 0 and n1q > 4\) or \(cnt < 0 and n1q < 4\) then/, 'elsif cnt > 99 then'],
    },
  },
  hints: [
    { fa: 'تعداد یک‌های نماد ۱۰ بیتی q را با یک حلقه بشمارید. هر نماد ۲×یک‌ها − ۱۰ به تعادل اضافه می‌کند؛ رمزگذار درست آن را نزدیک صفر نگه می‌دارد.', en: 'Count the ones of the 10-bit symbol q in a loop. Each symbol adds 2 × ones − 10 to the balance; a correct encoder keeps it near zero.' },
    { fa: '<code>ones = 0; for (k = 0; k &lt; 10; k = k + 1) ones = ones + q[k]; bal = bal + 2 * ones - 10; if (bal &gt; 10 || bal &lt; -10) $error(...);</code> بعد از هر نماد ویدیویی.', en: '<code>ones = 0; for (k = 0; k &lt; 10; k = k + 1) ones = ones + q[k]; bal = bal + 2 * ones - 10; if (bal &gt; 10 || bal &lt; -10) $error(...);</code> after every video symbol.' },
  ],
  solution: { verilog: X_TMDS_TB_SOL_V, vhdl: X_TMDS_TB_SOL_VHD },
};

// ---------------------------------------------------------------- x-hdmi-bars: an 8-pixel white border
const rgbHex = (v: number) => '#' + v.toString(16).toUpperCase().padStart(6, '0');
const X_BARS_EX: Exercise = {
  fa: `<p>دور تصویر یک <b>قاب سفید ۸ پیکسلی</b> بکشید: ستون‌های ۰ تا ۷ و ۶۳۲ تا ۶۳۹ و ردیف‌های ۰ تا ۷ و ۴۷۲ تا ۴۷۹ سفید باشند. داخل قاب همان نوارها بماند. بررسی‌کننده یک تصویر کامل را از مانیتور HDMI می‌خواند.</p>`,
  en: `<p>Draw an <b>8-pixel white border</b> around the picture: columns 0 to 7 and 632 to 639 and rows 0 to 7 and 472 to 479 are white. Inside the border the bars stay. The checker reads a whole frame from the HDMI monitor.</p>`,
  check(h, t) {
    const m = h.hdmi(1);
    t.need(!!m, 'طرح نمادها را به tmds_serializer می‌دهد', 'the design gives its symbols to tmds_serializer');
    const st = m!.state(h.cycles);
    t.need(st === 'ok' && m!.mode.w === 640, `مانیتور تصویر 640×480 می‌گیرد (وضعیت: ${st})`, `the monitor locks on 640×480 (state: ${st})`, { expected: 'ok, 640×480', actual: `${st}, ${m!.mode.name}` });
    const px = (x: number, y: number) => {
      const i = (y * m!.mode.w + x) * 4;
      return (m!.pixels[i] << 16) | (m!.pixels[i + 1] << 8) | m!.pixels[i + 2];
    };
    const pts: [number, number, number][] = [
      [636, 2, 0xffffff],
      [320, 476, 0xffffff],
      [4, 240, 0xffffff],
      [600, 240, 0x000000],
      [120, 240, 0xffff00],
      [360, 240, 0xff00ff],
      [600, 9, 0x000000],
    ];
    const bad = pts.find(([x, y, c]) => px(x, y) !== c);
    t.ok(!bad, 'قاب سفید ۸ پیکسلی دور تصویر است و نوارها داخل آن', 'an 8-pixel white border runs round the picture, with the bars inside', bad ? { expected: `(${bad[0]}, ${bad[1]}) = ${rgbHex(bad[2])}`, actual: rgbHex(px(bad[0], bad[1])) } : { expected: 'border', actual: 'border' });
  },
  hints: [
    { fa: 'رنگ پیکسل از x و y ساخته می‌شود. قبل از انتخاب نوار، اگر پیکسل در ۸ ستون یا ۸ ردیف کناری است، سفید بدهید.', en: 'The pixel colour is made from x and y. Before picking the bar, give white when the pixel is in the 8 outer columns or rows.' },
    { fa: "<code>if (x &lt; 8 || x &gt;= H_VIS - 8 || y &lt; 8 || y &gt;= V_VIS - 8) rgb = 24'hFFFFFF; else if (x &lt; 80) …</code>", en: "<code>if (x &lt; 8 || x &gt;= H_VIS - 8 || y &lt; 8 || y &gt;= V_VIS - 8) rgb = 24'hFFFFFF; else if (x &lt; 80) …</code>" },
  ],
  solution: { verilog: X.X_BARS_BORDER_V, vhdl: X.X_BARS_BORDER_VHD },
};

export const EXT_EXERCISES: Record<string, Exercise> = {
  'x-leds': X_LEDS_EX,
  'x-keys': X_KEYS_EX,
  'x-uart': X_UART_EX,
  'x-buzzer': X_BUZZER_EX,
  'x-lcd': X_LCD_EX,
  'x-hdmi-tmds': X_TMDS_EX,
  'x-hdmi-bars': X_BARS_EX,
};
