// Lesson: a PS/2 keyboard receiver. The Nexys A7's USB HID host turns a USB keyboard into a PS/2 device.
import { HEX7SEG_V, HEX7SEG_VHDL } from './advanced';
import { VHDL_NUMERIC, type Lesson } from './lessons';

const PS2_V = `// PS/2 receiver: one byte (scan code) per 11-bit frame, read on the falling edge of the keyboard's clock
module ps2_rx (
    input  wire       clk,
    input  wire       ps2_clk,
    input  wire       ps2_data,
    output reg  [7:0] code = 0,     // the last byte
    output reg        done = 1'b0,  // one-clock pulse when a byte has arrived
    output reg        err  = 1'b0   // start, parity or stop bit of the last byte was wrong
);
    // the keyboard's clock is slow and may be noisy: synchronise it and accept a level after 8 equal samples
    reg [7:0]  filt  = 8'hFF;
    reg        kclk  = 1'b1;
    reg        prev  = 1'b1;
    reg [1:0]  dsync = 2'b11;
    always @(posedge clk) begin
        filt  <= {filt[6:0], ps2_clk};
        dsync <= {dsync[0], ps2_data};
        if (filt == 8'hFF)      kclk <= 1'b1;
        else if (filt == 8'h00) kclk <= 1'b0;
        prev <= kclk;
    end
    wire fall = prev & ~kclk;

    reg [3:0]  n    = 0;     // bits received so far
    reg [10:0] sh   = 0;     // bits arrive LSB first: shift them in from the top
    reg [16:0] idle = 0;     // no clock edge for 1.3 ms: start again with a new frame
    wire [10:0] frame = {dsync[1], sh[10:1]};   // the frame including the bit arriving now

    always @(posedge clk) begin
        done <= 1'b0;
        if (fall) begin
            idle <= 0;
            sh   <= frame;
            if (n == 4'd10) begin
                n    <= 0;
                code <= frame[8:1];
                // start 0, odd parity over data and parity bit, stop 1
                err  <= frame[0] | ~(^frame[9:1]) | ~frame[10];
                done <= 1'b1;
            end else
                n <= n + 1;
        end else if (idle != 17'h1FFFF)
            idle <= idle + 1;
        else
            n <= 0;
    end
endmodule

${HEX7SEG_V}
module top (
    input  wire        CLK100MHZ,
    input  wire        PS2_CLK,
    input  wire        PS2_DATA,
    output wire [15:0] LED,
    output wire CA, CB, CC, CD, CE, CF, CG, DP,
    output reg  [7:0]  AN
);
    wire [7:0] code;
    wire       done, err;
    ps2_rx rx (.clk(CLK100MHZ), .ps2_clk(PS2_CLK), .ps2_data(PS2_DATA), .code(code), .done(done), .err(err));

    // the last two bytes, and whether a key is held down (F0 = the next code is a release)
    reg [7:0] last = 0, before = 0;
    reg       brk  = 1'b0;
    reg       held = 1'b0;
    always @(posedge CLK100MHZ)
        if (done) begin
            before <= last;
            last   <= code;
            if (code == 8'hF0)
                brk <= 1'b1;
            else if (code != 8'hE0) begin    // E0 only marks an extended key
                held <= ~brk;
                brk  <= 1'b0;
            end
        end

    assign LED = {err, held, 6'b0, last};

    // four hex digits: the byte before and the last byte
    wire [15:0] show = {before, last};
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
            2'd0:    nibble = show[3:0];
            2'd1:    nibble = show[7:4];
            2'd2:    nibble = show[11:8];
            default: nibble = show[15:12];
        endcase
    end

    hex7seg decoder (.x(nibble), .seg(seg));
    assign {CG, CF, CE, CD, CC, CB, CA} = seg;
    assign DP = 1'b1;
endmodule
`;

const PS2_VHDL = `${VHDL_NUMERIC}
-- PS/2 receiver: one byte (scan code) per 11-bit frame, read on the falling edge of the keyboard's clock
entity ps2_rx is
    port (
        clk      : in  std_logic;
        ps2_clk  : in  std_logic;
        ps2_data : in  std_logic;
        code     : out std_logic_vector(7 downto 0);  -- the last byte
        done     : out std_logic;                     -- one-clock pulse when a byte has arrived
        err      : out std_logic                      -- start, parity or stop bit of the last byte was wrong
    );
end ps2_rx;

architecture rtl of ps2_rx is
    signal filt  : std_logic_vector(7 downto 0) := (others => '1');
    signal kclk  : std_logic := '1';
    signal prev  : std_logic := '1';
    signal dsync : std_logic_vector(1 downto 0) := "11";
    signal fall  : std_logic;
    signal n     : unsigned(3 downto 0) := (others => '0');   -- bits received so far
    signal sh    : std_logic_vector(10 downto 0) := (others => '0');
    signal frame : std_logic_vector(10 downto 0);
    signal idle  : unsigned(16 downto 0) := (others => '0');  -- no clock edge for 1.3 ms: new frame
    signal code_r : std_logic_vector(7 downto 0) := (others => '0');
    signal done_r : std_logic := '0';
    signal err_r  : std_logic := '0';
begin
    -- the keyboard's clock is slow and may be noisy: synchronise it and accept a level after 8 equal samples
    process(clk)
    begin
        if rising_edge(clk) then
            filt  <= filt(6 downto 0) & ps2_clk;
            dsync <= dsync(0) & ps2_data;
            if filt = x"FF" then
                kclk <= '1';
            elsif filt = x"00" then
                kclk <= '0';
            end if;
            prev <= kclk;
        end if;
    end process;
    fall  <= prev and not kclk;
    frame <= dsync(1) & sh(10 downto 1);   -- bits arrive LSB first: shift them in from the top

    process(clk)
    begin
        if rising_edge(clk) then
            done_r <= '0';
            if fall = '1' then
                idle <= (others => '0');
                sh   <= frame;
                if n = 10 then
                    n      <= (others => '0');
                    code_r <= frame(8 downto 1);
                    -- start 0, odd parity over data and parity bit, stop 1
                    err_r  <= frame(0) or not (frame(9) xor frame(8) xor frame(7) xor frame(6) xor frame(5)
                                               xor frame(4) xor frame(3) xor frame(2) xor frame(1)) or not frame(10);
                    done_r <= '1';
                else
                    n <= n + 1;
                end if;
            elsif idle /= "11111111111111111" then
                idle <= idle + 1;
            else
                n <= (others => '0');
            end if;
        end if;
    end process;

    code <= code_r;
    done <= done_r;
    err  <= err_r;
end rtl;

${HEX7SEG_VHDL}
${VHDL_NUMERIC}
entity top is
    port (
        CLK100MHZ : in  std_logic;
        PS2_CLK   : in  std_logic;
        PS2_DATA  : in  std_logic;
        LED       : out std_logic_vector(15 downto 0);
        CA, CB, CC, CD, CE, CF, CG, DP : out std_logic;
        AN        : out std_logic_vector(7 downto 0)
    );
end top;

architecture rtl of top is
    signal code, last, before : std_logic_vector(7 downto 0) := (others => '0');
    signal done, err          : std_logic;
    signal brk, held          : std_logic := '0';
    signal show               : std_logic_vector(15 downto 0);
    signal refresh            : unsigned(17 downto 0) := (others => '0');
    signal digit              : std_logic_vector(1 downto 0);
    signal nibble             : std_logic_vector(3 downto 0);
    signal seg                : std_logic_vector(6 downto 0);
begin
    rx : entity work.ps2_rx
        port map (clk => CLK100MHZ, ps2_clk => PS2_CLK, ps2_data => PS2_DATA, code => code, done => done, err => err);

    -- the last two bytes, and whether a key is held down (F0 = the next code is a release)
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if done = '1' then
                before <= last;
                last   <= code;
                if code = x"F0" then
                    brk <= '1';
                elsif code /= x"E0" then    -- E0 only marks an extended key
                    held <= not brk;
                    brk  <= '0';
                end if;
            end if;
        end if;
    end process;

    LED <= err & held & "000000" & last;

    -- four hex digits: the byte before and the last byte
    show <= before & last;
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
        nibble <= show(3 downto 0)   when "00",
                  show(7 downto 4)   when "01",
                  show(11 downto 8)  when "10",
                  show(15 downto 12) when others;

    decoder : entity work.hex7seg port map (x => nibble, seg => seg);

    CA <= seg(0);  CB <= seg(1);  CC <= seg(2);  CD <= seg(3);
    CE <= seg(4);  CF <= seg(5);  CG <= seg(6);
    DP <= '1';
end rtl;
`;

export const PS2_LESSON: Lesson = {
  id: 'ps2',
  title: 'صفحه‌کلید PS/2',
  summary: 'دریافت کدهای اسکن صفحه‌کلید از رابط PS/2 و نمایش آن‌ها روی نمایشگر.',
  body: `
<p>روی Nexys A7 یک درگاه <b>USB HID</b> هست. میکروکنترلر کنار آن صفحه‌کلید USB را به زبان قدیمی و ساده‌ی <b>PS/2</b> ترجمه می‌کند و با دو سیم به FPGA می‌دهد: <code>PS2_CLK</code> (F4) و <code>PS2_DATA</code> (B2). در این شبیه‌ساز صفحه‌کلید در بخش <span class="kbd">🧩 Modules</span> است: روی دکمه‌هایش کلیک کنید، یا گزینه‌ی «تایپ با صفحه‌کلید خودم» را روشن کنید.</p>
<h3>فریم PS/2</h3>
<p>برخلاف UART، کلاک را خود صفحه‌کلید می‌سازد (حدود ۱۲٫۵ کیلوهرتز). هر بایت ۱۱ بیت است و FPGA هر بیت را در <b>لبه‌ی پایین‌رونده‌ی کلاک</b> می‌خواند:</p>
<table class="truth"><tr><th>بیت</th><th>0</th><th>1 تا 8</th><th>9</th><th>10</th></tr>
<tr><td>معنی</td><td>شروع (0)</td><td>داده، اول LSB</td><td>توازن فرد</td><td>پایان (1)</td></tr></table>
<p>«توازن فرد» یعنی تعداد یک‌ها در هشت بیت داده و بیت توازن روی هم فرد باشد. هر دو خط <b>open-drain</b> هستند و وقتی کسی آن‌ها را پایین نکشد، مقاومت pull-up آن‌ها را ۱ نگه می‌دارد.</p>
<h3>کد اسکن</h3>
<p>صفحه‌کلید حرف نمی‌فرستد، شماره‌ی کلید را می‌فرستد. با فشردن یک کلید <b>کد make</b> آن می‌آید (مثلاً A = <code>1C</code> و 1 = <code>16</code>). با رها کردن کلید اول <code>F0</code> و بعد همان کد می‌آید. کلیدهای «گسترش‌یافته» مثل جهت‌ها قبل از کد یک <code>E0</code> دارند. تبدیل کد به حرف کار طرح شماست.</p>
<h3>گیرنده</h3>
<ul>
  <li>کلاک صفحه‌کلید از کلاک FPGA بسیار کندتر است، پس آن را <b>همگام</b> و <b>فیلتر</b> می‌کنیم: سطح جدید فقط وقتی پذیرفته می‌شود که ۸ نمونه‌ی پشت سر هم یکسان باشند.</li>
  <li>در هر لبه‌ی پایین‌رونده، بیت داده از بالا وارد شیفت‌رجیستر ۱۱ بیتی می‌شود، چون بیت‌ها از LSB می‌آیند.</li>
  <li>بعد از بیت یازدهم، بیت‌های 8 تا 1 کد هستند. شروع، توازن و پایان بررسی می‌شوند و یک پالس <code>done</code> ساخته می‌شود.</li>
  <li>اگر ۱٫۳ میلی‌ثانیه لبه‌ای نیاید، شمارنده‌ی بیت‌ها صفر می‌شود تا یک فریم نیمه‌کاره بقیه را خراب نکند.</li>
</ul>
<p>طرح این درس دو بایت آخر را روی چهار رقم نمایشگر نشان می‌دهد (مثلاً بعد از رها کردن A: <b>F0 1C</b>). کد آخر روی LD7..LD0 است، LD14 وقتی کلیدی پایین نگه داشته شده روشن است و LD15 خطای فریم را نشان می‌دهد.</p>`,
  verilog: PS2_V,
  vhdl: PS2_VHDL,
  xdc: { clk: true, led: true, seg: true, ps2: true },
  tryIt: `<p><span class="kbd">▶ Run</span> را بزنید و <span class="kbd">🧩 Modules</span> را باز کنید. روی کلیدهای صفحه‌کلید USB کلیک کنید. تا وقتی دکمه را نگه داشته‌اید نمایشگر کد make را نشان می‌دهد و بعد از رها کردن <b>F0</b> و همان کد را. کلیدهای جهت را هم امتحان کنید تا <b>E0</b> را ببینید.</p>
<p>در Logic Analyzer خطوط <code>PS2_CLK</code> و <code>PS2_DATA</code> با دیکودر PS/2 آماده‌اند. تریگر روی لبه‌ی پایین‌رونده‌ی کلاک است: کلیدی را بزنید و فریم‌ها را با نام کلیدها ببینید.</p>`,
  la: {
    chans: [
      { name: 'PS2_CLK', probe: 'pin:F4' },
      { name: 'PS2_DATA', probe: 'pin:B2' },
    ],
    decs: [{ type: 'ps2', name: 'PS/2', clk: 0, data: 1 }],
    base: 5e-4,
    pos: 4,
    trig: { ch: 0, edge: 'fall' },
  },
};
