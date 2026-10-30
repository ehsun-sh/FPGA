import { describe, expect, it } from 'vitest';
import { ALL_LESSONS } from '../src/lessons/course';
import { lessonTools, TOOLS } from '../src/lessons/tools';

const tools = (id: string) => lessonTools(ALL_LESSONS.find((l) => l.id === id)!);

describe('lesson tools', () => {
  it('names the instruments each lesson works with', () => {
    expect(tools('intro')).toEqual([]);
    expect(tools('counter')).toEqual(['la']);
    expect(tools('uart_rx')).toEqual(['la', 'serial']);
    expect(tools('vga')).toEqual(['la', 'vga']);
    expect(tools('sensors')).toEqual(['la', 'modules']);
    expect(tools('ps2')).toEqual(['la', 'modules']);
  });

  it('describes every tool a lesson uses, in both languages', () => {
    for (const l of ALL_LESSONS)
      for (const t of lessonTools(l))
        for (const lang of ['fa', 'en'] as const) expect(TOOLS[t].desc(l, lang).length).toBeGreaterThan(20);
    expect(TOOLS.la.desc(ALL_LESSONS.find((l) => l.id === 'uart_rx')!, 'en')).toContain('UART');
    expect(TOOLS.modules.desc(ALL_LESSONS.find((l) => l.id === 'ps2')!, 'en')).toMatch(/^The PS\/2 keyboard/);
  });
});
