// The HDMI side of the monitor (docs/EBAZ4205-ROADMAP.md, E4.2). TMDS runs at ten bits per pixel (250 Mbit/s per
// lane at 640x480), far too fast to simulate bit by bit in a browser, so the simulator listens one step earlier: the
// stand-in tmds_serializer (src/boards/library.ts) gathers the three 10-bit symbols it is given into one signal,
// fpgalab_hdmi_tap = {d2, d1, d0}, and this tap decodes them like a monitor's receiver does: the four control symbols
// carry HSYNC and VSYNC (on channel 0) during blanking, every other symbol is a pixel byte (channel 0 blue, 1 green,
// 2 red). The result goes to the same VgaMonitor as a VGA port, in 24-bit colour.
import type { Design } from '../hdl';
import type { VgaTap } from './monitor';

export const HDMI_TAP = 'fpgalab_hdmi_tap';

// the four TMDS control symbols, index = {C1, C0}
export const TMDS_CTL = [0b1101010100, 0b0010101011, 0b0101010100, 0b1010101011];

// a 10-bit TMDS symbol: control (0..3 = {C1, C0}) or a video byte
export function tmdsDecode(q: number): { ctl: number; byte: number } {
  q &= 0x3ff;
  const ctl = TMDS_CTL.indexOf(q);
  if (ctl >= 0) return { ctl, byte: 0 };
  // bit 9: the low byte was inverted for DC balance; bit 8: XOR (1) or XNOR (0) chain
  const m = q & 0x200 ? ~q & 0xff : q & 0xff;
  let d = m & 1;
  for (let i = 1; i < 8; i++) {
    const x = ((m >> i) ^ (m >> (i - 1))) & 1;
    d |= (q & 0x100 ? x : x ^ 1) << i;
  }
  return { ctl: -1, byte: d };
}

export function hdmiTap(design: Design): (VgaTap & { depth: 8 }) | null {
  const want = HDMI_TAP.toLowerCase();
  const s = design.sigs.find((x) => x.width >= 30 && (x.name.toLowerCase() === want || x.name.toLowerCase().endsWith('.' + want)));
  if (!s) return null;
  let hs = 1;
  let vs = 1;
  return {
    depth: 8,
    sigs: [s.id],
    read(v) {
      const w = v[s.id] >>> 0;
      const b = tmdsDecode(w & 0x3ff);
      if (b.ctl >= 0) {
        hs = b.ctl & 1;
        vs = (b.ctl >> 1) & 1;
        return { hs, vs, color: 0 };
      }
      const g = tmdsDecode((w >>> 10) & 0x3ff).byte;
      const r = tmdsDecode((w >>> 20) & 0x3ff).byte;
      return { hs, vs, color: (r << 16) | (g << 8) | b.byte };
    },
  };
}
