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
  | { kind: 'vga'; name: string; line: 'r' | 'g' | 'b' | 'hs' | 'vs'; bit: number }
  // piezo buzzer (extension board)
  | { kind: 'buzzer'; name: string }
  // a line of an LCD module (SPI clock, data, DC, CS, reset, backlight)
  | { kind: 'lcd'; line: string }
  // one wire of an HDMI TMDS pair, driven straight from the FPGA
  | { kind: 'hdmi'; ch: 0 | 1 | 2 | 'clk'; pol: 'p' | 'n' }
  // fan header: PWM out, tachometer (speed) in
  | { kind: 'fan'; name: string; line: 'pwm' | 'speed' };

export interface BoardOutputs {
  led: number[]; // brightness 0..1 per user LED
  rgb: [number, number, number][]; // per RGB LED
  seg: number[][]; // [digit][a,b,c,d,e,f,g,dp] brightness
  done: boolean; // FPGA configured
}

// An add-on module as the board view shows it. values: its controls' current values (and numeric readouts).
export interface ModuleSpec {
  id: string;
  type: string;
  label: string;
  color: string;
  pins: string[];
  pmod: boolean;
  values: Record<string, number>;
}

// The interactive picture of a board (3D or otherwise).
export interface BoardView {
  switches: boolean[];
  onSwitch: (i: number, on: boolean) => void;
  onButton: (name: string, pressed: boolean) => void;
  onFrame: (dt: number) => void;
  setOutputs(o: BoardOutputs): void;
  isPressed(name: string): boolean;
  // set a switch or press a button from code (notify: tell the runner, as a click would)
  setSwitch?(i: number, on: boolean, notify?: boolean): void;
  press?(name: string, down: boolean): void;
  resetView(): void;
  topView(): void;
  // the current view (perspective or top) re-framed on the board
  fitView(): void;
  // show logic-analyzer probe clips on header pins (package pin names), if the view supports it
  setProbes?(probes: { pin: string; color: string }[]): void;
  // external modules wired to header pins (package pins); a Pmod plugs straight into its header
  setModules?(mods: ModuleSpec[]): void;
  // a module's control was operated on the view (same keys and values as the module's card), if the view supports it
  onModule?: (id: string, key: string, v: number) => void;
  // the body of a module was clicked on the view: show its settings, if the view supports it
  onModuleOpen?: (id: string) => void;
  // a control changed on the module's card: show it on the view
  setModuleValue?(id: string, key: string, v: number): void;
  // readouts the view can show on a module (LED brightness per LED, servo angle ...)
  setModuleOutputs?(id: string, out: Record<string, number | number[]>): void;
  // show (canvas) or hide (null) a VGA monitor plugged into the board; the canvas is its screen
  setMonitor?(screen: HTMLCanvasElement | null): void;
  // the screen canvas changed
  refreshMonitor?(): void;
  // the monitor's power LED: green with a signal, amber without
  updateMonitor?(signal: boolean): void;
  // the scene's backdrop colour (follows the site theme)
  setBackground?(hex: string): void;
  // light up parts the lesson text names (SW3, LD7, BTNC, AN2, CPU_RESETN, SW7..SW0); [] clears
  highlight?(parts: string[]): void;
  // show or hide the board's extension board (EBAZ4205, Phase E3)
  setExtension?(attached: boolean): void;
}

export type XdcGroup = 'clk' | 'sw' | 'led' | 'rgb' | 'seg' | 'btn' | 'reset' | 'pmod' | 'uart' | 'vga' | 'tmp' | 'acl' | 'ps2'
  | 'data' | 'fan' | 'enet' | 'ext_led' | 'ext_uart' | 'key' | 'buzzer' | 'lcd' | 'hdmi';

export interface BoardDef {
  id: string;
  name: string; // e.g. "Nexys A7-100T"
  vendor: string;
  part: string; // FPGA part number, e.g. xc7a100tcsg324-1
  boardPart?: string; // Vivado board part (needs the vendor's board files)
  clockHz: number;
  // a clock made inside the chip rather than by an oscillator on a pin (Zynq: FCLK_CLK0 from the PS). An input port
  // with this name and no PACKAGE_PIN constraint is bound as the clock; a constraint to the board's clock pin wins.
  internalClock?: { port: string; source: string; hz: number };
  // one-line notes shown in the board picker
  note?: { fa: string; en: string };
  // the hardware-manager target ("localhost/xilinx_tcf/Digilent")
  jtag?: string;
  // what the simulator leaves out on this board (limits dialog), if anything beyond the usual
  limits?: { fa: string; en: string };
  // device capacity, for the utilization report
  resources: { luts: number; ffs: number; iob: number; bram: number };
  io: {
    switches: number;
    leds: number;
    rgb: string[]; // silkscreen labels, e.g. ['LD16', 'LD17']
    digits: number; // seven-segment digits (common anode, active-low)
    buttons: string[]; // port names, e.g. BTNC
    reset?: string; // active-low reset port name
    ledNames?: string[]; // silkscreen names of the user LEDs, when they are not LD0, LD1 ...
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
