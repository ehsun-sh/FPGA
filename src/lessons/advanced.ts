// Lessons for chapters 2-7. Persian text lives here next to the code; English text is in en.ts.
import { HEX_CASE_V, HEX_CASE_VHDL, VHDL_NUMERIC, type Lesson } from './lessons';
import { truth } from './helpers';

export const HEX7SEG_V = `module hex7seg (
    input  wire [3:0] x,
    output reg  [6:0] seg    // {g,f,e,d,c,b,a}, active-low
);
    always @(*) begin
${HEX_CASE_V}
    end
endmodule
`;

export const HEX7SEG_VHDL = `${VHDL_NUMERIC}
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
`;

const UART_TX_V = `module uart_tx #(parameter CLKS_PER_BIT = 868) (   // 100 MHz / 115200
    input  wire       clk,
    input  wire       start,       // one-clock pulse: send \`data\`
    input  wire [7:0] data,
    output reg        tx = 1'b1,   // idle high
    output wire       busy
);
    localparam [1:0] IDLE = 2'd0, START = 2'd1, DATA = 2'd2, STOP = 2'd3;
    reg  [1:0]  state = IDLE;
    reg  [15:0] cnt   = 0;         // clocks within the current bit
    reg  [2:0]  n     = 0;         // data bit number
    reg  [7:0]  sh    = 0;         // shift register, LSB goes out first
    wire        bit_done = (cnt == CLKS_PER_BIT - 1);

    always @(posedge clk) begin
        cnt <= (state == IDLE || bit_done) ? 16'd0 : cnt + 1;
        case (state)
            IDLE: begin
                tx <= 1'b1;
                if (start) begin sh <= data; state <= START; end
            end
            START: begin
                tx <= 1'b0;
                if (bit_done) begin n <= 0; state <= DATA; end
            end
            DATA: begin
                tx <= sh[0];
                if (bit_done) begin
                    sh <= sh >> 1;
                    if (n == 3'd7) state <= STOP;
                    else           n <= n + 1;
                end
            end
            default: begin             // STOP
                tx <= 1'b1;
                if (bit_done) state <= IDLE;
            end
        endcase
    end

    assign busy = (state != IDLE);
endmodule
`;

const UART_TX_VHDL = `-- UART transmitter (115200 baud, 8N1)
entity uart_tx is
    generic (CLKS_PER_BIT : integer := 868);   -- 100 MHz / 115200
    port (
        clk   : in  std_logic;
        start : in  std_logic;                     -- one-clock pulse: send data
        data  : in  std_logic_vector(7 downto 0);
        tx    : out std_logic;                     -- idle high
        busy  : out std_logic
    );
end uart_tx;

architecture rtl of uart_tx is
    type state_t is (IDLE, START_BIT, DATA_BITS, STOP_BIT);
    signal state    : state_t := IDLE;
    signal cnt      : unsigned(15 downto 0) := (others => '0');   -- clocks within the current bit
    signal n        : unsigned(2 downto 0) := (others => '0');    -- data bit number
    signal sh       : std_logic_vector(7 downto 0) := (others => '0');
    signal txr      : std_logic := '1';
    signal bit_done : std_logic;
begin
    bit_done <= '1' when cnt = CLKS_PER_BIT - 1 else '0';

    process(clk)
    begin
        if rising_edge(clk) then
            if state = IDLE or bit_done = '1' then
                cnt <= (others => '0');
            else
                cnt <= cnt + 1;
            end if;
            case state is
                when IDLE =>
                    txr <= '1';
                    if start = '1' then
                        sh    <= data;
                        state <= START_BIT;
                    end if;
                when START_BIT =>
                    txr <= '0';
                    if bit_done = '1' then
                        n     <= (others => '0');
                        state <= DATA_BITS;
                    end if;
                when DATA_BITS =>
                    txr <= sh(0);                           -- LSB first
                    if bit_done = '1' then
                        sh <= '0' & sh(7 downto 1);
                        if n = 7 then
                            state <= STOP_BIT;
                        else
                            n <= n + 1;
                        end if;
                    end if;
                when STOP_BIT =>
                    txr <= '1';
                    if bit_done = '1' then
                        state <= IDLE;
                    end if;
            end case;
        end if;
    end process;

    tx   <= txr;
    busy <= '0' when state = IDLE else '1';
end rtl;
`;

export const ADVANCED: Lesson[] = [
  // ------------------------------------------------------------ chapter 2: RT-level combinational
  {
    id: 'decoder',
    title: 'دیکودر و انکودر اولویت‌دار',
    summary: 'دیکودر ۳ به ۸ با Enable و انکودر اولویت‌دار ۸ به ۳.',
    body: `
<p>در فصل قبل با گیت‌ها کار کردیم. از این فصل به <b>سطح RT</b> (Register Transfer) می‌رویم: به‌جای گیت‌های تکی، با بلوک‌های بزرگ‌تر مثل دیکودر، مقایسه‌گر، شیفت‌دهنده و ALU فکر می‌کنیم و ابزار سنتز آن‌ها را به LUT تبدیل می‌کند.</p>
<h3>دیکودر (Decoder)</h3>
<p>دیکودر n به 2<sup>n</sup> یک عدد باینری می‌گیرد و <b>دقیقاً یکی</b> از خروجی‌ها را فعال می‌کند. کاربرد اصلی: انتخاب یکی از چند دستگاه، مثلاً یکی از ارقام نمایشگر یا یکی از خانه‌های حافظه. ورودی <b>Enable</b> وقتی صفر باشد همه خروجی‌ها را خاموش می‌کند.</p>
<ul>
  <li>ورودی: <code>SW[2:0]</code>، Enable: <code>SW[3]</code>، خروجی: <code>LED[7:0]</code></li>
  <li>در Verilog با یک شیفت ساده: <code>8'b1 &lt;&lt; SW[2:0]</code></li>
</ul>
<h3>انکودر اولویت‌دار (Priority Encoder)</h3>
<p>عکس دیکودر: چند درخواست ورودی دارد و <b>شماره مهم‌ترین</b> درخواست فعال را برمی‌گرداند. اینجا <code>SW15</code> بالاترین اولویت را دارد.</p>
${truth(
  ['SW[15:8]', 'LED[14:12]', 'LED15 (valid)'],
  [
    ['1xxxxxxx', '111', 1],
    ['01xxxxxx', '110', 1],
    ['001xxxxx', '101', 1],
    ['...', '...', 1],
    ['00000001', '000', 1],
    ['00000000', '000', 0],
  ],
)}
<ul>
  <li>Verilog: <code>casez</code> که در آن <code>?</code> یعنی «مهم نیست».</li>
  <li>VHDL: انتساب شرطی <code>when ... else</code>. شرط‌ها به ترتیب بررسی می‌شوند، پس اولین شرط درست برنده است و این دقیقاً همان اولویت است.</li>
</ul>
<p class="note">💡 خروجی <b>valid</b> لازم است، چون در حالت «هیچ درخواستی» کد 000 با حالت «فقط SW8» یکی است.</p>`,
    verilog: `// 3-to-8 decoder with enable, and an 8-to-3 priority encoder
module top (
    input  wire [15:0] SW,
    output wire [15:0] LED
);
    // decoder: SW[3] = enable, SW[2:0] = which output
    wire [7:0] dec;
    assign dec = SW[3] ? (8'b0000_0001 << SW[2:0]) : 8'b0000_0000;

    // priority encoder: index of the highest '1' in SW[15:8]
    reg [2:0] code;
    always @(*) begin
        casez (SW[15:8])
            8'b1???????: code = 3'd7;
            8'b01??????: code = 3'd6;
            8'b001?????: code = 3'd5;
            8'b0001????: code = 3'd4;
            8'b00001???: code = 3'd3;
            8'b000001??: code = 3'd2;
            8'b0000001?: code = 3'd1;
            default:     code = 3'd0;
        endcase
    end
    wire valid = |SW[15:8];      // at least one request

    assign LED = {valid, code, 4'b0000, dec};
endmodule
`,
    vhdl: `${VHDL_NUMERIC}
-- 3-to-8 decoder with enable, and an 8-to-3 priority encoder
entity top is
    port (
        SW  : in  std_logic_vector(15 downto 0);
        LED : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal dec   : std_logic_vector(7 downto 0);
    signal code  : std_logic_vector(2 downto 0);
    signal valid : std_logic;
begin
    -- decoder: SW(3) = enable, SW(2 downto 0) = which output
    process(SW)
    begin
        dec <= (others => '0');
        if SW(3) = '1' then
            dec(to_integer(unsigned(SW(2 downto 0)))) <= '1';
        end if;
    end process;

    -- priority encoder: the first true condition wins
    code <= "111" when SW(15) = '1' else
            "110" when SW(14) = '1' else
            "101" when SW(13) = '1' else
            "100" when SW(12) = '1' else
            "011" when SW(11) = '1' else
            "010" when SW(10) = '1' else
            "001" when SW(9)  = '1' else
            "000";

    valid <= '0' when SW(15 downto 8) = "00000000" else '1';

    LED <= valid & code & "0000" & dec;
end rtl;
`,
    xdc: { sw: true, led: true },
    tryIt: `<p>SW3 را روشن کنید و با SW2..SW0 یک عدد بسازید؛ فقط یکی از LD7..LD0 روشن می‌شود. حالا چند کلید از SW15..SW8 را روشن کنید: LD14..LD12 شماره بالاترین کلید روشن را نشان می‌دهد و LD15 می‌گوید درخواستی هست.</p>`,
    exercise: `<p>یک دیکودر ۲ به ۴ بسازید که ارقام نمایشگر (AN3..AN0) را انتخاب کند. یادتان باشد AN فعال با صفر است.</p>`,
  },
  {
    id: 'shifter',
    title: 'شیفت‌دهنده بشکه‌ای (Barrel Shifter)',
    summary: 'چرخش ۸ بیتی به چپ یا راست به اندازه ۰ تا ۷ بیت در یک کلاک.',
    body: `
<p>شیفت‌دهنده بشکه‌ای یک عدد را در <b>یک مرحله ترکیبی</b> به اندازه دلخواه می‌چرخاند (rotate): بیت‌هایی که از یک طرف بیرون می‌روند از طرف دیگر برمی‌گردند.</p>
<h3>ساختار چندمرحله‌ای</h3>
<p>به‌جای یک MUX بزرگ ۸ ورودی برای هر بیت، مقدار چرخش را بیت‌به‌بیت اعمال می‌کنیم:</p>
<ol>
  <li>اگر <code>amt[0]=1</code>: یک بیت بچرخان</li>
  <li>اگر <code>amt[1]=1</code>: دو بیت بچرخان</li>
  <li>اگر <code>amt[2]=1</code>: چهار بیت بچرخان</li>
</ol>
<p>هر مرحله فقط یک MUX دو به یک برای هر بیت است؛ پس برای n بیت، log<sub>2</sub>(n) مرحله کافی است. این یکی از نمونه‌های مهم <b>طراحی بر اساس ساختار</b> در سطح RT است.</p>
<h3>چرخش به چپ</h3>
<p>چرخش به چپ به اندازه k، همان چرخش به راست به اندازه <code>8 − k</code> است. پس فقط مقدار چرخش را منفی می‌کنیم (<code>0 − amt</code> در ۳ بیت) و از همان مدار استفاده می‌کنیم.</p>
<ul>
  <li>داده: <code>SW[7:0]</code> (روی LD15..LD8 هم نمایش داده می‌شود)</li>
  <li>مقدار چرخش: <code>SW[10:8]</code>، جهت: <code>SW15</code> (1 = چپ)</li>
  <li>نتیجه: <code>LED[7:0]</code></li>
</ul>`,
    verilog: `// 8-bit barrel shifter (rotate) built from three 2-to-1 mux stages
module top (
    input  wire [15:0] SW,
    output wire [15:0] LED
);
    wire [7:0] a    = SW[7:0];
    wire       left = SW[15];
    // rotating left by k = rotating right by (8 - k)
    wire [2:0] amt  = left ? (3'd0 - SW[10:8]) : SW[10:8];

    wire [7:0] s0 = amt[0] ? {a[0],     a[7:1]}  : a;    // by 1
    wire [7:0] s1 = amt[1] ? {s0[1:0], s0[7:2]}  : s0;   // by 2
    wire [7:0] s2 = amt[2] ? {s1[3:0], s1[7:4]}  : s1;   // by 4

    assign LED = {a, s2};
endmodule
`,
    vhdl: `${VHDL_NUMERIC}
-- 8-bit barrel shifter (rotate) built from three 2-to-1 mux stages
entity top is
    port (
        SW  : in  std_logic_vector(15 downto 0);
        LED : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal a, s0, s1, s2 : std_logic_vector(7 downto 0);
    signal amt : unsigned(2 downto 0);
begin
    a <= SW(7 downto 0);
    -- rotating left by k = rotating right by (8 - k)
    amt <= unsigned(SW(10 downto 8)) when SW(15) = '0' else 0 - unsigned(SW(10 downto 8));

    s0 <= a(0) & a(7 downto 1)            when amt(0) = '1' else a;    -- by 1
    s1 <= s0(1 downto 0) & s0(7 downto 2) when amt(1) = '1' else s0;   -- by 2
    s2 <= s1(3 downto 0) & s1(7 downto 4) when amt(2) = '1' else s1;   -- by 4

    LED <= a & s2;
end rtl;
`,
    xdc: { sw: true, led: true },
    tryIt: `<p>فقط SW0 را روشن کنید و SW10..SW8 را عوض کنید: LED روشن به راست می‌چرخد و از آن طرف برمی‌گردد. SW15 را روشن کنید تا جهت عوض شود.</p>`,
    exercise: `<p>یک ورودی سوم اضافه کنید (مثلاً SW14) که بین «چرخش» و «شیفت منطقی» (پر شدن با صفر) انتخاب کند.</p>`,
  },
  {
    id: 'alu',
    title: 'ALU ساده ۴ بیتی',
    summary: 'واحد محاسبه و منطق با ۸ عمل و پرچم صفر.',
    body: `
<p><b>ALU</b> (Arithmetic Logic Unit) قلب هر پردازنده است: دو عملوند و یک کد عمل (opcode) می‌گیرد و نتیجه را برمی‌گرداند. در عمل، همه عمل‌ها موازی ساخته می‌شوند و یک MUX بزرگ یکی را انتخاب می‌کند.</p>
${truth(
  ['op = SW[15:13]', 'عمل', 'نتیجه'],
  [
    ['000', 'ADD', 'A + B (بیت ۴ = Carry)'],
    ['001', 'SUB', 'A − B (بیت ۴ = Borrow)'],
    ['010', 'AND', 'A &amp; B'],
    ['011', 'OR', 'A | B'],
    ['100', 'XOR', 'A ^ B'],
    ['101', 'NOT', '~A'],
    ['110', 'SLT', 'اگر A &lt; B آنگاه 1'],
    ['111', 'SHL', 'A &lt;&lt; 1'],
  ],
)}
<ul>
  <li><code>A = SW[3:0]</code> و <code>B = SW[7:4]</code></li>
  <li>نتیجه ۵ بیتی روی <code>LED[4:0]</code>؛ بیت پنجم Carry یا Borrow است.</li>
  <li><b>پرچم صفر</b> (Zero flag) روی <code>LD15</code>: وقتی چهار بیت پایین نتیجه صفر باشد روشن می‌شود. پردازنده‌ها با همین پرچم پرش شرطی انجام می‌دهند.</li>
</ul>
<p class="note">💡 در Verilog عرض عبارت از سمت چپ انتساب گرفته می‌شود: چون <code>r</code> پنج بیت است، <code>a + b</code> هم در پنج بیت حساب می‌شود و Carry از دست نمی‌رود. در VHDL خودمان با <code>resize</code> عملوندها را پنج بیتی می‌کنیم.</p>`,
    verilog: `// 4-bit ALU with eight operations and a zero flag
module top (
    input  wire [15:0] SW,
    output wire [15:0] LED
);
    wire [3:0] a  = SW[3:0];
    wire [3:0] b  = SW[7:4];
    wire [2:0] op = SW[15:13];
    reg  [4:0] r;             // r[4] = carry / borrow

    always @(*) begin
        case (op)
            3'd0:    r = a + b;
            3'd1:    r = a - b;
            3'd2:    r = {1'b0, a & b};
            3'd3:    r = {1'b0, a | b};
            3'd4:    r = {1'b0, a ^ b};
            3'd5:    r = {1'b0, ~a};
            3'd6:    r = (a < b) ? 5'd1 : 5'd0;
            default: r = {a, 1'b0};
        endcase
    end

    wire zero = (r[3:0] == 4'd0);
    assign LED = {zero, 10'b0, r};
endmodule
`,
    vhdl: `${VHDL_NUMERIC}
-- 4-bit ALU with eight operations and a zero flag
entity top is
    port (
        SW  : in  std_logic_vector(15 downto 0);
        LED : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal a, b, r : unsigned(4 downto 0);   -- r(4) = carry / borrow
    signal op      : std_logic_vector(2 downto 0);
    signal zero    : std_logic;
begin
    a  <= resize(unsigned(SW(3 downto 0)), 5);
    b  <= resize(unsigned(SW(7 downto 4)), 5);
    op <= SW(15 downto 13);

    process(a, b, op)
    begin
        case op is
            when "000" => r <= a + b;
            when "001" => r <= a - b;
            when "010" => r <= a and b;
            when "011" => r <= a or b;
            when "100" => r <= a xor b;
            when "101" => r <= '0' & (not a(3 downto 0));
            when "110" =>
                if a < b then
                    r <= to_unsigned(1, 5);
                else
                    r <= (others => '0');
                end if;
            when others => r <= a(3 downto 0) & '0';
        end case;
    end process;

    zero <= '1' when r(3 downto 0) = "0000" else '0';
    LED  <= zero & "0000000000" & std_logic_vector(r);
end rtl;
`,
    xdc: { sw: true, led: true },
    tryIt: `<p>A را با SW3..SW0 و B را با SW7..SW4 بسازید. با SW15..SW13 عمل را عوض کنید. مثلاً A=B و عمل SUB را انتخاب کنید: نتیجه صفر است و LD15 روشن می‌شود.</p>`,
    exercise: `<p>نتیجه را به‌جای LEDها روی نمایشگر ۷ قسمتی نشان دهید (از دیکودر درس ۵ استفاده کنید).</p>`,
  },

  // ------------------------------------------------------------ chapter 3: regular sequential
  {
    id: 'shiftreg',
    title: 'شیفت رجیستر و LFSR',
    summary: 'شیفت رجیستر سریال به موازی و تولید اعداد شبه‌تصادفی.',
    body: `
<p><b>مدار ترتیبی منظم</b> (regular sequential) مداری است که حالت بعدی‌اش الگوی ساده و تکراری دارد: رجیستر، شمارنده و <b>شیفت رجیستر</b>.</p>
<h3>شیفت رجیستر</h3>
<p>در هر تیک، همه بیت‌ها یک خانه جابه‌جا می‌شوند و یک بیت تازه از ورودی سریال وارد می‌شود: <code>sr &lt;= {sr[6:0], SW[0]}</code>. این همان کاری است که در ارتباط سریال (مثل UART و SPI) برای تبدیل سریال به موازی انجام می‌شود.</p>
<h3>LFSR</h3>
<p><b>Linear Feedback Shift Register</b> یک شیفت رجیستر است که بیت ورودی‌اش XOR چند بیت خودش است. با انتخاب درست بیت‌ها (tap)، یک LFSR هشت‌بیتی از همه ۲۵۵ حالت غیرصفر عبور می‌کند و بعد تکرار می‌شود. کاربردها: اعداد شبه‌تصادفی، الگوی تست و scrambler.</p>
<pre class="formula">feedback = q7 ⊕ q5 ⊕ q4 ⊕ q3   (x⁸ + x⁶ + x⁵ + x⁴ + 1)</pre>
<p>برای این‌که حرکت را با چشم ببینیم، مثل درس شمارنده یک <b>تیک</b> چهار بار در ثانیه می‌سازیم (هر ۲۵ میلیون کلاک). رجیسترها فقط وقتی <code>tick=1</code> است عوض می‌شوند؛ این روش <b>clock enable</b> است و همه‌چیز همچنان با یک کلاک کار می‌کند.</p>
<p class="note">⚠️ LFSR هرگز نباید صفر شود، چون در حالت صفر می‌ماند. به همین دلیل مقدار اولیه و مقدار Reset آن 01 است.</p>`,
    verilog: `// Serial-in shift register (LED[15:8]) and an 8-bit LFSR (LED[7:0]), 4 steps per second
module top (
    input  wire        CLK100MHZ,
    input  wire        CPU_RESETN,
    input  wire [15:0] SW,
    output wire [15:0] LED
);
    // 4 Hz enable tick: one clock-wide pulse every 25,000,000 cycles
    reg  [24:0] cnt = 0;
    wire        tick = (cnt == 25'd24_999_999);
    always @(posedge CLK100MHZ)
        cnt <= tick ? 25'd0 : cnt + 1;

    reg [7:0] sr   = 8'h00;
    reg [7:0] lfsr = 8'h01;     // must never be all zeros
    always @(posedge CLK100MHZ) begin
        if (!CPU_RESETN) begin
            sr   <= 8'h00;
            lfsr <= 8'h01;
        end else if (tick) begin
            sr   <= {sr[6:0], SW[0]};
            lfsr <= {lfsr[6:0], lfsr[7] ^ lfsr[5] ^ lfsr[4] ^ lfsr[3]};
        end
    end

    assign LED = {sr, lfsr};
endmodule
`,
    vhdl: `${VHDL_NUMERIC}
-- Serial-in shift register (LED[15:8]) and an 8-bit LFSR (LED[7:0]), 4 steps per second
entity top is
    port (
        CLK100MHZ  : in  std_logic;
        CPU_RESETN : in  std_logic;
        SW         : in  std_logic_vector(15 downto 0);
        LED        : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal cnt  : unsigned(24 downto 0) := (others => '0');
    signal tick : std_logic;
    signal sr   : std_logic_vector(7 downto 0) := x"00";
    signal lfsr : std_logic_vector(7 downto 0) := x"01";   -- must never be all zeros
begin
    -- 4 Hz enable tick: one clock-wide pulse every 25,000,000 cycles
    tick <= '1' when cnt = 24_999_999 else '0';
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if tick = '1' then
                cnt <= (others => '0');
            else
                cnt <= cnt + 1;
            end if;
        end if;
    end process;

    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if CPU_RESETN = '0' then
                sr   <= x"00";
                lfsr <= x"01";
            elsif tick = '1' then
                sr   <= sr(6 downto 0) & SW(0);
                lfsr <= lfsr(6 downto 0) & (lfsr(7) xor lfsr(5) xor lfsr(4) xor lfsr(3));
            end if;
        end if;
    end process;

    LED <= sr & lfsr;
end rtl;
`,
    xdc: { clk: true, sw: true, led: true, reset: true },
    tryIt: `<p>LD7..LD0 الگوی شبه‌تصادفی LFSR را نشان می‌دهند. SW0 را چند بار روشن و خاموش کنید و ببینید بیت‌ها روی LD15..LD8 به چپ حرکت می‌کنند. دکمه قرمز همه را به حالت اول برمی‌گرداند.</p>`,
    exercise: `<p>tapها را عوض کنید (مثلاً فقط <code>q7 ⊕ q6</code>) و با شبیه‌سازی بشمارید بعد از چند قدم الگو تکرار می‌شود. چرا کمتر از ۲۵۵ است؟</p>`,
  },
  {
    id: 'stopwatch',
    title: 'کرنومتر BCD',
    summary: 'کرنومتر 00.0 تا 99.9 ثانیه با شمارنده‌های دهدهی آبشاری.',
    body: `
<p>این درس سه چیز فصل را کنار هم می‌گذارد: <b>تیک</b> دقیق، <b>شمارنده‌های BCD آبشاری</b> و <b>نمایش مالتی‌پلکس</b>.</p>
<h3>تیک ۰٫۱ ثانیه</h3>
<pre class="formula">0.1 s × 100,000,000 Hz = 10,000,000 کلاک</pre>
<h3>شمارنده BCD</h3>
<p>در BCD هر رقم دهدهی جداگانه در ۴ بیت نگه داشته می‌شود (0 تا 9). وقتی یک رقم از 9 رد می‌شود صفر می‌شود و رقم بعدی را یکی زیاد می‌کند؛ مثل کیلومترشمار ماشین:</p>
<ul>
  <li><code>d0</code>: دهم ثانیه، <code>d1</code>: ثانیه، <code>d2</code>: ده ثانیه</li>
  <li>نقطه اعشار (DP) روی رقم <code>d1</code> روشن است: <b>12.3</b></li>
</ul>
<p>مزیت BCD این است که برای نمایش، هر رقم مستقیم به دیکودر ۷ قسمتی می‌رود و نیازی به تقسیم بر ۱۰ نیست.</p>
<h3>کنترل</h3>
<ul>
  <li><code>SW0</code> = شروع/توقف (go)</li>
  <li><code>BTNU</code> = صفر کردن (clear)</li>
</ul>`,
    verilog: `// BCD stopwatch 00.0 - 99.9 s. SW[0] = go, BTNU = clear
${HEX7SEG_V}
module top (
    input  wire        CLK100MHZ,
    input  wire [15:0] SW,
    input  wire        BTNU,
    output wire CA, CB, CC, CD, CE, CF, CG, DP,
    output reg  [7:0]  AN
);
    // 0.1 s tick
    reg  [23:0] ms = 0;
    wire        tick = (ms == 24'd9_999_999);

    reg [3:0] d0 = 0, d1 = 0, d2 = 0;   // tenths, seconds, tens of seconds
    always @(posedge CLK100MHZ) begin
        if (BTNU) begin
            ms <= 0;
            d0 <= 0; d1 <= 0; d2 <= 0;
        end else if (SW[0]) begin
            ms <= tick ? 24'd0 : ms + 1;
            if (tick) begin
                if (d0 != 4'd9)
                    d0 <= d0 + 1;
                else begin
                    d0 <= 0;
                    if (d1 != 4'd9)
                        d1 <= d1 + 1;
                    else begin
                        d1 <= 0;
                        d2 <= (d2 == 4'd9) ? 4'd0 : d2 + 1;
                    end
                end
            end
        end
    end

    // display multiplexing on the three right-most digits
    reg  [17:0] refresh = 0;
    wire [1:0]  digit = refresh[17:16];
    reg  [3:0]  nibble;
    wire [6:0]  seg;
    always @(posedge CLK100MHZ)
        refresh <= refresh + 1;

    always @(*) begin
        AN = 8'b1111_1111;
        nibble = d0;
        case (digit)
            2'd0: begin AN[0] = 1'b0; nibble = d0; end
            2'd1: begin AN[1] = 1'b0; nibble = d1; end
            2'd2: begin AN[2] = 1'b0; nibble = d2; end
            default: ;                            // digit 3 stays dark
        endcase
    end

    hex7seg decoder (.x(nibble), .seg(seg));

    assign {CG, CF, CE, CD, CC, CB, CA} = seg;
    assign DP = (digit == 2'd1) ? 1'b0 : 1'b1;   // decimal point after the seconds
endmodule
`,
    vhdl: `${HEX7SEG_VHDL}
${VHDL_NUMERIC}
-- BCD stopwatch 00.0 - 99.9 s. SW(0) = go, BTNU = clear
entity top is
    port (
        CLK100MHZ : in  std_logic;
        SW        : in  std_logic_vector(15 downto 0);
        BTNU      : in  std_logic;
        CA, CB, CC, CD, CE, CF, CG, DP : out std_logic;
        AN        : out std_logic_vector(7 downto 0)
    );
end top;

architecture rtl of top is
    signal ms         : unsigned(23 downto 0) := (others => '0');
    signal d0, d1, d2 : unsigned(3 downto 0) := (others => '0');   -- tenths, seconds, tens
    signal refresh    : unsigned(17 downto 0) := (others => '0');
    signal digit      : std_logic_vector(1 downto 0);
    signal nibble     : std_logic_vector(3 downto 0);
    signal seg        : std_logic_vector(6 downto 0);
begin
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if BTNU = '1' then
                ms <= (others => '0');
                d0 <= (others => '0');
                d1 <= (others => '0');
                d2 <= (others => '0');
            elsif SW(0) = '1' then
                if ms = 9_999_999 then           -- 0.1 s tick
                    ms <= (others => '0');
                    if d0 /= 9 then
                        d0 <= d0 + 1;
                    else
                        d0 <= (others => '0');
                        if d1 /= 9 then
                            d1 <= d1 + 1;
                        else
                            d1 <= (others => '0');
                            if d2 /= 9 then
                                d2 <= d2 + 1;
                            else
                                d2 <= (others => '0');
                            end if;
                        end if;
                    end if;
                else
                    ms <= ms + 1;
                end if;
            end if;
        end if;
    end process;

    -- display multiplexing on the three right-most digits
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
              "11111111" when others;   -- digit 3 stays dark

    with digit select
        nibble <= std_logic_vector(d1) when "01",
                  std_logic_vector(d2) when "10",
                  std_logic_vector(d0) when others;

    decoder : entity work.hex7seg port map (x => nibble, seg => seg);

    CA <= seg(0);  CB <= seg(1);  CC <= seg(2);  CD <= seg(3);
    CE <= seg(4);  CF <= seg(5);  CG <= seg(6);
    DP <= '0' when digit = "01" else '1';   -- decimal point after the seconds
end rtl;
`,
    xdc: { clk: true, sw: true, btn: true, seg: true },
    tryIt: `<p>SW0 را روشن کنید تا کرنومتر شروع کند و خاموش کنید تا بایستد. BTNU آن را صفر می‌کند. سرعت را روی <b>Real-time</b> نگه دارید تا زمان با ساعت واقعی یکی باشد.</p>`,
    exercise: `<p>یک رقم دقیقه اضافه کنید (روی AN3) تا کرنومتر تا 9:59.9 بشمارد. رقم ثانیه‌های دهگان باید در 5 به صفر برگردد.</p>`,
  },

  // ------------------------------------------------------------ chapter 4: FSM
  {
    id: 'debounce',
    title: 'حذف لرزش دکمه (Debouncing)',
    summary: 'ماشین حالت برای فیلتر کردن لرزش مکانیکی دکمه و آشکارساز لبه.',
    body: `
<p>کنتاکت فلزی دکمه هنگام فشردن و رها شدن چند میلی‌ثانیه <b>می‌لرزد</b> و به‌جای یک تغییر تمیز، ده‌ها بار بین 0 و 1 می‌پرد. برای انسان نامحسوس است، ولی مداری که با 100MHz کار می‌کند هر پرش را یک فشار جدا می‌بیند.</p>
<h3>ماشین حالت Debounce</h3>
<p>ورودی را فقط وقتی قبول می‌کنیم که <b>۱۰ میلی‌ثانیه ثابت</b> مانده باشد:</p>
${truth(
  ['حالت', 'خروجی db', 'رفتن به حالت بعد'],
  [
    ['ZERO', 0, 'اگر ورودی 1 شد ← WAIT1'],
    ['WAIT1', 0, 'اگر ۱۰ms یک ماند ← ONE؛ اگر 0 شد ← ZERO'],
    ['ONE', 1, 'اگر ورودی 0 شد ← WAIT0'],
    ['WAIT0', 1, 'اگر ۱۰ms صفر ماند ← ZERO؛ اگر 1 شد ← ONE'],
  ],
)}
<pre class="formula">10 ms × 100 MHz = 1,000,000 کلاک  (شمارنده ۲۰ بیتی)</pre>
<h3>آشکارساز لبه (Edge Detector)</h3>
<p>برای شمردن فشارها، باید <b>لحظه</b> فشرده شدن را پیدا کنیم، نه مدت فشرده بودن را. مقدار کلاک قبل را در یک فلیپ‌فلاپ نگه می‌داریم: <code>tick = level &amp; ~prev</code>. خروجی دقیقاً یک کلاک یک می‌شود.</p>
<h3>آزمایش</h3>
<p>دو شمارنده داریم: یکی لبه‌های ورودی <b>خام</b> BTNC را می‌شمارد (LD7..LD0) و دیگری لبه‌های ورودی <b>فیلترشده</b> را (LD15..LD8). BTNU هر دو را صفر می‌کند.</p>
<p class="note">💡 دکمه‌های شبیه‌ساز به‌طور پیش‌فرض تمیز هستند. گزینه <b>Bouncy buttons</b> را در نوار ابزار روشن کنید تا مثل دکمه واقعی بلرزند.</p>`,
    verilog: `// Button debouncer FSM + edge detectors: raw vs. debounced press counts
module debounce (
    input  wire clk,
    input  wire sw,          // noisy input
    output reg  db           // clean output
);
    localparam [1:0] ZERO = 2'd0, WAIT1 = 2'd1, ONE = 2'd2, WAIT0 = 2'd3;
    localparam N = 1_000_000;          // 10 ms at 100 MHz

    reg [1:0]  state = ZERO;
    reg [19:0] cnt   = 0;

    always @(posedge clk) begin
        case (state)
            ZERO:  if (sw) begin state <= WAIT1; cnt <= 0; end
            WAIT1: if (!sw)             state <= ZERO;
                   else if (cnt == N-1) state <= ONE;
                   else                 cnt <= cnt + 1;
            ONE:   if (!sw) begin state <= WAIT0; cnt <= 0; end
            WAIT0: if (sw)              state <= ONE;
                   else if (cnt == N-1) state <= ZERO;
                   else                 cnt <= cnt + 1;
        endcase
    end

    always @(*) db = (state == ONE) || (state == WAIT0);
endmodule

module edge_detect (
    input  wire clk,
    input  wire level,
    output wire tick         // one clock-wide pulse on every rising edge
);
    reg prev = 1'b0;
    always @(posedge clk) prev <= level;
    assign tick = level & ~prev;
endmodule

module top (
    input  wire        CLK100MHZ,
    input  wire        BTNC,
    input  wire        BTNU,
    output wire [15:0] LED
);
    wire db, raw_tick, db_tick;

    debounce    u_db  (.clk(CLK100MHZ), .sw(BTNC),   .db(db));
    edge_detect e_raw (.clk(CLK100MHZ), .level(BTNC), .tick(raw_tick));
    edge_detect e_db  (.clk(CLK100MHZ), .level(db),   .tick(db_tick));

    reg [7:0] raw_cnt = 0;
    reg [7:0] db_cnt  = 0;
    always @(posedge CLK100MHZ) begin
        if (BTNU) begin
            raw_cnt <= 0;
            db_cnt  <= 0;
        end else begin
            if (raw_tick) raw_cnt <= raw_cnt + 1;
            if (db_tick)  db_cnt  <= db_cnt + 1;
        end
    end

    assign LED = {db_cnt, raw_cnt};
endmodule
`,
    vhdl: `${VHDL_NUMERIC}
-- Button debouncer FSM
entity debounce is
    port (
        clk : in  std_logic;
        sw  : in  std_logic;    -- noisy input
        db  : out std_logic     -- clean output
    );
end debounce;

architecture rtl of debounce is
    type state_t is (ZERO, WAIT1, ONE, WAIT0);
    constant N : integer := 1_000_000;         -- 10 ms at 100 MHz
    signal state : state_t := ZERO;
    signal cnt   : unsigned(19 downto 0) := (others => '0');
begin
    process(clk)
    begin
        if rising_edge(clk) then
            case state is
                when ZERO =>
                    if sw = '1' then state <= WAIT1; cnt <= (others => '0'); end if;
                when WAIT1 =>
                    if sw = '0' then state <= ZERO;
                    elsif cnt = N - 1 then state <= ONE;
                    else cnt <= cnt + 1;
                    end if;
                when ONE =>
                    if sw = '0' then state <= WAIT0; cnt <= (others => '0'); end if;
                when WAIT0 =>
                    if sw = '1' then state <= ONE;
                    elsif cnt = N - 1 then state <= ZERO;
                    else cnt <= cnt + 1;
                    end if;
            end case;
        end if;
    end process;

    db <= '1' when state = ONE or state = WAIT0 else '0';
end rtl;

${VHDL_NUMERIC}
-- one clock-wide pulse on every rising edge
entity edge_detect is
    port (
        clk   : in  std_logic;
        level : in  std_logic;
        tick  : out std_logic
    );
end edge_detect;

architecture rtl of edge_detect is
    signal prev : std_logic := '0';
begin
    process(clk)
    begin
        if rising_edge(clk) then
            prev <= level;
        end if;
    end process;
    tick <= level and not prev;
end rtl;

${VHDL_NUMERIC}
-- raw vs. debounced press counts
entity top is
    port (
        CLK100MHZ : in  std_logic;
        BTNC      : in  std_logic;
        BTNU      : in  std_logic;
        LED       : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal db, raw_tick, db_tick : std_logic;
    signal raw_cnt, db_cnt       : unsigned(7 downto 0) := (others => '0');
begin
    u_db  : entity work.debounce    port map (clk => CLK100MHZ, sw => BTNC, db => db);
    e_raw : entity work.edge_detect port map (clk => CLK100MHZ, level => BTNC, tick => raw_tick);
    e_db  : entity work.edge_detect port map (clk => CLK100MHZ, level => db, tick => db_tick);

    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if BTNU = '1' then
                raw_cnt <= (others => '0');
                db_cnt  <= (others => '0');
            else
                if raw_tick = '1' then raw_cnt <= raw_cnt + 1; end if;
                if db_tick = '1' then db_cnt <= db_cnt + 1; end if;
            end if;
        end if;
    end process;

    LED <= std_logic_vector(db_cnt) & std_logic_vector(raw_cnt);
end rtl;
`,
    xdc: { clk: true, led: true, btn: true },
    tryIt: `<p>ابتدا <b>Bouncy buttons</b> را در نوار ابزار روشن کنید. بعد چند بار BTNC را بزنید: LD15..LD8 (فیلترشده) دقیقاً تعداد فشارها را می‌شمارد، ولی LD7..LD0 (خام) در هر فشار چند عدد جلو می‌رود. BTNU هر دو را صفر می‌کند.</p>`,
    exercise: `<p>دیباونسر را به درس رجیستر (فلیپ‌فلاپ) اضافه کنید تا با هر فشار BTNU مقدار رجیستر دقیقاً یک بیت شیفت پیدا کند.</p>`,
  },

  // ------------------------------------------------------------ chapter 5: FSMD
  {
    id: 'bin2bcd',
    title: 'FSMD: تبدیل باینری به BCD',
    summary: 'الگوریتم Double Dabble با مسیر داده و کنترل‌کننده ماشین حالت.',
    body: `
<p><b>FSMD</b> (FSM with Datapath) روشی برای پیاده‌سازی <b>الگوریتم</b> در سخت‌افزار است: یک <b>مسیر داده</b> (رجیسترها و واحدهای محاسبه) کار را انجام می‌دهد و یک <b>ماشین حالت</b> آن را قدم‌به‌قدم کنترل می‌کند. بیشتر شتاب‌دهنده‌ها و پردازنده‌ها همین ساختار را دارند.</p>
<h3>مسئله</h3>
<p>عدد ۱۳ بیتی <code>SW[12:0]</code> (0 تا 8191) را به‌صورت دهدهی روی ۴ رقم نمایش دهیم. تقسیم بر ۱۰ در سخت‌افزار گران است؛ به‌جایش از الگوریتم <b>Double Dabble</b> (شیفت و جمع با ۳) استفاده می‌کنیم.</p>
<h3>الگوریتم</h3>
<ol>
  <li>رجیستر BCD را صفر کن.</li>
  <li>۱۳ بار تکرار کن: هر رقم BCD که <b>۵ یا بیشتر</b> است را <b>۳ تا</b> زیاد کن، بعد کل BCD و عدد باینری را با هم یک بیت به چپ شیفت بده.</li>
</ol>
<p>چرا ۳؟ رقمی که ۵ یا بیشتر است بعد از شیفت (ضرب در ۲) از ۹ رد می‌شود. افزودن ۳ قبل از شیفت، یعنی افزودن ۶ بعد از شیفت، و ۶ دقیقاً فاصله ۱۰ دهدهی تا ۱۶ باینری است.</p>
${truth(
  ['حالت', 'کار'],
  [
    ['IDLE', 'منتظر start؛ بارگذاری عدد و صفر کردن BCD'],
    ['OP', 'یک قدم اصلاح و شیفت در هر کلاک، ۱۳ بار'],
    ['DONE', 'ذخیره نتیجه در رجیستر خروجی و برگشت به IDLE'],
  ],
)}
<p>ورودی <code>start</code> را به 1 وصل کرده‌ایم، پس تبدیل پشت‌سرهم تکرار می‌شود (هر ۱۵ کلاک یک بار) و نتیجه همیشه تازه است.</p>`,
    verilog: `// FSMD: 13-bit binary to 4-digit BCD with the double-dabble algorithm
module bin2bcd (
    input  wire        clk,
    input  wire        start,
    input  wire [12:0] bin,
    output wire        ready,
    output reg  [15:0] bcd_out = 0     // four BCD digits
);
    localparam [1:0] IDLE = 2'd0, OP = 2'd1, DONE = 2'd2;

    reg [1:0]  state = IDLE;
    reg [12:0] p2s   = 0;    // binary bits still to shift in
    reg [3:0]  n     = 0;    // iterations left
    reg [15:0] bcd   = 0;

    // add 3 to every digit that is 5 or more
    wire [3:0] a0, a1, a2, a3;
    assign a0 = (bcd[3:0]   > 4) ? bcd[3:0]   + 4'd3 : bcd[3:0];
    assign a1 = (bcd[7:4]   > 4) ? bcd[7:4]   + 4'd3 : bcd[7:4];
    assign a2 = (bcd[11:8]  > 4) ? bcd[11:8]  + 4'd3 : bcd[11:8];
    assign a3 = (bcd[15:12] > 4) ? bcd[15:12] + 4'd3 : bcd[15:12];

    always @(posedge clk) begin
        case (state)
            IDLE:
                if (start) begin
                    p2s   <= bin;
                    bcd   <= 16'd0;
                    n     <= 4'd13;
                    state <= OP;
                end
            OP: begin
                bcd <= {a3[2:0], a2, a1, a0, p2s[12]};   // adjust, then shift left
                p2s <= {p2s[11:0], 1'b0};
                n   <= n - 1;
                if (n == 4'd1)
                    state <= DONE;
            end
            default: begin    // DONE
                bcd_out <= bcd;
                state   <= IDLE;
            end
        endcase
    end

    assign ready = (state == IDLE);
endmodule

${HEX7SEG_V}
module top (
    input  wire        CLK100MHZ,
    input  wire [15:0] SW,
    output wire [15:0] LED,
    output wire CA, CB, CC, CD, CE, CF, CG, DP,
    output reg  [7:0]  AN
);
    wire [15:0] bcd;
    wire        ready;
    bin2bcd conv (.clk(CLK100MHZ), .start(1'b1), .bin(SW[12:0]), .ready(ready), .bcd_out(bcd));

    assign LED = {3'b000, SW[12:0]};

    // four-digit display multiplexing
    reg  [17:0] refresh = 0;
    wire [1:0]  digit = refresh[17:16];
    reg  [3:0]  nibble;
    wire [6:0]  seg;
    always @(posedge CLK100MHZ)
        refresh <= refresh + 1;

    always @(*) begin
        AN = 8'b1111_1111;
        AN[digit] = 1'b0;
        case (digit)
            2'd0:    nibble = bcd[3:0];
            2'd1:    nibble = bcd[7:4];
            2'd2:    nibble = bcd[11:8];
            default: nibble = bcd[15:12];
        endcase
    end

    hex7seg decoder (.x(nibble), .seg(seg));
    assign {CG, CF, CE, CD, CC, CB, CA} = seg;
    assign DP = 1'b1;
endmodule
`,
    vhdl: `${VHDL_NUMERIC}
-- FSMD: 13-bit binary to 4-digit BCD with the double-dabble algorithm
entity bin2bcd is
    port (
        clk     : in  std_logic;
        start   : in  std_logic;
        bin     : in  std_logic_vector(12 downto 0);
        ready   : out std_logic;
        bcd_out : out std_logic_vector(15 downto 0)   -- four BCD digits
    );
end bin2bcd;

architecture rtl of bin2bcd is
    type state_t is (IDLE, OP, DONE);
    signal state          : state_t := IDLE;
    signal p2s            : std_logic_vector(12 downto 0) := (others => '0');
    signal n              : unsigned(3 downto 0) := (others => '0');
    signal bcd, result    : unsigned(15 downto 0) := (others => '0');
    signal a0, a1, a2, a3 : unsigned(3 downto 0);
begin
    -- add 3 to every digit that is 5 or more
    a0 <= bcd(3 downto 0)   + 3 when bcd(3 downto 0)   > 4 else bcd(3 downto 0);
    a1 <= bcd(7 downto 4)   + 3 when bcd(7 downto 4)   > 4 else bcd(7 downto 4);
    a2 <= bcd(11 downto 8)  + 3 when bcd(11 downto 8)  > 4 else bcd(11 downto 8);
    a3 <= bcd(15 downto 12) + 3 when bcd(15 downto 12) > 4 else bcd(15 downto 12);

    process(clk)
    begin
        if rising_edge(clk) then
            case state is
                when IDLE =>
                    if start = '1' then
                        p2s   <= bin;
                        bcd   <= (others => '0');
                        n     <= to_unsigned(13, 4);
                        state <= OP;
                    end if;
                when OP =>
                    bcd <= a3(2 downto 0) & a2 & a1 & a0 & p2s(12);   -- adjust, then shift left
                    p2s <= p2s(11 downto 0) & '0';
                    n   <= n - 1;
                    if n = 1 then
                        state <= DONE;
                    end if;
                when DONE =>
                    result <= bcd;
                    state  <= IDLE;
            end case;
        end if;
    end process;

    ready   <= '1' when state = IDLE else '0';
    bcd_out <= std_logic_vector(result);
end rtl;

${HEX7SEG_VHDL}
${VHDL_NUMERIC}
entity top is
    port (
        CLK100MHZ : in  std_logic;
        SW        : in  std_logic_vector(15 downto 0);
        LED       : out std_logic_vector(15 downto 0);
        CA, CB, CC, CD, CE, CF, CG, DP : out std_logic;
        AN        : out std_logic_vector(7 downto 0)
    );
end top;

architecture rtl of top is
    signal bcd     : std_logic_vector(15 downto 0);
    signal ready   : std_logic;
    signal refresh : unsigned(17 downto 0) := (others => '0');
    signal digit   : std_logic_vector(1 downto 0);
    signal nibble  : std_logic_vector(3 downto 0);
    signal seg     : std_logic_vector(6 downto 0);
begin
    conv : entity work.bin2bcd
        port map (clk => CLK100MHZ, start => '1', bin => SW(12 downto 0), ready => ready, bcd_out => bcd);

    LED <= "000" & SW(12 downto 0);

    -- four-digit display multiplexing
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
        nibble <= bcd(3 downto 0)   when "00",
                  bcd(7 downto 4)   when "01",
                  bcd(11 downto 8)  when "10",
                  bcd(15 downto 12) when others;

    decoder : entity work.hex7seg port map (x => nibble, seg => seg);

    CA <= seg(0);  CB <= seg(1);  CC <= seg(2);  CD <= seg(3);
    CE <= seg(4);  CF <= seg(5);  CG <= seg(6);
    DP <= '1';
end rtl;
`,
    xdc: { clk: true, sw: true, led: true, seg: true },
    tryIt: `<p>با SW12..SW0 یک عدد باینری بسازید (LEDها همان را نشان می‌دهند). نمایشگر معادل دهدهی آن را نشان می‌دهد؛ مثلاً همه ۱۳ کلید روشن ← <b>8191</b>.</p>`,
    exercise: `<p>کنترل‌کننده را طوری عوض کنید که فقط با فشار BTNC تبدیل شروع شود و LD15 وقتی <code>ready=1</code> است روشن باشد.</p>`,
  },

  // ------------------------------------------------------------ chapter 6: memory
  {
    id: 'ram',
    title: 'حافظه RAM همگام',
    summary: 'RAM با ۱۶ خانه ۸ بیتی: نوشتن با دکمه و خواندن همگام.',
    body: `
<p>FPGA علاوه بر فلیپ‌فلاپ، بلوک‌های حافظه آماده دارد: <b>Block RAM</b> (در Artix-7 هر بلوک ۳۶ کیلوبیت) و <b>Distributed RAM</b> (ساخته‌شده از LUTها). لازم نیست آن‌ها را دستی نمونه‌سازی کنیم: کافی است حافظه را با یک الگوی استاندارد توصیف کنیم تا Vivado خودش آن را تشخیص دهد (<b>inference</b>).</p>
<h3>الگوی RAM همگام</h3>
<ul>
  <li>Verilog: آرایه <code>reg [7:0] mem [0:15]</code></li>
  <li>VHDL: یک نوع آرایه <code>type ram_t is array (0 to 15) of std_logic_vector(7 downto 0)</code></li>
  <li>نوشتن فقط در لبه کلاک و وقتی <code>we=1</code> است.</li>
  <li>خواندن هم در لبه کلاک: داده یک کلاک بعد از آدرس آماده است. Block RAM فقط خواندن همگام را پشتیبانی می‌کند.</li>
</ul>
<h3>اتصال به برد</h3>
${truth(
  ['سیگنال', 'به'],
  [
    ['addr', 'SW[11:8] (روی LD11..LD8 هم نمایش داده می‌شود)'],
    ['din', 'SW[7:0]'],
    ['we', 'BTNC'],
    ['dout', 'LED[7:0]'],
  ],
)}
<p class="note">💡 در گزارش Utilization ببینید حافظه چه منبعی مصرف کرده است. برای حافظه‌های بزرگ‌تر (مثلاً 1024×8) Vivado از BRAM استفاده می‌کند.</p>`,
    verilog: `// 16 x 8 synchronous RAM: write with BTNC, read on every clock
module ram16x8 (
    input  wire       clk,
    input  wire       we,
    input  wire [3:0] addr,
    input  wire [7:0] din,
    output reg  [7:0] dout
);
    reg [7:0] mem [0:15];

    always @(posedge clk) begin
        if (we)
            mem[addr] <= din;
        dout <= mem[addr];       // synchronous (registered) read
    end
endmodule

module top (
    input  wire        CLK100MHZ,
    input  wire [15:0] SW,
    input  wire        BTNC,
    output wire [15:0] LED
);
    wire [7:0] dout;
    ram16x8 ram (.clk(CLK100MHZ), .we(BTNC), .addr(SW[11:8]), .din(SW[7:0]), .dout(dout));

    assign LED = {4'b0000, SW[11:8], dout};
endmodule
`,
    vhdl: `${VHDL_NUMERIC}
-- 16 x 8 synchronous RAM: write with BTNC, read on every clock
entity ram16x8 is
    port (
        clk  : in  std_logic;
        we   : in  std_logic;
        addr : in  std_logic_vector(3 downto 0);
        din  : in  std_logic_vector(7 downto 0);
        dout : out std_logic_vector(7 downto 0)
    );
end ram16x8;

architecture rtl of ram16x8 is
    type ram_t is array (0 to 15) of std_logic_vector(7 downto 0);
    signal mem : ram_t := (others => (others => '0'));
begin
    process(clk)
    begin
        if rising_edge(clk) then
            if we = '1' then
                mem(to_integer(unsigned(addr))) <= din;
            end if;
            dout <= mem(to_integer(unsigned(addr)));   -- synchronous (registered) read
        end if;
    end process;
end rtl;

${VHDL_NUMERIC}
entity top is
    port (
        CLK100MHZ : in  std_logic;
        SW        : in  std_logic_vector(15 downto 0);
        BTNC      : in  std_logic;
        LED       : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal dout : std_logic_vector(7 downto 0);
begin
    ram : entity work.ram16x8
        port map (clk => CLK100MHZ, we => BTNC, addr => SW(11 downto 8), din => SW(7 downto 0), dout => dout);

    LED <= "0000" & SW(11 downto 8) & dout;
end rtl;
`,
    xdc: { clk: true, sw: true, led: true, btn: true },
    tryIt: `<p>با SW11..SW8 یک آدرس انتخاب کنید، با SW7..SW0 یک داده بسازید و BTNC را بزنید. آدرس را عوض کنید و بعد برگردید: داده ذخیره‌شده دوباره روی LD7..LD0 ظاهر می‌شود، حتی اگر SW7..SW0 را تغییر داده باشید.</p>`,
    exercise: `<p>یک ROM بسازید که پیغام «HELLO» را در خود داشته باشد و با یک شمارنده، حروف را یکی‌یکی روی نمایشگر نشان دهد.</p>`,
  },

  // ------------------------------------------------------------ chapter 7: I/O
  {
    id: 'pwm',
    title: 'PWM: کنترل نور LED',
    summary: 'مدولاسیون پهنای پالس با ماژول پارامتری و ترکیب رنگ در LED سه‌رنگ.',
    body: `
<p>خروجی دیجیتال فقط 0 یا 1 است؛ پس چطور یک LED را کم‌نور کنیم؟ با <b>PWM</b> (Pulse Width Modulation): خروجی را خیلی سریع روشن و خاموش می‌کنیم و نسبت زمان روشن بودن (<b>Duty Cycle</b>) میزان نور را تعیین می‌کند. همین روش برای کنترل سرعت موتور، سروو و تولید صدا هم به کار می‌رود.</p>
<h3>مدار</h3>
<p>یک شمارنده W بیتی آزاد می‌شمارد و خروجی تا وقتی شمارنده از <code>duty</code> کوچک‌تر است یک است:</p>
<pre class="formula">pwm = (cnt &lt; duty)      Duty = duty / 2^W</pre>
<p>با W=8 و کلاک 100MHz، فرکانس PWM حدود <b>390kHz</b> است؛ چشم فقط میانگین را می‌بیند.</p>
<h3>ماژول پارامتری</h3>
<p>عرض شمارنده با <code>parameter</code> در Verilog و <code>generic</code> در VHDL تعیین می‌شود تا ماژول برای دقت‌های مختلف قابل استفاده باشد.</p>
<ul>
  <li><code>SW[7:0]</code> ← روشنایی قرمز LD16 و LD0</li>
  <li><code>SW[15:8]</code> ← روشنایی سبز LD16 و LD1</li>
</ul>
<p>با ترکیب قرمز و سبز با نسبت‌های مختلف، رنگ‌های نارنجی و زرد ساخته می‌شوند.</p>`,
    verilog: `// Parameterised PWM: two brightness channels on the RGB LED LD16
module pwm #(parameter W = 8) (
    input  wire         clk,
    input  wire [W-1:0] duty,
    output wire         pwm_o
);
    reg [W-1:0] cnt = 0;
    always @(posedge clk)
        cnt <= cnt + 1;
    assign pwm_o = (cnt < duty);
endmodule

module top (
    input  wire        CLK100MHZ,
    input  wire [15:0] SW,
    output wire [15:0] LED,
    output wire        LED16_R, LED16_G, LED16_B
);
    wire r, g;
    pwm #(.W(8)) pwm_r (.clk(CLK100MHZ), .duty(SW[7:0]),  .pwm_o(r));
    pwm #(.W(8)) pwm_g (.clk(CLK100MHZ), .duty(SW[15:8]), .pwm_o(g));

    assign LED16_R = r;
    assign LED16_G = g;
    assign LED16_B = 1'b0;
    assign LED = {14'b0, g, r};
endmodule
`,
    vhdl: `${VHDL_NUMERIC}
-- Parameterised PWM
entity pwm is
    generic (W : integer := 8);
    port (
        clk   : in  std_logic;
        duty  : in  std_logic_vector(W-1 downto 0);
        pwm_o : out std_logic
    );
end pwm;

architecture rtl of pwm is
    signal cnt : unsigned(W-1 downto 0) := (others => '0');
begin
    process(clk)
    begin
        if rising_edge(clk) then
            cnt <= cnt + 1;
        end if;
    end process;
    pwm_o <= '1' when cnt < unsigned(duty) else '0';
end rtl;

${VHDL_NUMERIC}
-- two brightness channels on the RGB LED LD16
entity top is
    port (
        CLK100MHZ : in  std_logic;
        SW        : in  std_logic_vector(15 downto 0);
        LED       : out std_logic_vector(15 downto 0);
        LED16_R, LED16_G, LED16_B : out std_logic
    );
end top;

architecture rtl of top is
    signal r, g : std_logic;
begin
    pwm_r : entity work.pwm generic map (W => 8) port map (clk => CLK100MHZ, duty => SW(7 downto 0), pwm_o => r);
    pwm_g : entity work.pwm generic map (W => 8) port map (clk => CLK100MHZ, duty => SW(15 downto 8), pwm_o => g);

    LED16_R <= r;
    LED16_G <= g;
    LED16_B <= '0';
    LED <= "00000000000000" & g & r;
end rtl;
`,
    xdc: { clk: true, sw: true, led: true, rgb: true },
    tryIt: `<p>SW7 را روشن کنید (duty = 128، یعنی ۵۰٪) و بعد SW0 تا SW6 را امتحان کنید: LD0 و قرمز LD16 با شدت‌های مختلف روشن می‌شوند. با SW15..SW8 سبز را اضافه کنید تا رنگ نارنجی یا زرد بسازید.</p>`,
    exercise: `<p>یک «چراغ نفس‌کش» (breathing LED) بسازید: یک شمارنده کند مقدار duty را آرام زیاد و بعد کم کند.</p>`,
  },

  {
    id: 'uart',
    title: 'فرستنده UART و Logic Analyzer',
    summary: 'ارسال «Hello FPGA!» با پروتکل سریال UART و دیدن و دیکود کردن آن با Logic Analyzer.',
    body: `
<p><b>UART</b> ساده‌ترین پروتکل سریال است و برد Nexys A7 از طریق همان کابل USB یک درگاه سریال به کامپیوتر دارد. پایه <code>UART_RXD_OUT</code> (پایه D4) از FPGA به تراشه USB-UART می‌رود.</p>
<h3>قاب (Frame) در حالت 8N1</h3>
<ul>
  <li>خط در حالت بیکار <b>1</b> است.</li>
  <li><b>بیت شروع</b>: یک بیت 0</li>
  <li><b>۸ بیت داده</b>، اول کم‌ارزش‌ترین بیت (LSB first)</li>
  <li><b>بیت توقف</b>: یک بیت 1</li>
</ul>
<pre class="formula">115200 baud ← هر بیت = 100,000,000 / 115200 ≈ 868 کلاک ≈ 8.68 µs</pre>
<h3>طراحی</h3>
<p>ماژول <code>uart_tx</code> یک FSMD با چهار حالت IDLE، START، DATA و STOP است: یک شمارنده طول هر بیت را می‌سازد و یک شیفت رجیستر بیت‌ها را یکی‌یکی بیرون می‌فرستد. ماژول بالایی یک ROM کوچک با متن پیام دارد و هر وقت فرستنده آزاد شد (<code>busy=0</code>) حرف بعدی را می‌فرستد.</p>
<h3>Logic Analyzer</h3>
<p>در کار واقعی برای دیدن این سیگنال یک <b>Logic Analyzer</b> (مثلاً یک دستگاه USB مثل Digital Discovery) را به پایه‌ها وصل می‌کنیم. در این سایت یک Logic Analyzer مجازی داریم: دکمه <span class="kbd">⎍ Logic Analyzer</span> در نوار ابزار را بزنید.</p>
<ul>
  <li>هر <b>کانال</b> به یک پایه وصل می‌شود: پایه‌های Pmod (JA تا JD)، LEDها، کلیدها یا حتی سیگنال‌های داخلی طرح (مثل ILA در Vivado).</li>
  <li><b>Trigger</b>: ضبط را روی لبه یک کانال هم‌زمان می‌کند؛ اینجا لبه پایین‌رونده بیت شروع.</li>
  <li><b>دیکودر UART</b> بیت‌ها را به بایت و حرف تبدیل می‌کند. دیکودرهای SPI و I²C هم وجود دارند.</li>
</ul>
<p class="note">💡 تنظیمات Logic Analyzer برای این درس آماده است: کانال TX روی پایه D4، Trigger روی لبه پایین‌رونده و دیکودر UART با 115200 baud.</p>`,
    verilog: `// UART transmitter (115200 baud, 8N1) sending "Hello FPGA!" on the USB-UART line
${UART_TX_V}
module top (
    input  wire        CLK100MHZ,
    input  wire        BTNC,           // send the message once
    input  wire [15:0] SW,             // SW[0] = send again and again
    output wire        UART_RXD_OUT,   // FPGA -> PC
    output wire [15:0] LED
);
    // message ROM: "Hello FPGA!\\r\\n"
    reg [3:0] idx = 0;
    reg [7:0] ch;
    always @(*) begin
        case (idx)
            4'd0:  ch = 8'h48;  // H
            4'd1:  ch = 8'h65;  // e
            4'd2:  ch = 8'h6C;  // l
            4'd3:  ch = 8'h6C;  // l
            4'd4:  ch = 8'h6F;  // o
            4'd5:  ch = 8'h20;  // ' '
            4'd6:  ch = 8'h46;  // F
            4'd7:  ch = 8'h50;  // P
            4'd8:  ch = 8'h47;  // G
            4'd9:  ch = 8'h41;  // A
            4'd10: ch = 8'h21;  // !
            4'd11: ch = 8'h0D;  // \\r
            default: ch = 8'h0A;  // \\n
        endcase
    end

    localparam [1:0] S_IDLE = 2'd0, S_SEND = 2'd1, S_WAIT = 2'd2;
    reg  [1:0] state = S_IDLE;
    reg        btn_d = 1'b0;
    wire       busy;
    wire       start = (state == S_SEND);

    uart_tx tx_unit (.clk(CLK100MHZ), .start(start), .data(ch), .tx(UART_RXD_OUT), .busy(busy));

    always @(posedge CLK100MHZ) begin
        btn_d <= BTNC;
        case (state)
            S_IDLE:
                if ((BTNC && !btn_d) || SW[0]) begin
                    idx   <= 0;
                    state <= S_SEND;
                end
            S_SEND:
                state <= S_WAIT;
            default:                       // S_WAIT: wait for the character to finish
                if (!busy) begin
                    if (idx == 4'd12) state <= S_IDLE;
                    else begin
                        idx   <= idx + 1;
                        state <= S_SEND;
                    end
                end
        endcase
    end

    assign LED = {busy, 7'b0000000, ch};
endmodule
`,
    vhdl: `${VHDL_NUMERIC}
${UART_TX_VHDL}
${VHDL_NUMERIC}
-- sends "Hello FPGA!" on the USB-UART line
entity top is
    port (
        CLK100MHZ    : in  std_logic;
        BTNC         : in  std_logic;                      -- send the message once
        SW           : in  std_logic_vector(15 downto 0);  -- SW(0) = send again and again
        UART_RXD_OUT : out std_logic;                      -- FPGA -> PC
        LED          : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    type state_t is (S_IDLE, S_SEND, S_WAIT);
    signal state : state_t := S_IDLE;
    signal idx   : unsigned(3 downto 0) := (others => '0');
    signal ch    : std_logic_vector(7 downto 0);
    signal btn_d : std_logic := '0';
    signal start : std_logic;
    signal busy  : std_logic;
begin
    -- message ROM: "Hello FPGA!\\r\\n"
    process(idx)
    begin
        case idx is
            when "0000" => ch <= x"48";  -- H
            when "0001" => ch <= x"65";  -- e
            when "0010" => ch <= x"6C";  -- l
            when "0011" => ch <= x"6C";  -- l
            when "0100" => ch <= x"6F";  -- o
            when "0101" => ch <= x"20";  -- ' '
            when "0110" => ch <= x"46";  -- F
            when "0111" => ch <= x"50";  -- P
            when "1000" => ch <= x"47";  -- G
            when "1001" => ch <= x"41";  -- A
            when "1010" => ch <= x"21";  -- !
            when "1011" => ch <= x"0D";  -- \\r
            when others => ch <= x"0A";  -- \\n
        end case;
    end process;

    start <= '1' when state = S_SEND else '0';

    tx_unit : entity work.uart_tx
        port map (clk => CLK100MHZ, start => start, data => ch, tx => UART_RXD_OUT, busy => busy);

    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            btn_d <= BTNC;
            case state is
                when S_IDLE =>
                    if (BTNC = '1' and btn_d = '0') or SW(0) = '1' then
                        idx   <= (others => '0');
                        state <= S_SEND;
                    end if;
                when S_SEND =>
                    state <= S_WAIT;
                when S_WAIT =>                         -- wait for the character to finish
                    if busy = '0' then
                        if idx = 12 then
                            state <= S_IDLE;
                        else
                            idx   <= idx + 1;
                            state <= S_SEND;
                        end if;
                    end if;
            end case;
        end if;
    end process;

    LED <= busy & "0000000" & ch;
end rtl;
`,
    xdc: { clk: true, sw: true, led: true, btn: true, uart: true },
    tryIt: `<p>طرح را اجرا کنید و Logic Analyzer را باز کنید (دکمه <span class="kbd">⎍ Logic Analyzer</span> یا Ctrl+L). در پنجره آن <b>Run</b> را بزنید و بعد BTNC را روی برد فشار دهید، یا SW0 را روشن کنید تا پیام پشت‌سرهم ارسال شود. شکل موج خط TX و بایت‌های دیکودشده <b>H e l l o …</b> را می‌بینید. با چرخ ماوس بزرگ‌نمایی کنید، با کلیک و Shift+کلیک دو نشانگر بگذارید و طول یک بیت (حدود 8.68µs) را اندازه بگیرید.</p>`,
    exercise: `<p>سرعت را به 9600 baud تغییر دهید (<code>CLKS_PER_BIT</code> چند می‌شود؟) و در تنظیمات دیکودر هم baud را عوض کنید. اگر فقط یکی را عوض کنید، دیکودر چه چیزی نشان می‌دهد؟</p>`,
    la: {
      chans: [
        { name: 'TX', probe: 'pin:D4' },
        { name: 'busy', probe: 'pin:V11' },
      ],
      decs: [{ type: 'uart', name: 'UART', ch: 0, baud: 115200, bits: 8, parity: 'none', stop: 1 }],
      base: 2e-4,
      pos: 4,
      trig: { ch: 0, edge: 'fall' },
    },
  },

  {
    id: 'uart_rx',
    title: 'گیرنده UART و کنسول سریال',
    summary: 'دریافت حروفی که در کنسول سریال تایپ می‌کنید و برگرداندن آن‌ها با حروف بزرگ.',
    body: `
<p>در درس قبل FPGA فقط می‌فرستاد. حالا جهت مخالف را می‌سازیم: کامپیوتر از طریق پایه <code>UART_TXD_IN</code> (پایه C4) به FPGA بایت می‌فرستد. برای این کار از <b>کنسول سریال</b> استفاده می‌کنیم: همان برنامه‌ای که روی کامپیوتر به درگاه COM برد وصل می‌شود (مثل PuTTY یا Tera Term).</p>
<h3>گیرنده</h3>
<ol>
  <li><b>هم‌گام‌سازی</b>: ورودی از دنیای بیرون با کلاک ما هم‌زمان نیست، پس اول از دو فلیپ‌فلاپ پشت‌سرهم (synchronizer) عبور می‌کند.</li>
  <li><b>IDLE</b>: منتظر لبه پایین‌رونده بیت شروع می‌مانیم.</li>
  <li><b>START</b>: نصف طول یک بیت (۴۳۴ کلاک) صبر می‌کنیم تا به <b>وسط</b> بیت شروع برسیم. اگر خط هنوز صفر است، شروع واقعی است.</li>
  <li><b>DATA</b>: هر ۸۶۸ کلاک یک نمونه برمی‌داریم؛ یعنی دقیقاً وسط هر بیت داده.</li>
  <li><b>STOP</b>: در وسط بیت توقف، بایت کامل است و خروجی <code>done</code> یک کلاک یک می‌شود.</li>
</ol>
<p>نمونه‌برداری در وسط بیت باعث می‌شود اختلاف کوچک سرعت دو طرف (تا حدود ۲ تا ۳ درصد) مشکلی ایجاد نکند.</p>
<h3>Echo</h3>
<p>هر بایتی که می‌رسد با همان فرستنده درس قبل برگردانده می‌شود و حروف کوچک به حروف بزرگ تبدیل می‌شوند (کم کردن 0x20). یک رجیستر نگه‌دارنده (<code>pend</code>) لازم است، چون ممکن است بایت بعدی برسد در حالی که فرستنده هنوز مشغول بایت قبلی است.</p>
<p>LD7..LD0 آخرین بایت دریافتی و LD15..LD8 تعداد بایت‌ها را نشان می‌دهند.</p>`,
    verilog: `// UART receiver + echo: letters typed in the serial console come back in upper case
module uart_rx #(parameter CLKS_PER_BIT = 868) (
    input  wire       clk,
    input  wire       rx,
    output reg  [7:0] data = 0,
    output reg        done = 1'b0      // one-clock pulse: a byte arrived
);
    localparam [1:0] IDLE = 2'd0, START = 2'd1, DATA = 2'd2, STOP = 2'd3;
    localparam HALF = CLKS_PER_BIT / 2;
    reg [1:0]  state = IDLE;
    reg [15:0] cnt   = 0;
    reg [2:0]  n     = 0;
    reg [7:0]  sh    = 0;
    reg        rx1   = 1'b1;          // two-flip-flop synchronizer
    reg        rx2   = 1'b1;

    always @(posedge clk) begin
        rx1  <= rx;
        rx2  <= rx1;
        done <= 1'b0;
        case (state)
            IDLE:
                if (!rx2) begin cnt <= 0; state <= START; end
            START:                          // wait for the middle of the start bit
                if (cnt == HALF - 1) begin
                    cnt <= 0;
                    if (!rx2) begin n <= 0; state <= DATA; end
                    else state <= IDLE;     // just a glitch
                end else cnt <= cnt + 1;
            DATA:                           // sample the middle of each data bit
                if (cnt == CLKS_PER_BIT - 1) begin
                    cnt <= 0;
                    sh  <= {rx2, sh[7:1]};  // LSB arrives first
                    if (n == 3'd7) state <= STOP;
                    else           n <= n + 1;
                end else cnt <= cnt + 1;
            default:                        // STOP: middle of the stop bit
                if (cnt == CLKS_PER_BIT - 1) begin
                    cnt   <= 0;
                    data  <= sh;
                    done  <= 1'b1;
                    state <= IDLE;
                end else cnt <= cnt + 1;
        endcase
    end
endmodule

${UART_TX_V}
module top (
    input  wire        CLK100MHZ,
    input  wire        UART_TXD_IN,    // PC -> FPGA
    output wire        UART_RXD_OUT,   // FPGA -> PC
    output wire [15:0] LED
);
    wire [7:0] rx_data;
    wire       rx_done;
    wire       busy;

    uart_rx rx_unit (.clk(CLK100MHZ), .rx(UART_TXD_IN), .data(rx_data), .done(rx_done));

    // lower-case letters become upper case
    wire [7:0] upper = (rx_data >= 8'h61 && rx_data <= 8'h7A) ? rx_data - 8'h20 : rx_data;

    // hold one byte while the transmitter is still busy with the previous one
    reg  [7:0] hold  = 0;
    reg        pend  = 1'b0;
    wire       start = pend && !busy;
    always @(posedge CLK100MHZ) begin
        if (rx_done) begin
            hold <= upper;
            pend <= 1'b1;
        end else if (start)
            pend <= 1'b0;
    end

    uart_tx tx_unit (.clk(CLK100MHZ), .start(start), .data(hold), .tx(UART_RXD_OUT), .busy(busy));

    reg [7:0] last  = 0;
    reg [7:0] count = 0;
    always @(posedge CLK100MHZ)
        if (rx_done) begin
            last  <= rx_data;
            count <= count + 1;
        end

    assign LED = {count, last};
endmodule
`,
    vhdl: `${VHDL_NUMERIC}
-- UART receiver (115200 baud, 8N1)
entity uart_rx is
    generic (CLKS_PER_BIT : integer := 868);
    port (
        clk  : in  std_logic;
        rx   : in  std_logic;
        data : out std_logic_vector(7 downto 0);
        done : out std_logic                     -- one-clock pulse: a byte arrived
    );
end uart_rx;

architecture rtl of uart_rx is
    type state_t is (IDLE, START_BIT, DATA_BITS, STOP_BIT);
    constant HALF : integer := CLKS_PER_BIT / 2;
    signal state    : state_t := IDLE;
    signal cnt      : unsigned(15 downto 0) := (others => '0');
    signal n        : unsigned(2 downto 0) := (others => '0');
    signal sh       : std_logic_vector(7 downto 0) := (others => '0');
    signal rx1, rx2 : std_logic := '1';           -- two-flip-flop synchronizer
    signal dout     : std_logic_vector(7 downto 0) := (others => '0');
    signal dn       : std_logic := '0';
begin
    process(clk)
    begin
        if rising_edge(clk) then
            rx1 <= rx;
            rx2 <= rx1;
            dn  <= '0';
            case state is
                when IDLE =>
                    if rx2 = '0' then
                        cnt   <= (others => '0');
                        state <= START_BIT;
                    end if;
                when START_BIT =>                   -- wait for the middle of the start bit
                    if cnt = HALF - 1 then
                        cnt <= (others => '0');
                        if rx2 = '0' then
                            n     <= (others => '0');
                            state <= DATA_BITS;
                        else
                            state <= IDLE;          -- just a glitch
                        end if;
                    else
                        cnt <= cnt + 1;
                    end if;
                when DATA_BITS =>                   -- sample the middle of each data bit
                    if cnt = CLKS_PER_BIT - 1 then
                        cnt <= (others => '0');
                        sh  <= rx2 & sh(7 downto 1);   -- LSB arrives first
                        if n = 7 then
                            state <= STOP_BIT;
                        else
                            n <= n + 1;
                        end if;
                    else
                        cnt <= cnt + 1;
                    end if;
                when STOP_BIT =>                    -- middle of the stop bit
                    if cnt = CLKS_PER_BIT - 1 then
                        cnt   <= (others => '0');
                        dout  <= sh;
                        dn    <= '1';
                        state <= IDLE;
                    else
                        cnt <= cnt + 1;
                    end if;
            end case;
        end if;
    end process;

    data <= dout;
    done <= dn;
end rtl;

${VHDL_NUMERIC}
${UART_TX_VHDL}
${VHDL_NUMERIC}
-- echo: letters typed in the serial console come back in upper case
entity top is
    port (
        CLK100MHZ    : in  std_logic;
        UART_TXD_IN  : in  std_logic;                     -- PC -> FPGA
        UART_RXD_OUT : out std_logic;                     -- FPGA -> PC
        LED          : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal rx_data, upper, hold : std_logic_vector(7 downto 0) := (others => '0');
    signal rx_done, busy, start : std_logic;
    signal pend                 : std_logic := '0';
    signal last, count          : unsigned(7 downto 0) := (others => '0');
begin
    rx_unit : entity work.uart_rx port map (clk => CLK100MHZ, rx => UART_TXD_IN, data => rx_data, done => rx_done);

    -- lower-case letters become upper case
    upper <= std_logic_vector(unsigned(rx_data) - 32) when unsigned(rx_data) >= 97 and unsigned(rx_data) <= 122 else rx_data;

    -- hold one byte while the transmitter is still busy with the previous one
    start <= pend and not busy;
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if rx_done = '1' then
                hold  <= upper;
                pend  <= '1';
                last  <= unsigned(rx_data);
                count <= count + 1;
            elsif start = '1' then
                pend <= '0';
            end if;
        end if;
    end process;

    tx_unit : entity work.uart_tx port map (clk => CLK100MHZ, start => start, data => hold, tx => UART_RXD_OUT, busy => busy);

    LED <= std_logic_vector(count) & std_logic_vector(last);
end rtl;
`,
    xdc: { clk: true, led: true, uart: true },
    tryIt: `<p>طرح را اجرا کنید و <b>کنسول سریال</b> را باز کنید (دکمه <span class="kbd">⌨ Serial Console</span> یا Ctrl+M). سرعت باید 115200 و قالب 8N1 باشد. یک متن تایپ کنید و Enter بزنید: FPGA آن را با حروف بزرگ برمی‌گرداند. می‌توانید روی صفحه سیاه کنسول کلیک کنید و مستقیم تایپ کنید تا هر کلید فوراً فرستاده شود. LEDها کد ASCII آخرین حرف و تعداد حروف را نشان می‌دهند. Logic Analyzer هم برای این درس آماده است و هر دو خط را با دیکودر نشان می‌دهد.</p>`,
    exercise: `<p>سرعت کنسول را روی 9600 بگذارید ولی طرح را 115200 نگه دارید. چه چیزی برمی‌گردد و چرا؟ بعد <code>CLKS_PER_BIT</code> را برای 9600 درست کنید.</p>`,
    la: {
      chans: [
        { name: 'RX in', probe: 'pin:C4' },
        { name: 'TX out', probe: 'pin:D4' },
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
    id: 'spi',
    title: 'پروتکل SPI',
    summary: 'یک SPI master که با یک شیفت رجیستر ۸ بیتی صحبت می‌کند، روی Pmod JA و با Logic Analyzer.',
    body: `
<p><b>SPI</b> (Serial Peripheral Interface) یک پروتکل سریال <b>هم‌زمان</b> است: برخلاف UART، کلاک هم روی یک سیم جدا فرستاده می‌شود، پس سرعت دو طرف لازم نیست از قبل توافق شود. خیلی از سنسورها، حافظه‌های فلش، مبدل‌های ADC/DAC و نمایشگرها SPI دارند و بیشتر ماژول‌های Pmod هم SPI هستند.</p>
<h3>چهار سیم</h3>
${truth(
  ['سیگنال', 'جهت', 'کار', 'پایه'],
  [
    ['CS (فعال با صفر)', 'master → slave', 'انتخاب دستگاه؛ کل انتقال در حالت صفر انجام می‌شود', 'JA1'],
    ['MOSI', 'master → slave', 'داده از master به دستگاه', 'JA2'],
    ['MISO', 'slave → master', 'داده از دستگاه به master', 'JA3'],
    ['SCLK', 'master → slave', 'کلاک؛ اینجا 1MHz', 'JA4'],
  ],
)}
<h3>Mode 0</h3>
<p>در Mode 0 (CPOL=0، CPHA=0) کلاک در حالت بیکار صفر است. هر دو طرف روی <b>لبه بالارونده</b> SCLK نمونه برمی‌دارند و روی لبه پایین‌رونده بیت بعدی را می‌گذارند. اول پرارزش‌ترین بیت (MSB first) فرستاده می‌شود.</p>
<p>نکته جالب SPI این است که انتقال همیشه <b>دوطرفه</b> است: در هر کلاک یک بیت می‌رود و یک بیت برمی‌گردد. در این درس دستگاه یک شیفت رجیستر ۸ بیتی است، پس در هر انتقال بایت انتقال قبلی را پس می‌دهد (مقدار اولیه‌اش A5 است).</p>
<ul>
  <li>SW7..SW0: بایتی که فرستاده می‌شود؛ BTNC: یک بار ارسال؛ SW15: ارسال پشت‌سرهم (هر ۱۰۰µs)</li>
  <li>LD7..LD0: بایتی که master دریافت کرد؛ LD15..LD8: بایتی که دستگاه دریافت کرد</li>
</ul>`,
    verilog: `// SPI master (mode 0, MSB first) talking to an 8-bit shift-register slave, bus on Pmod JA
module spi_master #(parameter DIV = 50) (      // SCLK = 100 MHz / (2*DIV) = 1 MHz
    input  wire       clk,
    input  wire       start,                   // one-clock pulse: send \`tx\`
    input  wire [7:0] tx,
    input  wire       miso,
    output reg        cs_n = 1'b1,
    output reg        sclk = 1'b0,
    output reg        mosi = 1'b0,
    output reg  [7:0] rx = 0,                  // byte received from the slave
    output wire       busy
);
    localparam [1:0] IDLE = 2'd0, LEAD = 2'd1, XFER = 2'd2, TAIL = 2'd3;
    reg [1:0]  state = IDLE;
    reg [15:0] cnt   = 0;
    reg [2:0]  n     = 0;
    reg [7:0]  sh    = 0;      // bits still to send
    reg [7:0]  rsh   = 0;      // bits received so far
    wire       half  = (cnt == DIV - 1);

    always @(posedge clk) begin
        cnt <= (state == IDLE || half) ? 16'd0 : cnt + 1;
        case (state)
            IDLE:
                if (start) begin
                    cs_n  <= 1'b0;
                    sh    <= tx;
                    mosi  <= tx[7];            // first bit must be ready before the first rising edge
                    n     <= 0;
                    state <= LEAD;
                end
            LEAD:
                if (half) state <= XFER;
            XFER:
                if (half) begin
                    if (!sclk) begin           // rising edge: both sides sample
                        sclk <= 1'b1;
                        rsh  <= {rsh[6:0], miso};
                    end else begin             // falling edge: put out the next bit
                        sclk <= 1'b0;
                        if (n == 3'd7) state <= TAIL;
                        else begin
                            n    <= n + 1;
                            sh   <= {sh[6:0], 1'b0};
                            mosi <= sh[6];
                        end
                    end
                end
            default:                           // TAIL: hold CS a little, then release it
                if (half) begin
                    cs_n  <= 1'b1;
                    rx    <= rsh;
                    state <= IDLE;
                end
        endcase
    end

    assign busy = (state != IDLE);
endmodule

// A simple SPI device: an 8-bit shift register. It answers every transfer with the byte it received last time.
module spi_shift_slave (
    input  wire       clk,
    input  wire       cs_n,
    input  wire       sclk,
    input  wire       mosi,
    output wire       miso,
    output reg  [7:0] last = 0
);
    reg [7:0] sr     = 8'hA5;      // power-up contents
    reg       sclk_d = 1'b0;
    reg       cs_d   = 1'b1;
    always @(posedge clk) begin
        sclk_d <= sclk;
        cs_d   <= cs_n;
        if (!cs_n && sclk && !sclk_d)  // rising SCLK edge
            sr <= {sr[6:0], mosi};
        if (cs_n && !cs_d)             // end of a transfer
            last <= sr;
    end
    assign miso = sr[7];
endmodule

module top (
    input  wire        CLK100MHZ,
    input  wire        BTNC,           // send SW[7:0] once
    input  wire [15:0] SW,             // SW[15] = send every 100 us
    output wire [4:1]  JA,             // JA1 = CS, JA2 = MOSI, JA3 = MISO, JA4 = SCLK
    output wire [15:0] LED
);
    wire       cs_n, sclk, mosi, miso, busy;
    wire [7:0] rx, last;

    // start on a BTNC press, or every 100 us while SW[15] is on
    reg        btn_d = 1'b0;
    reg [13:0] timer = 0;
    always @(posedge CLK100MHZ) begin
        btn_d <= BTNC;
        timer <= (timer == 14'd9999) ? 14'd0 : timer + 1;
    end
    wire start = !busy && ((BTNC && !btn_d) || (SW[15] && timer == 14'd0));

    spi_master      master (.clk(CLK100MHZ), .start(start), .tx(SW[7:0]), .miso(miso),
                             .cs_n(cs_n), .sclk(sclk), .mosi(mosi), .rx(rx), .busy(busy));
    spi_shift_slave slave  (.clk(CLK100MHZ), .cs_n(cs_n), .sclk(sclk), .mosi(mosi), .miso(miso), .last(last));

    assign JA  = {sclk, miso, mosi, cs_n};
    assign LED = {last, rx};           // LD15..8: what the slave got, LD7..0: what the master got back
endmodule
`,
    vhdl: `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

-- SPI master (mode 0, MSB first)
entity spi_master is
    generic (DIV : integer := 50);                -- SCLK = 100 MHz / (2*DIV) = 1 MHz
    port (
        clk   : in  std_logic;
        start : in  std_logic;                    -- one-clock pulse: send tx
        tx    : in  std_logic_vector(7 downto 0);
        miso  : in  std_logic;
        cs_n  : out std_logic;
        sclk  : out std_logic;
        mosi  : out std_logic;
        rx    : out std_logic_vector(7 downto 0); -- byte received from the slave
        busy  : out std_logic
    );
end spi_master;

architecture rtl of spi_master is
    type state_t is (IDLE, LEAD, XFER, TAIL);
    signal state          : state_t := IDLE;
    signal cnt            : unsigned(15 downto 0) := (others => '0');
    signal n              : unsigned(2 downto 0) := (others => '0');
    signal sh, rsh, rxr   : std_logic_vector(7 downto 0) := (others => '0');
    signal csr            : std_logic := '1';
    signal sclkr, mosir   : std_logic := '0';
    signal half           : std_logic;
begin
    half <= '1' when cnt = DIV - 1 else '0';

    process(clk)
    begin
        if rising_edge(clk) then
            if state = IDLE or half = '1' then
                cnt <= (others => '0');
            else
                cnt <= cnt + 1;
            end if;
            case state is
                when IDLE =>
                    if start = '1' then
                        csr   <= '0';
                        sh    <= tx;
                        mosir <= tx(7);          -- first bit must be ready before the first rising edge
                        n     <= (others => '0');
                        state <= LEAD;
                    end if;
                when LEAD =>
                    if half = '1' then
                        state <= XFER;
                    end if;
                when XFER =>
                    if half = '1' then
                        if sclkr = '0' then      -- rising edge: both sides sample
                            sclkr <= '1';
                            rsh   <= rsh(6 downto 0) & miso;
                        else                     -- falling edge: put out the next bit
                            sclkr <= '0';
                            if n = 7 then
                                state <= TAIL;
                            else
                                n     <= n + 1;
                                sh    <= sh(6 downto 0) & '0';
                                mosir <= sh(6);
                            end if;
                        end if;
                    end if;
                when TAIL =>                     -- hold CS a little, then release it
                    if half = '1' then
                        csr   <= '1';
                        rxr   <= rsh;
                        state <= IDLE;
                    end if;
            end case;
        end if;
    end process;

    cs_n <= csr;
    sclk <= sclkr;
    mosi <= mosir;
    rx   <= rxr;
    busy <= '0' when state = IDLE else '1';
end rtl;

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

-- A simple SPI device: an 8-bit shift register. It answers every transfer with the byte it received last time.
entity spi_shift_slave is
    port (
        clk  : in  std_logic;
        cs_n : in  std_logic;
        sclk : in  std_logic;
        mosi : in  std_logic;
        miso : out std_logic;
        last : out std_logic_vector(7 downto 0)
    );
end spi_shift_slave;

architecture rtl of spi_shift_slave is
    signal sr     : std_logic_vector(7 downto 0) := x"A5";   -- power-up contents
    signal lastr  : std_logic_vector(7 downto 0) := (others => '0');
    signal sclk_d : std_logic := '0';
    signal cs_d   : std_logic := '1';
begin
    process(clk)
    begin
        if rising_edge(clk) then
            sclk_d <= sclk;
            cs_d   <= cs_n;
            if cs_n = '0' and sclk = '1' and sclk_d = '0' then   -- rising SCLK edge
                sr <= sr(6 downto 0) & mosi;
            end if;
            if cs_n = '1' and cs_d = '0' then                    -- end of a transfer
                lastr <= sr;
            end if;
        end if;
    end process;

    miso <= sr(7);
    last <= lastr;
end rtl;

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity top is
    port (
        CLK100MHZ : in  std_logic;
        BTNC      : in  std_logic;                      -- send SW(7 downto 0) once
        SW        : in  std_logic_vector(15 downto 0);  -- SW(15) = send every 100 us
        JA        : out std_logic_vector(4 downto 1);   -- JA1 = CS, JA2 = MOSI, JA3 = MISO, JA4 = SCLK
        LED       : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal cs_n, sclk, mosi, miso, busy, start : std_logic;
    signal rx, last : std_logic_vector(7 downto 0);
    signal btn_d    : std_logic := '0';
    signal timer    : unsigned(13 downto 0) := (others => '0');
begin
    -- start on a BTNC press, or every 100 us while SW(15) is on
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            btn_d <= BTNC;
            if timer = 9999 then
                timer <= (others => '0');
            else
                timer <= timer + 1;
            end if;
        end if;
    end process;
    start <= '1' when busy = '0' and ((BTNC = '1' and btn_d = '0') or (SW(15) = '1' and timer = 0)) else '0';

    master : entity work.spi_master
        port map (clk => CLK100MHZ, start => start, tx => SW(7 downto 0), miso => miso,
                  cs_n => cs_n, sclk => sclk, mosi => mosi, rx => rx, busy => busy);
    slave : entity work.spi_shift_slave
        port map (clk => CLK100MHZ, cs_n => cs_n, sclk => sclk, mosi => mosi, miso => miso, last => last);

    JA  <= sclk & miso & mosi & cs_n;
    LED <= last & rx;              -- LD15..8: what the slave got, LD7..0: what the master got back
end rtl;
`,
    xdc: { clk: true, sw: true, led: true, btn: true, pmod: true },
    tryIt: `<p>طرح را اجرا کنید و Logic Analyzer را باز کنید؛ چهار کانال روی JA1 تا JA4 و دیکودر SPI از قبل آماده‌اند و روی سیم‌های پراب روی برد سه‌بعدی هم دیده می‌شوند. در پنجره Logic Analyzer دکمه <b>Run</b> را بزنید، با SW7..SW0 یک بایت بسازید و BTNC را فشار دهید. در ردیف MOSI بایت شما و در ردیف MISO بایت قبلی دیده می‌شود. با دو نشانگر فرکانس SCLK را اندازه بگیرید.</p>`,
    exercise: `<p>مقدار <code>DIV</code> را کم کنید تا SCLK به 10MHz برسد و در Logic Analyzer ببینید. بعد Mode 3 (CPOL=1) را پیاده کنید و تنظیم دیکودر را هم عوض کنید.</p>`,
    la: {
      chans: [
        { name: 'CS', probe: 'pin:C17' },
        { name: 'MOSI', probe: 'pin:D18' },
        { name: 'MISO', probe: 'pin:E18' },
        { name: 'SCLK', probe: 'pin:G17' },
      ],
      decs: [{ type: 'spi', name: 'SPI', clk: 3, mosi: 1, miso: 2, cs: 0, mode: 0, bits: 8, msbFirst: true }],
      base: 1e-6,
      pos: 4,
      trig: { ch: 0, edge: 'fall' },
    },
  },
  {
    id: 'i2c',
    title: 'پروتکل I²C',
    summary: 'نوشتن و خواندن یک رجیستر در یک سنسور شبیه‌سازی‌شده با آدرس 0x48، روی Pmod JB.',
    body: `
<p><b>I²C</b> فقط <b>دو سیم</b> دارد و چند دستگاه روی همان دو سیم با <b>آدرس</b> ۷ بیتی از هم جدا می‌شوند. سنسورهای دما، شتاب‌سنج‌ها، EEPROMها و ساعت‌های RTC معمولاً I²C هستند.</p>
<h3>Open-drain</h3>
<p>هیچ‌کس خط را به 1 «هل» نمی‌دهد: هر دستگاه فقط می‌تواند خط را به صفر بکشد یا رها کند و یک مقاومت pull-up آن را به 1 برمی‌گرداند. پس خط برابر است با AND همه دستگاه‌ها: <code>sda = !(m_low || d_low)</code>. به همین دلیل master و دستگاه می‌توانند نوبتی روی یک سیم حرف بزنند.</p>
<h3>قاب I²C</h3>
<ul>
  <li><b>START</b>: SDA در حالی که SCL یک است صفر می‌شود. <b>STOP</b>: SDA در حالی که SCL یک است یک می‌شود. در بقیه زمان SDA فقط وقتی SCL صفر است عوض می‌شود.</li>
  <li>بایت اول: آدرس ۷ بیتی + بیت R/W (0 = نوشتن، 1 = خواندن)</li>
  <li>بعد از هر بایت گیرنده یک بیت <b>ACK</b> (صفر) می‌فرستد. اگر کسی جواب ندهد خط 1 می‌ماند: <b>NAK</b>.</li>
</ul>
<h3>این درس</h3>
<p>master یک برنامه کوچک اجرا می‌کند: <code>S, 0x48+W, 0x01, data, P, S, 0x48+R, read, P</code>؛ یعنی مقدار کلیدها را در رجیستر دستگاه می‌نویسد و بعد دوباره می‌خواند. SCL با سرعت استاندارد 100kHz است.</p>
<ul>
  <li>SW7..SW0: داده؛ BTNC: یک تراکنش؛ SW15: تکرار هر ۱ms؛ SW14: آدرس اشتباه (0x49) برای دیدن NAK</li>
  <li>LD7..LD0: بایتی که از دستگاه خوانده شد؛ LD15: دستگاه جواب نداد</li>
</ul>`,
    verilog: `// I2C master writing to and reading back from a simulated sensor at address 0x48, bus on Pmod JB
module i2c_master #(parameter Q = 250) (       // a quarter of an SCL period: 100 kHz
    input  wire       clk,
    input  wire       go,                      // one-clock pulse: run the transaction
    input  wire [6:0] addr,
    input  wire [7:0] wdata,
    input  wire       sda_in,                  // the bus as it really is
    output reg        scl = 1'b1,
    output reg        sda_low = 1'b0,          // open drain: 1 pulls SDA low, 0 releases it
    output reg  [7:0] rdata = 0,
    output reg        nack = 1'b0,             // the device did not answer
    output reg        busy = 1'b0
);
    // the transaction as a small program:
    // START, addr+W, 0x01 (register), wdata, STOP, START, addr+R, read one byte, STOP
    localparam [2:0] OP_START = 3'd0, OP_WRITE = 3'd1, OP_READ = 3'd2, OP_STOP = 3'd3, OP_END = 3'd4;
    reg [3:0] pc = 0;
    reg [2:0] op;
    reg [7:0] obyte;
    always @(*) begin
        obyte = 8'h00;
        case (pc)
            4'd0:    op = OP_START;
            4'd1:    begin op = OP_WRITE; obyte = {addr, 1'b0}; end
            4'd2:    begin op = OP_WRITE; obyte = 8'h01; end
            4'd3:    begin op = OP_WRITE; obyte = wdata; end
            4'd4:    op = OP_STOP;
            4'd5:    op = OP_START;
            4'd6:    begin op = OP_WRITE; obyte = {addr, 1'b1}; end
            4'd7:    op = OP_READ;
            4'd8:    op = OP_STOP;
            default: op = OP_END;
        endcase
    end

    reg [15:0] cnt  = 0;
    reg [1:0]  ph   = 0;       // quarter of the current bit
    reg [3:0]  bitn = 0;       // 0..7 data, 8 = acknowledge
    reg [7:0]  sh   = 0;

    always @(posedge clk) begin
        if (!busy) begin
            scl     <= 1'b1;
            sda_low <= 1'b0;
            if (go) begin
                busy <= 1'b1;
                pc   <= 0;
                ph   <= 0;
                bitn <= 0;
                cnt  <= 0;
                nack <= 1'b0;
            end
        end else if (cnt != Q - 1) begin
            cnt <= cnt + 1;
        end else begin
            cnt <= 0;
            ph  <= ph + 1;
            case (op)
                OP_START:                      // SDA falls while SCL is high
                    case (ph)
                        2'd0: begin sda_low <= 1'b0; scl <= 1'b1; end
                        2'd1: sda_low <= 1'b1;
                        2'd2: scl <= 1'b0;
                        default: pc <= pc + 1;
                    endcase
                OP_WRITE, OP_READ:
                    case (ph)
                        2'd0:                  // SCL low: change SDA
                            if (op == OP_WRITE && bitn < 8) sda_low <= ~obyte[7 - bitn];
                            else                            sda_low <= 1'b0;   // release (ACK slot, read, NACK)
                        2'd1: scl <= 1'b1;
                        2'd2:                  // middle of SCL high: sample
                            if (op == OP_READ && bitn < 8) sh <= {sh[6:0], sda_in};
                            else if (op == OP_WRITE && bitn == 8 && sda_in) nack <= 1'b1;
                        default: begin
                            scl <= 1'b0;
                            if (bitn == 8) begin
                                bitn <= 0;
                                if (op == OP_READ) rdata <= sh;
                                pc <= (nack && op == OP_WRITE) ? 4'd8 : pc + 1;   // no answer: stop
                            end else
                                bitn <= bitn + 1;
                        end
                    endcase
                OP_STOP:                       // SDA rises while SCL is high
                    case (ph)
                        2'd0: sda_low <= 1'b1;
                        2'd1: scl <= 1'b1;
                        2'd2: sda_low <= 1'b0;
                        default: pc <= pc + 1;
                    endcase
                default:
                    busy <= 1'b0;
            endcase
        end
    end
endmodule

// A simulated I2C device with one data register (like a small sensor or EEPROM).
module i2c_device #(parameter [6:0] ADDR = 7'h48) (
    input  wire       clk,
    input  wire       scl,
    input  wire       sda,
    output reg        sda_low = 1'b0,
    output reg  [7:0] data = 8'h00
);
    reg       scl_d = 1'b1, sda_d = 1'b1;
    wire      rise  = scl && !scl_d;
    wire      fall  = !scl && scl_d;
    wire      start = scl && scl_d && sda_d && !sda;
    wire      stop  = scl && scl_d && !sda_d && sda;
    reg       active = 1'b0;
    reg [3:0] bitn   = 0;
    reg [1:0] byten  = 0;
    reg       rw     = 1'b0;
    reg [7:0] sh     = 0;
    reg [7:0] tsh    = 0;      // byte being sent back
    reg       clocked = 1'b0;  // an SCL rise since the last fall (the fall right after START is not a bit)

    always @(posedge clk) begin
        scl_d <= scl;
        sda_d <= sda;
        if (start) begin
            active  <= 1'b1;
            clocked <= 1'b0;
            rw      <= 1'b0;
            bitn    <= 0;
            byten   <= 0;
            sda_low <= 1'b0;
        end else if (stop) begin
            active  <= 1'b0;
            sda_low <= 1'b0;
        end else if (active) begin
            if (rise) begin
                clocked <= 1'b1;
                if (bitn < 8) sh <= {sh[6:0], sda};
                if (bitn == 8 && rw && byten != 0 && sda) active <= 1'b0;   // master said NACK: stop sending
            end
            if (fall && clocked) begin
                clocked <= 1'b0;
                if (bitn == 7) begin           // a byte is complete: acknowledge it?
                    bitn <= 8;
                    if (byten == 0) begin
                        rw      <= sh[0];
                        sda_low <= (sh[7:1] == ADDR);
                        if (sh[7:1] != ADDR) active <= 1'b0;   // not for us
                    end else if (!rw) begin
                        if (byten >= 2) data <= sh;
                        sda_low <= 1'b1;
                    end else
                        sda_low <= 1'b0;       // reading: the master acknowledges
                end else if (bitn == 8) begin  // acknowledge done: next byte
                    bitn  <= 0;
                    byten <= (byten == 2'd3) ? byten : byten + 1;
                    if (rw) begin
                        tsh     <= {data[6:0], 1'b0};
                        sda_low <= ~data[7];
                    end else
                        sda_low <= 1'b0;
                end else begin
                    bitn <= bitn + 1;
                    if (rw) begin
                        sda_low <= ~tsh[7];
                        tsh     <= {tsh[6:0], 1'b0};
                    end
                end
            end
        end
    end
endmodule

module top (
    input  wire        CLK100MHZ,
    input  wire        BTNC,           // run one transaction
    input  wire [15:0] SW,             // SW[7:0] = data, SW[14] = wrong address, SW[15] = repeat every 1 ms
    output wire [4:3]  JB,             // JB3 = SCL, JB4 = SDA
    output wire [15:0] LED
);
    wire       scl, m_low, d_low, nack, busy;
    wire [7:0] rdata, stored;
    wire       sda = !(m_low || d_low);     // open-drain bus with a pull-up

    reg        btn_d = 1'b0;
    reg [16:0] timer = 0;
    always @(posedge CLK100MHZ) begin
        btn_d <= BTNC;
        timer <= (timer == 17'd99999) ? 17'd0 : timer + 1;
    end
    wire go = !busy && ((BTNC && !btn_d) || (SW[15] && timer == 17'd0));

    i2c_master master (.clk(CLK100MHZ), .go(go), .addr(SW[14] ? 7'h49 : 7'h48), .wdata(SW[7:0]), .sda_in(sda),
                       .scl(scl), .sda_low(m_low), .rdata(rdata), .nack(nack), .busy(busy));
    i2c_device #(.ADDR(7'h48)) sensor (.clk(CLK100MHZ), .scl(scl), .sda(sda), .sda_low(d_low), .data(stored));

    assign JB  = {sda, scl};
    assign LED = {nack, 7'b0000000, rdata};   // LD15 = no answer, LD7..0 = byte read back
endmodule
`,
    vhdl: `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

-- I2C master: START, addr+W, 0x01 (register), wdata, STOP, START, addr+R, read one byte, STOP
entity i2c_master is
    generic (Q : integer := 250);                 -- a quarter of an SCL period: 100 kHz
    port (
        clk     : in  std_logic;
        go      : in  std_logic;                  -- one-clock pulse: run the transaction
        addr    : in  std_logic_vector(6 downto 0);
        wdata   : in  std_logic_vector(7 downto 0);
        sda_in  : in  std_logic;                  -- the bus as it really is
        scl     : out std_logic;
        sda_low : out std_logic;                  -- open drain: '1' pulls SDA low, '0' releases it
        rdata   : out std_logic_vector(7 downto 0);
        nack    : out std_logic;                  -- the device did not answer
        busy    : out std_logic
    );
end i2c_master;

architecture rtl of i2c_master is
    type op_t is (OP_START, OP_WRITE, OP_READ, OP_STOP, OP_END);
    signal op     : op_t;
    signal obyte  : std_logic_vector(7 downto 0);
    signal pc     : unsigned(3 downto 0) := (others => '0');
    signal cnt    : unsigned(15 downto 0) := (others => '0');
    signal ph     : unsigned(1 downto 0) := (others => '0');   -- quarter of the current bit
    signal bitn   : unsigned(3 downto 0) := (others => '0');   -- 0..7 data, 8 = acknowledge
    signal sh, rd : std_logic_vector(7 downto 0) := (others => '0');
    signal sclr   : std_logic := '1';
    signal low    : std_logic := '0';
    signal nk, bz : std_logic := '0';
begin
    -- the transaction as a small program
    process(pc, addr, wdata)
    begin
        obyte <= x"00";
        case pc is
            when "0000" => op <= OP_START;
            when "0001" => op <= OP_WRITE; obyte <= addr & '0';
            when "0010" => op <= OP_WRITE; obyte <= x"01";
            when "0011" => op <= OP_WRITE; obyte <= wdata;
            when "0100" => op <= OP_STOP;
            when "0101" => op <= OP_START;
            when "0110" => op <= OP_WRITE; obyte <= addr & '1';
            when "0111" => op <= OP_READ;
            when "1000" => op <= OP_STOP;
            when others => op <= OP_END;
        end case;
    end process;

    process(clk)
    begin
        if rising_edge(clk) then
            if bz = '0' then
                sclr <= '1';
                low  <= '0';
                if go = '1' then
                    bz   <= '1';
                    pc   <= (others => '0');
                    ph   <= (others => '0');
                    bitn <= (others => '0');
                    cnt  <= (others => '0');
                    nk   <= '0';
                end if;
            elsif cnt /= Q - 1 then
                cnt <= cnt + 1;
            else
                cnt <= (others => '0');
                ph  <= ph + 1;
                case op is
                    when OP_START =>                     -- SDA falls while SCL is high
                        case ph is
                            when "00" => low <= '0'; sclr <= '1';
                            when "01" => low <= '1';
                            when "10" => sclr <= '0';
                            when others => pc <= pc + 1;
                        end case;
                    when OP_WRITE | OP_READ =>
                        case ph is
                            when "00" =>                 -- SCL low: change SDA
                                if op = OP_WRITE and bitn < 8 then
                                    low <= not obyte(7 - to_integer(bitn));
                                else
                                    low <= '0';          -- release (ACK slot, read, NACK)
                                end if;
                            when "01" => sclr <= '1';
                            when "10" =>                 -- middle of SCL high: sample
                                if op = OP_READ and bitn < 8 then
                                    sh <= sh(6 downto 0) & sda_in;
                                elsif op = OP_WRITE and bitn = 8 and sda_in = '1' then
                                    nk <= '1';
                                end if;
                            when others =>
                                sclr <= '0';
                                if bitn = 8 then
                                    bitn <= (others => '0');
                                    if op = OP_READ then
                                        rd <= sh;
                                    end if;
                                    if nk = '1' and op = OP_WRITE then
                                        pc <= to_unsigned(8, 4);   -- no answer: stop
                                    else
                                        pc <= pc + 1;
                                    end if;
                                else
                                    bitn <= bitn + 1;
                                end if;
                        end case;
                    when OP_STOP =>                      -- SDA rises while SCL is high
                        case ph is
                            when "00" => low <= '1';
                            when "01" => sclr <= '1';
                            when "10" => low <= '0';
                            when others => pc <= pc + 1;
                        end case;
                    when OP_END =>
                        bz <= '0';
                end case;
            end if;
        end if;
    end process;

    scl     <= sclr;
    sda_low <= low;
    rdata   <= rd;
    nack    <= nk;
    busy    <= bz;
end rtl;

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

-- A simulated I2C device with one data register (like a small sensor or EEPROM).
entity i2c_device is
    generic (ADDR : std_logic_vector(6 downto 0) := "1001000");   -- 0x48
    port (
        clk     : in  std_logic;
        scl     : in  std_logic;
        sda     : in  std_logic;
        sda_low : out std_logic;
        data    : out std_logic_vector(7 downto 0)
    );
end i2c_device;

architecture rtl of i2c_device is
    signal scl_d, sda_d        : std_logic := '1';
    signal rise, fall          : std_logic;
    signal start, stop         : std_logic;
    signal active, rw, clocked : std_logic := '0';
    signal low                 : std_logic := '0';
    signal bitn                : unsigned(3 downto 0) := (others => '0');
    signal byten               : unsigned(1 downto 0) := (others => '0');
    signal sh, tsh, reg        : std_logic_vector(7 downto 0) := (others => '0');
begin
    rise  <= scl and not scl_d;
    fall  <= scl_d and not scl;
    start <= scl and scl_d and sda_d and not sda;
    stop  <= scl and scl_d and sda and not sda_d;

    process(clk)
    begin
        if rising_edge(clk) then
            scl_d <= scl;
            sda_d <= sda;
            if start = '1' then
                active  <= '1';
                clocked <= '0';
                rw      <= '0';
                bitn    <= (others => '0');
                byten   <= (others => '0');
                low     <= '0';
            elsif stop = '1' then
                active <= '0';
                low    <= '0';
            elsif active = '1' then
                if rise = '1' then
                    clocked <= '1';
                    if bitn < 8 then
                        sh <= sh(6 downto 0) & sda;
                    end if;
                    if bitn = 8 and rw = '1' and byten /= 0 and sda = '1' then
                        active <= '0';                   -- master said NACK: stop sending
                    end if;
                end if;
                if fall = '1' and clocked = '1' then     -- the fall right after START is not a bit
                    clocked <= '0';
                    if bitn = 7 then                     -- a byte is complete: acknowledge it?
                        bitn <= to_unsigned(8, 4);
                        if byten = 0 then
                            rw <= sh(0);
                            if sh(7 downto 1) = ADDR then
                                low <= '1';
                            else
                                low    <= '0';
                                active <= '0';           -- not for us
                            end if;
                        elsif rw = '0' then
                            if byten >= 2 then
                                reg <= sh;
                            end if;
                            low <= '1';
                        else
                            low <= '0';                  -- reading: the master acknowledges
                        end if;
                    elsif bitn = 8 then                  -- acknowledge done: next byte
                        bitn <= (others => '0');
                        if byten /= 3 then
                            byten <= byten + 1;
                        end if;
                        if rw = '1' then
                            tsh <= reg(6 downto 0) & '0';
                            low <= not reg(7);
                        else
                            low <= '0';
                        end if;
                    else
                        bitn <= bitn + 1;
                        if rw = '1' then
                            low <= not tsh(7);
                            tsh <= tsh(6 downto 0) & '0';
                        end if;
                    end if;
                end if;
            end if;
        end if;
    end process;

    sda_low <= low;
    data    <= reg;
end rtl;

library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity top is
    port (
        CLK100MHZ : in  std_logic;
        BTNC      : in  std_logic;                      -- run one transaction
        SW        : in  std_logic_vector(15 downto 0);  -- SW(7..0) = data, SW(14) = wrong address, SW(15) = repeat
        JB        : out std_logic_vector(4 downto 3);   -- JB3 = SCL, JB4 = SDA
        LED       : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal scl, sda, m_low, d_low, nack, busy, go : std_logic;
    signal rdata, stored : std_logic_vector(7 downto 0);
    signal addr          : std_logic_vector(6 downto 0);
    signal btn_d         : std_logic := '0';
    signal timer         : unsigned(16 downto 0) := (others => '0');
begin
    sda <= not (m_low or d_low);            -- open-drain bus with a pull-up

    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            btn_d <= BTNC;
            if timer = 99999 then
                timer <= (others => '0');
            else
                timer <= timer + 1;
            end if;
        end if;
    end process;
    go   <= '1' when busy = '0' and ((BTNC = '1' and btn_d = '0') or (SW(15) = '1' and timer = 0)) else '0';
    addr <= "1001001" when SW(14) = '1' else "1001000";   -- 0x49 (nobody) or 0x48

    master : entity work.i2c_master
        port map (clk => CLK100MHZ, go => go, addr => addr, wdata => SW(7 downto 0), sda_in => sda,
                  scl => scl, sda_low => m_low, rdata => rdata, nack => nack, busy => busy);
    sensor : entity work.i2c_device
        generic map (ADDR => "1001000")
        port map (clk => CLK100MHZ, scl => scl, sda => sda, sda_low => d_low, data => stored);

    JB  <= sda & scl;
    LED <= nack & "0000000" & rdata;        -- LD15 = no answer, LD7..0 = byte read back
end rtl;
`,
    xdc: { clk: true, sw: true, led: true, btn: true, pmod: true },
    tryIt: `<p>طرح را اجرا کنید، Logic Analyzer را باز کنید و <b>Run</b> را بزنید. با SW7..SW0 یک عدد بسازید و BTNC را بزنید: دیکودر I²C شروع و پایان، آدرس، ACKها و داده را نشان می‌دهد و همان عدد روی LD7..LD0 برمی‌گردد. حالا SW14 را روشن کنید و دوباره BTNC را بزنید: این بار دستگاهی جواب نمی‌دهد و <b>NAK</b> و LD15 را می‌بینید.</p>`,
    exercise: `<p>یک دستگاه دوم با آدرس 0x49 به همان دو سیم وصل کنید (یک نمونه دیگر از <code>i2c_device</code> و OR کردن <code>sda_low</code>ها). حالا SW14 باید دستگاه دوم را انتخاب کند.</p>`,
    la: {
      chans: [
        { name: 'SCL', probe: 'pin:G16' },
        { name: 'SDA', probe: 'pin:H14' },
      ],
      decs: [{ type: 'i2c', name: 'I2C', scl: 0, sda: 1 }],
      base: 1e-4,
      pos: 4,
      trig: { ch: 1, edge: 'fall' },
    },
  },
];
