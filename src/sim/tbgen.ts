// Generates a starting testbench for a design, like Vivado's language templates: it instantiates the top
// module, drives its clock and reset, steps through a few input values and prints the outputs.
import type { Design, Lang } from '../hdl';
import type { Sig } from '../hdl/ir';

const isClock = (n: string) => /^(clk|clock|clk100mhz|sys_clk|i_clk)$/i.test(n) || /^clk/i.test(n);
const isReset = (n: string) => /(rst|reset)/i.test(n);
const activeLow = (n: string) => /(_n|n)$/i.test(n) && !/^(rst|reset)$/i.test(n);

export function generateTestbench(d: Design, lang: Lang): string {
  const ins = d.ports.filter((p) => p.dir === 'input');
  const outs = d.ports.filter((p) => p.dir !== 'input');
  const clk = ins.find((p) => p.width === 1 && isClock(p.name));
  const rst = ins.find((p) => p.width === 1 && p !== clk && isReset(p.name));
  // the input to step through: the switches if there are any, else the widest data input
  const data = ins.filter((p) => p !== clk && p !== rst).sort((a, b) => (b.name.toUpperCase() === 'SW' ? 1 : 0) - (a.name.toUpperCase() === 'SW' ? 1 : 0) || b.width - a.width)[0];
  const steps = data ? Math.min(2 ** Math.min(data.width, 30), 16) : 0;
  const wait = clk ? 100 : 10;
  return lang === 'verilog' ? verilogTb(d, ins, outs, clk, rst, data, steps, wait) : vhdlTb(d, ins, outs, clk, rst, data, steps, wait);
}

function vRange(s: Sig) {
  return s.width > 1 ? `[${s.left}:${s.right}] ` : '';
}

function verilogTb(d: Design, ins: Sig[], outs: Sig[], clk: Sig | undefined, rst: Sig | undefined, data: Sig | undefined, steps: number, wait: number) {
  const L: string[] = [];
  L.push('`timescale 1ns / 1ps');
  L.push(`// Testbench for '${d.top}'. Edit it freely, then run Flow > Run Behavioral Simulation.`);
  L.push(`module tb_${d.top};`);
  for (const p of ins) {
    const init = p === rst ? (activeLow(p.name) ? '0' : '1') : '0';
    L.push(`    reg  ${vRange(p)}${p.name} = ${init};`);
  }
  for (const p of outs) L.push(`    wire ${vRange(p)}${p.name};`);
  if (data) L.push('    integer i;');
  L.push('');
  L.push(`    ${d.top} dut (`);
  L.push(d.ports.map((p) => `        .${p.name}(${p.name})`).join(',\n'));
  L.push('    );');
  L.push('');
  if (clk) {
    L.push(`    // ${clk.name}: 100 MHz (period 10 ns)`);
    L.push(`    always #5 ${clk.name} = ~${clk.name};`);
    L.push('');
  }
  L.push('    initial begin');
  if (rst) {
    L.push(`        #100 ${rst.name} = ${activeLow(rst.name) ? 1 : 0};   // release reset`);
  }
  const fmt = outs.map((o) => `${o.name}=%${o.width > 4 ? 'h' : 'b'}`).join(' ');
  const args = outs.map((o) => ', ' + o.name).join('');
  if (data) {
    L.push(`        for (i = 0; i < ${steps}; i = i + 1) begin`);
    L.push(`            ${data.name} = i;`);
    L.push(`            #${wait};`);
    L.push(`            $display("t=%0t ${data.name}=%h ${fmt}", $time, ${data.name}${args});`);
    L.push('        end');
  } else {
    L.push('        repeat (10) begin');
    L.push('            #100;');
    L.push(`            $display("t=%0t ${fmt}", $time${args});`);
    L.push('        end');
  }
  L.push('        $finish;');
  L.push('    end');
  L.push('endmodule');
  return L.join('\n') + '\n';
}

function vhdlType(s: Sig) {
  if (s.width === 1) return 'std_logic';
  return `std_logic_vector(${s.left} ${s.left >= s.right ? 'downto' : 'to'} ${s.right})`;
}

function vhdlTb(d: Design, ins: Sig[], outs: Sig[], clk: Sig | undefined, rst: Sig | undefined, data: Sig | undefined, steps: number, wait: number) {
  const n = (s: Sig) => s.name.toLowerCase();
  const L: string[] = [];
  L.push('library ieee;');
  L.push('use ieee.std_logic_1164.all;');
  L.push('use ieee.numeric_std.all;');
  L.push('');
  L.push(`-- Testbench for '${d.top}'. Edit it freely, then run Flow > Run Behavioral Simulation.`);
  L.push(`entity tb_${d.top} is`);
  L.push(`end tb_${d.top};`);
  L.push('');
  L.push(`architecture sim of tb_${d.top} is`);
  for (const p of ins) {
    const init = p === rst ? (activeLow(p.name) ? "'0'" : "'1'") : p.width === 1 ? "'0'" : "(others => '0')";
    L.push(`    signal ${n(p)} : ${vhdlType(p)} := ${init};`);
  }
  for (const p of outs) L.push(`    signal ${n(p)} : ${vhdlType(p)};`);
  L.push('begin');
  L.push(`    dut : entity work.${d.top} port map (`);
  L.push(d.ports.map((p) => `        ${n(p)} => ${n(p)}`).join(',\n'));
  L.push('    );');
  L.push('');
  if (clk) {
    L.push(`    -- ${n(clk)}: 100 MHz (period 10 ns)`);
    L.push(`    ${n(clk)} <= not ${n(clk)} after 5 ns;`);
    L.push('');
  }
  L.push('    stim : process');
  L.push('    begin');
  if (rst) {
    L.push('        wait for 100 ns;');
    L.push(`        ${n(rst)} <= ${activeLow(rst.name) ? "'1'" : "'0'"};   -- release reset`);
  }
  const outsTxt = outs.map((o) => ` & " ${n(o)}=" & ${o.width > 4 ? `to_hstring(${n(o)})` : `to_string(${n(o)})`}`).join('');
  if (data) {
    L.push(`        for i in 0 to ${steps - 1} loop`);
    L.push(data.width === 1 ? `            if i mod 2 = 1 then ${n(data)} <= '1'; else ${n(data)} <= '0'; end if;` : `            ${n(data)} <= std_logic_vector(to_unsigned(i, ${data.width}));`);
    L.push(`            wait for ${wait} ns;`);
    L.push(`            report "${n(data)}=" & integer'image(i)${outsTxt};`);
    L.push('        end loop;');
  } else {
    L.push('        for i in 1 to 10 loop');
    L.push('            wait for 100 ns;');
    L.push(`            report "t=" & time'image(now)${outsTxt};`);
    L.push('        end loop;');
  }
  L.push('        std.env.finish;');
  L.push('    end process;');
  L.push('end sim;');
  return L.join('\n') + '\n';
}
