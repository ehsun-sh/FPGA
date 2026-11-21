// Names of the EBAZ4205 parts that lesson text can point at (part() chips): the LEDs, the headers and the footprints
// the "Prepare your board" steps talk about. Unknown names are dropped.
export const EBAZ_PARTS = ['LED_R', 'LED_G', 'J3', 'J4', 'J5', 'J7', 'J8', 'DATA1', 'DATA2', 'DATA3', 'R2577', 'R2584', 'X5', 'U7'];

export function expandEbazParts(names: string[]): string[] {
  const out = names.map((n) => n.trim().toUpperCase()).filter((n) => EBAZ_PARTS.includes(n));
  return [...new Set(out)];
}
