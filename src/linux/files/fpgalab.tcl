# FPGA Lab: two helpers for the Linux projects of the EBAZ4205, in plain Tcl (Vivado's own Tcl runs them).

# boot.cmd -> boot.scr: a U-Boot script image, the same bytes as
#   mkimage -A arm -O linux -T script -C none -d boot.cmd boot.scr
# (a 64-byte legacy image header, then the script's length, a zero word and the script itself)
proc fpgalab_crc32 {data} {
  set crc 0xFFFFFFFF
  binary scan $data cu* bytes
  foreach b $bytes {
    set crc [expr {$crc ^ $b}]
    for {set k 0} {$k < 8} {incr k} {
      if {$crc & 1} { set crc [expr {($crc >> 1) ^ 0xEDB88320}] } else { set crc [expr {$crc >> 1}] }
    }
  }
  return [expr {$crc ^ 0xFFFFFFFF}]
}
proc fpgalab_mkscr {cmd scr {time {}}} {
  set f [open $cmd rb]; set text [read $f]; close $f
  if {$time eq {}} { set time [clock seconds] }
  set data [binary format IIa* [string length $text] 0 $text]
  # magic, header CRC (0 while it is computed), time, size, load, entry, data CRC, OS linux, arch ARM, type script,
  # no compression, an empty 32-byte name
  set head [binary format IIIIIIIccccx32 0x27051956 0 $time [string length $data] 0 0 [fpgalab_crc32 $data] 5 2 6 0]
  set head [binary format IIa* 0x27051956 [fpgalab_crc32 $head] [string range $head 8 end]]
  set f [open $scr wb]; puts -nonewline $f $head$data; close $f
}

# system_wrapper.bit -> a .bin for the Linux FPGA manager: the configuration data without the .bit header, every
# 32-bit word byte-swapped (the sync word AA995566 becomes the bytes 66 55 99 AA), as drivers/fpga/zynq-fpga.c wants.
# Same result as: bootgen -image bit.bif -arch zynq -process_bitstream bin
proc fpgalab_bit2bin {bit bin} {
  set f [open $bit rb]; set d [read $f]; close $f
  # header: a 2-byte length and 9 bytes, a 2-byte length (1), then the fields a-d (key, 2-byte length, text) and e
  # (key, 4-byte length, the data)
  binary scan $d S n
  set p [expr {2 + ($n & 0xFFFF) + 2}]
  while 1 {
    binary scan $d @${p}a1 key
    incr p
    if {$key eq "e"} {
      binary scan $d @${p}I len
      incr p 4
      break
    }
    if {[lsearch {a b c d} $key] < 0 || $p >= [string length $d]} { error "$bit: not a Xilinx .bit file" }
    binary scan $d @${p}S n
    incr p [expr {2 + ($n & 0xFFFF)}]
  }
  set len [expr {$len & 0xFFFFFFFF}]
  binary scan [string range $d $p [expr {$p + $len - 1}]] I* words
  set f [open $bin wb]; puts -nonewline $f [binary format i* $words]; close $f
  return $len
}
