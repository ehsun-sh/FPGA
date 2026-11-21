// Lesson code for the EBAZ4205 extension board (chapters "Extension board" and "HDMI", docs/EBAZ4205-ROADMAP.md
// Phases E3 and E4), in Verilog and VHDL. Every design is clocked by clk = FCLK_CLK0 (50 MHz) and keeps its long
// delays in a parameter / generic, which the checkers and tests make small.
import { ADVANCED } from '../../lessons/advanced';

const VHDL_NUMERIC = `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
`;

// ---------------------------------------------------------------- x-leds
export const X_LEDS_V = `// x-leds: a running light on the extension board's LED1-LED3, from the 50 MHz clock
module top #(
    parameter DIV = 12_500_000            // clocks per step: 0.25 s at 50 MHz
) (
    input  wire       clk,                // FCLK_CLK0 from the PS, 50 MHz
    output reg  [2:0] EXT_LED = 3'b001    // LED1-LED3, 1 = on
);
    reg [23:0] cnt = 0;
    always @(posedge clk) begin
        if (cnt == DIV - 1) begin
            cnt     <= 0;
            EXT_LED <= {EXT_LED[1:0], EXT_LED[2]};   // rotate left: LED1 -> LED2 -> LED3 -> LED1
        end else
            cnt <= cnt + 1;
    end
endmodule
`;

export const X_LEDS_VHD = `-- x-leds: a running light on the extension board's LED1-LED3, from the 50 MHz clock
${VHDL_NUMERIC}
entity top is
    generic (DIV : integer := 12500000);            -- clocks per step: 0.25 s at 50 MHz
    port (
        clk     : in  std_logic;                    -- FCLK_CLK0 from the PS, 50 MHz
        EXT_LED : out std_logic_vector(2 downto 0)  -- LED1-LED3, '1' = on
    );
end entity;

architecture rtl of top is
    signal cnt : unsigned(23 downto 0) := (others => '0');
    signal led : std_logic_vector(2 downto 0) := "001";
begin
    process (clk)
    begin
        if rising_edge(clk) then
            if cnt = DIV - 1 then
                cnt <= (others => '0');
                led <= led(1 downto 0) & led(2);    -- rotate left: LED1 -> LED2 -> LED3 -> LED1
            else
                cnt <= cnt + 1;
            end if;
        end if;
    end process;
    EXT_LED <= led;
end architecture;
`;

// ---------------------------------------------------------------- x-keys
export const X_KEYS_V = `// x-keys: every press of KEY1 toggles LED1, without bounce.
// The keys are active low (a pull-up resistor, and the key shorts the pin to ground): pressed = 0.
module top #(
    parameter DB = 500_000                // debounce time in clocks: 10 ms at 50 MHz
) (
    input  wire       clk,
    input  wire       KEY1,
    output reg  [2:0] EXT_LED = 3'b000
);
    // 1. two flip-flops: the key is not in step with clk
    reg [1:0] sync = 2'b11;
    always @(posedge clk) sync <= {sync[0], KEY1};
    wire raw = ~sync[1];                  // active low: 0 on the pin means pressed

    // 2. debounce: take a new level only after it has stayed the same for DB clocks
    reg [19:0] cnt     = 0;
    reg        pressed = 1'b0;
    always @(posedge clk) begin
        if (raw == pressed)
            cnt <= 0;
        else if (cnt == DB - 1) begin
            cnt     <= 0;
            pressed <= raw;
        end else
            cnt <= cnt + 1;
    end

    // 3. edge detector: a one-clock pulse when the key goes down
    reg  prev  = 1'b0;
    always @(posedge clk) prev <= pressed;
    wire press = pressed & ~prev;

    always @(posedge clk)
        if (press) EXT_LED[0] <= ~EXT_LED[0];
endmodule
`;

export const X_KEYS_VHD = `-- x-keys: every press of KEY1 toggles LED1, without bounce.
-- The keys are active low (a pull-up resistor, and the key shorts the pin to ground): pressed = '0'.
${VHDL_NUMERIC}
entity top is
    generic (DB : integer := 500000);               -- debounce time in clocks: 10 ms at 50 MHz
    port (
        clk     : in  std_logic;
        KEY1    : in  std_logic;
        EXT_LED : out std_logic_vector(2 downto 0)
    );
end entity;

architecture rtl of top is
    signal sync    : std_logic_vector(1 downto 0) := "11";
    signal raw     : std_logic;
    signal cnt     : unsigned(19 downto 0) := (others => '0');
    signal pressed : std_logic := '0';
    signal prev    : std_logic := '0';
    signal led     : std_logic := '0';
begin
    -- 1. two flip-flops: the key is not in step with clk
    process (clk)
    begin
        if rising_edge(clk) then
            sync <= sync(0) & KEY1;
        end if;
    end process;
    raw <= not sync(1);                             -- active low: '0' on the pin means pressed

    -- 2. debounce: take a new level only after it has stayed the same for DB clocks
    process (clk)
    begin
        if rising_edge(clk) then
            if raw = pressed then
                cnt <= (others => '0');
            elsif cnt = DB - 1 then
                cnt     <= (others => '0');
                pressed <= raw;
            else
                cnt <= cnt + 1;
            end if;
        end if;
    end process;

    -- 3. edge detector: toggle LED1 once when the key goes down
    process (clk)
    begin
        if rising_edge(clk) then
            prev <= pressed;
            if pressed = '1' and prev = '0' then
                led <= not led;
            end if;
        end if;
    end process;
    EXT_LED <= "00" & led;
end architecture;
`;

// ---------------------------------------------------------------- x-uart (the receiver and transmitter of the
// Nexys lessons uart and uart_rx, at 50 MHz: 50,000,000 / 115,200 = 434 clocks per bit)
const RX_LESSON = ADVANCED.find((l) => l.id === 'uart_rx')!;
const at50 = (s: string) => s.replace(/CLKS_PER_BIT = 868\) \(\s*\/\/ 100 MHz \/ 115200/, 'CLKS_PER_BIT = 434) (   // 50 MHz / 115200').replace(/CLKS_PER_BIT = 868\)/, 'CLKS_PER_BIT = 434)').replace(/integer := 868\);(\s*-- 100 MHz \/ 115200)?/, 'integer := 434);   -- 50 MHz / 115200');
const vRx = RX_LESSON.verilog;
export const UART_RX_MOD_V = at50(vRx.slice(vRx.indexOf('module uart_rx'), vRx.indexOf('module uart_tx')));
export const UART_TX_MOD_V = at50(vRx.slice(vRx.indexOf('module uart_tx'), vRx.indexOf('module top')));
const UART_MODULES_V = UART_RX_MOD_V + UART_TX_MOD_V;
const hRx = RX_LESSON.vhdl;
const lib2 = hRx.indexOf('library ieee', 10);
const lib3 = hRx.indexOf('library ieee', lib2 + 10);
export const UART_RX_MOD_VHD = at50(hRx.slice(0, lib2));
export const UART_TX_MOD_VHD = at50(hRx.slice(lib2, lib3));
const UART_MODULES_VHD = UART_RX_MOD_VHD + UART_TX_MOD_VHD;

export const X_UART_V = `// x-uart: the extension board's USB-C serial port (CH340C), 115200 baud 8N1.
// Every byte typed in the terminal comes back; the digits 1, 2 and 3 also toggle LED1, LED2 and LED3.
${UART_MODULES_V}module top (
    input  wire       clk,                // 50 MHz
    input  wire       UART_RX,            // from the PC (H16)
    output wire       UART_TX,            // to the PC (H17)
    output reg  [2:0] EXT_LED = 3'b000
);
    wire [7:0] rx_data;
    wire       rx_done;
    wire       busy;

    uart_rx rx_unit (.clk(clk), .rx(UART_RX), .data(rx_data), .done(rx_done));

    // commands: '1', '2', '3' toggle one LED each
    always @(posedge clk)
        if (rx_done)
            case (rx_data)
                8'h31:   EXT_LED[0] <= ~EXT_LED[0];   // '1'
                8'h32:   EXT_LED[1] <= ~EXT_LED[1];   // '2'
                8'h33:   EXT_LED[2] <= ~EXT_LED[2];   // '3'
                default: EXT_LED    <= EXT_LED;
            endcase

    // echo: hold one byte while the transmitter is still busy with the previous one
    reg  [7:0] hold  = 0;
    reg        pend  = 1'b0;
    wire       start = pend && !busy;
    always @(posedge clk) begin
        if (rx_done) begin
            hold <= rx_data;
            pend <= 1'b1;
        end else if (start)
            pend <= 1'b0;
    end

    uart_tx tx_unit (.clk(clk), .start(start), .data(hold), .tx(UART_TX), .busy(busy));
endmodule
`;

export const X_UART_VHD = `-- x-uart: the extension board's USB-C serial port (CH340C), 115200 baud 8N1.
-- Every byte typed in the terminal comes back; the digits 1, 2 and 3 also toggle LED1, LED2 and LED3.
${UART_MODULES_VHD}${VHDL_NUMERIC}
entity top is
    port (
        clk     : in  std_logic;                    -- 50 MHz
        UART_RX : in  std_logic;                    -- from the PC (H16)
        UART_TX : out std_logic;                    -- to the PC (H17)
        EXT_LED : out std_logic_vector(2 downto 0)
    );
end entity;

architecture rtl of top is
    signal rx_data, hold  : std_logic_vector(7 downto 0) := (others => '0');
    signal rx_done, busy  : std_logic;
    signal start          : std_logic;
    signal pend           : std_logic := '0';
    signal led            : std_logic_vector(2 downto 0) := "000";
begin
    rx_unit : entity work.uart_rx port map (clk => clk, rx => UART_RX, data => rx_data, done => rx_done);

    start <= pend and not busy;
    process (clk)
    begin
        if rising_edge(clk) then
            if rx_done = '1' then
                -- commands: '1', '2', '3' toggle one LED each
                case rx_data is
                    when x"31"  => led(0) <= not led(0);
                    when x"32"  => led(1) <= not led(1);
                    when x"33"  => led(2) <= not led(2);
                    when others => null;
                end case;
                -- echo: hold one byte while the transmitter is still busy with the previous one
                hold <= rx_data;
                pend <= '1';
            elsif start = '1' then
                pend <= '0';
            end if;
        end if;
    end process;

    tx_unit : entity work.uart_tx port map (clk => clk, start => start, data => hold, tx => UART_TX, busy => busy);
    EXT_LED <= led;
end architecture;
`;

// ---------------------------------------------------------------- x-buzzer (docs/ebaz4205/code/x_tone.v and .vhd)
export const X_BUZZER_V = `// x-buzzer: a square-wave tone generator that plays a C-major scale up and down on the buzzer.
// The note table is worked out from CLK_HZ; NOTE_TICKS sets how long each note lasts.
// KEY1 mutes the sound while it is held (the keys are active low: pressed = 0).
module top #(
    parameter CLK_HZ     = 50_000_000,
    parameter NOTE_TICKS = 12_500_000     // 0.25 s per note at 50 MHz
) (
    input  wire clk,
    input  wire KEY1,
    output reg  BUZZER = 0
);
    // the notes C4 D4 E4 F4 G4 A4 B4 C5 (262 294 330 349 392 440 494 523 Hz) up, then back down
    reg [3:0] step = 0;                   // 0..13: up 0..7, down 6..1
    reg [2:0] note;
    always @(*) begin
        if (step < 8) note = step[2:0];
        else          note = 14 - step;
    end
    // half a period in clocks: CLK_HZ / (2 * f)
    reg [23:0] half;
    always @(*) begin
        case (note)
            3'd0: half = CLK_HZ / 524;
            3'd1: half = CLK_HZ / 588;
            3'd2: half = CLK_HZ / 660;
            3'd3: half = CLK_HZ / 698;
            3'd4: half = CLK_HZ / 784;
            3'd5: half = CLK_HZ / 880;
            3'd6: half = CLK_HZ / 988;
            default: half = CLK_HZ / 1046;
        endcase
    end

    reg [23:0] pcnt = 0;                  // counts one half period of the tone
    reg [23:0] ncnt = 0;                  // counts the length of the note
    always @(posedge clk) begin
        if (pcnt >= half - 1) begin
            pcnt   <= 0;
            BUZZER <= KEY1 ? ~BUZZER : 1'b0; // KEY1 = 0 (pressed): silence
        end else
            pcnt <= pcnt + 1;

        if (ncnt == NOTE_TICKS - 1) begin
            ncnt <= 0;
            step <= (step == 13) ? 4'd0 : step + 1;
            pcnt <= 0;
        end else
            ncnt <= ncnt + 1;
    end
endmodule
`;

export const X_BUZZER_VHD = `-- x-buzzer: a square-wave tone generator that plays a C-major scale up and down on the buzzer.
-- The note table is worked out from CLK_HZ; NOTE_TICKS sets how long each note lasts.
-- KEY1 mutes the sound while it is held (the keys are active low: pressed = '0').
${VHDL_NUMERIC}
entity top is
    generic (
        CLK_HZ     : integer := 50000000;
        NOTE_TICKS : integer := 12500000            -- 0.25 s per note at 50 MHz
    );
    port (
        clk    : in  std_logic;
        KEY1   : in  std_logic;
        BUZZER : out std_logic
    );
end entity;

architecture rtl of top is
    signal step : integer range 0 to 13 := 0;       -- 0..13: up 0..7, down 6..1
    signal note : integer range 0 to 7;
    signal half : integer;                          -- half a period in clocks: CLK_HZ / (2 * f)
    signal pcnt : integer := 0;                     -- counts one half period of the tone
    signal ncnt : integer := 0;                     -- counts the length of the note
    signal bz   : std_logic := '0';
begin
    note <= step when step < 8 else 14 - step;

    -- the notes C4 D4 E4 F4 G4 A4 B4 C5 (262 294 330 349 392 440 494 523 Hz)
    with note select half <=
        CLK_HZ / 524  when 0,
        CLK_HZ / 588  when 1,
        CLK_HZ / 660  when 2,
        CLK_HZ / 698  when 3,
        CLK_HZ / 784  when 4,
        CLK_HZ / 880  when 5,
        CLK_HZ / 988  when 6,
        CLK_HZ / 1046 when others;

    process (clk)
    begin
        if rising_edge(clk) then
            if pcnt >= half - 1 then
                pcnt <= 0;
                if KEY1 = '1' then bz <= not bz; else bz <= '0'; end if;   -- KEY1 = '0' (pressed): silence
            else
                pcnt <= pcnt + 1;
            end if;

            if ncnt = NOTE_TICKS - 1 then
                ncnt <= 0;
                pcnt <= 0;
                if step = 13 then step <= 0; else step <= step + 1; end if;
            else
                ncnt <= ncnt + 1;
            end if;
        end if;
    end process;
    BUZZER <= bz;
end architecture;
`;

// ---------------------------------------------------------------- x-lcd
// the colour of pixel (x, y), and the init sequence, are shared text so the exercise solution can change one place
export const X_LCD_V = `// x-lcd: wake the extension board's 1.3-inch IPS display (ST7789, 240 x 240, SPI) and paint
// eight colour stripes. SPI mode 0, MSB first; SCL = clk / 2 = 25 MHz.
module top #(
    parameter CLK_HZ = 50_000_000         // the checker makes it small, so the waits get short
) (
    input  wire clk,
    output reg  LCD_RES = 1'b0,           // reset, active low
    output reg  LCD_DC  = 1'b0,           // 0 = command byte, 1 = data byte
    output reg  LCD_SCL = 1'b0,           // SPI clock
    output reg  LCD_SDA = 1'b0,           // SPI data
    output wire LCD_BLK                   // backlight, 1 = on
);
    assign LCD_BLK = 1'b1;
    localparam MS = CLK_HZ / 1000;        // clocks per millisecond

    // the init sequence, one step per line: {kind, value}
    // kind 0: command byte, 1: data byte, 2: wait <value> ms, 3: end (the pixels follow)
    reg [4:0] idx = 0;
    reg [9:0] rom;
    always @(*) begin
        case (idx)
            5'd0:  rom = {2'd0, 8'h01};   // SWRESET: software reset
            5'd1:  rom = {2'd2, 8'd150};  //   wait 150 ms
            5'd2:  rom = {2'd0, 8'h11};   // SLPOUT: leave sleep mode
            5'd3:  rom = {2'd2, 8'd120};  //   wait 120 ms
            5'd4:  rom = {2'd0, 8'h3A};   // COLMOD: colour format
            5'd5:  rom = {2'd1, 8'h55};   //   16 bits per pixel (RGB565)
            5'd6:  rom = {2'd0, 8'h36};   // MADCTL: memory order
            5'd7:  rom = {2'd1, 8'h00};   //   left to right, top to bottom
            5'd8:  rom = {2'd0, 8'h21};   // INVON: an IPS panel needs inversion on
            5'd9:  rom = {2'd0, 8'h2A};   // CASET: columns 0 to 239
            5'd10: rom = {2'd1, 8'h00};
            5'd11: rom = {2'd1, 8'h00};
            5'd12: rom = {2'd1, 8'h00};
            5'd13: rom = {2'd1, 8'hEF};
            5'd14: rom = {2'd0, 8'h2B};   // RASET: rows 0 to 239
            5'd15: rom = {2'd1, 8'h00};
            5'd16: rom = {2'd1, 8'h00};
            5'd17: rom = {2'd1, 8'h00};
            5'd18: rom = {2'd1, 8'hEF};
            5'd19: rom = {2'd0, 8'h29};   // DISPON: display on
            5'd20: rom = {2'd0, 8'h2C};   // RAMWR: write memory, the pixels follow
            default: rom = {2'd3, 8'h00}; // end
        endcase
    end

    // the pixel being sent, and its colour: eight stripes of 30 columns (RGB565: 5 bits red, 6 green, 5 blue)
    reg [7:0]  x = 0;
    reg [7:0]  y = 0;
    reg [2:0]  stripe = 0;                // x / 30
    reg [4:0]  sx = 0;                    // x mod 30
    reg [15:0] color;
    always @(*) begin
        case (stripe)
            3'd0: color = 16'hFFFF;       // white
            3'd1: color = 16'hFFE0;       // yellow
            3'd2: color = 16'h07FF;       // cyan
            3'd3: color = 16'h07E0;       // green
            3'd4: color = 16'hF81F;       // magenta
            3'd5: color = 16'hF800;       // red
            3'd6: color = 16'h001F;       // blue
            default: color = 16'h0000;    // black
        endcase
    end

    localparam [2:0] RESET = 3'd0, BOOT = 3'd1, STEP = 3'd2, WAIT = 3'd3, SEND = 3'd4, PIXEL = 3'd5, DONE = 3'd6;
    reg [2:0]  state = RESET;
    reg [2:0]  back  = STEP;              // where SEND goes when the byte is out
    reg [23:0] cnt   = 0;
    reg [7:0]  sh    = 0;                 // the bits still to send, next one in bit 7
    reg [2:0]  nbit  = 0;
    reg        lo    = 1'b0;              // 0: the pixel's high byte goes next, 1: its low byte

    always @(posedge clk) begin
        case (state)
            RESET:                        // hold RES low for 10 ms
                if (cnt == 10 * MS - 1) begin
                    cnt     <= 0;
                    LCD_RES <= 1'b1;
                    state   <= BOOT;
                end else
                    cnt <= cnt + 1;
            BOOT:                         // the controller needs 120 ms after a reset
                if (cnt == 120 * MS - 1) begin
                    cnt   <= 0;
                    state <= STEP;
                end else
                    cnt <= cnt + 1;
            STEP:                         // the next line of the init sequence
                if (rom[9:8] == 2'd2) begin
                    cnt   <= rom[7:0] * MS;
                    idx   <= idx + 1;
                    state <= WAIT;
                end else if (rom[9:8] == 2'd3)
                    state <= PIXEL;
                else begin
                    LCD_DC  <= rom[8];    // kind 0: command, kind 1: data
                    LCD_SDA <= rom[7];    // the first bit goes on SDA now
                    sh      <= {rom[6:0], 1'b0};
                    nbit    <= 0;
                    idx     <= idx + 1;
                    back    <= STEP;
                    state   <= SEND;
                end
            WAIT:
                if (cnt == 0) state <= STEP;
                else          cnt <= cnt - 1;
            SEND:                         // SDA is ready: SCL goes up (the display reads the bit),
                if (!LCD_SCL)             // then down again, and the next bit goes on SDA
                    LCD_SCL <= 1'b1;
                else begin
                    LCD_SCL <= 1'b0;
                    if (nbit == 3'd7)
                        state <= back;
                    else begin
                        LCD_SDA <= sh[7];
                        sh      <= {sh[6:0], 1'b0};
                        nbit    <= nbit + 1;
                    end
                end
            PIXEL:                        // two bytes per pixel, high byte first
                if (y == 8'd240) begin
                    state  <= DONE;
                end else begin
                    LCD_DC  <= 1'b1;
                    LCD_SDA <= lo ? color[7] : color[15];
                    sh      <= lo ? {color[6:0], 1'b0} : {color[14:8], 1'b0};
                    nbit    <= 0;
                    lo      <= ~lo;
                    back    <= PIXEL;
                    state   <= SEND;
                    if (lo) begin         // that was the low byte: move on to the next pixel
                        if (sx == 5'd29) begin
                            sx     <= 0;
                            stripe <= stripe + 1;
                        end else
                            sx <= sx + 1;
                        if (x == 8'd239) begin
                            x      <= 0;
                            sx     <= 0;
                            stripe <= 0;
                            y      <= y + 1;
                        end else
                            x <= x + 1;
                    end
                end
            default: state <= DONE;       // DONE: the picture stays on the screen
        endcase
    end
endmodule
`;

export const X_LCD_VHD = `-- x-lcd: wake the extension board's 1.3-inch IPS display (ST7789, 240 x 240, SPI) and paint
-- eight colour stripes. SPI mode 0, MSB first; SCL = clk / 2 = 25 MHz.
${VHDL_NUMERIC}
entity top is
    generic (CLK_HZ : integer := 50000000);         -- the checker makes it small, so the waits get short
    port (
        clk     : in  std_logic;
        LCD_RES : out std_logic;                    -- reset, active low
        LCD_DC  : out std_logic;                    -- '0' = command byte, '1' = data byte
        LCD_SCL : out std_logic;                    -- SPI clock
        LCD_SDA : out std_logic;                    -- SPI data
        LCD_BLK : out std_logic                     -- backlight, '1' = on
    );
end entity;

architecture rtl of top is
    constant MS : integer := CLK_HZ / 1000;         -- clocks per millisecond

    -- the init sequence, one step per line: kind & value
    -- kind 0: command byte, 1: data byte, 2: wait <value> ms, 3: end (the pixels follow)
    signal idx : integer range 0 to 31 := 0;
    signal rom : std_logic_vector(9 downto 0);

    -- the pixel being sent, and its colour: eight stripes of 30 columns (RGB565)
    signal x, y   : integer range 0 to 255 := 0;
    signal stripe : integer range 0 to 7 := 0;      -- x / 30
    signal sx     : integer range 0 to 31 := 0;     -- x mod 30
    signal color  : std_logic_vector(15 downto 0);

    type state_t is (RESET, BOOT, STEP, WAIT_MS, SEND, PIXEL, DONE);
    signal state : state_t := RESET;
    signal back  : state_t := STEP;                 -- where SEND goes when the byte is out
    signal cnt   : integer range 0 to 16777215 := 0;
    signal sh    : std_logic_vector(7 downto 0) := (others => '0');   -- the bits still to send
    signal nbit  : integer range 0 to 7 := 0;
    signal lo    : std_logic := '0';                -- '0': the high byte goes next, '1': the low byte
    signal res, dc, scl, sda     : std_logic := '0';
begin
    with idx select rom <=
        "00" & x"01" when 0,                        -- SWRESET: software reset
        "10" & x"96" when 1,                        --   wait 150 ms
        "00" & x"11" when 2,                        -- SLPOUT: leave sleep mode
        "10" & x"78" when 3,                        --   wait 120 ms
        "00" & x"3A" when 4,                        -- COLMOD: colour format
        "01" & x"55" when 5,                        --   16 bits per pixel (RGB565)
        "00" & x"36" when 6,                        -- MADCTL: memory order
        "01" & x"00" when 7,                        --   left to right, top to bottom
        "00" & x"21" when 8,                        -- INVON: an IPS panel needs inversion on
        "00" & x"2A" when 9,                        -- CASET: columns 0 to 239
        "01" & x"00" when 10,
        "01" & x"00" when 11,
        "01" & x"00" when 12,
        "01" & x"EF" when 13,
        "00" & x"2B" when 14,                       -- RASET: rows 0 to 239
        "01" & x"00" when 15,
        "01" & x"00" when 16,
        "01" & x"00" when 17,
        "01" & x"EF" when 18,
        "00" & x"29" when 19,                       -- DISPON: display on
        "00" & x"2C" when 20,                       -- RAMWR: write memory, the pixels follow
        "11" & x"00" when others;                   -- end

    with stripe select color <=
        x"FFFF" when 0,                             -- white
        x"FFE0" when 1,                             -- yellow
        x"07FF" when 2,                             -- cyan
        x"07E0" when 3,                             -- green
        x"F81F" when 4,                             -- magenta
        x"F800" when 5,                             -- red
        x"001F" when 6,                             -- blue
        x"0000" when others;                        -- black

    process (clk)
    begin
        if rising_edge(clk) then
            case state is
                when RESET =>                       -- hold RES low for 10 ms
                    if cnt = 10 * MS - 1 then
                        cnt   <= 0;
                        res   <= '1';
                        state <= BOOT;
                    else
                        cnt <= cnt + 1;
                    end if;
                when BOOT =>                        -- the controller needs 120 ms after a reset
                    if cnt = 120 * MS - 1 then
                        cnt   <= 0;
                        state <= STEP;
                    else
                        cnt <= cnt + 1;
                    end if;
                when STEP =>                        -- the next line of the init sequence
                    if rom(9 downto 8) = "10" then
                        cnt   <= to_integer(unsigned(rom(7 downto 0))) * MS;
                        idx   <= idx + 1;
                        state <= WAIT_MS;
                    elsif rom(9 downto 8) = "11" then
                        state <= PIXEL;
                    else
                        dc    <= rom(8);            -- kind 0: command, kind 1: data
                        sda   <= rom(7);            -- the first bit goes on SDA now
                        sh    <= rom(6 downto 0) & '0';
                        nbit  <= 0;
                        idx   <= idx + 1;
                        back  <= STEP;
                        state <= SEND;
                    end if;
                when WAIT_MS =>
                    if cnt = 0 then
                        state <= STEP;
                    else
                        cnt <= cnt - 1;
                    end if;
                when SEND =>                        -- SDA is ready: SCL goes up (the display reads the bit),
                    if scl = '0' then               -- then down again, and the next bit goes on SDA
                        scl <= '1';
                    else
                        scl <= '0';
                        if nbit = 7 then
                            state <= back;
                        else
                            sda  <= sh(7);
                            sh   <= sh(6 downto 0) & '0';
                            nbit <= nbit + 1;
                        end if;
                    end if;
                when PIXEL =>                       -- two bytes per pixel, high byte first
                    if y = 240 then
                        state <= DONE;
                    else
                        dc <= '1';
                        if lo = '1' then
                            sda <= color(7);
                            sh  <= color(6 downto 0) & '0';
                        else
                            sda <= color(15);
                            sh  <= color(14 downto 8) & '0';
                        end if;
                        nbit  <= 0;
                        lo    <= not lo;
                        back  <= PIXEL;
                        state <= SEND;
                        if lo = '1' then            -- that was the low byte: move on to the next pixel
                            if x = 239 then
                                x      <= 0;
                                sx     <= 0;
                                stripe <= 0;
                                y      <= y + 1;
                            else
                                x <= x + 1;
                                if sx = 29 then
                                    sx     <= 0;
                                    stripe <= stripe + 1;
                                else
                                    sx <= sx + 1;
                                end if;
                            end if;
                        end if;
                    end if;
                when DONE =>                        -- the picture stays on the screen
                    null;
            end case;
        end if;
    end process;

    LCD_RES <= res;
    LCD_DC  <= dc;
    LCD_SCL <= scl;
    LCD_SDA <= sda;
    LCD_BLK <= '1';
end architecture;
`;

// ---------------------------------------------------------------- x-hdmi-tmds and x-hdmi-bars
// one TMDS channel encoder (DVI 1.0, section 3.2.2), from docs/ebaz4205/code/x_tmds.v with a clock enable: at 640x480
// the pixels come at 25 MHz, every second clock of the 50 MHz FCLK_CLK0
const TMDS_ENCODER_V = `// TMDS encoder for one channel (DVI 1.0, section 3.2.2). d = pixel byte, c = {C1, C0} control bits,
// de = 1 for video, 0 for blanking. It moves on one symbol per clock with ce = 1 (one pixel).
module tmds_encoder (
    input  wire       clk,
    input  wire       ce,
    input  wire [7:0] d,
    input  wire [1:0] c,
    input  wire       de,
    output reg  [9:0] q = 10'b1101010100
);
    // stage 1: a 9-bit word with few transitions (XOR or XNOR chain, whichever gives fewer)
    wire [3:0] n1d = d[0] + d[1] + d[2] + d[3] + d[4] + d[5] + d[6] + d[7];
    wire       x   = (n1d > 4) || (n1d == 4 && d[0] == 1'b0);   // 1: use XNOR
    wire [8:0] qm;
    assign qm[0] = d[0];
    assign qm[1] = qm[0] ^ d[1] ^ x;
    assign qm[2] = qm[1] ^ d[2] ^ x;
    assign qm[3] = qm[2] ^ d[3] ^ x;
    assign qm[4] = qm[3] ^ d[4] ^ x;
    assign qm[5] = qm[4] ^ d[5] ^ x;
    assign qm[6] = qm[5] ^ d[6] ^ x;
    assign qm[7] = qm[6] ^ d[7] ^ x;
    assign qm[8] = ~x;                    // 1: XOR, 0: XNOR

    // stage 2: DC balance. cnt = ones minus zeros sent so far (two's complement, cnt[4] is the sign)
    wire [3:0] n1q  = qm[0] + qm[1] + qm[2] + qm[3] + qm[4] + qm[5] + qm[6] + qm[7];
    wire [4:0] diff = {1'b0, n1q, 1'b0} - 5'd8;     // ones minus zeros of qm[7:0] = 2 * n1q - 8
    reg  [4:0] cnt  = 0;
    wire       cnt_zero = (cnt == 0);
    wire       cnt_pos  = !cnt[4] && !cnt_zero;
    wire       cnt_neg  = cnt[4];
    wire       more1    = (n1q > 4);
    wire       more0    = (n1q < 4);

    always @(posedge clk)
        if (ce) begin
            if (!de) begin                // blanking: one of four control symbols
                cnt <= 0;
                case (c)
                    2'b00:   q <= 10'b1101010100;
                    2'b01:   q <= 10'b0010101011;
                    2'b10:   q <= 10'b0101010100;
                    default: q <= 10'b1010101011;
                endcase
            end else if (cnt_zero || n1q == 4) begin
                q   <= {~qm[8], qm[8], qm[8] ? qm[7:0] : ~qm[7:0]};
                cnt <= qm[8] ? cnt + diff : cnt - diff;
            end else if ((cnt_pos && more1) || (cnt_neg && more0)) begin
                q   <= {1'b1, qm[8], ~qm[7:0]};          // invert the byte: it pulls the balance back
                cnt <= cnt + {3'b000, qm[8], 1'b0} - diff;
            end else begin
                q   <= {1'b0, qm[8], qm[7:0]};
                cnt <= cnt - {3'b000, ~qm[8], 1'b0} + diff;
            end
        end
endmodule
`;

const TMDS_ENCODER_VHD = `-- TMDS encoder for one channel (DVI 1.0, section 3.2.2). d = pixel byte, c = (C1, C0) control bits,
-- de = '1' for video, '0' for blanking. It moves on one symbol per clock with ce = '1' (one pixel).
${VHDL_NUMERIC}
entity tmds_encoder is
    port (
        clk : in  std_logic;
        ce  : in  std_logic;
        d   : in  std_logic_vector(7 downto 0);
        c   : in  std_logic_vector(1 downto 0);
        de  : in  std_logic;
        q   : out std_logic_vector(9 downto 0)
    );
end entity;

architecture rtl of tmds_encoder is
    signal n1d, n1q : integer range 0 to 8;
    signal x        : std_logic;
    signal qm       : std_logic_vector(8 downto 0);
    signal cnt      : integer range -16 to 15 := 0;  -- ones minus zeros sent so far
    signal qr       : std_logic_vector(9 downto 0) := "1101010100";
    signal diff     : integer range -8 to 8;          -- ones minus zeros of qm(7 downto 0)
begin
    -- stage 1: a 9-bit word with few transitions (XOR or XNOR chain, whichever gives fewer)
    n1d <= to_integer(unsigned(d(0 downto 0))) + to_integer(unsigned(d(1 downto 1)))
         + to_integer(unsigned(d(2 downto 2))) + to_integer(unsigned(d(3 downto 3)))
         + to_integer(unsigned(d(4 downto 4))) + to_integer(unsigned(d(5 downto 5)))
         + to_integer(unsigned(d(6 downto 6))) + to_integer(unsigned(d(7 downto 7)));
    x <= '1' when n1d > 4 or (n1d = 4 and d(0) = '0') else '0';   -- '1': use XNOR

    qm(0) <= d(0);
    qm(1) <= qm(0) xor d(1) xor x;
    qm(2) <= qm(1) xor d(2) xor x;
    qm(3) <= qm(2) xor d(3) xor x;
    qm(4) <= qm(3) xor d(4) xor x;
    qm(5) <= qm(4) xor d(5) xor x;
    qm(6) <= qm(5) xor d(6) xor x;
    qm(7) <= qm(6) xor d(7) xor x;
    qm(8) <= not x;                                   -- '1': XOR, '0': XNOR

    -- stage 2: DC balance
    n1q <= to_integer(unsigned(qm(0 downto 0))) + to_integer(unsigned(qm(1 downto 1)))
         + to_integer(unsigned(qm(2 downto 2))) + to_integer(unsigned(qm(3 downto 3)))
         + to_integer(unsigned(qm(4 downto 4))) + to_integer(unsigned(qm(5 downto 5)))
         + to_integer(unsigned(qm(6 downto 6))) + to_integer(unsigned(qm(7 downto 7)));
    diff <= 2 * n1q - 8;

    process (clk)
    begin
        if rising_edge(clk) then
            if ce = '1' then
                if de = '0' then                      -- blanking: one of four control symbols
                    cnt <= 0;
                    case c is
                        when "00"   => qr <= "1101010100";
                        when "01"   => qr <= "0010101011";
                        when "10"   => qr <= "0101010100";
                        when others => qr <= "1010101011";
                    end case;
                elsif cnt = 0 or n1q = 4 then
                    if qm(8) = '1' then
                        qr  <= "01" & qm(7 downto 0);
                        cnt <= cnt + diff;
                    else
                        qr  <= "10" & not qm(7 downto 0);
                        cnt <= cnt - diff;
                    end if;
                elsif (cnt > 0 and n1q > 4) or (cnt < 0 and n1q < 4) then
                    qr <= '1' & qm(8) & not qm(7 downto 0);  -- invert the byte: it pulls the balance back
                    if qm(8) = '1' then cnt <= cnt + 2 - diff; else cnt <= cnt - diff; end if;
                else
                    qr <= '0' & qm(8) & qm(7 downto 0);
                    if qm(8) = '0' then cnt <= cnt - 2 + diff; else cnt <= cnt + diff; end if;
                end if;
            end if;
        end if;
    end process;
    q <= qr;
end architecture;
`;

export const X_TMDS_V = `// x-hdmi-tmds: the TMDS encoder that HDMI and DVI use on each of their three colour channels,
// and a small demo: a new byte every half second, the encoder's choices on LED1-LED3.
${TMDS_ENCODER_V}
module top #(
    parameter DIV = 25_000_000            // a new byte every half second at 50 MHz
) (
    input  wire       clk,
    output wire [2:0] EXT_LED
);
    reg [24:0] cnt = 0;
    reg [7:0]  d   = 0;
    reg        ce  = 1'b0;
    always @(posedge clk) begin
        ce <= 1'b0;
        if (cnt == DIV - 1) begin
            cnt <= 0;
            d   <= d + 1;
            ce  <= 1'b1;                  // the encoder takes the new byte on the next clock
        end else
            cnt <= cnt + 1;
    end

    // every fourth byte is blanking (de = 0): the encoder sends a control symbol instead
    wire [9:0] q;
    tmds_encoder enc (.clk(clk), .ce(ce), .d(d), .c(2'b00), .de(d[1:0] != 2'b11), .q(q));

    // LED1: q[8] (1 = stage 1 used XOR, 0 = XNOR); LED2: q[9] (1 = stage 2 inverted the byte);
    // LED3: a control symbol (blanking)
    assign EXT_LED = {q == 10'b1101010100, q[9], q[8]};
endmodule
`;

export const X_TMDS_VHD = `-- x-hdmi-tmds: the TMDS encoder that HDMI and DVI use on each of their three colour channels,
-- and a small demo: a new byte every half second, the encoder's choices on LED1-LED3.
${TMDS_ENCODER_VHD}
${VHDL_NUMERIC}
entity top is
    generic (DIV : integer := 25000000);            -- a new byte every half second at 50 MHz
    port (
        clk     : in  std_logic;
        EXT_LED : out std_logic_vector(2 downto 0)
    );
end entity;

architecture rtl of top is
    signal cnt : integer range 0 to 33554431 := 0;
    signal d   : unsigned(7 downto 0) := (others => '0');
    signal ce  : std_logic := '0';
    signal de  : std_logic;
    signal q   : std_logic_vector(9 downto 0);
begin
    process (clk)
    begin
        if rising_edge(clk) then
            ce <= '0';
            if cnt = DIV - 1 then
                cnt <= 0;
                d   <= d + 1;
                ce  <= '1';                         -- the encoder takes the new byte on the next clock
            else
                cnt <= cnt + 1;
            end if;
        end if;
    end process;

    -- every fourth byte is blanking (de = '0'): the encoder sends a control symbol instead
    de <= '0' when d(1 downto 0) = "11" else '1';
    enc : entity work.tmds_encoder port map (clk => clk, ce => ce, d => std_logic_vector(d), c => "00", de => de, q => q);

    -- LED1: q(8) ('1' = stage 1 used XOR, '0' = XNOR); LED2: q(9) ('1' = stage 2 inverted the byte);
    -- LED3: a control symbol (blanking)
    EXT_LED(0) <= q(8);
    EXT_LED(1) <= q(9);
    EXT_LED(2) <= '1' when q = "1101010100" else '0';
end architecture;
`;

// the testbench of x-hdmi-tmds: a receiver decodes every symbol back to its byte
export const X_TMDS_TB_V = `\`timescale 1ns / 1ps
// Testbench for tmds_encoder. It plays the receiver: every symbol is decoded back to a byte, so it checks that
// (1) blanking sends the four control symbols and (2) every video byte comes back unchanged.
module tb;
    reg        clk = 0;
    reg  [7:0] d   = 0;
    reg  [1:0] c   = 0;
    reg        de  = 0;
    wire [9:0] q;
    tmds_encoder dut (.clk(clk), .ce(1'b1), .d(d), .c(c), .de(de), .q(q));

    always #20 clk = ~clk;                // 40 ns: a 25 MHz pixel clock

    // the receiver: undo stage 2 (q[9] = 1: the byte was inverted), then stage 1 (q[8] = 1: XOR, 0: XNOR)
    wire [7:0] m = q[9] ? ~q[7:0] : q[7:0];
    wire [7:0] back = {m[7] ^ m[6] ^ ~q[8], m[6] ^ m[5] ^ ~q[8], m[5] ^ m[4] ^ ~q[8], m[4] ^ m[3] ^ ~q[8],
                       m[3] ^ m[2] ^ ~q[8], m[2] ^ m[1] ^ ~q[8], m[1] ^ m[0] ^ ~q[8], m[0]};

    integer i;
    integer errors = 0;
    initial begin
        $display("tmds_encoder: 4 control symbols, then 512 video symbols decoded back");
        // 1. blanking: the four control symbols
        de = 0;
        c = 2'b00; @(posedge clk); #1;
        if (q !== 10'b1101010100) begin $error("C = 00 gave %b", q); errors = errors + 1; end
        c = 2'b01; @(posedge clk); #1;
        if (q !== 10'b0010101011) begin $error("C = 01 gave %b", q); errors = errors + 1; end
        c = 2'b10; @(posedge clk); #1;
        if (q !== 10'b0101010100) begin $error("C = 10 gave %b", q); errors = errors + 1; end
        c = 2'b11; @(posedge clk); #1;
        if (q !== 10'b1010101011) begin $error("C = 11 gave %b", q); errors = errors + 1; end

        // 2. video: every byte value, twice over
        de = 1;
        for (i = 0; i < 512; i = i + 1) begin
            d = i;
            @(posedge clk); #1;
            if (back !== d) begin
                $error("byte %h came back as %h (symbol %b)", d, back, q);
                errors = errors + 1;
            end
        end
        if (errors == 0) $display("PASS: 4 control symbols and 512 video symbols decode correctly");
        $finish;
    end
endmodule
`;

export const X_TMDS_TB_VHD = `${VHDL_NUMERIC}
-- Testbench for tmds_encoder. It plays the receiver: every symbol is decoded back to a byte, so it checks that
-- (1) blanking sends the four control symbols and (2) every video byte comes back unchanged.
entity tb is
end entity;

architecture sim of tb is
    signal clk  : std_logic := '0';
    signal d    : std_logic_vector(7 downto 0) := (others => '0');
    signal c    : std_logic_vector(1 downto 0) := "00";
    signal de   : std_logic := '0';
    signal q    : std_logic_vector(9 downto 0);
    signal m    : std_logic_vector(7 downto 0);
    signal back : std_logic_vector(7 downto 0);
    signal nx   : std_logic;
begin
    dut : entity work.tmds_encoder port map (clk => clk, ce => '1', d => d, c => c, de => de, q => q);

    clk <= not clk after 20 ns;                     -- 40 ns: a 25 MHz pixel clock

    -- the receiver: undo stage 2 (q(9) = '1': the byte was inverted), then stage 1 (q(8) = '1': XOR, '0': XNOR)
    m  <= not q(7 downto 0) when q(9) = '1' else q(7 downto 0);
    nx <= not q(8);
    back(0) <= m(0);
    back(1) <= m(1) xor m(0) xor nx;
    back(2) <= m(2) xor m(1) xor nx;
    back(3) <= m(3) xor m(2) xor nx;
    back(4) <= m(4) xor m(3) xor nx;
    back(5) <= m(5) xor m(4) xor nx;
    back(6) <= m(6) xor m(5) xor nx;
    back(7) <= m(7) xor m(6) xor nx;

    stim : process
    begin
        report "tmds_encoder: 4 control symbols, then 512 video symbols decoded back";
        -- 1. blanking: the four control symbols
        de <= '0';
        c <= "00"; wait until rising_edge(clk); wait for 1 ns;
        assert q = "1101010100" report "C = 00 gave a wrong symbol" severity error;
        c <= "01"; wait until rising_edge(clk); wait for 1 ns;
        assert q = "0010101011" report "C = 01 gave a wrong symbol" severity error;
        c <= "10"; wait until rising_edge(clk); wait for 1 ns;
        assert q = "0101010100" report "C = 10 gave a wrong symbol" severity error;
        c <= "11"; wait until rising_edge(clk); wait for 1 ns;
        assert q = "1010101011" report "C = 11 gave a wrong symbol" severity error;

        -- 2. video: every byte value, twice over
        de <= '1';
        for i in 0 to 511 loop
            d <= std_logic_vector(to_unsigned(i mod 256, 8));
            wait until rising_edge(clk);
            wait for 1 ns;
            assert back = d report "byte " & integer'image(i mod 256) & " came back wrong" severity error;
        end loop;
        report "done: 4 control symbols and 512 video symbols checked";
        std.env.finish;
    end process;
end architecture;
`;

const BARS_TOP_V = (border: boolean) => `
module top (
    input  wire clk,                      // 50 MHz
    output wire HDMI_CLK_P, HDMI_CLK_N,
    output wire HDMI_D0_P,  HDMI_D0_N,
    output wire HDMI_D1_P,  HDMI_D1_N,
    output wire HDMI_D2_P,  HDMI_D2_N
);
    // one pixel every second clock: 25 MHz
    reg pe = 1'b0;
    always @(posedge clk) pe <= ~pe;

    // 640 x 480 at 60 Hz, as in the vga lesson: visible, front porch, sync, back porch
    localparam H_VIS = 640, H_FP = 16, H_SYNC = 96, H_BP = 48;
    localparam V_VIS = 480, V_FP = 10, V_SYNC = 2,  V_BP = 33;
    localparam H_TOTAL = H_VIS + H_FP + H_SYNC + H_BP;   // 800
    localparam V_TOTAL = V_VIS + V_FP + V_SYNC + V_BP;   // 525
    reg [9:0] x = 0;
    reg [9:0] y = 0;
    always @(posedge clk)
        if (pe) begin
            if (x == H_TOTAL - 1) begin
                x <= 0;
                y <= (y == V_TOTAL - 1) ? 10'd0 : y + 1;
            end else
                x <= x + 1;
        end
    wire de = (x < H_VIS) && (y < V_VIS);
    wire hs = ~((x >= H_VIS + H_FP) && (x < H_VIS + H_FP + H_SYNC));   // active low
    wire vs = ~((y >= V_VIS + V_FP) && (y < V_VIS + V_FP + V_SYNC));   // active low

    // eight 80-pixel bars, 8 bits per colour: {red, green, blue}
    reg [23:0] rgb;
    always @(*) begin
${border ? `        if (x < 8 || x >= H_VIS - 8 || y < 8 || y >= V_VIS - 8)
            rgb = 24'hFFFFFF;             // the 8-pixel white border
        else ` : '        '}if (x < 80)  rgb = 24'hFFFFFF;   // white
        else if (x < 160) rgb = 24'hFFFF00;   // yellow
        else if (x < 240) rgb = 24'h00FFFF;   // cyan
        else if (x < 320) rgb = 24'h00FF00;   // green
        else if (x < 400) rgb = 24'hFF00FF;   // magenta
        else if (x < 480) rgb = 24'hFF0000;   // red
        else if (x < 560) rgb = 24'h0000FF;   // blue
        else              rgb = 24'h000000;   // black
    end

    // three encoders: channel 0 carries blue and, in blanking, HSYNC and VSYNC; 1 green; 2 red
    wire [9:0] s0, s1, s2;
    tmds_encoder enc_b (.clk(clk), .ce(pe), .d(rgb[7:0]),   .c({vs, hs}), .de(de), .q(s0));
    tmds_encoder enc_g (.clk(clk), .ce(pe), .d(rgb[15:8]),  .c(2'b00),    .de(de), .q(s1));
    tmds_encoder enc_r (.clk(clk), .ce(pe), .d(rgb[23:16]), .c(2'b00),    .de(de), .q(s2));

    // ten bits per symbol, 250 Mbit/s per pair: FPGA Lab supplies this block (see the lesson)
    tmds_serializer ser (
        .clk(clk), .d0(s0), .d1(s1), .d2(s2),
        .clk_p(HDMI_CLK_P), .clk_n(HDMI_CLK_N),
        .d0_p(HDMI_D0_P),   .d0_n(HDMI_D0_N),
        .d1_p(HDMI_D1_P),   .d1_n(HDMI_D1_N),
        .d2_p(HDMI_D2_P),   .d2_n(HDMI_D2_N)
    );
endmodule
`;

const BARS_HEAD_V = `// x-hdmi-bars: 640 x 480 colour bars on the extension board's HDMI socket.
// The timing is the vga lesson's, with a pixel every second clock (25 MHz). Three TMDS encoders turn each pixel
// into three 10-bit symbols, and tmds_serializer sends them: FPGA Lab adds a stand-in in the simulator and the
// real serializer (MMCM, OSERDESE2, OBUFDS) to the Vivado project.
${TMDS_ENCODER_V}`;
export const X_BARS_V = BARS_HEAD_V + BARS_TOP_V(false);
export const X_BARS_BORDER_V = BARS_HEAD_V + BARS_TOP_V(true);

const BARS_TOP_VHD = (border: boolean) => `
${VHDL_NUMERIC}
entity top is
    port (
        clk                    : in  std_logic;     -- 50 MHz
        HDMI_CLK_P, HDMI_CLK_N : out std_logic;
        HDMI_D0_P, HDMI_D0_N   : out std_logic;
        HDMI_D1_P, HDMI_D1_N   : out std_logic;
        HDMI_D2_P, HDMI_D2_N   : out std_logic
    );
end entity;

architecture rtl of top is
    -- ten bits per symbol, 250 Mbit/s per pair: FPGA Lab supplies this block (see the lesson)
    component tmds_serializer is
        port (
            clk                                              : in  std_logic;
            d0, d1, d2                                       : in  std_logic_vector(9 downto 0);
            clk_p, clk_n, d0_p, d0_n, d1_p, d1_n, d2_p, d2_n : out std_logic
        );
    end component;

    -- 640 x 480 at 60 Hz, as in the vga lesson: visible, front porch, sync, back porch
    constant H_VIS : integer := 640;
    constant H_FP  : integer := 16;
    constant H_SYN : integer := 96;
    constant H_BP  : integer := 48;
    constant V_VIS : integer := 480;
    constant V_FP  : integer := 10;
    constant V_SYN : integer := 2;
    constant V_BP  : integer := 33;
    constant H_TOT : integer := H_VIS + H_FP + H_SYN + H_BP;   -- 800
    constant V_TOT : integer := V_VIS + V_FP + V_SYN + V_BP;   -- 525

    signal pe         : std_logic := '0';
    signal x, y       : integer range 0 to 1023 := 0;
    signal de, hs, vs : std_logic;
    signal rgb        : std_logic_vector(23 downto 0);   -- red & green & blue
    signal sync       : std_logic_vector(1 downto 0);
    signal s0, s1, s2 : std_logic_vector(9 downto 0);
begin
    -- one pixel every second clock: 25 MHz
    process (clk)
    begin
        if rising_edge(clk) then
            pe <= not pe;
            if pe = '1' then
                if x = H_TOT - 1 then
                    x <= 0;
                    if y = V_TOT - 1 then y <= 0; else y <= y + 1; end if;
                else
                    x <= x + 1;
                end if;
            end if;
        end if;
    end process;
    de <= '1' when x < H_VIS and y < V_VIS else '0';
    hs <= '0' when x >= H_VIS + H_FP and x < H_VIS + H_FP + H_SYN else '1';   -- active low
    vs <= '0' when y >= V_VIS + V_FP and y < V_VIS + V_FP + V_SYN else '1';   -- active low

    -- eight 80-pixel bars, 8 bits per colour
    rgb <= ${border ? `x"FFFFFF" when x < 8 or x >= H_VIS - 8 or y < 8 or y >= V_VIS - 8 else   -- the 8-pixel white border
           ` : ''}x"FFFFFF" when x < 80  else   -- white
           x"FFFF00" when x < 160 else   -- yellow
           x"00FFFF" when x < 240 else   -- cyan
           x"00FF00" when x < 320 else   -- green
           x"FF00FF" when x < 400 else   -- magenta
           x"FF0000" when x < 480 else   -- red
           x"0000FF" when x < 560 else   -- blue
           x"000000";                    -- black

    -- three encoders: channel 0 carries blue and, in blanking, HSYNC and VSYNC; 1 green; 2 red
    sync  <= vs & hs;
    enc_b : entity work.tmds_encoder port map (clk => clk, ce => pe, d => rgb(7 downto 0),   c => sync, de => de, q => s0);
    enc_g : entity work.tmds_encoder port map (clk => clk, ce => pe, d => rgb(15 downto 8),  c => "00", de => de, q => s1);
    enc_r : entity work.tmds_encoder port map (clk => clk, ce => pe, d => rgb(23 downto 16), c => "00", de => de, q => s2);

    ser : tmds_serializer port map (
        clk => clk, d0 => s0, d1 => s1, d2 => s2,
        clk_p => HDMI_CLK_P, clk_n => HDMI_CLK_N,
        d0_p  => HDMI_D0_P,  d0_n  => HDMI_D0_N,
        d1_p  => HDMI_D1_P,  d1_n  => HDMI_D1_N,
        d2_p  => HDMI_D2_P,  d2_n  => HDMI_D2_N
    );
end architecture;
`;

const BARS_HEAD_VHD = `-- x-hdmi-bars: 640 x 480 colour bars on the extension board's HDMI socket.
-- The timing is the vga lesson's, with a pixel every second clock (25 MHz). Three TMDS encoders turn each pixel
-- into three 10-bit symbols, and tmds_serializer sends them: FPGA Lab adds a stand-in in the simulator and the
-- real serializer (MMCM, OSERDESE2, OBUFDS) to the Vivado project.
${TMDS_ENCODER_VHD}`;
export const X_BARS_VHD = BARS_HEAD_VHD + BARS_TOP_VHD(false);
export const X_BARS_BORDER_VHD = BARS_HEAD_VHD + BARS_TOP_VHD(true);
