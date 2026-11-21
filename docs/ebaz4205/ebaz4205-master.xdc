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

## ---------------------------------------------------------------- Extension board (Ehsan's: HDMI, USB serial, LEDs, LCD, keys, buzzer)
## From the schematic Ehsan sent on 2026-11-21 (sheet title "与主控板的连接", connection to the main board). Its headers
## H1, H2, H3 (2x10) carry FPGA pin names and use the same numbering as the core board's DATA1, DATA2, DATA3
## (pin 10 not connected and pin 12 GND, as on the core board). Port names are the ones lessons and the simulator use.

## HDMI out: TMDS straight from bank 35, 49.9 Ohm pull-ups to 3.3 V on all eight lines (R1-R8).
## DDC (SCL/SDA), CEC and Hot Plug Detect are not connected; +5 V reaches the socket through D1 (1N4148WS).
#set_property -dict { PACKAGE_PIN F19 IOSTANDARD TMDS_33 } [get_ports { HDMI_CLK_P }]
#set_property -dict { PACKAGE_PIN F20 IOSTANDARD TMDS_33 } [get_ports { HDMI_CLK_N }]
#set_property -dict { PACKAGE_PIN D19 IOSTANDARD TMDS_33 } [get_ports { HDMI_D0_P }]
#set_property -dict { PACKAGE_PIN D20 IOSTANDARD TMDS_33 } [get_ports { HDMI_D0_N }]
#set_property -dict { PACKAGE_PIN C20 IOSTANDARD TMDS_33 } [get_ports { HDMI_D1_P }]
#set_property -dict { PACKAGE_PIN B20 IOSTANDARD TMDS_33 } [get_ports { HDMI_D1_N }]
#set_property -dict { PACKAGE_PIN B19 IOSTANDARD TMDS_33 } [get_ports { HDMI_D2_P }]
#set_property -dict { PACKAGE_PIN A20 IOSTANDARD TMDS_33 } [get_ports { HDMI_D2_N }]

## USB-C (power and serial) through a CH340C, also on the 4-pin header "UART_USB_TTL" (5V, H16, H17, GND).
## Seen from the FPGA: UART_RX = data from the PC (CH340C TXD), UART_TX = data to the PC (CH340C RXD).
#set_property -dict { PACKAGE_PIN H16 IOSTANDARD LVCMOS33 } [get_ports { UART_RX }]
#set_property -dict { PACKAGE_PIN H17 IOSTANDARD LVCMOS33 } [get_ports { UART_TX }]

## LEDs LED1-LED3: 2 kOhm to the LED, cathode to GND, 1 = on (active high)
#set_property -dict { PACKAGE_PIN E19 IOSTANDARD LVCMOS33 } [get_ports { EXT_LED[0] }]
#set_property -dict { PACKAGE_PIN K17 IOSTANDARD LVCMOS33 } [get_ports { EXT_LED[1] }]
#set_property -dict { PACKAGE_PIN H18 IOSTANDARD LVCMOS33 } [get_ports { EXT_LED[2] }]

## The rest of the board, from the vendor's full schematic ("adapter board_SCH.pdf", REV 1.0, 2022-03-20) and their
## example XDC files, which Ehsan sent on 2026-11-21.

## Keys KEY1-KEY5: active low (10 kOhm pull-up to 3.3 V, the key shorts the pin to GND: pressed = 0).
## They sit in a cross: KEY3 in the middle, KEY1 and KEY4 left and right, KEY2 and KEY5 above and below.
#set_property -dict { PACKAGE_PIN T19 IOSTANDARD LVCMOS33 } [get_ports { KEY1 }]
#set_property -dict { PACKAGE_PIN P19 IOSTANDARD LVCMOS33 } [get_ports { KEY2 }]
#set_property -dict { PACKAGE_PIN U20 IOSTANDARD LVCMOS33 } [get_ports { KEY3 }]
#set_property -dict { PACKAGE_PIN U19 IOSTANDARD LVCMOS33 } [get_ports { KEY4 }]
#set_property -dict { PACKAGE_PIN V20 IOSTANDARD LVCMOS33 } [get_ports { KEY5 }]

## Buzzer: passive (a small speaker), switched by an S8050 transistor. 1 = current flows; it needs a square wave.
#set_property -dict { PACKAGE_PIN D18 IOSTANDARD LVCMOS33 } [get_ports { BUZZER }]

## LCD "IPS130-12": 1.3-inch 240x240 IPS, ST7789 controller, SPI with a D/C line. CS is tied to ground on the board,
## so there is no CS pin. The backlight is switched by an S8050: LCD_BLK = 1 turns it on.
#set_property -dict { PACKAGE_PIN R19 IOSTANDARD LVCMOS33 } [get_ports { LCD_SCL }]
#set_property -dict { PACKAGE_PIN P20 IOSTANDARD LVCMOS33 } [get_ports { LCD_SDA }]
#set_property -dict { PACKAGE_PIN N17 IOSTANDARD LVCMOS33 } [get_ports { LCD_RES }]
#set_property -dict { PACKAGE_PIN R18 IOSTANDARD LVCMOS33 } [get_ports { LCD_DC }]
#set_property -dict { PACKAGE_PIN T20 IOSTANDARD LVCMOS33 } [get_ports { LCD_BLK }]

## Header H4 breaks out the header pins no part uses (all of DATA2, and M19 N20 P18 M17 of DATA3).
## The vendor's PL examples clock from N18 (an oscillator fitted at X5 on their boards); a stock EBAZ4205 has none,
## so FPGA Lab clocks the PL from the PS (FCLK_CLK0 = 50 MHz).
