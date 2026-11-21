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
| [Elrori/EBAZ4205](https://github.com/Elrori/EBAZ4205) (given by Ehsan, 2026-11-21) | Elrori | not stated | Core board schematic and PCB (`ebit.pdf`, `ebit.pcb`), the XC7Z010-CLG400 package file (pin → `_P`/`_N` pair), and the **EBAZEXT extension board**: V1 (Altium, PDF schematic, `ebazextv1.xdc`) and V2 (KiCad project). All extension-board pins come from here | "Extension board: Elrori/EBAZ4205 (EBAZEXT)" |
| [blkf2016/ebaz4205](https://github.com/blkf2016/ebaz4205) (given by Ehsan) | blkf2016 | `uboot_loader.c`: GPL-3.0; FSBL `main.c`: Xilinx MIT-style | U-Boot/Linux/Buildroot versions, the FSBL hook that loads `u-boot.bin` from SD to `0x04000000`, PS UART0 over EMIO on F19/F20. Facts only: no GPL code is copied into the site | "U-Boot and Buildroot notes: blkf2016/ebaz4205" |
| [KarolNi/S9miner_sample](https://github.com/KarolNi/S9miner_sample) (given by Ehsan) | KarolNi | not stated | Nothing board-specific: it is for the **Antminer S9 control board**, a different Zynq-7010 board. Its project order (hello, GPIO, SD test, SD boot) confirms the order of the PS lessons | (not credited in lessons) |
| [gameltb/EBAZ4205](https://github.com/gameltb/EBAZ4205) | gameltb | not stated | Cross-check only: the same LED and Ethernet pins, fan pins V12/U12/V15/V13 | (no text reused; not credited in lessons) |

MIT notices: when `src/boards/ebaz4205/pins.ts` is written from the xjtuecho and KeitetsuWorks constraint files, keep
their copyright lines in the file header comment (they are already in `ebaz4205-master.xdc`).

CC BY-NC-SA 4.0: we take facts and the sequence of steps, not the expression. If a later change wants to translate
passages or reuse screenshots, the result must be marked as an adaptation under CC BY-NC-SA 4.0 and kept
non-commercial; prefer writing our own text and taking our own screenshots.

Not read (blocked for automated fetches): embed-me.com "EBAZ4205 recycle cheap crypto miner" series,
programmersought.com translation, jianshu.com article. Worth a manual read before Phase E2.

Resolved on 2026-11-21: the extension board design is Elrori's EBAZEXT (V2 read from its KiCad netlist, V1 from its
XDC). Still open: whether Ehsan's own board is EBAZEXT-V2, since it has no LCD and no buzzer (CONTENT.md §5).
