## EBAZEXT-V1/V2 (Elrori) extension board for the EBAZ4205: an alternative to the board in ebaz4205-master.xdc.
## Not Ehsan's board (theirs has an LCD, a buzzer and different HDMI pins); kept so the site can offer it later.

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
