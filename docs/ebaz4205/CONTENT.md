# EBAZ4205: extracted content, organised for the lessons

This is the fact base for the EBAZ4205 lessons. It is written in our own words from the sources in
[SOURCES.md](SOURCES.md); each section names where its facts come from. Items marked **(verify)** were not
confirmed by two sources or by the schematic and must be checked on Ehsan's board before a lesson states them.

## 1. The board

The EBAZ4205 is the control board of the Ebit E9+ Bitcoin miner. After the mining downturn these boards were sold
second-hand for a few dollars, which makes them the cheapest Zynq board around. The EBAZ4203 is almost the same.
(hhuysqt zynq[1], xjtuecho)

| Item | Value | Source |
|---|---|---|
| SoC | Xilinx Zynq-7010, `XC7Z010CLG400-1`: dual-core Cortex-A9 (666.67 MHz in the reference design) plus Artix-7-class fabric with about 28 K logic cells | zynq[1], xjtuecho, KeitetsuWorks |
| PL resources (for `BoardDef.resources`) | 17,600 LUTs, 35,200 FFs, 60 RAMB36 (2.1 Mb), 80 DSP48E1; user I/O: 100 on this package **(verify against UG865 / DS190 before shipping)** | Xilinx data sheet DS190 |
| DDR | 256 MB DDR3, 16-bit bus; either EM6GD16EWKG or MT41K128M16 is fitted. Vivado preset: `MT41K128M16 JT-125`, 2048 Mbit device | zynq[1], KeitetsuWorks |
| Flash | 128 MB SLC NAND (Winbond W29N01HV, ID 0xEF/0xF1) on the PS static memory controller, MIO 0 and 2-14, 8-bit | CodeAsm boot log, KeitetsuWorks |
| Ethernet | 10/100 Mbit, IP101GA PHY (the stock log says IP101A), MII, wired to PL pins: the PS MAC GEM0 reaches it through EMIO | zynq[1], xjtuecho, KeitetsuWorks |
| SD card | TF/microSD slot U7 on SD0 (MIO 40-45, card detect MIO 34). **Not fitted** on most boards: solder a slot | xjtuecho, KeitetsuWorks |
| UART | UART1 on MIO 24 (TX) and MIO 25 (RX), header **J7**, 115200 8N1, 3.3 V TTL. J7 is not fitted: solder a 3-pin header (TXD, RXD, GND; VCC not needed) | CodeAsm, zynq[2], xjtuecho |
| JTAG | 14-pin header **J8** (Xilinx 2 mm 14-pin layout **(verify)**), not fitted by default | zynq[1], xjtuecho |
| LEDs | Two on the core board, on PL pins: red `W14`, green `W13` (xjtuecho, KeitetsuWorks, gameltb; Elrori's EBAZEXT-V1 XDC swaps the colours). Colour and active level **(verify)**: the reference designs drive them straight from EMIO GPIO | xjtuecho, KeitetsuWorks, gameltb |
| Buttons | No PL button. Footprint **S3** (with C2410 and R2641A) can be populated; it is wired to the PS **(verify which MIO)** | KeitetsuWorks |
| PL clock | **None on the stock board.** Footprint **X5** on pin `N18` takes an oscillator (frequency is your choice; the reference XDC uses a 10 ns period). Otherwise the PL is clocked from the PS: `FCLK_CLK0` | xjtuecho |
| PHY clock | 25 MHz from crystal **Y3** when fitted. Cost-reduced boards have no Y3: the PS then makes 25 MHz on `FCLK_CLK3` and drives it out on PL pin `U18` | KeitetsuWorks |
| Expansion | Three 2x10 headers **DATA1, DATA2, DATA3**, **2.0 mm pitch** (not 2.54 mm). 14 FPGA pins each (pins 5-9, 11, 13-20); see `ebaz4205-master.xdc` | xjtuecho |
| Fans | J3 and J5 (originally fan power) with PWM and tach lines on PL pins: J3 PWM `U12`, J3 speed `V13`, J5 PWM `V12`, J5 speed `V15` | xjtuecho, gameltb |
| Power | With Ehsan's extension board (or EBAZEXT): 5 V from its USB-C socket through the DATA headers (§5). Stock: 5-12 V (at least 400 mA) into DATA1, DATA2 or DATA3, which have diodes to the board supply. 5 V works. With diode **D24** fitted (or shorted) the board can be powered from J3, J4 or J5; J3 or J5 is recommended. The 6-pin Mini-Fit Jr. header has ground on the top row and 12 V on the bottom row | xjtuecho, CodeAsm, zynq[1] |

### Hardware preparation (for lesson `z-intro`, "Prepare your board")

1. **Solder J7** (UART) and connect a 3.3 V USB-TTL adapter: board TX to adapter RX, board RX to adapter TX, GND to
   GND. Open a terminal at 115200 8N1. The stock firmware prints a U-Boot and PetaLinux 2016.4 boot log; pressing
   `d` at the U-Boot prompt stops autoboot. (CodeAsm, xjtuecho)
2. **Boot from SD card:** solder a microSD slot at U7, then move the 0 Ω resistor from **R2584** (NAND boot, the
   default) to **R2577** (SD boot). Shorting R2577 is enough according to KeitetsuWorks. (zynq[1], xjtuecho,
   KeitetsuWorks)
3. **JTAG:** solder the 14-pin header J8 to use a Xilinx-compatible programmer and Vivado Hardware Manager.
   Grounding R2578 at power-up forces JTAG boot, which is how NAND can be re-flashed. (CodeAsm)
4. **Power:** feed 5 V (or up to 12 V) into a DATA header's power pins, or fit/short D24 and use J3/J5. (xjtuecho)
5. **Optional:** a PL oscillator at X5 (`N18`), the S3 button, the Y3 crystal.

Safety note for the lesson: the stock firmware tries to reach a mining pool and its boot log contains a pool login;
the lesson should tell learners to wipe or ignore NAND and never reuse those credentials.

The four Zynq boot sources and how this board selects them (CodeAsm): NAND (default), QSPI (probably not wired
out), SD card (after the resistor move), JTAG (when no boot device answers).

## 2. Zynq in one page (lesson `z-intro` and `z-bootflow`)

- A Zynq is two chips in one package: the **PS** (processing system: two ARM Cortex-A9 cores, caches, the DDR
  controller, and hard peripherals such as UART, SD, Ethernet MAC, NAND and USB controllers) and the **PL**
  (programmable logic: the same LUTs, flip-flops, BRAM and DSP as an Artix-7). (zynq[1])
- The PS works without the PL. Its peripherals have fixed pins called **MIO** (54 of them). When MIO pins run out, or
  a peripheral should reach PL pins, it is routed through **EMIO** into the fabric and from there to PL package
  pins. The DDR pins are dedicated. (zynq[1]) On the EBAZ4205 the Ethernet MAC uses EMIO because the PHY is wired to
  PL pins.
- The PS talks to logic in the PL over **AXI** ports (`M_AXI_GP0` and others) and gives the PL up to four clocks,
  `FCLK_CLK0..3`. (KeitetsuWorks; general Zynq knowledge, UG585)
- **Boot has three stages** (zynq[1]):
  1. **BootROM** (in the chip, cannot be changed) reads the boot-mode straps (here: R2584/R2577), finds the boot image
     on NAND, SD, QSPI or waits for JTAG, and copies the **FSBL** into the 256 KB on-chip memory (OCM).
  2. **FSBL** (first-stage boot loader) sets up clocks, MIO and DDR with the code Vivado generated
     (`ps7_init.c`, more than 10,000 lines), loads the **bitstream** into the PL if the image has one, then loads the
     next program into DDR.
  3. **The application**: a bare-metal program, or U-Boot, which then starts Linux.
  The FSBL does the job of U-Boot's SPL, so with the Xilinx FSBL no SPL is needed.
- **BOOT.bin** holds those parts in order: FSBL, bitstream, application. `bootgen` builds it from a `.bif` file
  (see [boot.bif](boot.bif)); on an SD card it is just a file on a FAT partition. (zynq[1], zynq[2])

Figure to draw for `z-bootflow` (original SVG, in `figures.ts` style): straps → BootROM → OCM (FSBL) → DDR init →
PL configured (bitstream) → app in DDR, with the SD card's BOOT.bin split into its three parts.

## 3. PS configuration for this board (all lessons that use the PS)

From the KeitetsuWorks block design (Vivado 2021.2) and zynq[1]. Used by [create_ebaz_project.tcl](create_ebaz_project.tcl).

| Setting | Value |
|---|---|
| Part | `xc7z010clg400-1` |
| DDR | `PCW_UIPARAM_DDR_PARTNO = MT41K128M16 JT-125`, bus width 16 bit, device capacity 2048 Mbit |
| NAND | enabled, MIO 0 and 2-14, 8-bit (`PCW_NAND_GRP_D8_ENABLE = 0`); timings T_RC 50, T_WC 50, T_WP 25, T_REA 20, T_RR 20, T_CLR 20, T_AR 10 (cycles) |
| SD0 | MIO 40-45, card detect on MIO 34 |
| UART1 | MIO 24-25 |
| QSPI, USB0 | disabled |
| GPIO | MIO GPIO on; EMIO GPIO 64 bits (the reference design slices `GPIO_O[1:0]` out to the two LEDs) |
| ENET0 | enabled, I/O = EMIO, MDIO = EMIO, 100 Mbps, clock source External |
| Clocks | APU 666.67 MHz; `FCLK_CLK0` 50 MHz (FPGA Lab's PL clock); `FCLK_CLK3` 25 MHz for the PHY when Y3 is missing |
| PS reference clock | 33.333 MHz (Vivado default) **(verify on the schematic)** |

MII glue (zynq[1], KeitetsuWorks): the PS GMII buses are 8 bits, the PHY is 4-bit MII. Add an `xlslice`
(`DIN_WIDTH 8`, bits 3..0) on `ENET0_GMII_TXD` and an `xlconcat` (two 4-bit inputs) on `ENET0_GMII_RXD`, with the
upper input tied to zero. Make `GMII_RX_CLK`, `GMII_TX_CLK`, `TX_EN`, `RX_DV` and MDIO external. Without this, the
bitstream step fails on unplaced pins.

## 4. Flows (for the real-board lessons)

### 4.1 PL only, no software (lesson `z-blink`)

The PL still needs the PS for its clock, so even a blinking LED uses a block design: PS7 with `FCLK_CLK0` = 50 MHz,
the learner's `top` as a module reference, the remaining ports made external, HDL wrapper, XDC with `W13`/`W14`.
A bitstream alone does not start `FCLK_CLK0`; the PS must run `ps7_init` first. Two ways to get there:

- **JTAG:** in Vitis (or XSCT) run `ps7_init` and then download the bitstream. Vitis does this when you launch any
  application with "Program FPGA" ticked.
- **SD card:** BOOT.bin with FSBL + bitstream + a small application (an empty `main` loop is enough).

The lesson must say this plainly: on the EBAZ4205 "Program Device" from Vivado Hardware Manager alone leaves the
LEDs dark unless an oscillator is soldered at X5. **(verify on the board, then keep or drop this warning)**

### 4.2 First program on the ARM core (lesson `z-ps-hello`), after zynq[1]

1. Vivado: New project, part `xc7z010clg400-1`. Create Block Design, add **ZYNQ7 Processing System**, apply the
   settings of section 3. Run Block Automation (DDR and FIXED_IO external).
2. Generate Block Design, Create HDL Wrapper, Generate Bitstream.
3. Export Hardware **including the bitstream** (an `.xsa` file in Vivado 2019.2 and later; the older SDK flow used
   File → Launch SDK).
4. Vitis: create a platform from the `.xsa` (it builds the FSBL), then an application from the **Hello World**
   template ([code/ps_hello.c](code/ps_hello.c) is our version, which also blinks the LEDs).
5. **Create Boot Image**: FSBL, bitstream, application → `BOOT.bin`.
6. Copy `BOOT.bin` to a FAT-formatted SD card, insert, power on, watch J7 at 115200.

### 4.3 Ethernet echo (lesson `z-ethernet`), after zynq[1]

Block design as in 4.2 plus ENET0 over EMIO with the MII glue of section 3 and the Ethernet pins in the XDC (and
`FCLK_CLK3` on `U18` if Y3 is missing). In Vitis use the **lwIP Echo Server** template. Boot, plug in the network,
and `telnet <board-ip> 7`: each line typed comes back. The PHY sits at MDIO address 0 (zynq[2]).

### 4.4 Linux from scratch (lesson `z-linux`, advanced), after zynq[2]

Toolchain: `export ARCH=arm`, `export CROSS_COMPILE=arm-linux-gnueabihf-` with the Xilinx toolchain on `PATH`.

1. **U-Boot** (`u-boot-xlnx`): `make zynq_zc702_defconfig`; disable `CONFIG_ENV_IS_IN_SPI_FLASH` (otherwise U-Boot
   hangs probing SPI flash), enable `CONFIG_NAND` and `CONFIG_NAND_ZYNQ`; set memory to 256 MB; build. Rename
   `u-boot` to `u-boot.elf` before bootgen, or bootgen treats it as a raw binary.
2. **BOOT.bin:** `bootgen -image boot.bif -o i BOOT.bin -w` with FSBL, bitstream and `u-boot.elf`.
3. **Kernel** (`linux-xlnx`): `make xilinx_zynq_defconfig`, `make uImage UIMAGE_LOADADDR=0x8000`, `make dtbs`.
4. **Device tree** changes from the ZC702 tree: memory `reg = <0x0 0x10000000>`; disable `can0`, `i2c0`, `qspi`,
   `usb0`; UART pins MIO24 (TX) / MIO25 (RX); for `gem0` remove the pinctrl entries and the PHY reset GPIO, PHY node
   at address 0; remove the `sdhci0` pinctrl; enable `smcc`/`nand0` with the 8-bit NAND pin group; drop MIO 7-14 from
   the GPIO pin group (they belong to the NAND); remove `gpio-keys`, `leds` and `usb_phy0`.
5. **Root filesystem:** the Xilinx prebuilt ramdisk, wrapped with
   `mkimage -A arm -T ramdisk -C gzip -d arm_ramdisk.image.gz uramdisk.image.gz`.
6. **Boot over TFTP** from U-Boot: `setenv serverip <pc-ip>`, `dhcp`, `tftpboot 0 <board>.dtb`,
   `tftpboot 8000 uImage`, `tftpboot 1000000 uramdisk.image.gz`, `bootm 8000 1000000 0`.

NAND partition table of the stock firmware (offset, size), useful when restoring it: fsbl-uboot 0x0/0x300000,
linux 0x300000/0x500000, device-tree 0x800000/0x20000, rootfs 0x820000/0xA00000, jffs2 0x1220000/0x1000000,
bitstream 0x2220000/0x800000, allrootfs 0x2A20000/0x4000000, release 0x6A20000/0x13E0000,
reserve 0x7E00000/0x200000. (zynq[2], CodeAsm boot log)

A PetaLinux alternative (Vivado + PetaLinux 2021.2) is in the KeitetsuWorks repository; the lesson links to it
rather than repeating it.

## 5. Extension boards

### 5.1 Ehsan's extension board (the target)

Source: the schematic sheet Ehsan sent on 2026-11-21 (title «与主控板的连接», "connection to the main board"). The
pins are in `ebaz4205-master.xdc`. The sheet is cut below the HDMI part: **the LCD, keys and buzzer are still to be
read from the rest of it.**

- **Headers H1, H2, H3** (2x10, part 2543U-210CNG1SNT02) meet DATA1, DATA2, DATA3. Every signal pin is labelled with
  its FPGA pin, and the numbering is the same as the core board's (pin 10 not connected, pin 12 GND, pins 1-2 +5 V,
  3-4 GND), so no mirroring is involved: H1 pin 5 = DATA1 pin 5 = `A20`, and so on, exactly as in xjtuecho's XDC.
- **Power:** a USB-C socket («USB供电», USB power) gives +5 V; an HK1117C3.3 regulator makes 3.3 V; a red power LED
  (MHT192CRCT, 2 kΩ). The +5 V also reaches the core board through the header power pins.

| Feature | Parts | FPGA pins | Notes |
|---|---|---|---|
| HDMI out | HDMI socket, 49.9 Ω pull-ups to 3.3 V on all 8 TMDS lines (R1-R8) | CLK `F19`/`F20`, D0 `D19`/`D20`, D1 `C20`/`B20`, D2 `B19`/`A20` | TMDS straight from bank 35 (`TMDS_33`), no transmitter chip. Every pair is an `_P`/`_N` pair (L15, L4, L1, L2). DDC, CEC and HPD are **not connected**: no EDID reading. +5 V to the socket through D1 |
| USB serial | CH340C (no crystal needed), USB-C data lines; also a 4-pin header UART_USB_TTL (5V, H16, H17, GND) | UART_RX `H16` (from the PC), UART_TX `H17` (to the PC) | A PL UART at any baud rate the design picks. The PC sees a CH340 COM port |
| 3 LEDs | LED1-LED3 (E6C0603QBAC1UDA), 2 kΩ each | `E19`, `K17`, `H18` | Active high (cathode to GND) |
| LCD | "IPS130-12": a 1.3-inch IPS module with a 12-pin connector **(verify)**; usually a 240×240 ST7789 on SPI | `T20` is one of its pins (net `LCD_T20`); the rest **to read** | The lesson model is an ST7789 SPI LCD unless the rest of the sheet says otherwise |
| Keys | **to read** | **to read** | |
| Buzzer | **to read** | **to read** | Active (fixed tone) or passive (needs a tone)? |

Header pins not used by the parts above, so the LCD, keys and buzzer must be among them: H1 `D18`; H2 `G20 J18 G19
H20 J19 K18 K19 J20 L16 L19 M18 L20 M20 L17`; H3 `M19 N20 P18 M17 N17 P20 R18 R19 P19 T20 U20 T19 V20 U19`.

### 5.2 EBAZEXT (Elrori): another extension board, not Ehsan's

Source: [Elrori/EBAZ4205](https://github.com/Elrori/EBAZ4205), folders `EBAZEXT-V1` (Altium, PDF schematic, XDC) and
`EBAZEXT-V2` (KiCad 6 project, photo `ebazext-v2.png`). The V2 facts below were read from the KiCad PCB's netlist
(every pad and its net); V1 facts from `ebazextv1.xdc`. Its pins are in `ebazext-v2.xdc`. It has an audio jack and a
camera header but no LCD or buzzer, and its HDMI and UART use different pins from Ehsan's board. Kept as a possible
second extension board option.

#### How EBAZEXT meets the core board

- It plugs onto DATA1, DATA2 and DATA3 with three 2x10 2.0 mm sockets (J8, J7, J6 on the V2 PCB).
- The sockets are numbered mirror-wise to the headers: socket pin 2k-1 meets header pin 2k. Proof: socket pins 9
  (unconnected) and 11 (GND) land on header pins 10 and 12, the two header pins with no FPGA pin; and with the swap
  every differential pair on the extension board lands on an `_P`/`_N` pair of the FPGA (checked against Elrori's
  `xc7z010clg400pkg.txt`). The keys, LEDs, UART and audio then come out on exactly the pins of V1's XDC.
- Power: socket pins 1-2 carry +5 V and 3-4 GND. The extension board's USB-C connector supplies +5 V, so **one USB-C
  cable powers both boards** (through the DATA headers' power pins) and gives the serial port. An AMS1117 makes 3.3 V
  for the extension board; header J5 brings out 3V3, 5V and GND. Power LED D4.

#### What is on EBAZEXT-V2

| Feature | Parts | FPGA pins | Notes for the simulator and lessons |
|---|---|---|---|
| 2 keys | SW1, SW2 | KEY0 `U19`, KEY1 `P19` | 10 kΩ pull-up, pressed = 0 (active low). Both are clock-capable pins (MRCC) |
| 2 LEDs | D2, D3 | EXT_LED0 `T19`, EXT_LED1 `V20` | 1 kΩ to the LED, cathode to GND: 1 = on |
| USB serial | CH340G (12 MHz crystal), USB-C (5.1 kΩ CC pull-downs) | UART_RX `J20` (PC → FPGA), UART_TX `K19` (FPGA → PC) | A PL UART: the learner's own UART design talks to the PC. Shows up as a CH340 COM port |
| Audio out | 3.5 mm jack J2, 3.3 kΩ + 100 nF per channel | AUDIO_L `J19`, AUDIO_R `K18` | RC low-pass: PWM or a square wave becomes sound |
| HDMI out | HDMI socket J1, 49.9 Ω pull-ups to 3.3 V on all 8 TMDS lines | CLK `H16`/`H17`, D0 `F19`/`F20`, D1 `C20`/`B20`, D2 `B19`/`A20` | TMDS straight from the FPGA (bank 35, `TMDS_33`): no transmitter chip. Needs the TMDS encoder + 10:1 serializer |
| HDMI DDC | two AO3400 level shifters, 2.2 kΩ pull-ups both sides | HDMI_SCL `D19`, HDMI_SDA `D18` | Open-drain I²C to the monitor's EDID (5 V side). HPD has a 10 kΩ pull-down and is not wired to the FPGA; CEC has a 27 kΩ pull-up |
| GPIO header | J4, 2.54 mm, 8 pins | IO[0..5] = `G19 H20 G20 J18 K17 E19` | Pin order on J4: IO_5, IO_4, IO_3, IO_2, IO_1, IO_0, 3V3, GND. Takes the existing Add Module parts (HC-SR04, servo …) |
| Camera header | J3, 2.54 mm 2x9 | 16 lines, see the XDC | For OV7670/OV7725 modules; the pair on J3 pins 3-4 has 4.7 kΩ pull-ups (SCCB). Later lesson |

#### EBAZEXT-V1, for comparison

VGA (`vga_hs` G19, `vga_vs` H20, RGB565 `vgad[15:0]` on 16 DATA1/DATA2 pins) instead of HDMI; the camera signals
are named in its XDC (pclk P19, xclk P20, href R19, vsync N17, SCCB sclk R18 / sdat T20, pwdn L16, rst L19, 8 data
bits); KEY1 is on `U20` instead of `P19`. Same keys/LEDs/UART/audio otherwise.

## 6. Other boards that look similar (do not mix them up)

- **Antminer S9 control board** (Bitmain, "AntMiner ControlBoard XC7010 V1.01"): also a Zynq-7010 board sold cheaply
  for learning, but a different PCB with different pins. [KarolNi/S9miner_sample](https://github.com/KarolNi/S9miner_sample)
  is for this board (schematic PDF and projects P01_HELLO, P02_GPIO, P03_SD_TEST, P04_SD_BOOT). Useful as a model
  for the order of the PS lessons, not for pins. The EBAZ4205 is the control board of the **Ebit E9+** miner.
- **EBAZ4203**: almost identical to the EBAZ4205 (zynq[1]).

## 7. More boot and Linux material (blkf2016/ebaz4205)

[blkf2016/ebaz4205](https://github.com/blkf2016/ebaz4205): U-Boot 2019.07-rc4, Linux 5.1.5 and Buildroot 2019.05
for the EBAZ4205 (a Buildroot external tree under `buildroot/board/ebaz4205` and `buildroot/configs`), a ready
`BOOT.bin` and an SD-card image (`buildroot-sdcard.img.7z`; root password `root`).

Two ideas worth teaching from it:
- **An FSBL hook that loads U-Boot from a file.** A modified Xilinx FSBL (`main.c`) calls `UBootLoader()`
  (`uboot_loader.c`, GPLv3), which opens `u-boot.bin` on the SD card's FAT partition with FatFs, copies it to DDR at
  `0x04000000`, and hands off there. U-Boot can then be replaced by copying a file, without rebuilding BOOT.bin.
  Good material for `z-bootflow` ("the FSBL can load anything").
- **A second UART on the header:** its block design routes the PS UART0 through EMIO to `F19` (RX) and `F20` (TX),
  DATA1 pins 19 and 17. On both extension boards those pins carry HDMI, so this only applies without one.
