// The Vivado projects of the chapter "Linux on Zynq" (src/lessons/linux.ts). Every one keeps what Linux on the
// EBAZ4205 needs in the PL, GEM0 over EMIO with the MII glue and the two LEDs on EMIO GPIO 54/55, so the network and
// the heartbeat LED keep working whatever else the design holds:
//   'linux'    only that (lx-boot, lx-console)
//   'axigpio'  plus an AXI GPIO at 0x41200000 on M_AXI_GP0: LED1-LED3 on channel 1, KEY1-KEY5 on channel 2
//              (lx-gpio, lx-driver)
//   'linux-pl' plus the learner's module, clocked by FCLK_CLK0 (lx-fpgamgr: the second design, loaded from Linux)
// The build also writes the bitstream as a .bin for the FPGA manager, and the project folder gets sd/boot.cmd with
// boot.scr made from it (both by the Tcl in src/linux/files/fpgalab.tcl), boot.bif for a BOOT.bin that starts U-Boot,
// and the Linux sources (the /dev/mem program, the two kernel modules, the device-tree snippet and a Makefile).
import type { ProjectSpec } from "./project";
import { EBAZ_ENET, EBAZ_ENET_BD, EBAZ_ENET_XDC, EBAZ_LED_BD, EBAZ_LED_XDC, EBAZ_PS7 } from "./project";
import { FPGALAB_SCR } from "../linux/sim";
import fpgalabTcl from "../linux/files/fpgalab.tcl?raw";
import gpioMemC from "../linux/files/gpio_mem.c?raw";
import ledsC from "../linux/files/fpgalab_leds.c?raw";
import loadC from "../linux/files/fpgalab_load.c?raw";
import makefile from "../linux/files/Makefile?raw";
import dtsi from "../linux/files/fpgalab-leds.dtsi?raw";

export type LinuxMode = "linux" | "axigpio" | "linux-pl";
export const isLinuxMode = (m: string): m is LinuxMode => m === "linux" || m === "axigpio" || m === "linux-pl";
// the .bin each build writes (the simulated terminal hands out the same names)
export const binName = (m: LinuxMode) => (m === "axigpio" ? "axi_gpio.bin" : m === "linux-pl" ? "running_light.bin" : "linux_base.bin");

const AXI_XDC = `
## Extension board: LED1-LED3 (1 = on) on AXI GPIO channel 1, KEY1-KEY5 (active low) on channel 2
set_property -dict { PACKAGE_PIN E19 IOSTANDARD LVCMOS33 } [get_ports { EXT_LED[0] }]
set_property -dict { PACKAGE_PIN K17 IOSTANDARD LVCMOS33 } [get_ports { EXT_LED[1] }]
set_property -dict { PACKAGE_PIN H18 IOSTANDARD LVCMOS33 } [get_ports { EXT_LED[2] }]
set_property -dict { PACKAGE_PIN T19 IOSTANDARD LVCMOS33 } [get_ports { KEY[0] }]
set_property -dict { PACKAGE_PIN P19 IOSTANDARD LVCMOS33 } [get_ports { KEY[1] }]
set_property -dict { PACKAGE_PIN U20 IOSTANDARD LVCMOS33 } [get_ports { KEY[2] }]
set_property -dict { PACKAGE_PIN U19 IOSTANDARD LVCMOS33 } [get_ports { KEY[3] }]
set_property -dict { PACKAGE_PIN V20 IOSTANDARD LVCMOS33 } [get_ports { KEY[4] }]
`;

// the AXI GPIO, its SmartConnect and reset, wired by hand (no block automation, whose options change between versions)
const AXI_BD = `
# AXI GPIO at 0x41200000: channel 1 = 3 outputs (LED1-LED3), channel 2 = 5 inputs (KEY1-KEY5)
set gpio [create_bd_cell -type ip -vlnv xilinx.com:ip:axi_gpio:2.0 axi_gpio_0]
set_property -dict [list CONFIG.C_GPIO_WIDTH {3} CONFIG.C_ALL_OUTPUTS {1} CONFIG.C_IS_DUAL {1} \\
  CONFIG.C_GPIO2_WIDTH {5} CONFIG.C_ALL_INPUTS_2 {1}] $gpio
set sc [create_bd_cell -type ip -vlnv xilinx.com:ip:smartconnect:1.0 axi_sc]
set_property -dict [list CONFIG.NUM_SI {1} CONFIG.NUM_MI {1}] $sc
set rst [create_bd_cell -type ip -vlnv xilinx.com:ip:proc_sys_reset:5.0 rst_fclk0]
connect_bd_intf_net [get_bd_intf_pins ps7/M_AXI_GP0] [get_bd_intf_pins axi_sc/S00_AXI]
connect_bd_intf_net [get_bd_intf_pins axi_sc/M00_AXI] [get_bd_intf_pins axi_gpio_0/S_AXI]
connect_bd_net [get_bd_pins ps7/FCLK_CLK0] [get_bd_pins ps7/M_AXI_GP0_ACLK] [get_bd_pins axi_sc/aclk] \\
  [get_bd_pins axi_gpio_0/s_axi_aclk] [get_bd_pins rst_fclk0/slowest_sync_clk]
connect_bd_net [get_bd_pins ps7/FCLK_RESET0_N] [get_bd_pins rst_fclk0/ext_reset_in]
connect_bd_net [get_bd_pins rst_fclk0/peripheral_aresetn] [get_bd_pins axi_sc/aresetn] [get_bd_pins axi_gpio_0/s_axi_aresetn]
create_bd_port -dir O -from 2 -to 0 EXT_LED
connect_bd_net [get_bd_pins axi_gpio_0/gpio_io_o] [get_bd_ports EXT_LED]
create_bd_port -dir I -from 4 -to 0 KEY
connect_bd_net [get_bd_ports KEY] [get_bd_pins axi_gpio_0/gpio2_io_i]
assign_bd_address
foreach seg [get_bd_addr_segs -of_objects [get_bd_addr_spaces ps7/Data]] {
  if {[string match *axi_gpio_0* $seg]} {
    set_property offset 0x41200000 $seg
    set_property range 64K $seg
  }
}
`;

export function linuxProjectFiles(p: ProjectSpec): { name: string; data: string }[] {
  const mode = p.ps!.mode as LinuxMode;
  const dir = p.name.replace(/[^\w-]/g, "_") || "fpga_lab";
  const mhz = (p.internalClock?.hz ?? 50e6) / 1e6;
  const pl = mode === "linux-pl";
  const ext = p.lang === "verilog" ? "v" : "vhd";
  const srcFile = `src/${p.top}.${ext}`;
  const bin = binName(mode);
  // the learner's XDC without the clock line (FCLK_CLK0 is internal), then the fixed Linux pins
  const ic = p.internalClock;
  const clkRe = ic ? new RegExp(`get_ports\\s+(\\{\\s*)?${ic.port}(\\s*\\})?\\s*\\]`, "i") : null;
  const userXdc = pl
    ? `## Your design (from the editor)\n${p.xdc
        .split("\n")
        .map((l) => (clkRe && !/^\s*#/.test(l) && clkRe.test(l) ? `# (removed: ${ic!.port} comes from ${ic!.source}) ${l}` : l))
        .join("\n")}\n`
    : "";
  const xdc = userXdc + EBAZ_LED_XDC + EBAZ_ENET_XDC + (mode === "axigpio" ? AXI_XDC : "");
  const ps7 = EBAZ_PS7.replace("@MHZ@", String(mhz)).replace("CONFIG.PCW_USE_M_AXI_GP0 {0}", `CONFIG.PCW_USE_M_AXI_GP0 {${mode === "axigpio" ? 1 : 0}}`);
  const what = { linux: "the PL that Linux needs (Ethernet glue, EMIO LEDs)", axigpio: "the Linux PL plus an AXI GPIO for LED1-LED3 and KEY1-KEY5", "linux-pl": `the Linux PL plus your module "${p.top}"` }[mode];
  const tcl = `# Re-creates the FPGA Lab project ${dir} for the ${p.board} in Vivado: ${what}.
#   double-click build.bat (Windows) or run sh build.sh, or in the Vivado Tcl Shell:
#   cd C:/fpga/${dir}
#   vivado -mode batch -source create_project.tcl -tclargs build
#   (pick a folder without spaces or parentheses)
# The build writes the bitstream, system.xsa (for Vitis: the FSBL) and ${bin} (for the Linux FPGA manager).
set origin [file dirname [file normalize [info script]]]
set proj_name ${dir}
source $origin/linux/fpgalab.tcl

# the U-Boot script for the SD card: sd/boot.cmd -> sd/boot.scr
fpgalab_mkscr $origin/sd/boot.cmd $origin/sd/boot.scr
puts "boot.scr: $origin/sd/boot.scr"

create_project $proj_name $origin/vivado -part ${p.part} -force
set_property target_language ${p.lang === "vhdl" ? "VHDL" : "Verilog"} [current_project]
${pl ? `add_files -norecurse $origin/${srcFile}\n${p.lang === "vhdl" ? `set_property file_type {VHDL 2008} [get_files $origin/${srcFile}]\n` : ""}update_compile_order -fileset sources_1\n` : ""}add_files -fileset constrs_1 -norecurse $origin/constrs/${p.xdcName}

create_bd_design system
set ps [create_bd_cell -type ip -vlnv xilinx.com:ip:processing_system7:5.5 ps7]
set_property -dict [list \\
${ps7}
  CONFIG.PCW_GPIO_EMIO_GPIO_ENABLE {1} \\
  CONFIG.PCW_GPIO_EMIO_GPIO_IO {2} \\
${EBAZ_ENET}
] $ps
apply_bd_automation -rule xilinx.com:bd_rule:processing_system7 \\
  -config {make_external "FIXED_IO, DDR" apply_board_preset "0" Master "Disable" Slave "Disable"} $ps

${EBAZ_LED_BD}${EBAZ_ENET_BD}${mode === "axigpio" ? AXI_BD : ""}${
    pl
      ? `
# your design, clocked by FCLK_CLK0; its other ports become top-level ports under their own names
set u [create_bd_cell -type module -reference ${p.top} user_top]
connect_bd_net [get_bd_pins ps7/FCLK_CLK0] [get_bd_pins user_top/${ic?.port ?? "clk"}]
foreach pin [get_bd_pins -of_objects $u] {
  set n [get_property NAME $pin]
  if {$n ne "${ic?.port ?? "clk"}"} { make_bd_pins_external -name $n $pin }
}
`
      : ""
  }
validate_bd_design
save_bd_design
set wrapper [make_wrapper -files [get_files system.bd] -top]
add_files -norecurse $wrapper
set_property top system_wrapper [current_fileset]
update_compile_order -fileset sources_1

if {[info exists argv] && [lsearch -exact $argv build] >= 0} {
  launch_runs impl_1 -to_step write_bitstream -jobs 4
  wait_on_run impl_1
  if {[get_property PROGRESS [get_runs impl_1]] ne "100%"} { error "implementation failed: see vivado/$proj_name.runs/impl_1" }
  set bit [get_property DIRECTORY [get_runs impl_1]]/system_wrapper.bit
  file copy -force $bit $origin/system_wrapper.bit
  write_hw_platform -fixed -include_bit -force $origin/system.xsa
  fpgalab_bit2bin $bit $origin/${bin}
  puts "Bitstream: $origin/system_wrapper.bit"
  puts "XSA:       $origin/system.xsa"
  puts "BIN:       $origin/${bin}"
}
`;
  const bif = `// BOOT.bin that starts U-Boot (bootgen -image boot.bif -arch zynq -o BOOT.bin -w)
// fsbl.elf: Vitis builds it from system.xsa. system_wrapper.bit: this project's build.
// u-boot.bin: from the FAT partition of the blkf2016/ebaz4205 SD image (or Buildroot's output/images). It is a raw
// binary linked for 0x04000000, so it gets a load and a start address; with an ELF, write just "u-boot.elf".
the_ROM_image:
{
    [bootloader] fsbl.elf
    system_wrapper.bit
    [load=0x04000000, startup=0x04000000] u-boot.bin
}
`;
  const steps: Record<LinuxMode, string> = {
    linux: `This design is the base: the same PL as the blkf2016 image needs, so it can replace that image's boot.bin.`,
    axigpio: `On the board (lx-gpio):  devmem 0x41200000 32 5   lights LED1 and LED3;  devmem 0x41200008   reads the keys.
   Build linux/gpio_mem and the kernel module fpgalab_leds.ko on a Linux PC (make, see linux/Makefile).
   lx-driver: add linux/fpgalab-leds.dtsi to the device tree (make dtb), copy it to /boot and reboot.`,
    "linux-pl": `Keep the BOOT.bin of lx-gpio on the card. Copy ${bin} to /lib/firmware on the board and run
     insmod fpgalab_load.ko firmware=${bin}
   The whole PL is replaced: your design runs, the Ethernet glue (also in this design) keeps SSH working, and the
   AXI GPIO of lx-gpio is gone (do not touch 0x41200000 now). Load axi_gpio.bin the same way to go back.`,
  };
  const readme = `${dir} — exported from FPGA Lab (chapter "Linux on Zynq")
Board: ${p.board}   Part: ${p.part}

  create_project.tcl            re-creates the Vivado project; with "build" also the bitstream, system.xsa, ${bin}
  build.bat / build.sh          runs the build with no command to type (double-click build.bat on Windows)
  constrs/${p.xdcName.padEnd(21)} LED_R/LED_G, the Ethernet pins${mode === "axigpio" ? ", LED1-LED3 and KEY1-KEY5" : pl ? " and your design's pins" : ""}
${pl ? `  ${srcFile.padEnd(28)} your design (top: ${p.top})\n` : ""}  boot.bif                      BOOT.bin layout: FSBL, bitstream, U-Boot
  sd/boot.cmd, sd/boot.scr      the U-Boot script for the FAT partition (boot.scr is written when the Tcl runs)
  linux/                        gpio_mem.c, fpgalab_leds.c, fpgalab_load.c, fpgalab-leds.dtsi, Makefile, fpgalab.tcl

The SD card is the one from blkf2016/ebaz4205 (buildroot-sdcard.img: partition 1 FAT with boot.bin, u-boot.bin and
boot.scr; partition 2 ext4 with /boot/zImage and /boot/zynq-ebaz4205.dtb). Root password: root.

1. Build: vivado -mode batch -source create_project.tcl -tclargs build   (or double-click build.bat)
2. Vitis: create a platform from system.xsa; it builds the FSBL (fsbl.elf).
3. BOOT.bin: copy u-boot.bin from the card next to boot.bif, then
     bootgen -image boot.bif -arch zynq -o BOOT.bin -w
   (or Vitis > Create Boot Image with the same three partitions).
4. Copy BOOT.bin to the FAT partition as boot.bin (keep the old one as boot.bin.orig), and sd/boot.scr as boot.scr.
   The new boot.scr adds console=ttyPS0,115200 and clk_ignore_unused: without it Linux turns FCLK_CLK0 off as an
   unused clock and the PL logic stops.
5. Serial: J7 at 115200 8N1. Network: the board is 192.168.100.1 and hands your PC an address (dnsmasq); connect the
   PC straight to the board, not through your home router.  ssh root@192.168.100.1
6. ${steps[mode]}

Status: the PS and Ethernet settings are the ones of the lessons z-ps-hello and z-ethernet. This Linux project has
not yet been run in real Vivado by FPGA Lab; please report problems.

-------------------------------------------------------------------------------------------------- فارسی
۱. ساخت: روی build.bat دوبار کلیک کنید (یا vivado -mode batch -source create_project.tcl -tclargs build).
۲. در Vitis از system.xsa یک platform بسازید تا fsbl.elf ساخته شود.
۳. فایل u-boot.bin را از کارت SD کنار boot.bif بگذارید و با bootgen فایل BOOT.bin بسازید.
۴. BOOT.bin را با نام boot.bin و sd/boot.scr را با نام boot.scr در پارتیشن FAT کارت بریزید (نسخه‌ی قبلی را نگه دارید).
۵. سریال: J7 با 115200. شبکه: برد 192.168.100.1 است و به PC آدرس می‌دهد؛ PC را مستقیم به برد وصل کنید.
   ssh root@192.168.100.1  (رمز: root)
`;
  const files = [
    { name: `${dir}/constrs/${p.xdcName}`, data: xdc },
    { name: `${dir}/create_project.tcl`, data: tcl },
    { name: `${dir}/boot.bif`, data: bif },
    { name: `${dir}/sd/boot.cmd`, data: `${FPGALAB_SCR}\n` },
    { name: `${dir}/linux/fpgalab.tcl`, data: fpgalabTcl },
    { name: `${dir}/linux/gpio_mem.c`, data: gpioMemC },
    { name: `${dir}/linux/fpgalab_leds.c`, data: ledsC },
    { name: `${dir}/linux/fpgalab_load.c`, data: loadC },
    { name: `${dir}/linux/fpgalab-leds.dtsi`, data: dtsi },
    { name: `${dir}/linux/Makefile`, data: makefile },
    { name: `${dir}/README.txt`, data: readme },
  ];
  if (pl) files.unshift({ name: `${dir}/${srcFile}`, data: p.src });
  return files;
}
