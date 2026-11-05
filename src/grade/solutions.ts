// Reference solutions for the exercises, in Verilog and VHDL. Each one is the lesson's code with the smallest change
// that does the task (edited at module load, so it follows the lesson code), or a short complete design.
// test/exercises.test.ts proves every checker accepts both languages; the lesson page shows them after the hints.
import { HEX_CASE_V, HEX_CASE_VHDL, type Lesson } from '../lessons/lessons';
import { ALL_LESSONS } from '../lessons/course';

const lesson = (id: string): Lesson => {
  const l = ALL_LESSONS.find((x) => x.id === id);
  if (!l) throw new Error(`unknown lesson ${id}`);
  return l;
};

// edits the lesson's code; every edit must match, so a changed lesson breaks the test instead of the solution
function patch(id: string, lang: 'verilog' | 'vhdl', edits: [string | RegExp, string][]): string {
  let s = lesson(id)[lang];
  for (const [from, to] of edits) {
    const n = typeof from === 'string' ? s.split(from).join(to) : s.replace(from, to);
    if (n === s) throw new Error(`${id} (${lang}): edit not applied: ${from}`);
    s = n;
  }
  return s;
}
const edit = (id: string, edits: [string | RegExp, string][]) => patch(id, 'verilog', edits);
const editV = (id: string, edits: [string | RegExp, string][]) => patch(id, 'vhdl', edits);

const HEX7SEG = `module hex7seg (input wire [3:0] x, output reg [6:0] seg);
    always @(*) begin
${HEX_CASE_V}
    end
endmodule
`;

const VERILOG: Record<string, () => string> = {
  intro: () => `module top (input wire [15:0] SW, output reg [15:0] LED);
    integer i;
    always @(*)
        for (i = 0; i < 16; i = i + 1)
            LED[i] = SW[15 - i];
endmodule`,
  gates: () =>
    edit('gates', [
      ['input  wire [1:0] SW', 'input  wire [2:0] SW'],
      ['output wire [6:0] LED', 'output wire [7:0] LED'],
      ['endmodule', '    assign LED[7] = &SW;\nendmodule'],
    ]),
  mux: () =>
    edit('mux', [
      ['output reg  [1:0]  LED', 'output reg  [2:0]  LED'],
      ['LED[0] = y2;', 'LED[0] = y2;\n        LED[2] = SW[SW[15:13]];'],
    ]),
  adder: () => edit('adder', [['wire [3:0] b = SW[7:4];', 'wire [3:0] b = SW[8] ? ~SW[7:4] : SW[7:4];']]),
  seg7: () =>
    edit('seg7', [
      ['input  wire [3:0] SW', 'input  wire [15:0] SW'],
      ['wire [3:0] x = SW;', 'wire [3:0] x = SW[3:0];'],
      ["assign DP = 1'b1;", 'assign DP = ~SW[15];'],
      ["assign AN = 8'b1111_1110;", "assign AN = 8'b0000_0000;"],
    ]),
  decoder: () =>
    edit('decoder', [
      ['output wire [15:0] LED', 'output wire [15:0] LED,\n    output wire [7:0]  AN'],
      ['endmodule', "    assign AN = ~(8'b1 << SW[1:0]) | 8'hF0;\nendmodule"],
    ]),
  shifter: () =>
    edit('shifter', [
      [
        'assign LED = {a, s2};',
        'wire [7:0] sh = left ? (a << SW[10:8]) : (a >> SW[10:8]);\n    assign LED = {a, SW[14] ? sh : s2};',
      ],
    ]),
  alu: () =>
    HEX7SEG +
    edit('alu', [
      ['output wire [15:0] LED', 'output wire [15:0] LED,\n    output wire CA, CB, CC, CD, CE, CF, CG, DP,\n    output wire [7:0] AN'],
      [
        'endmodule',
        "    wire [6:0] seg;\n    hex7seg dec (.x(r[3:0]), .seg(seg));\n    assign {CG, CF, CE, CD, CC, CB, CA} = seg;\n    assign DP = 1'b1;\n    assign AN = 8'hFE;\nendmodule",
      ],
    ]),
  ff: () =>
    edit('ff', [
      ['input  wire        BTNC,', 'input  wire        BTNC, BTNU, BTND,'],
      [
        'LED <= SW;        // capture the switches while BTNC is pressed',
        "LED <= SW;\n        else if (BTNU)\n            LED <= {LED[14:0], 1'b0};\n        else if (BTND)\n            LED <= {1'b0, LED[15:1]};",
      ],
    ]),
  counter: () => `module top #(parameter DIV = 10_000_000) (
    input  wire        CLK100MHZ,
    input  wire        CPU_RESETN,
    output reg  [15:0] LED = 16'h0001
);
    reg [31:0] cnt = 0;
    reg        dir = 0;
    always @(posedge CLK100MHZ) begin
        if (!CPU_RESETN) begin
            cnt <= 0; LED <= 16'h0001; dir <= 0;
        end else if (cnt == DIV - 1) begin
            cnt <= 0;
            if (!dir) begin
                if (LED[14]) dir <= 1;
                LED <= LED << 1;
            end else begin
                if (LED[1]) dir <= 0;
                LED <= LED >> 1;
            end
        end else
            cnt <= cnt + 1;
    end
endmodule`,
  shiftreg: () => `module top #(parameter DIV = 25_000_000) (
    input  wire        CLK100MHZ,
    input  wire        CPU_RESETN,
    input  wire [15:0] SW,
    output wire [15:0] LED
);
    reg  [31:0] cnt = 0;
    wire        tick = (cnt == DIV - 1);
    always @(posedge CLK100MHZ)
        cnt <= tick ? 0 : cnt + 1;
    reg [15:0] q = 16'h0001;
    always @(posedge CLK100MHZ)
        if (!CPU_RESETN) q <= 16'h0001;
        else if (tick)   q <= {q[14:0], q[15] ^ q[13] ^ q[12] ^ q[10]};
    assign LED = q;
endmodule`,
  multiplex: () =>
    edit('multiplex', [
      ['module top (', 'module top #(parameter DIV = 100_000_000) ('],
      ['reg  [17:0] refresh = 0;', "reg  [18:0] refresh = 0;\n    reg  [31:0] pre = 0;\n    reg  [15:0] cnt = 0;\n    always @(posedge CLK100MHZ)\n        if (pre == DIV - 1) begin pre <= 0; cnt <= cnt + 1; end\n        else pre <= pre + 1;"],
      ['wire [1:0]  digit = refresh[17:16];', 'wire [2:0]  digit = refresh[18:16];'],
      [
        /case \(digit\)[\s\S]*?endcase/,
        "case (digit)\n            3'd0: nibble = SW[3:0];\n            3'd1: nibble = SW[7:4];\n            3'd2: nibble = SW[11:8];\n            3'd3: nibble = SW[15:12];\n            3'd4: nibble = cnt[3:0];\n            3'd5: nibble = cnt[7:4];\n            3'd6: nibble = cnt[11:8];\n            default: nibble = cnt[15:12];\n        endcase",
      ],
    ]),
  stopwatch: () =>
    edit('stopwatch', [
      ['module top (', 'module top #(parameter DIV = 10_000_000) ('],
      ["reg  [23:0] ms = 0;\n    wire        tick = (ms == 24'd9_999_999);", 'reg  [31:0] ms = 0;\n    wire        tick = (ms == DIV - 1);'],
      ["ms <= tick ? 24'd0 : ms + 1;", 'ms <= tick ? 0 : ms + 1;'],
      ['reg [3:0] d0 = 0, d1 = 0, d2 = 0;', 'reg [3:0] d0 = 0, d1 = 0, d2 = 0, d3 = 0;'],
      ['d0 <= 0; d1 <= 0; d2 <= 0;', 'd0 <= 0; d1 <= 0; d2 <= 0; d3 <= 0;'],
      [
        "d2 <= (d2 == 4'd9) ? 4'd0 : d2 + 1;",
        "if (d2 != 4'd5) d2 <= d2 + 1;\n                        else begin\n                            d2 <= 0;\n                            d3 <= (d3 == 4'd9) ? 4'd0 : d3 + 1;\n                        end",
      ],
      ['default: ;                            // digit 3 stays dark', "default: begin AN[3] = 1'b0; nibble = d3; end"],
    ]),
  fsm: () =>
    edit('fsm', [
      ['module top (', 'module top #(parameter integer ONE_SECOND = 100_000_000) ('],
      ['    localparam integer ONE_SECOND = 100_000_000;\n', ''],
      ['input  wire BTNC,          // pedestrian request', 'input  wire BTNC,\n    input  wire [15:0] SW,'],
      ['if (!CPU_RESETN) begin', 'if (!CPU_RESETN || SW[0]) begin'],
      [
        '// Moore outputs',
        "reg [27:0] nt = 0;\n    reg        nb = 1'b1;\n    always @(posedge CLK100MHZ)\n        if (!SW[0]) begin nt <= 0; nb <= 1'b1; end\n        else if (nt == ONE_SECOND / 2 - 1) begin nt <= 0; nb <= ~nb; end\n        else nt <= nt + 1;\n\n    // Moore outputs",
      ],
      [
        'LED16_B = 1\'b0;',
        "LED16_B = 1'b0;\n        if (SW[0]) begin LED16_R = nb; LED16_G = nb; end",
      ],
    ]),
  debounce: () =>
    edit('debounce', [
      [
        'assign LED = {db_cnt, raw_cnt};',
        "wire dbu, dbu_tick;\n    debounce    u_dbu (.clk(CLK100MHZ), .sw(BTNU), .db(dbu));\n    edge_detect e_dbu (.clk(CLK100MHZ), .level(dbu), .tick(dbu_tick));\n    reg [15:0] r = 16'h0001;\n    always @(posedge CLK100MHZ)\n        if (dbu_tick) r <= {r[14:0], r[15]};\n    assign LED = r;",
      ],
    ]),
  bin2bcd: () =>
    edit('bin2bcd', [
      ['input  wire [15:0] SW,\n    output wire [15:0] LED,', 'input  wire [15:0] SW,\n    input  wire        BTNC,\n    output wire [15:0] LED,'],
      [".start(1'b1)", '.start(BTNC)'],
      ["assign LED = {3'b000, SW[12:0]};", "assign LED = {ready, 2'b00, SW[12:0]};"],
    ]),
  ram: () => `module top #(parameter DIV = 50_000_000) (
    input  wire        CLK100MHZ,
    input  wire [15:0] SW,
    input  wire        BTNC,
    output wire [15:0] LED
);
    reg [31:0] cnt = 0;
    reg [2:0]  i = 0;
    reg [7:0]  ch;
    always @(*)
        case (i)
            3'd0: ch = 8'h48;
            3'd1: ch = 8'h45;
            3'd2, 3'd3: ch = 8'h4C;
            default: ch = 8'h4F;
        endcase
    always @(posedge CLK100MHZ)
        if (cnt == DIV - 1) begin
            cnt <= 0;
            i <= (i == 3'd4) ? 3'd0 : i + 1;
        end else
            cnt <= cnt + 1;
    assign LED = {8'b0, ch};
endmodule`,
  pwm: () =>
    edit('pwm', [
      ['module top (', 'module top #(parameter DIV = 200_000) ('],
      [
        'wire r, g;',
        "wire r, g, br;\n    reg [31:0] c = 0;\n    reg [7:0]  d = 0;\n    reg        up = 1'b1;\n    always @(posedge CLK100MHZ)\n        if (c == DIV - 1) begin\n            c <= 0;\n            if (up) begin if (d == 8'd254) up <= 1'b0; d <= d + 1; end\n            else    begin if (d == 8'd1)   up <= 1'b1; d <= d - 1; end\n        end else c <= c + 1;\n    pwm #(.W(8)) pwm_b (.clk(CLK100MHZ), .duty(d), .pwm_o(br));",
      ],
      ['assign LED = {14\'b0, g, r};', "assign LED = {14'b0, g, br};"],
    ]),
  uart: () => edit('uart', [['868', '10417']]),
  uart_rx: () => edit('uart_rx', [['868', '10417']]),
  spi: () =>
    edit('spi', [
      ['parameter DIV = 50', 'parameter DIV = 5'],
      ["output reg        sclk = 1'b0,", "output reg        sclk = 1'b1,"],
      [
        /XFER:\n\s*if \(half\) begin[\s\S]*?\n {16}end\n/,
        "XFER:\n                if (half) begin\n                    if (sclk) begin            // falling edge: put out the next bit\n                        sclk <= 1'b0;\n                        if (n != 0) begin\n                            sh   <= {sh[6:0], 1'b0};\n                            mosi <= sh[6];\n                        end\n                    end else begin             // rising edge: both sides sample\n                        sclk <= 1'b1;\n                        rsh  <= {rsh[6:0], miso};\n                        if (n == 3'd7) state <= TAIL;\n                        else           n <= n + 1;\n                    end\n                end\n",
      ],
    ]),
  i2c: () =>
    edit('i2c', [
      ['wire       sda = !(m_low || d_low);', 'wire       d2_low;\n    wire [7:0] stored2;\n    wire       sda = !(m_low || d_low || d2_low);'],
      [
        'assign JB  = {sda, scl};',
        "i2c_device #(.ADDR(7'h49)) sensor2 (.clk(CLK100MHZ), .scl(scl), .sda(sda), .sda_low(d2_low), .data(stored2));\n\n    assign JB  = {sda, scl};",
      ],
    ]),
  sensors: () =>
    edit('sensors', [
      ['output wire [15:0] LED,', 'output wire [15:0] LED,\n    output wire        LED16_R, LED16_G, LED16_B,'],
      ["assign LED = {nack, 2'b00, t16};", "assign LED = {nack, 2'b00, t16};\n    wire hot = !neg && (t16 >= 13'd480);   // 30.0 degrees = 480 sixteenths\n    assign LED16_R = hot;\n    assign LED16_G = !hot;\n    assign LED16_B = 1'b0;"],
    ]),
  ps2: () =>
    edit('ps2', [
      [
        'wire [15:0] show = {before, last};',
        `reg  [15:0] num = 0;
    reg  [3:0]  d;
    reg         isd;
    always @(*) begin
        isd = 1'b1;
        case (code)
            8'h45: d = 4'd0;  8'h16: d = 4'd1;  8'h1E: d = 4'd2;  8'h26: d = 4'd3;  8'h25: d = 4'd4;
            8'h2E: d = 4'd5;  8'h36: d = 4'd6;  8'h3D: d = 4'd7;  8'h3E: d = 4'd8;  8'h46: d = 4'd9;
            default: begin d = 4'd0; isd = 1'b0; end
        endcase
    end
    always @(posedge CLK100MHZ)
        if (done && !brk && code != 8'hF0 && code != 8'hE0) begin
            if (isd)                num <= {num[11:0], d};
            else if (code == 8'h66) num <= 0;
        end
    wire [15:0] show = num;`,
      ],
    ]),
  softcore: () =>
    edit('softcore', [
      [
        /6'd0: {2}rom = \{LDI, {2}8'd0\};[\s\S]*?6'd11: rom = \{JMP, {2}8'd2\};/,
        `6'd0:  rom = {LDI,  8'd1};
            6'd1:  rom = {ST,   8'd0};     // x = 1
            6'd2:  rom = {LDI,  8'd2};
            6'd3:  rom = {ST,   8'd1};     // y = 2
            6'd4:  rom = {LD,   8'd0};     // loop: A = x
            6'd5:  rom = {OUT,  8'd0};
            6'd6:  rom = {WAIT, 8'd0};
            6'd7:  rom = {XORI, 8'd233};   // x == 233: start again
            6'd8:  rom = {JZ,   8'd0};
            6'd9:  rom = {LD,   8'd0};
            6'd10: rom = {ADD,  8'd1};
            6'd11: rom = {ST,   8'd2};     // t = x + y
            6'd12: rom = {LD,   8'd1};
            6'd13: rom = {ST,   8'd0};     // x = y
            6'd14: rom = {LD,   8'd2};
            6'd15: rom = {ST,   8'd1};     // y = t
            6'd16: rom = {JMP,  8'd4};`,
      ],
    ]),
  vga: () =>
    edit('vga', [
      [
        'wire [11:0] rgb   = SW[0] ? check : bar;',
        'wire        sq    = (x >= 270) && (x < 370) && (y >= 190) && (y < 290);\n    wire [11:0] rgb   = sq ? SW[15:4] : SW[0] ? check : bar;',
      ],
    ]),
};


const HEX7SEG_VHDL = `library ieee;
use ieee.std_logic_1164.all;

entity hex7seg is
    port (
        x   : in  std_logic_vector(3 downto 0);
        seg : out std_logic_vector(6 downto 0)
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

const VHDL: Record<string, () => string> = {
  intro: () => `library ieee;
use ieee.std_logic_1164.all;

entity top is
    port (
        SW  : in  std_logic_vector(15 downto 0);
        LED : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
begin
    process(SW)
    begin
        for i in 0 to 15 loop
            LED(i) <= SW(15 - i);
        end loop;
    end process;
end rtl;`,
  gates: () =>
    editV('gates', [
      ['SW  : in  std_logic_vector(1 downto 0)', 'SW  : in  std_logic_vector(2 downto 0)'],
      ['LED : out std_logic_vector(6 downto 0)', 'LED : out std_logic_vector(7 downto 0)'],
      ['end rtl;', "    LED(7) <= SW(0) and SW(1) and SW(2);   -- 3-input AND\nend rtl;"],
    ]),
  mux: () =>
    editV('mux', [
      ['use ieee.std_logic_1164.all;', 'use ieee.std_logic_1164.all;\nuse ieee.numeric_std.all;'],
      ['LED : out std_logic_vector(1 downto 0)', 'LED : out std_logic_vector(2 downto 0)'],
      ['end rtl;', '    -- 8:1 MUX: SW(15 downto 13) picks one of SW(7 downto 0)\n    LED(2) <= SW(to_integer(unsigned(SW(15 downto 13))));\nend rtl;'],
    ]),
  adder: () => editV('adder', [['b    <= SW(7 downto 4);', "b    <= not SW(7 downto 4) when SW(8) = '1' else SW(7 downto 4);"]]),
  seg7: () =>
    editV('seg7', [
      ['SW : in  std_logic_vector(3 downto 0);', 'SW : in  std_logic_vector(15 downto 0);'],
      ['x <= SW;', 'x <= SW(3 downto 0);'],
      ["DP <= '1';                -- decimal point off", 'DP <= not SW(15);         -- SW15 lights the decimal point'],
      ['AN <= "11111110";         -- only digit 0 on', 'AN <= "00000000";         -- all eight digits on'],
    ]),
  decoder: () =>
    editV('decoder', [
      ['LED : out std_logic_vector(15 downto 0)', 'LED : out std_logic_vector(15 downto 0);\n        AN  : out std_logic_vector(7 downto 0)'],
      [
        'end rtl;',
        `    -- 2-to-4 decoder on AN3..AN0 (active-low); AN7..AN4 stay off
    with SW(1 downto 0) select
        AN <= "11111110" when "00",
              "11111101" when "01",
              "11111011" when "10",
              "11110111" when others;
end rtl;`,
      ],
    ]),
  shifter: () =>
    editV('shifter', [
      ['signal amt : unsigned(2 downto 0);', 'signal amt : unsigned(2 downto 0);\n    signal sh  : std_logic_vector(7 downto 0);'],
      [
        'LED <= a & s2;',
        `-- SW14 = 1: logical shift, zeros fill in
    sh <= std_logic_vector(shift_left(unsigned(a), to_integer(unsigned(SW(10 downto 8))))) when SW(15) = '1' else
          std_logic_vector(shift_right(unsigned(a), to_integer(unsigned(SW(10 downto 8)))));
    LED <= a & sh when SW(14) = '1' else a & s2;`,
      ],
    ]),
  alu: () =>
    HEX7SEG_VHDL +
    editV('alu', [
      ['LED : out std_logic_vector(15 downto 0)', 'LED : out std_logic_vector(15 downto 0);\n        CA, CB, CC, CD, CE, CF, CG, DP : out std_logic;\n        AN  : out std_logic_vector(7 downto 0)'],
      ['signal zero    : std_logic;', 'signal zero    : std_logic;\n    signal seg     : std_logic_vector(6 downto 0);'],
      [
        'end rtl;',
        `    -- the result as a hex digit on AN0
    dec : entity work.hex7seg port map (x => std_logic_vector(r(3 downto 0)), seg => seg);
    CA <= seg(0);  CB <= seg(1);  CC <= seg(2);  CD <= seg(3);
    CE <= seg(4);  CF <= seg(5);  CG <= seg(6);
    DP <= '1';
    AN <= "11111110";
end rtl;`,
      ],
    ]),
  ff: () =>
    editV('ff', [
      ['BTNC       : in  std_logic;', 'BTNC       : in  std_logic;\n        BTNU, BTND : in  std_logic;'],
      [
        'q <= SW;      -- capture the switches while BTNC is pressed',
        "q <= SW;\n            elsif BTNU = '1' then\n                q <= q(14 downto 0) & '0';   -- shift left\n            elsif BTND = '1' then\n                q <= '0' & q(15 downto 1);   -- shift right",
      ],
    ]),
  counter: () => `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

-- Knight Rider: one LED bounces between LD0 and LD15, one step every DIV clocks
entity top is
    generic (DIV : integer := 10_000_000);
    port (
        CLK100MHZ  : in  std_logic;
        CPU_RESETN : in  std_logic;
        LED        : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal cnt : integer range 0 to DIV - 1 := 0;
    signal q   : std_logic_vector(15 downto 0) := x"0001";
    signal dir : std_logic := '0';   -- 0 = left, 1 = right
begin
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if CPU_RESETN = '0' then
                cnt <= 0;
                q   <= x"0001";
                dir <= '0';
            elsif cnt = DIV - 1 then
                cnt <= 0;
                if dir = '0' then
                    if q(14) = '1' then
                        dir <= '1';
                    end if;
                    q <= q(14 downto 0) & '0';
                else
                    if q(1) = '1' then
                        dir <= '0';
                    end if;
                    q <= '0' & q(15 downto 1);
                end if;
            else
                cnt <= cnt + 1;
            end if;
        end if;
    end process;

    LED <= q;
end rtl;`,
  shiftreg: () => `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

-- a 16-bit LFSR on the LEDs, one step every DIV clocks
entity top is
    generic (DIV : integer := 25_000_000);
    port (
        CLK100MHZ  : in  std_logic;
        CPU_RESETN : in  std_logic;
        SW         : in  std_logic_vector(15 downto 0);
        LED        : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal cnt  : integer range 0 to DIV - 1 := 0;
    signal tick : std_logic;
    signal q    : std_logic_vector(15 downto 0) := x"0001";
begin
    tick <= '1' when cnt = DIV - 1 else '0';
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if tick = '1' then
                cnt <= 0;
            else
                cnt <= cnt + 1;
            end if;
        end if;
    end process;

    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if CPU_RESETN = '0' then
                q <= x"0001";
            elsif tick = '1' then
                q <= q(14 downto 0) & (q(15) xor q(13) xor q(12) xor q(10));
            end if;
        end if;
    end process;

    LED <= q;
end rtl;`,
  multiplex: () =>
    editV('multiplex', [
      ['entity top is\n    port (', 'entity top is\n    generic (DIV : integer := 100_000_000);\n    port ('],
      [
        'signal refresh : unsigned(17 downto 0) := (others => \'0\');\n    signal digit   : std_logic_vector(1 downto 0);',
        "signal refresh : unsigned(18 downto 0) := (others => '0');\n    signal digit   : std_logic_vector(2 downto 0);\n    signal pre     : integer range 0 to DIV - 1 := 0;\n    signal cnt     : unsigned(15 downto 0) := (others => '0');",
      ],
      [
        "            refresh <= refresh + 1;\n        end if;\n    end process;",
        "            refresh <= refresh + 1;\n            if pre = DIV - 1 then      -- the counter on digits 7..4\n                pre <= 0;\n                cnt <= cnt + 1;\n            else\n                pre <= pre + 1;\n            end if;\n        end if;\n    end process;",
      ],
      ['digit <= std_logic_vector(refresh(17 downto 16));', 'digit <= std_logic_vector(refresh(18 downto 16));'],
      [
        /with digit select\n {8}AN <=[\s\S]*?SW\(15 downto 12\) when others;/,
        `with digit select
        AN <= "11111110" when "000",
              "11111101" when "001",
              "11111011" when "010",
              "11110111" when "011",
              "11101111" when "100",
              "11011111" when "101",
              "10111111" when "110",
              "01111111" when others;

    with digit select
        nibble <= SW(3 downto 0)   when "000",
                  SW(7 downto 4)   when "001",
                  SW(11 downto 8)  when "010",
                  SW(15 downto 12) when "011",
                  std_logic_vector(cnt(3 downto 0))   when "100",
                  std_logic_vector(cnt(7 downto 4))   when "101",
                  std_logic_vector(cnt(11 downto 8))  when "110",
                  std_logic_vector(cnt(15 downto 12)) when others;`,
      ],
    ]),
  stopwatch: () =>
    editV('stopwatch', [
      ['entity top is\n    port (', 'entity top is\n    generic (DIV : integer := 10_000_000);\n    port ('],
      ["signal ms         : unsigned(23 downto 0) := (others => '0');", 'signal ms         : integer range 0 to DIV - 1 := 0;'],
      ["signal d0, d1, d2 : unsigned(3 downto 0) := (others => '0');   -- tenths, seconds, tens", "signal d0, d1, d2 : unsigned(3 downto 0) := (others => '0');   -- tenths, seconds, tens\n    signal d3         : unsigned(3 downto 0) := (others => '0');   -- minutes"],
      ["                ms <= (others => '0');\n                d0", "                ms <= 0;\n                d3 <= (others => '0');\n                d0"],
      ['if ms = 9_999_999 then           -- 0.1 s tick\n                    ms <= (others => \'0\');', 'if ms = DIV - 1 then             -- 0.1 s tick\n                    ms <= 0;'],
      [
        "                            if d2 /= 9 then\n                                d2 <= d2 + 1;\n                            else\n                                d2 <= (others => '0');\n                            end if;",
        "                            if d2 /= 5 then\n                                d2 <= d2 + 1;\n                            else\n                                d2 <= (others => '0');\n                                if d3 /= 9 then\n                                    d3 <= d3 + 1;\n                                else\n                                    d3 <= (others => '0');\n                                end if;\n                            end if;",
      ],
      ['"11111111" when others;   -- digit 3 stays dark', '"11110111" when others;   -- digit 3: minutes'],
      ['std_logic_vector(d2) when "10",', 'std_logic_vector(d2) when "10",\n                  std_logic_vector(d3) when "11",'],
    ]),
  fsm: () =>
    editV('fsm', [
      ['entity top is\n    port (', 'entity top is\n    generic (ONE_SECOND : integer := 100_000_000);\n    port ('],
      ['    constant ONE_SECOND : integer := 100_000_000;\n', ''],
      ["BTNC       : in  std_logic;   -- pedestrian request", "BTNC       : in  std_logic;   -- pedestrian request\n        SW         : in  std_logic_vector(15 downto 0);"],
      ['signal timer : integer range 0 to 2 * ONE_SECOND := 0;', "signal timer : integer range 0 to 2 * ONE_SECOND := 0;\n    signal nt    : integer range 0 to ONE_SECOND := 0;   -- night mode: half-second blink\n    signal nb    : std_logic := '1';"],
      ["if CPU_RESETN = '0' then", "if CPU_RESETN = '0' or SW(0) = '1' then"],
      [
        '    -- Moore outputs: depend only on the current state',
        `    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if SW(0) = '0' then
                nt <= 0;
                nb <= '1';
            elsif nt = ONE_SECOND / 2 - 1 then
                nt <= 0;
                nb <= not nb;
            else
                nt <= nt + 1;
            end if;
        end if;
    end process;

    -- Moore outputs: depend only on the current state (night mode: flashing yellow)`,
      ],
      ["LED16_R <= '1' when state = RED or state = YELLOW else '0';", "LED16_R <= nb when SW(0) = '1' else '1' when state = RED or state = YELLOW else '0';"],
      ["LED16_G <= '1' when state = GREEN or state = YELLOW else '0';", "LED16_G <= nb when SW(0) = '1' else '1' when state = GREEN or state = YELLOW else '0';"],
    ]),
  debounce: () =>
    editV('debounce', [
      ["signal raw_cnt, db_cnt       : unsigned(7 downto 0) := (others => '0');", "signal raw_cnt, db_cnt       : unsigned(7 downto 0) := (others => '0');\n    signal dbu, dbu_tick         : std_logic;\n    signal r                     : std_logic_vector(15 downto 0) := x\"0001\";"],
      [
        'LED <= std_logic_vector(db_cnt) & std_logic_vector(raw_cnt);',
        `-- BTNU, debounced: every press rotates the register left by one
    u_dbu : entity work.debounce    port map (clk => CLK100MHZ, sw => BTNU, db => dbu);
    e_dbu : entity work.edge_detect port map (clk => CLK100MHZ, level => dbu, tick => dbu_tick);
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if dbu_tick = '1' then
                r <= r(14 downto 0) & r(15);
            end if;
        end if;
    end process;
    LED <= r;`,
      ],
    ]),
  bin2bcd: () =>
    editV('bin2bcd', [
      ['SW        : in  std_logic_vector(15 downto 0);\n        LED', 'SW        : in  std_logic_vector(15 downto 0);\n        BTNC      : in  std_logic;\n        LED'],
      ["start => '1'", 'start => BTNC'],
      ['LED <= "000" & SW(12 downto 0);', 'LED <= ready & "00" & SW(12 downto 0);'],
    ]),
  ram: () => `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

-- a ROM with "HELLO", one letter every DIV clocks
entity top is
    generic (DIV : integer := 50_000_000);
    port (
        CLK100MHZ : in  std_logic;
        SW        : in  std_logic_vector(15 downto 0);
        BTNC      : in  std_logic;
        LED       : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal cnt : integer range 0 to DIV - 1 := 0;
    signal i   : integer range 0 to 4 := 0;
    signal ch  : std_logic_vector(7 downto 0);
begin
    -- the ROM: a case on the address
    process(i)
    begin
        case i is
            when 0      => ch <= x"48";   -- H
            when 1      => ch <= x"45";   -- E
            when 2 | 3  => ch <= x"4C";   -- L
            when others => ch <= x"4F";   -- O
        end case;
    end process;

    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if cnt = DIV - 1 then
                cnt <= 0;
                if i = 4 then
                    i <= 0;
                else
                    i <= i + 1;
                end if;
            else
                cnt <= cnt + 1;
            end if;
        end if;
    end process;

    LED <= x"00" & ch;
end rtl;`,
  pwm: () =>
    editV('pwm', [
      ['-- two brightness channels on the RGB LED LD16\nentity top is\n    port (', '-- two brightness channels on the RGB LED LD16\nentity top is\n    generic (DIV : integer := 200_000);\n    port ('],
      [
        'signal r, g : std_logic;',
        "signal r, g, br : std_logic;\n    signal c  : integer range 0 to DIV - 1 := 0;\n    signal d  : unsigned(7 downto 0) := (others => '0');   -- breathing duty\n    signal up : std_logic := '1';",
      ],
      [
        "    LED16_R <= r;",
        `    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if c = DIV - 1 then
                c <= 0;
                if up = '1' then
                    if d = 254 then up <= '0'; end if;
                    d <= d + 1;
                else
                    if d = 1 then up <= '1'; end if;
                    d <= d - 1;
                end if;
            else
                c <= c + 1;
            end if;
        end if;
    end process;
    pwm_b : entity work.pwm generic map (W => 8) port map (clk => CLK100MHZ, duty => std_logic_vector(d), pwm_o => br);

    LED16_R <= r;`,
      ],
      ['LED <= "00000000000000" & g & r;', 'LED <= "00000000000000" & g & br;'],
    ]),
  uart: () => editV('uart', [['868', '10417']]),
  uart_rx: () => editV('uart_rx', [['868', '10417']]),
  spi: () =>
    editV('spi', [
      ['generic (DIV : integer := 50);', 'generic (DIV : integer := 5); '],
      ["signal sclkr, mosir   : std_logic := '0';", "signal sclkr          : std_logic := '1';   -- mode 3: SCLK idles high\n    signal mosir          : std_logic := '0';"],
      [
        /when XFER =>\n {20}if half = '1' then[\s\S]*?\n {20}end if;\n(?= {16}when TAIL)/,
        `when XFER =>
                    if half = '1' then
                        if sclkr = '1' then      -- falling edge: put out the next bit
                            sclkr <= '0';
                            if n /= 0 then
                                sh    <= sh(6 downto 0) & '0';
                                mosir <= sh(6);
                            end if;
                        else                     -- rising edge: both sides sample
                            sclkr <= '1';
                            rsh   <= rsh(6 downto 0) & miso;
                            if n = 7 then
                                state <= TAIL;
                            else
                                n <= n + 1;
                            end if;
                        end if;
                    end if;
`,
      ],
    ]),
  i2c: () =>
    editV('i2c', [
      ['signal scl, sda, m_low, d_low, nack, busy, go : std_logic;', 'signal scl, sda, m_low, d_low, d2_low, nack, busy, go : std_logic;'],
      ['signal rdata, stored : std_logic_vector(7 downto 0);', 'signal rdata, stored, stored2 : std_logic_vector(7 downto 0);'],
      ['sda <= not (m_low or d_low);', 'sda <= not (m_low or d_low or d2_low);'],
      [
        'JB  <= sda & scl;',
        `sensor2 : entity work.i2c_device
        generic map (ADDR => "1001001")      -- a second device at 0x49
        port map (clk => CLK100MHZ, scl => scl, sda => sda, sda_low => d2_low, data => stored2);

    JB  <= sda & scl;`,
      ],
    ]),
  sensors: () =>
    editV('sensors', [
      ['LED       : out   std_logic_vector(15 downto 0);', 'LED       : out   std_logic_vector(15 downto 0);\n        LED16_R, LED16_G, LED16_B : out std_logic;'],
      ['signal digit   : unsigned(1 downto 0);', 'signal digit   : unsigned(1 downto 0);\n    signal hot     : std_logic;'],
      [
        'LED <= nack & "00" & std_logic_vector(t16);',
        `LED <= nack & "00" & std_logic_vector(t16);

    -- 30.0 degrees and up = 480 sixteenths: red, otherwise green
    hot     <= '1' when t16 >= 480 else '0';
    LED16_R <= hot;
    LED16_G <= not hot;
    LED16_B <= '0';`,
      ],
    ]),
  ps2: () =>
    editV('ps2', [
      ['signal show               : std_logic_vector(15 downto 0);', "signal show               : std_logic_vector(15 downto 0);\n    signal num                : std_logic_vector(15 downto 0) := (others => '0');\n    signal d                  : std_logic_vector(3 downto 0);\n    signal isd                : std_logic;"],
      [
        'show <= before & last;',
        `-- digit keys: their make code to a BCD digit
    process(code)
    begin
        isd <= '1';
        case code is
            when x"45" => d <= x"0";  when x"16" => d <= x"1";  when x"1E" => d <= x"2";
            when x"26" => d <= x"3";  when x"25" => d <= x"4";  when x"2E" => d <= x"5";
            when x"36" => d <= x"6";  when x"3D" => d <= x"7";  when x"3E" => d <= x"8";
            when x"46" => d <= x"9";
            when others => d <= x"0"; isd <= '0';
        end case;
    end process;

    -- a make code (not a release) shifts the digit in from the right; Backspace (66) clears
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if done = '1' and brk = '0' and code /= x"F0" and code /= x"E0" then
                if isd = '1' then
                    num <= num(11 downto 0) & d;
                elsif code = x"66" then
                    num <= (others => '0');
                end if;
            end if;
        end if;
    end process;
    show <= num;`,
      ],
    ]),
  vga: () =>
    editV('vga', [
      ['signal bar, check, rgb : std_logic_vector(11 downto 0);', 'signal bar, check, rgb : std_logic_vector(11 downto 0);\n    signal sq     : std_logic;'],
      [
        "rgb   <= check when SW(0) = '1' else bar;",
        "-- a 100 x 100 square in the middle, coloured by SW15..SW4\n    sq    <= '1' when x >= 270 and x < 370 and y >= 190 and y < 290 else '0';\n    rgb   <= SW(15 downto 4) when sq = '1' else check when SW(0) = '1' else bar;",
      ],
    ]),
  softcore: () =>
    editV('softcore', [
      [
        /when 0 {2}=> rom <= LDI {4}& x"00";[\s\S]*?when 11 => rom <= JMP {4}& x"02";/,
        `when 0  => rom <= LDI    & x"01";
            when 1  => rom <= ST     & x"00";   -- x = 1
            when 2  => rom <= LDI    & x"02";
            when 3  => rom <= ST     & x"01";   -- y = 2
            when 4  => rom <= LD     & x"00";   -- loop: A = x
            when 5  => rom <= OUTP   & x"00";
            when 6  => rom <= WAIT_T & x"00";
            when 7  => rom <= XORI   & x"E9";   -- x = 233: start again
            when 8  => rom <= JZ     & x"00";
            when 9  => rom <= LD     & x"00";
            when 10 => rom <= ADD    & x"01";
            when 11 => rom <= ST     & x"02";   -- t = x + y
            when 12 => rom <= LD     & x"01";
            when 13 => rom <= ST     & x"00";   -- x = y
            when 14 => rom <= LD     & x"02";
            when 15 => rom <= ST     & x"01";   -- y = t
            when 16 => rom <= JMP    & x"04";`,
      ],
    ]),
};

// the testbench exercise: its solution is a testbench that resets in the middle of the run and checks the counter
const TB: Record<'verilog' | 'vhdl', () => string> = {
  verilog: () =>
    lesson('testbench').tb!.verilog.replace(
      '        $finish;',
      `        // reset in the middle of the run: the counter must go back to zero
        SW[0] = 1;
        repeat (8) @(posedge CLK100MHZ);
        CPU_RESETN = 0;
        repeat (3) @(posedge CLK100MHZ);
        #1;
        if (LED[7:0] !== 8'd0)
            $error("reset did not clear the counter");
        $finish;`,
    ),
  vhdl: () =>
    lesson('testbench').tb!.vhdl.replace(
      '        std.env.finish;',
      `        -- reset in the middle of the run: the counter must go back to zero
        SW(0) <= '1';
        for i in 1 to 8 loop
            wait until rising_edge(CLK100MHZ);
        end loop;
        CPU_RESETN <= '0';
        for i in 1 to 3 loop
            wait until rising_edge(CLK100MHZ);
        end loop;
        wait for 1 ns;
        assert LED(7 downto 0) = x"00" report "reset did not clear the counter" severity error;
        std.env.finish;`,
    ),
};

// the reference solution of an exercise (for the testbench exercise: the testbench)
export function solutionOf(id: string): { verilog: string; vhdl: string } | undefined {
  if (id === 'testbench') return { verilog: TB.verilog(), vhdl: TB.vhdl() };
  if (!VERILOG[id] || !VHDL[id]) return undefined;
  return { verilog: VERILOG[id](), vhdl: VHDL[id]() };
}
export const SOLUTION_IDS = [...new Set([...Object.keys(VERILOG), ...Object.keys(VHDL), 'testbench'])];
