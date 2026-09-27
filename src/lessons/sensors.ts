// Lesson: reading the on-board ADT7420 temperature sensor over I²C, with open-drain (tri-state) pins.
import { VHDL_NUMERIC, type Lesson } from './lessons';

const SENSOR_V = `// Reads the on-board ADT7420 temperature sensor over I2C and shows the temperature on the display
module adt7420_reader #(parameter DIV = 25_000_000, parameter Q = 250) (   // a reading every 0.25 s, SCL = 100 kHz
    input  wire        clk,
    input  wire        sda_in,              // SDA as it really is on the wire
    output reg         scl_low = 1'b0,      // 1 pulls SCL low, 0 lets it go
    output reg         sda_low = 1'b0,      // 1 pulls SDA low, 0 lets it go
    output reg  [15:0] temp = 0,            // temperature register: 1/16 degree steps in bits 15..3
    output reg         nack = 1'b0          // the sensor did not answer
);
    localparam [7:0] ADDR_R = 8'h97;  // address 0x4B and the read bit
    reg [31:0] timer = 0;
    reg [2:0]  step  = 0;    // 0 wait, 1 START, 2 address, 3 first byte, 4 second byte, 5 STOP
    reg [15:0] cnt   = 0;
    reg [1:0]  ph    = 0;    // quarter of the current bit
    reg [3:0]  bitn  = 0;    // 0..7 data, 8 = acknowledge
    reg [7:0]  sh    = 0;
    reg [7:0]  msb   = 0;

    always @(posedge clk) begin
        timer <= (timer == DIV - 1) ? 0 : timer + 1;
        if (step == 0) begin
            scl_low <= 1'b0;
            sda_low <= 1'b0;
            if (timer == DIV - 1) begin
                step <= 1; cnt <= 0; ph <= 0; bitn <= 0;
            end
        end else if (cnt != Q - 1)
            cnt <= cnt + 1;
        else begin
            cnt <= 0;
            ph  <= ph + 1;
            case (step)
                3'd1: case (ph)                     // START: SDA falls while SCL is high
                          2'd0: sda_low <= 1'b0;
                          2'd1: sda_low <= 1'b1;
                          2'd2: scl_low <= 1'b1;
                          default: step <= 2;
                      endcase
                3'd5: case (ph)                     // STOP: SDA rises while SCL is high
                          2'd0: sda_low <= 1'b1;
                          2'd1: scl_low <= 1'b0;
                          2'd2: sda_low <= 1'b0;
                          default: step <= 0;
                      endcase
                default:                            // one byte and its acknowledge bit
                    case (ph)
                        2'd0:                       // SCL is low: put the next bit on SDA
                            if (step == 2 && bitn < 8) sda_low <= ~ADDR_R[7 - bitn];
                            else if (step == 3 && bitn == 8) sda_low <= 1'b1;   // ACK the first byte
                            else sda_low <= 1'b0;                              // let go: read, or NACK
                        2'd1: scl_low <= 1'b0;      // SCL goes high
                        2'd2:                       // middle of SCL high: sample SDA
                            if (bitn < 8) sh <= {sh[6:0], sda_in};
                            else if (step == 2) nack <= sda_in;
                        default: begin
                            scl_low <= 1'b1;        // SCL low again
                            if (bitn != 8)
                                bitn <= bitn + 1;
                            else begin
                                bitn <= 0;
                                if (step == 3) msb <= sh;
                                if (step == 4) temp <= {msb, sh};
                                step <= (step == 2 && nack) ? 3'd5 : step + 1;
                            end
                        end
                    endcase
            endcase
        end
    end
endmodule

// seven-segment patterns {g..a}, active-low: 0-9, 10 = blank, 11 = minus
module digit7 (input wire [3:0] x, output reg [6:0] seg);
    always @(*)
        case (x)
            4'd0: seg = 7'b1000000;  4'd1: seg = 7'b1111001;
            4'd2: seg = 7'b0100100;  4'd3: seg = 7'b0110000;
            4'd4: seg = 7'b0011001;  4'd5: seg = 7'b0010010;
            4'd6: seg = 7'b0000010;  4'd7: seg = 7'b1111000;
            4'd8: seg = 7'b0000000;  4'd9: seg = 7'b0010000;
            4'd11:   seg = 7'b0111111;  // minus
            default: seg = 7'b1111111;  // blank
        endcase
endmodule

module top #(parameter DIV = 25_000_000) (
    input  wire        CLK100MHZ,
    inout  wire        TMP_SCL, TMP_SDA,    // open-drain I2C lines to the sensor
    output wire [15:0] LED,
    output wire CA, CB, CC, CD, CE, CF, CG, DP,
    output reg  [7:0]  AN
);
    wire        scl_low, sda_low, nack;
    wire [15:0] temp;

    // open drain: pull the line low, or let go ('z') so the pull-up resistor makes it high
    assign TMP_SCL = scl_low ? 1'b0 : 1'bz;
    assign TMP_SDA = sda_low ? 1'b0 : 1'bz;

    adt7420_reader #(.DIV(DIV)) sensor (.clk(CLK100MHZ), .sda_in(TMP_SDA),
        .scl_low(scl_low), .sda_low(sda_low), .temp(temp), .nack(nack));

    // 13-bit signed temperature in 1/16 degree steps -> sign, tens, ones, tenths
    wire [12:0] t16   = temp[15:3];
    wire        neg   = t16[12];
    wire [12:0] mag   = neg ? (13'd0 - t16) : t16;
    wire [8:0]  whole = mag[12:4];
    wire [7:0]  frac  = mag[3:0] * 8'd10;
    wire [3:0]  tens  = whole / 10;
    wire [3:0]  ones  = whole % 10;
    wire [3:0]  tenth = frac[7:4];

    assign LED = {nack, 2'b00, t16};

    // four-digit display: [-][tens][ones.][tenths]
    reg  [17:0] refresh = 0;
    wire [1:0]  digit = refresh[17:16];
    reg  [3:0]  sym;
    wire [6:0]  seg;
    always @(posedge CLK100MHZ)
        refresh <= refresh + 1;

    always @(*) begin
        AN = 8'b1111_1111;
        AN[digit] = 1'b0;
        case (digit)
            2'd0:    sym = tenth;
            2'd1:    sym = ones;
            2'd2:    sym = (tens == 0) ? 4'd10 : tens;
            default: sym = neg ? 4'd11 : 4'd10;
        endcase
    end

    digit7 dec (.x(sym), .seg(seg));
    assign {CG, CF, CE, CD, CC, CB, CA} = seg;
    assign DP = (digit == 2'd1) ? 1'b0 : 1'b1;   // decimal point after the ones
endmodule
`;

const SENSOR_VHDL = `${VHDL_NUMERIC}
-- Reads the on-board ADT7420 temperature sensor over I2C and shows the temperature on the display
entity adt7420_reader is
    generic (DIV : integer := 25_000_000; Q : integer := 250);   -- a reading every 0.25 s, SCL = 100 kHz
    port (
        clk     : in  std_logic;
        sda_in  : in  std_logic;                          -- SDA as it really is on the wire
        scl_low : out std_logic;                          -- '1' pulls SCL low, '0' lets it go
        sda_low : out std_logic;                          -- '1' pulls SDA low, '0' lets it go
        temp    : out std_logic_vector(15 downto 0);      -- 1/16 degree steps in bits 15..3
        nack    : out std_logic                           -- the sensor did not answer
    );
end adt7420_reader;

architecture rtl of adt7420_reader is
    signal addr_r : std_logic_vector(7 downto 0) := x"97";     -- address 0x4B and the read bit (never changes)
    signal timer : integer range 0 to DIV - 1 := 0;
    signal step  : integer range 0 to 5 := 0;    -- 0 wait, 1 START, 2 address, 3 first byte, 4 second byte, 5 STOP
    signal cnt   : integer range 0 to Q - 1 := 0;
    signal ph    : unsigned(1 downto 0) := "00";  -- quarter of the current bit
    signal bitn  : integer range 0 to 8 := 0;    -- 0..7 data, 8 = acknowledge
    signal sh    : std_logic_vector(7 downto 0) := (others => '0');
    signal msb   : std_logic_vector(7 downto 0) := (others => '0');
    signal scl_l : std_logic := '0';
    signal sda_l : std_logic := '0';
    signal nk    : std_logic := '0';
    signal t     : std_logic_vector(15 downto 0) := (others => '0');
begin
    process (clk)
    begin
        if rising_edge(clk) then
            if timer = DIV - 1 then
                timer <= 0;
            else
                timer <= timer + 1;
            end if;
            if step = 0 then
                scl_l <= '0';
                sda_l <= '0';
                if timer = DIV - 1 then
                    step <= 1;
                    cnt <= 0;
                    ph <= "00";
                    bitn <= 0;
                end if;
            elsif cnt /= Q - 1 then
                cnt <= cnt + 1;
            else
                cnt <= 0;
                ph <= ph + 1;
                if step = 1 then                          -- START: SDA falls while SCL is high
                    case ph is
                        when "00" => sda_l <= '0';
                        when "01" => sda_l <= '1';
                        when "10" => scl_l <= '1';
                        when others => step <= 2;
                    end case;
                elsif step = 5 then                       -- STOP: SDA rises while SCL is high
                    case ph is
                        when "00" => sda_l <= '1';
                        when "01" => scl_l <= '0';
                        when "10" => sda_l <= '0';
                        when others => step <= 0;
                    end case;
                else                                      -- one byte and its acknowledge bit
                    case ph is
                        when "00" =>                      -- SCL is low: put the next bit on SDA
                            if step = 2 and bitn < 8 then
                                sda_l <= not addr_r(7 - bitn);
                            elsif step = 3 and bitn = 8 then
                                sda_l <= '1';             -- ACK the first byte
                            else
                                sda_l <= '0';             -- let go: read, or NACK
                            end if;
                        when "01" => scl_l <= '0';        -- SCL goes high
                        when "10" =>                      -- middle of SCL high: sample SDA
                            if bitn < 8 then
                                sh <= sh(6 downto 0) & sda_in;
                            elsif step = 2 then
                                nk <= sda_in;
                            end if;
                        when others =>
                            scl_l <= '1';                 -- SCL low again
                            if bitn /= 8 then
                                bitn <= bitn + 1;
                            else
                                bitn <= 0;
                                if step = 3 then
                                    msb <= sh;
                                end if;
                                if step = 4 then
                                    t <= msb & sh;
                                end if;
                                if step = 2 and nk = '1' then
                                    step <= 5;
                                else
                                    step <= step + 1;
                                end if;
                            end if;
                    end case;
                end if;
            end if;
        end if;
    end process;

    scl_low <= scl_l;
    sda_low <= sda_l;
    temp <= t;
    nack <= nk;
end rtl;

${VHDL_NUMERIC}
-- seven-segment patterns (g..a), active-low: 0-9, 10 = blank, 11 = minus
entity digit7 is
    port (x : in unsigned(3 downto 0); seg : out std_logic_vector(6 downto 0));
end digit7;

architecture rtl of digit7 is
begin
    process (x)
    begin
        case to_integer(x) is
            when 0 => seg <= "1000000";
            when 1 => seg <= "1111001";
            when 2 => seg <= "0100100";
            when 3 => seg <= "0110000";
            when 4 => seg <= "0011001";
            when 5 => seg <= "0010010";
            when 6 => seg <= "0000010";
            when 7 => seg <= "1111000";
            when 8 => seg <= "0000000";
            when 9 => seg <= "0010000";
            when 11 => seg <= "0111111";   -- minus
            when others => seg <= "1111111";   -- blank
        end case;
    end process;
end rtl;

${VHDL_NUMERIC}
entity top is
    generic (DIV : integer := 25_000_000);
    port (
        CLK100MHZ : in    std_logic;
        TMP_SCL   : inout std_logic;                     -- open-drain I2C lines to the sensor
        TMP_SDA   : inout std_logic;
        LED       : out   std_logic_vector(15 downto 0);
        CA, CB, CC, CD, CE, CF, CG, DP : out std_logic;
        AN        : out   std_logic_vector(7 downto 0)
    );
end top;

architecture rtl of top is
    signal scl_low, sda_low, nack : std_logic;
    signal temp    : std_logic_vector(15 downto 0);
    signal t16     : signed(12 downto 0);
    signal mag     : unsigned(12 downto 0);
    signal whole   : integer range 0 to 511;
    signal frac    : unsigned(7 downto 0);
    signal tens, ones, tenth, sym : unsigned(3 downto 0);
    signal refresh : unsigned(17 downto 0) := (others => '0');
    signal digit   : unsigned(1 downto 0);
    signal seg     : std_logic_vector(6 downto 0);
begin
    -- open drain: pull the line low, or let go ('Z') so the pull-up resistor makes it high
    TMP_SCL <= '0' when scl_low = '1' else 'Z';
    TMP_SDA <= '0' when sda_low = '1' else 'Z';

    sensor : entity work.adt7420_reader
        generic map (DIV => DIV)
        port map (clk => CLK100MHZ, sda_in => TMP_SDA, scl_low => scl_low, sda_low => sda_low, temp => temp, nack => nack);

    -- 13-bit signed temperature in 1/16 degree steps -> sign, tens, ones, tenths
    t16   <= signed(temp(15 downto 3));
    mag   <= unsigned(-t16) when t16(12) = '1' else unsigned(t16);
    whole <= to_integer(mag(12 downto 4));
    frac  <= resize(mag(3 downto 0) * 10, 8);
    tens  <= to_unsigned(whole / 10, 4);
    ones  <= to_unsigned(whole mod 10, 4);
    tenth <= frac(7 downto 4);

    LED <= nack & "00" & std_logic_vector(t16);

    -- four-digit display: [-][tens][ones.][tenths]
    process (CLK100MHZ)
    begin
        if rising_edge(CLK100MHZ) then
            refresh <= refresh + 1;
        end if;
    end process;
    digit <= refresh(17 downto 16);

    process (digit, tenth, ones, tens, t16)
    begin
        AN <= "11111111";
        AN(to_integer(digit)) <= '0';
        case digit is
            when "00" => sym <= tenth;
            when "01" => sym <= ones;
            when "10" =>
                if tens = 0 then
                    sym <= to_unsigned(10, 4);
                else
                    sym <= tens;
                end if;
            when others =>
                if t16(12) = '1' then
                    sym <= to_unsigned(11, 4);
                else
                    sym <= to_unsigned(10, 4);
                end if;
        end case;
    end process;

    dec : entity work.digit7 port map (x => sym, seg => seg);
    CG <= seg(6); CF <= seg(5); CE <= seg(4); CD <= seg(3);
    CC <= seg(2); CB <= seg(1); CA <= seg(0);
    DP <= '0' when digit = "01" else '1';   -- decimal point after the ones
end rtl;
`;

export const SENSORS_LESSON: Lesson = {
  id: 'sensors',
  title: 'سنسور دمای روی برد (ADT7420) و ماژول‌ها',
  summary: 'خواندن دما از سنسور I²C روی برد با پایه‌های سه‌حالته (open-drain) و نمایش آن روی نمایشگر؛ آشنایی با بخش Modules.',
  body: `
<p>روی Nexys A7 دو سنسور هست: سنسور دمای <b>ADT7420</b> که با <b>I²C</b> کار می‌کند و شتاب‌سنج <b>ADXL362</b> که با <b>SPI</b> کار می‌کند. هر دو در بخش <span class="kbd">🧩 Modules</span> کنار برد دیده می‌شوند و با اسلایدرها می‌توانید دما یا شتاب را تغییر دهید. در همین بخش می‌توانید با <b>Add Module</b> ماژول‌های دیگری هم به هدرهای Pmod وصل کنید، مثل فاصله‌سنج HC-SR04، دکمه‌ها، LEDها، انکودر یا سروو، و انتخاب کنید هر پایه به کدام پین وصل باشد.</p>
<h3>پایه‌های open-drain و مقدار 'z'</h3>
<p>در I²C هر دو طرف روی یک سیم حرف می‌زنند. هیچ‌کس سیم را به ۱ نمی‌برد: هر کس می‌تواند آن را به ۰ بکشد، یا آن را <b>رها</b> کند تا یک مقاومت pull-up آن را ۱ کند. برای رها کردن، خروجی باید حالت سوم یعنی <b>امپدانس بالا</b> (<code>z</code>) را بگیرد. برای همین پورت‌ها <code>inout</code> هستند:</p>
<pre class="formula" dir="ltr">assign TMP_SDA = sda_low ? 1'b0 : 1'bz;     // Verilog
TMP_SDA <= '0' when sda_low = '1' else 'Z';  -- VHDL</pre>
<p>وقتی طرح <code>TMP_SDA</code> را <b>می‌خواند</b>، سطح واقعی سیم را می‌بیند. اگر سنسور سیم را پایین کشیده باشد (مثلاً برای ACK)، صفر خوانده می‌شود، حتی اگر خود FPGA آن را رها کرده باشد.</p>
<h3>خواندن دما</h3>
<p>آدرس سنسور <code>0x4B</code> است. بعد از روشن شدن، اشاره‌گر ثبات‌ها روی 0x00 است، پس کافی است بخوانیم: <b>START</b>، آدرس با بیت خواندن (<code>0x97</code>)، بایت اول با ACK، بایت دوم با NACK و <b>STOP</b>. دو بایت با هم یک عدد ۱۶ بیتی می‌سازند. بیت‌های 15 تا 3 دما را به صورت عدد علامت‌دار با واحد 1/16 درجه نگه می‌دارند. مثلاً 24.5 درجه یعنی <code>392 = 0x188</code> و ثبات <code>0x0C40</code>.</p>
<p>طرح این درس هر ۰٫۲۵ ثانیه دما را می‌خواند و روی نمایشگر نشان می‌دهد (مثلاً <b>24.5</b>). عدد خام هم روی LEDها دیده می‌شود. اگر سنسور جواب ندهد، LD15 روشن می‌شود.</p>`,
  verilog: SENSOR_V,
  vhdl: SENSOR_VHDL,
  xdc: { clk: true, led: true, seg: true, tmp: true },
  tryIt: `<p><span class="kbd">▶ Run</span> را بزنید و بعد <span class="kbd">🧩 Modules</span> را در گوشهٔ برد باز کنید. اسلایدر دمای ADT7420 را جابه‌جا کنید. کمی بعد عدد روی نمایشگر عوض می‌شود. زیر صفر هم امتحان کنید.</p>
<p>در Logic Analyzer خطوط <code>TMP_SCL</code> (C14) و <code>TMP_SDA</code> (C15) را ببینید و دیکودر I²C را روشن کنید: <b>S 0x4B R A 0x0C A 0x40 N P</b>.</p>`,
  la: {
    chans: [
      { name: 'SCL', probe: 'pin:C14' },
      { name: 'SDA', probe: 'pin:C15' },
    ],
    decs: [{ type: 'i2c', name: 'I2C', scl: 0, sda: 1 }],
    base: 1e-4,
    pos: 4,
    trig: { ch: 1, edge: 'fall' },
  },
};
