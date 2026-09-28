// Lesson: a soft-core processor. Tiny8 is a small, original 8-bit CPU written for this course: an accumulator,
// 16 bytes of data memory, 16 instructions, and its program in a ROM inside the FPGA.
import { HEX7SEG_V, HEX7SEG_VHDL } from './advanced';
import { VHDL_NUMERIC, type Lesson } from './lessons';

const CPU_V = `// Tiny8: an 8-bit soft-core processor. Every instruction is 12 bits: {opcode[3:0], k[7:0]}
module tiny8 #(parameter PERIOD = 25_000_000) (   // WAIT waits for the next tick: 0.25 s
    input  wire        clk,
    input  wire        rst,
    input  wire [15:0] sw,
    output reg  [7:0]  led_lo = 0,    // OUT 0
    output reg  [7:0]  led_hi = 0,    // OUT 1
    output reg  [15:0] disp   = 0,    // OUT 2 (low byte), OUT 3 (high byte)
    output reg  [5:0]  pc     = 0
);
    localparam [3:0] NOP  = 4'h0, LDI = 4'h1, LD  = 4'h2, ST   = 4'h3,
                     ADD  = 4'h4, SUB = 4'h5, ADDI = 4'h6, ANDI = 4'h7,
                     XORI = 4'h8, IN  = 4'h9, OUT = 4'hA, JMP  = 4'hB,
                     JZ   = 4'hC, JC  = 4'hD, WAIT = 4'hE, JNZ = 4'hF;

    // ---------------- program ROM: 64 instructions
    reg [11:0] rom;
    always @(*) begin
        case (pc)
            // x = x + SW[7:0] every tick; x on LD7..LD0 and on the display, SW[7:0] on LD15..LD8
            6'd0:  rom = {LDI,  8'd0};
            6'd1:  rom = {ST,   8'd0};     // ram[0] = x = 0
            6'd2:  rom = {IN,   8'd0};     // loop: A = SW[7:0]
            6'd3:  rom = {OUT,  8'd1};     // LD15..LD8 = step
            6'd4:  rom = {ST,   8'd1};     // ram[1] = step
            6'd5:  rom = {LD,   8'd0};
            6'd6:  rom = {ADD,  8'd1};     // A = x + step
            6'd7:  rom = {ST,   8'd0};
            6'd8:  rom = {OUT,  8'd0};     // LD7..LD0 = x
            6'd9:  rom = {OUT,  8'd2};     // display = x
            6'd10: rom = {WAIT, 8'd0};
            6'd11: rom = {JMP,  8'd2};
            default: rom = {NOP, 8'd0};
        endcase
    end

    // ---------------- registers
    reg [11:0] ir    = 0;           // instruction register
    reg        exec  = 1'b0;        // 0: fetch, 1: execute
    reg [7:0]  a     = 0;           // accumulator
    reg        z     = 1'b0;        // zero flag
    reg        c     = 1'b0;        // carry flag
    reg [7:0]  ram [0:15];
    reg [31:0] timer = 0;
    reg        tick  = 1'b0;

    wire [3:0] op = ir[11:8];
    wire [7:0] k  = ir[7:0];
    wire [7:0] m  = ram[k[3:0]];
    wire [8:0] sum = {1'b0, a} + {1'b0, (op == ADDI) ? k : m};
    wire [8:0] dif = {1'b0, a} - {1'b0, m};

    always @(posedge clk) begin
        if (timer == PERIOD - 1) begin
            timer <= 0;
            tick  <= 1'b1;
        end else
            timer <= timer + 1;

        if (rst) begin
            pc <= 0;  exec <= 1'b0;  a <= 0;  z <= 1'b0;  c <= 1'b0;
        end else if (!exec) begin          // fetch
            ir   <= rom;
            pc   <= pc + 1;
            exec <= 1'b1;
        end else begin                     // execute
            exec <= 1'b0;
            case (op)
                LDI:  begin a <= k;          z <= (k == 0); end
                LD:   begin a <= m;          z <= (m == 0); end
                ST:   ram[k[3:0]] <= a;
                ADD, ADDI:
                      begin a <= sum[7:0];   z <= (sum[7:0] == 0); c <= sum[8]; end
                SUB:  begin a <= dif[7:0];   z <= (dif[7:0] == 0); c <= dif[8]; end
                ANDI: begin a <= a & k;      z <= ((a & k) == 0); end
                XORI: begin a <= a ^ k;      z <= ((a ^ k) == 0); end
                IN:   begin
                          a <= k[0] ? sw[15:8] : sw[7:0];
                          z <= (k[0] ? sw[15:8] : sw[7:0]) == 0;
                      end
                OUT:  case (k[1:0])
                          2'd0: led_lo      <= a;
                          2'd1: led_hi      <= a;
                          2'd2: disp[7:0]   <= a;
                          2'd3: disp[15:8]  <= a;
                      endcase
                JMP:  pc <= k[5:0];
                JZ:   if (z)  pc <= k[5:0];
                JNZ:  if (!z) pc <= k[5:0];
                JC:   if (c)  pc <= k[5:0];
                WAIT: if (tick) tick <= 1'b0;
                      else      exec <= 1'b1;   // stay here until the next tick
                default: ;                      // NOP
            endcase
        end
    end
endmodule

${HEX7SEG_V}
module top #(parameter PERIOD = 25_000_000) (
    input  wire        CLK100MHZ,
    input  wire        CPU_RESETN,
    input  wire [15:0] SW,
    output wire [15:0] LED,
    output wire CA, CB, CC, CD, CE, CF, CG, DP,
    output reg  [7:0]  AN
);
    wire [7:0]  led_lo, led_hi;
    wire [15:0] disp;
    wire [5:0]  pc;
    tiny8 #(.PERIOD(PERIOD)) cpu (.clk(CLK100MHZ), .rst(~CPU_RESETN), .sw(SW),
                            .led_lo(led_lo), .led_hi(led_hi), .disp(disp), .pc(pc));

    assign LED = {led_hi, led_lo};

    // four hex digits show what the program wrote with OUT 2 and OUT 3
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
            2'd0:    nibble = disp[3:0];
            2'd1:    nibble = disp[7:4];
            2'd2:    nibble = disp[11:8];
            default: nibble = disp[15:12];
        endcase
    end

    hex7seg decoder (.x(nibble), .seg(seg));
    assign {CG, CF, CE, CD, CC, CB, CA} = seg;
    assign DP = 1'b1;
endmodule
`;

const CPU_VHDL = `${VHDL_NUMERIC}
-- Tiny8: an 8-bit soft-core processor. Every instruction is 12 bits: opcode(11 downto 8) & k(7 downto 0)
entity tiny8 is
    generic (PERIOD : integer := 25_000_000);   -- WAIT waits for the next tick: 0.25 s
    port (
        clk    : in  std_logic;
        rst    : in  std_logic;
        sw     : in  std_logic_vector(15 downto 0);
        led_lo : out std_logic_vector(7 downto 0);    -- OUT 0
        led_hi : out std_logic_vector(7 downto 0);    -- OUT 1
        disp   : out std_logic_vector(15 downto 0);   -- OUT 2 (low byte), OUT 3 (high byte)
        pc_out : out std_logic_vector(5 downto 0)
    );
end tiny8;

architecture rtl of tiny8 is
    constant NOP  : std_logic_vector(3 downto 0) := x"0";
    constant LDI  : std_logic_vector(3 downto 0) := x"1";
    constant LD   : std_logic_vector(3 downto 0) := x"2";
    constant ST   : std_logic_vector(3 downto 0) := x"3";
    constant ADD  : std_logic_vector(3 downto 0) := x"4";
    constant SUB  : std_logic_vector(3 downto 0) := x"5";
    constant ADDI : std_logic_vector(3 downto 0) := x"6";
    constant ANDI : std_logic_vector(3 downto 0) := x"7";
    constant XORI : std_logic_vector(3 downto 0) := x"8";
    constant INP  : std_logic_vector(3 downto 0) := x"9";   -- IN  (in is a VHDL keyword)
    constant OUTP : std_logic_vector(3 downto 0) := x"A";   -- OUT (out is a VHDL keyword)
    constant JMP  : std_logic_vector(3 downto 0) := x"B";
    constant JZ   : std_logic_vector(3 downto 0) := x"C";
    constant JC   : std_logic_vector(3 downto 0) := x"D";
    constant WAIT_T : std_logic_vector(3 downto 0) := x"E"; -- WAIT (wait is a VHDL keyword)
    constant JNZ  : std_logic_vector(3 downto 0) := x"F";

    type ram_t is array (0 to 15) of unsigned(7 downto 0);
    signal ram   : ram_t := (others => (others => '0'));
    signal pc    : unsigned(5 downto 0) := (others => '0');
    signal rom   : std_logic_vector(11 downto 0);
    signal ir    : std_logic_vector(11 downto 0) := (others => '0');   -- instruction register
    signal exec  : std_logic := '0';                                   -- '0': fetch, '1': execute
    signal a     : unsigned(7 downto 0) := (others => '0');            -- accumulator
    signal z, c  : std_logic := '0';                                   -- zero and carry flags
    signal timer : integer range 0 to PERIOD - 1 := 0;
    signal tick  : std_logic := '0';
    signal op    : std_logic_vector(3 downto 0);
    signal k, m  : unsigned(7 downto 0);
    signal sum, dif : unsigned(8 downto 0);
    signal inb   : unsigned(7 downto 0);
    signal led_lo_r, led_hi_r : std_logic_vector(7 downto 0) := (others => '0');
    signal disp_r : std_logic_vector(15 downto 0) := (others => '0');
begin
    -- ---------------- program ROM: 64 instructions
    process(pc)
    begin
        case to_integer(pc) is
            -- x = x + SW[7:0] every tick; x on LD7..LD0 and on the display, SW[7:0] on LD15..LD8
            when 0  => rom <= LDI    & x"00";
            when 1  => rom <= ST     & x"00";   -- ram[0] = x = 0
            when 2  => rom <= INP    & x"00";   -- loop: A = SW[7:0]
            when 3  => rom <= OUTP   & x"01";   -- LD15..LD8 = step
            when 4  => rom <= ST     & x"01";   -- ram[1] = step
            when 5  => rom <= LD     & x"00";
            when 6  => rom <= ADD    & x"01";   -- A = x + step
            when 7  => rom <= ST     & x"00";
            when 8  => rom <= OUTP   & x"00";   -- LD7..LD0 = x
            when 9  => rom <= OUTP   & x"02";   -- display = x
            when 10 => rom <= WAIT_T & x"00";
            when 11 => rom <= JMP    & x"02";
            when others => rom <= NOP & x"00";
        end case;
    end process;

    op  <= ir(11 downto 8);
    k   <= unsigned(ir(7 downto 0));
    m   <= ram(to_integer(k(3 downto 0)));
    sum <= ('0' & a) + ('0' & k) when op = ADDI else ('0' & a) + ('0' & m);
    dif <= ('0' & a) - ('0' & m);
    inb <= unsigned(sw(15 downto 8)) when k(0) = '1' else unsigned(sw(7 downto 0));

    process(clk)
    begin
        if rising_edge(clk) then
            if timer = PERIOD - 1 then
                timer <= 0;
                tick  <= '1';
            else
                timer <= timer + 1;
            end if;

            if rst = '1' then
                pc <= (others => '0');  exec <= '0';  a <= (others => '0');  z <= '0';  c <= '0';
            elsif exec = '0' then            -- fetch
                ir   <= rom;
                pc   <= pc + 1;
                exec <= '1';
            else                             -- execute
                exec <= '0';
                case op is
                    when LDI =>
                        a <= k;
                        if k = 0 then z <= '1'; else z <= '0'; end if;
                    when LD =>
                        a <= m;
                        if m = 0 then z <= '1'; else z <= '0'; end if;
                    when ST =>
                        ram(to_integer(k(3 downto 0))) <= a;
                    when ADD | ADDI =>
                        a <= sum(7 downto 0);
                        c <= sum(8);
                        if sum(7 downto 0) = 0 then z <= '1'; else z <= '0'; end if;
                    when SUB =>
                        a <= dif(7 downto 0);
                        c <= dif(8);
                        if dif(7 downto 0) = 0 then z <= '1'; else z <= '0'; end if;
                    when ANDI =>
                        a <= a and k;
                        if (a and k) = 0 then z <= '1'; else z <= '0'; end if;
                    when XORI =>
                        a <= a xor k;
                        if (a xor k) = 0 then z <= '1'; else z <= '0'; end if;
                    when INP =>
                        a <= inb;
                        if inb = 0 then z <= '1'; else z <= '0'; end if;
                    when OUTP =>
                        case to_integer(k(1 downto 0)) is
                            when 0      => led_lo_r <= std_logic_vector(a);
                            when 1      => led_hi_r <= std_logic_vector(a);
                            when 2      => disp_r(7 downto 0)  <= std_logic_vector(a);
                            when others => disp_r(15 downto 8) <= std_logic_vector(a);
                        end case;
                    when JMP =>
                        pc <= k(5 downto 0);
                    when JZ =>
                        if z = '1' then pc <= k(5 downto 0); end if;
                    when JNZ =>
                        if z = '0' then pc <= k(5 downto 0); end if;
                    when JC =>
                        if c = '1' then pc <= k(5 downto 0); end if;
                    when WAIT_T =>
                        if tick = '1' then
                            tick <= '0';
                        else
                            exec <= '1';   -- stay here until the next tick
                        end if;
                    when others =>
                        null;              -- NOP
                end case;
            end if;
        end if;
    end process;

    led_lo <= led_lo_r;
    led_hi <= led_hi_r;
    disp   <= disp_r;
    pc_out <= std_logic_vector(pc);
end rtl;

${HEX7SEG_VHDL}
${VHDL_NUMERIC}
entity top is
    generic (PERIOD : integer := 25_000_000);
    port (
        CLK100MHZ  : in  std_logic;
        CPU_RESETN : in  std_logic;
        SW         : in  std_logic_vector(15 downto 0);
        LED        : out std_logic_vector(15 downto 0);
        CA, CB, CC, CD, CE, CF, CG, DP : out std_logic;
        AN         : out std_logic_vector(7 downto 0)
    );
end top;

architecture rtl of top is
    signal led_lo, led_hi : std_logic_vector(7 downto 0);
    signal disp           : std_logic_vector(15 downto 0);
    signal pc             : std_logic_vector(5 downto 0);
    signal rst            : std_logic;
    signal refresh        : unsigned(17 downto 0) := (others => '0');
    signal digit          : std_logic_vector(1 downto 0);
    signal nibble         : std_logic_vector(3 downto 0);
    signal seg            : std_logic_vector(6 downto 0);
begin
    rst <= not CPU_RESETN;
    cpu : entity work.tiny8
        generic map (PERIOD => PERIOD)
        port map (clk => CLK100MHZ, rst => rst, sw => SW,
                  led_lo => led_lo, led_hi => led_hi, disp => disp, pc_out => pc);

    LED <= led_hi & led_lo;

    -- four hex digits show what the program wrote with OUT 2 and OUT 3
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
        nibble <= disp(3 downto 0)   when "00",
                  disp(7 downto 4)   when "01",
                  disp(11 downto 8)  when "10",
                  disp(15 downto 12) when others;

    decoder : entity work.hex7seg port map (x => nibble, seg => seg);

    CA <= seg(0);  CB <= seg(1);  CC <= seg(2);  CD <= seg(3);
    CE <= seg(4);  CF <= seg(5);  CG <= seg(6);
    DP <= '1';
end rtl;
`;

const ISA = (lang: 'fa' | 'en') => {
  const rows: [string, string, string, string][] = [
    ['0', 'NOP', 'هیچ کار', 'nothing'],
    ['1', 'LDI k', 'A ← k', 'A ← k'],
    ['2', 'LD m', 'A ← ram[m]', 'A ← ram[m]'],
    ['3', 'ST m', 'ram[m] ← A', 'ram[m] ← A'],
    ['4', 'ADD m', 'A ← A + ram[m]، پرچم C = سرریز', 'A ← A + ram[m], C = carry'],
    ['5', 'SUB m', 'A ← A − ram[m]، پرچم C = قرض', 'A ← A − ram[m], C = borrow'],
    ['6', 'ADDI k', 'A ← A + k', 'A ← A + k'],
    ['7', 'ANDI k', 'A ← A AND k', 'A ← A AND k'],
    ['8', 'XORI k', 'A ← A XOR k', 'A ← A XOR k'],
    ['9', 'IN p', 'A ← SW[7:0] (p=0) یا SW[15:8] (p=1)', 'A ← SW[7:0] (p=0) or SW[15:8] (p=1)'],
    ['A', 'OUT p', 'p=0: LD7..0، p=1: LD15..8، p=2/3: نمایشگر', 'p=0: LD7..0, p=1: LD15..8, p=2/3: display'],
    ['B', 'JMP a', 'پرش به a', 'jump to a'],
    ['C', 'JZ a', 'پرش اگر Z = 1', 'jump if Z = 1'],
    ['D', 'JC a', 'پرش اگر C = 1', 'jump if C = 1'],
    ['E', 'WAIT', 'صبر تا تیک بعدی (۰٫۲۵ ثانیه)', 'wait for the next tick (0.25 s)'],
    ['F', 'JNZ a', 'پرش اگر Z = 0', 'jump if Z = 0'],
  ];
  const h = lang === 'fa' ? ['کد', 'دستور', 'کار'] : ['Code', 'Instruction', 'Effect'];
  return `<table class="truth"><tr>${h.map((x) => `<th>${x}</th>`).join('')}</tr>${rows
    .map(([c, n, fa, en]) => `<tr><td>${c}</td><td dir="ltr"><code>${n}</code></td><td>${lang === 'fa' ? fa : en}</td></tr>`)
    .join('')}</table>`;
};
export const TINY8_ISA = ISA;

export const SOFTCORE_LESSON: Lesson = {
  id: 'softcore',
  title: 'پردازنده‌ی نرم (Soft-core): Tiny8',
  summary: 'ساخت یک پردازنده‌ی کوچک ۸ بیتی داخل FPGA و اجرای برنامه‌ای که در ROM آن نوشته شده.',
  body: `
<p>تا اینجا هر کار را با یک مدار جدا ساختیم. راه دیگر این است که داخل FPGA یک <b>پردازنده</b> بسازیم و کار را با <b>برنامه</b> به آن بگوییم. به پردازنده‌ای که از منطق FPGA ساخته می‌شود <b>soft-core</b> می‌گویند. Xilinx پردازنده‌های MicroBlaze و PicoBlaze را دارد. ما اینجا یک پردازنده‌ی کوچک و ساده به اسم <b>Tiny8</b> می‌سازیم که همه‌ی آن در یک صفحه جا می‌شود.</p>
<h3>ساختار Tiny8</h3>
<ul>
  <li><b>ROM برنامه</b>: ۶۴ دستور ۱۲ بیتی. هر دستور یعنی ۴ بیت کد عمل (opcode) و ۸ بیت عدد <code>k</code>.</li>
  <li><b>PC</b> (شمارنده‌ی برنامه): آدرس دستور بعدی.</li>
  <li><b>A</b> (انباره): تنها رجیستر محاسبه. پرچم‌های <b>Z</b> (نتیجه صفر بود) و <b>C</b> (سرریز یا قرض) هم کنار آن هستند.</li>
  <li><b>RAM داده</b>: ۱۶ بایت، برای متغیرها.</li>
  <li><b>ورودی/خروجی</b>: دستور <code>IN</code> کلیدها را می‌خواند و <code>OUT</code> روی LEDها یا نمایشگر می‌نویسد.</li>
</ul>
<h3>واکشی و اجرا</h3>
<p>پردازنده یک FSM دو حالته است. در حالت <b>fetch</b> دستور <code>rom[pc]</code> در رجیستر دستور (<code>ir</code>) ذخیره می‌شود و PC یکی جلو می‌رود. در حالت <b>execute</b> دستور اجرا می‌شود. دستور پرش فقط مقدار PC را عوض می‌کند. پس هر دستور دو کلاک طول می‌کشد، یعنی Tiny8 با کلاک ۱۰۰ مگاهرتز ۵۰ میلیون دستور در ثانیه اجرا می‌کند.</p>
<h3>مجموعه‌ی دستورها</h3>
${ISA('fa')}
<h3>برنامه</h3>
<p>برنامه در همان <code>case</code> داخل ROM نوشته شده است. برنامه‌ی این درس در هر تیک مقدار کلیدهای SW7..SW0 را به یک متغیر اضافه می‌کند و آن را روی LEDها و نمایشگر نشان می‌دهد:</p>
<pre class="formula" dir="ltr">0: LDI 0      ; A = 0
1: ST  0      ; x = 0          (ram[0])
2: IN  0      ; loop: A = SW[7:0]
3: OUT 1      ; LD15..LD8 = step
4: ST  1      ; step = A       (ram[1])
5: LD  0
6: ADD 1      ; A = x + step
7: ST  0
8: OUT 0      ; LD7..LD0 = x
9: OUT 2      ; display = x
10: WAIT      ; 0.25 s
11: JMP 2</pre>
<p>برای تغییر کار پردازنده لازم نیست مدار را عوض کنید، فقط برنامه‌ی ROM را تغییر دهید. پردازنده‌های واقعی هم همین‌طورند: سخت‌افزار ثابت است و نرم‌افزار عوض می‌شود.</p>
<div class="note">در Vivado واقعی برای پردازنده‌های بزرگ مثل MicroBlaze برنامه را با زبان C می‌نویسند، آن را کامپایل می‌کنند و در حافظه‌ی BRAM می‌گذارند. ایده همان است که اینجا می‌بینید.</div>`,
  verilog: CPU_V,
  vhdl: CPU_VHDL,
  xdc: { clk: true, reset: true, sw: true, led: true, seg: true },
  tryIt: `<p><span class="kbd">▶ Run</span> را بزنید و SW0 را روشن کنید: هر ۰٫۲۵ ثانیه عدد روی LEDها و نمایشگر یکی زیاد می‌شود. با SW7..SW0 گام شمارش را عوض کنید. <span class="kbd">CPU_RESET</span> برنامه را از اول اجرا می‌کند.</p>
<p>در شماتیک (RTL Analysis ← Schematic) نمونه‌ی <code>cpu</code> را انتخاب کنید تا مسیر داده‌ی پردازنده را ببینید: رجیستر PC، رجیستر دستور، انباره و RAM.</p>`,
};
