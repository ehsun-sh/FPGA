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

## ---------------------------------------------------------------- Extension board (HDMI, USB, LCD, keys, buzzer, serial)
## TO FILL IN from the extension board's schematic: which DATAx pin each signal uses. See EBAZ4205-ROADMAP.md, E0.
## Expected port names (keep them; lessons and the simulator use them):
##   KEY1..KEYn            push keys (level when pressed: to verify)
##   BUZZER                buzzer drive (active level, passive or active buzzer: to verify)
##   UART_TX, UART_RX      extension serial port, seen from the FPGA (USB-serial chip: to verify)
##   LCD_*                 LCD interface (SPI TFT or parallel character LCD: to verify)
##   HDMI_CLK_P/N, HDMI_D0_P/N .. HDMI_D2_P/N   TMDS pairs (TMDS_33 standard on real hardware)
