// The FPGA Lab mark: a 4x4 lookup table, the 16 cells of a LUT4 holding a 4-input XOR (the parity of its inputs),
// with the selected output cell in the brand orange. Colours come from CSS (.logo-mark), so it follows the theme;
// mono draws the output cell like the other lit cells (the footer). public/favicon.svg is the same drawing.
export const LOGO_BITS = [0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0];
export const LOGO_HOT = 15;

export function logoCells(cls: (bit: number, hot: boolean) => string): string {
  const pitch = 4.9;
  const size = 4.1;
  const off = (20 - (3 * pitch + size)) / 2;
  return LOGO_BITS.map((bit, i) => {
    const x = +(off + (i % 4) * pitch).toFixed(2);
    const y = +(off + Math.floor(i / 4) * pitch).toFixed(2);
    return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="1.1" ${cls(bit, i === LOGO_HOT)}/>`;
  }).join('');
}

export function logo(size = 20, mono = false): string {
  const cells = logoCells((bit, hot) => `class="${hot && !mono ? 'lg-hot' : bit || hot ? 'lg-on' : 'lg-off'}"`);
  return `<svg class="logo-mark" viewBox="0 0 20 20" width="${size}" height="${size}" aria-hidden="true" focusable="false">${cells}</svg>`;
}
