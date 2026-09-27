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
- **Lessons (Persian)**, each with theory, Verilog and VHDL code, a “try it on the board” step and an exercise:
  1. What is an FPGA / board tour · 2. Logic gates · 3. Multiplexers · 4. Adders and hierarchy · 5. Seven-segment decoder ·
  6. Clock and flip-flops · 7. Counters and clock division · 8. Multiplexed display · 9. FSM traffic light · Playground.

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
| `src/board/` | Nexys A7 pin table, XDC parser/port mapping, 3D board |
| `src/sim/runner.ts` | real-time driver: clocking, inputs, LED/segment brightness (persistence of vision) |
| `src/lessons/` | course content |
| `src/main.ts`, `src/ui/` | Vivado-style UI |

## Simulator limits

2-state (0/1, no X/Z), vectors up to 32 bits, no `generate`, functions/tasks or VHDL packages yet.
