import { describe, expect, it } from 'vitest';
import { compileDesign, synthesize } from '../src/hdl';

function build(src: string, lang: 'verilog' | 'vhdl', clockName?: string) {
  const d = synthesize(src, lang);
  const port = (n: string) => {
    const p = d.ports.find((x) => x.name.toLowerCase() === n.toLowerCase());
    if (!p) throw new Error('no port ' + n);
    return p.id;
  };
  const sim = compileDesign(d, { clock: clockName ? port(clockName) : undefined });
  sim.reset();
  return {
    d,
    sim,
    set(n: string, v: number) {
      sim.v[port(n)] = v;
      sim.settle();
    },
    get: (n: string) => sim.v[port(n)],
  };
}

describe('verilog', () => {
  it('gates', () => {
    const t = build(
      `module top(input [1:0] SW, output [5:0] LED);
        assign LED[0] = SW[0] & SW[1];
        assign LED[1] = SW[0] | SW[1];
        assign LED[2] = ~SW[0];
        assign LED[3] = SW[0] ^ SW[1];
        assign LED[4] = ~(SW[0] & SW[1]);
        assign LED[5] = ~(SW[0] | SW[1]);
      endmodule`,
      'verilog',
    );
    t.set('SW', 0);
    expect(t.get('LED')).toBe(0b110100);
    t.set('SW', 1);
    expect(t.get('LED')).toBe(0b011010);
    t.set('SW', 3);
    expect(t.get('LED')).toBe(0b000011);
  });

  it('adder with carry via context width', () => {
    const t = build(
      `module add(input [7:0] SW, output [4:0] LED);
         assign LED = SW[3:0] + SW[7:4];
       endmodule`,
      'verilog',
    );
    t.set('SW', 0xff);
    expect(t.get('LED')).toBe(30);
  });

  it('counter with reset and case', () => {
    const t = build(
      `module c(input CLK100MHZ, input BTNC, output reg [3:0] LED, output reg [6:0] seg);
        reg [3:0] cnt = 0;
        always @(posedge CLK100MHZ or posedge BTNC)
          if (BTNC) cnt <= 0; else cnt <= cnt + 1;
        always @* begin
          LED = cnt;
          case (cnt)
            4'd0: seg = 7'b1000000;
            4'd1: seg = 7'b1111001;
            default: seg = 7'b1111111;
          endcase
        end
      endmodule`,
      'verilog',
      'CLK100MHZ',
    );
    expect(t.get('LED')).toBe(0);
    expect(t.get('seg')).toBe(0b1000000);
    t.sim.run(1);
    expect(t.get('LED')).toBe(1);
    expect(t.get('seg')).toBe(0b1111001);
    t.sim.run(20);
    expect(t.get('LED')).toBe(21 % 16);
    t.set('BTNC', 1);
    expect(t.get('LED')).toBe(0);
  });

  it('hierarchy and parameters', () => {
    const t = build(
      `module inv #(parameter W = 2) (input [W-1:0] a, output [W-1:0] y); assign y = ~a; endmodule
       module top(input [3:0] SW, output [3:0] LED);
         inv #(.W(4)) u0 (.a(SW), .y(LED));
       endmodule`,
      'verilog',
    );
    t.set('SW', 0b0101);
    expect(t.get('LED')).toBe(0b1010);
  });

  it('shift register with concat and nonblocking swap', () => {
    const t = build(
      `module s(input CLK100MHZ, output reg [3:0] LED = 4'b0001);
         always @(posedge CLK100MHZ) LED <= {LED[2:0], LED[3]};
       endmodule`,
      'verilog',
      'CLK100MHZ',
    );
    t.sim.run(1);
    expect(t.get('LED')).toBe(2);
    t.sim.run(3);
    expect(t.get('LED')).toBe(1);
  });
});

describe('vhdl', () => {
  it('gates and when/else', () => {
    const t = build(
      `library ieee; use ieee.std_logic_1164.all;
       entity top is port (SW : in std_logic_vector(1 downto 0); LED : out std_logic_vector(3 downto 0)); end top;
       architecture rtl of top is begin
         LED(0) <= SW(0) and SW(1);
         LED(1) <= SW(0) or SW(1);
         LED(2) <= not SW(0);
         LED(3) <= '1' when SW = "11" else '0';
       end rtl;`,
      'vhdl',
    );
    t.set('sw', 3);
    expect(t.get('led')).toBe(0b1011);
    t.set('sw', 0);
    expect(t.get('led')).toBe(0b0100);
  });

  it('clocked counter with numeric_std', () => {
    const t = build(
      `library ieee; use ieee.std_logic_1164.all; use ieee.numeric_std.all;
       entity cnt is port (CLK100MHZ, BTNC : in std_logic; LED : out std_logic_vector(7 downto 0)); end entity;
       architecture rtl of cnt is
         signal c : unsigned(7 downto 0) := (others => '0');
         type state_t is (IDLE, RUN);
         signal st : state_t := IDLE;
       begin
         process(CLK100MHZ) begin
           if rising_edge(CLK100MHZ) then
             if BTNC = '1' then
               c <= (others => '0');
             else
               c <= c + 1;
             end if;
             case st is
               when IDLE => st <= RUN;
               when others => null;
             end case;
           end if;
         end process;
         LED <= std_logic_vector(c);
       end architecture;`,
      'vhdl',
      'clk100mhz',
    );
    t.sim.run(300);
    expect(t.get('led')).toBe(300 % 256);
    t.set('btnc', 1);
    t.sim.run(1);
    expect(t.get('led')).toBe(0);
  });

  it('process with variable and for loop', () => {
    const t = build(
      `library ieee; use ieee.std_logic_1164.all; use ieee.numeric_std.all;
       entity pop is port (SW : in std_logic_vector(7 downto 0); LED : out std_logic_vector(3 downto 0)); end;
       architecture a of pop is begin
         process(SW)
           variable n : integer range 0 to 8;
         begin
           n := 0;
           for i in 0 to 7 loop
             if SW(i) = '1' then n := n + 1; end if;
           end loop;
           LED <= std_logic_vector(to_unsigned(n, 4));
         end process;
       end a;`,
      'vhdl',
    );
    t.set('sw', 0b10110111);
    expect(t.get('led')).toBe(6);
  });
});
