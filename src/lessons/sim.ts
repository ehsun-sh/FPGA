// Lesson: behavioral simulation with a testbench and the waveform viewer.
import { VHDL_NUMERIC, type Lesson } from './lessons';

const DESIGN_V = `// 8-bit counter that steps every DIV clocks while SW0 is on.
// DIV is a parameter, so the testbench can make it small.
module top #(parameter DIV = 50_000_000) (
    input  wire        CLK100MHZ,
    input  wire        CPU_RESETN,
    input  wire [15:0] SW,
    output wire [15:0] LED
);
    reg [31:0] prescaler = 0;
    reg [7:0]  count = 0;
    wire tick = (prescaler == DIV - 1);

    always @(posedge CLK100MHZ) begin
        if (!CPU_RESETN) begin
            prescaler <= 0;
            count <= 0;
        end else begin
            prescaler <= tick ? 0 : prescaler + 1;
            if (tick && SW[0])
                count <= count + 1;
        end
    end

    assign LED = {8'b0, count};
endmodule
`;

const TB_V = `\`timescale 1ns / 1ps
// Testbench: no ports. It creates the clock, drives the inputs and checks the outputs.
module tb_top;
    reg         CLK100MHZ  = 0;
    reg         CPU_RESETN = 0;      // reset is active at the start
    reg  [15:0] SW         = 0;
    wire [15:0] LED;

    // DIV = 4: the counter steps every 4 clocks instead of every 0.5 s
    top #(.DIV(4)) dut (
        .CLK100MHZ(CLK100MHZ),
        .CPU_RESETN(CPU_RESETN),
        .SW(SW),
        .LED(LED)
    );

    always #5 CLK100MHZ = ~CLK100MHZ;   // 10 ns period = 100 MHz

    initial begin
        $display("start: reset for 100 ns");
        #100 CPU_RESETN = 1;
        SW[0] = 1;                        // enable counting
        repeat (40) @(posedge CLK100MHZ);
        #1;
        $display("t=%0t ns  count=%0d", $time, LED[7:0]);
        if (LED[7:0] !== 8'd10)
            $error("expected 10, got %0d", LED[7:0]);

        SW[0] = 0;                        // the counter must hold its value
        repeat (20) @(posedge CLK100MHZ);
        #1;
        if (LED[7:0] !== 8'd10)
            $error("the counter changed while SW0 was off");
        else
            $display("PASS: the counter counts and holds");
        $finish;
    end
endmodule
`;

const DESIGN_VHDL = `${VHDL_NUMERIC}
-- 8-bit counter that steps every DIV clocks while SW0 is on.
-- DIV is a generic, so the testbench can make it small.
entity top is
    generic (DIV : integer := 50_000_000);
    port (
        CLK100MHZ  : in  std_logic;
        CPU_RESETN : in  std_logic;
        SW         : in  std_logic_vector(15 downto 0);
        LED        : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal prescaler : integer range 0 to DIV - 1 := 0;
    signal count : unsigned(7 downto 0) := (others => '0');
begin
    process (CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if CPU_RESETN = '0' then
                prescaler <= 0;
                count <= (others => '0');
            elsif prescaler = DIV - 1 then
                prescaler <= 0;
                if SW(0) = '1' then
                    count <= count + 1;
                end if;
            else
                prescaler <= prescaler + 1;
            end if;
        end if;
    end process;

    LED <= x"00" & std_logic_vector(count);
end rtl;
`;

const TB_VHDL = `${VHDL_NUMERIC}
-- Testbench: no ports. It creates the clock, drives the inputs and checks the outputs.
entity tb_top is
end tb_top;

architecture sim of tb_top is
    signal CLK100MHZ  : std_logic := '0';
    signal CPU_RESETN : std_logic := '0';   -- reset is active at the start
    signal SW         : std_logic_vector(15 downto 0) := (others => '0');
    signal LED        : std_logic_vector(15 downto 0);
begin
    -- DIV = 4: the counter steps every 4 clocks instead of every 0.5 s
    dut : entity work.top
        generic map (DIV => 4)
        port map (CLK100MHZ => CLK100MHZ, CPU_RESETN => CPU_RESETN, SW => SW, LED => LED);

    CLK100MHZ <= not CLK100MHZ after 5 ns;   -- 10 ns period = 100 MHz

    stim : process
    begin
        report "start: reset for 100 ns";
        wait for 100 ns;
        CPU_RESETN <= '1';
        SW(0) <= '1';                          -- enable counting
        for i in 1 to 40 loop
            wait until rising_edge(CLK100MHZ);
        end loop;
        wait for 1 ns;
        report "count = " & integer'image(to_integer(unsigned(LED(7 downto 0))));
        assert LED(7 downto 0) = x"0A" report "expected 10" severity error;

        SW(0) <= '0';                          -- the counter must hold its value
        for i in 1 to 20 loop
            wait until rising_edge(CLK100MHZ);
        end loop;
        wait for 1 ns;
        assert LED(7 downto 0) = x"0A" report "the counter changed while SW0 was off" severity error;
        report "PASS: the counter counts and holds";
        std.env.finish;
    end process;
end sim;
`;

export const TESTBENCH_LESSON: Lesson = {
  id: 'testbench',
  title: 'شبیه‌سازی با Testbench و نمودار شکل موج',
  summary: 'قبل از رفتن روی برد، طرح را با یک Testbench آزمایش کنید و سیگنال‌ها را در نمودار زمانی ببینید.',
  body: `
<p>تا اینجا هر طرح را مستقیم روی برد امتحان کردیم. در کار واقعی قبل از برنامه‌ریزی FPGA طرح را <b>شبیه‌سازی</b> می‌کنند: یک برنامهٔ HDL دیگر به نام <b>Testbench</b> ورودی‌ها را در زمان‌های مشخص تغییر می‌دهد، خروجی‌ها را بررسی می‌کند و همهٔ سیگنال‌ها در یک <b>نمودار شکل موج</b> (Waveform) دیده می‌شوند. در Vivado این کار با <b>Run Behavioral Simulation</b> انجام می‌شود و اینجا هم همین است.</p>
<h3>Testbench از چه چیزهایی ساخته می‌شود؟</h3>
<ol>
  <li><b>ماژول بدون پورت</b>: Testbench بالاترین سطح است و به هیچ پایه‌ای وصل نیست.</li>
  <li><b>سیگنال‌ها</b> برای ورودی‌ها (<code>reg</code> در Verilog) و خروجی‌ها (<code>wire</code>).</li>
  <li><b>نمونه‌ای از طرح</b> (DUT: Design Under Test) که به این سیگنال‌ها وصل می‌شود.</li>
  <li><b>تولید کلاک</b>: <code>always #5 clk = ~clk;</code> یا در VHDL <code>clk &lt;= not clk after 5 ns;</code></li>
  <li><b>محرک‌ها</b> (Stimulus) در یک بلوک <code>initial</code> یا یک <code>process</code> بدون لیست حساسیت: تأخیرها با <code>#100</code> یا <code>wait for 100 ns</code>، و منتظر لبه ماندن با <code>@(posedge clk)</code> یا <code>wait until rising_edge(clk)</code>.</li>
  <li><b>بررسی‌ها</b>: <code>$display</code> و <code>$error</code> در Verilog، و <code>report</code> و <code>assert</code> در VHDL. پیام‌ها در Tcl Console نمایش داده می‌شوند.</li>
  <li><b>پایان</b>: <code>$finish</code> یا <code>std.env.finish</code>.</li>
</ol>
<div class="note">این دستورها فقط برای شبیه‌سازی هستند و سنتز نمی‌شوند. اگر <code>#10</code> یا <code>wait</code> را در طرح اصلی بنویسید، سنتز خطا می‌دهد.</div>
<h3>ترفند سرعت: کوچک کردن پارامترها</h3>
<p>شمارندهٔ این درس هر ۰٫۵ ثانیه یک واحد جلو می‌رود، یعنی هر ۵۰ میلیون کلاک. شبیه‌سازی این همه کلاک خیلی طول می‌کشد. برای همین تقسیم‌کننده را به یک <b>پارامتر</b> (<code>parameter DIV</code> یا <code>generic DIV</code>) تبدیل کرده‌ایم تا Testbench آن را ۴ بگذارد (<code>#(.DIV(4))</code> یا <code>generic map (DIV =&gt; 4)</code>). روی برد همان مقدار پیش‌فرض ۵۰ میلیون استفاده می‌شود.</p>
<h3>کار با نمودار شکل موج</h3>
<ul>
  <li><b>Run for</b> شبیه‌سازی را به اندازهٔ زمان داده‌شده جلو می‌برد، <b>Run All</b> تا <code>$finish</code> ادامه می‌دهد و <b>Restart</b> زمان را به صفر برمی‌گرداند (مثل <code>run 1us</code>، <code>run all</code> و <code>restart</code> در Tcl Console).</li>
  <li>با چرخ ماوس بزرگ‌نمایی کنید، با کشیدن جابه‌جا شوید و با <b>Fit</b> کل زمان را ببینید.</li>
  <li>با کلیک روی نمودار <b>مکان‌نما</b> (Cursor) زرد را بگذارید. ستون Value مقدار هر سیگنال را در آن لحظه نشان می‌دهد.</li>
  <li>با راست‌کلیک روی نام سیگنال مبنای نمایش (Radix) را عوض کنید: باینری، هگز، دهدهی یا ASCII.</li>
  <li>در ستون <b>Scope</b> روی <code>dut</code> کلیک کنید تا سیگنال‌های داخلی طرح مثل <code>prescaler</code> و <code>count</code> را هم اضافه کنید.</li>
</ul>
<p>برای درس‌های دیگر هم یک Testbench آماده در تب <code>tb.v</code> / <code>tb.vhd</code> ساخته می‌شود. این Testbench از روی پورت‌های طرح تولید می‌شود و می‌توانید آن را تغییر دهید.</p>`,
  verilog: DESIGN_V,
  vhdl: DESIGN_VHDL,
  tb: { verilog: TB_V, vhdl: TB_VHDL },
  xdc: { clk: true, sw: true, led: true, reset: true },
  tryIt: `<p>دکمهٔ <span class="kbd">∿ Simulate</span> را بزنید. در Tcl Console پیام <code>PASS</code> ظاهر می‌شود و در سمت راست نمودار شکل موج باز می‌شود: کلاک، ریست، SW و LED. روی <b>Fit</b> بزنید و ببینید LED هر ۴ کلاک یک واحد زیاد می‌شود. بعد در تب Testbench عدد <code>10</code> را به <code>11</code> تغییر دهید و دوباره شبیه‌سازی کنید تا پیام خطا را ببینید.</p>
<p>روی برد هم کار می‌کند: <span class="kbd">▶ Run</span> را بزنید و SW0 را روشن کنید. LEDها هر نیم ثانیه یک واحد می‌شمارند.</p>`,
  exercise: `<p>در وسط Testbench ریست را دوباره فعال کنید (<code>CPU_RESETN = 0</code>) و بررسی کنید که شمارنده صفر شود. بعد یک بررسی اضافه کنید که نشان دهد وقتی SW0 خاموش است شمارنده حتی بعد از ۱۰۰ کلاک هم ثابت می‌ماند.</p>`,
};
