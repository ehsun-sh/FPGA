// Double-click scripts that run Vivado without typing a command: build.bat / build.sh in every exported project,
// program.bat / program.sh for boards Vivado can program over JTAG, and start-helper.bat / start-helper.sh for the
// FPGA Lab helper (src/helper/fpgalab-helper.tcl). Windows .bat files get CRLF line endings: cmd.exe misreads labels
// and `call :sub` in LF-only files.

export const crlf = (s: string) => s.replace(/\r?\n/g, '\r\n');

// sets VIVADO to vivado.bat: %FPGALAB_VIVADO% if set, then PATH, then the newest version in the usual install folders
// (C:\Xilinx\Vivado\<ver> before 2025.1; C:\Xilinx\<ver>\Vivado and C:\AMDDesignTools\<ver>\Vivado after)
const FIND_VIVADO_BAT = `:find_vivado
if defined FPGALAB_VIVADO if exist "%FPGALAB_VIVADO%" set "VIVADO=%FPGALAB_VIVADO%"
if defined VIVADO exit /b 0
for %%V in (vivado.bat) do set "VIVADO=%%~$PATH:V"
if defined VIVADO exit /b 0
for %%R in (C:\\Xilinx\\Vivado D:\\Xilinx\\Vivado C:\\AMD\\Vivado) do (
  if not defined VIVADO for /f "delims=" %%D in ('dir /b /ad /o-n "%%R" 2^>nul') do (
    if not defined VIVADO if exist "%%R\\%%D\\bin\\vivado.bat" set "VIVADO=%%R\\%%D\\bin\\vivado.bat"
  )
)
for %%R in (C:\\Xilinx D:\\Xilinx C:\\AMDDesignTools D:\\AMDDesignTools C:\\AMD) do (
  if not defined VIVADO for /f "delims=" %%D in ('dir /b /ad /o-n "%%R" 2^>nul') do (
    if not defined VIVADO if exist "%%R\\%%D\\Vivado\\bin\\vivado.bat" set "VIVADO=%%R\\%%D\\Vivado\\bin\\vivado.bat"
  )
)
exit /b 0
`;

const NO_VIVADO_BAT = `:novivado
echo.
echo Vivado was not found. Install AMD Vivado, or set FPGALAB_VIVADO to the full path of vivado.bat,
echo for example:  setx FPGALAB_VIVADO C:\\Xilinx\\Vivado\\2024.2\\bin\\vivado.bat
echo Vivado peyda nashod. Vivado ra nasb konid ya masire vivado.bat ra dar FPGALAB_VIVADO bogzarid.
echo.
pause
exit /b 1
`;

// vivado.bat cannot start from a folder whose path has parentheses (for example "Downloads (2)")
const PAREN_CHECK_BAT = `echo "%~dp0" | find "(" >nul && echo WARNING: this folder's path has "(" in it, and vivado.bat fails on such paths. Move the folder to a plain path such as C:\\fpga.
`;

// sets V to vivado: $FPGALAB_VIVADO, PATH, then the newest version under /tools/Xilinx, /opt/Xilinx and ~/Xilinx
const FIND_VIVADO_SH = `find_vivado() {
  if [ -n "$FPGALAB_VIVADO" ] && [ -x "$FPGALAB_VIVADO" ]; then echo "$FPGALAB_VIVADO"; return; fi
  if command -v vivado >/dev/null 2>&1; then command -v vivado; return; fi
  for v in $(ls -d /tools/Xilinx/Vivado/*/bin/vivado /opt/Xilinx/Vivado/*/bin/vivado "$HOME"/Xilinx/Vivado/*/bin/vivado \\
      /tools/Xilinx/*/Vivado/bin/vivado /opt/Xilinx/*/Vivado/bin/vivado "$HOME"/Xilinx/*/Vivado/bin/vivado 2>/dev/null | sort -V -r); do
    if [ -x "$v" ]; then echo "$v"; return; fi
  done
}
V=$(find_vivado)
if [ -z "$V" ]; then
  echo "Vivado was not found. Install AMD Vivado, or set FPGALAB_VIVADO to the full path of the vivado program."
  exit 1
fi
`;

// build.bat: re-creates the project and runs synthesis, implementation and write_bitstream
export function buildBat(dir: string): string {
  return crlf(`@echo off
rem FPGA Lab: double-click to build ${dir} in Vivado (no command to type).
setlocal EnableExtensions
cd /d "%~dp0"
title FPGA Lab - building ${dir}
${PAREN_CHECK_BAT}call :find_vivado
if not defined VIVADO goto novivado
echo Vivado: %VIVADO%
echo Building ${dir}. This takes a few minutes; the full log goes to build.log.
call "%VIVADO%" -mode batch -nojournal -log build.log -source create_project.tcl -tclargs build
set "ERR=%ERRORLEVEL%"
echo.
if "%ERR%"=="0" echo Done. Open vivado\\${dir}.xpr in Vivado, or run program.bat if this folder has one.
if not "%ERR%"=="0" echo The build failed (exit code %ERR%). See the ERROR lines above or build.log.
pause
exit /b %ERR%

${NO_VIVADO_BAT}
${FIND_VIVADO_BAT}`);
}

export function buildSh(dir: string): string {
  return `#!/bin/sh
# FPGA Lab: builds ${dir} in Vivado. Run with:  sh build.sh   (or make it executable and double-click it)
cd "$(dirname "$0")" || exit 1
${FIND_VIVADO_SH}echo "Vivado: $V"
echo "Building ${dir}. This takes a few minutes; the full log goes to build.log."
exec "$V" -mode batch -nojournal -log build.log -source create_project.tcl -tclargs build
`;
}

// program_board.tcl: loads the bitstream from the last build into the board over JTAG (USB)
export function programTcl(part: string): string {
  const dev = (part.match(/^[a-z]+\d+[a-z]+\d+t?/i)?.[0] ?? '').toLowerCase();
  return `# Programs the board with the bitstream of the last build, over the USB-JTAG cable.
#   vivado -mode batch -source program_board.tcl   (program.bat / program.sh do this for you)
set origin [file dirname [file normalize [info script]]]
set bits [glob -nocomplain $origin/vivado/*.runs/impl_1/*.bit]
if {![llength $bits]} {
  puts "ERROR: there is no bitstream yet. Build the project first (build.bat, or Build in Vivado on the website)."
  exit 1
}
set bit [lindex $bits 0]
open_hw_manager
connect_hw_server -allow_non_jtag
if {[catch {open_hw_target} err]} {
  puts "ERROR: no board found. Connect the board with USB, turn it on, and try again."
  exit 1
}
set dev [lindex [get_hw_devices -quiet ${dev}*] 0]
if {$dev eq ""} { set dev [lindex [get_hw_devices] 0] }
current_hw_device $dev
refresh_hw_device -update_hw_probes false $dev
set_property PROGRAM.FILE $bit $dev
program_hw_devices $dev
puts "Programmed $dev with [file tail $bit]"
close_hw_target
disconnect_hw_server
close_hw_manager
`;
}

export function programBat(dir: string): string {
  return crlf(`@echo off
rem FPGA Lab: double-click to program the board with the bitstream of ${dir}.
setlocal EnableExtensions
cd /d "%~dp0"
title FPGA Lab - programming the board
call :find_vivado
if not defined VIVADO goto novivado
call "%VIVADO%" -mode batch -nojournal -log program.log -source program_board.tcl
set "ERR=%ERRORLEVEL%"
pause
exit /b %ERR%

${NO_VIVADO_BAT}
${FIND_VIVADO_BAT}`);
}

export function programSh(): string {
  return `#!/bin/sh
# FPGA Lab: programs the board with the last bitstream. Run with:  sh program.sh
cd "$(dirname "$0")" || exit 1
${FIND_VIVADO_SH}exec "$V" -mode batch -nojournal -log program.log -source program_board.tcl
`;
}

// the helper's launchers: Vivado's own Tcl runs the helper, so nothing else has to be installed
export function startHelperBat(): string {
  return crlf(`@echo off
rem FPGA Lab helper: double-click to let the FPGA Lab website build projects with Vivado on this computer.
rem Keep this window open while you work; close it to stop the helper.
setlocal EnableExtensions
cd /d "%~dp0"
title FPGA Lab helper
${PAREN_CHECK_BAT}call :find_vivado
if not defined VIVADO goto novivado
echo Starting the FPGA Lab helper with %VIVADO% ...
call "%VIVADO%" -mode batch -nojournal -nolog -notrace -source fpgalab-helper.tcl
pause
exit /b 0

${NO_VIVADO_BAT}
${FIND_VIVADO_BAT}`);
}

export function startHelperSh(): string {
  return `#!/bin/sh
# FPGA Lab helper: lets the FPGA Lab website build projects with Vivado on this computer.
# Run with:  sh start-helper.sh   and keep the terminal open while you work (Ctrl+C stops it).
cd "$(dirname "$0")" || exit 1
${FIND_VIVADO_SH}echo "Starting the FPGA Lab helper with $V ..."
exec "$V" -mode batch -nojournal -nolog -notrace -source fpgalab-helper.tcl
`;
}
