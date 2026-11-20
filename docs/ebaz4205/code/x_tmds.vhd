-- x-hdmi-tmds: one TMDS channel encoder (DVI 1.0, section 3.2.2), written without functions
-- so the FPGA Lab simulator can run it. d = pixel byte, c = (C1, C0), de = video data enable.
library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;

entity tmds_encoder is
    port (
        clk : in  std_logic;
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
    signal cnt      : integer range -16 to 15 := 0;
    signal qr       : std_logic_vector(9 downto 0) := "1101010100";
    signal diff     : integer range -8 to 8;          -- n1q - n0q
begin
    n1d <= to_integer(unsigned(d(0 downto 0))) + to_integer(unsigned(d(1 downto 1)))
         + to_integer(unsigned(d(2 downto 2))) + to_integer(unsigned(d(3 downto 3)))
         + to_integer(unsigned(d(4 downto 4))) + to_integer(unsigned(d(5 downto 5)))
         + to_integer(unsigned(d(6 downto 6))) + to_integer(unsigned(d(7 downto 7)));
    x <= '1' when n1d > 4 or (n1d = 4 and d(0) = '0') else '0';

    qm(0) <= d(0);
    qm(1) <= qm(0) xor d(1) xor x;
    qm(2) <= qm(1) xor d(2) xor x;
    qm(3) <= qm(2) xor d(3) xor x;
    qm(4) <= qm(3) xor d(4) xor x;
    qm(5) <= qm(4) xor d(5) xor x;
    qm(6) <= qm(5) xor d(6) xor x;
    qm(7) <= qm(6) xor d(7) xor x;
    qm(8) <= not x;

    n1q <= to_integer(unsigned(qm(0 downto 0))) + to_integer(unsigned(qm(1 downto 1)))
         + to_integer(unsigned(qm(2 downto 2))) + to_integer(unsigned(qm(3 downto 3)))
         + to_integer(unsigned(qm(4 downto 4))) + to_integer(unsigned(qm(5 downto 5)))
         + to_integer(unsigned(qm(6 downto 6))) + to_integer(unsigned(qm(7 downto 7)));
    diff <= 2 * n1q - 8;

    process (clk)
    begin
        if rising_edge(clk) then
            if de = '0' then
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
                qr <= '1' & qm(8) & not qm(7 downto 0);
                if qm(8) = '1' then cnt <= cnt + 2 - diff; else cnt <= cnt - diff; end if;
            else
                qr <= '0' & qm(8) & qm(7 downto 0);
                if qm(8) = '0' then cnt <= cnt - 2 + diff; else cnt <= cnt + diff; end if;
            end if;
        end if;
    end process;
    q <= qr;
end architecture;
