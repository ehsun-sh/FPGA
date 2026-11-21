-- x-tone: a square-wave tone generator that plays a C-major scale up and down on the extension board's buzzer.
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity top is
    generic (
        CLK_HZ     : integer := 50000000;
        NOTE_TICKS : integer := 12500000
    );
    port (
        clk    : in  std_logic;
        KEY1   : in  std_logic;   -- hold to mute; the keys are active low (pressed = 0)
        BUZZER : out std_logic
    );
end entity;

architecture rtl of top is
    signal step : integer range 0 to 13 := 0;
    signal note : integer range 0 to 7;
    signal half : integer;
    signal pcnt : integer := 0;
    signal ncnt : integer := 0;
    signal bz   : std_logic := '0';
begin
    note <= step when step < 8 else 14 - step;

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
                if KEY1 = '1' then bz <= not bz; else bz <= '0'; end if;
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
