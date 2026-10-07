// Tri-state top-level ports: assigning z releases the wire, and reading the port gives the level on the wire.
import { it, expect } from 'vitest';
import { synthesize, compileDesign } from '../src/hdl';
it('splits inout ports driven with z into value and enable', () => {
  const v = `module top(input wire [15:0] SW, inout wire SDA, inout wire [1:0] JB, output wire [15:0] LED);
    assign SDA = SW[0] ? 1'b0 : 1'bz;
    assign JB = SW[1] ? SW[3:2] : 2'bzz;
    assign LED = {13'b0, JB, SDA};
  endmodule`;
  const h = `library ieee; use ieee.std_logic_1164.all;
entity top is port (SW : in std_logic_vector(15 downto 0); SDA : inout std_logic; JB : inout std_logic_vector(1 downto 0); LED : out std_logic_vector(15 downto 0)); end top;
architecture rtl of top is begin
  SDA <= '0' when SW(0) = '1' else 'Z';
  JB <= SW(3 downto 2) when SW(1) = '1' else (others => 'Z');
  LED <= "0000000000000" & JB & SDA;
end rtl;`;
  for (const [src, lang] of [[v, 'verilog'], [h, 'vhdl']] as const) {
    const d = synthesize(src, lang);
    expect(d.tri?.length).toBe(2);
    const s = compileDesign(d);
    s.reset();
    const [sda, jb] = d.tri!;
    const sw = d.ports.find((p) => p.name.toLowerCase() === 'sw')!.id;
    const led = d.ports.find((p) => p.name.toLowerCase() === 'led')!.id;
    s.v[sw] = 1; s.v[sda.port] = 1; s.settle();
    expect([s.v[sda.o], s.v[sda.oe], s.v[led] & 1]).toEqual([0, 1, 1]);
    s.v[sw] = 0b1110; s.v[jb.port] = 0b01; s.settle();
    expect([s.v[sda.oe], s.v[jb.o], s.v[jb.oe], (s.v[led] >> 1) & 3]).toEqual([0, 3, 3, 1]);
    s.v[sw] = 0; s.settle();
    expect(s.v[jb.oe]).toBe(0);
  }
});
