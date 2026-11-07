import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOGO_BITS, LOGO_HOT, logo } from '../src/ui/logo';

// Phase 3.5: the logo, the favicon and the social preview
describe('brand', () => {
  it('the logo is a 4x4 LUT with one brand cell; the mono variant has none', () => {
    expect(LOGO_BITS).toHaveLength(16);
    const svg = logo();
    expect(svg.match(/<rect /g)).toHaveLength(16);
    expect(svg.match(/lg-hot/g)).toHaveLength(1);
    expect(svg).toContain('aria-hidden="true"');
    expect(logo(16, true)).not.toContain('lg-hot');
    expect(LOGO_HOT).toBeLessThan(16);
  });

  it('the favicon is the same drawing', () => {
    const fav = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
    const cells = (s: string) => [...s.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="4.1"/g)].map((m) => m[1] + ',' + m[2]);
    expect(cells(fav)).toEqual(cells(logo()));
    expect(fav.match(/#f0803a/g)).toHaveLength(1);
  });

  it('og.png is 1200x630 and index.html announces it as a large card', () => {
    const png = readFileSync(new URL('../public/og.png', import.meta.url));
    const u32 = (o: number) => ((png[o] << 24) | (png[o + 1] << 16) | (png[o + 2] << 8) | png[o + 3]) >>> 0;
    expect([...png.slice(1, 4)].map((c) => String.fromCharCode(c)).join('')).toBe('PNG');
    expect([u32(16), u32(20)]).toEqual([1200, 630]);
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    for (const tag of [
      '<meta property="og:image" content="https://learn.shahmohammadi.dev/fpga/og.png" />',
      '<meta property="og:image:width" content="1200" />',
      '<meta property="og:image:height" content="630" />',
      '<meta name="twitter:card" content="summary_large_image" />',
      '<meta property="og:locale" content="fa_IR" />',
      '<meta property="og:locale:alternate" content="en_US" />',
    ])
      expect(html).toContain(tag);
  });
});
