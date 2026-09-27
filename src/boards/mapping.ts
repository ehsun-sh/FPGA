// XDC parsing and port-to-board mapping ("implementation" step).
import type { Design } from '../hdl';
import type { BoardDef, Device } from './types';

export interface Binding {
  sig: number;
  bit: number;
  port: string;
  pin: string;
  device: Device;
}

export interface Mapping {
  bindings: Binding[];
  clock?: number;
  messages: { level: 'info' | 'warning' | 'error'; code: string; msg: string; line?: number }[];
}

export function parseXdc(text: string, board: BoardDef): { pins: Map<string, { pin: string; line: number }>; messages: Mapping['messages'] } {
  const pins = new Map<string, { pin: string; line: number }>();
  const messages: Mapping['messages'] = [];
  text.split('\n').forEach((raw, i) => {
    const l = raw.replace(/#.*$/, '').trim();
    if (!l) return;
    if (/^create_clock\b/.test(l) || /^set_property\s+(CFGBVS|CONFIG_VOLTAGE|BITSTREAM)/i.test(l)) return;
    const pin = /PACKAGE_PIN\s+([A-Z]+[0-9]+)/i.exec(l);
    const port = /get_ports\s+(?:\{\s*([^}]+?)\s*\}|([^\s\]]+(?:\[\d+\])?))\s*\]/.exec(l);
    if (!pin) {
      if (/^set_property\b/.test(l) && /IOSTANDARD/i.test(l)) return;
      messages.push({ level: 'warning', code: 'Vivado 12-584', msg: `line ${i + 1}: ignoring unsupported constraint`, line: i + 1 });
      return;
    }
    if (!port) {
      messages.push({ level: 'error', code: 'Common 17-55', msg: `line ${i + 1}: missing [get_ports ...]`, line: i + 1 });
      return;
    }
    const name = (port[1] ?? port[2]).replace(/\s+/g, '').toLowerCase();
    const p = pin[1].toUpperCase();
    if (!board.pins[p]) messages.push({ level: 'warning', code: 'Place 30-58', msg: `line ${i + 1}: pin ${p} is not connected to an on-board device in this simulator`, line: i + 1 });
    pins.set(name, { pin: p, line: i + 1 });
  });
  return { pins, messages };
}

export function mapPorts(design: Design, xdc: string, board: BoardDef): Mapping {
  const { pins, messages } = parseXdc(xdc, board);
  const DEFAULTS_LC = new Map(Object.entries(board.defaultNames).map(([k, v]) => [k.toLowerCase(), v]));
  const bindings: Binding[] = [];
  let clock: number | undefined;
  const used = new Set<string>();
  for (const s of design.ports) {
    const lo = Math.min(s.left, s.right);
    const hi = Math.max(s.left, s.right);
    const isVec = s.width > 1;
    for (let idx = lo; idx <= hi; idx++) {
      const key = isVec ? `${s.name}[${idx}]`.toLowerCase() : s.name.toLowerCase();
      let pinName = pins.get(key)?.pin;
      if (!pinName && !isVec) pinName = pins.get(`${s.name}[0]`.toLowerCase())?.pin;
      if (pinName) used.add(key);
      if (!pinName) {
        pinName = DEFAULTS_LC.get(key) ?? (!isVec ? DEFAULTS_LC.get(s.name.toLowerCase()) : undefined);
        if (pinName) {
          if (idx === lo) messages.push({ level: 'warning', code: 'Place 30-574', msg: `port '${s.name}' has no PACKAGE_PIN constraint; auto-mapped by name to the matching ${board.name} pin(s)` });
        } else {
          if (idx === lo) messages.push({ level: 'warning', code: 'DRC UCIO-1', msg: `port '${s.name}${isVec ? `[${idx}]` : ''}' is not constrained to a package pin and is left unconnected` });
          continue;
        }
      }
      const device = board.pins[pinName];
      if (!device) continue;
      const bit = s.left >= s.right ? idx - s.right : s.right - idx;
      const isIn = device.kind === 'sw' || device.kind === 'btn' || device.kind === 'clk' || device.kind === 'reset';
      if (isIn && s.dir !== 'input') {
        messages.push({ level: 'error', code: 'DRC 23-20', msg: `pin ${pinName} is an input on the board but port '${s.name}' is an output` });
        continue;
      }
      if (!isIn && s.dir === 'input') {
        messages.push({ level: 'error', code: 'DRC 23-20', msg: `pin ${pinName} drives an output device but port '${s.name}' is an input` });
        continue;
      }
      if (device.kind === 'clk') clock = s.id;
      bindings.push({ sig: s.id, bit, port: s.name, pin: pinName, device });
    }
  }
  for (const [k, v] of pins) {
    if (!used.has(k) && ![...design.ports].some((p) => p.name.toLowerCase() === k.replace(/\[\d+\]$/, ''))) {
      messages.push({ level: 'warning', code: 'Vivado 12-507', msg: `No ports matched '${k}' (XDC line ${v.line})`, line: v.line });
    }
  }
  return { bindings, clock, messages };
}
