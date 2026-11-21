// The EBAZ4205 versions of six lessons of the Nexys course (docs/EBAZ4205-ROADMAP.md, E3.4): counter, fsm,
// debounce, pwm, uart and uart_rx, in Verilog and VHDL, with the extension board attached. Only the top modules are
// new; the helper modules (debouncer, PWM, UART) are taken from the Nexys lessons and moved to 50 MHz, so the two
// versions teach the same circuit.
//
// Board mapping: clk = FCLK_CLK0 (50 MHz) from the PS; KEY1 is the reset (active low, like CPU_RESETN on the
// Nexys); KEY3, the centre of the key cross, stands in for BTNC; KEY2 for BTNU; LED_R and LED_G on the core board
// and LED1-LED3 (EXT_LED) on the extension board are the five LEDs; UART_RX / UART_TX the USB-C serial port.
import { ADVANCED } from '../../lessons/advanced';
import { UART_RX_MOD_V, UART_RX_MOD_VHD, UART_TX_MOD_V, UART_TX_MOD_VHD } from './extcode';

const VHDL_NUMERIC = `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
`;

const nexys = (id: string) => ADVANCED.find((l) => l.id === id)!;
const nth = (s: string, what: string, n: number) => {
  let i = -1;
  for (let k = 0; k < n; k++) i = s.indexOf(what, i + 1);
  return i;
};
const must = (s: string, a: string | RegExp, b: string) => {
  const out = s.replace(a, b);
  if (out === s) throw new Error(`EBAZ lesson code: edit did not apply: ${String(a).slice(0, 60)}`);
  return out;
};

// ---------------------------------------------------------------- counter
export const V_COUNTER_V = `// counter on the EBAZ4205: clock divider, 1 Hz blinker and a 4-bit counter.
// clk is FCLK_CLK0 from the PS (50 MHz). KEY1 on the extension board is the reset (pressed = 0).
module top (
    input  wire       clk,        // 50 MHz from the PS
    input  wire       KEY1,       // reset, active low
    output wire       LED_R,      // 1 Hz blinker (core board)
    output wire       LED_G,      // count bit 0 (core board)
    output wire [2:0] EXT_LED     // count bits 3..1 (LED3..LED1)
);
    localparam integer HALF_SECOND = 25_000_000;   // 50 MHz * 0.5 s

    reg [24:0] div   = 0;
    reg        blink = 0;
    reg [3:0]  count = 0;

    always @(posedge clk) begin
        if (!KEY1) begin
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

    assign LED_R   = blink;
    assign LED_G   = count[0];
    assign EXT_LED = count[3:1];
endmodule
`;

export const V_COUNTER_VHD = `${VHDL_NUMERIC}
-- counter on the EBAZ4205: clock divider, 1 Hz blinker and a 4-bit counter.
-- clk is FCLK_CLK0 from the PS (50 MHz). KEY1 on the extension board is the reset (pressed = '0').
entity top is
    port (
        clk     : in  std_logic;                      -- 50 MHz from the PS
        KEY1    : in  std_logic;                      -- reset, active low
        LED_R   : out std_logic;                      -- 1 Hz blinker (core board)
        LED_G   : out std_logic;                      -- count bit 0 (core board)
        EXT_LED : out std_logic_vector(2 downto 0)    -- count bits 3..1 (LED3..LED1)
    );
end top;

architecture rtl of top is
    constant HALF_SECOND : integer := 25_000_000;   -- 50 MHz * 0.5 s

    signal div   : integer range 0 to HALF_SECOND - 1 := 0;
    signal blink : std_logic := '0';
    signal count : unsigned(3 downto 0) := (others => '0');
begin
    process(clk)
    begin
        if rising_edge(clk) then
            if KEY1 = '0' then
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

    LED_R   <= blink;
    LED_G   <= count(0);
    EXT_LED <= std_logic_vector(count(3 downto 1));
end rtl;
`;

export const V_COUNTER_SOL_V = `// counter exercise on the EBAZ4205: a "Knight Rider" light on the five LEDs
// LED_R -> LED_G -> LED1 -> LED2 -> LED3 and back, one step every DIV clocks
module top #(
    parameter DIV = 5_000_000          // 100 ms at 50 MHz
) (
    input  wire       clk,
    output wire       LED_R,
    output wire       LED_G,
    output wire [2:0] EXT_LED
);
    reg [22:0] cnt  = 0;
    reg [4:0]  pos  = 5'b00001;         // one-hot: bit 0 = LED_R, bit 4 = LED3
    reg        down = 1'b0;

    always @(posedge clk) begin
        if (cnt == DIV - 1) begin
            cnt <= 0;
            if (!down) begin
                if (pos[3]) down <= 1'b1;   // the next step reaches the top end
                pos <= pos << 1;
            end else begin
                if (pos[1]) down <= 1'b0;   // the next step reaches the bottom end
                pos <= pos >> 1;
            end
        end else
            cnt <= cnt + 1;
    end

    assign LED_R   = pos[0];
    assign LED_G   = pos[1];
    assign EXT_LED = pos[4:2];
endmodule
`;

export const V_COUNTER_SOL_VHD = `${VHDL_NUMERIC}
-- counter exercise on the EBAZ4205: a "Knight Rider" light on the five LEDs
-- LED_R -> LED_G -> LED1 -> LED2 -> LED3 and back, one step every DIV clocks
entity top is
    generic (DIV : integer := 5_000_000);           -- 100 ms at 50 MHz
    port (
        clk     : in  std_logic;
        LED_R   : out std_logic;
        LED_G   : out std_logic;
        EXT_LED : out std_logic_vector(2 downto 0)
    );
end top;

architecture rtl of top is
    signal cnt  : integer range 0 to DIV - 1 := 0;
    signal pos  : std_logic_vector(4 downto 0) := "00001";   -- one-hot: bit 0 = LED_R, bit 4 = LED3
    signal down : std_logic := '0';
begin
    process(clk)
    begin
        if rising_edge(clk) then
            if cnt = DIV - 1 then
                cnt <= 0;
                if down = '0' then
                    if pos(3) = '1' then down <= '1'; end if;   -- the next step reaches the top end
                    pos <= pos(3 downto 0) & '0';
                else
                    if pos(1) = '1' then down <= '0'; end if;   -- the next step reaches the bottom end
                    pos <= '0' & pos(4 downto 1);
                end if;
            else
                cnt <= cnt + 1;
            end if;
        end if;
    end process;

    LED_R   <= pos(0);
    LED_G   <= pos(1);
    EXT_LED <= pos(4 downto 2);
end rtl;
`;

// ---------------------------------------------------------------- fsm
export const V_FSM_V = `// traffic light FSM on the EBAZ4205 extension board: LED1 = red, LED2 = yellow, LED3 = green
module top (
    input  wire       clk,         // 50 MHz from the PS
    input  wire       KEY1,        // reset, active low
    input  wire       KEY3,        // pedestrian request, active low
    output reg  [2:0] EXT_LED      // {green, yellow, red}
);
    localparam integer ONE_SECOND = 50_000_000;

    localparam [1:0] RED = 2'd0, GREEN = 2'd1, YELLOW = 2'd2;

    reg [1:0]  state = RED;
    reg [27:0] timer = 0;
    wire       walk  = ~KEY3;      // the keys read 0 while pressed

    always @(posedge clk) begin
        if (!KEY1) begin
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
                    if (timer == 2 * ONE_SECOND - 1 || walk) begin
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
        case (state)
            RED:     EXT_LED = 3'b001;
            GREEN:   EXT_LED = 3'b100;
            default: EXT_LED = 3'b010;
        endcase
    end
endmodule
`;

export const V_FSM_VHD = `${VHDL_NUMERIC}
-- traffic light FSM on the EBAZ4205 extension board: LED1 = red, LED2 = yellow, LED3 = green
entity top is
    port (
        clk     : in  std_logic;                      -- 50 MHz from the PS
        KEY1    : in  std_logic;                      -- reset, active low
        KEY3    : in  std_logic;                      -- pedestrian request, active low
        EXT_LED : out std_logic_vector(2 downto 0)    -- (green, yellow, red)
    );
end top;

architecture rtl of top is
    constant ONE_SECOND : integer := 50_000_000;

    type state_t is (RED, GREEN, YELLOW);
    signal state : state_t := RED;
    signal timer : integer range 0 to 2 * ONE_SECOND := 0;
begin
    process(clk)
    begin
        if rising_edge(clk) then
            if KEY1 = '0' then
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
                        if timer = 2 * ONE_SECOND - 1 or KEY3 = '0' then
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
    EXT_LED <= "001" when state = RED else
               "100" when state = GREEN else
               "010";
end rtl;
`;

export const V_FSM_SOL_V = `// fsm exercise on the EBAZ4205: a night mode. A press of KEY2 switches it on: only the yellow LED2 flashes,
// changing every half second. The next press switches it off, and the light starts again from red.
module top #(
    parameter integer ONE_SECOND = 50_000_000
) (
    input  wire       clk,
    input  wire       KEY1,        // reset, active low
    input  wire       KEY2,        // night mode on / off, active low
    input  wire       KEY3,        // pedestrian request, active low
    output reg  [2:0] EXT_LED      // {green, yellow, red}
);
    localparam [1:0] RED = 2'd0, GREEN = 2'd1, YELLOW = 2'd2;

    reg [1:0]  state = RED;
    reg [27:0] timer = 0;
    reg        night = 1'b0;
    reg        flash = 1'b0;
    reg        k2    = 1'b1;       // KEY2 one clock ago
    wire       walk  = ~KEY3;
    wire       night_key = k2 & ~KEY2;   // KEY2 has just gone down

    always @(posedge clk) begin
        k2 <= KEY2;
        if (!KEY1) begin
            state <= RED;
            timer <= 0;
            night <= 1'b0;
        end else if (night_key) begin
            night <= ~night;
            flash <= 1'b1;
            state <= RED;
            timer <= 0;
        end else if (night) begin
            if (timer == ONE_SECOND / 2 - 1) begin
                flash <= ~flash;
                timer <= 0;
            end else
                timer <= timer + 1;
        end else begin
            timer <= timer + 1;
            case (state)
                RED:
                    if (timer == 2 * ONE_SECOND - 1) begin
                        state <= GREEN;
                        timer <= 0;
                    end
                GREEN:
                    if (timer == 2 * ONE_SECOND - 1 || walk) begin
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

    always @(*) begin
        if (night)
            EXT_LED = {1'b0, flash, 1'b0};
        else
            case (state)
                RED:     EXT_LED = 3'b001;
                GREEN:   EXT_LED = 3'b100;
                default: EXT_LED = 3'b010;
            endcase
    end
endmodule
`;

export const V_FSM_SOL_VHD = `${VHDL_NUMERIC}
-- fsm exercise on the EBAZ4205: a night mode. A press of KEY2 switches it on: only the yellow LED2 flashes,
-- changing every half second. The next press switches it off, and the light starts again from red.
entity top is
    generic (ONE_SECOND : integer := 50_000_000);
    port (
        clk     : in  std_logic;
        KEY1    : in  std_logic;                      -- reset, active low
        KEY2    : in  std_logic;                      -- night mode on / off, active low
        KEY3    : in  std_logic;                      -- pedestrian request, active low
        EXT_LED : out std_logic_vector(2 downto 0)    -- (green, yellow, red)
    );
end top;

architecture rtl of top is
    type state_t is (RED, GREEN, YELLOW);
    signal state : state_t := RED;
    signal timer : integer range 0 to 2 * ONE_SECOND := 0;
    signal night : std_logic := '0';
    signal flash : std_logic := '0';
    signal k2    : std_logic := '1';                  -- KEY2 one clock ago
begin
    process(clk)
    begin
        if rising_edge(clk) then
            k2 <= KEY2;
            if KEY1 = '0' then
                state <= RED;
                timer <= 0;
                night <= '0';
            elsif k2 = '1' and KEY2 = '0' then          -- KEY2 has just gone down
                night <= not night;
                flash <= '1';
                state <= RED;
                timer <= 0;
            elsif night = '1' then
                if timer = ONE_SECOND / 2 - 1 then
                    flash <= not flash;
                    timer <= 0;
                else
                    timer <= timer + 1;
                end if;
            else
                timer <= timer + 1;
                case state is
                    when RED =>
                        if timer = 2 * ONE_SECOND - 1 then
                            state <= GREEN;
                            timer <= 0;
                        end if;
                    when GREEN =>
                        if timer = 2 * ONE_SECOND - 1 or KEY3 = '0' then
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

    EXT_LED <= '0' & flash & '0' when night = '1' else
               "001" when state = RED else
               "100" when state = GREEN else
               "010";
end rtl;
`;

// ---------------------------------------------------------------- debounce
// the debouncer FSM and the edge detector of the Nexys lesson, at 50 MHz
const DB = nexys('debounce');
const at50db = (s: string) => must(s, /(N = |N : integer := )1_000_000;(\s*)(\/\/|--) 10 ms at 100 MHz/, '$1500_000;  $2$3 10 ms at 50 MHz');
const DEBOUNCE_MODS_V = at50db(DB.verilog.slice(DB.verilog.indexOf('module debounce'), DB.verilog.indexOf('module top')));
const DEBOUNCE_MODS_VHD = at50db(DB.vhdl.slice(0, nth(DB.vhdl, 'library ieee', 3)));

export const V_DEBOUNCE_V = `// Key debouncer FSM + edge detectors on the EBAZ4205: raw vs. debounced press counts of KEY3
${DEBOUNCE_MODS_V}module top (
    input  wire       clk,         // 50 MHz from the PS
    input  wire       KEY3,        // the key to count, active low
    input  wire       KEY2,        // clears both counts, active low
    output wire       LED_R,       // raw count, bit 0 (core board)
    output wire       LED_G,       // raw count, bit 1 (core board)
    output wire [2:0] EXT_LED      // debounced count (LED3..LED1)
);
    wire key = ~KEY3;              // the keys read 0 while pressed: turn that into 1 = pressed
    wire db, raw_tick, db_tick;

    debounce    u_db  (.clk(clk), .sw(key),   .db(db));
    edge_detect e_raw (.clk(clk), .level(key), .tick(raw_tick));
    edge_detect e_db  (.clk(clk), .level(db),  .tick(db_tick));

    reg [1:0] raw_cnt = 0;
    reg [2:0] db_cnt  = 0;
    always @(posedge clk) begin
        if (!KEY2) begin
            raw_cnt <= 0;
            db_cnt  <= 0;
        end else begin
            if (raw_tick) raw_cnt <= raw_cnt + 1;
            if (db_tick)  db_cnt  <= db_cnt + 1;
        end
    end

    assign LED_R   = raw_cnt[0];
    assign LED_G   = raw_cnt[1];
    assign EXT_LED = db_cnt;
endmodule
`;

export const V_DEBOUNCE_VHD = `${DEBOUNCE_MODS_VHD}${VHDL_NUMERIC}
-- raw vs. debounced press counts of KEY3 on the EBAZ4205
entity top is
    port (
        clk     : in  std_logic;                      -- 50 MHz from the PS
        KEY3    : in  std_logic;                      -- the key to count, active low
        KEY2    : in  std_logic;                      -- clears both counts, active low
        LED_R   : out std_logic;                      -- raw count, bit 0 (core board)
        LED_G   : out std_logic;                      -- raw count, bit 1 (core board)
        EXT_LED : out std_logic_vector(2 downto 0)    -- debounced count (LED3..LED1)
    );
end top;

architecture rtl of top is
    signal key, db, raw_tick, db_tick : std_logic;
    signal raw_cnt : unsigned(1 downto 0) := (others => '0');
    signal db_cnt  : unsigned(2 downto 0) := (others => '0');
begin
    key <= not KEY3;              -- the keys read '0' while pressed: turn that into '1' = pressed

    u_db  : entity work.debounce    port map (clk => clk, sw => key, db => db);
    e_raw : entity work.edge_detect port map (clk => clk, level => key, tick => raw_tick);
    e_db  : entity work.edge_detect port map (clk => clk, level => db, tick => db_tick);

    process(clk)
    begin
        if rising_edge(clk) then
            if KEY2 = '0' then
                raw_cnt <= (others => '0');
                db_cnt  <= (others => '0');
            else
                if raw_tick = '1' then raw_cnt <= raw_cnt + 1; end if;
                if db_tick = '1' then db_cnt <= db_cnt + 1; end if;
            end if;
        end if;
    end process;

    LED_R   <= raw_cnt(0);
    LED_G   <= raw_cnt(1);
    EXT_LED <= std_logic_vector(db_cnt);
end rtl;
`;

export const V_DEBOUNCE_SOL_V = `// debounce exercise on the EBAZ4205: the five LEDs are a register that starts at 00001 and rotates left by
// one bit on every press of KEY2 (LED_R -> LED_G -> LED1 -> LED2 -> LED3 -> LED_R)
${DEBOUNCE_MODS_V}module top (
    input  wire       clk,
    input  wire       KEY2,        // active low
    output wire       LED_R,
    output wire       LED_G,
    output wire [2:0] EXT_LED
);
    wire db, tick;
    debounce    u_db (.clk(clk), .sw(~KEY2), .db(db));
    edge_detect e_db (.clk(clk), .level(db), .tick(tick));

    reg [4:0] r = 5'b00001;
    always @(posedge clk)
        if (tick) r <= {r[3:0], r[4]};

    assign LED_R   = r[0];
    assign LED_G   = r[1];
    assign EXT_LED = r[4:2];
endmodule
`;

export const V_DEBOUNCE_SOL_VHD = `${DEBOUNCE_MODS_VHD}${VHDL_NUMERIC}
-- debounce exercise on the EBAZ4205: the five LEDs are a register that starts at 00001 and rotates left by
-- one bit on every press of KEY2 (LED_R -> LED_G -> LED1 -> LED2 -> LED3 -> LED_R)
entity top is
    port (
        clk     : in  std_logic;
        KEY2    : in  std_logic;                      -- active low
        LED_R   : out std_logic;
        LED_G   : out std_logic;
        EXT_LED : out std_logic_vector(2 downto 0)
    );
end top;

architecture rtl of top is
    signal key, db, tick : std_logic;
    signal r : std_logic_vector(4 downto 0) := "00001";
begin
    key <= not KEY2;
    u_db : entity work.debounce    port map (clk => clk, sw => key, db => db);
    e_db : entity work.edge_detect port map (clk => clk, level => db, tick => tick);

    process(clk)
    begin
        if rising_edge(clk) then
            if tick = '1' then
                r <= r(3 downto 0) & r(4);
            end if;
        end if;
    end process;

    LED_R   <= r(0);
    LED_G   <= r(1);
    EXT_LED <= r(4 downto 2);
end rtl;
`;

// ---------------------------------------------------------------- pwm
const PW = nexys('pwm');
const PWM_MOD_V = PW.verilog.slice(PW.verilog.indexOf('module pwm'), PW.verilog.indexOf('module top'));
const PWM_MOD_VHD = PW.vhdl.slice(0, nth(PW.vhdl, 'library ieee', 2));

export const V_PWM_V = `// Parameterised PWM on the EBAZ4205: LED1-LED3 of the extension board at three brightness levels.
// While KEY3 is held, all three take the brightness that KEY2 and KEY4 step down and up.
${PWM_MOD_V}module top (
    input  wire       clk,         // 50 MHz from the PS
    input  wire       KEY2,        // darker (hold), active low
    input  wire       KEY3,        // show the adjustable level on all three LEDs (hold), active low
    input  wire       KEY4,        // brighter (hold), active low
    output wire [2:0] EXT_LED
);
    // the adjustable level: one step every 1/64 s while KEY2 or KEY4 is held
    reg [19:0] slow  = 0;
    reg [7:0]  level = 8'd128;
    always @(posedge clk) begin
        slow <= slow + 1;
        if (slow == 0) begin
            if (!KEY4 && level != 8'd255) level <= level + 1;
            if (!KEY2 && level != 8'd0)   level <= level - 1;
        end
    end

    wire [7:0] d0 = KEY3 ? 8'd16  : level;   // LED1: about 6 %
    wire [7:0] d1 = KEY3 ? 8'd64  : level;   // LED2: 25 %
    wire [7:0] d2 = KEY3 ? 8'd255 : level;   // LED3: nearly 100 %
    wire p0, p1, p2;
    pwm #(.W(8)) pwm_0 (.clk(clk), .duty(d0), .pwm_o(p0));
    pwm #(.W(8)) pwm_1 (.clk(clk), .duty(d1), .pwm_o(p1));
    pwm #(.W(8)) pwm_2 (.clk(clk), .duty(d2), .pwm_o(p2));

    assign EXT_LED = {p2, p1, p0};
endmodule
`;

export const V_PWM_VHD = `${PWM_MOD_VHD}${VHDL_NUMERIC}
-- LED1-LED3 of the EBAZ4205 extension board at three brightness levels.
-- While KEY3 is held, all three take the brightness that KEY2 and KEY4 step down and up.
entity top is
    port (
        clk     : in  std_logic;                      -- 50 MHz from the PS
        KEY2    : in  std_logic;                      -- darker (hold), active low
        KEY3    : in  std_logic;                      -- show the adjustable level on all three LEDs (hold), active low
        KEY4    : in  std_logic;                      -- brighter (hold), active low
        EXT_LED : out std_logic_vector(2 downto 0)
    );
end top;

architecture rtl of top is
    signal slow       : unsigned(19 downto 0) := (others => '0');
    signal level      : unsigned(7 downto 0) := to_unsigned(128, 8);
    signal d0, d1, d2 : std_logic_vector(7 downto 0);
    signal p0, p1, p2 : std_logic;
begin
    -- the adjustable level: one step every 1/64 s while KEY2 or KEY4 is held
    process(clk)
    begin
        if rising_edge(clk) then
            slow <= slow + 1;
            if slow = 0 then
                if KEY4 = '0' and level /= 255 then level <= level + 1; end if;
                if KEY2 = '0' and level /= 0 then level <= level - 1; end if;
            end if;
        end if;
    end process;

    d0 <= x"10" when KEY3 = '1' else std_logic_vector(level);   -- LED1: about 6 %
    d1 <= x"40" when KEY3 = '1' else std_logic_vector(level);   -- LED2: 25 %
    d2 <= x"FF" when KEY3 = '1' else std_logic_vector(level);   -- LED3: nearly 100 %

    pwm_0 : entity work.pwm generic map (W => 8) port map (clk => clk, duty => d0, pwm_o => p0);
    pwm_1 : entity work.pwm generic map (W => 8) port map (clk => clk, duty => d1, pwm_o => p1);
    pwm_2 : entity work.pwm generic map (W => 8) port map (clk => clk, duty => d2, pwm_o => p2);

    EXT_LED <= p2 & p1 & p0;
end rtl;
`;

export const V_PWM_SOL_V = `// pwm exercise on the EBAZ4205: LED1 "breathes". The duty goes up one step every DIV clocks to 255, then down
// to 0, and again.
${PWM_MOD_V}module top #(
    parameter DIV = 100_000           // 2 ms per step at 50 MHz: about one breath a second
) (
    input  wire       clk,
    output wire [2:0] EXT_LED
);
    reg [16:0] cnt   = 0;
    reg [7:0]  level = 0;
    reg        up    = 1'b1;

    always @(posedge clk) begin
        if (cnt == DIV - 1) begin
            cnt <= 0;
            if (up) begin
                if (level == 8'd254) up <= 1'b0;
                level <= level + 1;
            end else begin
                if (level == 8'd1) up <= 1'b1;
                level <= level - 1;
            end
        end else
            cnt <= cnt + 1;
    end

    wire p0;
    pwm #(.W(8)) pwm_0 (.clk(clk), .duty(level), .pwm_o(p0));
    assign EXT_LED = {2'b00, p0};
endmodule
`;

export const V_PWM_SOL_VHD = `${PWM_MOD_VHD}${VHDL_NUMERIC}
-- pwm exercise on the EBAZ4205: LED1 "breathes". The duty goes up one step every DIV clocks to 255, then down
-- to 0, and again.
entity top is
    generic (DIV : integer := 100_000);             -- 2 ms per step at 50 MHz: about one breath a second
    port (
        clk     : in  std_logic;
        EXT_LED : out std_logic_vector(2 downto 0)
    );
end top;

architecture rtl of top is
    signal cnt   : integer range 0 to DIV - 1 := 0;
    signal level : unsigned(7 downto 0) := (others => '0');
    signal up    : std_logic := '1';
    signal p0    : std_logic;
begin
    process(clk)
    begin
        if rising_edge(clk) then
            if cnt = DIV - 1 then
                cnt <= 0;
                if up = '1' then
                    if level = 254 then up <= '0'; end if;
                    level <= level + 1;
                else
                    if level = 1 then up <= '1'; end if;
                    level <= level - 1;
                end if;
            else
                cnt <= cnt + 1;
            end if;
        end if;
    end process;

    pwm_0 : entity work.pwm generic map (W => 8) port map (clk => clk, duty => std_logic_vector(level), pwm_o => p0);
    EXT_LED <= "00" & p0;
end rtl;
`;

// ---------------------------------------------------------------- uart (transmitter)
export const V_UART_V = `// UART transmitter (115200 baud, 8N1) on the EBAZ4205: KEY3 sends "Hello FPGA!" through the extension
// board's USB-C serial port (CH340C). 50 MHz / 115200 = 434 clocks per bit.
${UART_TX_MOD_V}module top (
    input  wire       clk,         // 50 MHz from the PS
    input  wire       KEY3,        // send the message once, active low
    output wire       UART_TX,     // FPGA -> PC (H17)
    output wire [2:0] EXT_LED      // LED1 = busy
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
    reg        key_d = 1'b1;       // KEY3 one clock ago
    wire       busy;
    wire       start = (state == S_SEND);

    uart_tx tx_unit (.clk(clk), .start(start), .data(ch), .tx(UART_TX), .busy(busy));

    always @(posedge clk) begin
        key_d <= KEY3;
        case (state)
            S_IDLE:
                if (key_d && !KEY3) begin  // KEY3 has just gone down
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

    assign EXT_LED = {2'b00, busy};
endmodule
`;

export const V_UART_VHD = `${UART_TX_MOD_VHD}${VHDL_NUMERIC}
-- sends "Hello FPGA!" through the EBAZ4205 extension board's USB-C serial port when KEY3 is pressed
entity top is
    port (
        clk     : in  std_logic;                      -- 50 MHz from the PS
        KEY3    : in  std_logic;                      -- send the message once, active low
        UART_TX : out std_logic;                      -- FPGA -> PC (H17)
        EXT_LED : out std_logic_vector(2 downto 0)    -- LED1 = busy
    );
end top;

architecture rtl of top is
    type state_t is (S_IDLE, S_SEND, S_WAIT);
    signal state : state_t := S_IDLE;
    signal idx   : unsigned(3 downto 0) := (others => '0');
    signal ch    : std_logic_vector(7 downto 0);
    signal key_d : std_logic := '1';                  -- KEY3 one clock ago
    signal busy  : std_logic;
    signal start : std_logic;
begin
    -- message ROM: "Hello FPGA!\\r\\n"
    with to_integer(idx) select ch <=
        x"48" when 0,   -- H
        x"65" when 1,   -- e
        x"6C" when 2,   -- l
        x"6C" when 3,   -- l
        x"6F" when 4,   -- o
        x"20" when 5,   -- ' '
        x"46" when 6,   -- F
        x"50" when 7,   -- P
        x"47" when 8,   -- G
        x"41" when 9,   -- A
        x"21" when 10,  -- !
        x"0D" when 11,  -- \\r
        x"0A" when others;  -- \\n

    start <= '1' when state = S_SEND else '0';
    tx_unit : entity work.uart_tx port map (clk => clk, start => start, data => ch, tx => UART_TX, busy => busy);

    process(clk)
    begin
        if rising_edge(clk) then
            key_d <= KEY3;
            case state is
                when S_IDLE =>
                    if key_d = '1' and KEY3 = '0' then  -- KEY3 has just gone down
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

    EXT_LED <= "00" & busy;
end rtl;
`;

// ---------------------------------------------------------------- uart_rx (receiver and echo)
export const V_UART_RX_V = `// UART receiver + echo on the EBAZ4205: letters typed in the serial console come back in upper case,
// through the extension board's USB-C serial port. 50 MHz / 115200 = 434 clocks per bit.
${UART_RX_MOD_V}${UART_TX_MOD_V}module top (
    input  wire       clk,         // 50 MHz from the PS
    input  wire       UART_RX,     // PC -> FPGA (H16)
    output wire       UART_TX,     // FPGA -> PC (H17)
    output wire [2:0] EXT_LED      // the low three bits of the last byte
);
    wire [7:0] rx_data;
    wire       rx_done;
    wire       busy;

    uart_rx rx_unit (.clk(clk), .rx(UART_RX), .data(rx_data), .done(rx_done));

    // lower-case letters become upper case
    wire [7:0] upper = (rx_data >= 8'h61 && rx_data <= 8'h7A) ? rx_data - 8'h20 : rx_data;

    // hold one byte while the transmitter is still busy with the previous one
    reg  [7:0] hold  = 0;
    reg        pend  = 1'b0;
    wire       start = pend && !busy;
    always @(posedge clk) begin
        if (rx_done) begin
            hold <= upper;
            pend <= 1'b1;
        end else if (start)
            pend <= 1'b0;
    end

    uart_tx tx_unit (.clk(clk), .start(start), .data(hold), .tx(UART_TX), .busy(busy));

    assign EXT_LED = rx_data[2:0];
endmodule
`;

export const V_UART_RX_VHD = `${UART_RX_MOD_VHD}${UART_TX_MOD_VHD}${VHDL_NUMERIC}
-- letters typed in the serial console come back in upper case, through the EBAZ4205 extension board's USB-C port
entity top is
    port (
        clk     : in  std_logic;                      -- 50 MHz from the PS
        UART_RX : in  std_logic;                      -- PC -> FPGA (H16)
        UART_TX : out std_logic;                      -- FPGA -> PC (H17)
        EXT_LED : out std_logic_vector(2 downto 0)    -- the low three bits of the last byte
    );
end top;

architecture rtl of top is
    signal rx_data, upper, hold : std_logic_vector(7 downto 0) := (others => '0');
    signal rx_done, busy, start : std_logic;
    signal pend                 : std_logic := '0';
begin
    rx_unit : entity work.uart_rx port map (clk => clk, rx => UART_RX, data => rx_data, done => rx_done);

    -- lower-case letters become upper case
    upper <= std_logic_vector(unsigned(rx_data) - 32) when unsigned(rx_data) >= 97 and unsigned(rx_data) <= 122
             else rx_data;

    -- hold one byte while the transmitter is still busy with the previous one
    start <= pend and not busy;
    process(clk)
    begin
        if rising_edge(clk) then
            if rx_done = '1' then
                hold <= upper;
                pend <= '1';
            elsif start = '1' then
                pend <= '0';
            end if;
        end if;
    end process;

    tx_unit : entity work.uart_tx port map (clk => clk, start => start, data => hold, tx => UART_TX, busy => busy);

    EXT_LED <= rx_data(2 downto 0);
end rtl;
`;

// both UART exercises: the same design at 9600 baud (50 MHz / 9600 = 5208 clocks per bit)
export const at9600 = (s: string) =>
  s
    .replaceAll('CLKS_PER_BIT = 434) (   // 50 MHz / 115200', 'CLKS_PER_BIT = 5208) (  // 50 MHz / 9600')
    .replaceAll('CLKS_PER_BIT = 434)', 'CLKS_PER_BIT = 5208)')
    .replaceAll('integer := 434);   -- 50 MHz / 115200', 'integer := 5208);  -- 50 MHz / 9600');
