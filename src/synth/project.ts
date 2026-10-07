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
}

const firstUnit = (src: string, lang: Lang): string | undefined => {
  const re =
    lang === "verilog" ? /^\s*module\s+(\w+)/gm : /^\s*entity\s+(\w+)\s+is/gim;
  const names = [...src.matchAll(re)].map((m) => m[1]);
  return names[names.length - 1];
};

export function projectFiles(p: ProjectSpec): { name: string; data: string }[] {
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

export function projectZip(p: ProjectSpec): Uint8Array {
  return zip(projectFiles(p));
}
