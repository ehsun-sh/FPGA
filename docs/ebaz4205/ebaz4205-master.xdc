## EBAZ4205 (Zynq XC7Z010CLG400-1) master constraints for FPGA Lab.
## Prepared for src/boards/ebaz4205/pins.ts. Uncomment the lines you use and rename the ports to match your top level.
##
## Pin data: xjtuecho/EBAZ4205 Development/EBAZ4205.xdc (MIT License, Copyright (c) xjtuecho) and
## KeitetsuWorks/EBAZ4205 vivado/.../ebaz4205.xdc (MIT License, Copyright (c) 2021 Keitetsu), cross-checked
## with gameltb/EBAZ4205 and hhuysqt.github.io/zynq1. See docs/ebaz4205/SOURCES.md.
## All PL I/O on this board is 3.3 V (LVCMOS33).

## ---------------------------------------------------------------- Clock
## The stock board has NO oscillator on the PL side. FPGA Lab designs take clk from the PS: FCLK_CLK0 = 50 MHz,
## wired inside the block design (no PACKAGE_PIN line is needed for it).
## Only if you solder an oscillator at X5 (pin N18). The source file uses a 10 ns period; set it to your part.
#set_property -dict { PACKAGE_PIN N18 IOSTANDARD LVCMOS33 } [get_ports { clk }]
#create_clock -add -name clk_pin -period 10.00 -waveform {0 5} [get_ports { clk }]

## ---------------------------------------------------------------- LEDs (on the core board)
## Three sources (xjtuecho, KeitetsuWorks, gameltb) put red on W14 and green on W13; Elrori's EBAZEXT-V1 XDC has them the
## other way round. Check on the board.
#set_property -dict { PACKAGE_PIN W14 IOSTANDARD LVCMOS33 } [get_ports { LED_R }]
#set_property -dict { PACKAGE_PIN W13 IOSTANDARD LVCMOS33 } [get_ports { LED_G }]

## ---------------------------------------------------------------- Fan headers J3 and J5
#set_property -dict { PACKAGE_PIN U12 IOSTANDARD LVCMOS33 } [get_ports { J3_PWM }]
#set_property -dict { PACKAGE_PIN V13 IOSTANDARD LVCMOS33 } [get_ports { J3_SPEED }]
#set_property -dict { PACKAGE_PIN V12 IOSTANDARD LVCMOS33 } [get_ports { J5_PWM }]
#set_property -dict { PACKAGE_PIN V15 IOSTANDARD LVCMOS33 } [get_ports { J5_SPEED }]

## ---------------------------------------------------------------- DATA1 (2.0 mm 2x10 header; pin number = silkscreen)
## The source file lists no FPGA pin for header pins 1-4, 10 and 12 (power, ground or unused: confirm on the schematic).
#set_property -dict { PACKAGE_PIN A20 IOSTANDARD LVCMOS33 } [get_ports { DATA1_5 }]
#set_property -dict { PACKAGE_PIN H16 IOSTANDARD LVCMOS33 } [get_ports { DATA1_6 }]
#set_property -dict { PACKAGE_PIN B19 IOSTANDARD LVCMOS33 } [get_ports { DATA1_7 }]
#set_property -dict { PACKAGE_PIN B20 IOSTANDARD LVCMOS33 } [get_ports { DATA1_8 }]
#set_property -dict { PACKAGE_PIN C20 IOSTANDARD LVCMOS33 } [get_ports { DATA1_9 }]
#set_property -dict { PACKAGE_PIN H17 IOSTANDARD LVCMOS33 } [get_ports { DATA1_11 }]
#set_property -dict { PACKAGE_PIN D20 IOSTANDARD LVCMOS33 } [get_ports { DATA1_13 }]
#set_property -dict { PACKAGE_PIN D18 IOSTANDARD LVCMOS33 } [get_ports { DATA1_14 }]
#set_property -dict { PACKAGE_PIN H18 IOSTANDARD LVCMOS33 } [get_ports { DATA1_15 }]
#set_property -dict { PACKAGE_PIN D19 IOSTANDARD LVCMOS33 } [get_ports { DATA1_16 }]
#set_property -dict { PACKAGE_PIN F20 IOSTANDARD LVCMOS33 } [get_ports { DATA1_17 }]
#set_property -dict { PACKAGE_PIN E19 IOSTANDARD LVCMOS33 } [get_ports { DATA1_18 }]
#set_property -dict { PACKAGE_PIN F19 IOSTANDARD LVCMOS33 } [get_ports { DATA1_19 }]
#set_property -dict { PACKAGE_PIN K17 IOSTANDARD LVCMOS33 } [get_ports { DATA1_20 }]

## ---------------------------------------------------------------- DATA2
#set_property -dict { PACKAGE_PIN G20 IOSTANDARD LVCMOS33 } [get_ports { DATA2_5 }]
#set_property -dict { PACKAGE_PIN J18 IOSTANDARD LVCMOS33 } [get_ports { DATA2_6 }]
#set_property -dict { PACKAGE_PIN G19 IOSTANDARD LVCMOS33 } [get_ports { DATA2_7 }]
#set_property -dict { PACKAGE_PIN H20 IOSTANDARD LVCMOS33 } [get_ports { DATA2_8 }]
#set_property -dict { PACKAGE_PIN J19 IOSTANDARD LVCMOS33 } [get_ports { DATA2_9 }]
#set_property -dict { PACKAGE_PIN K18 IOSTANDARD LVCMOS33 } [get_ports { DATA2_11 }]
#set_property -dict { PACKAGE_PIN K19 IOSTANDARD LVCMOS33 } [get_ports { DATA2_13 }]
#set_property -dict { PACKAGE_PIN J20 IOSTANDARD LVCMOS33 } [get_ports { DATA2_14 }]
#set_property -dict { PACKAGE_PIN L16 IOSTANDARD LVCMOS33 } [get_ports { DATA2_15 }]
#set_property -dict { PACKAGE_PIN L19 IOSTANDARD LVCMOS33 } [get_ports { DATA2_16 }]
#set_property -dict { PACKAGE_PIN M18 IOSTANDARD LVCMOS33 } [get_ports { DATA2_17 }]
#set_property -dict { PACKAGE_PIN L20 IOSTANDARD LVCMOS33 } [get_ports { DATA2_18 }]
#set_property -dict { PACKAGE_PIN M20 IOSTANDARD LVCMOS33 } [get_ports { DATA2_19 }]
#set_property -dict { PACKAGE_PIN L17 IOSTANDARD LVCMOS33 } [get_ports { DATA2_20 }]

## ---------------------------------------------------------------- DATA3
#set_property -dict { PACKAGE_PIN M19 IOSTANDARD LVCMOS33 } [get_ports { DATA3_5 }]
#set_property -dict { PACKAGE_PIN N20 IOSTANDARD LVCMOS33 } [get_ports { DATA3_6 }]
#set_property -dict { PACKAGE_PIN P18 IOSTANDARD LVCMOS33 } [get_ports { DATA3_7 }]
#set_property -dict { PACKAGE_PIN M17 IOSTANDARD LVCMOS33 } [get_ports { DATA3_8 }]
#set_property -dict { PACKAGE_PIN N17 IOSTANDARD LVCMOS33 } [get_ports { DATA3_9 }]
#set_property -dict { PACKAGE_PIN P20 IOSTANDARD LVCMOS33 } [get_ports { DATA3_11 }]
#set_property -dict { PACKAGE_PIN R18 IOSTANDARD LVCMOS33 } [get_ports { DATA3_13 }]
#set_property -dict { PACKAGE_PIN R19 IOSTANDARD LVCMOS33 } [get_ports { DATA3_14 }]
#set_property -dict { PACKAGE_PIN P19 IOSTANDARD LVCMOS33 } [get_ports { DATA3_15 }]
#set_property -dict { PACKAGE_PIN T20 IOSTANDARD LVCMOS33 } [get_ports { DATA3_16 }]
#set_property -dict { PACKAGE_PIN U20 IOSTANDARD LVCMOS33 } [get_ports { DATA3_17 }]
#set_property -dict { PACKAGE_PIN T19 IOSTANDARD LVCMOS33 } [get_ports { DATA3_18 }]
#set_property -dict { PACKAGE_PIN V20 IOSTANDARD LVCMOS33 } [get_ports { DATA3_19 }]
#set_property -dict { PACKAGE_PIN U19 IOSTANDARD LVCMOS33 } [get_ports { DATA3_20 }]

## ---------------------------------------------------------------- Ethernet (PS GEM0 through EMIO, MII to the IP101GA PHY)
## The GMII buses of the PS are 8 bits; the PHY is MII (4 bits). Slice TXD[3:0] out and concat RXD with 4 zero bits.
#set_property -dict { PACKAGE_PIN U14 IOSTANDARD LVCMOS33 } [get_ports { ENET0_GMII_RX_CLK_0 }]
#set_property -dict { PACKAGE_PIN U15 IOSTANDARD LVCMOS33 } [get_ports { ENET0_GMII_TX_CLK_0 }]
#set_property -dict { PACKAGE_PIN W19 IOSTANDARD LVCMOS33 } [get_ports { ENET0_GMII_TX_EN_0[0] }]
#set_property -dict { PACKAGE_PIN W16 IOSTANDARD LVCMOS33 } [get_ports { ENET0_GMII_RX_DV_0 }]
#set_property -dict { PACKAGE_PIN Y17 IOSTANDARD LVCMOS33 } [get_ports { enet0_gmii_rxd[3] }]
#set_property -dict { PACKAGE_PIN V17 IOSTANDARD LVCMOS33 } [get_ports { enet0_gmii_rxd[2] }]
#set_property -dict { PACKAGE_PIN V16 IOSTANDARD LVCMOS33 } [get_ports { enet0_gmii_rxd[1] }]
#set_property -dict { PACKAGE_PIN Y16 IOSTANDARD LVCMOS33 } [get_ports { enet0_gmii_rxd[0] }]
#set_property -dict { PACKAGE_PIN Y19 IOSTANDARD LVCMOS33 } [get_ports { enet0_gmii_txd[3] }]
#set_property -dict { PACKAGE_PIN V18 IOSTANDARD LVCMOS33 } [get_ports { enet0_gmii_txd[2] }]
#set_property -dict { PACKAGE_PIN Y18 IOSTANDARD LVCMOS33 } [get_ports { enet0_gmii_txd[1] }]
#set_property -dict { PACKAGE_PIN W18 IOSTANDARD LVCMOS33 } [get_ports { enet0_gmii_txd[0] }]
#set_property -dict { PACKAGE_PIN W15 IOSTANDARD LVCMOS33 } [get_ports { MDIO_ETHERNET_0_0_mdc }]
#set_property -dict { PACKAGE_PIN Y14 IOSTANDARD LVCMOS33 } [get_ports { MDIO_ETHERNET_0_0_mdio_io }]
## Boards without the 25 MHz crystal Y3: the PHY clock comes from the PS (FCLK_CLK3 = 25 MHz) on U18.
#set_property -dict { PACKAGE_PIN U18 IOSTANDARD LVCMOS33 } [get_ports { FCLK_CLK3_0 }]

## ---------------------------------------------------------------- Extension board EBAZEXT-V2 (Elrori)
## From the EBAZEXT-V2 KiCad netlist (github.com/Elrori/EBAZ4205, EBAZEXT-V2/EBAZEXT-V2.kicad_pcb).
## The extension board's sockets are numbered mirror-wise to the core board's headers: socket pin 2k-1 meets
## header pin 2k. So socket pin 20 (HDMI_D0+) lands on DATA1 pin 19 = F19. Every differential pair checks out as
## an _P/_N pair in xc7z010clg400pkg.txt, and the keys, LEDs, UART and audio pins agree with EBAZEXT-V1's XDC.
## Port names below are the ones the lessons and the simulator use; keep them.

## Keys SW1/SW2: 10 kOhm pull-up to 3.3 V, pressed = 0 (active low)
#set_property -dict { PACKAGE_PIN U19 IOSTANDARD LVCMOS33 } [get_ports { KEY0 }]
#set_property -dict { PACKAGE_PIN P19 IOSTANDARD LVCMOS33 } [get_ports { KEY1 }]

## LEDs D2/D3: through 1 kOhm to ground, 1 = on (active high)
#set_property -dict { PACKAGE_PIN T19 IOSTANDARD LVCMOS33 } [get_ports { EXT_LED0 }]
#set_property -dict { PACKAGE_PIN V20 IOSTANDARD LVCMOS33 } [get_ports { EXT_LED1 }]

## USB-C serial (CH340G), seen from the FPGA: UART_RX = data from the PC, UART_TX = data to the PC
#set_property -dict { PACKAGE_PIN J20 IOSTANDARD LVCMOS33 } [get_ports { UART_RX }]
#set_property -dict { PACKAGE_PIN K19 IOSTANDARD LVCMOS33 } [get_ports { UART_TX }]

## 3.5 mm audio jack J2: each channel through 3.3 kOhm and 100 nF (an RC low-pass), so drive it with PWM or a square wave
#set_property -dict { PACKAGE_PIN J19 IOSTANDARD LVCMOS33 } [get_ports { AUDIO_L }]
#set_property -dict { PACKAGE_PIN K18 IOSTANDARD LVCMOS33 } [get_ports { AUDIO_R }]

## HDMI out J1: TMDS straight from bank 35 (3.3 V), 49.9 Ohm pull-ups to 3.3 V on every line (RN1, RN2)
#set_property -dict { PACKAGE_PIN H16 IOSTANDARD TMDS_33 } [get_ports { HDMI_CLK_P }]
#set_property -dict { PACKAGE_PIN H17 IOSTANDARD TMDS_33 } [get_ports { HDMI_CLK_N }]
#set_property -dict { PACKAGE_PIN F19 IOSTANDARD TMDS_33 } [get_ports { HDMI_D0_P }]
#set_property -dict { PACKAGE_PIN F20 IOSTANDARD TMDS_33 } [get_ports { HDMI_D0_N }]
#set_property -dict { PACKAGE_PIN C20 IOSTANDARD TMDS_33 } [get_ports { HDMI_D1_P }]
#set_property -dict { PACKAGE_PIN B20 IOSTANDARD TMDS_33 } [get_ports { HDMI_D1_N }]
#set_property -dict { PACKAGE_PIN B19 IOSTANDARD TMDS_33 } [get_ports { HDMI_D2_P }]
#set_property -dict { PACKAGE_PIN A20 IOSTANDARD TMDS_33 } [get_ports { HDMI_D2_N }]
## HDMI DDC (EDID), level-shifted to 5 V with AO3400 MOSFETs; open-drain, 2.2 kOhm pull-ups on both sides
#set_property -dict { PACKAGE_PIN D19 IOSTANDARD LVCMOS33 } [get_ports { HDMI_SCL }]
#set_property -dict { PACKAGE_PIN D18 IOSTANDARD LVCMOS33 } [get_ports { HDMI_SDA }]

## GPIO header J4 (2.54 mm, 8 pins: IO_5, IO_4, IO_3, IO_2, IO_1, IO_0, 3V3, GND)
#set_property -dict { PACKAGE_PIN G19 IOSTANDARD LVCMOS33 } [get_ports { IO[0] }]
#set_property -dict { PACKAGE_PIN H20 IOSTANDARD LVCMOS33 } [get_ports { IO[1] }]
#set_property -dict { PACKAGE_PIN G20 IOSTANDARD LVCMOS33 } [get_ports { IO[2] }]
#set_property -dict { PACKAGE_PIN J18 IOSTANDARD LVCMOS33 } [get_ports { IO[3] }]
#set_property -dict { PACKAGE_PIN K17 IOSTANDARD LVCMOS33 } [get_ports { IO[4] }]
#set_property -dict { PACKAGE_PIN E19 IOSTANDARD LVCMOS33 } [get_ports { IO[5] }]

## Camera header J3 (2.54 mm 2x9, OV7670/OV7725 style). J3 pin: 1 3V3, 2 GND, then the nets below.
## CAM_D0P/CAM_D0N (J3 pins 4/3) have 4.7 kOhm pull-ups: the camera's SCCB (I2C) lines.
#set_property -dict { PACKAGE_PIN U20 IOSTANDARD LVCMOS33 } [get_ports { CAM_D0N }]
#set_property -dict { PACKAGE_PIN T20 IOSTANDARD LVCMOS33 } [get_ports { CAM_D0P }]
#set_property -dict { PACKAGE_PIN R18 IOSTANDARD LVCMOS33 } [get_ports { CAM_D1 }]
#set_property -dict { PACKAGE_PIN R19 IOSTANDARD LVCMOS33 } [get_ports { CAM_D2 }]
#set_property -dict { PACKAGE_PIN P20 IOSTANDARD LVCMOS33 } [get_ports { CAM_D3N }]
#set_property -dict { PACKAGE_PIN N20 IOSTANDARD LVCMOS33 } [get_ports { CAM_D3P }]
#set_property -dict { PACKAGE_PIN P18 IOSTANDARD LVCMOS33 } [get_ports { CAM_D4N }]
#set_property -dict { PACKAGE_PIN N17 IOSTANDARD LVCMOS33 } [get_ports { CAM_D4P }]
#set_property -dict { PACKAGE_PIN M18 IOSTANDARD LVCMOS33 } [get_ports { CAM_D5N }]
#set_property -dict { PACKAGE_PIN M17 IOSTANDARD LVCMOS33 } [get_ports { CAM_D5P }]
#set_property -dict { PACKAGE_PIN M20 IOSTANDARD LVCMOS33 } [get_ports { CAM_D6N }]
#set_property -dict { PACKAGE_PIN M19 IOSTANDARD LVCMOS33 } [get_ports { CAM_D6P }]
#set_property -dict { PACKAGE_PIN L17 IOSTANDARD LVCMOS33 } [get_ports { CAM_D7N }]
#set_property -dict { PACKAGE_PIN L16 IOSTANDARD LVCMOS33 } [get_ports { CAM_D7P }]
#set_property -dict { PACKAGE_PIN L20 IOSTANDARD LVCMOS33 } [get_ports { CAM_D8N }]
#set_property -dict { PACKAGE_PIN L19 IOSTANDARD LVCMOS33 } [get_ports { CAM_D8P }]

## EBAZEXT-V1 differs (from Elrori's ebazextv1.xdc): VGA instead of HDMI (vga_hs G19, vga_vs H20, 16-bit RGB565
## vgad[15:0] on H16 A20 B20 B19 C20 H17 D18 D20 D19 H18 E19 F20 K17 F19 J18 G20, MSB first), KEY1 on U20,
## camera signals named (pclk P19, xclk P20, href R19, vsync N17, sclk R18, sdat T20, pwdn L16, rst L19,
## db[7:0] = M17 P18 N20 M19 M20 L17 M18 L20). Keys, LEDs, UART and audio are the same pins as V2.
