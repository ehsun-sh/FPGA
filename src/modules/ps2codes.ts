// PS/2 keyboard scan codes, set 2 (what a PS/2 keyboard, and the Nexys A7's USB HID host, sends).
// A key sends its make code when pressed and F0 + make code when released; extended keys start with E0.

// key name -> [make code, extended]
export const PS2_KEYS: Record<string, [number, boolean]> = {
  A: [0x1c, false], B: [0x32, false], C: [0x21, false], D: [0x23, false], E: [0x24, false], F: [0x2b, false],
  G: [0x34, false], H: [0x33, false], I: [0x43, false], J: [0x3b, false], K: [0x42, false], L: [0x4b, false],
  M: [0x3a, false], N: [0x31, false], O: [0x44, false], P: [0x4d, false], Q: [0x15, false], R: [0x2d, false],
  S: [0x1b, false], T: [0x2c, false], U: [0x3c, false], V: [0x2a, false], W: [0x1d, false], X: [0x22, false],
  Y: [0x35, false], Z: [0x1a, false],
  '0': [0x45, false], '1': [0x16, false], '2': [0x1e, false], '3': [0x26, false], '4': [0x25, false],
  '5': [0x2e, false], '6': [0x36, false], '7': [0x3d, false], '8': [0x3e, false], '9': [0x46, false],
  Space: [0x29, false], Enter: [0x5a, false], Backspace: [0x66, false], Esc: [0x76, false], Tab: [0x0d, false],
  Shift: [0x12, false], Ctrl: [0x14, false], Alt: [0x11, false],
  '-': [0x4e, false], '=': [0x55, false], ',': [0x41, false], '.': [0x49, false], '/': [0x4a, false],
  ';': [0x4c, false], "'": [0x52, false], '[': [0x54, false], ']': [0x5b, false],
  Up: [0x75, true], Down: [0x72, true], Left: [0x6b, true], Right: [0x74, true],
};

// KeyboardEvent.code -> key name
export function keyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  const m: Record<string, string> = {
    Space: 'Space', Enter: 'Enter', Backspace: 'Backspace', Escape: 'Esc', Tab: 'Tab',
    ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt',
    Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'",
    BracketLeft: '[', BracketRight: ']', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  };
  return m[code] ?? null;
}

// the bytes a key sends
export function scanBytes(key: string, pressed: boolean): number[] {
  const k = PS2_KEYS[key];
  if (!k) return [];
  const [code, ext] = k;
  return [...(ext ? [0xe0] : []), ...(pressed ? [] : [0xf0]), code];
}

const NAMES = new Map<number, string>(Object.entries(PS2_KEYS).filter(([, v]) => !v[1]).map(([n, v]) => [v[0], n]));
const EXT_NAMES = new Map<number, string>(Object.entries(PS2_KEYS).filter(([, v]) => v[1]).map(([n, v]) => [v[0], n]));

// name of a scan code byte (for the logic analyzer)
export function scanName(code: number, extended = false): string {
  if (code === 0xf0) return 'break';
  if (code === 0xe0) return 'ext';
  if (code === 0xaa) return 'BAT ok';
  return (extended ? EXT_NAMES.get(code) : NAMES.get(code)) ?? '';
}
