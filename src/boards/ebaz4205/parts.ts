// Names of the EBAZ4205 parts that lesson text can point at (part() chips): the LEDs, the headers and the footprints
// the "Prepare your board" steps talk about, and the parts of the extension board. Unknown names are dropped.
export const EBAZ_PARTS = ['LED_R', 'LED_G', 'J3', 'J4', 'J5', 'J7', 'J8', 'DATA1', 'DATA2', 'DATA3', 'R2577', 'R2584', 'X5', 'U7',
  // the extension board (Phase E3)
  'LED1', 'LED2', 'LED3', 'KEY1', 'KEY2', 'KEY3', 'KEY4', 'KEY5', 'BUZZER', 'LCD', 'HDMI', 'USB_C'];

export function expandEbazParts(names: string[]): string[] {
  const out = names.map((n) => n.trim().toUpperCase()).filter((n) => EBAZ_PARTS.includes(n));
  return [...new Set(out)];
}
