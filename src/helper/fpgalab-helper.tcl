# FPGA Lab helper: lets the FPGA Lab website build its Vivado projects on this computer with one click.
#
# It runs inside Vivado's own Tcl, so nothing else has to be installed: start-helper.bat (Windows) or
# start-helper.sh (Linux, macOS) starts it with "vivado -mode batch -source fpgalab-helper.tcl".
# Keep its window open while you work; close the window (or press Ctrl+C) to stop it.
#
# What it can do, and nothing more:
#   - listen on http://127.0.0.1:@PORT@ only (other computers cannot reach it)
#   - answer only the FPGA Lab pages listed in ALLOWED below (other websites get "403 Forbidden")
#   - write project files into the projects folder you choose, under one sub-folder per project
#   - run Vivado in batch mode on a project's create_project.tcl (build) or program_board.tcl (program)
#   - open a project folder in the file manager, or a project in the Vivado GUI
#
# The projects folder is remembered in fpgalab-helper.cfg next to this file.

set ::ALLOWED {@ORIGINS@}
set ::PORT @PORT@
set ::VERSION 1

set ::here [file dirname [file normalize [info script]]]
set ::cfg [file join $::here fpgalab-helper.cfg]
set ::root [file join $::here projects]
if {[file exists $::cfg]} {
  catch {
    set f [open $::cfg r]
    fconfigure $f -encoding utf-8
    set r [string trim [read $f]]
    close $f
    if {$r ne ""} { set ::root $r }
  }
}
if {[info exists ::env(FPGALAB_ROOT)] && $::env(FPGALAB_ROOT) ne ""} { set ::root [file normalize $::env(FPGALAB_ROOT)] }
if {[info exists ::env(FPGALAB_PORT)] && [string is integer -strict $::env(FPGALAB_PORT)]} { set ::PORT $::env(FPGALAB_PORT) }

set ::busy 0
set ::jobid 0

# ---------------------------------------------------------------- helpers
proc json_str {s} {
  set s [string map {\\ \\\\ \" \\\" \n \\n \r \\r \t \\t} $s]
  regsub -all {[\x00-\x1f]} $s {} s
  return "\"$s\""
}
proc json_obj {args} {
  # json_obj key value-already-json ...
  set parts {}
  foreach {k v} $args { lappend parts "[json_str $k]:$v" }
  return "\{[join $parts ,]\}"
}
proc json_list {items} {
  set parts {}
  foreach i $items { lappend parts [json_str $i] }
  return "\[[join $parts ,]\]"
}
proc bool {x} { expr {$x ? "true" : "false"} }

proc urldecode {s} {
  set s [string map {+ { } \\ \\\\} $s]
  set s [subst -nocommands -novariables [regsub -all {%([0-9A-Fa-f]{2})} $s {\\u00\1}]]
  return [encoding convertfrom utf-8 $s]
}
proc parse_query {q} {
  set d [dict create]
  foreach kv [split $q &] {
    if {$kv eq ""} continue
    set i [string first = $kv]
    if {$i < 0} { dict set d [urldecode $kv] "" } else {
      dict set d [urldecode [string range $kv 0 [expr {$i - 1}]]] [urldecode [string range $kv [expr {$i + 1}] end]]
    }
  }
  return $d
}
proc param {q k {def ""}} { if {[dict exists $q $k]} { return [dict get $q $k] } else { return $def } }

proc origin_ok {o} {
  if {$o in $::ALLOWED} { return 1 }
  # a copy of the site running on this computer (npm run dev / preview)
  return [regexp {^http://(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?$} $o]
}

# one folder name, as the website makes them (projectDir in src/synth/project.ts)
proc safe_dir {d} {
  if {![regexp {^[A-Za-z0-9_-]{1,80}$} $d]} { error "bad project name: $d" }
  return $d
}
# a relative path inside a project: plain names only, no "..", no drive letters
proc safe_rel {p} {
  set parts [split $p /]
  if {[llength $parts] < 1 || [llength $parts] > 6} { error "bad path: $p" }
  foreach x $parts {
    if {![regexp {^[A-Za-z0-9_][A-Za-z0-9_.-]{0,100}$} $x] || [string match *..* $x]} { error "bad path: $p" }
  }
  return $parts
}
proc project_path {d} { file join $::root [safe_dir $d] }

proc save_cfg {} {
  catch {
    set f [open $::cfg w]
    fconfigure $f -encoding utf-8
    puts $f $::root
    close $f
  }
}

# the Vivado to run for builds. The helper itself runs in Vivado, so its environment is already set up.
proc vivado_cmd {} {
  if {[info exists ::env(FPGALAB_VIVADO)] && $::env(FPGALAB_VIVADO) ne ""} { return [list $::env(FPGALAB_VIVADO)] }
  set exe [info nameofexecutable]
  if {$::tcl_platform(platform) eq "windows"} {
    # vivado.bat, the official launcher (the project folder is the working directory, so no path goes through cmd)
    if {[info exists ::env(XILINX_VIVADO)]} {
      set b [file join $::env(XILINX_VIVADO) bin vivado.bat]
      if {[file exists $b]} { return [list cmd.exe /c [file nativename $b]] }
    }
    if {[string match -nocase vivado.exe [file tail $exe]]} { return [list $exe] }
  } else {
    if {[info exists ::env(XILINX_VIVADO)]} {
      set b [file join $::env(XILINX_VIVADO) bin vivado]
      if {[file executable $b]} { return [list $b] }
    }
  }
  set v [auto_execok vivado]
  if {$v ne ""} { return $v }
  error "Vivado was not found"
}

proc vivado_version {} {
  if {[catch {version -short} v]} { return "" }
  return $v
}

proc os_name {} {
  if {$::tcl_platform(platform) eq "windows"} { return windows }
  if {$::tcl_platform(os) eq "Darwin"} { return mac }
  return linux
}

# ---------------------------------------------------------------- the folder picker (a native dialog)
proc pick_folder {} {
  set start [file nativename $::root]
  switch [os_name] {
    windows {
      set ps {[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.Form
$f.TopMost = $true
$f.ShowInTaskbar = $false
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = 'FPGA Lab: choose the folder for your Vivado projects'
$d.ShowNewFolderButton = $true
$d.SelectedPath = '@START@'
if ($d.ShowDialog($f) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.SelectedPath) }}
      set ps [string map [list @START@ [string map {' ''} $start]] $ps]
      set enc [binary encode base64 [encoding convertto unicode $ps]]
      set cmd [list powershell.exe -NoProfile -NonInteractive -STA -EncodedCommand $enc]
    }
    mac {
      set cmd [list osascript -e {POSIX path of (choose folder with prompt "FPGA Lab: choose the folder for your Vivado projects")}]
    }
    default {
      if {[auto_execok zenity] ne ""} {
        set cmd [list zenity --file-selection --directory --title=FPGA\ Lab:\ choose\ the\ folder\ for\ your\ Vivado\ projects --filename=$::root/]
      } elseif {[auto_execok kdialog] ne ""} {
        set cmd [list kdialog --getexistingdirectory $::root]
      } else {
        error "no folder dialog (install zenity), or start the helper with FPGALAB_ROOT=/path/to/folder"
      }
    }
  }
  set ch [open |$cmd r]
  fconfigure $ch -encoding utf-8
  set out [string trim [read $ch]]
  catch { close $ch }
  if {$out eq ""} { return "" }
  set ::root [file normalize $out]
  save_cfg
  puts "Projects folder: [file nativename $::root]"
  return $::root
}

# ---------------------------------------------------------------- jobs (one Vivado run at a time)
proc start_job {dir what} {
  if {$::busy} { error busy }
  set pdir [project_path $dir]
  switch -- $what {
    build { set script create_project.tcl; set extra [list -tclargs build]; set log build.log }
    program { set script program_board.tcl; set extra {}; set log program.log }
    default { error "unknown job: $what" }
  }
  if {![file exists [file join $pdir $script]]} { error "missing $script in $pdir" }
  set id [incr ::jobid]
  set cmd [concat [vivado_cmd] [list -mode batch -nojournal -log $log -source $script] $extra]
  set old [pwd]
  cd $pdir
  set rc [catch {open |[concat $cmd [list 2>@1]] r} ch]
  cd $old
  if {$rc} { error "could not start Vivado: $ch" }
  fconfigure $ch -blocking 0 -buffering line
  set ::jlines($id) [list "# [join $cmd { }]" "# in [file nativename $pdir]"]
  set ::jdone($id) 0
  set ::jcode($id) ""
  set ::jchan($id) $ch
  set ::jpid($id) [pid $ch]
  set ::busy 1
  fileevent $ch readable [list on_job $id]
  # keep the last two jobs only
  foreach k [array names ::jlines] { if {$k < $id - 1} { unset -nocomplain ::jlines($k) ::jdone($k) ::jcode($k) ::jchan($k) ::jpid($k) } }
  puts "\[[clock format [clock seconds] -format %H:%M:%S]\] $what $dir"
  return $id
}

proc on_job {id} {
  set ch $::jchan($id)
  while {[gets $ch line] >= 0} {
    lappend ::jlines($id) $line
  }
  if {[eof $ch]} {
    fconfigure $ch -blocking 1
    set code 0
    if {[catch {close $ch} err opts]} {
      set ec [dict get $opts -errorcode]
      if {[lindex $ec 0] eq "CHILDSTATUS"} { set code [lindex $ec 2] } else { set code 1; lappend ::jlines($id) $err }
    }
    set ::jdone($id) 1
    set ::jcode($id) $code
    set ::busy 0
    puts "\[[clock format [clock seconds] -format %H:%M:%S]\] finished (exit code $code)"
  }
}

proc stop_job {id} {
  if {![info exists ::jdone($id)] || $::jdone($id)} { return }
  foreach p $::jpid($id) {
    if {[os_name] eq "windows"} {
      catch { exec taskkill /T /F /PID $p }
    } else {
      catch { exec pkill -TERM -P $p }
      catch { exec kill -TERM $p }
    }
  }
  lappend ::jlines($id) "# stopped"
}

# ---------------------------------------------------------------- HTTP
proc accept {ch addr port} {
  fconfigure $ch -translation binary -blocking 0
  set ::buf($ch) ""
  set ::tmo($ch) [after 60000 [list drop $ch]]
  fileevent $ch readable [list on_read $ch]
}

proc drop {ch} {
  catch { after cancel $::tmo($ch) }
  catch { close $ch }
  unset -nocomplain ::buf($ch) ::tmo($ch)
}

proc on_read {ch} {
  if {[catch {read $ch} data]} { drop $ch; return }
  append ::buf($ch) $data
  set b $::buf($ch)
  set i [string first "\r\n\r\n" $b]
  if {$i < 0} {
    if {[eof $ch] || [string length $b] > 65536} { drop $ch }
    return
  }
  set lines [split [string map {"\r\n" "\n"} [string range $b 0 [expr {$i - 1}]]] "\n"]
  set hdr [dict create]
  foreach l [lrange $lines 1 end] {
    set k [string first : $l]
    if {$k > 0} { dict set hdr [string tolower [string trim [string range $l 0 [expr {$k - 1}]]]] [string trim [string range $l [expr {$k + 1}] end]] }
  }
  set len [expr {[dict exists $hdr content-length] ? [dict get $hdr content-length] : 0}]
  if {![string is integer -strict $len] || $len < 0 || $len > 16777216} { drop $ch; return }
  set body [string range $b [expr {$i + 4}] end]
  if {[string length $body] < $len} {
    if {[eof $ch]} { drop $ch }
    return
  }
  fileevent $ch readable {}
  catch { after cancel $::tmo($ch) }
  unset -nocomplain ::buf($ch) ::tmo($ch)
  set req [split [lindex $lines 0] " "]
  set origin [expr {[dict exists $hdr origin] ? [dict get $hdr origin] : ""}]
  if {[catch {handle $ch [lindex $req 0] [lindex $req 1] $hdr $origin [string range $body 0 [expr {$len - 1}]]} err]} {
    set code 500
    if {$err eq "busy"} { set code 409; set err "Vivado is already running a job" }
    if {[string match "bad *" $err] || [string match "missing *" $err]} { set code 400 }
    reply $ch $code [json_obj error [json_str $err]] $origin
  }
}

proc reply {ch code json origin} {
  set names {200 OK 204 {No Content} 400 {Bad Request} 403 Forbidden 404 {Not Found} 409 Conflict 421 {Misdirected Request} 500 {Internal Server Error}}
  set body [encoding convertto utf-8 $json]
  set h "HTTP/1.1 $code [dict get $names $code]\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: [string length $body]\r\nCache-Control: no-store\r\nConnection: close\r\n"
  if {$origin ne "" && [origin_ok $origin]} {
    append h "Access-Control-Allow-Origin: $origin\r\nVary: Origin\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nAccess-Control-Allow-Private-Network: true\r\nAccess-Control-Max-Age: 600\r\n"
  }
  fconfigure $ch -blocking 1
  catch { puts -nonewline $ch "$h\r\n$body"; flush $ch }
  catch { close $ch }
}

proc handle {ch method target hdr origin body} {
  # DNS rebinding: the page must have asked for this computer by its loopback name
  set host [expr {[dict exists $hdr host] ? [dict get $hdr host] : ""}]
  if {$host ni [list 127.0.0.1:$::PORT localhost:$::PORT]} { reply $ch 421 [json_obj error [json_str host]] ""; return }
  # only the FPGA Lab site; a request without an Origin header (a link, an image) is not from a page's script
  if {![origin_ok $origin]} { reply $ch 403 [json_obj error [json_str "this website may not use the FPGA Lab helper"]] ""; return }
  if {$method eq "OPTIONS"} { reply $ch 204 "" $origin; return }
  set q [dict create]
  set path $target
  set i [string first ? $target]
  if {$i >= 0} {
    set path [string range $target 0 [expr {$i - 1}]]
    set q [parse_query [string range $target [expr {$i + 1}] end]]
  }
  switch -- "$method $path" {
    "GET /status" {
      reply $ch 200 [json_obj ok true helper $::VERSION vivado [json_str [vivado_version]] root [json_str [file nativename $::root]] os [json_str [os_name]] busy [bool $::busy] job $::jobid] $origin
    }
    "POST /pick" {
      set r [pick_folder]
      reply $ch 200 [json_obj ok true picked [bool [expr {$r ne ""}]] root [json_str [file nativename $::root]]] $origin
    }
    "POST /file" {
      set parts [safe_rel [param $q path]]
      set f [file join [project_path [param $q dir]] {*}$parts]
      file mkdir [file dirname $f]
      set out [open $f w]
      fconfigure $out -translation binary
      puts -nonewline $out $body
      close $out
      reply $ch 200 [json_obj ok true] $origin
    }
    "POST /build" {
      set id [start_job [param $q dir] [param $q what build]]
      reply $ch 200 [json_obj ok true job $id path [json_str [file nativename [project_path [param $q dir]]]]] $origin
    }
    "GET /log" {
      set id [param $q job]
      if {![info exists ::jlines($id)]} { reply $ch 404 [json_obj error [json_str "no such job"]] $origin; return }
      set from [param $q from 0]
      if {![string is integer -strict $from] || $from < 0} { set from 0 }
      set lines [lrange $::jlines($id) $from end]
      set code [expr {$::jcode($id) eq "" ? "null" : $::jcode($id)}]
      reply $ch 200 [json_obj lines [json_list $lines] next [llength $::jlines($id)] done [bool $::jdone($id)] code $code] $origin
    }
    "POST /stop" {
      stop_job [param $q job]
      reply $ch 200 [json_obj ok true] $origin
    }
    "POST /open" {
      set p [project_path [param $q dir]]
      if {![file isdirectory $p]} { set p $::root }
      file mkdir $p
      switch [os_name] {
        windows { exec {*}[auto_execok explorer] [file nativename $p] & }
        mac { exec open $p & }
        default { exec xdg-open $p & }
      }
      reply $ch 200 [json_obj ok true] $origin
    }
    "POST /gui" {
      set p [project_path [param $q dir]]
      set xpr [lindex [glob -nocomplain [file join $p vivado *.xpr]] 0]
      if {$xpr eq ""} { error "missing project: build it first" }
      set old [pwd]
      cd $p
      set rc [catch {exec {*}[vivado_cmd] -nojournal -log gui.log $xpr &} err]
      cd $old
      if {$rc} { error "could not start Vivado: $err" }
      reply $ch 200 [json_obj ok true] $origin
    }
    default {
      reply $ch 404 [json_obj error [json_str "unknown request $method $path"]] $origin
    }
  }
}

# ---------------------------------------------------------------- start
if {[catch {socket -server accept -myaddr 127.0.0.1 $::PORT} err]} {
  puts "ERROR: could not listen on 127.0.0.1:$::PORT ($err)."
  puts "Is the FPGA Lab helper already running in another window?"
  exit 1
}
puts ""
puts "  FPGA Lab helper $::VERSION is running (http://127.0.0.1:$::PORT)."
puts "  Projects folder: [file nativename $::root]"
puts "  Vivado: [vivado_version]"
puts "  Go back to the website and press Connect. Keep this window open; close it to stop the helper."
puts ""
puts "  FPGA Lab helper ejra shod. Be site bargardid va Connect ra bezanid. In panjare ra baz negah darid."
puts ""
vwait ::forever
