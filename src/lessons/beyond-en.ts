// English text for chapter 8 "Beyond the basics" and the guided project (Phase 4.3, 4.4). Spread into EN in en.ts.
import { part, ref, term, truth } from './helpers';
import type { LessonText } from './en';
import { figMetastable, figSetupHold, figure } from './figures';
import { milestones } from './beyond';

export const BEYOND_EN: Record<string, LessonText> = {
  timing: {
    title: 'Timing: setup, hold and Fmax',
    summary: 'Why a long combinational path limits the clock speed, and how a pipeline shortens it.',
    body: `
<p>So far we assumed every calculation finishes within one clock. But every LUT, every wire and every multiplier takes a few hundred picoseconds. At 100 MHz there are only <b>10 ns</b> for a signal to leave one flip-flop, pass through the logic and reach the next flip-flop before the next edge.</p>
<h3>Setup and hold</h3>
<p>A flip-flop takes the right value only if its D input is stable a little <b>before</b> the clock edge (the ${term('setup-hold', 'setup')} time) and stays stable a little <b>after</b> it (the hold time). If the data arrives late, a wrong or even undefined value is stored.</p>
${figure(figSetupHold(), 'The framed area is the window in which D must not change. The new value arrived before the window, so Q takes it on the clock edge.')}
<h3>The register-to-register path</h3>
<p>Timing is always worked out for the paths between two flip-flops:</p>
<pre class="formula">path delay = clk→Q + logic + routing + setup  ≤  clock period
${term('slack', 'slack')} = clock period − path delay        ${term('fmax', 'Fmax')} = 1 / (the shortest period that keeps the slack positive)</pre>
<p>Vivado calls the worst slack <b>WNS</b> (worst negative slack). A negative WNS means the design does not work at this clock.</p>
<h3>This lesson's design</h3>
<p>The code computes <code>((a·b + a)·b + b)·a</code> between two registers: three multipliers (each a ${term('dsp', 'DSP slice')}) and two adders in a row. Press <b>Run Synthesis</b> and open the <b>Timing</b> report in the Reports tab: WNS is negative and the worst path runs from a to y.</p>
<h3>Pipelining</h3>
<p>The fix is to break the path with a register in the middle (a ${term('pipeline', 'pipeline')}). Each stage gets shorter and Fmax rises; the price is one more clock of latency. A new result still comes out every clock, so the throughput stays the same.</p>
<p class="note">💡 FPGA Lab's timing numbers are estimates from a simple model of LUT, wire and DSP delays. Real Vivado gives exact numbers after place and route, but the changes go the same way.</p>`,
    tryIt: `<p>Set a with ${part('SW7..SW0')} and b with ${part('SW15..SW8')}; ${part('LD15..LD0')} show the low 16 bits of the result. Then <b>Run Synthesis</b> and read the <b>Timing</b> report: WNS is about −2.9 ns, an estimated Fmax of about 77 MHz.</p>`,
    exercise: `<p>Pipeline the calculation so the estimated Fmax is at least 100 MHz and the result stays right.</p>`,
  },
  clocking: {
    title: 'Clocking: a clock enable, not a second clock',
    summary: 'Why a divided signal must not become a clock, and how to make slow events from one clock and a few enables.',
    body: `
<p>In ${ref('counter')} a counter made a signal that changed every half second. It is tempting to use that signal as the clock of another part: <code>always @(posedge slow)</code>. On an FPGA, <b>don’t</b>.</p>
<h3>Why a divided signal is a poor clock</h3>
<ul>
  <li>Real clocks travel on dedicated networks (BUFG) so they reach every flip-flop at almost the same moment. A flip-flop output goes over ordinary routing and has a lot of <b>skew</b>.</li>
  <li>Two clocks mean two clock domains; every signal that crosses between them needs a synchroniser (next lesson).</li>
  <li>The timing tools do not know a clock made of logic unless you define it by hand.</li>
</ul>
<h3>The ${term('clock-enable', 'clock enable')}</h3>
<p>Every register runs on the same <code>CLK100MHZ</code>. A ${term('prescaler', 'prescaler')} makes a one-clock pulse, and the registers update only while that pulse is high:</p>
<pre class="formula">tick_1k  = (c1 == DIV − 1)               ← once every 100,000 clocks
tick_1hz = tick_1k &amp;&amp; (c2 == 999)        ← once every 1,000 of the 1 kHz ticks</pre>
<p>Vivado uses the flip-flop’s own <b>CE</b> pin for an enable; it costs nothing and timing stays simple.</p>
${truth(
  ['Signal', 'Rate', 'On the board'],
  [
    ['tick_1k', '1 kHz', '—'],
    ['tick_1hz', '1 Hz', 'LD0 blinks, LD15..LD8 count the seconds'],
  ],
)}
<h3>When you really need another clock</h3>
<p>For a frequency that a simple division cannot give (25.175 MHz for VGA, or 200 MHz for a fast block), the chip’s ${term('mmcm-pll', 'MMCM or PLL')} blocks are used. In Vivado you make one with the <b>Clocking Wizard</b> IP. The FPGA Lab simulator has a single clock domain (<a href="#lim-clock" data-act="limits">simulator limits</a>), so these blocks are not simulated here.</p>`,
    tryIt: `<p>Press Run: ${part('LD0')} changes every second and ${part('LD15..LD8')} count the seconds in binary. The Utilization report shows a single BUFG (one clock).</p>`,
    exercise: `<p>Make a second enable at 2 Hz and blink ${part('LD1')} with it, without a second clock.</p>`,
  },
  cdc: {
    title: 'Clock domain crossing and metastability',
    summary: 'Why asynchronous inputs such as buttons need a two-flop synchroniser.',
    body: `
<p>Buttons, switches, the serial RX line and every other signal from outside are <b>not in step</b> with our clock: they can change at any moment, including right inside a flip-flop’s setup and hold window (${ref('timing')}).</p>
<h3>${term('metastability', 'Metastability')}</h3>
<p>When the input changes in that window, the flip-flop’s output can hang between 0 and 1 for a while and reach one of them late. If two parts of the circuit read that half-made value at the same time, one may see 0 and the other 1, and a state machine jumps to an illegal state. The fault is rare and random, and very hard to find.</p>
${figure(figMetastable(), 'q1 is the output of the first flip-flop and q2 the output of the second. Until the next clock edge q1 has time to settle, which is why the rest of the circuit reads only q2.')}
<h3>The ${term('synchronizer', 'two-flop synchroniser')}</h3>
<p>The standard fix is simple: pass the asynchronous signal through <b>two flip-flops in a row</b> and connect no other logic to the input or output of the first one. The chance that the first flip-flop has still not settled by the next edge is so small that the MTBF runs to thousands of years.</p>
<pre class="formula">BTNC → s1 → s2 → (debounce) → edge detector → counter</pre>
<p>In real Vivado you also put <code>ASYNC_REG = "TRUE"</code> on s1 and s2 so the tools place them next to each other.</p>
<h3>A synchroniser does not remove bounce</h3>
<p>This lesson’s design counts presses of ${part('BTNC')}. Turn on <b>Bouncy buttons</b> above the board: every press counts several times, because the synchroniser only lines the signal up with the clock and ${ref('debounce')} is still needed.</p>
<p class="note">💡 Between two real clock domains (100 and 25 MHz, say) the same synchroniser is enough for one bit; a multi-bit value uses an asynchronous FIFO or a handshake.</p>`,
    tryIt: `<p>Press ${part('BTNC')} a few times; ${part('LD15..LD0')} show the number of presses and ${part('BTNU')} clears it. Then turn on <b>Bouncy buttons</b> and try again: one press counts several.</p>`,
    exercise: `<p>Put a debouncer after the synchroniser so every press counts exactly once.</p>`,
  },
  bram: {
    title: 'Block RAM: big memory on the chip',
    summary: 'Inferring block RAM from an array, read-first and write-first, and finding the RAMB in the utilization report.',
    body: `
<p>In ${ref('ram')} we built a 16-cell memory that fit in LUTs (distributed RAM). For big memories the Artix-7 has ready-made blocks: ${term('bram', 'block RAM')}. The XC7A100T has 135 <b>RAMB36</b> blocks of 36 Kbit each, and each can also act as two independent <b>RAMB18</b>s.</p>
<h3>Inference</h3>
<p>You do not instantiate the block by hand. Write the memory with the standard template and Vivado places a block RAM itself:</p>
<ul>
  <li>An array that is big enough: here <code>1024 × 8</code>, 8 Kbit.</li>
  <li>A write on the clock edge with <code>we</code>.</li>
  <li>A <b>synchronous read</b>: the output is a register. Block RAM has no combinational read; write <code>assign dout = mem[addr]</code> and the memory moves to LUTs.</li>
</ul>
<h3>Read-first and write-first</h3>
<p>If one clock both writes a cell and reads the same cell, what does the output show?</p>
${truth(
  ['Mode', 'Output in the write clock', 'Code'],
  [
    ['Read-first', 'the cell’s old value', '<code>if (we) mem[a] &lt;= d; dout &lt;= mem[a];</code>'],
    ['Write-first', 'the new value (d)', '<code>if (we) begin mem[a] &lt;= d; dout &lt;= d; end else dout &lt;= mem[a];</code>'],
  ],
)}
<p>This lesson’s code is read-first. Block RAM supports both; what matters is knowing which one your design relies on.</p>
<h3>Board connections</h3>
${truth(
  ['Signal', 'Connected to'],
  [
    ['addr[7:0]', 'SW15..SW8'],
    ['addr[9:8] (page)', 'BTNR next page; shown on LD15..LD14'],
    ['din', 'SW7..SW0'],
    ['we', 'BTNC'],
    ['dout', 'LD7..LD0'],
  ],
)}
<p class="note">💡 Press <b>Run Synthesis</b> and find the <b>RAMB18</b> line in the ${term('utilization', 'utilization')} report: 8 Kbit fits in half a RAMB36. Make the memory 4096 × 8 and it takes a whole RAMB36.</p>`,
    tryIt: `<p>Set an address with ${part('SW15..SW8')} and data with ${part('SW7..SW0')}, then press ${part('BTNC')}. Change the address and come back: the data stays on ${part('LD7..LD0')}. ${part('BTNR')} moves to the next page (another 256 cells).</p>`,
    exercise: `<p>Add a second read port: ${part('LD15..LD8')} show the cell at addr + 1.</p>`,
  },
  realboard: {
    title: 'On a real board: from FPGA Lab to Vivado',
    summary: 'Buying a board, installing Vivado, building a bitstream from the downloaded project, programming and troubleshooting.',
    body: `
<p>Every design you wrote in this course also works on a real board. This lesson walks the path from buying a board to seeing an LED light up. Its code is a simple blinker, the design worth trying first on any new board.</p>
<h3>1. The board</h3>
${truth(
  ['Board', 'Chip', 'Good for'],
  [
    ['Digilent Nexys A7-100T', 'Artix-7 XC7A100T', 'this course with no changes; VGA, sensors, USB-HID'],
    ['Digilent Basys 3', 'Artix-7 XC7A35T', 'cheaper; 16 switches, 4 display digits, VGA. Change the pins in the XDC'],
    ['Arty A7 or Cmod A7', 'Artix-7', 'small and cheap; fewer switches and digits, Pmods for modules'],
    ['Tang Nano, iCEBreaker', 'Gowin / Lattice iCE40', 'very cheap; other tools (Gowin IDE or Yosys), the same HDL'],
  ],
)}
<h3>2. Installing Vivado</h3>
<ul>
  <li>Download the free <b>Vivado ML Standard</b> edition from the AMD website (Windows or Linux). Artix-7 is supported in the free edition.</li>
  <li>In the installer pick only the <b>7 Series</b> family to keep the install small. Install the cable drivers too.</li>
  <li>Copy the Digilent board files from Digilent’s GitHub into <code>data/boards</code> so the Nexys A7 appears in the board list.</li>
</ul>
<h3>3. From FPGA Lab to a Vivado project</h3>
<ol>
  <li>At the end of every lesson, the box <b>Build it on a real board with Vivado</b> saves the project into a folder you pick (or as a .zip). It holds the design source, the XDC, the testbench, a <code>create_project.tcl</code> script and <code>build.bat</code>.</li>
  <li>Quickest: double-click <code>build.bat</code> (on Linux <code>sh build.sh</code>) and Vivado builds the bitstream with no command to type. With the FPGA Lab helper running, the <b>Build in Vivado</b> button does it from the website.</li>
  <li>Unzip it, start Vivado and run <code>create_project.tcl</code> from <b>Tools → Run Tcl Script</b>. The project is created with the same chip and files.</li>
  <li>In the Flow Navigator press <b>Run Synthesis</b>, <b>Run Implementation</b> and <b>Generate Bitstream</b> in turn.</li>
</ol>
<h3>4. Programming the board</h3>
<ol>
  <li>Connect the board with a USB cable and switch it on (the POWER switch).</li>
  <li><b>Open Hardware Manager → Open Target → Auto Connect</b>.</li>
  <li><b>Program Device</b> and pick the <code>.bit</code> file. A few seconds later LD0 blinks.</li>
</ol>
<p>This configuration is lost when the board is switched off. To keep it, write the bitstream to the board’s SPI flash (Add Configuration Memory Device).</p>
<h3>5. Troubleshooting</h3>
${truth(
  ['Symptom', 'Usual cause', 'Fix'],
  [
    ['Hardware Manager does not find the board', 'cable drivers missing, or a charge-only cable', 'install the cable drivers; try another USB cable'],
    ['[Place 30-58] or an unplaced pin', 'a port name does not match the XDC, or its line is still commented out', 'compare the names with the XDC and uncomment the lines you need'],
    ['LEDs do nothing, but no error', 'the XDC of another board, or no clock constraint', 'use this board’s XDC; check create_clock'],
    ['Timing failed (negative WNS)', 'a long combinational path', `${ref('timing')}: pipeline it or lower the clock`],
  ],
)}
<p class="note">💡 FPGA Lab is not affiliated with AMD/Xilinx or Digilent; their names appear only as guidance.</p>`,
    tryIt: `<p>Press Run: ${part('LD0')} blinks once a second and ${part('SW15..SW1')} light the other LEDs. Take the same design with <b>Build it on a real board with Vivado</b> below and try it on a real board.</p>`,
  },
  'proj-clock': {
    title: 'Project 1: Digital clock',
    summary: 'A HH.MM.SS clock on the eight-digit display with buttons to set the minutes, in four milestones.',
    body: `
<p>In this project you put several lessons of the course together and build a complete clock: <b>HH.MM.SS</b> on the six right-most digits of the display, with ${part('BTNU')} to set the minutes one forward and ${part('BTND')} one back.</p>
<p>The starter code has every port and parameter and four gaps marked <code>TODO</code>. Do the milestones in order, press <b>Run</b> after each and tick it off. At the end the exercise checker tests the whole clock.</p>
<h3>Milestones</h3>
${milestones([
  '<b>A one-second tick</b> (TODO 1): a prescaler that gives a one-clock pulse every <code>DIV</code> clocks, as in the counter lesson.',
  '<b>Seconds, minutes and hours</b> (TODO 2): six BCD digits; seconds and minutes go 59 → 00, hours 23 → 00, as in the stopwatch.',
  '<b>Show six digits</b> (TODO 3): step to the next digit every <code>SCAN</code> clocks and pick <code>nibble</code>, as in display multiplexing.',
  '<b>Set buttons</b> (TODO 4): synchronise and debounce BTNU and BTND, and make an edge pulse that adds or subtracts one minute.',
])}
<h3>Lessons that help</h3>
<ul>
  <li>${ref('counter')}: the prescaler and tick</li>
  <li>${ref('stopwatch')}: cascaded BCD counters</li>
  <li>${ref('multiplex')}: display multiplexing</li>
  <li>${ref('cdc')} and ${ref('debounce')}: the buttons</li>
</ul>
<p class="note">💡 Make <code>DIV</code> small for a while (<code>1_000_000</code>, say) so the clock runs a hundred times faster and you see the wraps sooner. Set it back to <code>100_000_000</code> before checking; the checker makes it small itself.</p>`,
    tryIt: `<p>The starter code compiles but shows only 0 for now. Press Run after each milestone: first the seconds digit counts, then every digit lights, and last ${part('BTNU')} and ${part('BTND')} set the minutes.</p>`,
    exercise: `<p>Finish the clock so the checker accepts the wraps and the set buttons.</p>`,
  },
};
