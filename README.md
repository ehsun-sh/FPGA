# FPGA Lab — learn FPGA on a 3D Nexys A7-100T

A browser-based FPGA course with a Vivado-inspired workflow. Write Verilog or VHDL on the left, press **▶ Run on Board**,
and watch it run on an interactive 3D Digilent Nexys A7-100T on the right.

آموزش گام‌به‌گام FPGA به زبان فارسی: کد را سمت چپ بنویسید و نتیجه را روی برد سه‌بعدی Nexys A7 سمت راست ببینید.

## Features

- **Two-pane workspace**: code editor (CodeMirror, Verilog / VHDL / XDC) and a Three.js model of the Nexys A7-100T with
  clickable switches and buttons, glowing LEDs, RGB LEDs and 8-digit seven-segment display.
- **Vivado-style flow**: Flow Navigator, Synthesis → Implementation → Bitstream → Program Device, Tcl console,
  Messages with clickable file:line, utilization and I/O placement reports, XDC constraints based on Digilent's master file.
- **In-browser HDL simulator**: Verilog-2001 and VHDL subsets are parsed, elaborated (hierarchy, parameters/generics,
  enums) and compiled to JavaScript. Single-clock designs run at close to the real 100 MHz clock, so counters and
  multiplexed displays behave like on hardware. Clock can be slowed to 1 Hz to watch every step.
- **Behavioral simulation** (Flow → Run Behavioral Simulation, Shift+F6), like Vivado's simulator: each lesson has a
  testbench tab (`tb.v` / `tb.vhd`), written for the lesson or generated from the design's ports. Testbenches can use
  `#` delays, `@(posedge clk)`, `wait`, `forever` / `repeat`, `$display` / `$monitor` / `$error` / `$finish` and
  `` `timescale `` in Verilog, and `wait for` / `wait until` / `wait on`, `after`, `report` / `assert` and
  `std.env.finish` in VHDL. An event-driven scheduler runs them, and the waveform viewer shows every signal. It has a
  scope and object browser, run for / run all / restart, zoom, pan, a cursor and a radix per signal.
- **Logic analyzer** (Tools → Logic Analyzer, Ctrl+L): a virtual USB logic analyzer window with up to 32 channels
  sampled every board clock. Probes clip onto Pmod JA–JD pins (drawn as flywires on the 3D board), any on-board
  device pin, or internal design signals. Single / Run / Stop acquisition, edge trigger, time base and position,
  wheel zoom and drag pan, two measurement cursors, and UART, SPI, I²C and parallel-bus decoders with an event list.
- **Serial console** (Tools → Serial Console, Ctrl+M): the PC end of the board's USB-UART. It decodes what the design
  sends on `UART_RXD_OUT` and types bytes into `UART_TXD_IN` with bit-accurate timing. Selectable baud rate and
  format (8N1, 8E1, 8O1, 8N2, 7E1), text or hex view, line ending, local echo, or typing straight into the terminal.
- **Lessons in Persian and English**, each with theory, Verilog and VHDL code, a “try it on the board” step and an
  exercise. The chapter order follows Pong P. Chu, *FPGA Prototyping by Verilog/VHDL Examples* (structure only; the
  text and code are original):
  1. Basics: what is an FPGA, logic gates, multiplexers, adders and hierarchy, seven-segment decoder
  2. RT-level combinational: decoder and priority encoder, barrel shifter, 4-bit ALU
  3. Regular sequential: flip-flops, counters, simulation with a testbench and waveforms, shift register and LFSR, multiplexed display, BCD stopwatch
  4. FSM: traffic light, button debouncing (with an optional contact-bounce simulation)
  5. FSMD: binary to BCD (double dabble)
  6. Memory: synchronous RAM
  7. I/O: PWM, UART transmitter with the logic analyzer, UART receiver with the serial console, SPI master and slave, I²C write and read back (PS/2, VGA and a soft-core processor are planned)
  8. Playground

Real Vivado cannot run in a browser; this project imitates its look and workflow. The lesson code and XDC files are
standard and also work in real Vivado on a real board.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # simulator + every lesson in both languages
npm run build    # static site in dist/
```

## Layout

| Path | What |
| --- | --- |
| `src/hdl/` | lexer, Verilog and VHDL parsers, elaboration, compiler to a JS cycle simulator |
| `src/boards/` | board plug-ins (`types.ts` interface, `index.ts` registry), XDC parser / port mapping |
| `src/boards/nexys-a7/` | Nexys A7-100T: pin table, master XDC, Three.js model |
| `src/sim/runner.ts` | real-time driver: clocking, inputs, LED/segment brightness (persistence of vision) |
| `src/sim/tbsim.ts`, `src/sim/tbgen.ts` | behavioral simulation of testbenches (event scheduler, messages) and testbench generator |
| `src/wave/` | waveform viewer |
| `src/la/` | logic analyzer: `capture.ts` (recording, trigger), `decode.ts` (protocol decoders), `window.ts` (UI) |
| `src/serial/` | serial console: live UART decoder and terminal window |
| `src/lessons/` | course content: `course.ts` (chapters), `lessons.ts` and `advanced.ts` (Persian text + code), `en.ts` (English) |
| `src/main.ts`, `src/ui/` | Vivado-style UI |

## Adding a board

Boards are plug-ins. To add one, create `src/boards/<id>/` with:

1. `pins.ts`: package pin → device (`sw`, `led`, `rgb`, `seg`, `an`, `btn`, `reset`, `clk`), the conventional port
   names from the vendor's master XDC, and a `masterXdc()` generator.
2. A view implementing `BoardView` (e.g. a Three.js model) that reports switch/button input and renders `BoardOutputs`.
3. `index.ts` exporting a `BoardDef` (name, part, clock, I/O counts, resources), then add it to `BOARDS` in
   `src/boards/index.ts`. The board test in `test/lessons.test.ts` checks the definition is consistent.

Lesson code currently uses the Nexys A7 port names (`SW`, `LED`, `CLK100MHZ`, ...).

## Simulator limits

2-state (0/1, no X/Z), vectors up to 32 bits, no `generate`, functions/tasks or VHDL packages yet.
