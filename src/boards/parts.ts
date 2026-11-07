// Names of the Nexys A7 parts that lesson text can point at (see part() in src/lessons/helpers.ts).
// The single parts behind a list of chip names: ranges are expanded ("SW3..SW0" → SW3, SW2, SW1, SW0) and the reset
// button's spellings become its port name, CPU_RESETN. Unknown names are dropped.
export function expandParts(names: string[]): string[] {
  const out: string[] = [];
  for (const raw of names) {
    const n = raw.trim().toUpperCase();
    if (/^CPU[ _]RESETN?$/.test(n)) {
      out.push('CPU_RESETN');
      continue;
    }
    if (/^BTN[CULRD]$/.test(n)) {
      out.push(n);
      continue;
    }
    const m = /^(SW|LD|AN)(\d+)(?:\.\.\1(\d+))?$/.exec(n);
    if (!m) continue;
    const max = m[1] === 'AN' ? 7 : m[1] === 'SW' ? 15 : 17;
    const a = +m[2], b = m[3] === undefined ? a : +m[3];
    if (a > max || b > max) continue;
    const step = a <= b ? 1 : -1;
    for (let i = a; i !== b + step; i += step) out.push(m[1] + i);
  }
  return [...new Set(out)];
}
