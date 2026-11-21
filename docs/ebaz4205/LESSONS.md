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

## Chapter X: «برد توسعه: کلید، سریال، صدا و HDMI» / "Extension board: keys, serial, sound and HDMI"

Shown when the EBAZ4205 is selected and the extension board is attached. Written for **EBAZEXT-V2** (CONTENT.md §5);
the port names are fixed in `ebaz4205-master.xdc` (`KEY0`, `KEY1`, `EXT_LED0`, `EXT_LED1`, `UART_RX`, `UART_TX`,
`AUDIO_L`, `AUDIO_R`, `HDMI_*`, `IO[0..5]`, `CAM_*`).

### 1. `x-keys` (sim, intro)

- fa: «کلیدها و LEDهای برد توسعه» · «با هر فشار KEY0 یک LED را روشن و خاموش کنید؛ بدون لرزش.»
- en: "Extension-board keys and LEDs" · "Toggle an LED on each press of KEY0, without bounce."
- Port of `debounce`: 50 MHz clock, `KEY0` is **active low** (pull-up, pressed = 0, say why the code inverts it),
  `EXT_LED0`/`EXT_LED1` active high. Reuse the debounce checker with the bouncy-button option and a small
  debounce-time parameter.

### 2. `x-tone` (sim, core) — code ready: `x_tone.v`, `x_tone.vhd`

- fa: «صدا از جک هدفون: ساختن نت با تقسیم کلاک» · «یک گام دو ماژور بالا و پایین بنوازید و با KEY0 قطعش کنید.»
- en: "Sound from the headphone jack: notes from a clock divider" · "Play a C-major scale up and down, and mute it with KEY0."
- Objectives: turn a frequency into a half-period count; sequence notes from a table; explain how an RC low-pass
  turns a digital pin into an audio signal.
- Body: f → half period = CLK_HZ / (2f); the note table C4..C5; a note counter; the mute key (active low); the
  3.3 kΩ + 100 nF filter on the board (corner about 480 Hz: square waves sound soft but clear). The 3D board plays the
  pin through Web Audio (Phase E3). Only original or public-domain melodies (a scale, or an out-of-copyright folk
  tune).
- Exercise: add a short silence between notes. `params: { CLK_HZ: 52400, NOTE_TICKS: 4000 }` (as in the test: C4 is
  then 100 cycles per half period). Checker: measures half periods on `AUDIO_L`, expects 100 → 50 and back, and a
  silent gap after each note.
- Follow-up exercise idea (advanced): 8-bit PWM audio playing a sine table, which needs the same filter.

### 3. `x-uart` (sim, core)

- fa: «پورت سریال USB-C برد توسعه» · «پیام بفرستید و فرمان بگیرید؛ روی کامپیوتر به‌صورت پورت CH340 دیده می‌شود.»
- en: "The extension board's USB-C serial port" · "Send a message and take commands; the PC sees a CH340 COM port."
- Port of `uart` + `uart_rx` with `CLK_HZ = 50_000_000`, `UART_TX` `K19`, `UART_RX` `J20`; the Serial Console and
  logic analyzer work as on the Nexys. "Try it on the board" names the CH340 driver and a terminal at 115200 8N1, and
  says that the same USB-C cable powers both boards.

### 4. `x-hdmi-tmds` (sim, advanced) — code ready: `x_tmds.v`, `x_tmds.vhd`

- fa: «HDMI از درون: رمزگذاری TMDS» · «بایت پیکسل را به نماد ۱۰ بیتی با کمترین تغییر و تعادل DC تبدیل کنید.»
- en: "HDMI from the inside: TMDS encoding" · "Turn a pixel byte into a 10-bit symbol with few transitions and DC balance."
- Objectives: explain the two TMDS stages (transition minimising, DC balance); tell video symbols from control
  symbols; test an encoder against a reference with a testbench.
- Body: DVI/HDMI = three TMDS data channels + a clock; 8b/10b per channel; stage 1 XOR/XNOR choice; stage 2 running
  disparity; the four control symbols for HSYNC/VSYNC during blanking. On EBAZEXT-V2 the FPGA drives the HDMI socket
  directly (no transmitter chip), which is why this lesson matters on this board. Testbench tab feeds bytes and
  compares with a table.
- Exercise: given the stage-1 half, write stage 2 (the disparity logic). Checker: 3,000 random symbols against the
  reference model in `test/ebaz-drafts.test.ts` (move it to `src/grade` as a shared helper).

### 5. `x-hdmi-bars` (sim, advanced)

- fa: «تصویر روی HDMI: نوارهای رنگی ۶۴۰×۴۸۰» · en: "A picture over HDMI: 640×480 colour bars".
- Reuses the `vga` lesson's timing generator (25 MHz pixel clock), three `tmds_encoder`s and a serializer. On real
  hardware the serializer is `OSERDESE2` (10:1, DDR, with a 125 MHz clock from an MMCM fed by `FCLK_CLK0`) and
  `OBUFDS` with `TMDS_33` on `H16/H17`, `F19/F20`, `C20/B20`, `B19/A20`; in the simulator the provided
  `tmds_serializer` block is a black box that hands the 10-bit symbols to the HDMI monitor (roadmap E4.2).
- Optional extension: read the monitor's EDID over `HDMI_SCL`/`HDMI_SDA` with the `i2c` lesson's master.

### 6. `x-gpio` (sim, core)

- fa: «هدر GPIO برد توسعه و ماژول‌های جانبی» · en: "The extension GPIO header and add-on modules".
- The six `IO[0..5]` pins on J4 take the existing Add Module parts (HC-SR04, servo, Pmod-style buttons). Port of the
  distance-sensor or servo exercise.

Later (not in this chapter yet): `x-camera`, OV7670 capture on J3 shown on HDMI (needs a camera model).

If Ehsan's board turns out to have an **LCD** and a **buzzer** (a design other than EBAZEXT-V2), add `x-lcd` (SPI
TFT ST7735/ST7789 or HD44780, chosen from its schematic) and point `x-tone` at the buzzer pin instead of the jack.

Project (optional, in the Projects chapter): `proj-ebaz-alarm`: an alarm clock with KEY0/KEY1 to set it, the time
shown over HDMI and sent on the serial port each minute, and the alarm played on the audio jack.

---

## Existing lessons that get an EBAZ4205 variant (Phase E3)

These need hardware the EBAZ4205 + EBAZEXT-V2 has (4 LEDs, 2 keys, a PL UART, audio, HDMI, 6 GPIO pins), so they get
per-board variants (code, XDC, try-it text) instead of new lessons: `counter` (LED blink rate), `debounce`
(→ `x-keys`), `fsm` (LEDs + keys), `pwm` (LED brightness, then audio), `uart`, `uart_rx`, `i2c` (HDMI EDID), `vga`
(→ `x-hdmi-bars`), `ram`, `timing`, `clocking` (FCLK and MMCM), `cdc`, `bram`, `sensors` (HC-SR04 on J4). Lessons that need switches or the seven-segment display stay Nexys-only.
