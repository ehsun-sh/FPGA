// English text for the lessons. Code and constraints are shared with the Persian version (lessons.ts).
import { truth } from './helpers';

export interface LessonText {
  chapter: string;
  title: string;
  summary: string;
  body: string;
  tryIt: string;
  exercise?: string;
}

export const EN: Record<string, LessonText> = {
  intro: {
    chapter: 'Chapter 1',
    title: 'What is an FPGA? Meet the Nexys A7',
    summary: 'Your first design: every switch lights the LED above it.',
    body: `
<p>An <b>FPGA</b> (Field Programmable Gate Array) is a chip whose <b>hardware</b> you define yourself. A processor runs instructions one after another; an FPGA becomes a real circuit in which every part works <b>at the same time</b>.</p>
<h3>What is inside an FPGA?</h3>
<ul>
  <li><b>LUT</b> (Look-Up Table): a small table that implements any 6-input logic function.</li>
  <li><b>Flip-flop</b>: one bit of memory that updates on a clock edge.</li>
  <li><b>Routing</b>: programmable wiring between the blocks.</li>
  <li>Dedicated blocks such as <b>BRAM</b> (memory), <b>DSP</b> (multipliers) and clock management.</li>
</ul>
<p>Our board carries a <b>Xilinx Artix-7 XC7A100T</b>: about 63 thousand LUTs and 126 thousand flip-flops.</p>
<h3>The Vivado design flow</h3>
<ol class="flow-steps">
  <li><b>Design Sources</b>: write the design in Verilog or VHDL</li>
  <li><b>Constraints (XDC)</b>: connect the design's ports to the chip's pins</li>
  <li><b>Simulation</b>: check the behaviour</li>
  <li><b>Synthesis</b>: turn the code into gates and flip-flops</li>
  <li><b>Implementation</b>: place and route inside the chip</li>
  <li><b>Generate Bitstream</b> and <b>Program Device</b>: load the design onto the board</li>
</ol>
<p>On this site one click on <span class="kbd">▶ Run</span> performs all of these steps and the result appears on the 3D board on the right.</p>
<h3>A tour of the board</h3>
<ul>
  <li><b>SW0 to SW15</b>: 16 slide switches (inputs)</li>
  <li><b>LD0 to LD15</b>: 16 green LEDs (outputs)</li>
  <li><b>BTNC/BTNU/BTNL/BTNR/BTND</b>: five push buttons, plus <b>CPU RESET</b> (active-low)</li>
  <li>Two 4-digit <b>seven-segment</b> displays (AN0 to AN7)</li>
  <li>Two RGB LEDs, <b>LD16</b> and <b>LD17</b></li>
  <li>A <b>100 MHz</b> clock on pin E3, named <code>CLK100MHZ</code></li>
</ul>
<h3>Your first design</h3>
<p>The simplest possible circuit: wire every switch straight to the LED above it. In Verilog <code>assign</code>, and in VHDL <code>&lt;=</code>, creates a permanent (combinational) connection.</p>`,
    tryIt: `<p>Press <span class="kbd">▶ Run</span>, then click the switches at the bottom of the board. Each switch that is up (ON) lights the LED above it.</p>`,
    exercise: `<p>Change the code so the LED order is reversed (SW0 → LD15). Hint: in Verilog use <code>{SW[0], SW[1], ...}</code> or a loop.</p>`,
  },
  gates: {
    chapter: 'Chapter 2',
    title: 'Logic gates',
    summary: 'AND, OR, NOT, NAND, NOR, XOR and XNOR with two switches.',
    body: `
<p>Gates are the building blocks of every digital circuit. Each one computes a simple function of its input bits. In this lesson <b>A = SW0</b> and <b>B = SW1</b>, and every gate's output drives one LED.</p>
${truth(
  ['A', 'B', 'AND<br>LD0', 'OR<br>LD1', 'NOT A<br>LD2', 'NAND<br>LD3', 'NOR<br>LD4', 'XOR<br>LD5', 'XNOR<br>LD6'],
  [
    [0, 0, 0, 0, 1, 1, 1, 0, 1],
    [0, 1, 0, 1, 1, 1, 0, 1, 0],
    [1, 0, 0, 1, 0, 1, 0, 1, 0],
    [1, 1, 1, 1, 0, 0, 0, 0, 1],
  ],
)}
<h3>Operators in both languages</h3>
${truth(
  ['Gate', 'Verilog', 'VHDL'],
  [
    ['AND', '<code>a &amp; b</code>', '<code>a and b</code>'],
    ['OR', '<code>a | b</code>', '<code>a or b</code>'],
    ['NOT', '<code>~a</code>', '<code>not a</code>'],
    ['NAND', '<code>~(a &amp; b)</code>', '<code>a nand b</code>'],
    ['NOR', '<code>~(a | b)</code>', '<code>a nor b</code>'],
    ['XOR', '<code>a ^ b</code>', '<code>a xor b</code>'],
    ['XNOR', '<code>~(a ^ b)</code>', '<code>a xnor b</code>'],
  ],
)}
<p>Note: an FPGA does not build separate gates; synthesis packs all these functions into <b>LUTs</b>. See the estimated LUT count in the synthesis report (Reports tab).</p>`,
    tryIt: `<p>Put <b>SW0</b> and <b>SW1</b> in all four combinations and compare LD0 to LD6 with the truth table. LD2 (NOT) depends only on SW0.</p>`,
    exercise: `<p>Build a three-input AND gate (SW0, SW1, SW2) and show its output on LD7. Make SW 3 bits and LED 8 bits wide.</p>`,
  },
  mux: {
    chapter: 'Chapter 3',
    title: 'Multiplexers (MUX)',
    summary: 'Pick one of several inputs with a select signal.',
    body: `
<p>A <b>multiplexer</b> works like a rotary switch: the <b>select</b> signal decides which input reaches the output. It is one of the most common blocks in digital design.</p>
<h3>2-to-1 MUX</h3>
<p>If <code>sel = 0</code> the output is <code>d0</code>, and if <code>sel = 1</code> it is <code>d1</code>: <code>y = sel ? d1 : d0</code>. Here <b>d0 = SW0</b>, <b>d1 = SW1</b>, <b>sel = SW15</b> and the output is <b>LD0</b>.</p>
<h3>4-to-1 MUX</h3>
<p>Two select bits (<b>SW5, SW4</b>) route one of the four inputs <b>SW0 to SW3</b> to <b>LD1</b>.</p>
${truth(
  ['SW5', 'SW4', 'LD1 ='],
  [
    [0, 0, 'SW0'],
    [0, 1, 'SW1'],
    [1, 0, 'SW2'],
    [1, 1, 'SW3'],
  ],
)}
<h3>Three ways to describe it</h3>
<ul>
  <li>The conditional operator: Verilog <code>? :</code>, VHDL <code>when ... else</code></li>
  <li>A <code>case</code> inside a combinational block (<code>always @(*)</code> or <code>process</code>)</li>
  <li>In VHDL: <code>with ... select</code></li>
</ul>
<p class="note">⚠️ In a combinational block, always assign a value in every case (<code>default</code> or <code>when others</code>); otherwise synthesis infers a <b>latch</b>.</p>`,
    tryIt: `<p>Turn SW0 on and SW1 off. Now flip SW15 to switch between the two inputs and watch LD0. For the 4-to-1 MUX, change SW4 and SW5 and see which switch LD1 follows.</p>`,
    exercise: `<p>Build an 8-to-1 MUX: inputs SW0 to SW7, select SW15..SW13, output LD2.</p>`,
  },
  adder: {
    chapter: 'Chapter 4',
    title: 'Adders and hierarchical design',
    summary: 'Half adder, full adder and a 4-bit adder built from module instances.',
    body: `
<p>A <b>full adder</b> adds three bits, <code>a</code>, <code>b</code> and the carry-in <code>cin</code>, and produces the sum <code>s</code> and the carry-out <code>cout</code>:</p>
<pre class="formula">s    = a ⊕ b ⊕ cin
cout = a·b + cin·(a ⊕ b)</pre>
${truth(
  ['a', 'b', 'cin', 'cout', 's'],
  [
    [0, 0, 0, 0, 0],
    [0, 0, 1, 0, 1],
    [0, 1, 0, 0, 1],
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 1, 1, 0],
    [1, 1, 0, 1, 0],
    [1, 1, 1, 1, 1],
  ],
)}
<h3>Hierarchy</h3>
<p>Four instances of the <code>full_adder</code> module, each passing its carry to the next, form a <b>4-bit ripple-carry adder</b>. This is the tree you see in Vivado's Sources window.</p>
<ul>
  <li><b>A = SW3..SW0</b>, <b>B = SW7..SW4</b>, <b>Cin = SW8</b></li>
  <li>Sum on <b>LD3..LD0</b>, carry on <b>LD4</b></li>
  <li>For comparison, the same sum with the <code>+</code> operator on <b>LD12..LD8</b></li>
</ul>
<p>In practice we always write <code>+</code>; synthesis maps it onto the chip's fast carry chain (CARRY4).</p>`,
    tryIt: `<p>For example set A = 0101 (SW0 and SW2 on) and B = 0011 (SW4 and SW5 on). The sum 8, i.e. <b>01000</b>, appears on LD4..LD0 and again on LD12..LD8.</p>`,
    exercise: `<p>Turn the adder into a <b>subtractor</b>: A − B = A + (~B) + 1. Use SW8 to choose between add and subtract.</p>`,
  },
  seg7: {
    chapter: 'Chapter 5',
    title: 'Seven-segment display',
    summary: 'Hex decoder: the 4-bit switch value on one digit.',
    body: `
<p>Each digit of a seven-segment display has seven LED segments, <b>a</b> to <b>g</b>, plus a decimal point <b>dp</b>.</p>
<pre class="formula">   ─a─
  f   b
   ─g─
  e   c
   ─d─  .dp</pre>
<p>On the Nexys A7 the displays are <b>common anode</b> and both kinds of signal are <b>active-low</b>:</p>
<ul>
  <li><code>CA..CG</code> and <code>DP</code>: segment cathodes; <b>0 means on</b>.</li>
  <li><code>AN7..AN0</code>: digit select; <b>0 means that digit is enabled</b>.</li>
</ul>
<p>All eight digits share the segment lines, so if several AN signals are 0 they all show the same symbol. In this lesson only the right-most digit (AN0) is on and it shows <b>SW3..SW0</b> in hex (0 to F).</p>
${truth(
  ['Value', 'gfedcba'],
  [
    ['0', '1000000'],
    ['1', '1111001'],
    ['2', '0100100'],
    ['3', '0110000'],
    ['A', '0001000'],
    ['F', '0001110'],
  ],
)}
<p>This circuit is <b>combinational</b>: a look-up table (a small ROM) described with <code>case</code> and implemented in LUTs.</p>`,
    tryIt: `<p>Use SW0 to SW3 to make the numbers 0 to 15 and watch the right-most digit show 0 to F.</p>`,
    exercise: `<p>Change AN so all eight digits show the same value. Then use SW15 to switch the decimal point (DP) on and off.</p>`,
  },
  ff: {
    chapter: 'Chapter 6',
    title: 'Clocks and flip-flops (sequential logic)',
    summary: 'A 16-bit register with enable and synchronous reset.',
    body: `
<p>So far every circuit was <b>combinational</b>: outputs depended only on the current inputs. <b>Sequential</b> circuits have memory and update on the <b>rising edge of the clock</b>.</p>
<h3>D flip-flop</h3>
<p>On every rising clock edge the value on <code>D</code> is stored in <code>Q</code> and held until the next edge. The board clock is <b>100 MHz</b>: one edge every 10 nanoseconds.</p>
<ul>
  <li>Verilog: <code>always @(posedge CLK100MHZ)</code> with <b>non-blocking</b> assignments, <code>&lt;=</code></li>
  <li>VHDL: <code>process(CLK100MHZ)</code> with <code>if rising_edge(CLK100MHZ) then</code></li>
</ul>
<h3>Enable and reset</h3>
<p>This lesson uses 16 flip-flops (a register). While <b>BTNC</b> is held, the switch values are stored; after you release it the LEDs <b>keep</b> the old value even if you change the switches. The red <b>CPU RESET</b> button (active-low) clears the register.</p>
<p class="note">💡 Always use <code>&lt;=</code> in clocked blocks so all flip-flops update together. The synthesis report should show <b>16 FF</b>.</p>`,
    tryIt: `<p>Turn on a few switches; the LEDs don't change. Now press the centre button (BTNC): the pattern is stored. Change the switches and see the LEDs keep the old value. The red button clears everything.</p>`,
    exercise: `<p>Shift the register one bit left with BTNU and one bit right with BTND (hint: <code>{LED[14:0], 1'b0}</code>). Why does one press empty the register so quickly? (The answer is in the next lesson!)</p>`,
  },
  counter: {
    chapter: 'Chapter 7',
    title: 'Counters and clock division',
    summary: 'A 1 Hz blinker and an 8-bit counter on the LEDs.',
    body: `
<p>A 100 MHz clock is far too fast for our eyes. To create slow events we build a <b>counter</b> that counts clock cycles and does something when it reaches a given value. This is called <b>clock division</b>.</p>
<pre class="formula">half a second = 0.5 s × 100,000,000 Hz = 50,000,000 cycles</pre>
<p>Counting to 50 million needs <b>26 bits</b> (2<sup>26</sup> ≈ 67 million).</p>
<ul>
  <li><code>div</code>: the divider counter; it wraps to zero every half second.</li>
  <li><code>blink</code>: toggles every half second, so LD0 blinks at 1 Hz.</li>
  <li><code>count</code>: an 8-bit counter that increments every half second, shown in binary on LD15..LD8.</li>
</ul>
<p class="note">⏱️ The simulator tries to run the clock at the real 100 MHz. The achieved speed is shown in the status bar. On a slower computer the blinking is slower too. Use the <b>Clock</b> menu to slow the clock down and see the details.</p>
<p>In Vivado simulations engineers also shrink <code>HALF_SECOND</code> to test faster. Try it!</p>`,
    tryIt: `<p>Press Run. LD0 should blink once per second and LD15..LD8 should count in binary. The red button resets the counter.</p>`,
    exercise: `<p>Build a “Knight Rider” light: one lit LED that moves one position every 100 ms and bounces at both ends.</p>`,
  },
  multiplex: {
    chapter: 'Chapter 8',
    title: 'Multi-digit display (multiplexing)',
    summary: 'Show the 16-bit switch value on 4 digits by lighting them in turn.',
    body: `
<p>Because all digits share their segment lines, we cannot show four different symbols at once. The solution is <b>time multiplexing</b>: enable one digit at a time and put its own symbol on the segments. If this happens faster than about 60 times per second, the eye sees all digits lit and steady (<b>persistence of vision</b>).</p>
<ul>
  <li>An 18-bit <code>refresh</code> counter runs on the 100 MHz clock.</li>
  <li>Its top two bits (<code>refresh[17:16]</code>) choose the active digit; each digit is on for about 0.65 ms, so the whole display refreshes about 380 times per second.</li>
  <li>A MUX picks the nibble (4 bits) for the active digit and the decoder from lesson 5 turns it into segments.</li>
</ul>
<p>This lesson combines everything so far: <b>counter</b> + <b>MUX</b> + <b>decoder</b> + <b>hierarchy</b>.</p>`,
    tryIt: `<p>Change the switches; the four right-most digits show SW15..SW0 in hex. Set the <b>Clock</b> menu to <b>10 Hz</b> to watch the digits light up one by one!</p>`,
    exercise: `<p>Extend the display to 8 digits: the four left digits show a counter that increments every second.</p>`,
  },
  fsm: {
    chapter: 'Chapter 9',
    title: 'Finite state machines: a traffic light',
    summary: 'A Moore FSM with a timer and the RGB LED.',
    body: `
<p>A <b>finite state machine (FSM)</b> is a circuit that is always in one of a few <b>states</b> and moves to the next state based on inputs and time. Almost every controller (protocols, menus, games) is built from FSMs.</p>
<h3>Traffic light</h3>
<pre class="formula">RED (2s) ──► GREEN (2s) ──► YELLOW (1s) ──► RED ...
                  │
     BTNC (pedestrian) ──► YELLOW early</pre>
<ul>
  <li>States are an enumeration: <code>localparam</code> in Verilog, <code>type state_t is (...)</code> in VHDL.</li>
  <li>A <b>timer</b> counts how long we stay in each state.</li>
  <li>The output depends only on the state (<b>Moore</b>): the colour of the RGB LED <b>LD16</b>.</li>
  <li>Pressing <b>BTNC</b> while GREEN moves to YELLOW early.</li>
</ul>
<p>Standard FSM structure: one sequential block that <b>registers the state</b> and one combinational block for the <b>outputs</b>.</p>
<p class="note">💡 The real RGB LED is very bright; real designs dim it with PWM.</p>`,
    tryIt: `<p>The RGB LED LD16 (next to the displays) cycles red, green and yellow, and LD2..LD0 show the current state. Press BTNC while it is green.</p>`,
    exercise: `<p>Add a “flashing yellow” state that is active while SW0 is on (like a traffic light at night).</p>`,
  },
  playground: {
    chapter: 'Lab',
    title: 'Playground',
    summary: 'Write any design you like and run it on the board.',
    body: `
<p>You are free here! Write any synthesizable Verilog or VHDL, adjust the XDC file and run it on the board.</p>
<h3>Ready-made port names</h3>
<table class="truth"><thead><tr><th>Port</th><th>Dir</th><th>Description</th></tr></thead><tbody>
<tr><td><code>CLK100MHZ</code></td><td>in</td><td>100 MHz clock</td></tr>
<tr><td><code>SW[15:0]</code></td><td>in</td><td>slide switches</td></tr>
<tr><td><code>BTNC BTNU BTNL BTNR BTND</code></td><td>in</td><td>push buttons (pressed = 1)</td></tr>
<tr><td><code>CPU_RESETN</code></td><td>in</td><td>red button (pressed = 0)</td></tr>
<tr><td><code>LED[15:0]</code></td><td>out</td><td>green LEDs</td></tr>
<tr><td><code>LED16_R/G/B, LED17_R/G/B</code></td><td>out</td><td>RGB LEDs</td></tr>
<tr><td><code>CA..CG, DP</code></td><td>out</td><td>seven-segment segments (0 = on)</td></tr>
<tr><td><code>AN[7:0]</code></td><td>out</td><td>digit select (0 = enabled)</td></tr>
</tbody></table>
<p>If a port is not constrained in the XDC but its name matches the table above, the simulator connects it automatically and shows a warning.</p>
<h3>Supported features</h3>
<ul>
<li>Verilog-2001: <code>module</code>, <code>assign</code>, <code>always</code>, <code>case/casez</code>, <code>for</code>, <code>parameter</code>, module instances, memories <code>reg [7:0] mem [0:15]</code></li>
<li>VHDL: <code>entity/architecture</code>, <code>process</code>, <code>when/else</code>, <code>with/select</code>, <code>numeric_std</code>, enumeration types, <code>entity work.x</code></li>
<li>Limits: vectors up to 32 bits; 2-state simulation (0/1, no X or Z).</li>
</ul>`,
    tryIt: `<p>Write your code and press <span class="kbd">▶ Run</span>. Errors appear in the Messages window at the bottom.</p>`,
  },
};

// Lesson-page labels
export const LESSON_UI = {
  fa: {
    explain: '📖 توضیح',
    code: '💻 کد',
    openEditor: 'باز کردن در ویرایشگر ✎',
    tryIt: '🔌 روی برد امتحان کنید',
    runOn: (board: string) => `▶ اجرا روی برد ${board}`,
    exercise: '🎯 تمرین',
    exerciseHint: 'کد را در تب ویرایشگر تغییر دهید و دوباره Run بزنید. تغییرات شما در مرورگر ذخیره می‌شود.',
    learn: 'آموزش',
  },
  en: {
    explain: '📖 Explanation',
    code: '💻 Code',
    openEditor: 'Open in editor ✎',
    tryIt: '🔌 Try it on the board',
    runOn: (board: string) => `▶ Run on the ${board}`,
    exercise: '🎯 Exercise',
    exerciseHint: 'Change the code in the editor tab and press Run again. Your changes are saved in the browser.',
    learn: 'Lessons',
  },
};
