// Board plug-in interface. Each board lives in src/boards/<id>/ and is registered in src/boards/index.ts.

// On-board device a package pin is wired to. The vocabulary is shared by all boards.
export type Device =
  | { kind: 'clk' }
  | { kind: 'sw'; index: number }
  | { kind: 'led'; index: number }
  // index = position in BoardDef.io.rgb (not the silkscreen number)
  | { kind: 'rgb'; index: number; color: 'r' | 'g' | 'b' }
  | { kind: 'seg'; seg: 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'dp' }
  | { kind: 'an'; index: number }
  | { kind: 'btn'; name: string }
  // active-low reset button
  | { kind: 'reset'; name: string }
  // a general-purpose header pin or signal line with no on-board indicator (Pmod, USB-UART, ...)
  | { kind: 'pin'; name: string }
  // USB-UART bridge line; dir is seen from the FPGA ('in' = PC to FPGA, idles high)
  | { kind: 'uart'; name: string; dir: 'in' | 'out' }
  // VGA connector: 4-bit colour channels (bit 0 = LSB) and the two sync lines
  | { kind: 'vga'; name: string; line: 'r' | 'g' | 'b' | 'hs' | 'vs'; bit: number };

export interface BoardOutputs {
  led: number[]; // brightness 0..1 per user LED
  rgb: [number, number, number][]; // per RGB LED
  seg: number[][]; // [digit][a,b,c,d,e,f,g,dp] brightness
  done: boolean; // FPGA configured
}

// The interactive picture of a board (3D or otherwise).
export interface BoardView {
  switches: boolean[];
  onSwitch: (i: number, on: boolean) => void;
  onButton: (name: string, pressed: boolean) => void;
  onFrame: (dt: number) => void;
  setOutputs(o: BoardOutputs): void;
  isPressed(name: string): boolean;
  resetView(): void;
  topView(): void;
  // show logic-analyzer probe clips on header pins (package pin names), if the view supports it
  setProbes?(probes: { pin: string; color: string }[]): void;
  // external modules wired to header pins (package pins); a Pmod plugs straight into its header
  setModules?(mods: { label: string; color: string; pins: string[]; pmod: boolean }[]): void;
  // show (canvas) or hide (null) a VGA monitor plugged into the board; the canvas is its screen
  setMonitor?(screen: HTMLCanvasElement | null): void;
  // the screen canvas changed
  refreshMonitor?(): void;
  // the monitor's power LED: green with a signal, amber without
  updateMonitor?(signal: boolean): void;
}

export type XdcGroup = 'clk' | 'sw' | 'led' | 'rgb' | 'seg' | 'btn' | 'reset' | 'pmod' | 'uart' | 'vga' | 'tmp' | 'acl' | 'ps2';

export interface BoardDef {
  id: string;
  name: string; // e.g. "Nexys A7-100T"
  vendor: string;
  part: string; // FPGA part number, e.g. xc7a100tcsg324-1
  boardPart?: string; // Vivado board part (needs the vendor's board files)
  clockHz: number;
  // device capacity, for the utilization report
  resources: { luts: number; ffs: number; iob: number; bram: number };
  io: {
    switches: number;
    leds: number;
    rgb: string[]; // silkscreen labels, e.g. ['LD16', 'LD17']
    digits: number; // seven-segment digits (common anode, active-low)
    buttons: string[]; // port names, e.g. BTNC
    reset?: string; // active-low reset port name
  };
  // package pin -> device
  pins: Record<string, Device>;
  // expansion headers, for probing: pin number (1-based, as on the silkscreen) -> package pin; power pins omitted
  headers: { name: string; pins: Record<number, string> }[];
  // conventional port name (as in the vendor's master XDC, e.g. "SW[0]") -> package pin
  defaultNames: Record<string, string>;
  // master constraints file with only the given groups uncommented
  masterXdc(enabled: Partial<Record<XdcGroup, boolean>>): string;
  createView(container: HTMLElement): BoardView;
}
