// The prepared z-blink design (docs/ebaz4205/code/z_blink.v and .vhd, kept equal by test/boards.test.ts).
export const Z_BLINK_V = `// z-blink: the first PL design on the EBAZ4205.
// clk comes from the PS (FCLK_CLK0 = 50 MHz); the board has no PL oscillator unless X5 is fitted.
// LED_R (W14) and LED_G (W13) blink in turn, once per second.
module top #(parameter DIV = 25_000_000) (
    input  wire clk,
    output wire LED_R,
    output wire LED_G
);
    reg [24:0] cnt = 0;
    reg        tick = 0;
    always @(posedge clk) begin
        if (cnt == DIV - 1) begin
            cnt  <= 0;
            tick <= ~tick;
        end else
            cnt <= cnt + 1;
    end
    assign LED_R = tick;
    assign LED_G = ~tick;
endmodule
`;

export const Z_BLINK_VHD = `-- z-blink: the first PL design on the EBAZ4205.
-- clk comes from the PS (FCLK_CLK0 = 50 MHz); the board has no PL oscillator unless X5 is fitted.
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity top is
    generic (DIV : integer := 25000000);
    port (
        clk   : in  std_logic;
        LED_R : out std_logic;
        LED_G : out std_logic
    );
end entity;

architecture rtl of top is
    signal cnt  : unsigned(24 downto 0) := (others => '0');
    signal tick : std_logic := '0';
begin
    process (clk)
    begin
        if rising_edge(clk) then
            if cnt = DIV - 1 then
                cnt  <= (others => '0');
                tick <= not tick;
            else
                cnt <= cnt + 1;
            end if;
        end if;
    end process;
    LED_R <= tick;
    LED_G <= not tick;
end architecture;
`;
