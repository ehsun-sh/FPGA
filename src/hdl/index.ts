import { HdlError, type Lang } from './ast';
import { compileDesign, type CompiledSim } from './compile';
import { elaborate } from './elaborate';
import type { Design } from './ir';
import { parseVerilog } from './verilog';
import { parseVhdl } from './vhdl';

export { HdlError, compileDesign };
export type { CompiledSim, Design, Lang };

export function synthesize(src: string, lang: Lang, top?: string): Design {
  const mods = lang === 'verilog' ? parseVerilog(src) : parseVhdl(src);
  if (!mods.length) throw new HdlError(lang === 'verilog' ? 'no module found' : 'no entity/architecture found', undefined, 'Synth 8-439');
  return elaborate(mods, lang, top);
}

export interface Utilization {
  ffs: number;
  luts: number;
  io: number;
  bram: number;
}

// Rough, educational resource estimate (not a real technology mapping).
export function estimateUtilization(d: Design): Utilization {
  const seqWritten = new Set<number>();
  let ops = 0;
  const countOps = (o: unknown): void => {
    if (!o || typeof o !== 'object') return;
    const r = o as Record<string, unknown>;
    if (r.k === 'bin' || r.k === 'un' || r.k === 'cond') ops++;
    if (r.k === 'case') ops += ((r.items as unknown[]) ?? []).length;
    for (const val of Object.values(r)) if (val && typeof val === 'object') countOps(val);
  };
  for (const p of d.procs) {
    if (p.kind === 'seq') p.writes?.forEach((w) => w < d.sigs.length && seqWritten.add(w));
    countOps(p.body);
  }
  let ffs = 0;
  seqWritten.forEach((id) => (ffs += d.sigs[id].width));
  let bram = 0;
  for (const m of d.mems) bram += m.width * m.length;
  const io = d.ports.reduce((s, p) => s + p.width, 0);
  return { ffs, luts: Math.max(ops, d.ports.length ? 1 : 0), io, bram: Math.ceil(bram / 36864) };
}
