// The z-blink exercise (chapter Z, EBAZ4205): the green LED blinks twice as fast as the red one. The checker runs
// on the EBAZ4205 board, where LED_R is LED 0 and LED_G is LED 1, with DIV made small.
import { part } from '../lessons/helpers';
import type { Exercise } from './exercises';

const Z_BLINK_SOL_V = `// z-blink solution: LED_G toggles every DIV/2 clocks, LED_R every DIV clocks
module top #(parameter DIV = 25_000_000) (
    input  wire clk,
    output reg  LED_R = 0,
    output reg  LED_G = 0
);
    reg [24:0] cnt = 0;
    always @(posedge clk) begin
        if (cnt == DIV - 1) begin
            cnt   <= 0;
            LED_R <= ~LED_R;
            LED_G <= ~LED_G;
        end else begin
            cnt <= cnt + 1;
            if (cnt == DIV / 2 - 1)
                LED_G <= ~LED_G;
        end
    end
endmodule
`;

const Z_BLINK_SOL_VHD = `-- z-blink solution: LED_G toggles every DIV/2 clocks, LED_R every DIV clocks
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
    signal cnt : unsigned(24 downto 0) := (others => '0');
    signal r   : std_logic := '0';
    signal g   : std_logic := '0';
begin
    process (clk)
    begin
        if rising_edge(clk) then
            if cnt = DIV - 1 then
                cnt <= (others => '0');
                r   <= not r;
                g   <= not g;
            else
                cnt <= cnt + 1;
                if cnt = DIV / 2 - 1 then
                    g <= not g;
                end if;
            end if;
        end if;
    end process;
    LED_R <= r;
    LED_G <= g;
end architecture;
`;

const toggles = (s: number[], bit: number) => s.slice(1).filter((v, i) => ((v ^ s[i]) >> bit) & 1).length;

export const Z_BLINK_EXERCISE: Exercise = {
  fa: `<p>کاری کنید ${part('LED_G')} دو برابر سریع‌تر از ${part('LED_R')} چشمک بزند: ${part('LED_R')} هر <b>DIV</b> کلاک و ${part('LED_G')} هر <b>DIV/2</b> کلاک عوض شود. <code>DIV</code> را به‌صورت <code>parameter</code> (در VHDL یک <code>generic</code>) نگه دارید؛ بررسی‌کننده آن را ۴ می‌کند.</p>`,
  en: `<p>Make ${part('LED_G')} blink twice as fast as ${part('LED_R')}: ${part('LED_R')} changes every <b>DIV</b> clocks and ${part('LED_G')} every <b>DIV/2</b> clocks. Keep <code>DIV</code> as a <code>parameter</code> (a <code>generic</code> in VHDL); the checker sets it to 4.</p>`,
  params: { DIV: 4 },
  check(h, t) {
    h.run(8);
    const s: number[] = [];
    for (let i = 0; i <= 64; i++) {
      s.push(h.led());
      h.run(1);
    }
    const r = toggles(s, 0);
    const g = toggles(s, 1);
    t.ok(r === 16, 'LED_R هر DIV کلاک عوض می‌شود', 'LED_R changes every DIV clocks', { expected: '16 changes in 64 clocks', actual: `${r} changes` });
    t.ok(g === 32, 'LED_G هر DIV/2 کلاک عوض می‌شود (دو برابر سریع‌تر)', 'LED_G changes every DIV/2 clocks (twice as fast)', { expected: '32 changes in 64 clocks', actual: `${g} changes` });
  },
  hints: [
    {
      fa: 'یک شمارنده کافی است: وقتی به DIV/2 - 1 رسید فقط سبز را برعکس کنید، و وقتی به DIV - 1 رسید هر دو را.',
      en: 'One counter is enough: when it reaches DIV/2 - 1 flip only the green LED, and when it reaches DIV - 1 flip both.',
    },
    {
      fa: '<code>if (cnt == DIV - 1) begin cnt &lt;= 0; LED_R &lt;= ~LED_R; LED_G &lt;= ~LED_G; end else begin cnt &lt;= cnt + 1; if (cnt == DIV / 2 - 1) LED_G &lt;= ~LED_G; end</code> با LED_R و LED_G به‌صورت <code>output reg</code>.',
      en: '<code>if (cnt == DIV - 1) begin cnt &lt;= 0; LED_R &lt;= ~LED_R; LED_G &lt;= ~LED_G; end else begin cnt &lt;= cnt + 1; if (cnt == DIV / 2 - 1) LED_G &lt;= ~LED_G; end</code> with LED_R and LED_G as <code>output reg</code>.',
    },
  ],
  solution: { verilog: Z_BLINK_SOL_V, vhdl: Z_BLINK_SOL_VHD },
};
