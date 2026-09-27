// Step-by-step FPGA course. Lesson text is Persian (RTL); code and identifiers stay in English.
import type { XdcGroup } from '../boards';
import { truth } from './helpers';

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  body: string; // HTML
  verilog: string;
  vhdl: string;
  // which groups of the board's master XDC this lesson enables
  xdc: Partial<Record<XdcGroup, boolean>>;
  tryIt: string; // HTML, shown under "روی برد امتحان کنید"
  exercise?: string; // HTML
}

export const VHDL_HEADER = `library ieee;
use ieee.std_logic_1164.all;
`;
export const VHDL_NUMERIC = `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
`;

export const HEX_CASE_V = `        case (x)
            4'h0: seg = 7'b1000000;
            4'h1: seg = 7'b1111001;
            4'h2: seg = 7'b0100100;
            4'h3: seg = 7'b0110000;
            4'h4: seg = 7'b0011001;
            4'h5: seg = 7'b0010010;
            4'h6: seg = 7'b0000010;
            4'h7: seg = 7'b1111000;
            4'h8: seg = 7'b0000000;
            4'h9: seg = 7'b0010000;
            4'hA: seg = 7'b0001000;
            4'hB: seg = 7'b0000011;
            4'hC: seg = 7'b1000110;
            4'hD: seg = 7'b0100001;
            4'hE: seg = 7'b0000110;
            default: seg = 7'b0001110; // F
        endcase`;

export const HEX_CASE_VHDL = `        case x is
            when "0000" => seg <= "1000000";
            when "0001" => seg <= "1111001";
            when "0010" => seg <= "0100100";
            when "0011" => seg <= "0110000";
            when "0100" => seg <= "0011001";
            when "0101" => seg <= "0010010";
            when "0110" => seg <= "0000010";
            when "0111" => seg <= "1111000";
            when "1000" => seg <= "0000000";
            when "1001" => seg <= "0010000";
            when "1010" => seg <= "0001000";
            when "1011" => seg <= "0000011";
            when "1100" => seg <= "1000110";
            when "1101" => seg <= "0100001";
            when "1110" => seg <= "0000110";
            when others => seg <= "0001110"; -- F
        end case;`;

export const LESSONS: Lesson[] = [
  {
    id: 'intro',
    title: 'FPGA چیست؟ آشنایی با برد Nexys A7',
    summary: 'اولین طراحی: هر کلید، LED بالای خودش را روشن می‌کند.',
    body: `
<p><b>FPGA</b> (Field Programmable Gate Array) تراشه‌ای است که <b>سخت‌افزار</b> داخلش را خودمان تعریف می‌کنیم. برخلاف پردازنده که دستورها را یکی‌یکی اجرا می‌کند، در FPGA مدار واقعی ساخته می‌شود و همه بخش‌ها <b>هم‌زمان</b> کار می‌کنند.</p>
<h3>داخل FPGA چه خبر است؟</h3>
<ul>
  <li><b>LUT</b> (Look-Up Table): جدول کوچکی که هر تابع منطقی ۶ ورودی را پیاده می‌کند.</li>
  <li><b>Flip-Flop</b>: یک بیت حافظه که با لبه کلاک مقدار می‌گیرد.</li>
  <li><b>Routing</b>: سیم‌کشی قابل برنامه‌ریزی بین بلوک‌ها.</li>
  <li>بلوک‌های ویژه مثل <b>BRAM</b> (حافظه)، <b>DSP</b> (ضرب‌کننده) و مدیریت کلاک.</li>
</ul>
<p>تراشه برد ما <b>Xilinx Artix-7 XC7A100T</b> است: حدود ۶۳ هزار LUT و ۱۲۶ هزار فلیپ‌فلاپ.</p>
<h3>جریان کار در Vivado</h3>
<ol class="flow-steps">
  <li><b>Design Sources</b>: نوشتن کد به زبان Verilog یا VHDL</li>
  <li><b>Constraints (XDC)</b>: وصل کردن پورت‌های کد به پایه‌های تراشه</li>
  <li><b>Simulation</b>: بررسی رفتار مدار</li>
  <li><b>Synthesis</b>: تبدیل کد به گیت و فلیپ‌فلاپ</li>
  <li><b>Implementation</b>: جای‌گذاری و سیم‌کشی داخل تراشه</li>
  <li><b>Generate Bitstream</b> و <b>Program Device</b>: ریختن طرح روی برد</li>
</ol>
<p>در این سایت همین مراحل را با دکمه <span class="kbd">▶ Run</span> انجام می‌دهید و نتیجه را روی برد سه‌بعدی سمت راست می‌بینید.</p>
<h3>آشنایی با برد</h3>
<ul>
  <li><b>SW0 تا SW15</b>: ۱۶ کلید کشویی (ورودی)</li>
  <li><b>LD0 تا LD15</b>: ۱۶ LED سبز (خروجی)</li>
  <li><b>BTNC/BTNU/BTNL/BTNR/BTND</b>: پنج دکمه فشاری و <b>CPU RESET</b> (فعال با صفر)</li>
  <li>دو نمایشگر <b>۷ قسمتی</b> چهار رقمی (AN0 تا AN7)</li>
  <li>دو LED سه‌رنگ <b>LD16</b> و <b>LD17</b></li>
  <li>کلاک <b>100MHz</b> روی پایه E3 با نام <code>CLK100MHZ</code></li>
</ul>
<h3>اولین طراحی</h3>
<p>ساده‌ترین مدار ممکن: هر کلید را مستقیم به LED بالایش سیم‌کشی می‌کنیم. در Verilog با <code>assign</code> و در VHDL با <code>&lt;=</code> یک اتصال دائمی (ترکیبی) ساخته می‌شود.</p>
<h3>ساختار این دوره</h3>
<p>ترتیب فصل‌ها از کتاب <i>FPGA Prototyping by Verilog/VHDL Examples</i> نوشته Pong P. Chu گرفته شده است: اول گیت‌ها، بعد مدارهای ترکیبی سطح RT، مدارهای ترتیبی منظم، ماشین حالت، FSMD، حافظه و ورودی/خروجی. متن و کدهای اینجا مخصوص همین سایت نوشته شده‌اند و کتاب منبع خوبی برای مطالعه عمیق‌تر است.</p>`,
    verilog: `// every switch drives the LED right above it
module top (
    input  wire [15:0] SW,
    output wire [15:0] LED
);
    assign LED = SW;
endmodule
`,
    vhdl: `${VHDL_HEADER}
-- every switch drives the LED right above it
entity top is
    port (
        SW  : in  std_logic_vector(15 downto 0);
        LED : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
begin
    LED <= SW;
end rtl;
`,
    xdc: { sw: true, led: true },
    tryIt: `<p>روی <span class="kbd">▶ Run</span> بزنید، بعد روی کلیدهای پایین برد کلیک کنید. هر کلید که بالا برود (ON) LED بالای آن روشن می‌شود.</p>`,
    exercise: `<p>کد را طوری تغییر دهید که ترتیب LEDها برعکس شود (SW0 → LD15). راهنمایی: در Verilog از <code>{SW[0], SW[1], ...}</code> یا یک حلقه استفاده کنید.</p>`,
  },
  {
    id: 'gates',
    title: 'گیت‌های منطقی',
    summary: 'AND، OR، NOT، NAND، NOR، XOR و XNOR با دو کلید.',
    body: `
<p>گیت‌ها آجرهای ساختمان هر مدار دیجیتال هستند. هر گیت روی بیت‌های ورودی یک تابع ساده انجام می‌دهد. در این درس <b>A = SW0</b> و <b>B = SW1</b> است و خروجی هر گیت روی یک LED نمایش داده می‌شود.</p>
${truth(
  ['A', 'B', 'AND<br>LD0', 'OR<br>LD1', 'NOT A<br>LD2', 'NAND<br>LD3', 'NOR<br>LD4', 'XOR<br>LD5', 'XNOR<br>LD6'],
  [
    [0, 0, 0, 0, 1, 1, 1, 0, 1],
    [0, 1, 0, 1, 1, 1, 0, 1, 0],
    [1, 0, 0, 1, 0, 1, 0, 1, 0],
    [1, 1, 1, 1, 0, 0, 0, 0, 1],
  ],
)}
<h3>عملگرها در دو زبان</h3>
${truth(
  ['گیت', 'Verilog', 'VHDL'],
  [
    ['AND', '<code>a &amp; b</code>', '<code>a and b</code>'],
    ['OR', '<code>a | b</code>', '<code>a or b</code>'],
    ['NOT', '<code>~a</code>', '<code>not a</code>'],
    ['NAND', '<code>~(a &amp; b)</code>', '<code>a nand b</code>'],
    ['NOR', '<code>~(a | b)</code>', '<code>a nor b</code>'],
    ['XOR', '<code>a ^ b</code>', '<code>a xor b</code>'],
    ['XNOR', '<code>~(a ^ b)</code>', '<code>a xnor b</code>'],
  ],
)}
<p>نکته: در FPGA گیت جداگانه ساخته نمی‌شود؛ ابزار سنتز همه این توابع را داخل <b>LUT</b> پیاده می‌کند. در گزارش سنتز (تب Reports) تعداد LUT تقریبی را ببینید.</p>`,
    verilog: `// basic logic gates. A = SW[0], B = SW[1]
module top (
    input  wire [1:0] SW,
    output wire [6:0] LED
);
    wire a = SW[0];
    wire b = SW[1];

    assign LED[0] = a & b;      // AND
    assign LED[1] = a | b;      // OR
    assign LED[2] = ~a;         // NOT
    assign LED[3] = ~(a & b);   // NAND
    assign LED[4] = ~(a | b);   // NOR
    assign LED[5] = a ^ b;      // XOR
    assign LED[6] = ~(a ^ b);   // XNOR
endmodule
`,
    vhdl: `${VHDL_HEADER}
-- basic logic gates. A = SW(0), B = SW(1)
entity top is
    port (
        SW  : in  std_logic_vector(1 downto 0);
        LED : out std_logic_vector(6 downto 0)
    );
end top;

architecture rtl of top is
    signal a, b : std_logic;
begin
    a <= SW(0);
    b <= SW(1);

    LED(0) <= a and b;    -- AND
    LED(1) <= a or b;     -- OR
    LED(2) <= not a;      -- NOT
    LED(3) <= a nand b;   -- NAND
    LED(4) <= a nor b;    -- NOR
    LED(5) <= a xor b;    -- XOR
    LED(6) <= a xnor b;   -- XNOR
end rtl;
`,
    xdc: { sw: true, led: true },
    tryIt: `<p>کلیدهای <b>SW0</b> و <b>SW1</b> را در چهار حالت ممکن قرار دهید و LEDهای LD0 تا LD6 را با جدول درستی مقایسه کنید. LD2 (NOT) فقط به SW0 بستگی دارد.</p>`,
    exercise: `<p>یک گیت AND سه‌ورودی (SW0، SW1، SW2) بسازید و خروجی را روی LD7 نشان دهید. پورت SW را ۳ بیتی و LED را ۸ بیتی کنید.</p>`,
  },
  {
    id: 'mux',
    title: 'مالتی‌پلکسر (MUX)',
    summary: 'انتخاب یک ورودی از بین چند ورودی با سیگنال انتخاب.',
    body: `
<p><b>مالتی‌پلکسر</b> مثل یک کلید چندحالته است: با سیگنال <b>انتخاب (select)</b> مشخص می‌کنیم کدام ورودی به خروجی برسد. MUX یکی از پرکاربردترین بلوک‌ها در طراحی دیجیتال است.</p>
<h3>MUX دو به یک</h3>
<p>اگر <code>sel = 0</code> باشد خروجی برابر <code>d0</code> و اگر <code>sel = 1</code> باشد برابر <code>d1</code> است: <code>y = sel ? d1 : d0</code>. در این درس <b>d0 = SW0</b>، <b>d1 = SW1</b> و <b>sel = SW15</b> است و خروجی روی <b>LD0</b> است.</p>
<h3>MUX چهار به یک</h3>
<p>با دو بیت انتخاب (<b>SW5، SW4</b>) یکی از چهار ورودی <b>SW0 تا SW3</b> روی <b>LD1</b> می‌رود.</p>
${truth(
  ['SW5', 'SW4', 'LD1 ='],
  [
    [0, 0, 'SW0'],
    [0, 1, 'SW1'],
    [1, 0, 'SW2'],
    [1, 1, 'SW3'],
  ],
)}
<h3>سه روش توصیف</h3>
<ul>
  <li>عملگر شرطی: Verilog <code>? :</code> و VHDL <code>when ... else</code></li>
  <li><code>case</code> داخل بلوک ترکیبی (<code>always @(*)</code> یا <code>process</code>)</li>
  <li>در VHDL: <code>with ... select</code></li>
</ul>
<p class="note">⚠️ در بلوک ترکیبی حتماً برای همه حالت‌ها مقدار بدهید (<code>default</code> یا <code>when others</code>)، وگرنه ابزار سنتز <b>Latch</b> می‌سازد.</p>`,
    verilog: `// multiplexers
module top (
    input  wire [15:0] SW,
    output reg  [1:0]  LED
);
    // 2:1 MUX with the conditional operator: sel = SW[15]
    wire y2 = SW[15] ? SW[1] : SW[0];

    // 4:1 MUX with a case statement: sel = SW[5:4]
    always @(*) begin
        LED[0] = y2;
        case (SW[5:4])
            2'b00:   LED[1] = SW[0];
            2'b01:   LED[1] = SW[1];
            2'b10:   LED[1] = SW[2];
            default: LED[1] = SW[3];
        endcase
    end
endmodule
`,
    vhdl: `${VHDL_HEADER}
-- multiplexers
entity top is
    port (
        SW  : in  std_logic_vector(15 downto 0);
        LED : out std_logic_vector(1 downto 0)
    );
end top;

architecture rtl of top is
begin
    -- 2:1 MUX with a conditional signal assignment: sel = SW(15)
    LED(0) <= SW(1) when SW(15) = '1' else SW(0);

    -- 4:1 MUX with a selected signal assignment: sel = SW(5 downto 4)
    with SW(5 downto 4) select
        LED(1) <= SW(0) when "00",
                  SW(1) when "01",
                  SW(2) when "10",
                  SW(3) when others;
end rtl;
`,
    xdc: { sw: true, led: true },
    tryIt: `<p>SW0 را روشن و SW1 را خاموش کنید. حالا با SW15 بین دو ورودی جابه‌جا شوید و LD0 را ببینید. برای MUX چهار به یک، SW4 و SW5 را تغییر دهید و ببینید LD1 از کدام کلید پیروی می‌کند.</p>`,
    exercise: `<p>یک MUX هشت به یک بسازید: ورودی‌ها SW0 تا SW7، انتخاب SW15..SW13 و خروجی LD2.</p>`,
  },
  {
    id: 'adder',
    title: 'جمع‌کننده و طراحی سلسله‌مراتبی',
    summary: 'نیم‌جمع‌کننده، تمام‌جمع‌کننده و جمع‌کننده ۴ بیتی با نمونه‌سازی ماژول.',
    body: `
<p><b>تمام‌جمع‌کننده (Full Adder)</b> سه بیت <code>a</code>، <code>b</code> و رقم نقلی ورودی <code>cin</code> را جمع می‌کند و حاصل <code>s</code> و رقم نقلی خروجی <code>cout</code> را می‌دهد:</p>
<pre class="formula">s    = a ⊕ b ⊕ cin
cout = a·b + cin·(a ⊕ b)</pre>
${truth(
  ['a', 'b', 'cin', 'cout', 's'],
  [
    [0, 0, 0, 0, 0],
    [0, 0, 1, 0, 1],
    [0, 1, 0, 0, 1],
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 1, 1, 0],
    [1, 1, 0, 1, 0],
    [1, 1, 1, 1, 1],
  ],
)}
<h3>سلسله‌مراتب (Hierarchy)</h3>
<p>با چهار نمونه از ماژول <code>full_adder</code> که رقم نقلی را زنجیروار به هم می‌دهند، یک <b>جمع‌کننده ۴ بیتی ripple-carry</b> می‌سازیم. این همان کاری است که در Vivado در پنجره Sources به‌صورت درختی می‌بینید.</p>
<ul>
  <li><b>A = SW3..SW0</b> و <b>B = SW7..SW4</b> و <b>Cin = SW8</b></li>
  <li>حاصل روی <b>LD3..LD0</b> و رقم نقلی روی <b>LD4</b></li>
  <li>برای مقایسه، همان جمع با عملگر <code>+</code> روی <b>LD12..LD8</b></li>
</ul>
<p>در عمل همیشه از <code>+</code> استفاده می‌کنیم؛ ابزار سنتز آن را روی زنجیره نقلی سریع (CARRY4) تراشه پیاده می‌کند.</p>`,
    verilog: `// full adder + 4-bit ripple-carry adder
module full_adder (
    input  wire a, b, cin,
    output wire s, cout
);
    assign s    = a ^ b ^ cin;
    assign cout = (a & b) | (cin & (a ^ b));
endmodule

module top (
    input  wire [15:0] SW,
    output wire [15:0] LED
);
    wire [3:0] a = SW[3:0];
    wire [3:0] b = SW[7:4];
    wire [4:0] c;              // carry chain
    assign c[0] = SW[8];

    full_adder fa0 (.a(a[0]), .b(b[0]), .cin(c[0]), .s(LED[0]), .cout(c[1]));
    full_adder fa1 (.a(a[1]), .b(b[1]), .cin(c[1]), .s(LED[1]), .cout(c[2]));
    full_adder fa2 (.a(a[2]), .b(b[2]), .cin(c[2]), .s(LED[2]), .cout(c[3]));
    full_adder fa3 (.a(a[3]), .b(b[3]), .cin(c[3]), .s(LED[3]), .cout(c[4]));
    assign LED[4] = c[4];

    // The same sum with the + operator, for comparison
    assign LED[12:8] = a + b + SW[8];

    assign LED[7:5]   = 3'b000;
    assign LED[15:13] = 3'b000;
endmodule
`,
    vhdl: `${VHDL_NUMERIC}
-- full adder + 4-bit ripple-carry adder
entity full_adder is
    port (
        a, b, cin : in  std_logic;
        s, cout   : out std_logic
    );
end full_adder;

architecture rtl of full_adder is
begin
    s    <= a xor b xor cin;
    cout <= (a and b) or (cin and (a xor b));
end rtl;

${VHDL_NUMERIC}
entity top is
    port (
        SW  : in  std_logic_vector(15 downto 0);
        LED : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal a, b : std_logic_vector(3 downto 0);
    signal c    : std_logic_vector(4 downto 0);   -- carry chain
    signal cin5 : unsigned(4 downto 0);
begin
    a    <= SW(3 downto 0);
    b    <= SW(7 downto 4);
    c(0) <= SW(8);

    fa0 : entity work.full_adder port map (a => a(0), b => b(0), cin => c(0), s => LED(0), cout => c(1));
    fa1 : entity work.full_adder port map (a => a(1), b => b(1), cin => c(1), s => LED(1), cout => c(2));
    fa2 : entity work.full_adder port map (a => a(2), b => b(2), cin => c(2), s => LED(2), cout => c(3));
    fa3 : entity work.full_adder port map (a => a(3), b => b(3), cin => c(3), s => LED(3), cout => c(4));
    LED(4) <= c(4);

    -- The same sum with the + operator, for comparison
    cin5 <= "0000" & SW(8);
    LED(12 downto 8) <= std_logic_vector(resize(unsigned(a), 5) + resize(unsigned(b), 5) + cin5);

    LED(7 downto 5)   <= "000";
    LED(15 downto 13) <= "000";
end rtl;
`,
    xdc: { sw: true, led: true },
    tryIt: `<p>مثلاً A = 0101 (SW0 و SW2 روشن) و B = 0011 (SW4 و SW5 روشن) بگذارید. حاصل 8 یعنی <b>01000</b> روی LD4..LD0 و همین عدد روی LD12..LD8 دیده می‌شود.</p>`,
    exercise: `<p>جمع‌کننده را به یک <b>تفریق‌کننده</b> تبدیل کنید: A − B = A + (~B) + 1. از SW8 به‌عنوان انتخاب جمع/تفریق استفاده کنید.</p>`,
  },
  {
    id: 'seg7',
    title: 'نمایشگر ۷ قسمتی',
    summary: 'دیکودر هگزادسیمال: عدد ۴ بیتی کلیدها روی یک رقم.',
    body: `
<p>هر رقم نمایشگر ۷ قسمتی از هفت پاره LED به نام‌های <b>a</b> تا <b>g</b> و یک نقطه <b>dp</b> ساخته شده است.</p>
<pre class="formula">   ─a─
  f   b
   ─g─
  e   c
   ─d─  .dp</pre>
<p>روی Nexys A7 نمایشگرها <b>آند مشترک</b> هستند و هر دو سیگنال <b>فعال با صفر (active-low)</b> هستند:</p>
<ul>
  <li><code>CA..CG</code> و <code>DP</code>: کاتد پاره‌ها؛ <b>0 یعنی روشن</b>.</li>
  <li><code>AN7..AN0</code>: انتخاب رقم؛ <b>0 یعنی آن رقم فعال است</b>.</li>
</ul>
<p>همه ۸ رقم پاره‌های مشترک دارند، پس اگر چند AN را هم‌زمان صفر کنیم همه یک عدد را نشان می‌دهند. در این درس فقط رقم سمت راست (AN0) روشن است و عدد <b>SW3..SW0</b> را به‌صورت هگز (0 تا F) نشان می‌دهد.</p>
${truth(
  ['عدد', 'gfedcba'],
  [
    ['0', '1000000'],
    ['1', '1111001'],
    ['2', '0100100'],
    ['3', '0110000'],
    ['A', '0001000'],
    ['F', '0001110'],
  ],
)}
<p>این مدار <b>ترکیبی</b> است: یک جدول جست‌وجو (ROM کوچک) که با <code>case</code> توصیف می‌شود و در LUTها پیاده می‌شود.</p>`,
    verilog: `// hex to seven-segment decoder on digit 0
module top (
    input  wire [3:0] SW,
    output wire CA, CB, CC, CD, CE, CF, CG, DP,
    output wire [7:0] AN
);
    wire [3:0] x = SW;
    reg  [6:0] seg;            // {g,f,e,d,c,b,a}, active-low

    always @(*) begin
${HEX_CASE_V}
    end

    assign {CG, CF, CE, CD, CC, CB, CA} = seg;
    assign DP = 1'b1;          // decimal point off
    assign AN = 8'b1111_1110;  // only digit 0 on
endmodule
`,
    vhdl: `${VHDL_HEADER}
-- hex to seven-segment decoder on digit 0
entity top is
    port (
        SW : in  std_logic_vector(3 downto 0);
        CA, CB, CC, CD, CE, CF, CG, DP : out std_logic;
        AN : out std_logic_vector(7 downto 0)
    );
end top;

architecture rtl of top is
    signal x   : std_logic_vector(3 downto 0);
    signal seg : std_logic_vector(6 downto 0);   -- (g,f,e,d,c,b,a), active-low
begin
    x <= SW;

    process(x)
    begin
${HEX_CASE_VHDL}
    end process;

    CA <= seg(0);  CB <= seg(1);  CC <= seg(2);  CD <= seg(3);
    CE <= seg(4);  CF <= seg(5);  CG <= seg(6);
    DP <= '1';                -- decimal point off
    AN <= "11111110";         -- only digit 0 on
end rtl;
`,
    xdc: { sw: true, seg: true },
    tryIt: `<p>با کلیدهای SW0 تا SW3 عددهای 0 تا 15 را بسازید و ببینید رقم سمت راست 0 تا F را نشان می‌دهد.</p>`,
    exercise: `<p>AN را طوری تغییر دهید که هر ۸ رقم همان عدد را نشان دهند. بعد با SW15 نقطه اعشار (DP) را روشن و خاموش کنید.</p>`,
  },
  {
    id: 'ff',
    title: 'کلاک و فلیپ‌فلاپ (مدار ترتیبی)',
    summary: 'رجیستر ۱۶ بیتی با Enable و Reset همگام.',
    body: `
<p>تا اینجا همه مدارها <b>ترکیبی</b> بودند: خروجی فقط به ورودی فعلی بستگی داشت. مدارهای <b>ترتیبی</b> حافظه دارند و با <b>لبه بالارونده کلاک</b> به‌روز می‌شوند.</p>
<h3>D Flip-Flop</h3>
<p>در هر لبه بالارونده کلاک، مقدار ورودی <code>D</code> در خروجی <code>Q</code> ذخیره می‌شود و تا لبه بعدی ثابت می‌ماند. کلاک برد <b>100MHz</b> است؛ یعنی هر ۱۰ نانوثانیه یک لبه.</p>
<ul>
  <li>Verilog: <code>always @(posedge CLK100MHZ)</code> و انتساب <b>non-blocking</b> یعنی <code>&lt;=</code></li>
  <li>VHDL: <code>process(CLK100MHZ)</code> و <code>if rising_edge(CLK100MHZ) then</code></li>
</ul>
<h3>Enable و Reset</h3>
<p>در این درس ۱۶ فلیپ‌فلاپ داریم (یک رجیستر). وقتی <b>BTNC</b> فشرده است، مقدار کلیدها ذخیره می‌شود؛ وقتی دکمه رها شود LEDها مقدار قبلی را <b>نگه می‌دارند</b> حتی اگر کلیدها را عوض کنید. دکمه قرمز <b>CPU RESET</b> (فعال با صفر) رجیستر را صفر می‌کند.</p>
<p class="note">💡 در بلوک‌های کلاک‌دار همیشه از <code>&lt;=</code> استفاده کنید تا همه فلیپ‌فلاپ‌ها هم‌زمان به‌روز شوند. گزارش سنتز باید <b>16 FF</b> نشان دهد.</p>`,
    verilog: `// a 16-bit register with clock enable and synchronous reset
module top (
    input  wire        CLK100MHZ,
    input  wire        CPU_RESETN,   // active-low reset button
    input  wire        BTNC,
    input  wire [15:0] SW,
    output reg  [15:0] LED
);
    always @(posedge CLK100MHZ) begin
        if (!CPU_RESETN)
            LED <= 16'h0000;
        else if (BTNC)
            LED <= SW;        // capture the switches while BTNC is pressed
    end
endmodule
`,
    vhdl: `${VHDL_HEADER}
-- a 16-bit register with clock enable and synchronous reset
entity top is
    port (
        CLK100MHZ  : in  std_logic;
        CPU_RESETN : in  std_logic;   -- active-low reset button
        BTNC       : in  std_logic;
        SW         : in  std_logic_vector(15 downto 0);
        LED        : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal q : std_logic_vector(15 downto 0) := (others => '0');
begin
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if CPU_RESETN = '0' then
                q <= (others => '0');
            elsif BTNC = '1' then
                q <= SW;      -- capture the switches while BTNC is pressed
            end if;
        end if;
    end process;

    LED <= q;
end rtl;
`,
    xdc: { clk: true, sw: true, led: true, btn: true, reset: true },
    tryIt: `<p>چند کلید را روشن کنید؛ LEDها تغییری نمی‌کنند. حالا دکمه وسط (BTNC) را فشار دهید: الگو ذخیره می‌شود. کلیدها را عوض کنید و ببینید LEDها مقدار قبلی را نگه می‌دارند. دکمه قرمز همه را صفر می‌کند.</p>`,
    exercise: `<p>با BTNU مقدار رجیستر را یک بیت به چپ و با BTND یک بیت به راست شیفت دهید (راهنمایی: <code>{LED[14:0], 1'b0}</code>). چرا با یک بار فشار دادن، رجیستر خیلی سریع خالی می‌شود؟ (جواب در درس بعد!)</p>`,
  },
  {
    id: 'counter',
    title: 'شمارنده و تقسیم فرکانس',
    summary: 'چشمک‌زن ۱ هرتز و شمارنده ۸ بیتی روی LEDها.',
    body: `
<p>کلاک 100MHz برای چشم ما خیلی سریع است. برای ساختن رویدادهای کند، یک <b>شمارنده</b> می‌سازیم که کلاک‌ها را بشمارد و هر وقت به عدد مشخصی رسید یک کار انجام دهد. به این کار <b>تقسیم فرکانس</b> می‌گویند.</p>
<pre class="formula">نیم ثانیه = 0.5 s × 100,000,000 Hz = 50,000,000 کلاک</pre>
<p>برای شمردن تا ۵۰ میلیون به <b>26 بیت</b> نیاز داریم (2<sup>26</sup> ≈ 67 میلیون).</p>
<ul>
  <li><code>div</code>: شمارنده تقسیم فرکانس؛ هر نیم ثانیه صفر می‌شود.</li>
  <li><code>blink</code>: هر نیم ثانیه برعکس می‌شود ← LD0 با فرکانس ۱ هرتز چشمک می‌زند.</li>
  <li><code>count</code>: شمارنده ۸ بیتی که هر نیم ثانیه یکی زیاد می‌شود ← LD15..LD8 به‌صورت باینری.</li>
</ul>
<p class="note">⏱️ شبیه‌ساز تلاش می‌کند کلاک را با سرعت واقعی 100MHz اجرا کند. سرعت واقعی شبیه‌سازی در نوار پایین نمایش داده می‌شود. اگر کامپیوترتان کندتر باشد، چشمک‌زدن هم کندتر دیده می‌شود. برای دیدن جزئیات می‌توانید از منوی <b>Clock</b> سرعت را کم کنید.</p>
<p>در شبیه‌سازی‌های Vivado هم معمولاً برای تست سریع، مقدار <code>HALF_SECOND</code> را کوچک می‌کنند. این کار را امتحان کنید!</p>`,
    verilog: `// clock divider, 1 Hz blinker and an 8-bit counter
module top (
    input  wire        CLK100MHZ,
    input  wire        CPU_RESETN,
    output wire [15:0] LED
);
    localparam integer HALF_SECOND = 50_000_000;   // 100 MHz * 0.5 s

    reg [25:0] div   = 0;
    reg        blink = 0;
    reg [7:0]  count = 0;

    always @(posedge CLK100MHZ) begin
        if (!CPU_RESETN) begin
            div   <= 0;
            blink <= 0;
            count <= 0;
        end else if (div == HALF_SECOND - 1) begin
            div   <= 0;
            blink <= ~blink;         // toggles every 0.5 s -> 1 Hz
            count <= count + 1;
        end else begin
            div <= div + 1;
        end
    end

    assign LED[0]    = blink;
    assign LED[7:1]  = 7'b0;
    assign LED[15:8] = count;
endmodule
`,
    vhdl: `${VHDL_NUMERIC}
-- clock divider, 1 Hz blinker and an 8-bit counter
entity top is
    port (
        CLK100MHZ  : in  std_logic;
        CPU_RESETN : in  std_logic;
        LED        : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    constant HALF_SECOND : integer := 50_000_000;   -- 100 MHz * 0.5 s

    signal div   : integer range 0 to HALF_SECOND - 1 := 0;
    signal blink : std_logic := '0';
    signal count : unsigned(7 downto 0) := (others => '0');
begin
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if CPU_RESETN = '0' then
                div   <= 0;
                blink <= '0';
                count <= (others => '0');
            elsif div = HALF_SECOND - 1 then
                div   <= 0;
                blink <= not blink;    -- toggles every 0.5 s -> 1 Hz
                count <= count + 1;
            else
                div <= div + 1;
            end if;
        end if;
    end process;

    LED(0)           <= blink;
    LED(7 downto 1)  <= (others => '0');
    LED(15 downto 8) <= std_logic_vector(count);
end rtl;
`,
    xdc: { clk: true, led: true, reset: true },
    tryIt: `<p>Run را بزنید. LD0 باید هر ثانیه یک بار چشمک بزند و LD15..LD8 شمردن باینری را نشان دهند. دکمه قرمز شمارنده را صفر می‌کند.</p>`,
    exercise: `<p>یک «چراغ رونده» (Knight Rider) بسازید: یک LED روشن که هر ۱۰۰ میلی‌ثانیه یک خانه جابه‌جا می‌شود و در دو سر برمی‌گردد.</p>`,
  },
  {
    id: 'multiplex',
    title: 'نمایش چند رقمی (Multiplexing)',
    summary: 'نمایش عدد ۱۶ بیتی کلیدها روی ۴ رقم با روشن کردن نوبتی ارقام.',
    body: `
<p>چون پاره‌های همه رقم‌ها مشترک هستند، نمی‌توانیم هم‌زمان چهار عدد متفاوت نشان دهیم. راه‌حل: <b>روشن کردن نوبتی</b>. هر لحظه فقط یک رقم را فعال می‌کنیم و عدد مخصوص آن را روی پاره‌ها می‌گذاریم. اگر این کار سریع‌تر از حدود ۶۰ بار در ثانیه انجام شود، چشم همه رقم‌ها را روشن و ثابت می‌بیند (<b>پایداری تصویر</b>).</p>
<ul>
  <li>شمارنده ۱۸ بیتی <code>refresh</code> با کلاک 100MHz می‌شمارد.</li>
  <li>دو بیت بالای آن (<code>refresh[17:16]</code>) رقم فعال را انتخاب می‌کند؛ هر رقم حدود ۰٫۶۵ میلی‌ثانیه روشن است ← کل نمایشگر حدود ۳۸۰ بار در ثانیه تازه می‌شود.</li>
  <li>یک MUX، نیبل (۴ بیت) مربوط به رقم فعال را انتخاب می‌کند و دیکودر درس ۵ آن را به پاره‌ها تبدیل می‌کند.</li>
</ul>
<p>این درس ترکیب همه چیزهایی است که تا اینجا یاد گرفتیم: <b>شمارنده</b> + <b>MUX</b> + <b>دیکودر</b> + <b>سلسله‌مراتب</b>.</p>`,
    verilog: `// show SW[15:0] as four hex digits using time multiplexing
module hex7seg (
    input  wire [3:0] x,
    output reg  [6:0] seg    // {g,f,e,d,c,b,a}, active-low
);
    always @(*) begin
${HEX_CASE_V}
    end
endmodule

module top (
    input  wire        CLK100MHZ,
    input  wire [15:0] SW,
    output wire CA, CB, CC, CD, CE, CF, CG, DP,
    output reg  [7:0]  AN
);
    reg  [17:0] refresh = 0;
    wire [1:0]  digit = refresh[17:16];
    reg  [3:0]  nibble;
    wire [6:0]  seg;

    always @(posedge CLK100MHZ)
        refresh <= refresh + 1;

    always @(*) begin
        AN = 8'b1111_1111;
        AN[digit] = 1'b0;          // enable one digit at a time
        case (digit)
            2'd0:    nibble = SW[3:0];
            2'd1:    nibble = SW[7:4];
            2'd2:    nibble = SW[11:8];
            default: nibble = SW[15:12];
        endcase
    end

    hex7seg decoder (.x(nibble), .seg(seg));

    assign {CG, CF, CE, CD, CC, CB, CA} = seg;
    assign DP = 1'b1;
endmodule
`,
    vhdl: `${VHDL_NUMERIC}
-- show SW(15 downto 0) as four hex digits using time multiplexing
entity hex7seg is
    port (
        x   : in  std_logic_vector(3 downto 0);
        seg : out std_logic_vector(6 downto 0)   -- (g,f,e,d,c,b,a), active-low
    );
end hex7seg;

architecture rtl of hex7seg is
begin
    process(x)
    begin
${HEX_CASE_VHDL}
    end process;
end rtl;

${VHDL_NUMERIC}
entity top is
    port (
        CLK100MHZ : in  std_logic;
        SW        : in  std_logic_vector(15 downto 0);
        CA, CB, CC, CD, CE, CF, CG, DP : out std_logic;
        AN        : out std_logic_vector(7 downto 0)
    );
end top;

architecture rtl of top is
    signal refresh : unsigned(17 downto 0) := (others => '0');
    signal digit   : std_logic_vector(1 downto 0);
    signal nibble  : std_logic_vector(3 downto 0);
    signal seg     : std_logic_vector(6 downto 0);
begin
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            refresh <= refresh + 1;
        end if;
    end process;

    digit <= std_logic_vector(refresh(17 downto 16));

    with digit select
        AN <= "11111110" when "00",
              "11111101" when "01",
              "11111011" when "10",
              "11110111" when others;

    with digit select
        nibble <= SW(3 downto 0)   when "00",
                  SW(7 downto 4)   when "01",
                  SW(11 downto 8)  when "10",
                  SW(15 downto 12) when others;

    decoder : entity work.hex7seg port map (x => nibble, seg => seg);

    CA <= seg(0);  CB <= seg(1);  CC <= seg(2);  CD <= seg(3);
    CE <= seg(4);  CF <= seg(5);  CG <= seg(6);
    DP <= '1';
end rtl;
`,
    xdc: { clk: true, sw: true, seg: true },
    tryIt: `<p>کلیدها را تغییر دهید؛ چهار رقم سمت راست مقدار هگز SW15..SW0 را نشان می‌دهند. از منوی <b>Clock</b> سرعت را روی <b>10 Hz</b> بگذارید تا روشن شدن نوبتی رقم‌ها را با چشم ببینید!</p>`,
    exercise: `<p>نمایش را به ۸ رقم گسترش دهید: چهار رقم سمت چپ مقدار یک شمارنده را نشان دهند که هر ثانیه یکی زیاد می‌شود.</p>`,
  },
  {
    id: 'fsm',
    title: 'ماشین حالت (FSM): چراغ راهنمایی',
    summary: 'ماشین حالت Moore با تایمر و LED سه‌رنگ.',
    body: `
<p><b>ماشین حالت متناهی (FSM)</b> مداری است که در هر لحظه در یکی از چند <b>حالت</b> مشخص قرار دارد و بر اساس ورودی‌ها و زمان به حالت بعدی می‌رود. تقریباً همه کنترلرها (پروتکل‌ها، منوها، بازی‌ها) با FSM ساخته می‌شوند.</p>
<h3>چراغ راهنمایی</h3>
<pre class="formula">RED (2s) ──► GREEN (2s) ──► YELLOW (1s) ──► RED ...
                  │
       BTNC (عابر پیاده) ──► YELLOW زودتر</pre>
<ul>
  <li>حالت‌ها با یک نوع شمارشی تعریف می‌شوند: Verilog با <code>localparam</code> و VHDL با <code>type state_t is (...)</code>.</li>
  <li>یک <b>تایمر</b> زمان ماندن در هر حالت را می‌شمارد.</li>
  <li>خروجی فقط به حالت بستگی دارد (<b>Moore</b>): رنگ LED سه‌رنگ <b>LD16</b>.</li>
  <li>اگر در حالت GREEN دکمه <b>BTNC</b> زده شود، زودتر به YELLOW می‌رویم.</li>
</ul>
<p>ساختار استاندارد FSM: یک بلوک ترتیبی برای <b>ثبت حالت</b> و یک بلوک ترکیبی برای <b>خروجی‌ها</b>.</p>
<p class="note">💡 LED سه‌رنگ واقعی خیلی پرنور است؛ در طرح‌های واقعی آن را با PWM کم‌نور می‌کنند.</p>`,
    verilog: `// traffic light FSM on the RGB LED LD16
module top (
    input  wire CLK100MHZ,
    input  wire CPU_RESETN,
    input  wire BTNC,          // pedestrian request
    output reg  LED16_R, LED16_G, LED16_B,
    output wire [2:0] LED      // state shown in binary
);
    localparam integer ONE_SECOND = 100_000_000;

    localparam [1:0] RED = 2'd0, GREEN = 2'd1, YELLOW = 2'd2;

    reg [1:0]  state = RED;
    reg [27:0] timer = 0;

    always @(posedge CLK100MHZ) begin
        if (!CPU_RESETN) begin
            state <= RED;
            timer <= 0;
        end else begin
            timer <= timer + 1;
            case (state)
                RED:
                    if (timer == 2 * ONE_SECOND - 1) begin
                        state <= GREEN;
                        timer <= 0;
                    end
                GREEN:
                    if (timer == 2 * ONE_SECOND - 1 || BTNC) begin
                        state <= YELLOW;
                        timer <= 0;
                    end
                default: // YELLOW
                    if (timer == ONE_SECOND - 1) begin
                        state <= RED;
                        timer <= 0;
                    end
            endcase
        end
    end

    // Moore outputs: depend only on the current state
    always @(*) begin
        LED16_R = (state == RED) || (state == YELLOW);
        LED16_G = (state == GREEN) || (state == YELLOW);
        LED16_B = 1'b0;
    end

    assign LED = (state == RED) ? 3'b001 : (state == GREEN) ? 3'b010 : 3'b100;
endmodule
`,
    vhdl: `${VHDL_NUMERIC}
-- traffic light FSM on the RGB LED LD16
entity top is
    port (
        CLK100MHZ  : in  std_logic;
        CPU_RESETN : in  std_logic;
        BTNC       : in  std_logic;   -- pedestrian request
        LED16_R, LED16_G, LED16_B : out std_logic;
        LED        : out std_logic_vector(2 downto 0)
    );
end top;

architecture rtl of top is
    constant ONE_SECOND : integer := 100_000_000;

    type state_t is (RED, GREEN, YELLOW);
    signal state : state_t := RED;
    signal timer : integer range 0 to 2 * ONE_SECOND := 0;
begin
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if CPU_RESETN = '0' then
                state <= RED;
                timer <= 0;
            else
                timer <= timer + 1;
                case state is
                    when RED =>
                        if timer = 2 * ONE_SECOND - 1 then
                            state <= GREEN;
                            timer <= 0;
                        end if;
                    when GREEN =>
                        if timer = 2 * ONE_SECOND - 1 or BTNC = '1' then
                            state <= YELLOW;
                            timer <= 0;
                        end if;
                    when YELLOW =>
                        if timer = ONE_SECOND - 1 then
                            state <= RED;
                            timer <= 0;
                        end if;
                end case;
            end if;
        end if;
    end process;

    -- Moore outputs: depend only on the current state
    LED16_R <= '1' when state = RED or state = YELLOW else '0';
    LED16_G <= '1' when state = GREEN or state = YELLOW else '0';
    LED16_B <= '0';

    LED <= "001" when state = RED else
           "010" when state = GREEN else
           "100";
end rtl;
`,
    xdc: { clk: true, led: true, rgb: true, btn: true, reset: true },
    tryIt: `<p>LED سه‌رنگ LD16 (کنار نمایشگرها) به ترتیب قرمز، سبز و زرد می‌شود و LD2..LD0 حالت فعلی را نشان می‌دهند. وقتی سبز است BTNC را بزنید.</p>`,
    exercise: `<p>یک حالت «چشمک‌زن زرد» اضافه کنید که با روشن بودن SW0 فعال شود (مثل چراغ راهنمایی در نیمه‌شب).</p>`,
  },
];

export const PLAYGROUND: Lesson = {
  id: 'playground',
  title: 'زمین بازی (Playground)',
  summary: 'هر طرحی که دوست دارید بنویسید و روی برد اجرا کنید.',
  body: `
<p>اینجا آزاد هستید! هر کد Verilog یا VHDL سنتزپذیری بنویسید، فایل XDC را تنظیم کنید و روی برد اجرا کنید.</p>
<h3>نام پورت‌های آماده</h3>
<table class="truth"><thead><tr><th>پورت</th><th>جهت</th><th>توضیح</th></tr></thead><tbody>
<tr><td><code>CLK100MHZ</code></td><td>in</td><td>کلاک 100MHz</td></tr>
<tr><td><code>SW[15:0]</code></td><td>in</td><td>کلیدهای کشویی</td></tr>
<tr><td><code>BTNC BTNU BTNL BTNR BTND</code></td><td>in</td><td>دکمه‌ها (فشرده = 1)</td></tr>
<tr><td><code>CPU_RESETN</code></td><td>in</td><td>دکمه قرمز (فشرده = 0)</td></tr>
<tr><td><code>LED[15:0]</code></td><td>out</td><td>LEDهای سبز</td></tr>
<tr><td><code>LED16_R/G/B, LED17_R/G/B</code></td><td>out</td><td>LEDهای سه‌رنگ</td></tr>
<tr><td><code>CA..CG, DP</code></td><td>out</td><td>پاره‌های ۷ قسمتی (0 = روشن)</td></tr>
<tr><td><code>AN[7:0]</code></td><td>out</td><td>انتخاب رقم (0 = فعال)</td></tr>
</tbody></table>
<p>اگر پورتی را در XDC تعریف نکنید ولی نامش با جدول بالا یکی باشد، شبیه‌ساز آن را خودکار وصل می‌کند و یک هشدار می‌دهد.</p>
<h3>امکانات پشتیبانی‌شده</h3>
<ul>
<li>Verilog-2001: <code>module</code>، <code>assign</code>، <code>always</code>، <code>case/casez</code>، <code>for</code>، <code>parameter</code>، نمونه‌سازی ماژول، حافظه <code>reg [7:0] mem [0:15]</code></li>
<li>VHDL: <code>entity/architecture</code>، <code>process</code>، <code>when/else</code>، <code>with/select</code>، <code>numeric_std</code>، نوع شمارشی، <code>entity work.x</code></li>
<li>محدودیت: حداکثر عرض بردار ۳۲ بیت؛ شبیه‌سازی دو-حالته (0/1، بدون X و Z).</li>
</ul>`,
  verilog: `// Playground: write any design for the Nexys A7
module top (
    input  wire        CLK100MHZ,
    input  wire [15:0] SW,
    input  wire        BTNC, BTNU, BTNL, BTNR, BTND,
    output wire [15:0] LED
);
    reg [23:0] cnt = 0;
    always @(posedge CLK100MHZ)
        cnt <= cnt + 1;

    assign LED = BTNC ? {16{cnt[23]}} : SW;
endmodule
`,
  vhdl: `${VHDL_NUMERIC}
-- Playground: write any design for the Nexys A7
entity top is
    port (
        CLK100MHZ : in  std_logic;
        SW        : in  std_logic_vector(15 downto 0);
        BTNC, BTNU, BTNL, BTNR, BTND : in std_logic;
        LED       : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal cnt : unsigned(23 downto 0) := (others => '0');
begin
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            cnt <= cnt + 1;
        end if;
    end process;

    LED <= (others => cnt(23)) when BTNC = '1' else SW;
end rtl;
`,
  xdc: { clk: true, sw: true, led: true, btn: true },
  tryIt: `<p>کد خود را بنویسید و <span class="kbd">▶ Run</span> را بزنید. خطاها در پنجره Messages پایین صفحه نمایش داده می‌شوند.</p>`,
};


