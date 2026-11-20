// HDL for chapter 8 "Beyond the basics" and the guided project (Phase 4.3, 4.4). Kept apart from the lesson texts
// (beyond.ts, beyond-en.ts) so the reference solutions in grade/solutions.ts can share pieces of it.
import { VHDL_NUMERIC } from './lessons';
import { HEX7SEG_V, HEX7SEG_VHDL } from './advanced';

// ------------------------------------------------------------------ timing
export const TIMING_V = `// A long combinational path: y = ((a*b + a) * b + b) * a, all of it between two registers
module top (
    input  wire        CLK100MHZ,
    input  wire [15:0] SW,
    output wire [15:0] LED
);
    reg [7:0]  a = 0, b = 0;      // input registers
    reg [31:0] y = 0;             // output register

    always @(posedge CLK100MHZ) begin
        a <= SW[7:0];
        b <= SW[15:8];
        // three multipliers and two adders in a row: one long register-to-register path
        y <= ((a * b + a) * b + b) * a;
    end

    assign LED = y[15:0];
endmodule
`;
export const TIMING_VHDL = `${VHDL_NUMERIC}
-- A long combinational path: y = (a*b + a) * b + b, all of it between two registers
entity top is
    port (
        CLK100MHZ : in  std_logic;
        SW        : in  std_logic_vector(15 downto 0);
        LED       : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal a, b : unsigned(7 downto 0) := (others => '0');   -- input registers
    signal y    : unsigned(31 downto 0) := (others => '0');  -- output register
begin
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            a <= unsigned(SW(7 downto 0));
            b <= unsigned(SW(15 downto 8));
            -- three multipliers and two adders in a row: one long register-to-register path
            y <= ((a * b + a) * b + b) * a;
        end if;
    end process;

    LED <= std_logic_vector(y(15 downto 0));
end rtl;
`;

// ------------------------------------------------------------------ clocking
export const CLOCKING_V = `// One 100 MHz clock, slower events as clock enables: a 1 kHz tick and a 1 Hz tick
module top #(parameter DIV = 100_000) (    // clocks per 1 kHz tick (100 MHz / 1 kHz)
    input  wire        CLK100MHZ,
    output wire [15:0] LED
);
    // 1 kHz enable: high for one clock every DIV clocks
    reg  [31:0] c1 = 0;
    wire        tick_1k = (c1 == DIV - 1);
    // 1 Hz enable: counts 1000 of the 1 kHz ticks
    reg  [9:0]  c2 = 0;
    wire        tick_1hz = tick_1k && (c2 == 999);

    reg       blink = 0;
    reg [7:0] seconds = 0;

    // every register runs on CLK100MHZ; the ticks only say "update this time"
    always @(posedge CLK100MHZ) begin
        c1 <= tick_1k ? 0 : c1 + 1;
        if (tick_1k)
            c2 <= (c2 == 999) ? 0 : c2 + 1;
        if (tick_1hz) begin
            blink   <= ~blink;
            seconds <= seconds + 1;
        end
    end

    assign LED = {seconds, 7'b0000000, blink};
endmodule
`;
export const CLOCKING_VHDL = `${VHDL_NUMERIC}
-- One 100 MHz clock, slower events as clock enables: a 1 kHz tick and a 1 Hz tick
entity top is
    generic (DIV : integer := 100_000);    -- clocks per 1 kHz tick (100 MHz / 1 kHz)
    port (
        CLK100MHZ : in  std_logic;
        LED       : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal c1       : integer range 0 to DIV - 1 := 0;
    signal c2       : integer range 0 to 999 := 0;
    signal tick_1k  : std_logic;
    signal tick_1hz : std_logic;
    signal blink    : std_logic := '0';
    signal seconds  : unsigned(7 downto 0) := (others => '0');
begin
    -- 1 kHz enable: high for one clock every DIV clocks; 1 Hz enable: 1000 of those
    tick_1k  <= '1' when c1 = DIV - 1 else '0';
    tick_1hz <= '1' when tick_1k = '1' and c2 = 999 else '0';

    -- every register runs on CLK100MHZ; the ticks only say "update this time"
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if tick_1k = '1' then
                c1 <= 0;
                if c2 = 999 then c2 <= 0; else c2 <= c2 + 1; end if;
            else
                c1 <= c1 + 1;
            end if;
            if tick_1hz = '1' then
                blink   <= not blink;
                seconds <= seconds + 1;
            end if;
        end if;
    end process;

    LED <= std_logic_vector(seconds) & "0000000" & blink;
end rtl;
`;

// ------------------------------------------------------------------ cdc
export const CDC_V = `// A push button through a two-flop synchroniser into a press counter
module top (
    input  wire        CLK100MHZ,
    input  wire        BTNC,          // asynchronous: a person presses it at any moment
    input  wire        BTNU,          // clears the count
    output wire [15:0] LED
);
    // the synchroniser: two flip-flops in a row and nothing else on BTNC. If s1 goes metastable,
    // it has a whole clock period to settle before s2 takes it.
    reg s1 = 0, s2 = 0;
    reg prev = 0;
    reg [15:0] count = 0;

    always @(posedge CLK100MHZ) begin
        s1   <= BTNC;
        s2   <= s1;
        prev <= s2;
        if (BTNU)
            count <= 0;
        else if (s2 && !prev)          // a rising edge of the synchronised button
            count <= count + 1;
    end

    assign LED = count;
endmodule
`;
export const CDC_VHDL = `${VHDL_NUMERIC}
-- A push button through a two-flop synchroniser into a press counter
entity top is
    port (
        CLK100MHZ : in  std_logic;
        BTNC      : in  std_logic;    -- asynchronous: a person presses it at any moment
        BTNU      : in  std_logic;    -- clears the count
        LED       : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    -- the synchroniser: two flip-flops in a row and nothing else on BTNC
    signal s1, s2, prev : std_logic := '0';
    signal count        : unsigned(15 downto 0) := (others => '0');
begin
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            s1   <= BTNC;
            s2   <= s1;
            prev <= s2;
            if BTNU = '1' then
                count <= (others => '0');
            elsif s2 = '1' and prev = '0' then   -- a rising edge of the synchronised button
                count <= count + 1;
            end if;
        end if;
    end process;

    LED <= std_logic_vector(count);
end rtl;
`;

// ------------------------------------------------------------------ bram
export const BRAM_V = `// A 1K x 8 block RAM: write from the switches, read back on the LEDs
module bram1k (
    input  wire       clk,
    input  wire       we,
    input  wire [9:0] addr,
    input  wire [7:0] din,
    output reg  [7:0] dout
);
    reg [7:0] mem [0:1023];          // 8 Kbit: big enough for Vivado to use a RAMB

    always @(posedge clk) begin
        if (we)
            mem[addr] <= din;
        dout <= mem[addr];           // read-first: in a write cycle dout gets the old value
    end
endmodule

module top (
    input  wire        CLK100MHZ,
    input  wire [15:0] SW,            // SW[15:8] = address, SW[7:0] = data
    input  wire        BTNC,          // write
    input  wire        BTNR,          // next page (the top two address bits)
    output wire [15:0] LED
);
    reg [1:0] page = 0;
    reg       r_prev = 0;
    always @(posedge CLK100MHZ) begin
        r_prev <= BTNR;
        if (BTNR && !r_prev)
            page <= page + 1;
    end

    wire [7:0] dout;
    bram1k ram (.clk(CLK100MHZ), .we(BTNC), .addr({page, SW[15:8]}), .din(SW[7:0]), .dout(dout));

    assign LED = {page, 6'b000000, dout};
endmodule
`;
export const BRAM_VHDL = `${VHDL_NUMERIC}
-- A 1K x 8 block RAM: write from the switches, read back on the LEDs
entity bram1k is
    port (
        clk  : in  std_logic;
        we   : in  std_logic;
        addr : in  std_logic_vector(9 downto 0);
        din  : in  std_logic_vector(7 downto 0);
        dout : out std_logic_vector(7 downto 0)
    );
end bram1k;

architecture rtl of bram1k is
    type ram_t is array (0 to 1023) of std_logic_vector(7 downto 0);   -- 8 Kbit: a RAMB
    signal mem : ram_t := (others => (others => '0'));
begin
    process(clk)
    begin
        if rising_edge(clk) then
            if we = '1' then
                mem(to_integer(unsigned(addr))) <= din;
            end if;
            dout <= mem(to_integer(unsigned(addr)));   -- read-first: the old value in a write cycle
        end if;
    end process;
end rtl;

${VHDL_NUMERIC}
entity top is
    port (
        CLK100MHZ : in  std_logic;
        SW        : in  std_logic_vector(15 downto 0);   -- SW(15:8) = address, SW(7:0) = data
        BTNC      : in  std_logic;                       -- write
        BTNR      : in  std_logic;                       -- next page (the top two address bits)
        LED       : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal page   : unsigned(1 downto 0) := "00";
    signal r_prev : std_logic := '0';
    signal dout   : std_logic_vector(7 downto 0);
begin
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            r_prev <= BTNR;
            if BTNR = '1' and r_prev = '0' then
                page <= page + 1;
            end if;
        end if;
    end process;

    ram : entity work.bram1k
        port map (clk => CLK100MHZ, we => BTNC, addr => std_logic_vector(page) & SW(15 downto 8),
                  din => SW(7 downto 0), dout => dout);

    LED <= std_logic_vector(page) & "000000" & dout;
end rtl;
`;

// ------------------------------------------------------------------ realboard
export const BLINKY_V = `// The first design for a real board: LD0 blinks once a second, SW15..SW1 light LD15..LD1
module top #(parameter DIV = 50_000_000) (   // half a second at 100 MHz
    input  wire        CLK100MHZ,
    input  wire [15:0] SW,
    output wire [15:0] LED
);
    reg [31:0] cnt = 0;
    reg        blink = 0;

    always @(posedge CLK100MHZ)
        if (cnt == DIV - 1) begin
            cnt   <= 0;
            blink <= ~blink;
        end else
            cnt <= cnt + 1;

    assign LED = {SW[15:1], blink};
endmodule
`;
export const BLINKY_VHDL = `${VHDL_NUMERIC}
-- The first design for a real board: LD0 blinks once a second, SW15..SW1 light LD15..LD1
entity top is
    generic (DIV : integer := 50_000_000);   -- half a second at 100 MHz
    port (
        CLK100MHZ : in  std_logic;
        SW        : in  std_logic_vector(15 downto 0);
        LED       : out std_logic_vector(15 downto 0)
    );
end top;

architecture rtl of top is
    signal cnt   : integer range 0 to DIV - 1 := 0;
    signal blink : std_logic := '0';
begin
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if cnt = DIV - 1 then
                cnt   <= 0;
                blink <= not blink;
            else
                cnt <= cnt + 1;
            end if;
        end if;
    end process;

    LED <= SW(15 downto 1) & blink;
end rtl;
`;

// ------------------------------------------------------------------ project 1: digital clock
// The finished clock, used as the reference solution. The starter (below) is this design with the four
// milestones taken out and marked TODO.
export const CLOCK_SOLUTION_V = `// Digital clock HH.MM.SS on the six right-most digits; BTNU / BTND set the minutes
${HEX7SEG_V}
module top #(
    parameter DIV  = 100_000_000,   // clocks per second
    parameter SCAN = 100_000,       // clocks per display digit (1 ms)
    parameter DB   = 1_000_000      // debounce time in clocks (10 ms)
) (
    input  wire       CLK100MHZ,
    input  wire       BTNU,
    input  wire       BTND,
    output wire CA, CB, CC, CD, CE, CF, CG, DP,
    output reg  [7:0] AN
);
    // milestone 1: a one-second tick from a prescaler
    reg  [31:0] pre = 0;
    wire        tick = (pre == DIV - 1);
    always @(posedge CLK100MHZ)
        pre <= tick ? 0 : pre + 1;

    // milestone 4: synchronise and debounce the set buttons, one pulse per press
    reg u1 = 0, u2 = 0, d1 = 0, d2 = 0;          // two-flop synchronisers
    reg u_db = 0, d_db = 0, u_prev = 0, d_prev = 0;
    reg [31:0] u_cnt = 0, d_cnt = 0;
    always @(posedge CLK100MHZ) begin
        u1 <= BTNU; u2 <= u1;
        d1 <= BTND; d2 <= d1;
        if (u2 == u_db) u_cnt <= 0;
        else if (u_cnt == DB - 1) begin u_db <= u2; u_cnt <= 0; end
        else u_cnt <= u_cnt + 1;
        if (d2 == d_db) d_cnt <= 0;
        else if (d_cnt == DB - 1) begin d_db <= d2; d_cnt <= 0; end
        else d_cnt <= d_cnt + 1;
        u_prev <= u_db;
        d_prev <= d_db;
    end
    wire up   = u_db && !u_prev;
    wire down = d_db && !d_prev;

    // milestone 2: seconds, minutes and hours as BCD digits, each wrapping
    reg [3:0] s0 = 0, s1 = 0, m0 = 0, m1 = 0, h0 = 0, h1 = 0;
    always @(posedge CLK100MHZ) begin
        if (up) begin                                // minutes + 1 (59 -> 00, hours unchanged)
            if (m0 != 9) m0 <= m0 + 1;
            else begin m0 <= 0; m1 <= (m1 == 5) ? 4'd0 : m1 + 1; end
        end else if (down) begin                     // minutes - 1 (00 -> 59)
            if (m0 != 0) m0 <= m0 - 1;
            else begin m0 <= 9; m1 <= (m1 == 0) ? 4'd5 : m1 - 1; end
        end else if (tick) begin
            if (s0 != 9) s0 <= s0 + 1;
            else begin
                s0 <= 0;
                if (s1 != 5) s1 <= s1 + 1;
                else begin
                    s1 <= 0;
                    if (m0 != 9) m0 <= m0 + 1;
                    else begin
                        m0 <= 0;
                        if (m1 != 5) m1 <= m1 + 1;
                        else begin
                            m1 <= 0;
                            if (h1 == 2 && h0 == 3) begin h1 <= 0; h0 <= 0; end   // 23 -> 00
                            else if (h0 != 9) h0 <= h0 + 1;
                            else begin h0 <= 0; h1 <= h1 + 1; end
                        end
                    end
                end
            end
        end
    end

    // milestone 3: multiplex the six digits (H H . M M . S S)
    reg [31:0] scan_cnt = 0;
    reg [2:0]  digit = 0;
    always @(posedge CLK100MHZ)
        if (scan_cnt == SCAN - 1) begin
            scan_cnt <= 0;
            digit <= (digit == 5) ? 3'd0 : digit + 1;
        end else
            scan_cnt <= scan_cnt + 1;

    reg  [3:0] nibble;
    wire [6:0] seg;
    always @(*) begin
        AN = 8'b1111_1111;
        AN[digit] = 1'b0;
        case (digit)
            3'd0: nibble = s0;
            3'd1: nibble = s1;
            3'd2: nibble = m0;
            3'd3: nibble = m1;
            3'd4: nibble = h0;
            default: nibble = h1;
        endcase
    end
    hex7seg decoder (.x(nibble), .seg(seg));
    assign {CG, CF, CE, CD, CC, CB, CA} = seg;
    assign DP = (digit == 3'd2 || digit == 3'd4) ? 1'b0 : 1'b1;   // dots after the hours and the minutes
endmodule
`;

export const CLOCK_STARTER_V = `// Project: a digital clock HH.MM.SS on the six right-most digits; BTNU / BTND set the minutes.
// Work through the four milestones in the lesson; each TODO below is one of them.
${HEX7SEG_V}
module top #(
    parameter DIV  = 100_000_000,   // clocks per second
    parameter SCAN = 100_000,       // clocks per display digit (1 ms)
    parameter DB   = 1_000_000      // debounce time in clocks (10 ms)
) (
    input  wire       CLK100MHZ,
    input  wire       BTNU,
    input  wire       BTND,
    output wire CA, CB, CC, CD, CE, CF, CG, DP,
    output reg  [7:0] AN
);
    // TODO 1: a prescaler that makes tick high for one clock every DIV clocks
    wire tick = 1'b0;

    // TODO 4: synchronise and debounce BTNU and BTND (see the cdc and debounce lessons),
    // then make up / down one-clock pulses on each press
    wire up   = 1'b0;
    wire down = 1'b0;

    // TODO 2: seconds, minutes and hours as BCD digits (s0 s1, m0 m1, h0 h1):
    // on tick count the seconds; 59 -> 00 carries into the minutes, 59 -> 00 into the hours, 23 -> 00.
    // up / down add or subtract one minute.
    reg [3:0] s0 = 0, s1 = 0, m0 = 0, m1 = 0, h0 = 0, h1 = 0;

    // TODO 3: multiplex the six digits: a counter moves to the next digit every SCAN clocks,
    // AN[digit] goes low and nibble picks that digit (digit 0 = s0 ... digit 5 = h1)
    reg  [2:0] digit = 0;
    reg  [3:0] nibble;
    wire [6:0] seg;
    always @(*) begin
        AN = 8'b1111_1111;
        AN[digit] = 1'b0;
        nibble = s0;
    end
    hex7seg decoder (.x(nibble), .seg(seg));
    assign {CG, CF, CE, CD, CC, CB, CA} = seg;
    assign DP = 1'b1;
endmodule
`;

export const CLOCK_SOLUTION_VHDL = `${HEX7SEG_VHDL}
${VHDL_NUMERIC}
-- Digital clock HH.MM.SS on the six right-most digits; BTNU / BTND set the minutes
entity top is
    generic (
        DIV  : integer := 100_000_000;   -- clocks per second
        SCAN : integer := 100_000;       -- clocks per display digit (1 ms)
        DB   : integer := 1_000_000      -- debounce time in clocks (10 ms)
    );
    port (
        CLK100MHZ : in  std_logic;
        BTNU      : in  std_logic;
        BTND      : in  std_logic;
        CA, CB, CC, CD, CE, CF, CG, DP : out std_logic;
        AN        : out std_logic_vector(7 downto 0)
    );
end top;

architecture rtl of top is
    signal pre              : integer range 0 to DIV - 1 := 0;
    signal tick             : std_logic;
    signal u1, u2, d1, d2   : std_logic := '0';
    signal u_db, d_db       : std_logic := '0';
    signal u_prev, d_prev   : std_logic := '0';
    signal u_cnt, d_cnt     : integer range 0 to DB - 1 := 0;
    signal up, down         : std_logic;
    signal s0, s1, m0, m1, h0, h1 : unsigned(3 downto 0) := (others => '0');
    signal scan_cnt         : integer range 0 to SCAN - 1 := 0;
    signal digit            : unsigned(2 downto 0) := (others => '0');
    signal nibble           : std_logic_vector(3 downto 0);
    signal seg              : std_logic_vector(6 downto 0);
begin
    -- milestone 1: a one-second tick from a prescaler
    tick <= '1' when pre = DIV - 1 else '0';
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if tick = '1' then pre <= 0; else pre <= pre + 1; end if;
        end if;
    end process;

    -- milestone 4: synchronise and debounce the set buttons, one pulse per press
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            u1 <= BTNU; u2 <= u1;
            d1 <= BTND; d2 <= d1;
            if u2 = u_db then u_cnt <= 0;
            elsif u_cnt = DB - 1 then u_db <= u2; u_cnt <= 0;
            else u_cnt <= u_cnt + 1;
            end if;
            if d2 = d_db then d_cnt <= 0;
            elsif d_cnt = DB - 1 then d_db <= d2; d_cnt <= 0;
            else d_cnt <= d_cnt + 1;
            end if;
            u_prev <= u_db;
            d_prev <= d_db;
        end if;
    end process;
    up   <= u_db and not u_prev;
    down <= d_db and not d_prev;

    -- milestone 2: seconds, minutes and hours as BCD digits, each wrapping
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if up = '1' then
                if m0 /= 9 then m0 <= m0 + 1;
                else
                    m0 <= (others => '0');
                    if m1 = 5 then m1 <= (others => '0'); else m1 <= m1 + 1; end if;
                end if;
            elsif down = '1' then
                if m0 /= 0 then m0 <= m0 - 1;
                else
                    m0 <= to_unsigned(9, 4);
                    if m1 = 0 then m1 <= to_unsigned(5, 4); else m1 <= m1 - 1; end if;
                end if;
            elsif tick = '1' then
                if s0 /= 9 then s0 <= s0 + 1;
                else
                    s0 <= (others => '0');
                    if s1 /= 5 then s1 <= s1 + 1;
                    else
                        s1 <= (others => '0');
                        if m0 /= 9 then m0 <= m0 + 1;
                        else
                            m0 <= (others => '0');
                            if m1 /= 5 then m1 <= m1 + 1;
                            else
                                m1 <= (others => '0');
                                if h1 = 2 and h0 = 3 then
                                    h1 <= (others => '0');
                                    h0 <= (others => '0');
                                elsif h0 /= 9 then h0 <= h0 + 1;
                                else
                                    h0 <= (others => '0');
                                    h1 <= h1 + 1;
                                end if;
                            end if;
                        end if;
                    end if;
                end if;
            end if;
        end if;
    end process;

    -- milestone 3: multiplex the six digits (H H . M M . S S)
    process(CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            if scan_cnt = SCAN - 1 then
                scan_cnt <= 0;
                if digit = 5 then digit <= (others => '0'); else digit <= digit + 1; end if;
            else
                scan_cnt <= scan_cnt + 1;
            end if;
        end if;
    end process;

    process(digit, s0, s1, m0, m1, h0, h1)
    begin
        AN <= (others => '1');
        AN(to_integer(digit)) <= '0';
        case to_integer(digit) is
            when 0 => nibble <= std_logic_vector(s0);
            when 1 => nibble <= std_logic_vector(s1);
            when 2 => nibble <= std_logic_vector(m0);
            when 3 => nibble <= std_logic_vector(m1);
            when 4 => nibble <= std_logic_vector(h0);
            when others => nibble <= std_logic_vector(h1);
        end case;
    end process;

    decoder : entity work.hex7seg port map (x => nibble, seg => seg);
    CA <= seg(0);  CB <= seg(1);  CC <= seg(2);  CD <= seg(3);
    CE <= seg(4);  CF <= seg(5);  CG <= seg(6);
    DP <= '0' when digit = 2 or digit = 4 else '1';   -- dots after the hours and the minutes
end rtl;
`;

export const CLOCK_STARTER_VHDL = `${HEX7SEG_VHDL}
${VHDL_NUMERIC}
-- Project: a digital clock HH.MM.SS on the six right-most digits; BTNU / BTND set the minutes.
-- Work through the four milestones in the lesson; each TODO below is one of them.
entity top is
    generic (
        DIV  : integer := 100_000_000;   -- clocks per second
        SCAN : integer := 100_000;       -- clocks per display digit (1 ms)
        DB   : integer := 1_000_000      -- debounce time in clocks (10 ms)
    );
    port (
        CLK100MHZ : in  std_logic;
        BTNU      : in  std_logic;
        BTND      : in  std_logic;
        CA, CB, CC, CD, CE, CF, CG, DP : out std_logic;
        AN        : out std_logic_vector(7 downto 0)
    );
end top;

architecture rtl of top is
    -- TODO 1: a prescaler that makes tick '1' for one clock every DIV clocks
    signal tick     : std_logic := '0';
    -- TODO 4: synchronise and debounce BTNU and BTND (see the cdc and debounce lessons),
    -- then make up / down one-clock pulses on each press
    signal up, down : std_logic := '0';
    -- TODO 2: seconds, minutes and hours as BCD digits; 59 -> 00 carries, 23 -> 00 wraps,
    -- up / down add or subtract one minute
    signal s0, s1, m0, m1, h0, h1 : unsigned(3 downto 0) := (others => '0');
    -- TODO 3: multiplex the six digits: move to the next digit every SCAN clocks
    signal digit    : unsigned(2 downto 0) := (others => '0');
    signal nibble   : std_logic_vector(3 downto 0);
    signal seg      : std_logic_vector(6 downto 0);
begin
    process(digit, s0)
    begin
        AN <= (others => '1');
        AN(to_integer(digit)) <= '0';
        nibble <= std_logic_vector(s0);
    end process;

    decoder : entity work.hex7seg port map (x => nibble, seg => seg);
    CA <= seg(0);  CB <= seg(1);  CC <= seg(2);  CD <= seg(3);
    CE <= seg(4);  CF <= seg(5);  CG <= seg(6);
    DP <= '1';
end rtl;
`;
