// English text for the lessons. Code and constraints are shared with the Persian version (lessons.ts).
import { truth } from './helpers';
import { TINY8_ISA } from './softcore';

export interface LessonText {
  title: string;
  summary: string;
  body: string;
  tryIt: string;
  exercise?: string;
}

export const EN: Record<string, LessonText> = {
  intro: {
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
<p>The simplest possible circuit: wire every switch straight to the LED above it. In Verilog <code>assign</code>, and in VHDL <code>&lt;=</code>, creates a permanent (combinational) connection.</p>
<h3>How this course is organised</h3>
<p>The chapters follow the order of Pong P. Chu's book <i>FPGA Prototyping by Verilog/VHDL Examples</i>: gates first, then RT-level combinational circuits, regular sequential circuits, state machines, FSMD, memory and I/O. The text and code here are written for this site; the book is a good companion for going deeper.</p>`,
    tryIt: `<p>Press <span class="kbd">▶ Run</span>, then click the switches at the bottom of the board. Each switch that is up (ON) lights the LED above it.</p>`,
    exercise: `<p>Change the code so the LED order is reversed (SW0 → LD15). Hint: in Verilog use <code>{SW[0], SW[1], ...}</code> or a loop.</p>`,
  },
  gates: {
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
  uart: {
    title: 'UART transmitter and the logic analyzer',
    summary: 'Send "Hello FPGA!" over the UART serial protocol, then watch and decode it with the logic analyzer.',
    body: `
<p><b>UART</b> is the simplest serial protocol, and the Nexys A7 has a serial port to the PC over the same USB cable. The <code>UART_RXD_OUT</code> pin (D4) runs from the FPGA to the USB-UART chip.</p>
<h3>An 8N1 frame</h3>
<ul>
  <li>The line idles at <b>1</b>.</li>
  <li><b>Start bit</b>: one 0 bit</li>
  <li><b>8 data bits</b>, least significant bit first</li>
  <li><b>Stop bit</b>: one 1 bit</li>
</ul>
<pre class="formula">115200 baud → one bit = 100,000,000 / 115200 ≈ 868 clocks ≈ 8.68 µs</pre>
<h3>The design</h3>
<p>The <code>uart_tx</code> module is an FSMD with four states, IDLE, START, DATA and STOP: a counter times each bit and a shift register sends the bits out one by one. The top module holds a small ROM with the message and sends the next character whenever the transmitter is free (<code>busy=0</code>).</p>
<h3>The logic analyzer</h3>
<p>On a real bench you would clip a <b>logic analyzer</b> (for example a USB instrument such as the Digital Discovery) onto the pins to see this signal. This site has a virtual one: press <span class="kbd">⎍ Logic Analyzer</span> in the toolbar.</p>
<ul>
  <li>Each <b>channel</b> is clipped to a pin: the Pmod headers (JA to JD), LEDs, switches, or even internal design signals (like an ILA in Vivado).</li>
  <li>The <b>trigger</b> lines the capture up with an edge on a channel; here, the falling edge of the start bit.</li>
  <li>The <b>UART decoder</b> turns the bits into bytes and characters. SPI and I²C decoders are available too.</li>
</ul>
<p class="note">💡 The logic analyzer is already set up for this lesson: channel TX on pin D4, a falling-edge trigger and a UART decoder at 115200 baud.</p>`,
    tryIt: `<p>Run the design and open the logic analyzer (the <span class="kbd">⎍ Logic Analyzer</span> button or Ctrl+L). Press <b>Run</b> in its window, then press BTNC on the board, or turn on SW0 to send the message over and over. You will see the TX waveform and the decoded bytes <b>H e l l o …</b>. Zoom with the mouse wheel, place two cursors with click and Shift+click, and measure one bit time (about 8.68 µs).</p>`,
    exercise: `<p>Change the speed to 9600 baud (what is <code>CLKS_PER_BIT</code> now?) and change the baud rate in the decoder settings too. What does the decoder show if you change only one of them?</p>`,
  },
  uart_rx: {
    title: 'UART receiver and the serial console',
    summary: 'Receive the characters you type in the serial console and send them back in upper case.',
    body: `
<p>In the previous lesson the FPGA only transmitted. Now we build the other direction: the PC sends bytes to the FPGA on the <code>UART_TXD_IN</code> pin (C4). For that we use a <b>serial console</b>, the kind of program that connects to the board's COM port on a PC (PuTTY or Tera Term, for example).</p>
<h3>The receiver</h3>
<ol>
  <li><b>Synchronise</b>: the input comes from outside and is not aligned with our clock, so it first passes through two flip-flops in a row (a synchronizer).</li>
  <li><b>IDLE</b>: wait for the falling edge of the start bit.</li>
  <li><b>START</b>: wait half a bit time (434 clocks) to reach the <b>middle</b> of the start bit. If the line is still 0, it is a real start.</li>
  <li><b>DATA</b>: take one sample every 868 clocks, exactly in the middle of each data bit.</li>
  <li><b>STOP</b>: in the middle of the stop bit the byte is complete and <code>done</code> is 1 for one clock.</li>
</ol>
<p>Sampling in the middle of each bit means a small speed difference between the two sides (up to about 2 to 3 percent) does no harm.</p>
<h3>Echo</h3>
<p>Every byte that arrives is sent back with the transmitter from the previous lesson, and lower-case letters become upper case (subtract 0x20). A holding register (<code>pend</code>) is needed because the next byte can arrive while the transmitter is still busy with the previous one.</p>
<p>LD7..LD0 show the last byte received and LD15..LD8 count the bytes.</p>`,
    tryIt: `<p>Run the design and open the <b>serial console</b> (the <span class="kbd">⌨ Serial Console</span> button or Ctrl+M). The speed should be 115200 and the format 8N1. Type some text and press Enter: the FPGA sends it back in upper case. You can also click the black console area and type directly, so each key is sent at once. The LEDs show the ASCII code of the last character and the character count. The logic analyzer is also set up for this lesson and decodes both lines.</p>`,
    exercise: `<p>Set the console to 9600 baud but leave the design at 115200. What comes back, and why? Then fix <code>CLKS_PER_BIT</code> for 9600.</p>`,
  },
  spi: {
    title: 'The SPI protocol',
    summary: 'An SPI master talking to an 8-bit shift register on Pmod JA, watched with the logic analyzer.',
    body: `
<p><b>SPI</b> (Serial Peripheral Interface) is a <b>synchronous</b> serial protocol: unlike UART, the clock travels on its own wire, so the two sides do not need to agree on a speed in advance. Many sensors, flash memories, ADCs/DACs and displays use SPI, and so do most Pmod modules.</p>
<h3>Four wires</h3>
${truth(
  ['Signal', 'Direction', 'Purpose', 'Pin'],
  [
    ['CS (active low)', 'master → slave', 'selects the device; the whole transfer happens while it is 0', 'JA1'],
    ['MOSI', 'master → slave', 'data from the master to the device', 'JA2'],
    ['MISO', 'slave → master', 'data from the device to the master', 'JA3'],
    ['SCLK', 'master → slave', 'the clock, 1 MHz here', 'JA4'],
  ],
)}
<h3>Mode 0</h3>
<p>In mode 0 (CPOL=0, CPHA=0) the clock idles low. Both sides sample on the <b>rising edge</b> of SCLK and put out the next bit on the falling edge. The most significant bit goes first.</p>
<p>A neat property of SPI is that every transfer is <b>two-way</b>: each clock sends one bit and brings one back. In this lesson the device is an 8-bit shift register, so each transfer returns the byte of the previous transfer (it starts out holding A5).</p>
<ul>
  <li>SW7..SW0: the byte to send; BTNC: send once; SW15: send continuously (every 100 µs)</li>
  <li>LD7..LD0: the byte the master received; LD15..LD8: the byte the device received</li>
</ul>`,
    tryIt: `<p>Run the design and open the logic analyzer: four channels on JA1 to JA4 and an SPI decoder are already set up, and the probe wires show on the 3D board. Press <b>Run</b> in the analyzer window, set a byte with SW7..SW0 and press BTNC. The MOSI row shows your byte and the MISO row shows the previous one. Measure the SCLK frequency with two cursors.</p>`,
    exercise: `<p>Lower <code>DIV</code> so SCLK reaches 10 MHz and look at it in the logic analyzer. Then implement mode 3 (CPOL=1) and change the decoder setting to match.</p>`,
  },
  i2c: {
    title: 'The I²C protocol',
    summary: 'Write and read back a register in a simulated sensor at address 0x48, on Pmod JB.',
    body: `
<p><b>I²C</b> has only <b>two wires</b>, and several devices share them, told apart by a 7-bit <b>address</b>. Temperature sensors, accelerometers, EEPROMs and real-time clocks usually speak I²C.</p>
<h3>Open drain</h3>
<p>Nobody drives the line to 1: each device can only pull it to 0 or let go, and a pull-up resistor brings it back to 1. So the line is the AND of all devices: <code>sda = !(m_low || d_low)</code>. That is how the master and the device can take turns on the same wire.</p>
<h3>An I²C frame</h3>
<ul>
  <li><b>START</b>: SDA falls while SCL is high. <b>STOP</b>: SDA rises while SCL is high. At all other times SDA changes only while SCL is low.</li>
  <li>First byte: the 7-bit address plus an R/W bit (0 = write, 1 = read)</li>
  <li>After every byte the receiver sends an <b>ACK</b> bit (0). If nobody answers, the line stays 1: a <b>NAK</b>.</li>
</ul>
<h3>This lesson</h3>
<p>The master runs a small program: <code>S, 0x48+W, 0x01, data, P, S, 0x48+R, read, P</code>. It writes the switch value into the device's register and then reads it back. SCL runs at the standard 100 kHz.</p>
<ul>
  <li>SW7..SW0: data; BTNC: one transaction; SW15: repeat every 1 ms; SW14: wrong address (0x49) to see a NAK</li>
  <li>LD7..LD0: the byte read from the device; LD15: the device did not answer</li>
</ul>`,
    tryIt: `<p>Run the design, open the logic analyzer and press <b>Run</b>. Set a number with SW7..SW0 and press BTNC: the I²C decoder shows start and stop, the address, the ACKs and the data, and the same number comes back on LD7..LD0. Now turn on SW14 and press BTNC again: this time no device answers, and you see a <b>NAK</b> and LD15 lights.</p>`,
    exercise: `<p>Connect a second device with address 0x49 to the same two wires (another <code>i2c_device</code> instance, OR its <code>sda_low</code> into the bus). SW14 should now select the second device.</p>`,
  },
  testbench: {
    title: 'Simulation with a testbench and waveforms',
    summary: 'Test the design with a testbench before it goes on the board, and watch its signals over time.',
    body: `
<p>So far every design went straight onto the board. In real projects a design is <b>simulated</b> before the FPGA is programmed. A second HDL program, the <b>testbench</b>, changes the inputs at chosen times and checks the outputs, and every signal can be inspected in a <b>waveform</b> view. In Vivado this is <b>Run Behavioral Simulation</b>, and it works the same way here.</p>
<h3>What a testbench contains</h3>
<ol>
  <li><b>A module with no ports</b>: the testbench is the top level and connects to no pins.</li>
  <li><b>Signals</b> for the inputs (<code>reg</code> in Verilog) and the outputs (<code>wire</code>).</li>
  <li><b>An instance of the design</b> (the DUT, Design Under Test) connected to those signals.</li>
  <li><b>A clock generator</b>: <code>always #5 clk = ~clk;</code>, or in VHDL <code>clk &lt;= not clk after 5 ns;</code></li>
  <li><b>Stimulus</b> in an <code>initial</code> block or a <code>process</code> without a sensitivity list: delays with <code>#100</code> or <code>wait for 100 ns</code>, and waiting for an edge with <code>@(posedge clk)</code> or <code>wait until rising_edge(clk)</code>.</li>
  <li><b>Checks</b>: <code>$display</code> and <code>$error</code> in Verilog, <code>report</code> and <code>assert</code> in VHDL. The messages appear in the Tcl Console.</li>
  <li><b>The end</b>: <code>$finish</code> or <code>std.env.finish</code>.</li>
</ol>
<div class="note">These statements exist only for simulation and are not synthesized. A <code>#10</code> or <code>wait</code> in the design itself is a synthesis error.</div>
<h3>A speed trick: shrink the parameters</h3>
<p>This lesson's counter steps every 0.5 s, which is every 50 million clocks. Simulating that many clocks takes a long time, so the divider is a <b>parameter</b> (<code>parameter DIV</code> or <code>generic DIV</code>) and the testbench sets it to 4 (<code>#(.DIV(4))</code> or <code>generic map (DIV =&gt; 4)</code>). On the board the default of 50 million is used.</p>
<h3>Using the waveform viewer</h3>
<ul>
  <li><b>Run for</b> advances the simulation by the given time, <b>Run All</b> continues until <code>$finish</code>, and <b>Restart</b> goes back to time zero (the same as <code>run 1us</code>, <code>run all</code> and <code>restart</code> in the Tcl Console).</li>
  <li>Zoom with the mouse wheel, drag to pan, and press <b>Fit</b> to see the whole run.</li>
  <li>Click in the waveform to place the yellow <b>cursor</b>. The Value column shows every signal's value at that moment.</li>
  <li>Right-click a signal name to change its radix: binary, hex, decimal or ASCII.</li>
  <li>Click <code>dut</code> under <b>Scope</b> to add the design's internal signals, such as <code>prescaler</code> and <code>count</code>.</li>
</ul>
<p>Every other lesson also gets a ready-made testbench in the <code>tb.v</code> / <code>tb.vhd</code> tab. It is generated from the design's ports, and you can edit it.</p>`,
    tryIt: `<p>Press <span class="kbd">∿ Simulate</span>. The Tcl Console prints <code>PASS</code> and the waveform opens on the right with the clock, reset, SW and LED. Press <b>Fit</b> and watch LED step once every 4 clocks. Then change <code>10</code> to <code>11</code> in the testbench tab and simulate again to see the error message.</p>
<p>It works on the board too: press <span class="kbd">▶ Run</span> and turn on SW0. The LEDs count up every half second.</p>`,
    exercise: `<p>Assert the reset again in the middle of the testbench (<code>CPU_RESETN = 0</code>) and check that the counter returns to zero. Then add a check that the counter stays put for 100 clocks while SW0 is off.</p>`,
  },
  playground: {
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
  decoder: {
    title: 'Decoder and priority encoder',
    summary: 'A 3-to-8 decoder with enable and an 8-to-3 priority encoder.',
    body: `
<p>The previous chapter worked with single gates. From here on we work at the <b>RT level</b> (register transfer): we think in bigger blocks such as decoders, comparators, shifters and ALUs, and the synthesis tool turns them into LUTs.</p>
<h3>Decoder</h3>
<p>An n-to-2<sup>n</sup> decoder takes a binary number and activates <b>exactly one</b> of its outputs. Its main use is selecting one of several things, such as one display digit or one memory word. When the <b>enable</b> input is 0, every output is off.</p>
<ul>
  <li>Input <code>SW[2:0]</code>, enable <code>SW[3]</code>, outputs <code>LED[7:0]</code></li>
  <li>In Verilog it is a single shift: <code>8'b1 &lt;&lt; SW[2:0]</code></li>
</ul>
<h3>Priority encoder</h3>
<p>The opposite of a decoder: it has several request inputs and returns the <b>number of the most important</b> active request. Here <code>SW15</code> has the highest priority.</p>
${truth(
  ['SW[15:8]', 'LED[14:12]', 'LED15 (valid)'],
  [
    ['1xxxxxxx', '111', 1],
    ['01xxxxxx', '110', 1],
    ['001xxxxx', '101', 1],
    ['...', '...', 1],
    ['00000001', '000', 1],
    ['00000000', '000', 0],
  ],
)}
<ul>
  <li>Verilog: <code>casez</code>, where <code>?</code> means "don't care".</li>
  <li>VHDL: the conditional assignment <code>when ... else</code>. Conditions are tested in order, so the first true one wins, which is exactly a priority.</li>
</ul>
<p class="note">💡 The <b>valid</b> output is needed because "no request" and "only SW8" both produce code 000.</p>`,
    tryIt: `<p>Turn on SW3 and set a number with SW2..SW0: exactly one of LD7..LD0 lights. Now turn on a few of SW15..SW8: LD14..LD12 show the number of the highest switch that is on, and LD15 says there is a request.</p>`,
    exercise: `<p>Build a 2-to-4 decoder that selects the display digits AN3..AN0. Remember that AN is active-low.</p>`,
  },
  shifter: {
    title: 'Barrel shifter',
    summary: 'Rotate 8 bits left or right by 0 to 7 places in a single clock.',
    body: `
<p>A barrel shifter rotates a word by any amount in <b>one combinational step</b>: bits that fall off one end come back in at the other.</p>
<h3>A staged structure</h3>
<p>Instead of one big 8-input mux per bit, the shift amount is applied one bit at a time:</p>
<ol>
  <li>if <code>amt[0]=1</code>: rotate by 1</li>
  <li>if <code>amt[1]=1</code>: rotate by 2</li>
  <li>if <code>amt[2]=1</code>: rotate by 4</li>
</ol>
<p>Each stage is only a 2-to-1 mux per bit, so n bits need log<sub>2</sub>(n) stages. This is an important example of <b>structure-driven design</b> at the RT level.</p>
<h3>Rotating left</h3>
<p>Rotating left by k is the same as rotating right by <code>8 − k</code>. So we just negate the amount (<code>0 − amt</code> in 3 bits) and reuse the same circuit.</p>
<ul>
  <li>Data: <code>SW[7:0]</code> (also shown on LD15..LD8)</li>
  <li>Amount: <code>SW[10:8]</code>, direction: <code>SW15</code> (1 = left)</li>
  <li>Result: <code>LED[7:0]</code></li>
</ul>`,
    tryIt: `<p>Turn on only SW0 and change SW10..SW8: the lit LED rotates right and wraps around. Turn on SW15 to change direction.</p>`,
    exercise: `<p>Add a third control input (for example SW14) that chooses between rotate and logical shift (filling with zeros).</p>`,
  },
  alu: {
    title: 'A simple 4-bit ALU',
    summary: 'An arithmetic logic unit with eight operations and a zero flag.',
    body: `
<p>The <b>ALU</b> (Arithmetic Logic Unit) is the heart of every processor: it takes two operands and an opcode and returns a result. In hardware every operation is built in parallel and a large mux picks one.</p>
${truth(
  ['op = SW[15:13]', 'Operation', 'Result'],
  [
    ['000', 'ADD', 'A + B (bit 4 = carry)'],
    ['001', 'SUB', 'A − B (bit 4 = borrow)'],
    ['010', 'AND', 'A &amp; B'],
    ['011', 'OR', 'A | B'],
    ['100', 'XOR', 'A ^ B'],
    ['101', 'NOT', '~A'],
    ['110', 'SLT', '1 if A &lt; B'],
    ['111', 'SHL', 'A &lt;&lt; 1'],
  ],
)}
<ul>
  <li><code>A = SW[3:0]</code> and <code>B = SW[7:4]</code></li>
  <li>The 5-bit result is on <code>LED[4:0]</code>; the fifth bit is the carry or borrow.</li>
  <li>The <b>zero flag</b> on <code>LD15</code> lights when the low four result bits are zero. Processors use this flag for conditional branches.</li>
</ul>
<p class="note">💡 In Verilog an expression takes its width from the left side of the assignment: because <code>r</code> is 5 bits, <code>a + b</code> is computed in 5 bits and the carry is kept. In VHDL we widen the operands ourselves with <code>resize</code>.</p>`,
    tryIt: `<p>Set A with SW3..SW0 and B with SW7..SW4, and pick the operation with SW15..SW13. For example make A equal B and choose SUB: the result is zero and LD15 lights.</p>`,
    exercise: `<p>Show the result on the seven-segment display instead of the LEDs (reuse the decoder from lesson 5).</p>`,
  },
  shiftreg: {
    title: 'Shift register and LFSR',
    summary: 'A serial-to-parallel shift register and a pseudo-random number generator.',
    body: `
<p>A <b>regular sequential circuit</b> is one whose next state follows a simple, repetitive pattern: registers, counters and <b>shift registers</b>.</p>
<h3>Shift register</h3>
<p>On every tick all bits move one place and a new bit enters from the serial input: <code>sr &lt;= {sr[6:0], SW[0]}</code>. This is how serial links such as UART and SPI turn a serial stream into parallel data.</p>
<h3>LFSR</h3>
<p>A <b>Linear Feedback Shift Register</b> is a shift register whose input bit is the XOR of some of its own bits. With the right taps an 8-bit LFSR walks through all 255 non-zero states before repeating. Uses include pseudo-random numbers, test patterns and scramblers.</p>
<pre class="formula">feedback = q7 ⊕ q5 ⊕ q4 ⊕ q3   (x⁸ + x⁶ + x⁵ + x⁴ + 1)</pre>
<p>To see the motion, we make a <b>tick</b> four times a second (every 25 million clocks), as in the counter lesson. The registers only change when <code>tick=1</code>; this is a <b>clock enable</b>, so everything still runs on one clock.</p>
<p class="note">⚠️ An LFSR must never become zero, because it would stay there. That is why its initial and reset value is 01.</p>`,
    tryIt: `<p>LD7..LD0 show the LFSR's pseudo-random pattern. Toggle SW0 a few times and watch the bits march left on LD15..LD8. The red button returns everything to the start.</p>`,
    exercise: `<p>Change the taps (for example only <code>q7 ⊕ q6</code>) and count in simulation after how many steps the pattern repeats. Why is it less than 255?</p>`,
  },
  stopwatch: {
    title: 'BCD stopwatch',
    summary: 'A 00.0 to 99.9 second stopwatch built from cascaded decimal counters.',
    body: `
<p>This lesson puts three ideas from the chapter together: an accurate <b>tick</b>, <b>cascaded BCD counters</b> and a <b>multiplexed display</b>.</p>
<h3>A 0.1 second tick</h3>
<pre class="formula">0.1 s × 100,000,000 Hz = 10,000,000 clocks</pre>
<h3>BCD counters</h3>
<p>In BCD each decimal digit is kept separately in 4 bits (0 to 9). When a digit passes 9 it goes back to 0 and increments the next digit, just like a car's odometer:</p>
<ul>
  <li><code>d0</code>: tenths, <code>d1</code>: seconds, <code>d2</code>: tens of seconds</li>
  <li>The decimal point (DP) is lit on digit <code>d1</code>: <b>12.3</b></li>
</ul>
<p>The benefit of BCD is that each digit goes straight to a seven-segment decoder, with no division by 10.</p>
<h3>Controls</h3>
<ul>
  <li><code>SW0</code> = run/stop (go)</li>
  <li><code>BTNU</code> = clear</li>
</ul>`,
    tryIt: `<p>Turn SW0 on to start the stopwatch and off to stop it. BTNU clears it. Keep the speed at <b>Real-time</b> so it matches a real clock.</p>`,
    exercise: `<p>Add a minutes digit (on AN3) so the stopwatch counts to 9:59.9. The tens-of-seconds digit must now wrap at 5.</p>`,
  },
  debounce: {
    title: 'Button debouncing',
    summary: 'A state machine that filters mechanical switch bounce, plus an edge detector.',
    body: `
<p>A button's metal contacts <b>bounce</b> for a few milliseconds when pressed or released, so instead of one clean change the signal jumps between 0 and 1 dozens of times. A person never notices, but a circuit running at 100 MHz sees every bounce as a separate press.</p>
<h3>The debounce FSM</h3>
<p>We accept the input only after it has stayed <b>stable for 10 ms</b>:</p>
${truth(
  ['State', 'db output', 'Next state'],
  [
    ['ZERO', 0, 'input goes 1 → WAIT1'],
    ['WAIT1', 0, 'stays 1 for 10 ms → ONE; goes 0 → ZERO'],
    ['ONE', 1, 'input goes 0 → WAIT0'],
    ['WAIT0', 1, 'stays 0 for 10 ms → ZERO; goes 1 → ONE'],
  ],
)}
<pre class="formula">10 ms × 100 MHz = 1,000,000 clocks  (a 20-bit counter)</pre>
<h3>Edge detector</h3>
<p>To count presses we need the <b>moment</b> the button goes down, not how long it is held. We keep last clock's value in a flip-flop: <code>tick = level &amp; ~prev</code>. The output is 1 for exactly one clock.</p>
<h3>The experiment</h3>
<p>There are two counters: one counts edges of the <b>raw</b> BTNC input (LD7..LD0), the other counts edges of the <b>debounced</b> signal (LD15..LD8). BTNU clears both.</p>
<p class="note">💡 The simulator's buttons are clean by default. Turn on <b>Bouncy buttons</b> in the toolbar to make them bounce like a real button.</p>`,
    tryIt: `<p>First turn on <b>Bouncy buttons</b> in the toolbar. Then press BTNC a few times: LD15..LD8 (debounced) count every press exactly once, but LD7..LD0 (raw) jump by several on each press. BTNU clears both.</p>`,
    exercise: `<p>Add the debouncer to the register (flip-flop) lesson so that each press of BTNU shifts the register by exactly one bit.</p>`,
  },
  bin2bcd: {
    title: 'FSMD: binary to BCD',
    summary: 'The double-dabble algorithm as a datapath driven by a state machine.',
    body: `
<p>An <b>FSMD</b> (FSM with datapath) is how an <b>algorithm</b> becomes hardware: a <b>datapath</b> (registers and arithmetic units) does the work and a <b>state machine</b> steps it along. Most accelerators and processors have this shape.</p>
<h3>The problem</h3>
<p>Show the 13-bit number <code>SW[12:0]</code> (0 to 8191) in decimal on 4 digits. Dividing by 10 is expensive in hardware, so we use the <b>double dabble</b> algorithm (shift and add 3) instead.</p>
<h3>The algorithm</h3>
<ol>
  <li>Clear the BCD register.</li>
  <li>Repeat 13 times: add <b>3</b> to every BCD digit that is <b>5 or more</b>, then shift the BCD and binary registers left together by one bit.</li>
</ol>
<p>Why 3? A digit of 5 or more passes 9 after the shift (a multiply by 2). Adding 3 before the shift means adding 6 after it, and 6 is exactly the gap between decimal 10 and binary 16.</p>
${truth(
  ['State', 'Action'],
  [
    ['IDLE', 'wait for start; load the number and clear BCD'],
    ['OP', 'one adjust-and-shift step per clock, 13 times'],
    ['DONE', 'store the result in the output register, back to IDLE'],
  ],
)}
<p>The <code>start</code> input is tied to 1, so the conversion repeats continuously (once every 15 clocks) and the result is always fresh.</p>`,
    tryIt: `<p>Build a binary number with SW12..SW0 (the LEDs show it). The display shows its decimal value; for example all 13 switches on gives <b>8191</b>.</p>`,
    exercise: `<p>Change the controller so a conversion starts only when BTNC is pressed, and LD15 is lit while <code>ready=1</code>.</p>`,
  },
  ram: {
    title: 'Synchronous RAM',
    summary: 'A 16 × 8 RAM: write with a button, read synchronously.',
    body: `
<p>Besides flip-flops, an FPGA has ready-made memory blocks: <b>block RAM</b> (36 Kbit per block on Artix-7) and <b>distributed RAM</b> (built from LUTs). You don't have to instantiate them by hand: describe the memory with a standard template and Vivado recognises it (<b>inference</b>).</p>
<h3>The synchronous RAM template</h3>
<ul>
  <li>Verilog: an array <code>reg [7:0] mem [0:15]</code></li>
  <li>VHDL: an array type <code>type ram_t is array (0 to 15) of std_logic_vector(7 downto 0)</code></li>
  <li>Write only on the clock edge and only when <code>we=1</code>.</li>
  <li>Read on the clock edge too: data is ready one clock after the address. Block RAM only supports synchronous reads.</li>
</ul>
<h3>Board connections</h3>
${truth(
  ['Signal', 'Connected to'],
  [
    ['addr', 'SW[11:8] (also shown on LD11..LD8)'],
    ['din', 'SW[7:0]'],
    ['we', 'BTNC'],
    ['dout', 'LED[7:0]'],
  ],
)}
<p class="note">💡 Check the Utilization report to see which resource the memory uses. For larger memories (for example 1024 × 8) Vivado uses BRAM.</p>`,
    tryIt: `<p>Pick an address with SW11..SW8, set data with SW7..SW0 and press BTNC. Change the address and come back: the stored data reappears on LD7..LD0, even if you changed SW7..SW0.</p>`,
    exercise: `<p>Build a ROM holding the message "HELLO" and use a counter to show the letters one by one on the display.</p>`,
  },
  pwm: {
    title: 'PWM: dimming an LED',
    summary: 'Pulse-width modulation with a parameterised module, mixing colours on the RGB LED.',
    body: `
<p>A digital output is only 0 or 1, so how do we dim an LED? With <b>PWM</b> (pulse-width modulation): switch the output on and off very fast, and the fraction of time it is on (the <b>duty cycle</b>) sets the brightness. The same method drives motors, servos and sound.</p>
<h3>The circuit</h3>
<p>A free-running W-bit counter counts, and the output is 1 while the counter is below <code>duty</code>:</p>
<pre class="formula">pwm = (cnt &lt; duty)      duty cycle = duty / 2^W</pre>
<p>With W=8 and a 100 MHz clock the PWM frequency is about <b>390 kHz</b>; the eye only sees the average.</p>
<h3>A parameterised module</h3>
<p>The counter width is a <code>parameter</code> in Verilog and a <code>generic</code> in VHDL, so the module can be reused at different resolutions.</p>
<ul>
  <li><code>SW[7:0]</code> → brightness of LD16's red and of LD0</li>
  <li><code>SW[15:8]</code> → brightness of LD16's green and of LD1</li>
</ul>
<p>Mixing red and green in different ratios makes orange and yellow.</p>`,
    tryIt: `<p>Turn on SW7 (duty = 128, i.e. 50%) and then try SW0 to SW6: LD0 and LD16's red glow at different strengths. Add green with SW15..SW8 to make orange or yellow.</p>`,
    exercise: `<p>Build a "breathing LED": a slow counter raises the duty value gradually and then lowers it again.</p>`,
  },
  sensors: {
    title: 'The on-board temperature sensor (ADT7420) and modules',
    summary: 'Read the temperature from the on-board I²C sensor through tri-state (open-drain) pins and show it on the display; meet the Modules panel.',
    body: `
<p>The Nexys A7 has two sensors: the <b>ADT7420</b> temperature sensor, which talks <b>I²C</b>, and the <b>ADXL362</b> accelerometer, which talks <b>SPI</b>. Both are listed in the <span class="kbd">🧩 Modules</span> panel next to the board, where sliders change the temperature or the acceleration. In the same panel, <b>Add Module</b> connects other modules to the Pmod headers, such as an HC-SR04 distance sensor, buttons, LEDs, a rotary encoder or a servo, and you choose which pin each of their lines is wired to.</p>
<h3>Open-drain pins and the value 'z'</h3>
<p>In I²C both sides talk on the same wire. Nobody drives it to 1: anyone may pull it to 0, or <b>let go</b> so a pull-up resistor makes it 1. To let go, the output takes the third state, <b>high impedance</b> (<code>z</code>). That is why the ports are <code>inout</code>:</p>
<pre class="formula" dir="ltr">assign TMP_SDA = sda_low ? 1'b0 : 1'bz;     // Verilog
TMP_SDA <= '0' when sda_low = '1' else 'Z';  -- VHDL</pre>
<p>When the design <b>reads</b> <code>TMP_SDA</code> it sees the real level on the wire. If the sensor pulls it low (for an ACK, say), it reads 0 even though the FPGA itself let go.</p>
<h3>Reading the temperature</h3>
<p>The sensor's address is <code>0x4B</code>. After power-up its register pointer is 0x00, so a plain read is enough: <b>START</b>, the address with the read bit (<code>0x97</code>), the first byte with ACK, the second with NACK, and <b>STOP</b>. Together the two bytes form a 16-bit number whose bits 15 to 3 hold the temperature as a signed number in 1/16 degree steps. For example 24.5 degrees is <code>392 = 0x188</code>, i.e. the register <code>0x0C40</code>.</p>
<p>This lesson's design reads the temperature every 0.25 s and shows it on the display (for example <b>24.5</b>). The raw value is on the LEDs, and LD15 lights up if the sensor does not answer.</p>`,
    tryIt: `<p>Press <span class="kbd">▶ Run</span>, then open <span class="kbd">🧩 Modules</span> in the corner of the board. Move the ADT7420 temperature slider; a moment later the display follows. Try below zero too.</p>
<p>In the logic analyzer, look at <code>TMP_SCL</code> (C14) and <code>TMP_SDA</code> (C15) with the I²C decoder: <b>S 0x4B R A 0x0C A 0x40 N P</b>.</p>`,
  },
  vga: {
    title: 'VGA video on a monitor',
    summary: 'Build the VGA sync signals from two counters and draw colour bars on a 640×480 monitor.',
    body: `
<p>The blue VGA connector sends five signals to a monitor: three colour signals (<code>VGA_R</code>, <code>VGA_G</code> and <code>VGA_B</code>, 4 bits each, so 4096 colours) and two sync signals: <b>HS</b> (horizontal) and <b>VS</b> (vertical). The monitor draws the picture like a pen, line by line from left to right. The FPGA must send the colour of every point (pixel) at the exact moment the pen reaches it. There is no picture memory; the colour is computed on the spot.</p>
<h3>640×480 at 60 Hz timing</h3>
<p>The pixel clock is about <b>25 MHz</b>. We get it from 100 MHz with an enable pulse every 4 clocks. Every line lasts 800 pixels and every frame 525 lines:</p>
<table class="truth"><tr><th></th><th>Visible</th><th>Front porch</th><th>Sync pulse</th><th>Back porch</th><th>Total</th></tr>
<tr><td>Horizontal (pixels)</td><td>640</td><td>16</td><td>96</td><td>48</td><td>800</td></tr>
<tr><td>Vertical (lines)</td><td>480</td><td>10</td><td>2</td><td>33</td><td>525</td></tr></table>
<p>So a line takes 32 µs and a frame 16.8 ms (60 frames per second). In this mode the sync pulses are <b>active-low</b>. During the porches and the sync pulses the colour must be black (zero), because the monitor measures the black level then.</p>
<h3>Two counters</h3>
<ul>
  <li><code>x</code> goes up by one every pixel and wraps from 799 to 0.</li>
  <li><code>y</code> goes up by one at the end of every line and wraps from 524 to 0.</li>
  <li><code>hsync</code> is 0 while <code>656 ≤ x &lt; 752</code>, and <code>vsync</code> is 0 while <code>490 ≤ y &lt; 492</code>.</li>
  <li><code>active</code> means <code>x &lt; 640</code> and <code>y &lt; 480</code>. There the colour of pixel <code>(x, y)</code> is sent.</li>
</ul>
<p>After that, drawing is only a combinational circuit that turns <code>x</code> and <code>y</code> into a colour. This lesson draws eight 80-pixel colour bars, and SW0 shows a checkerboard (<code>x[5] ^ y[5]</code> changes every 32 pixels).</p>
<div class="note">The virtual monitor works like a real one: it finds the video mode from the spacing of the HS and VS pulses. If the timing is wrong it shows <b>No signal</b> or <b>Out of range</b>, and wrong porches shift the picture.</div>`,
    tryIt: `<p>Press <span class="kbd">▶ Run</span>. A monitor with a VGA cable appears next to the board and shows the colour bars. For a bigger picture press <span class="kbd">🖥 VGA Monitor</span> in the toolbar. Turn on SW0 to see the checkerboard. One whole frame is about 1.7 million clocks, so on a slow browser you see the picture being drawn line by line.</p>
<p>You can also look at the HS pulses in the logic analyzer and measure their spacing (it should be 32 µs).</p>`,
  },
  ps2: {
    title: 'The PS/2 keyboard',
    summary: 'Receive keyboard scan codes over the PS/2 interface and show them on the display.',
    body: `
<p>The Nexys A7 has a <b>USB HID</b> port. The microcontroller next to it translates a USB keyboard into the old and simple <b>PS/2</b> protocol and hands it to the FPGA on two wires: <code>PS2_CLK</code> (F4) and <code>PS2_DATA</code> (B2). In this simulator the keyboard lives in the <span class="kbd">🧩 Modules</span> panel: click its keys, or turn on “type on my own keyboard”.</p>
<h3>The PS/2 frame</h3>
<p>Unlike UART, the keyboard makes the clock itself (about 12.5 kHz). Every byte is 11 bits, and the FPGA reads each bit on the <b>falling edge of the clock</b>:</p>
<table class="truth"><tr><th>Bit</th><th>0</th><th>1 to 8</th><th>9</th><th>10</th></tr>
<tr><td>Meaning</td><td>start (0)</td><td>data, LSB first</td><td>odd parity</td><td>stop (1)</td></tr></table>
<p>“Odd parity” means the number of ones in the eight data bits and the parity bit together is odd. Both lines are <b>open-drain</b>: when nobody pulls them low, a pull-up resistor keeps them at 1.</p>
<h3>Scan codes</h3>
<p>The keyboard does not send letters; it sends the number of the key. Pressing a key sends its <b>make code</b> (for example A = <code>1C</code> and 1 = <code>16</code>). Releasing it sends <code>F0</code> and then the same code. “Extended” keys such as the arrows have an <code>E0</code> before the code. Turning codes into letters is your design's job.</p>
<h3>The receiver</h3>
<ul>
  <li>The keyboard clock is far slower than the FPGA clock, so we <b>synchronise</b> and <b>filter</b> it: a new level is accepted only after 8 equal samples in a row.</li>
  <li>On every falling edge the data bit enters an 11-bit shift register from the top, because the bits arrive LSB first.</li>
  <li>After the eleventh bit, bits 8 to 1 are the code. Start, parity and stop are checked and a <code>done</code> pulse is made.</li>
  <li>If no edge comes for 1.3 ms, the bit counter goes back to zero, so a half-finished frame cannot spoil the next ones.</li>
</ul>
<p>This lesson's design shows the last two bytes on four digits of the display (after releasing A, for example: <b>F0 1C</b>). The last code is on LD7..LD0, LD14 is on while a key is held down, and LD15 shows a frame error.</p>`,
    tryIt: `<p>Press <span class="kbd">▶ Run</span> and open <span class="kbd">🧩 Modules</span>. Click the keys of the USB keyboard. While you hold a key the display shows its make code, and after you let go it shows <b>F0</b> and the same code. Try the arrow keys too to see <b>E0</b>.</p>
<p>In the logic analyzer, <code>PS2_CLK</code> and <code>PS2_DATA</code> are ready with the PS/2 decoder. The trigger is on the falling edge of the clock: press a key and see the frames with the key names.</p>`,
  },
  softcore: {
    title: 'A soft-core processor: Tiny8',
    summary: 'Build a small 8-bit processor inside the FPGA and run the program written in its ROM.',
    body: `
<p>So far we built a separate circuit for every job. Another way is to build a <b>processor</b> inside the FPGA and tell it the job with a <b>program</b>. A processor made of FPGA logic is called a <b>soft core</b>. Xilinx has the MicroBlaze and PicoBlaze processors. Here we build a small, simple processor called <b>Tiny8</b> that fits on one page.</p>
<h3>Inside Tiny8</h3>
<ul>
  <li><b>Program ROM</b>: 64 instructions of 12 bits. Each one is a 4-bit operation code (opcode) and an 8-bit number <code>k</code>.</li>
  <li><b>PC</b> (program counter): the address of the next instruction.</li>
  <li><b>A</b> (accumulator): the only register for arithmetic. Next to it are the <b>Z</b> flag (the result was zero) and the <b>C</b> flag (carry or borrow).</li>
  <li><b>Data RAM</b>: 16 bytes for variables.</li>
  <li><b>Input/output</b>: <code>IN</code> reads the switches and <code>OUT</code> writes to the LEDs or the display.</li>
</ul>
<h3>Fetch and execute</h3>
<p>The processor is a two-state FSM. In the <b>fetch</b> state the instruction <code>rom[pc]</code> is stored in the instruction register (<code>ir</code>) and the PC moves one step on. In the <b>execute</b> state the instruction runs; a jump only changes the PC. So every instruction takes two clocks, and at 100 MHz Tiny8 runs 50 million instructions per second.</p>
<h3>The instruction set</h3>
${TINY8_ISA('en')}
<h3>The program</h3>
<p>The program is written in the <code>case</code> inside the ROM. This lesson's program adds the value of switches SW7..SW0 to a variable on every tick and shows it on the LEDs and the display:</p>
<pre class="formula" dir="ltr">0: LDI 0      ; A = 0
1: ST  0      ; x = 0          (ram[0])
2: IN  0      ; loop: A = SW[7:0]
3: OUT 1      ; LD15..LD8 = step
4: ST  1      ; step = A       (ram[1])
5: LD  0
6: ADD 1      ; A = x + step
7: ST  0
8: OUT 0      ; LD7..LD0 = x
9: OUT 2      ; display = x
10: WAIT      ; 0.25 s
11: JMP 2</pre>
<p>To give the processor a new job you do not change the circuit, only the program in the ROM. Real processors work the same way: the hardware stays fixed and the software changes.</p>
<div class="note">In real Vivado, the program for big processors such as MicroBlaze is written in C, compiled and placed in BRAM. The idea is the same as here.</div>`,
    tryIt: `<p>Press <span class="kbd">▶ Run</span> and turn on SW0: every 0.25 s the number on the LEDs and the display goes up by one. Change the step with SW7..SW0. <span class="kbd">CPU_RESET</span> starts the program again from the top.</p>
<p>In the schematic (RTL Analysis → Schematic), choose the <code>cpu</code> instance to see the processor's datapath: the PC register, the instruction register, the accumulator and the RAM.</p>`,
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
    exerciseHint: 'کد را در تب ویرایشگر تغییر دهید و «بررسی راه‌حل من» را بزنید. بررسی‌کننده طرح شما را روی یک برد مجازی آزمایش می‌کند (کلیدها و دکمه‌ها را تغییر می‌دهد و LEDها، نمایشگر و پایه‌ها را می‌خواند). تغییرات شما در مرورگر ذخیره می‌شود.',
    exerciseHintTb: 'Testbench را در تب Testbench تغییر دهید و «بررسی راه‌حل من» را بزنید.',
    check: '✓ بررسی راه‌حل من',
    checking: 'در حال بررسی روی برد مجازی…',
    passed: 'آفرین! تمرین حل شد.',
    failed: 'هنوز کامل نیست. این موارد را ببینید:',
    solved: 'حل شده',
    progress: (n: number, total: number) => `${n} از ${total} تمرین حل شده`,
    learn: 'آموزش',
    chapter: (n: number) => `فصل ${n}`,
    soon: 'به‌زودی',
    bouncy: 'لرزش دکمه‌ها',
    simulate: '∿ شبیه‌سازی با Testbench',
  },
  en: {
    explain: '📖 Explanation',
    code: '💻 Code',
    openEditor: 'Open in editor ✎',
    tryIt: '🔌 Try it on the board',
    runOn: (board: string) => `▶ Run on the ${board}`,
    exercise: '🎯 Exercise',
    exerciseHint: 'Change the code in the editor tab and press “Check my solution”. The checker tests your design on a virtual board (it flips switches and buttons and reads the LEDs, the display and the pins). Your changes are saved in the browser.',
    exerciseHintTb: 'Change the testbench in the Testbench tab and press “Check my solution”.',
    check: '✓ Check my solution',
    checking: 'Checking on a virtual board…',
    passed: 'Well done! The exercise is solved.',
    failed: 'Not there yet. Look at these:',
    solved: 'solved',
    progress: (n: number, total: number) => `${n} of ${total} exercises solved`,
    learn: 'Lessons',
    chapter: (n: number) => `Chapter ${n}`,
    soon: 'coming soon',
    bouncy: 'Bouncy buttons',
    simulate: '∿ Simulate with the testbench',
  },
};
