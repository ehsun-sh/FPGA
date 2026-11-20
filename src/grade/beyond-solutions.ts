// Reference solutions for chapter 8 and the guided project (Phase 4.3, 4.4), in Verilog and VHDL.
// Like solutions.ts: the lesson code with the smallest change that does the task; every edit must apply.
import { BRAM_V, BRAM_VHDL, CDC_V, CDC_VHDL, CLOCKING_V, CLOCKING_VHDL, CLOCK_SOLUTION_V, CLOCK_SOLUTION_VHDL, TIMING_V, TIMING_VHDL } from '../lessons/beyond-code';

function patch(id: string, src: string, edits: [string, string][]): string {
  let s = src;
  for (const [from, to] of edits) {
    if (!s.includes(from)) throw new Error(`${id}: edit not applied: ${from}`);
    s = s.split(from).join(to);
  }
  return s;
}

export const BEYOND_SOLUTIONS: Record<string, () => { verilog: string; vhdl: string }> = {
  // a register in the middle of the chain: two short paths instead of one long one (one clock more latency)
  timing: () => ({
    verilog: patch('timing', TIMING_V, [
      ['    reg [31:0] y = 0;             // output register\n', '    reg [31:0] y = 0;             // output register\n    reg [23:0] p = 0;             // pipeline register\n    reg [7:0]  a2 = 0, b2 = 0;    // a and b, delayed to match p\n'],
      [
        '        // three multipliers and two adders in a row: one long register-to-register path\n        y <= ((a * b + a) * b + b) * a;',
        '        // stage 1: the first multiply-add-multiply; stage 2: the rest\n        p  <= (a * b + a) * b;\n        a2 <= a;\n        b2 <= b;\n        y  <= (p + b2) * a2;',
      ],
    ]),
    vhdl: patch('timing', TIMING_VHDL, [
      ["    signal y    : unsigned(31 downto 0) := (others => '0');  -- output register\n", "    signal y    : unsigned(31 downto 0) := (others => '0');  -- output register\n    signal p      : unsigned(23 downto 0) := (others => '0');  -- pipeline register\n    signal a2, b2 : unsigned(7 downto 0) := (others => '0');   -- a and b, delayed to match p\n"],
      [
        '            -- three multipliers and two adders in a row: one long register-to-register path\n            y <= ((a * b + a) * b + b) * a;',
        '            -- stage 1: the first multiply-add-multiply; stage 2: the rest\n            p  <= (a * b + a) * b;\n            a2 <= a;\n            b2 <= b;\n            y  <= (p + b2) * a2;',
      ],
    ]),
  }),
  // a 2 Hz enable: 500 of the 1 kHz ticks, still on the one clock
  clocking: () => ({
    verilog: patch('clocking', CLOCKING_V, [
      ['    reg       blink = 0;\n', '    // 2 Hz enable: 500 of the 1 kHz ticks\n    reg  [9:0]  c3 = 0;\n    wire        tick_2hz = tick_1k && (c3 == 499);\n    reg       blink2 = 0;\n\n    reg       blink = 0;\n'],
      ['            c2 <= (c2 == 999) ? 0 : c2 + 1;\n', '            c2 <= (c2 == 999) ? 0 : c2 + 1;\n        if (tick_1k)\n            c3 <= (c3 == 499) ? 0 : c3 + 1;\n        if (tick_2hz)\n            blink2 <= ~blink2;\n'],
      ["{seconds, 7'b0000000, blink}", "{seconds, 6'b000000, blink2, blink}"],
    ]),
    vhdl: patch('clocking', CLOCKING_VHDL, [
      ["    signal blink    : std_logic := '0';\n", "    signal blink    : std_logic := '0';\n    signal c3       : integer range 0 to 499 := 0;\n    signal tick_2hz : std_logic;\n    signal blink2   : std_logic := '0';\n"],
      ["    tick_1hz <= '1' when tick_1k = '1' and c2 = 999 else '0';\n", "    tick_1hz <= '1' when tick_1k = '1' and c2 = 999 else '0';\n    tick_2hz <= '1' when tick_1k = '1' and c3 = 499 else '0';\n"],
      ['                if c2 = 999 then c2 <= 0; else c2 <= c2 + 1; end if;\n', '                if c2 = 999 then c2 <= 0; else c2 <= c2 + 1; end if;\n                if c3 = 499 then c3 <= 0; else c3 <= c3 + 1; end if;\n'],
      ['            if tick_1hz = \'1\' then\n', "            if tick_2hz = '1' then\n                blink2 <= not blink2;\n            end if;\n            if tick_1hz = '1' then\n"],
      ['std_logic_vector(seconds) & "0000000" & blink', 'std_logic_vector(seconds) & "000000" & blink2 & blink'],
    ]),
  }),
  // synchroniser first, then a counter debouncer, then the edge detector on the clean signal
  cdc: () => ({
    verilog: patch('cdc', CDC_V, [
      ['module top (\n', 'module top #(parameter DB = 1_000_000) (   // 10 ms debounce\n'],
      ['    reg prev = 0;\n', '    reg clean = 0;                 // debounced button\n    reg [31:0] cnt = 0;\n    reg prev = 0;\n'],
      ['        prev <= s2;\n', '        // accept a new level only after it has stayed for DB clocks\n        if (s2 == clean)\n            cnt <= 0;\n        else if (cnt == DB - 1) begin\n            clean <= s2;\n            cnt <= 0;\n        end else\n            cnt <= cnt + 1;\n        prev <= clean;\n'],
      ['        else if (s2 && !prev)          // a rising edge of the synchronised button', '        else if (clean && !prev)       // a rising edge of the debounced button'],
    ]),
    vhdl: patch('cdc', CDC_VHDL, [
      ['entity top is\n    port (', 'entity top is\n    generic (DB : integer := 1_000_000);   -- 10 ms debounce\n    port ('],
      ["    signal count        : unsigned(15 downto 0) := (others => '0');\n", "    signal count        : unsigned(15 downto 0) := (others => '0');\n    signal clean        : std_logic := '0';        -- debounced button\n    signal cnt          : integer range 0 to DB - 1 := 0;\n"],
      ['            prev <= s2;\n', "            -- accept a new level only after it has stayed for DB clocks\n            if s2 = clean then\n                cnt <= 0;\n            elsif cnt = DB - 1 then\n                clean <= s2;\n                cnt <= 0;\n            else\n                cnt <= cnt + 1;\n            end if;\n            prev <= clean;\n"],
      ["            elsif s2 = '1' and prev = '0' then   -- a rising edge of the synchronised button", "            elsif clean = '1' and prev = '0' then   -- a rising edge of the debounced button"],
    ]),
  }),
  // a second read port: the next cell, on LED15..LED8
  bram: () => ({
    verilog: patch('bram', BRAM_V, [
      ['    input  wire [9:0] addr,\n', '    input  wire [9:0] addr,\n    input  wire [9:0] addr_b,        // second read port\n'],
      ['    output reg  [7:0] dout\n', '    output reg  [7:0] dout,\n    output reg  [7:0] dout_b\n'],
      ['        dout <= mem[addr];           // read-first: in a write cycle dout gets the old value\n', '        dout <= mem[addr];           // read-first: in a write cycle dout gets the old value\n        dout_b <= mem[addr_b];\n'],
      ['    wire [7:0] dout;\n', '    wire [7:0] dout, dout_b;\n    wire [9:0] addr = {page, SW[15:8]};\n'],
      ['.addr({page, SW[15:8]}), .din(SW[7:0]), .dout(dout));', '.addr(addr), .addr_b(addr + 10\'d1), .din(SW[7:0]), .dout(dout), .dout_b(dout_b));'],
      ["    assign LED = {page, 6'b000000, dout};", '    assign LED = {dout_b, dout};'],
    ]),
    vhdl: patch('bram', BRAM_VHDL, [
      ['        addr : in  std_logic_vector(9 downto 0);\n', '        addr   : in  std_logic_vector(9 downto 0);\n        addr_b : in  std_logic_vector(9 downto 0);   -- second read port\n'],
      ['        dout : out std_logic_vector(7 downto 0)\n    );\nend bram1k;', '        dout   : out std_logic_vector(7 downto 0);\n        dout_b : out std_logic_vector(7 downto 0)\n    );\nend bram1k;'],
      ['            dout <= mem(to_integer(unsigned(addr)));   -- read-first: the old value in a write cycle\n', '            dout <= mem(to_integer(unsigned(addr)));   -- read-first: the old value in a write cycle\n            dout_b <= mem(to_integer(unsigned(addr_b)));\n'],
      ['    signal dout   : std_logic_vector(7 downto 0);\n', '    signal dout, dout_b : std_logic_vector(7 downto 0);\n    signal addr, addr_b : std_logic_vector(9 downto 0);\n'],
      ['    ram : entity work.bram1k\n        port map (clk => CLK100MHZ, we => BTNC, addr => std_logic_vector(page) & SW(15 downto 8),\n                  din => SW(7 downto 0), dout => dout);', '    addr   <= std_logic_vector(page) & SW(15 downto 8);\n    addr_b <= std_logic_vector(unsigned(addr) + 1);\n    ram : entity work.bram1k\n        port map (clk => CLK100MHZ, we => BTNC, addr => addr, addr_b => addr_b,\n                  din => SW(7 downto 0), dout => dout, dout_b => dout_b);'],
      ['    LED <= std_logic_vector(page) & "000000" & dout;', '    LED <= dout_b & dout;'],
    ]),
  }),
  'proj-clock': () => ({ verilog: CLOCK_SOLUTION_V, vhdl: CLOCK_SOLUTION_VHDL }),
};
