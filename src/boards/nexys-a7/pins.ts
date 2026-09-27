import type { Device, XdcGroup } from '../types';

// Nexys A7-100T (xc7a100tcsg324-1) package pins for the on-board user I/O,
// following Digilent's Nexys-A7-100T-Master.xdc.

const SW = ['J15', 'L16', 'M13', 'R15', 'R17', 'T18', 'U18', 'R13', 'T8', 'U8', 'R16', 'T13', 'H6', 'U12', 'U11', 'V10'];
const LED = ['H17', 'K15', 'J13', 'N14', 'R18', 'V17', 'U17', 'U16', 'V16', 'T15', 'U14', 'T16', 'V15', 'V14', 'V12', 'V11'];
const AN = ['J17', 'J18', 'T9', 'J14', 'P14', 'T14', 'K2', 'U13'];
// Pmod signal pins 1-4 and 7-10 (5/11 = GND, 6/12 = VCC)
const PMOD_NUMS = [1, 2, 3, 4, 7, 8, 9, 10];
const PMOD: Record<string, string[]> = {
  JA: ['C17', 'D18', 'E18', 'G17', 'D17', 'E17', 'F18', 'G18'],
  JB: ['D14', 'F16', 'G16', 'H14', 'E16', 'F13', 'G13', 'H16'],
  JC: ['K1', 'F6', 'J2', 'G6', 'E7', 'J3', 'J4', 'E6'],
  JD: ['H4', 'H1', 'G1', 'G3', 'H2', 'G4', 'G2', 'F3'],
};

export const HEADERS = Object.entries(PMOD).map(([name, pins]) => ({
  name,
  pins: Object.fromEntries(pins.map((p, i) => [PMOD_NUMS[i], p])) as Record<number, string>,
}));

export const PINS: Record<string, Device> = {
  E3: { kind: 'clk' },
  C12: { kind: 'reset', name: 'CPU_RESETN' },
  N17: { kind: 'btn', name: 'BTNC' },
  M18: { kind: 'btn', name: 'BTNU' },
  P17: { kind: 'btn', name: 'BTNL' },
  M17: { kind: 'btn', name: 'BTNR' },
  P18: { kind: 'btn', name: 'BTND' },
  T10: { kind: 'seg', seg: 'a' },
  R10: { kind: 'seg', seg: 'b' },
  K16: { kind: 'seg', seg: 'c' },
  K13: { kind: 'seg', seg: 'd' },
  P15: { kind: 'seg', seg: 'e' },
  T11: { kind: 'seg', seg: 'f' },
  L18: { kind: 'seg', seg: 'g' },
  H15: { kind: 'seg', seg: 'dp' },
  N15: { kind: 'rgb', index: 0, color: 'r' },
  M16: { kind: 'rgb', index: 0, color: 'g' },
  R12: { kind: 'rgb', index: 0, color: 'b' },
  N16: { kind: 'rgb', index: 1, color: 'r' },
  R11: { kind: 'rgb', index: 1, color: 'g' },
  G14: { kind: 'rgb', index: 1, color: 'b' },
  D4: { kind: 'pin', name: 'UART_RXD_OUT' },
};
for (const [h, pins] of Object.entries(PMOD)) pins.forEach((p, i) => (PINS[p] = { kind: 'pin', name: `${h}${PMOD_NUMS[i]}` }));
SW.forEach((p, i) => (PINS[p] = { kind: 'sw', index: i }));
LED.forEach((p, i) => (PINS[p] = { kind: 'led', index: i }));
AN.forEach((p, i) => (PINS[p] = { kind: 'an', index: i }));

// Port name (as in the master XDC) -> pin, used to auto-map when a port has no constraint.
export const DEFAULT_NAMES: Record<string, string> = {
  CLK100MHZ: 'E3',
  CPU_RESETN: 'C12',
  BTNC: 'N17',
  BTNU: 'M18',
  BTNL: 'P17',
  BTNR: 'M17',
  BTND: 'P18',
  CA: 'T10',
  CB: 'R10',
  CC: 'K16',
  CD: 'K13',
  CE: 'P15',
  CF: 'T11',
  CG: 'L18',
  DP: 'H15',
  LED16_R: 'N15',
  LED16_G: 'M16',
  LED16_B: 'R12',
  LED17_R: 'N16',
  LED17_G: 'R11',
  LED17_B: 'G14',
  UART_RXD_OUT: 'D4',
};
for (const [h, pins] of Object.entries(PMOD)) pins.forEach((p, i) => (DEFAULT_NAMES[`${h}[${PMOD_NUMS[i]}]`] = p));
SW.forEach((p, i) => (DEFAULT_NAMES[`SW[${i}]`] = p));
LED.forEach((p, i) => (DEFAULT_NAMES[`LED[${i}]`] = p));
AN.forEach((p, i) => (DEFAULT_NAMES[`AN[${i}]`] = p));

function line(port: string, pin: string, comment?: string, clock = false): string {
  const l = `set_property -dict { PACKAGE_PIN ${pin}   IOSTANDARD LVCMOS33 } [get_ports { ${port} }];${comment ? ' #' + comment : ''}`;
  return clock ? `${l}\ncreate_clock -add -name sys_clk_pin -period 10.00 -waveform {0 5} [get_ports { CLK100MHZ }];` : l;
}

// Generates a master-style XDC with only the listed groups enabled (others commented out, like Digilent's file).
export function masterXdc(enabled: Partial<Record<XdcGroup, boolean>>): string {
  const c = (on: boolean | undefined, l: string) =>
    l
      .split('\n')
      .map((x) => (on ? x : '#' + x))
      .join('\n');
  const out: string[] = [
    '## Nexys A7-100T constraints (based on Digilent Nexys-A7-100T-Master.xdc)',
    '## Uncomment the lines for the ports your design uses and rename them to match your top-level port names.',
    '',
    '## Clock signal',
    c(enabled.clk, line('CLK100MHZ', 'E3', undefined, true)),
    '',
    '## Switches',
    ...SW.map((p, i) => c(enabled.sw, line(`SW[${i}]`, p))),
    '',
    '## LEDs',
    ...LED.map((p, i) => c(enabled.led, line(`LED[${i}]`, p))),
    '',
    '## RGB LEDs',
    ...['LED16_B:R12', 'LED16_G:M16', 'LED16_R:N15', 'LED17_B:G14', 'LED17_G:R11', 'LED17_R:N16'].map((x) => {
      const [n, p] = x.split(':');
      return c(enabled.rgb, line(n, p));
    }),
    '',
    '## 7 segment display',
    ...['CA:T10', 'CB:R10', 'CC:K16', 'CD:K13', 'CE:P15', 'CF:T11', 'CG:L18', 'DP:H15'].map((x) => {
      const [n, p] = x.split(':');
      return c(enabled.seg, line(n, p));
    }),
    ...AN.map((p, i) => c(enabled.seg, line(`AN[${i}]`, p))),
    '',
    '## Buttons',
    c(enabled.reset, line('CPU_RESETN', 'C12')),
    ...['BTNC:N17', 'BTNU:M18', 'BTNL:P17', 'BTNR:M17', 'BTND:P18'].map((x) => {
      const [n, p] = x.split(':');
      return c(enabled.btn, line(n, p));
    }),
    '',
    ...Object.entries(PMOD).flatMap(([h, pins]) => [`## Pmod Header ${h}`, ...pins.map((p, i) => c(enabled.pmod, line(`${h}[${PMOD_NUMS[i]}]`, p))), '']),
    '## USB-RS232 Interface',
    c(enabled.uart, line('UART_RXD_OUT', 'D4')),
    '',
  ];
  return out.join('\n');
}
