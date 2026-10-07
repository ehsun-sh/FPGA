// Lesson: VGA video output (640×480 @ 60 Hz) on the virtual monitor.
import { VHDL_NUMERIC, type Lesson } from './lessons';

const VGA_V = `// VGA 640x480 @ 60 Hz: a sync generator and eight colour bars
module vga_sync (
    input  wire       clk,          // 100 MHz
    output wire       hsync,        // sync pulses are active-low in this mode
    output wire       vsync,
    output wire       active,       // inside the visible 640 x 480 area
    output reg  [9:0] x = 0,        // pixel column, 0..799
    output reg  [9:0] y = 0         // line, 0..524
);
    // visible area, front porch, sync pulse, back porch (in pixels / lines)
    localparam H_VIS = 640, H_FP = 16, H_SYNC = 96, H_BP = 48;
    localparam V_VIS = 480, V_FP = 10, V_SYNC = 2,  V_BP = 33;
    localparam H_TOTAL = H_VIS + H_FP + H_SYNC + H_BP;   // 800
    localparam V_TOTAL = V_VIS + V_FP + V_SYNC + V_BP;   // 525

    // 25 MHz pixel clock enable: one pulse every 4 clocks
    reg  [1:0] div = 0;
    wire       pix = (div == 2'd3);

    always @(posedge clk) begin
        div <= div + 1;
        if (pix) begin
            if (x == H_TOTAL - 1) begin
                x <= 0;
                y <= (y == V_TOTAL - 1) ? 10'd0 : y + 1;
            end else
                x <= x + 1;
        end
    end

    assign hsync  = ~((x >= H_VIS + H_FP) && (x < H_VIS + H_FP + H_SYNC));
    assign vsync  = ~((y >= V_VIS + V_FP) && (y < V_VIS + V_FP + V_SYNC));
    assign active = (x < H_VIS) && (y < V_VIS);
endmodule

module top (
    input  wire        CLK100MHZ,
    input  wire [15:0] SW,
    output wire [3:0]  VGA_R, VGA_G, VGA_B,
    output wire        VGA_HS, VGA_VS
);
    wire       active;
    wire [9:0] x, y;
    vga_sync sync (.clk(CLK100MHZ), .hsync(VGA_HS), .vsync(VGA_VS), .active(active), .x(x), .y(y));

    // eight 80-pixel colour bars, as 12-bit {R, G, B}
    reg [11:0] bar;
    always @(*) begin
        if      (x < 80)  bar = 12'hFFF;   // white
        else if (x < 160) bar = 12'hFF0;   // yellow
        else if (x < 240) bar = 12'h0FF;   // cyan
        else if (x < 320) bar = 12'h0F0;   // green
        else if (x < 400) bar = 12'hF0F;   // magenta
        else if (x < 480) bar = 12'hF00;   // red
        else if (x < 560) bar = 12'h00F;   // blue
        else              bar = 12'h000;   // black
    end

    // SW0: a checkerboard of 32 x 32 squares instead of the bars
    wire [11:0] check = (x[5] ^ y[5]) ? 12'hFFF : 12'h000;
    wire [11:0] rgb   = SW[0] ? check : bar;

    // the colour lines must stay black outside the visible area
    assign {VGA_R, VGA_G, VGA_B} = active ? rgb : 12'h000;
endmodule
`;

const VGA_VHDL = `${VHDL_NUMERIC}
-- VGA 640x480 @ 60 Hz: a sync generator and eight colour bars
entity vga_sync is
    port (
        clk    : in  std_logic;                -- 100 MHz
        hsync  : out std_logic;                -- sync pulses are active-low in this mode
        vsync  : out std_logic;
        active : out std_logic;                -- inside the visible 640 x 480 area
        x      : out unsigned(9 downto 0);     -- pixel column, 0..799
        y      : out unsigned(9 downto 0)      -- line, 0..524
    );
end vga_sync;

architecture rtl of vga_sync is
    -- visible area, front porch, sync pulse, back porch (in pixels / lines)
    constant H_VIS : integer := 640;
    constant H_FP  : integer := 16;
    constant H_SYNC : integer := 96;
    constant H_BP  : integer := 48;
    constant V_VIS : integer := 480;
    constant V_FP  : integer := 10;
    constant V_SYNC : integer := 2;
    constant V_BP  : integer := 33;
    constant H_TOTAL : integer := H_VIS + H_FP + H_SYNC + H_BP;   -- 800
    constant V_TOTAL : integer := V_VIS + V_FP + V_SYNC + V_BP;   -- 525

    signal div : unsigned(1 downto 0) := "00";  -- 25 MHz pixel clock enable
    signal hc  : integer range 0 to 1023 := 0;
    signal vc  : integer range 0 to 1023 := 0;
begin
    process (clk)
    begin
        if rising_edge(clk) then
            div <= div + 1;
            if div = 3 then
                if hc = H_TOTAL - 1 then
                    hc <= 0;
                    if vc = V_TOTAL - 1 then
                        vc <= 0;
                    else
                        vc <= vc + 1;
                    end if;
                else
                    hc <= hc + 1;
                end if;
            end if;
        end if;
    end process;

    hsync  <= '0' when hc >= H_VIS + H_FP and hc < H_VIS + H_FP + H_SYNC else '1';
    vsync  <= '0' when vc >= V_VIS + V_FP and vc < V_VIS + V_FP + V_SYNC else '1';
    active <= '1' when hc < H_VIS and vc < V_VIS else '0';
    x <= to_unsigned(hc, 10);
    y <= to_unsigned(vc, 10);
end rtl;

${VHDL_NUMERIC}
entity top is
    port (
        CLK100MHZ : in  std_logic;
        SW        : in  std_logic_vector(15 downto 0);
        VGA_R     : out std_logic_vector(3 downto 0);
        VGA_G     : out std_logic_vector(3 downto 0);
        VGA_B     : out std_logic_vector(3 downto 0);
        VGA_HS    : out std_logic;
        VGA_VS    : out std_logic
    );
end top;

architecture rtl of top is
    signal active : std_logic;
    signal x, y   : unsigned(9 downto 0);
    signal bar, check, rgb : std_logic_vector(11 downto 0);
begin
    sync : entity work.vga_sync
        port map (clk => CLK100MHZ, hsync => VGA_HS, vsync => VGA_VS, active => active, x => x, y => y);

    -- eight 80-pixel colour bars, as 12-bit R & G & B
    bar <= x"FFF" when x < 80 else     -- white
           x"FF0" when x < 160 else    -- yellow
           x"0FF" when x < 240 else    -- cyan
           x"0F0" when x < 320 else    -- green
           x"F0F" when x < 400 else    -- magenta
           x"F00" when x < 480 else    -- red
           x"00F" when x < 560 else    -- blue
           x"000";                     -- black

    -- SW0: a checkerboard of 32 x 32 squares instead of the bars
    check <= x"FFF" when (x(5) xor y(5)) = '1' else x"000";
    rgb   <= check when SW(0) = '1' else bar;

    -- the colour lines must stay black outside the visible area
    VGA_R <= rgb(11 downto 8) when active = '1' else "0000";
    VGA_G <= rgb(7 downto 4)  when active = '1' else "0000";
    VGA_B <= rgb(3 downto 0)  when active = '1' else "0000";
end rtl;
`;

export const VGA_LESSON: Lesson = {
  id: 'vga',
  title: 'تصویر VGA روی مانیتور',
  summary: 'ساخت سیگنال‌های همگام‌سازی VGA با دو شمارنده و کشیدن نوارهای رنگی روی یک مانیتور ۶۴۰×۴۸۰.',
  body: `
<p>کانکتور آبی VGA روی برد پنج سیگنال به مانیتور می‌فرستد: سه سیگنال رنگ (<code>VGA_R</code>، <code>VGA_G</code> و <code>VGA_B</code>، هر کدام ۴ بیت، یعنی ۴۰۹۶ رنگ) و دو سیگنال همگام‌سازی: <b>HS</b> (افقی) و <b>VS</b> (عمودی). مانیتور تصویر را مثل یک قلم، خط به خط و از چپ به راست می‌کشد. FPGA باید رنگ هر نقطه (پیکسل) را درست در همان لحظه‌ای بفرستد که قلم به آن رسیده است. هیچ حافظهٔ تصویری وجود ندارد و رنگ همان لحظه محاسبه می‌شود.</p>
<h3>زمان‌بندی 640×480 در ۶۰ هرتز</h3>
<p>کلاک پیکسل حدود <b>25 MHz</b> است. ما از ۱۰۰ مگاهرتز با یک پالس فعال‌ساز در هر ۴ کلاک به آن می‌رسیم. هر خط ۸۰۰ پیکسل زمان دارد و هر تصویر ۵۲۵ خط:</p>
<table class="truth"><tr><th></th><th>قابل دیدن</th><th>Front porch</th><th>پالس Sync</th><th>Back porch</th><th>کل</th></tr>
<tr><td>افقی (پیکسل)</td><td>640</td><td>16</td><td>96</td><td>48</td><td>800</td></tr>
<tr><td>عمودی (خط)</td><td>480</td><td>10</td><td>2</td><td>33</td><td>525</td></tr></table>
<p>پس یک خط ۳۲ میکروثانیه و یک تصویر ۱۶٫۸ میلی‌ثانیه طول می‌کشد (۶۰ تصویر در ثانیه). در این حالت پالس‌های Sync <b>فعال‌پایین</b> هستند. در زمان‌های porch و sync رنگ باید سیاه (صفر) باشد، چون مانیتور در این زمان سطح سیاه را اندازه می‌گیرد.</p>
<h3>دو شمارنده</h3>
<ul>
  <li><code>x</code> در هر پیکسل یکی زیاد می‌شود و از ۷۹۹ به ۰ برمی‌گردد.</li>
  <li><code>y</code> در آخر هر خط یکی زیاد می‌شود و از ۵۲۴ به ۰ برمی‌گردد.</li>
  <li><code>hsync</code> وقتی صفر است که <code>656 ≤ x &lt; 752</code>، و <code>vsync</code> وقتی صفر است که <code>490 ≤ y &lt; 492</code>.</li>
  <li><code>active</code> یعنی <code>x &lt; 640</code> و <code>y &lt; 480</code>. در این ناحیه رنگ پیکسل <code>(x, y)</code> فرستاده می‌شود.</li>
</ul>
<p>بعد از این، کشیدن تصویر فقط یک مدار ترکیبی است که از <code>x</code> و <code>y</code> یک رنگ می‌سازد. در این درس هشت نوار رنگی ۸۰ پیکسلی می‌کشیم و با SW0 یک صفحهٔ شطرنجی نشان می‌دهیم (<code>x[5] ^ y[5]</code> هر ۳۲ پیکسل عوض می‌شود).</p>
<div class="note">مانیتور مجازی مثل یک مانیتور واقعی کار می‌کند: از روی فاصلهٔ پالس‌های HS و VS حالت تصویر را تشخیص می‌دهد. اگر زمان‌بندی اشتباه باشد، پیام <b>No signal</b> یا <b>Out of range</b> نشان می‌دهد و اگر porchها اشتباه باشند، تصویر جابه‌جا دیده می‌شود.</div>`,
  verilog: VGA_V,
  vhdl: VGA_VHDL,
  xdc: { clk: true, sw: true, vga: true },
  tryIt: `<p><span class="kbd">▶ Run</span> را بزنید. کنار برد یک مانیتور با کابل VGA ظاهر می‌شود و نوارهای رنگی را نشان می‌دهد. برای دیدن تصویر بزرگ‌تر روی دکمهٔ <span class="kbd">🖥 VGA Monitor</span> در نوار ابزار بزنید. SW0 را روشن کنید تا صفحهٔ شطرنجی را ببینید. شبیه‌سازی یک تصویر کامل حدود ۱٫۷ میلیون کلاک است، پس اگر مرورگر کند باشد تصویر را در حال کشیده شدن، خط به خط، می‌بینید.</p>
<p>در Logic Analyzer هم می‌توانید پالس‌های HS را ببینید و فاصلهٔ آن‌ها را اندازه بگیرید (باید ۳۲ میکروثانیه باشد).</p>`,
  la: {
    chans: [
      { name: 'HS', probe: 'pin:B11' },
      { name: 'VS', probe: 'pin:B12' },
      { name: 'R3', probe: 'pin:A4' },
      { name: 'B3', probe: 'pin:D8' },
    ],
    decs: [],
    base: 1e-5,
    pos: 1,
    trig: { ch: 0, edge: 'fall' },
  },
};
