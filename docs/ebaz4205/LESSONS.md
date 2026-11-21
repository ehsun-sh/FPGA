# EBAZ4205 lessons: prepared briefs

Each brief gives the lesson id (never rename it once shipped), titles and summary in Persian and English, the three
objectives, the body outline, the code, the exercise and its checker, and the quiz topics. Facts come from
[CONTENT.md](CONTENT.md). Write the final lesson text to the Phase 2 standard of `docs/ROADMAP.md` (objectives,
takeaways, level, prerequisites, quiz, exercise with hints and solutions in both languages). Every EBAZ4205 lesson
ends with a "Sources" box carrying the credit lines from [SOURCES.md](SOURCES.md).

Kinds:
- **sim**: runs in the browser simulator on the 3D EBAZ4205 and has an automatic checker.
- **real**: a guided real-board lesson like `realboard`: no checker, a quiz, downloadable files, done when opened and
  the quiz is passed.

Code marked "ready" is in [code/](code/) and is tested by `test/ebaz-drafts.test.ts`.

---

## Chapter Z: «Zynq و برد EBAZ4205» / "Zynq and the EBAZ4205"

Shown when the EBAZ4205 board is selected. Five lessons, in this order.

### 1. `z-intro` (real, intro)

- fa: «آشنایی با Zynq و برد EBAZ4205» · «یک برد ماینر بازیافتی که هم پردازنده‌ی ARM دارد و هم FPGA.»
- en: "Meet the Zynq and the EBAZ4205" · "A recycled miner board with both ARM cores and an FPGA."
- Objectives (en; fa to write in the same register):
  1. Tell the PS and the PL apart and say what MIO and EMIO are.
  2. Find the LEDs, DATA headers, J7 (UART), J8 (JTAG) and the boot resistors on the board.
  3. Prepare a board for SD-card boot and a serial console.
- Body: where the board comes from; the spec table (CONTENT §1); PS/PL/MIO/EMIO/AXI/FCLK (CONTENT §2, first three
  bullets) with an original block figure; the 3D board with every part named in the text highlighted (needs
  `parts.ts` names for this board: `LED_R`, `LED_G`, `J7`, `J8`, `DATA1..3`, `R2577`, `R2584`, `X5`, `U7`);
  "Prepare your board" checklist (CONTENT §1, hardware preparation) with a safety note on the stock firmware.
- Quiz: (a) which part runs Linux, PS or PL; (b) why the Ethernet pins are in the XDC even though the MAC is in the
  PS (EMIO); (c) what moving R2584 to R2577 changes.

### 2. `z-blink` (sim, intro) — code ready: `z_blink.v`, `z_blink.vhd`

- fa: «اولین طرح PL: چشمک‌زن با کلاک PS» · «LED قرمز و سبز را با کلاک ۵۰ مگاهرتزی FCLK_CLK0 به نوبت روشن کنید.»
- en: "First PL design: a blinker clocked by the PS" · "Blink the red and green LEDs in turn from the 50 MHz FCLK_CLK0."
- Objectives: explain why the PL clock comes from the PS on this board; write a clock divider for 50 MHz; read the
  two LED lines in the XDC.
- Body: no PL oscillator (X5 empty) so `clk` is `FCLK_CLK0`; counter to 25,000,000 for 0.5 s; XDC has only
  `W14`/`W13` and no clock pin; how the real flow differs (CONTENT §4.1: bitstream alone is not enough, the PS must
  start the clock). "Download Vivado project" produces the block design automatically.
- Exercise: make the green LED blink twice as fast as the red one. `params: { DIV: 4 }`. Checker: over 64 cycles,
  green toggles every DIV/2 cycles and red every DIV cycles.
- Quiz: why there is no `create_clock` on a package pin; what `FCLK_CLK0` is; what happens if `DIV` is 50,000,000.

### 3. `z-bootflow` (real, core)

- fa: «Zynq چطور بوت می‌شود؟ BootROM، FSBL و BOOT.bin» · «از روشن شدن تا اجرای برنامه، قدم به قدم.»
- en: "How a Zynq boots: BootROM, FSBL and BOOT.bin" · "From power-on to your program, step by step."
- Objectives: name the three boot stages and what each loads; read a `.bif` file; choose NAND, SD or JTAG boot on
  the EBAZ4205.
- Body: CONTENT §2 boot bullets; the boot-flow figure (interactive: clicking a stage highlights it and shows what
  sits in OCM/DDR/PL at that moment); [boot.bif](boot.bif); the four boot sources of this board; "the FSBL can load anything": blkf2016's FSBL hook
  that reads `u-boot.bin` from the SD card into DDR (CONTENT §7).
- Quiz: what the FSBL does that the BootROM cannot (DDR init, PL config); the order inside BOOT.bin; why the SD
  card must be FAT.

### 4. `z-ps-hello` (real, core) — code ready: `ps_hello.c`, `create_ebaz_project.tcl`

- fa: «اولین برنامه روی ARM: Hello World از طریق UART» · «با Vivado و Vitis برنامه‌ای بسازید که روی J7 پیام بفرستد و LEDها را چشمک بزند.»
- en: "First program on the ARM: Hello World over UART" · "Use Vivado and Vitis to print on J7 and blink the LEDs."
- Objectives: configure the ZYNQ7 PS for this board (DDR, UART1, SD0, NAND); export the hardware and build an FSBL
  and an application in Vitis; make BOOT.bin and boot it from SD.
- Body: CONTENT §3 table (as a "settings card" the learner can copy) and §4.2 steps; EMIO GPIO 54/55 to the LEDs
  (the `xlslice` on `GPIO_O`). Downloads: the Vivado project zip (EBAZ branch of `project.ts`) and `ps_hello.c`.
- Quiz: which MIO pins UART1 uses; why the `.xsa` must include the bitstream; what pin number EMIO GPIO 0 has (54).

### 5. `z-ethernet` (real, advanced)

- fa: «شبکه از طریق EMIO: سرور اکو با lwIP» · «MAC پردازنده را از داخل FPGA به PHY برسانید و با telnet تست کنید.»
- en: "Ethernet through EMIO: an lwIP echo server" · "Route the PS MAC through the fabric to the PHY and test it with telnet."
- Objectives: explain GMII vs MII and the slice/concat glue; constrain the Ethernet pins; run the lwIP echo server.
- Body: CONTENT §3 MII glue (with an original figure of the 8-bit bus folded to 4 bits), Ethernet XDC block,
  `FCLK_CLK3` on `U18` for boards without Y3, CONTENT §4.3.
- Quiz: why GEM0 cannot use MIO on this board; what happens without the concat; which port the echo server uses (7).

Optional sixth lesson (advanced, real): `z-linux`, "Linux from scratch", from CONTENT §4.4. Long; ship it as a
guide page linked from `z-ethernet` if chapter length is a concern (no chapter has more than six lessons).

---

## Chapter X: «برد توسعه: LED، سریال، کلید، بازر، LCD و HDMI» / "Extension board: LEDs, serial, keys, buzzer, LCD and HDMI"

Shown when the EBAZ4205 is selected and the extension board is attached. Written for **Ehsan's extension board**
(CONTENT.md §5.1); the port names are fixed in `ebaz4205-master.xdc` (`EXT_LED[2:0]`, `UART_RX`, `UART_TX`,
`HDMI_*`, `KEY1`-`KEY5`, `BUZZER`, `LCD_*`).

**Status (2026-11-21, Phases E3 and E4):** all seven lessons below have shipped in `src/lessons/ext.ts` (text),
`src/boards/ebaz4205/extcode.ts` (code) and `src/grade/ext.ts` (exercises), in two chapters: «برد توسعه: LED، کلید،
سریال، بازر و LCD» (`x-leds`, `x-keys`, `x-uart`, `x-buzzer`, `x-lcd`) and «HDMI» (`x-hdmi-tmds`, `x-hdmi-bars`). The
"needs the … pins" notes below are settled by the vendor schematic. The briefs are kept as the design record.

### 1. `x-leds` (sim, intro)

- fa: «سه LED برد توسعه: شمارنده و چراغ دونده» · «با کلاک ۵۰ مگاهرتزی یک چراغ دونده روی LED1 تا LED3 بسازید.»
- en: "The three extension LEDs: a counter and a chaser" · "Build a running light on LED1-LED3 from the 50 MHz clock."
- Port of `counter` / `shiftreg`: `EXT_LED[2:0]` on `E19`, `K17`, `H18`, active high. Checker with a small `DIV`.

### 2. `x-keys` (sim, intro) — needs the key pins

- fa: «کلیدهای برد توسعه و حذف لرزش» · «با هر فشار کلید، یک LED را روشن و خاموش کنید؛ بدون لرزش.»
- en: "Extension-board keys and debouncing" · "Toggle an LED on each key press, without bounce."
- Port of `debounce`: 50 MHz clock, the keys' active level from the schematic (the code inverts an active-low key and
  says why), `EXT_LED`. Reuse the debounce checker with the bouncy-button option and a small debounce-time parameter.

### 3. `x-uart` (sim, core)

- fa: «پورت سریال USB-C برد توسعه» · «پیام بفرستید و فرمان بگیرید؛ روی کامپیوتر به‌صورت پورت CH340 دیده می‌شود.»
- en: "The extension board's USB-C serial port" · "Send a message and take commands; the PC sees a CH340 COM port."
- Port of `uart` + `uart_rx` with `CLK_HZ = 50_000_000`, `UART_TX` `H17`, `UART_RX` `H16`; the Serial Console and
  logic analyzer work as on the Nexys. "Try it on the board" names the CH340 driver and a terminal at 115200 8N1, says
  that the same USB-C cable powers both boards, and that the 4-pin UART_USB_TTL header carries the same two lines.

### 4. `x-buzzer` (sim, core) — code ready: `x_tone.v`, `x_tone.vhd`; needs the buzzer and key pins

- fa: «بازر: ساختن صدا با تقسیم کلاک» · «یک گام دو ماژور بالا و پایین بنوازید و با کلید قطعش کنید.»
- en: "Buzzer: making sound with a clock divider" · "Play a C-major scale up and down, and mute it with a key."
- Objectives: turn a frequency into a half-period count; sequence notes from a table; tell an active buzzer (beeps
  at its own pitch while driven) from a passive one (plays the frequency you give it).
- Body: f → half period = CLK_HZ / (2f); the note table C4..C5; a note counter; the mute key. The 3D buzzer plays
  the pin through Web Audio (Phase E3). Only original or public-domain melodies (a scale, or an out-of-copyright folk
  tune). If the buzzer turns out to be active, the lesson becomes "beep patterns" (on/off rhythms) and the tone part
  moves to the exercise as theory.
- Exercise: add a short silence between notes. `params: { CLK_HZ: 52400, NOTE_TICKS: 4000 }` (as in the test: C4 is
  then 100 cycles per half period). Checker: measures half periods on `BUZZER`, expects 100 → 50 and back, and a
  silent gap after each note.

### 5. `x-lcd` (sim, advanced) — needs the LCD pins

- fa: «راه‌اندازی نمایشگر IPS یک‌وسه‌دهم اینچی» · «نمایشگر SPI را با یک دنباله‌ی راه‌اندازی بیدار کنید و نوارهای رنگی بکشید.»
- en: "Driving the 1.3-inch IPS display" · "Wake the SPI display with an init sequence and draw colour stripes."
- Assumes an ST7789 240×240 on 4-wire SPI (SCL, SDA, RES, DC, CS?, BLK) until the schematic says otherwise. Builds on
  `spi` and `fsm`: an init-sequence ROM (software reset, sleep out, colour mode 16-bit RGB565, inversion on, display
  on), then CASET/RASET/RAMWR and a pixel stream. Many 1.3" modules have no CS pin and need SPI mode 3; the lesson
  says to check. The simulator's LCD model keeps a framebuffer and paints the 3D screen.
- Exercise: draw a different-coloured square in the centre (the checker reads the model's framebuffer).

### 6. `x-hdmi-tmds` (sim, advanced) — code ready: `x_tmds.v`, `x_tmds.vhd`

- fa: «HDMI از درون: رمزگذاری TMDS» · «بایت پیکسل را به نماد ۱۰ بیتی با کمترین تغییر و تعادل DC تبدیل کنید.»
- en: "HDMI from the inside: TMDS encoding" · "Turn a pixel byte into a 10-bit symbol with few transitions and DC balance."
- Objectives: explain the two TMDS stages (transition minimising, DC balance); tell video symbols from control
  symbols; test an encoder against a reference with a testbench.
- Body: DVI/HDMI = three TMDS data channels + a clock; 8b/10b per channel; stage 1 XOR/XNOR choice; stage 2 running
  disparity; the four control symbols for HSYNC/VSYNC during blanking. The extension board drives the HDMI socket
  straight from the FPGA (no transmitter chip), which is why this lesson matters on this board.
- Exercise: given the stage-1 half, write stage 2 (the disparity logic). Checker: 3,000 random symbols against the
  reference model in `test/ebaz-drafts.test.ts` (move it to `src/grade` as a shared helper).
- Chapter X has seven lessons with `x-hdmi-bars`; since no chapter may have more than six, `x-hdmi-tmds` and
  `x-hdmi-bars` form their own chapter «HDMI» / "HDMI" if the LCD and keys lessons all ship.

### 7. `x-hdmi-bars` (sim, advanced)

- fa: «تصویر روی HDMI: نوارهای رنگی ۶۴۰×۴۸۰» · en: "A picture over HDMI: 640×480 colour bars".
- Reuses the `vga` lesson's timing generator (25 MHz pixel clock), three `tmds_encoder`s and a serializer. On real
  hardware the serializer is `OSERDESE2` (10:1, DDR, with a 125 MHz clock from an MMCM fed by `FCLK_CLK0`) and
  `OBUFDS` with `TMDS_33` on CLK `F19/F20`, D0 `D19/D20`, D1 `C20/B20`, D2 `B19/A20`; in the simulator the provided
  `tmds_serializer` block is a black box that hands the 10-bit symbols to the HDMI monitor (roadmap E4.1).
- No EDID: the board does not wire DDC, so the design must pick a mode every monitor takes (640×480 at 60 Hz).

Project (optional, in the Projects chapter): `proj-ebaz-alarm`: an alarm clock with the keys to set it, the time on
the LCD and over HDMI, sent on the serial port each minute, and the alarm on the buzzer.

If the site later offers Elrori's EBAZEXT-V2 as a second extension board (`ebazext-v2.xdc`), its audio jack takes
`x-buzzer` (same code, `AUDIO_L`/`AUDIO_R` instead of `BUZZER`) and its GPIO and camera headers add `x-gpio` and
`x-camera`.

---

## Existing lessons that get an EBAZ4205 variant (Phase E3)

These need hardware the EBAZ4205 + Ehsan's extension board has (5 LEDs, keys, a PL UART, a buzzer, an SPI LCD, HDMI),
so they get per-board variants (code, XDC, try-it text) instead of new lessons: `counter` (LED blink rate),
`debounce` (→ `x-keys`), `fsm` (LEDs + keys), `pwm` (LED brightness), `uart`, `uart_rx`, `spi` (→ `x-lcd`), `vga`
(→ `x-hdmi-bars`), `ram`, `timing`, `clocking` (FCLK and MMCM), `cdc`, `bram`. Lessons that need switches or the seven-segment display stay Nexys-only.

**Shipped (2026-11-21):** `counter`, `fsm`, `debounce`, `pwm`, `uart` and `uart_rx`, listed on the EBAZ4205 in the
chapter «درس‌های پایه روی EBAZ4205» / "Core lessons on the EBAZ4205" (between the extension-board chapter and HDMI).
Text: `src/lessons/ebaz-variants.ts`; code: `src/boards/ebaz4205/varcode.ts` (the helper modules are taken from the
Nexys lessons and moved to 50 MHz); exercises: `src/grade/variants.ts`; tests: `test/variants.test.ts`. The board
mapping is the same in all six: KEY1 is the reset (active low, like CPU_RESETN), KEY3, the middle of the key cross,
stands in for BTNC and KEY2 for BTNU, and the five LEDs are LED_R, LED_G, LED1, LED2, LED3.

| Lesson | EBAZ4205 version | Exercise (checker) |
|---|---|---|
| `counter` | 1 Hz on LED_R, a 4-bit count on LED_G + LED1-LED3, KEY1 resets | Knight Rider over the five LEDs, `DIV` |
| `fsm` | traffic light on LED1 (red), LED2 (yellow), LED3 (green); KEY3 = pedestrian | night mode toggled by KEY2, `ONE_SECOND` |
| `debounce` | raw vs. debounced counts of KEY3 (LED_R/LED_G vs. LED1-LED3), KEY2 clears | rotate the five LEDs once per bouncy KEY2 press |
| `pwm` | LED1-LED3 at 6 %, 25 %, 100 %; KEY3 + KEY2/KEY4 adjust | LED1 breathes, `DIV` |
| `uart` | KEY3 sends "Hello FPGA!" on UART_TX at 115200 | the same at 9600 baud (5208 clocks per bit) |
| `uart_rx` | upper-case echo on UART_RX/UART_TX | the same at 9600 baud |

Still to do: `ram`, `timing`, `clocking`, `cdc`, `bram`. A solve on one board does not count on the other: the
EBAZ4205 version's progress is stored as `<id>:ebaz4205`.
