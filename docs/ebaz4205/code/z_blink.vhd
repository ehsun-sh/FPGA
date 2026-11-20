-- z-blink: the first PL design on the EBAZ4205.
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
