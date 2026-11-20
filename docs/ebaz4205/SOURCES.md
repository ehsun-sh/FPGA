# EBAZ4205 sources and credits

Everything in `docs/ebaz4205/` and `docs/EBAZ4205-ROADMAP.md` was prepared from the pages below (read on 2026-11-20).
Facts (pin numbers, part numbers, register values, the order of steps) are reused. Prose is our own; nothing is
translated or copied verbatim, and no images are reused. The lessons must show the credit lines in the last column
(fa and en) in a "Sources" box at the end of each EBAZ4205 lesson.

| Source | Author | License | What we took | Credit line in the lessons |
|---|---|---|---|---|
| [gist: EBAZ4205](https://gist.github.com/CodeAsm/57d5856370546adbc41941ca716988f8) (given by Ehsan) | CodeAsm | not stated | Stock board behaviour (boots from NAND, UART J7 at 115200), the four boot modes and the boot-select resistors, powering through DATA1-3 and the D24 mod, the link list | "Board notes: CodeAsm, gist EBAZ4205" |
| [zynq[1] mining-board helloworld](https://hhuysqt.github.io/zynq1/) (given by Ehsan) | hhuysqt, 2019-04-26 | CC BY-NC-SA 4.0 | Board summary, PS/PL and boot-stage explanation, the Vivado flow (PS7 with NAND, ENET0, SD0, UART1; DDR preset MT41K128M16; Ethernet over EMIO with the 8-to-4-bit fix), the SDK flow (FSBL, Hello World, Create Boot Image, SD card, lwIP echo on port 7) | "Vivado/SDK walkthrough after hhuysqt, zynq[1] (CC BY-NC-SA 4.0)" |
| [zynq[2] Linux from scratch](https://hhuysqt.github.io/zynq2/) (linked from zynq[1]) | hhuysqt, 2019-04-27 | CC BY-NC-SA 4.0 | Hand-built U-Boot, kernel and ramdisk: commands, `boot.bif`, device-tree changes (memory, UART on MIO 24/25, PHY address 0, NAND partitions) and the fixes | "Linux build after hhuysqt, zynq[2] (CC BY-NC-SA 4.0)" |
| [xjtuecho/EBAZ4205](https://github.com/xjtuecho/EBAZ4205) | xjtuecho | MIT | `Development/EBAZ4205.xdc` (DATA1-3 header pins, LEDs, fan pins, optional X5 clock on N18), board spec, boot resistor default, power and recovery notes, schematic and KiCad files (`HW/ebaz4205`) | "Pin map: xjtuecho/EBAZ4205 (MIT)" |
| [KeitetsuWorks/EBAZ4205](https://github.com/KeitetsuWorks/EBAZ4205) | Keitetsu | MIT | Vivado 2021.2 block design values (DDR, MIO tree, SD0 on MIO 40-45 with CD on 34, UART1 on 24-25, NAND, EMIO GPIO), FCLK_CLK3 = 25 MHz on U18 for boards without the Y3 crystal, LED wiring through EMIO GPIO, hardware mods (R2577, D24, S3) | "Block design: KeitetsuWorks/EBAZ4205 (MIT)" |
| [gameltb/EBAZ4205](https://github.com/gameltb/EBAZ4205) | gameltb | not stated | Cross-check only: the same LED and Ethernet pins, fan pins V12/U12/V15/V13 | (no text reused; not credited in lessons) |

MIT notices: when `src/boards/ebaz4205/pins.ts` is written from the xjtuecho and KeitetsuWorks constraint files, keep
their copyright lines in the file header comment (they are already in `ebaz4205-master.xdc`).

CC BY-NC-SA 4.0: we take facts and the sequence of steps, not the expression. If a later change wants to translate
passages or reuse screenshots, the result must be marked as an adaptation under CC BY-NC-SA 4.0 and kept
non-commercial; prefer writing our own text and taking our own screenshots.

Not read (blocked for automated fetches): embed-me.com "EBAZ4205 recycle cheap crypto miner" series,
programmersought.com translation, jianshu.com article. Worth a manual read before Phase E2.

Open: the extension board (HDMI, USB, LCD, IO keys, buzzer, serial port) has no public source that we could
identify. Its pin map must come from the seller's schematic or example projects (Phase E0 in the roadmap).
