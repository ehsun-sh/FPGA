// Progress export / import and the certificate (Phase 4.5).
import { describe, expect, it } from 'vitest';
import { certificateSvg, collect, makeFile, merge, parseFile, seal } from '../src/ui/progress';

const fakeStorage = (o: Record<string, string>) => {
  const ks = Object.keys(o);
  return { length: ks.length, key: (i: number) => ks[i] ?? null, getItem: (k: string) => o[k] ?? null };
};

describe('progress file', () => {
  it('collects only fpgalab: keys, without the prefix', () => {
    expect(collect(fakeStorage({ 'fpgalab:solved': 'intro', other: 'x', 'fpgalab:lang': 'vhdl' }))).toEqual({ solved: 'intro', lang: 'vhdl' });
  });
  it('round-trips through the file and rejects other shapes', () => {
    const f = JSON.stringify(makeFile({ solved: 'intro,gates' }));
    expect(parseFile(f)).toEqual({ solved: 'intro,gates' });
    expect(parseFile('not json')).toBeNull();
    expect(parseFile('{"version":2,"keys":{}}')).toBeNull();
    expect(parseFile('{"version":1,"keys":[]}')).toBeNull();
    expect(parseFile('{"version":1,"keys":{"a":1}}')).toBeNull();
  });
  it('merges: lists united, quizzes passed, milestones or-ed, newer code wins', () => {
    const local = { solved: 'intro,gates', seen: 'intro', 'quiz:mux': '1', 'ms:proj-clock': '1', 'src:intro:verilog': 'old', 'at:src:intro:verilog': '100', 'src:mux:verilog': 'mine', 'at:src:mux:verilog': '900', 'ui-lang': 'fa' };
    const incoming = { solved: 'gates,mux', seen: 'mux', 'quiz:mux': '0', 'quiz:adder': '1', 'ms:proj-clock': '4', 'src:intro:verilog': 'new', 'at:src:intro:verilog': '200', 'src:mux:verilog': 'theirs', 'at:src:mux:verilog': '500', 'src:seg7:vhdl': 'only there', 'ui-lang': 'en' };
    const m = merge(local, incoming);
    expect(m.solved.split(',').sort()).toEqual(['gates', 'intro', 'mux']);
    expect(m.seen.split(',').sort()).toEqual(['intro', 'mux']);
    expect(m['quiz:mux']).toBe('1');
    expect(m['quiz:adder']).toBe('1');
    expect(m['ms:proj-clock']).toBe('5');
    expect(m['src:intro:verilog']).toBe('new');
    expect(m['at:src:intro:verilog']).toBe('200');
    expect(m['src:mux:verilog']).toBe('mine');
    expect(m['src:seg7:vhdl']).toBe('only there');
    expect(m['ui-lang']).toBe('fa'); // local settings stay
  });
  it('restores everything into an empty browser', () => {
    const exported = { solved: 'intro', 'src:intro:verilog': 'code', 'at:src:intro:verilog': '5', theme: 'dark' };
    expect(merge({}, exported)).toEqual(exported);
  });
});

describe('certificate', () => {
  it('draws a well-formed SVG with the name, date, URL and a seal', () => {
    const svg = certificateSvg('Ada <Lovelace>', '2026-11-20', 'learn.shahmohammadi.dev/fpga', { title: 'Certificate of completion', presented: 'presented to', line: 'completed the FPGA Lab course: 32 lessons, Verilog and VHDL', dateLabel: 'Date', sealLabel: 'seal', note: 'self-attested', rtl: false });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('Ada &lt;Lovelace&gt;');
    expect(svg).toContain('2026-11-20');
    expect(svg).toContain('32 lessons');
    expect(svg).toContain(seal('Ada <Lovelace>', '2026-11-20'));
    expect(svg).not.toMatch(/undefined|NaN/);
  });
  it('makes a stable seal from name and date', () => {
    expect(seal('Sara', '2026-11-20')).toBe(seal(' Sara ', '2026-11-20'));
    expect(seal('Sara', '2026-11-20')).not.toBe(seal('Sara', '2026-11-21'));
    expect(seal('Sara', '2026-11-20')).toMatch(/^[0-9A-F]{8}$/);
  });
});
