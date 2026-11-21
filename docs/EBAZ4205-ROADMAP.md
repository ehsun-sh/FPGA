# FPGA Lab — EBAZ4205 roadmap (second board: Zynq-7010 plus an extension board)

Like [ROADMAP.md](ROADMAP.md), this is a set of **implementation briefs**: hand over the *Global rules* of
ROADMAP.md, the *Rules for this roadmap* below, and one phase. One draft PR per phase, one commit per numbered task.
Decisions are made here; re-open one only if it proves impossible, and say so in the PR.

Prepared material lives in [`docs/ebaz4205/`](ebaz4205/):

| File | What it is |
|---|---|
| [SOURCES.md](ebaz4205/SOURCES.md) | Every source, its license, what was taken, and the credit line each lesson must show |
| [CONTENT.md](ebaz4205/CONTENT.md) | The extracted facts, organised by lesson: board spec, hardware prep, Zynq and boot, PS settings, Vivado/Vitis/Linux flows |
| [LESSONS.md](ebaz4205/LESSONS.md) | Lesson briefs: ids, fa/en titles and summaries, objectives, outline, exercises, checkers, quizzes |
| [ebaz4205-master.xdc](ebaz4205/ebaz4205-master.xdc) | Master constraints: LEDs, DATA1-3, fans, Ethernet, optional X5 clock, and Ehsan's extension board (HDMI, USB serial, LEDs; LCD, keys and buzzer to fill in) |
| [ebazext-v2.xdc](ebaz4205/ebazext-v2.xdc) | Elrori's EBAZEXT-V1/V2 extension board, a different design, kept for later |
| [create_ebaz_project.tcl](ebaz4205/create_ebaz_project.tcl) | Draft Vivado script: PS7 block design + the learner's `top` as a module reference |
| [boot.bif](ebaz4205/boot.bif) | BOOT.bin layout |
| [code/](ebaz4205/code/) | Ready lesson code: `z_blink`, `x_tone` (buzzer), `x_tmds` (Verilog and VHDL), `ps_hello.c` |

`test/ebaz-drafts.test.ts` compiles the ready HDL in the site's simulator and checks its behaviour (the TMDS
encoders against a reference model over 3,000 symbols). It runs in CI today.

---

## Rules for this roadmap

- **The Nexys A7 stays the default** and nothing about it changes for a learner who never picks another board.
  Existing lesson ids, URLs, localStorage keys and progress are untouched.
- **What the simulator does on the EBAZ4205:** the PL only. The ARM cores are not emulated. Lessons about the PS
  are *real* lessons (guided steps, downloads, quiz), like `realboard`. Say so in the limits dialog: fa «پردازنده‌ی
  ARM (بخش PS) شبیه‌سازی نمی‌شود؛ فقط منطق PL روی برد سه‌بعدی اجرا می‌شود.» en "The ARM processor (the PS) is not
  simulated; only the PL logic runs on the 3D board."
- **The PL clock is `FCLK_CLK0` = 50 MHz** from the PS. The learner's `top` has an input `clk` with no XDC pin;
  the simulator binds it as the clock and the Vivado download wires it in the block design. A learner who solders
  an oscillator at X5 can constrain `clk` to `N18` instead; the simulator then runs it at the same 50 MHz.
- **Facts only from the prepared files.** Anything marked **(verify)** in CONTENT.md is shown with a "to be confirmed
  on your board" note until Ehsan confirms it on the real board; then remove the note and the marker together.
- **Credits:** every EBAZ4205 lesson ends with a "Sources" box (fa «منابع», en "Sources") with the credit lines
  from SOURCES.md, linked. No translated passages and no reused images from the CC BY-NC-SA sources.
- **Original content only** for melodies, pictures and examples (see ROADMAP.md global rules).

---

## Phase E0 — Facts from Ehsan's own boards (not code)

Mostly answered. On 2026-11-21 Ehsan sent the schematic of their extension board (CONTENT.md §5.1): HDMI, USB-C serial
(CH340C) and three LEDs are read and in `ebaz4205-master.xdc`. Elrori's EBAZEXT turned out to be a different board
(kept in `ebazext-v2.xdc`). What is left:

1. **The rest of the extension board schematic** (the sheet sent so far stops below the HDMI part): the LCD
   ("IPS130-12", one pin on `T20`), the keys and the buzzer, with their pins, pull-ups and drive circuits.
2. On the core board, confirm: the LED colours (W14 red and W13 green, as three sources say, or the other way round,
   as EBAZEXT-V1's XDC says) and their active level; whether J7, J8, U7 (SD slot), X5, Y3, S3 are fitted; which boot
   resistor is in place; the PS crystal (33.333 MHz?).
3. Dimensions for the 3D models: the core board from `Elrori/EBAZ4205/ebit.pcb` or the KiCad files in
   `xjtuecho/EBAZ4205/HW/ebaz4205/kicad`; the extension board from a photo with a ruler next to it, or its PCB file if
   the seller has one (outline, positions of the HDMI and USB-C sockets, the LCD, keys, buzzer and LEDs).

Output: a commit that fills in the LCD, key and buzzer lines of the XDC and CONTENT.md §5.1, and removes the
confirmed **(verify)** marks.

---

## Phase E1 — A second board in the platform

Goal: a learner can pick the EBAZ4205, see its 3D model, run a PL design on it, and download a Vivado project for
it.

Status (2026-11-21): implemented in one PR. Still open: the real Vivado run of the downloaded project (E1.4), and the
3D model's exact sizes and positions, which wait for E0.3 (the model uses approximate ones). The board plug-in interface exists (`src/boards/types.ts`) but parts of the app assume the Nexys.

### E1.1 Board picker and per-board course

- Store key `board` already selects the board (`src/main.ts` ≈ line 105). Add the picker:
  - Landing page, above the chapter list: a segmented control fa «برد شما» en "Your board" with two options,
    «Nexys A7-100T» and «EBAZ4205 (Zynq-7010)», each with a one-line note: fa «برد آموزشی Digilent؛ کلید، LED و
    نمایشگر هفت‌قسمتی» / «برد ارزان Zynq با برد توسعه» en "Digilent trainer: switches, LEDs, 7-segment" /
    "Low-cost Zynq board with an extension board".
  - View menu (Vivado mode) → *Board*, same two options.
  - Switching board reloads the workbench state (board view, runner, logic analyzer, serial, VGA) — simplest and
    safest is `store.set("board", id)` then `location.reload()`, keeping the current URL.
- `Chapter` (`src/lessons/course.ts`) gets `boards?: string[]` (default: `['nexys-a7-100t']`). The landing page and
  the lesson list show only chapters for the current board, plus chapters with no hardware (Lab/playground, and
  `realboard`, `timing` … once they have variants, see E3.4).
- Opening a lesson URL whose chapter belongs to another board switches the board for that visit and shows a banner:
  fa «این درس برای برد {name} است؛ برد به‌طور موقت عوض شد.» en "This lesson is for the {name}; the board was switched
  for now." with a button to switch back. Lesson URLs do not change (no board in the path).
- Progress: `isDone`/course totals count only the current board's chapters; the landing page shows one progress
  line per board the learner has touched. Certificate text names the board's course.
- Prerendering (Phase 4.1) renders every lesson of every board, unchanged URL scheme.
- Test: `test/course.test.ts` — chapter filtering per board, every lesson id unique across boards.

### E1.2 Board definition

`src/boards/ebaz4205/{index,pins,model3d,controls}.ts`, registered in `src/boards/index.ts`.

- `BoardDef`: id `ebaz4205`, name `EBAZ4205`, vendor `Ebit (Zynq-7010)`, part `xc7z010clg400-1`, no `boardPart`,
  `clockHz: 50e6`, resources from CONTENT.md §1, `io: { switches: 0, leds: 2, rgb: [], digits: 0, buttons: [] }`
  (keys come with the extension board, E3).
- `types.ts` additions (shared vocabulary, so both boards compile):
  - `BoardDef.internalClock?: { port: string; source: string; hz: number }` — here `{ port: 'clk', source:
    'FCLK_CLK0', hz: 50e6 }`. `mapPorts()` binds an unconstrained input with that name as the clock and logs
    `INFO: [FPGA Lab] clk is driven by FCLK_CLK0 (50 MHz) from the PS`. If the XDC constrains it to N18, that wins.
  - `Device` kinds: `{ kind: 'buzzer'; name }`, `{ kind: 'lcd'; line: string }`, `{ kind: 'hdmi'; ch: 0 | 1 | 2 |
    'clk'; pol: 'p' | 'n' }`, `{ kind: 'fan'; name; line: 'pwm' | 'speed' }` (and `audio`, `ddc`, `cam` only if
    EBAZEXT-V2 is added later). `isBoardInput()` treats `fan.speed` as an input.
  - `XdcGroup` gains `'data' | 'fan' | 'enet' | 'ext_led' | 'ext_uart' | 'key' | 'buzzer' | 'lcd' | 'hdmi'`.
  - `BoardView.setExtension?(attached: boolean)` (E3).
- `pins.ts` from `docs/ebaz4205/ebaz4205-master.xdc`: `W14` → `led 0` (`LED_R`), `W13` → `led 1` (`LED_G`),
  `N18` → `clk`, the four fan pins, DATA1-3 as `pin` devices named `DATA1_5` …, and `HEADERS` = DATA1, DATA2, DATA3
  with silkscreen pin numbers (for logic-analyzer probes and modules). `defaultNames`: `LED_R`, `LED_G`, `LED[0]`,
  `LED[1]`, and every `DATAx_n`. `masterXdc(groups)` emits the file with only the asked groups uncommented. Keep
  the MIT copyright lines in the header comment.
- `parts.ts`: board-aware part names for `highlight()` (`LED_R`, `LED_G`, `J7`, `J8`, `DATA1..3`, `R2577`, `R2584`,
  `X5`, `U7`, and with the extension board `LED1..LED3`, `HDMI`, `USB-C`, `LCD`, the keys and the buzzer); move today's Nexys rules into the Nexys folder and dispatch on the board id.
- Audit every Nexys assumption outside `src/boards/` and route it through `BoardDef`: hardware-manager strings in
  `src/main.ts` (≈ lines 255, 336: "Digilent", "xilinx_tcf"), `hwDev`, the 16-switch loops in `src/grade/harness.ts`
  and the tests, the clock label, `defaultConfig()` of the logic analyzer, the modules library's Pmod pin lists
  (the EBAZ has no Pmod: modules attach to DATA pins), and the About text.
- Tests: `test/boards.test.ts` — every pin in `pins.ts` appears in the master XDC and vice versa; `masterXdc({led:
  true})` maps `LED_R`/`LED_G`; `mapPorts` binds `clk` through `internalClock`; `z_blink.v` runs on the EBAZ harness.

### E1.3 3D model of the core board

`src/boards/ebaz4205/model3d.ts`, procedural Three.js like `nexys-a7/model3d.ts` (no external model files).

- Dimensions and part positions from the KiCad files (E0.3). Parts: PCB (dark green or black as photographed),
  Zynq BGA with marking `XC7Z010`, DDR3, NAND, RJ45 with LEDs, three 2x10 2.0 mm headers with silkscreen DATA1-3,
  J7 (3 pins), J8 (2x7), the fan headers J3/J5, the power connector J4, the SD slot U7 (drawn empty when E0 says it is
  not fitted), the two LEDs (red and green glow driven by `BoardOutputs.led`), and labels for R2577/R2584 and X5.
- Implements `BoardView`: no switches (`switches: []`), `onButton` unused until E3, `setProbes` on DATA pins,
  `highlight`, `setBackground`, `resetView`/`topView`/`fitView`. Phone: same tap targets rules as the Nexys.
- The landing-page hero shows the selected board.

### E1.4 Vivado project download for the EBAZ4205

`src/synth/project.ts` gets a board branch: for a board with `internalClock`, the zip contains
`create_project.tcl` built from `docs/ebaz4205/create_ebaz_project.tcl` (PS7 block design, `top` as module
reference, `FCLK_CLK0` → `clk`, other ports external under their own names), the lesson XDC (without a clock pin),
the sources, `boot.bif`, and a README with the Vitis steps of CONTENT.md §4.1/4.2 (fa and en). The `build` argument
also writes `system.xsa`.

**Acceptance needs one real run:** Ehsan (or anyone with Vivado 2022.2+) runs the zip of `z-blink` in batch mode to
a bitstream and an XSA; fix the Tcl until it passes and note the Vivado version in the README.

### Acceptance checklist — Phase E1

- [ ] Picking EBAZ4205 on the landing page shows the EBAZ model in the hero and only EBAZ chapters (empty state
      until E2: fa «درس‌های این برد به‌زودی اضافه می‌شوند.» en "Lessons for this board are coming soon.").
- [ ] Switching back to Nexys restores everything exactly as before (progress, code, XDC per board).
- [ ] The playground on the EBAZ4205 runs `z_blink.v` with no clock constraint, LEDs blink on the 3D board, the
      console shows the FCLK_CLK0 info line.
- [ ] Logic analyzer probes clip onto DATA header pins.
- [ ] Download Vivado project for the EBAZ4205 builds a bitstream and an XSA in real Vivado.
- [ ] All Nexys tests still pass; new board tests pass; `npm run build` green; 390 px layout checked.

---

## Phase E2 — Chapter Z: Zynq and the EBAZ4205

Status (2026-11-21): implemented in `src/lessons/zynq.ts` (lessons, goals, quiz), `src/grade/zynq.ts` (z-blink
checker), `figures.ts` (figZynq, figBootFlow, figMii) and `project.ts` (PS-only zips for z-ps-hello and z-ethernet).
The boot-flow figure is static, not yet interactive. Still open: Ehsan's run of `z-ps-hello` on the real board, and
a real Vivado run of the Ethernet zip.

Five lessons, briefs in [LESSONS.md](ebaz4205/LESSONS.md) chapter Z: `z-intro`, `z-blink`, `z-bootflow`,
`z-ps-hello`, `z-ethernet` (optional sixth: `z-linux` as a guide page). Chapter title fa «Zynq و برد EBAZ4205» en
"Zynq and the EBAZ4205", `boards: ['ebaz4205']`.

- E2.1 Lesson text, fa and en, to the Phase 2 standard, from CONTENT.md §1-4. `z-blink` uses the ready code and its
  checker (`DIV` parameter); the four real lessons follow the `realboard` pattern (no checker; done when opened and
  quiz passed).
- E2.2 Figures (original SVG in `figures.ts`, both themes, `figures.test.ts`): Zynq PS/PL/MIO/EMIO block diagram;
  the interactive boot flow (BootROM → FSBL → bitstream → app); the MII 8-to-4-bit glue.
- E2.3 Downloads per real lesson: `z-ps-hello` gives the E1.4 zip plus `ps_hello.c`; `z-ethernet` gives a zip whose
  block design adds ENET0 over EMIO with the slice/concat, `FCLK_CLK3` on U18, and the Ethernet XDC block.
- E2.4 "Prepare your board" checklist in `z-intro` with checkboxes stored as `prep:ebaz4205` (bitmask), so a learner
  can tick what they have soldered (J7, SD slot + R2577, J8, power).
- E2.5 Glossary: PS, PL, MIO, EMIO, AXI, FCLK, FSBL, BootROM, BOOT.bin, bitstream, XSA, OCM, GMII/MII, PHY, MDIO
  (fa and en definitions, ≤ 30 words each) and search entries.

### Acceptance checklist — Phase E2

- [ ] The five lessons appear for the EBAZ4205 with objectives, takeaways, quizzes; `z-blink` exercise has hints,
      solutions (Verilog and VHDL) and a checker that accepts the solution and rejects the lesson code
      (`test/exercises.test.ts`).
- [ ] Each lesson ends with its Sources box; no **(verify)** fact appears without the note.
- [ ] Ehsan has followed `z-ps-hello` on the real board and seen the UART message (record the date in the PR).

---

## Phase E3 — Extension board: LEDs, serial, keys, buzzer

- E3.1 3D model of Ehsan's extension board (`src/boards/ebaz4205/ext3d.ts`), plugged onto the DATA headers, laid
  out from E0.3: PCB, HDMI socket, USB-C socket with the CH340C, the 4-pin UART header, LED1-LED3 (glow) and the
  power LED, the keys (clickable like the Nexys buttons, touch-friendly), the buzzer (pulses visibly while sounding),
  and the 1.3" LCD (a canvas texture, blank until E4). Toggle in the Modules drawer: fa «برد توسعه وصل است» en
  "Extension board attached", stored as `ebaz-ext` (default on). `BoardView.setExtension()`; when off, the extension
  pins are plain DATA pins again.
- E3.2 Pins from `ebaz4205-master.xdc` into `pins.ts` behind the extension flag: three more `led` devices
  (`EXT_LED[0..2]` on `E19`, `K17`, `H18`, so `io.leds` is 5 with the extension), `uart` devices `UART_RX` (`H16`,
  in) and `UART_TX` (`H17`, out) so the Serial Console works unchanged, `btn` devices for the keys and `buzzer` (from
  E0.1), and the `hdmi` and `lcd` lines (used in E4). XDC groups `ext_led`, `ext_uart`, `key`, `buzzer`.
- E3.3 Buzzer sound: `src/audio/buzzer.ts` watches the buzzer pin in the runner, measures the toggle rate per
  animation frame, and drives a Web Audio square oscillator at that frequency (gain 0 when the pin is steady). An
  *active* buzzer (E0) plays a fixed tone while the pin is at its active level. Off by default with a speaker toggle
  on the board toolbar (fa «صدای بازر» en "Buzzer sound"); at a slowed clock it shows the frequency instead.
- E3.4 Lessons `x-leds`, `x-keys`, `x-uart`, `x-buzzer` (LESSONS.md chapter X) and per-board **variants** of
  existing lessons: `Lesson.variants?: Record<boardId, Partial<Pick<Lesson, 'verilog' | 'vhdl' | 'xdc' | 'tryIt' |
  'la' | 'tb' | 'exercise'>>>` and `EXERCISES[id].boards?`. Start with `counter`, `debounce`, `fsm`, `pwm`, `uart`,
  `uart_rx`, `ram`, `timing`, `clocking`, `cdc`, `bram` (list in LESSONS.md); a lesson shows on a board when it has a
  variant for it. Stored code keys gain the board for variants: `src:<id>:<lang>:<board>` (keep the old key for the
  Nexys).
- `x-leds` and `x-uart` need nothing from E0 and can ship first.

### Acceptance checklist — Phase E3

- [ ] The extension board appears on the 3D model, can be detached and reattached; keys work by mouse, touch and
      keyboard focus.
- [ ] `x-buzzer` plays the scale through the speakers when sound is on; the checker passes the solution.
- [ ] `x-uart` echoes typed bytes in the Serial Console on `UART_RX`/`UART_TX`.
- [ ] At least six variants of existing lessons run and pass their checkers on the EBAZ4205.

---

## Phase E4 — LCD and HDMI

- E4.1 **LCD model** `src/modules/lcd.ts` for the 1.3" IPS module (ST7789, 240×240, 4-wire SPI, assumed until E0.1
  says otherwise): decodes SCL/SDA/DC/CS/RES (works without CS, as many 1.3" modules have none), implements SWRESET,
  SLPOUT, COLMOD, MADCTL, INVON, CASET, RASET, RAMWR, DISPON into an RGB565 framebuffer, warns in Messages when the
  init order or delays are wrong, and paints the 3D screen canvas. The logic analyzer's SPI decoder labels command vs
  data by DC. Then lesson `x-lcd`.
- E4.2 **HDMI monitor.** The extension board drives HDMI straight from the FPGA (TMDS_33 on CLK `F19/F20`, D0
  `D19/D20`, D1 `C20/B20`, D2 `B19/A20`; no transmitter chip). Serial TMDS at 250 Mbit/s per lane is too fast to
  simulate bit by bit in the browser, so the simulator taps the 10-bit symbols: the lesson provides a
  `tmds_serializer` module (inputs `pclk`, `d0`, `d1`, `d2` [9:0]; outputs the four HDMI pairs). In the simulator it
  is a black box recognised by name; `src/vga/hdmi.ts` reads its three symbol inputs on every `pclk` edge, decodes
  them (control symbols → DE/HSYNC/VSYNC; video symbols → bytes, the exact inverse of `x_tmds.v`) and feeds
  `VgaMonitor` (mode detection, "No signal", screen) through the same path as `vgaTap`. The monitor is drawn plugged
  into the HDMI socket. The Vivado download contains a real `tmds_serializer.v` (two cascaded `OSERDESE2` per lane in
  10:1 DDR mode, `OBUFDS` with `TMDS_33`, an MMCM making 25 and 125 MHz from `FCLK_CLK0`). The board has no DDC, so
  there is no EDID model.
- E4.3 Lessons `x-hdmi-tmds` (ready code, testbench against the reference table) and `x-hdmi-bars` (reuses the
  `vga` timing generator).
- E4.4 Optional project `proj-ebaz-alarm` (LESSONS.md) in the Projects chapter for the EBAZ4205.

### Acceptance checklist — Phase E4

- [ ] The LCD shows the lesson's picture on the 3D board; a wrong init sequence gives a readable message.
- [ ] `x-hdmi-bars` shows colour bars on the monitor at 640×480; corrupting one symbol shows "No signal" or a
      wrong colour, not a crash.
- [ ] The HDMI decoder round-trips 10,000 random symbols through `x_tmds.v` in a unit test.
- [ ] On the real board (Ehsan): the downloaded `x-lcd` and `x-hdmi-bars` projects show their pictures.

---

## Later (not planned in detail)

- `z-linux` as a full lesson; a PetaLinux variant; the Buildroot route of blkf2016/ebaz4205.
- Elrori's EBAZEXT-V2 as a second extension-board option (`ebazext-v2.xdc`): audio jack, GPIO header, and an
  `x-camera` lesson (OV7670 on its camera header, shown on HDMI).
- A small PS model in the simulator (EMIO GPIO and an AXI-GPIO register panel driven by a tiny C-like script) so
  that PS-PL lessons can be checked automatically.
- More recycled Zynq boards through the same plug-in: the EBAZ4203, and the Antminer S9 control board (a different
  PCB; its schematic and samples are in KarolNi/S9miner_sample).
