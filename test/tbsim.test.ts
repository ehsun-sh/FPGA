import { describe, expect, it } from 'vitest';
import { synthesizeFiles } from '../src/hdl';
import { TbSim } from '../src/sim/tbsim';

const COUNTER_V = `module counter #(parameter W = 4) (input clk, input rst, input en, output reg [W-1:0] q);
  always @(posedge clk)
    if (rst) q <= 0;
    else if (en) q <= q + 1;
endmodule`;

const TB_V = `\`timescale 1ns / 1ps
module tb;
  reg clk = 0, rst = 1, en = 0;
  wire [3:0] q;
  counter #(.W(4)) dut (.clk(clk), .rst(rst), .en(en), .q(q));
  always #5 clk = ~clk;
  initial begin
    $display("start");
    #12 rst = 0;
    en = 1;
    repeat (5) @(posedge clk);
    #1 $display("t=%0t q=%d hex=%h bin=%b", $time, q, q, q);
    wait (q == 4'd9);
    $display("reached %0d at %0t", dut.q, $time);
    if (q !== 9) $error("q is %0d", q);
    $finish;
  end
endmodule`;

const COUNTER_VHD = `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity counter is
  port (clk, rst, en : in std_logic; q : out std_logic_vector(3 downto 0));
end counter;
architecture rtl of counter is
  signal r : unsigned(3 downto 0) := (others => '0');
begin
  process (clk)
  begin
    if rising_edge(clk) then
      if rst = '1' then r <= (others => '0');
      elsif en = '1' then r <= r + 1;
      end if;
    end if;
  end process;
  q <= std_logic_vector(r);
end rtl;`;

const TB_VHD = `library ieee;
use ieee.std_logic_1164.all;
use ieee.numeric_std.all;
entity tb is
end tb;
architecture sim of tb is
  constant T : time := 10 ns;
  signal clk : std_logic := '0';
  signal rst : std_logic := '1';
  signal en  : std_logic := '0';
  signal q   : std_logic_vector(3 downto 0);
begin
  dut : entity work.counter port map (clk => clk, rst => rst, en => en, q => q);
  clk <= not clk after T / 2;
  stim : process
  begin
    wait for 12 ns;
    rst <= '0';
    en <= '1';
    for i in 1 to 5 loop
      wait until rising_edge(clk);
    end loop;
    wait for 1 ns;
    report "q = " & integer'image(to_integer(unsigned(q)));
    assert unsigned(q) = 3 report "wrong count" severity error;
    wait until q = "1001";
    report "done at " & time'image(now);
    std.env.finish;
  end process;
end sim;`;

describe('testbench simulation', () => {
  it('runs a Verilog testbench with clock, waits and $display', () => {
    const d = synthesizeFiles(
      [
        { name: 'counter.v', src: COUNTER_V },
        { name: 'tb.v', src: TB_V },
      ],
      'verilog',
    );
    expect(d.top).toBe('tb');
    const s = new TbSim(d);
    expect(s.run(Infinity)).toBe('finish');
    const text = s.lines.map((l) => l.text);
    // released at 12 ns; rising edges at 15,25,35,45,55 count 1..5... (rst sampled at 5 ns only)
    expect(text[0]).toBe('start');
    expect(text[1]).toBe('t=56 q= 5 hex=5 bin=0101');
    expect(text[2]).toBe('reached 9 at 95');
    expect(s.errors).toBe(0);
    const q = s.waves.find((w) => w.sig.name === 'q')!;
    expect(q.v.slice(0, 3)).toEqual([0, 1, 2]);
    expect(q.t[1]).toBe(15000);
    const clk = s.waves.find((w) => w.sig.name === 'clk')!;
    expect(clk.t.slice(0, 3)).toEqual([0, 5000, 10000]);
    expect(s.waves.some((w) => w.sig.name === 'dut.q' || w.sig.scope === 'dut')).toBe(true);
  });

  it('runs a VHDL testbench with after, wait until and report', () => {
    const d = synthesizeFiles(
      [
        { name: 'counter.vhd', src: COUNTER_VHD },
        { name: 'tb.vhd', src: TB_VHD },
      ],
      'vhdl',
    );
    const s = new TbSim(d);
    expect(s.run(Infinity)).toBe('finish');
    const text = s.lines.map((l) => l.text);
    expect(text[0]).toBe('Note: q = 5  (Time: 56 ns)');
    expect(text[1]).toMatch(/^Error: wrong count/);
    expect(text[2]).toBe('Note: done at 95 ns  (Time: 95 ns)');
    expect(s.errors).toBe(1);
  });

  it('runs for a given time and continues', () => {
    const d = synthesizeFiles(
      [
        { name: 'counter.v', src: COUNTER_V },
        { name: 'tb.v', src: TB_V.replace('$finish;', '') },
      ],
      'verilog',
    );
    const s = new TbSim(d);
    expect(s.run(30000)).toBe('time');
    expect(s.now).toBe(30000);
    expect(s.run(1000000)).toBe('time');
    expect(s.now).toBe(1030000);
    s.restart();
    expect(s.now).toBe(0);
    expect(s.run(20000)).toBe('time');
  });

  it('reports a missing delay in a forever loop', () => {
    const d = synthesizeFiles([{ name: 'tb.v', src: 'module tb; reg a; initial forever a = ~a; endmodule' }], 'verilog');
    const s = new TbSim(d);
    expect(s.run(1000)).toBe('error');
    expect(s.error).toMatch(/without a delay/);
  });

  it('rejects delays in synthesizable code', () => {
    expect(() => synthesizeFiles([{ name: 'a.v', src: 'module a(input c, output reg q); always @(posedge c) begin #5 q <= 1; end endmodule' }], 'verilog')).toThrow(/testbench/);
  });
});

describe('generated testbenches', () => {
  it('compile and run for every lesson in both languages', async () => {
    const { ALL_LESSONS } = await import('../src/lessons/course');
    const { generateTestbench } = await import('../src/sim/tbgen');
    const { synthesize } = await import('../src/hdl');
    for (const l of ALL_LESSONS) {
      for (const lang of ['verilog', 'vhdl'] as const) {
        const src = lang === 'verilog' ? l.verilog : l.vhdl;
        const tb = l.tb?.[lang] ?? generateTestbench(synthesize(src, lang), lang);
        let s: TbSim;
        try {
          s = new TbSim(synthesizeFiles([{ name: 'top', src }, { name: 'tb', src: tb }], lang));
        } catch (e) {
          throw new Error(`${l.id} ${lang}: ${(e as Error).message}\n${tb}`);
        }
        const r = s.run(5e6);
        expect(r, `${l.id} ${lang}: ${s.error}`).not.toBe('error');
        expect(s.lines.length, `${l.id} ${lang}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('testbench lesson', () => {
  it('passes its own testbench in both languages', async () => {
    const { TESTBENCH_LESSON: l } = await import('../src/lessons/sim');
    for (const lang of ['verilog', 'vhdl'] as const) {
      const s = new TbSim(synthesizeFiles([{ name: 'top', src: l[lang] }, { name: 'tb', src: l.tb![lang] }], lang));
      expect(s.run(Infinity)).toBe('finish');
      expect(s.errors, s.lines.map((x) => x.text).join('\n')).toBe(0);
      expect(s.lines.some((x) => x.text.includes('PASS'))).toBe(true);
      // failing check is reported
      const bad = new TbSim(synthesizeFiles([{ name: 'top', src: l[lang] }, { name: 'tb', src: l.tb![lang].replace(/8'd10|x"0A"/, lang === 'verilog' ? "8'd11" : 'x"0B"') }], lang));
      bad.run(Infinity);
      expect(bad.errors).toBe(1);
    }
  });
});
