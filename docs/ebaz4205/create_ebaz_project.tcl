# DRAFT for Phase E1 (src/synth/project.ts, EBAZ4205 branch). Not yet run in Vivado: verify in 2022.2+ and fix.
#
# Re-creates an FPGA Lab lesson as a Vivado project for the EBAZ4205:
#   * a block design "system" with the ZYNQ7 Processing System configured for this board,
#   * the learner's HDL module "top" added to the block design as a module reference,
#   * FCLK_CLK0 (50 MHz) wired to top/clk, every other port of top made external under its own name,
#   * the lesson XDC (without a clock pin: the clock is internal).
# Usage:  vivado -mode batch -source create_project.tcl [-tclargs build]
#
# PS settings follow KeitetsuWorks/EBAZ4205 (MIT) and hhuysqt.github.io/zynq1; see SOURCES.md.

set origin [file dirname [file normalize [info script]]]
set proj_name ebaz_lesson
create_project $proj_name $origin/vivado -part xc7z010clg400-1 -force
set_property target_language Verilog [current_project]
add_files -norecurse [glob $origin/src/*]
add_files -fileset constrs_1 -norecurse $origin/ebaz4205.xdc
update_compile_order -fileset sources_1

create_bd_design system
set ps [create_bd_cell -type ip -vlnv xilinx.com:ip:processing_system7:5.5 ps7]
set_property -dict [list \
  CONFIG.PCW_UIPARAM_DDR_PARTNO {MT41K128M16 JT-125} \
  CONFIG.PCW_UIPARAM_DDR_BUS_WIDTH {16 Bit} \
  CONFIG.PCW_NAND_PERIPHERAL_ENABLE {1} \
  CONFIG.PCW_NAND_GRP_D8_ENABLE {0} \
  CONFIG.PCW_SD0_PERIPHERAL_ENABLE {1} \
  CONFIG.PCW_SD0_SD0_IO {MIO 40 .. 45} \
  CONFIG.PCW_SD0_GRP_CD_ENABLE {1} \
  CONFIG.PCW_SD0_GRP_CD_IO {MIO 34} \
  CONFIG.PCW_UART1_PERIPHERAL_ENABLE {1} \
  CONFIG.PCW_UART1_UART1_IO {MIO 24 .. 25} \
  CONFIG.PCW_QSPI_PERIPHERAL_ENABLE {0} \
  CONFIG.PCW_USB0_PERIPHERAL_ENABLE {0} \
  CONFIG.PCW_GPIO_MIO_GPIO_ENABLE {1} \
  CONFIG.PCW_USE_M_AXI_GP0 {0} \
  CONFIG.PCW_FPGA0_PERIPHERAL_FREQMHZ {50} \
  CONFIG.PCW_EN_CLK0_PORT {1} \
] $ps
# DDR and FIXED_IO become external ports of the block design
apply_bd_automation -rule xilinx.com:bd_rule:processing_system7 \
  -config {make_external "FIXED_IO, DDR" apply_board_preset "0" Master "Disable" Slave "Disable"} $ps

# the learner's design
set u [create_bd_cell -type module -reference top user_top]
connect_bd_net [get_bd_pins ps7/FCLK_CLK0] [get_bd_pins user_top/clk]
foreach p [get_bd_pins -of_objects $u] {
  set n [get_property NAME $p]
  if {$n ne "clk"} { make_bd_pins_external -name $n $p }
}

validate_bd_design
save_bd_design
set wrapper [make_wrapper -files [get_files system.bd] -top]
add_files -norecurse $wrapper
set_property top system_wrapper [current_fileset]
update_compile_order -fileset sources_1

if {[lindex $argv 0] eq "build"} {
  launch_runs impl_1 -to_step write_bitstream -jobs 4
  wait_on_run impl_1
  # hardware description for Vitis (FSBL, hello world, BOOT.bin)
  write_hw_platform -fixed -include_bit -force $origin/system.xsa
}
