// "Download Vivado project": the sources, the constraints, the testbench and a Tcl script that re-creates the project
// in real Vivado (vivado -mode batch -source create_project.tcl), optionally running the whole flow to a bitstream.
import type { Lang } from "../hdl";
import { zip } from "../util/zip";

export interface ProjectSpec {
  name: string; // project name (a lesson id)
  lang: Lang;
  top: string;
  tbTop?: string;
  src: string;
  xdc: string;
  xdcName: string;
  tb?: string;
  part: string;
  board: string; // e.g. 'Digilent Nexys A7-100T'
  boardPart?: string;
  // Zynq boards: the PL clock comes from the PS (FCLK_CLK0), so the project is a block design around the PS
  internalClock?: { port: string; source: string; hz: number };
}

const firstUnit = (src: string, lang: Lang): string | undefined => {
  const re =
    lang === "verilog" ? /^\s*module\s+(\w+)/gm : /^\s*entity\s+(\w+)\s+is/gim;
  const names = [...src.matchAll(re)].map((m) => m[1]);
  return names[names.length - 1];
};

export function projectFiles(p: ProjectSpec): { name: string; data: string }[] {
  if (p.internalClock) return zynqProjectFiles(p);
  const ext = p.lang === "verilog" ? "v" : "vhd";
  const dir = p.name.replace(/[^\w-]/g, "_") || "fpga_lab";
  const srcFile = `src/${p.top}.${ext}`;
  const tbTop = p.tbTop ?? (p.tb ? firstUnit(p.tb, p.lang) : undefined);
  const tbFile = tbTop ? `sim/${tbTop}.${ext}` : "";
  const tcl = `# Re-creates this FPGA Lab project in Vivado.
#   GUI:    Tools > Run Tcl Script... and pick this file
#   batch:  vivado -mode batch -source create_project.tcl
#   batch, all the way to a bitstream:
#           vivado -mode batch -source create_project.tcl -tclargs build
set origin [file dirname [file normalize [info script]]]
set proj_name ${dir}

create_project $proj_name $origin/vivado -part ${p.part} -force
${p.boardPart ? `# needs the Digilent board files; harmless if they are missing\ncatch { set_property board_part ${p.boardPart} [current_project] }\n` : ""}set_property target_language ${p.lang === "verilog" ? "Verilog" : "VHDL"} [current_project]
set_property simulator_language Mixed [current_project]

add_files -norecurse $origin/${srcFile}
${p.lang === "vhdl" ? `set_property file_type {VHDL 2008} [get_files $origin/${srcFile}]\n` : ""}set_property top ${p.top} [current_fileset]

add_files -fileset constrs_1 -norecurse $origin/constrs/${p.xdcName}
${
  tbFile
    ? `add_files -fileset sim_1 -norecurse $origin/${tbFile}
${p.lang === "vhdl" ? `set_property file_type {VHDL 2008} [get_files $origin/${tbFile}]\n` : ""}set_property top ${tbTop} [get_filesets sim_1]
set_property -name {xsim.simulate.runtime} -value {all} -objects [get_filesets sim_1]
`
    : ""
}update_compile_order -fileset sources_1

if {[info exists argv] && [lsearch -exact $argv build] >= 0} {
  launch_runs synth_1 -jobs 4
  wait_on_run synth_1
  launch_runs impl_1 -to_step write_bitstream -jobs 4
  wait_on_run impl_1
  puts "Bitstream: [get_property DIRECTORY [get_runs impl_1]]/${p.top}.bit"
}
`;
  const readme = `${dir} — exported from FPGA Lab
Board: ${p.board}   Part: ${p.part}   Language: ${p.lang === "verilog" ? "Verilog" : "VHDL"}

  ${srcFile.padEnd(28)} design source (top: ${p.top})
  ${`constrs/${p.xdcName}`.padEnd(28)} pin constraints
${tbFile ? `  ${tbFile.padEnd(28)} testbench (top: ${tbTop})\n` : ""}  create_project.tcl            re-creates the Vivado project

Open it in Vivado:
  1. Start Vivado, then Tools > Run Tcl Script... and choose create_project.tcl
     (or: vivado -mode batch -source create_project.tcl -tclargs build)
  2. Run Synthesis, Run Implementation, Generate Bitstream.
  3. Open Hardware Manager, connect the board with USB and Program Device.
`;
  const files = [
    { name: `${dir}/${srcFile}`, data: p.src },
    { name: `${dir}/constrs/${p.xdcName}`, data: p.xdc },
    { name: `${dir}/create_project.tcl`, data: tcl },
    { name: `${dir}/README.txt`, data: readme },
  ];
  if (tbFile && p.tb)
    files.splice(2, 0, { name: `${dir}/${tbFile}`, data: p.tb });
  return files;
}

// the PS7 settings of the EBAZ4205 (docs/ebaz4205/CONTENT.md section 3; KeitetsuWorks/EBAZ4205, MIT, and
// hhuysqt.github.io/zynq1)
const EBAZ_PS7 = `  CONFIG.PCW_UIPARAM_DDR_PARTNO {MT41K128M16 JT-125} \\
  CONFIG.PCW_UIPARAM_DDR_BUS_WIDTH {16 Bit} \\
  CONFIG.PCW_NAND_PERIPHERAL_ENABLE {1} \\
  CONFIG.PCW_NAND_GRP_D8_ENABLE {0} \\
  CONFIG.PCW_SD0_PERIPHERAL_ENABLE {1} \\
  CONFIG.PCW_SD0_SD0_IO {MIO 40 .. 45} \\
  CONFIG.PCW_SD0_GRP_CD_ENABLE {1} \\
  CONFIG.PCW_SD0_GRP_CD_IO {MIO 34} \\
  CONFIG.PCW_UART1_PERIPHERAL_ENABLE {1} \\
  CONFIG.PCW_UART1_UART1_IO {MIO 24 .. 25} \\
  CONFIG.PCW_QSPI_PERIPHERAL_ENABLE {0} \\
  CONFIG.PCW_USB0_PERIPHERAL_ENABLE {0} \\
  CONFIG.PCW_GPIO_MIO_GPIO_ENABLE {1} \\
  CONFIG.PCW_USE_M_AXI_GP0 {0} \\
  CONFIG.PCW_EN_CLK0_PORT {1} \\
  CONFIG.PCW_FPGA0_PERIPHERAL_FREQMHZ {@MHZ@} \\`;

// The EBAZ4205 (Zynq) project: a block design "system" with the ZYNQ7 Processing System, the learner's top as a
// module reference, FCLK_CLK0 wired to its clock and every other port made external under its own name.
function zynqProjectFiles(p: ProjectSpec): { name: string; data: string }[] {
  const ic = p.internalClock!;
  const ext = p.lang === "verilog" ? "v" : "vhd";
  const dir = p.name.replace(/[^\w-]/g, "_") || "fpga_lab";
  const srcFile = `src/${p.top}.${ext}`;
  const mhz = ic.hz / 1e6;
  // the clock is internal: drop a PACKAGE_PIN line or create_clock for it (a learner with an oscillator at X5
  // keeps their own XDC and a Nexys-style project instead)
  const clkRe = new RegExp(`get_ports\\s+(\\{\\s*)?${ic.port}(\\s*\\})?\\s*\\]`, "i");
  const xdc = p.xdc
    .split("\n")
    .map((l) => (!/^\s*#/.test(l) && clkRe.test(l) ? `# (removed: ${ic.port} comes from ${ic.source} in the block design) ${l}` : l))
    .join("\n");
  const tcl = `# Re-creates this FPGA Lab design as a Vivado project for the ${p.board}.
#   GUI:    Tools > Run Tcl Script... and pick this file
#   batch:  vivado -mode batch -source create_project.tcl
#   batch, all the way to a bitstream and system.xsa (for Vitis):
#           vivado -mode batch -source create_project.tcl -tclargs build
#
# The PL of this board has no oscillator: ${ic.port} comes from the processing system (${ic.source} = ${mhz} MHz).
# So the project is a block design "system": the ZYNQ7 Processing System configured for the board, your module
# "${p.top}" as a module reference, ${ic.source} wired to ${p.top}/${ic.port} and every other port made external
# under its own name, so that ${p.xdcName} applies unchanged.
set origin [file dirname [file normalize [info script]]]
set proj_name ${dir}

create_project $proj_name $origin/vivado -part ${p.part} -force
set_property target_language ${p.lang === "verilog" ? "Verilog" : "VHDL"} [current_project]
add_files -norecurse $origin/${srcFile}
${p.lang === "vhdl" ? `set_property file_type {VHDL 2008} [get_files $origin/${srcFile}]\n` : ""}add_files -fileset constrs_1 -norecurse $origin/constrs/${p.xdcName}
update_compile_order -fileset sources_1

create_bd_design system
set ps [create_bd_cell -type ip -vlnv xilinx.com:ip:processing_system7:5.5 ps7]
set_property -dict [list \\
${EBAZ_PS7.replace("@MHZ@", String(mhz))}
] $ps
# DDR and FIXED_IO become external ports of the block design
apply_bd_automation -rule xilinx.com:bd_rule:processing_system7 \\
  -config {make_external "FIXED_IO, DDR" apply_board_preset "0" Master "Disable" Slave "Disable"} $ps

# your design
set u [create_bd_cell -type module -reference ${p.top} user_top]
connect_bd_net [get_bd_pins ps7/${ic.source}] [get_bd_pins user_top/${ic.port}]
foreach pin [get_bd_pins -of_objects $u] {
  set n [get_property NAME $pin]
  if {$n ne "${ic.port}"} { make_bd_pins_external -name $n $pin }
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
  # hardware description for Vitis (FSBL, application, BOOT.bin), with the bitstream inside
  write_hw_platform -fixed -include_bit -force $origin/system.xsa
  puts "Bitstream: [get_property DIRECTORY [get_runs impl_1]]/system_wrapper.bit"
  puts "XSA:       $origin/system.xsa"
}
`;
  const bif = `// BOOT.bin layout for an SD-card boot (bootgen -image boot.bif -arch zynq -o BOOT.bin -w)
// Order matters: the FSBL first, then the bitstream (configures the PL), then the application.
the_ROM_image:
{
    [bootloader] fsbl.elf
    system_wrapper.bit
    app.elf
}
`;
  const app = `// The smallest application for BOOT.bin: the FSBL has already run ps7_init (which starts ${ic.source}) and loaded
// the bitstream, so the PL design runs. Build it in Vitis from the "Empty Application (C)" template.
int main(void)
{
    for (;;) {
    }
    return 0;
}
`;
  const readme = `${dir} — exported from FPGA Lab
Board: ${p.board}   Part: ${p.part}   Language: ${p.lang === "verilog" ? "Verilog" : "VHDL"}

  ${srcFile.padEnd(28)} design source (top: ${p.top})
  ${`constrs/${p.xdcName}`.padEnd(28)} pin constraints (no clock pin: ${ic.port} is internal)
  create_project.tcl            re-creates the Vivado project with the PS block design
  boot.bif                      BOOT.bin layout for an SD-card boot
  vitis/app.c                   an empty application for BOOT.bin

The PL of the EBAZ4205 has no oscillator. Your ${ic.port} comes from the Zynq's processing system: ${ic.source} = ${mhz} MHz.
${ic.source} only starts after the PS has run ps7_init, so "Program Device" in Vivado Hardware Manager on its own
leaves the design without a clock (to be confirmed on your board). Use one of the two ways below.

1. Build (Vivado 2022.2 or later recommended)
   vivado -mode batch -source create_project.tcl -tclargs build
   This writes the bitstream and system.xsa (the hardware description for Vitis, bitstream included).
   Or in the GUI: Tools > Run Tcl Script..., then Generate Bitstream, then File > Export > Export Hardware
   (include the bitstream).

2a. Run over JTAG (needs header J8 soldered and a Xilinx-compatible programmer)
   Vitis: create a platform project from system.xsa, then an application from the "Empty Application (C)" or
   "Hello World" template, and Run As > Launch Hardware with "Program FPGA" ticked: Vitis runs ps7_init
   and loads the bitstream.

2b. Boot from an SD card (needs the slot U7 and the boot resistor moved from R2584 to R2577)
   Vitis: platform from system.xsa (this builds the FSBL), application from vitis/app.c (or Hello World).
   Create Boot Image with boot.bif: fsbl.elf, system_wrapper.bit, app.elf -> BOOT.bin.
   Copy BOOT.bin to a FAT-formatted card, insert it, power on. UART1 is on J7 at 115200 8N1.

Status: this script follows the KeitetsuWorks/EBAZ4205 reference design (MIT) and has not yet been run in real
Vivado by FPGA Lab; please report problems.

-------------------------------------------------------------------------------------------------- فارسی
PL برد EBAZ4205 نوسان‌ساز ندارد. کلاک ${ic.port} از بخش پردازنده‌ی Zynq می‌آید: ${ic.source} = ${mhz} مگاهرتز،
و فقط بعد از اجرای ps7_init روشن می‌شود. پس «Program Device» در Hardware Manager به‌تنهایی کافی نیست (روی برد
خودتان بررسی کنید).

۱. ساخت: vivado -mode batch -source create_project.tcl -tclargs build
   خروجی: فایل بیت‌استریم و system.xsa (توصیف سخت‌افزار برای Vitis، همراه با بیت‌استریم).
۲-الف. اجرا با JTAG (هدر J8 لحیم شده و پروگرامر سازگار با Xilinx): در Vitis از system.xsa یک platform بسازید،
   یک برنامه از قالب Empty Application یا Hello World، و با تیک «Program FPGA» اجرا کنید؛ Vitis خودش ps7_init
   را اجرا و بیت‌استریم را بارگذاری می‌کند.
۲-ب. بوت از کارت SD (اسلات U7 لحیم شده و مقاومت بوت از R2584 به R2577 منتقل شده): در Vitis، platform (که FSBL
   را می‌سازد) و برنامه‌ی vitis/app.c؛ با Create Boot Image و boot.bif فایل BOOT.bin بسازید، روی کارت FAT بریزید
   و برد را روشن کنید. UART1 روی J7 با سرعت 115200 است.
`;
  return [
    { name: `${dir}/${srcFile}`, data: p.src },
    { name: `${dir}/constrs/${p.xdcName}`, data: xdc },
    { name: `${dir}/create_project.tcl`, data: tcl },
    { name: `${dir}/boot.bif`, data: bif },
    { name: `${dir}/vitis/app.c`, data: app },
    { name: `${dir}/README.txt`, data: readme },
  ];
}

export function projectZip(p: ProjectSpec): Uint8Array {
  return zip(projectFiles(p));
}
