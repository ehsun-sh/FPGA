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

// ---------------------------------------------------------------- the extension board (Phase E3)
// From the vendor's adapter-board schematic ("adapter board_SCH.pdf", REV 1.0, 2022-03-20) and their example XDC
// files (PL_LEDW_BEEP, 04_PS_LCD_test), which Ehsan sent on 2026-11-21. See docs/ebaz4205/CONTENT.md section 5.1.
export const EXT_LEDS: [string, string][] = [
  ['EXT_LED[0]', 'E19'],
  ['EXT_LED[1]', 'K17'],
  ['EXT_LED[2]', 'H18'],
];
export const EXT_UART: [string, string, 'in' | 'out'][] = [
  ['UART_RX', 'H16', 'in'], // from the PC (CH340C TXD)
  ['UART_TX', 'H17', 'out'], // to the PC (CH340C RXD)
];
export const HDMI: [string, string, 0 | 1 | 2 | 'clk', 'p' | 'n'][] = [
  ['HDMI_CLK_P', 'F19', 'clk', 'p'],
  ['HDMI_CLK_N', 'F20', 'clk', 'n'],
  ['HDMI_D0_P', 'D19', 0, 'p'],
  ['HDMI_D0_N', 'D20', 0, 'n'],
  ['HDMI_D1_P', 'C20', 1, 'p'],
  ['HDMI_D1_N', 'B20', 1, 'n'],
  ['HDMI_D2_P', 'B19', 2, 'p'],
  ['HDMI_D2_N', 'A20', 2, 'n'],
];
// five keys KEY1-KEY5, each with a 10k pull-up to 3.3 V and shorting the pin to ground: pressed = 0
export const KEYS: [string, string][] = [
  ['KEY1', 'T19'],
  ['KEY2', 'P19'],
  ['KEY3', 'U20'],
  ['KEY4', 'U19'],
  ['KEY5', 'V20'],
];
// a passive buzzer (speaker) on 3.3 V, switched by an S8050 transistor: 1 on the pin = current flows
export const BUZZER: [string, string] = ['BUZZER', 'D18'];
// the 1.3" 240x240 IPS display (IPS130-12, ST7789 controller) on 3-wire-plus-DC SPI. Its CS is tied to ground on the
// board, so there is no CS pin. The backlight is switched by an S8050: BLK = 1 turns it on.
export const LCD: [string, string, string][] = [
  ['LCD_SCL', 'R19', 'scl'],
  ['LCD_SDA', 'P20', 'sda'],
  ['LCD_RES', 'N17', 'res'],
  ['LCD_DC', 'R18', 'dc'],
  ['LCD_BLK', 'T20', 'blk'],
];

const CORE_PINS: Record<string, Device> = {
  [CLK_PIN]: { kind: 'clk' },
  ...Object.fromEntries(LEDS.map(([, p], i) => [p, { kind: 'led', index: i } as Device])),
  ...Object.fromEntries(FANS.map(([n, p, line]) => [p, { kind: 'fan', name: n, line } as Device])),
  ...Object.fromEntries(HEADERS.flatMap((h) => Object.entries(h.pins).map(([num, p]) => [p, { kind: 'pin', name: `${h.name}_${num}` } as Device]))),
};

// with the extension board plugged in, its parts take over the header pins they are wired to
const EXT_PINS: Record<string, Device> = {
  ...CORE_PINS,
  ...Object.fromEntries(EXT_LEDS.map(([, p], i) => [p, { kind: 'led', index: LEDS.length + i } as Device])),
  ...Object.fromEntries(EXT_UART.map(([n, p, dir]) => [p, { kind: 'uart', name: n, dir } as Device])),
  ...Object.fromEntries(HDMI.map(([, p, ch, pol]) => [p, { kind: 'hdmi', ch, pol } as Device])),
  ...Object.fromEntries(KEYS.map(([n, p]) => [p, { kind: 'btn', name: n, activeLow: true } as Device])),
  [BUZZER[1]]: { kind: 'buzzer', name: BUZZER[0] },
  ...Object.fromEntries(LCD.map(([, p, line]) => [p, { kind: 'lcd', line } as Device])),
};

const CORE_NAMES: Record<string, string> = {
  ...Object.fromEntries(LEDS),
  'LED[0]': LEDS[0][1],
  'LED[1]': LEDS[1][1],
  ...Object.fromEntries(FANS.map(([n, p]) => [n, p])),
  ...Object.fromEntries(HEADERS.flatMap((h) => Object.entries(h.pins).map(([num, p]) => [`${h.name}_${num}`, p]))),
};
const EXT_NAMES: Record<string, string> = {
  ...CORE_NAMES,
  ...Object.fromEntries(EXT_LEDS),
  ...Object.fromEntries(EXT_UART.map(([n, p]) => [n, p])),
  ...Object.fromEntries(HDMI.map(([n, p]) => [n, p])),
  ...Object.fromEntries(KEYS),
  [BUZZER[0]]: BUZZER[1],
  ...Object.fromEntries(LCD.map(([n, p]) => [n, p])),
};

export const pinsFor = (ext: boolean) => (ext ? EXT_PINS : CORE_PINS);
export const namesFor = (ext: boolean) => (ext ? EXT_NAMES : CORE_NAMES);
export const PINS = EXT_PINS;
export const DEFAULT_NAMES = EXT_NAMES;

const line = (port: string, pin: string, std = 'LVCMOS33') => `set_property -dict { PACKAGE_PIN ${pin} IOSTANDARD ${std} } [get_ports { ${port} }]`;

export function masterXdc(enabled: Partial<Record<XdcGroup, boolean>>): string {
  const c = (on: boolean | undefined, l: string) => (on ? l : '#' + l);
  return [
    '## EBAZ4205 (Zynq XC7Z010CLG400-1) constraints for FPGA Lab',
    '## Uncomment the lines for the ports your design uses and rename them to match your top-level port names.',
    '## Pin data: xjtuecho/EBAZ4205 (MIT License, Copyright (c) xjtuecho) and KeitetsuWorks/EBAZ4205',
    '## (MIT License, Copyright (c) 2021 Keitetsu); extension board: the vendor\'s adapter-board schematic.',
    '## All PL I/O on this board is 3.3 V (LVCMOS33).',
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
    '## ---------------------------------------------------------------- Extension board (plugged onto DATA1-DATA3)',
    '## Its parts use header pins listed above: uncomment either a DATA line or the extension line of a pin, not both.',
    '## LED1-LED3, active high',
    ...EXT_LEDS.map(([n, p]) => c(enabled.ext_led, line(n, p))),
    '',
    '## USB-C serial port (CH340C); also on the 4-pin header UART_USB_TTL. Named as seen from the FPGA.',
    ...EXT_UART.map(([n, p]) => c(enabled.ext_uart, line(n, p))),
    '',
    '## Keys KEY1-KEY5: active low (10k pull-up, pressed = 0)',
    ...KEYS.map(([n, p]) => c(enabled.key, line(n, p))),
    '',
    '## Buzzer: passive, switched by a transistor (1 = current flows). Drive it with a square wave.',
    c(enabled.buzzer, line(BUZZER[0], BUZZER[1])),
    '',
    '## 1.3-inch IPS LCD (ST7789, 240x240, SPI mode 0). CS is tied to ground on the board; BLK = 1 is backlight on.',
    ...LCD.map(([n, p]) => c(enabled.lcd, line(n, p))),
    '',
    '## HDMI out: TMDS straight from the FPGA (no transmitter chip). No DDC (EDID) or hot-plug lines.',
    ...HDMI.map(([n, p]) => c(enabled.hdmi, line(n, p, 'TMDS_33'))),
    '',
  ].join('\n');
}
