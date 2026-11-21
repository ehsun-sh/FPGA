import type { Device, XdcGroup } from '../types';

// EBAZ4205 (Zynq xc7z010clg400-1) package pins of the PL user I/O, from docs/ebaz4205/ebaz4205-master.xdc.
//
// Pin data: xjtuecho/EBAZ4205 Development/EBAZ4205.xdc (MIT License, Copyright (c) xjtuecho) and
// KeitetsuWorks/EBAZ4205 vivado/.../ebaz4205.xdc (MIT License, Copyright (c) 2021 Keitetsu), cross-checked with
// gameltb/EBAZ4205 and hhuysqt.github.io/zynq1. See docs/ebaz4205/SOURCES.md.

// the optional oscillator X5 (not fitted on a stock board)
export const CLK_PIN = 'N18';
export const LEDS: [string, string][] = [
  ['LED_R', 'W14'],
  ['LED_G', 'W13'],
];
export const FANS: [string, string, 'pwm' | 'speed'][] = [
  ['J3_PWM', 'U12', 'pwm'],
  ['J3_SPEED', 'V13', 'speed'],
  ['J5_PWM', 'V12', 'pwm'],
  ['J5_SPEED', 'V15', 'speed'],
];
// DATA1-3: 2.0 mm 2x10 headers; header pin number (silkscreen) -> package pin. Pins 1-4, 10 and 12 are power,
// ground or unused.
export const DATA_NUMS = [5, 6, 7, 8, 9, 11, 13, 14, 15, 16, 17, 18, 19, 20];
const DATA: Record<string, string[]> = {
  DATA1: ['A20', 'H16', 'B19', 'B20', 'C20', 'H17', 'D20', 'D18', 'H18', 'D19', 'F20', 'E19', 'F19', 'K17'],
  DATA2: ['G20', 'J18', 'G19', 'H20', 'J19', 'K18', 'K19', 'J20', 'L16', 'L19', 'M18', 'L20', 'M20', 'L17'],
  DATA3: ['M19', 'N20', 'P18', 'M17', 'N17', 'P20', 'R18', 'R19', 'P19', 'T20', 'U20', 'T19', 'V20', 'U19'],
};

export const HEADERS = Object.entries(DATA).map(([name, pins]) => ({
  name,
  pins: Object.fromEntries(pins.map((p, i) => [DATA_NUMS[i], p])) as Record<number, string>,
}));

export const PINS: Record<string, Device> = {
  [CLK_PIN]: { kind: 'clk' },
  ...Object.fromEntries(LEDS.map(([, p], i) => [p, { kind: 'led', index: i } as Device])),
  ...Object.fromEntries(FANS.map(([n, p, line]) => [p, { kind: 'fan', name: n, line } as Device])),
  ...Object.fromEntries(HEADERS.flatMap((h) => Object.entries(h.pins).map(([num, p]) => [p, { kind: 'pin', name: `${h.name}_${num}` } as Device]))),
};

export const DEFAULT_NAMES: Record<string, string> = {
  ...Object.fromEntries(LEDS),
  'LED[0]': LEDS[0][1],
  'LED[1]': LEDS[1][1],
  ...Object.fromEntries(FANS.map(([n, p]) => [n, p])),
  ...Object.fromEntries(HEADERS.flatMap((h) => Object.entries(h.pins).map(([num, p]) => [`${h.name}_${num}`, p]))),
};

const line = (port: string, pin: string) => `set_property -dict { PACKAGE_PIN ${pin} IOSTANDARD LVCMOS33 } [get_ports { ${port} }]`;

export function masterXdc(enabled: Partial<Record<XdcGroup, boolean>>): string {
  const c = (on: boolean | undefined, l: string) => (on ? l : '#' + l);
  return [
    '## EBAZ4205 (Zynq XC7Z010CLG400-1) constraints for FPGA Lab',
    '## Uncomment the lines for the ports your design uses and rename them to match your top-level port names.',
    '## Pin data: xjtuecho/EBAZ4205 (MIT License, Copyright (c) xjtuecho) and KeitetsuWorks/EBAZ4205',
    '## (MIT License, Copyright (c) 2021 Keitetsu). All PL I/O on this board is 3.3 V (LVCMOS33).',
    '',
    '## Clock: the stock board has no oscillator on the PL side. clk comes from the PS (FCLK_CLK0 = 50 MHz) and',
    '## needs no line here. Only if you solder an oscillator at X5:',
    `#${line('clk', CLK_PIN)}`,
    '#create_clock -add -name clk_pin -period 20.00 -waveform {0 10} [get_ports { clk }]',
    '',
    '## LEDs on the core board',
    ...LEDS.map(([n, p]) => c(enabled.led, line(n, p))),
    '',
    '## Fan headers J3 and J5',
    ...FANS.map(([n, p]) => c(enabled.fan, line(n, p))),
    ...HEADERS.flatMap((h) => ['', `## ${h.name} (2.0 mm 2x10 header; the number is the silkscreen pin)`, ...Object.entries(h.pins).map(([num, p]) => c(enabled.data, line(`${h.name}_${num}`, p)))]),
    '',
  ].join('\n');
}
