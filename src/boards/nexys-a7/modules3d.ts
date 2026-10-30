// Physical 3D models of the add-on modules: Pmod cards, the HC-SR04 sonar and the SG90 servo.
// Each builder returns a group whose origin is the module's connector; the card extends along +x. Its parts list says
// what the pointer can do with the model (press, flip, turn, lift), named by the same control keys as the module's
// card in the Modules panel, and show() moves the parts to the module's current state.
import * as THREE from 'three';
import { DETENT, sonarCm, sonarHeight } from './controls';

const PX = 160; // texture pixels per unit

// press: momentary button; toggle: flips on a click; turn: rotary encoder knob (drag around it or use the wheel);
// lift: a value set by dragging a part up and down (the sonar's target)
export interface ModPart {
  kind: 'press' | 'toggle' | 'turn' | 'lift';
  // the control key; for 'turn' the state key of the knob position in detents (`${key}Frac` holds the part of a
  // detent turned so far by a drag)
  key: string;
  hit: THREE.Mesh[]; // what the pointer can grab
  // 'turn': the momentary controls for one detent counter-clockwise / clockwise, and the button under the shaft
  ccw?: string;
  cw?: string;
  push?: string;
  // 'lift': the part's height for a value, and the value for a height
  toY?: (v: number) => number;
  fromY?: (y: number) => number;
}

// control values (0/1 for buttons and switches, centimetres, ...) and readouts (LED brightness, servo angle)
export type ModState = Record<string, number | number[] | undefined>;

export interface ModModel {
  group: THREE.Group;
  parts: ModPart[];
  // moves the parts towards the state; f = the share of the way to go this frame (0..1)
  show(s: ModState, f: number): void;
}

const num = (v: ModState[string], d = 0) => (typeof v === 'number' ? v : d);
const toward = (cur: number, target: number, f: number) => cur + (target - cur) * f;

function tex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = Math.round(w * PX);
  c.height = Math.round(h * PX);
  draw(c.getContext('2d')!, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// a flat slab with rounded corners lying in the x/z plane, top at y = h; the map covers the top face exactly
export function roundedSlab(w: number, d: number, h: number, r: number, faces: THREE.Material, sides: THREE.Material): THREE.Mesh {
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const y0 = -d / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w - r, y0);
  s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + d - r);
  s.quadraticCurveTo(x0 + w, y0 + d, x0 + w - r, y0 + d);
  s.lineTo(x0 + r, y0 + d);
  s.quadraticCurveTo(x0, y0 + d, x0, y0 + d - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2); // shape y -> -z, extrusion -> +y
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (d / 2 - pos.getZ(i)) / d);
  const m = new THREE.Mesh(geo, [faces, sides]);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

interface Mats {
  black: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  white: THREE.MeshStandardMaterial;
}

function mats(): Mats {
  return {
    black: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.55 }),
    gold: new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 1, roughness: 0.3 }),
    metal: new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 0.9, roughness: 0.28 }),
    white: new THREE.MeshStandardMaterial({ color: '#efece4', roughness: 0.6 }),
  };
}

function add(g: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  g.add(m);
  return m;
}
const box = (g: THREE.Object3D, w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number) =>
  add(g, new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z);

// a small SMD resistor / cap
function smd(g: THREE.Object3D, m: Mats, x: number, y: number, z: number, body = '#1b1b1b') {
  const b = new THREE.MeshStandardMaterial({ color: body, roughness: 0.5 });
  box(g, 0.08, 0.04, 0.05, b, x, y, z);
  box(g, 0.025, 0.045, 0.052, m.metal, x - 0.05, y, z);
  box(g, 0.025, 0.045, 0.052, m.metal, x + 0.05, y, z);
}

// solder mask + silkscreen for a module card
function silk(w: number, d: number, mask: string, title: string, accent: string, pins: string[], extra?: (g: CanvasRenderingContext2D, k: number) => void) {
  return tex(w, d, (g, cw, ch) => {
    const k = PX;
    const grd = g.createLinearGradient(0, 0, cw, ch);
    grd.addColorStop(0, mask);
    grd.addColorStop(1, shade(mask, -0.18));
    g.fillStyle = grd;
    g.fillRect(0, 0, cw, ch);
    // traces
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 3;
    for (let i = 0; i < pins.length; i++) {
      const y = ((i + 0.5) / Math.max(1, pins.length)) * ch;
      g.beginPath();
      g.moveTo(0.45 * k, y);
      g.lineTo(0.8 * k, y);
      g.lineTo(1.0 * k, ch / 2 + (y - ch / 2) * 0.5);
      g.lineTo(cw * 0.7, ch / 2 + (y - ch / 2) * 0.5);
      g.stroke();
    }
    // outline + mounting hole ring
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 3;
    g.strokeRect(6, 6, cw - 12, ch - 12);
    g.fillStyle = '#c9b27a';
    g.beginPath();
    g.arc(cw - 0.18 * k, ch - 0.18 * k, 0.09 * k, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#0c0c0c';
    g.beginPath();
    g.arc(cw - 0.18 * k, ch - 0.18 * k, 0.05 * k, 0, Math.PI * 2);
    g.fill();
    // pin names next to the connector
    g.fillStyle = '#f4f4f4';
    g.font = `600 ${Math.round(0.09 * k)}px sans-serif`;
    g.textBaseline = 'middle';
    pins.forEach((p, i) => g.fillText(p, 0.5 * k, ((i + 0.5) / pins.length) * ch, 0.4 * k));
    // title, with a coloured tag so modules stay recognisable
    g.save();
    g.fillStyle = accent;
    g.fillRect(cw - 0.62 * k, 0.12 * k, 0.12 * k, 0.12 * k);
    g.fillStyle = '#ffffff';
    g.font = `700 ${Math.round(0.17 * k)}px sans-serif`;
    g.textAlign = 'right';
    g.textBaseline = 'top';
    g.fillText(title, cw - 0.12 * k, ch - 0.38 * k, cw * 0.7);
    g.font = `600 ${Math.round(0.08 * k)}px sans-serif`;
    g.fillText('DIGILENT', cw - 0.12 * k, 0.12 * k);
    g.restore();
    extra?.(g, k);
  });
}

function shade(hex: string, f: number) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, f * 0.5);
  return '#' + c.getHexString();
}

// right-angle 2x6 male header: plastic bar at the connector, gold pins bending down into the board's socket
function pmodHeader(g: THREE.Object3D, m: Mats, y: number) {
  box(g, 0.28, 0.24, 1.45, m.black, 0.32, y - 0.24, 0);
  const pin = new THREE.BoxGeometry(0.05, 0.05, 0.05);
  const horiz = new THREE.BoxGeometry(0.42, 0.05, 0.05);
  const down = new THREE.BoxGeometry(0.05, 0.36, 0.05);
  for (let r = 0; r < 2; r++)
    for (let k = 0; k < 6; k++) {
      const z = -0.6 + k * 0.24;
      const py = y - 0.08 - r * 0.1;
      add(g, horiz, m.gold, 0.2 + r * 0.04, py, z);
      add(g, down, m.gold, -0.12 + r * 0.24, py - 0.16, z);
      add(g, pin, m.gold, 0.52, py, z);
    }
}

// a tactile switch; show() pushes the cap down while the button is pressed
function tactile(g: THREE.Object3D, m: Mats, x: number, y: number, z: number, cap: THREE.Material, key: string, parts: ModPart[]) {
  const base = box(g, 0.32, 0.1, 0.32, m.black, x, y, z);
  box(g, 0.3, 0.02, 0.3, m.metal, x, y + 0.1, z);
  const c = add(g, new THREE.CylinderGeometry(0.1, 0.1, 0.1, 20), cap, x, y + 0.17, z);
  for (const [dx, dz] of [[-0.18, -0.12], [-0.18, 0.12], [0.18, -0.12], [0.18, 0.12]]) box(g, 0.05, 0.02, 0.04, m.metal, x + dx, y, z + dz);
  parts.push({ kind: 'press', key, hit: [c, base] });
  return (s: ModState, f: number) => (c.position.y = toward(c.position.y, y + 0.17 - (num(s[key]) ? 0.06 : 0), f));
}

// a slide switch; ON = lever pushed towards the back of the card
function slide(g: THREE.Object3D, m: Mats, x: number, y: number, z: number, key: string, parts: ModPart[]) {
  const body = box(g, 0.26, 0.12, 0.44, m.white, x, y, z);
  const lever = box(g, 0.08, 0.1, 0.12, m.black, x, y + 0.12, z + 0.1);
  parts.push({ kind: 'toggle', key, hit: [lever, body] });
  return (s: ModState, f: number) => (lever.position.z = toward(lever.position.z, z + (num(s[key]) ? -0.1 : 0.1), f));
}

// an SMD LED; returns the dome's material, which glows with the LED's brightness
function led(g: THREE.Object3D, x: number, y: number, z: number) {
  const red = new THREE.MeshStandardMaterial({ color: '#ff3a2a', emissive: '#ff2a14', emissiveIntensity: 0.12, roughness: 0.2, transparent: true, opacity: 0.92 });
  box(g, 0.14, 0.05, 0.09, new THREE.MeshStandardMaterial({ color: '#f0eadc', roughness: 0.4 }), x, y, z);
  const dome = add(g, new THREE.SphereGeometry(0.045, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), red, x, y + 0.05, z);
  dome.castShadow = false;
  return red;
}

// --- Pmods: card above the board's socket, connector at the origin ---
const PMOD_PINS = ['3V3', 'GND', 'IO4', 'IO3', 'IO2', 'IO1'];

function pmodCard(type: string, title: string, accent: string): ModModel {
  const g = new THREE.Group();
  const parts: ModPart[] = [];
  const anims: ((s: ModState, f: number) => void)[] = [];
  const m = mats();
  const L = type === 'pmod_enc' ? 1.9 : 2.05;
  const Wd = 1.18;
  const Y = 0.42; // card underside above the socket top
  const T = 0.06;
  const face = new THREE.MeshStandardMaterial({ map: silk(L, Wd, '#1d6b3c', title, accent, PMOD_PINS), roughness: 0.5, metalness: 0.05 });
  const edge = new THREE.MeshStandardMaterial({ color: '#2a5236', roughness: 0.7 });
  const card = roundedSlab(L, Wd, T, 0.08, face, edge);
  card.position.set(0.32 + L / 2 - 0.05, Y, 0);
  g.add(card);
  pmodHeader(g, m, Y);
  const top = Y + T;
  const cx = 0.32 + L / 2;
  // a few passives near the connector
  for (let i = 0; i < 4; i++) smd(g, m, 0.9, top, -0.45 + i * 0.3, '#2a2a2a');
  if (type === 'pmod_btn') {
    const caps = ['#d84040', '#e0c040', '#3a78d8', '#3ab060'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45 }));
    for (let i = 0; i < 4; i++) anims.push(tactile(g, m, cx + 0.45, top, -0.45 + i * 0.3, caps[i], `btn${i}`, parts));
  } else if (type === 'pmod_swt') {
    for (let i = 0; i < 4; i++) anims.push(slide(g, m, cx + 0.4, top, -0.45 + i * 0.3, `sw${i}`, parts));
  } else if (type === 'pmod_8ld') {
    const leds: THREE.MeshStandardMaterial[] = [];
    for (let i = 0; i < 8; i++) {
      leds.push(led(g, cx + 0.5, top, -0.52 + i * 0.15));
      smd(g, m, cx + 0.1, top, -0.52 + i * 0.15);
    }
    anims.push((s) => {
      const b = Array.isArray(s.leds) ? s.leds : [];
      leds.forEach((mat, i) => (mat.emissiveIntensity = 0.12 + (b[i] ?? 0) * 4));
    });
  } else if (type === 'pmod_enc') {
    // rotary encoder: metal can, threaded bushing, knurled shaft and a knob that turns in detents and pushes down
    box(g, 0.62, 0.32, 0.62, m.metal, cx + 0.2, top, 0.1);
    const bush = add(g, new THREE.CylinderGeometry(0.14, 0.14, 0.14, 20), m.metal, cx + 0.2, top + 0.39, 0.1);
    const knobMat = new THREE.MeshStandardMaterial({ color: '#202226', roughness: 0.35, metalness: 0.3 });
    const knob = new THREE.Group();
    const y0 = top + 0.61;
    knob.position.set(cx + 0.2, y0, 0.1);
    const cap = add(knob, new THREE.CylinderGeometry(0.25, 0.27, 0.3, 28), knobMat, 0, 0, 0);
    const mark = box(knob, 0.03, 0.01, 0.18, m.white, 0, 0.15, -0.08);
    g.add(knob);
    parts.push({ kind: 'turn', key: 'pos', ccw: 'ccw', cw: 'cw', push: 'btn', hit: [cap, mark, bush] });
    anims.push((s, f) => {
      // clockwise seen from above is a negative turn about +y
      knob.rotation.y = toward(knob.rotation.y, -(num(s.pos) + num(s.posFrac)) * DETENT, Math.min(1, f * 1.5));
      knob.position.y = toward(knob.position.y, y0 - (num(s.btn) ? 0.06 : 0), f);
    });
    // the slide switch sits beside the knob, where the knob does not hide it from the usual viewpoint
    anims.push(slide(g, m, cx + 0.72, top, 0.3, 'swt', parts));
  }
  return { group: g, parts, show: (s, f) => anims.forEach((a) => a(s, f)) };
}

// --- HC-SR04: blue board standing on the desk, two transducers facing up, 4-pin header at the origin side ---
function hcsr04(): ModModel {
  const g = new THREE.Group();
  const m = mats();
  const L = 2.2;
  const Wd = 1.0;
  const T = 0.06;
  const face = new THREE.MeshStandardMaterial({
    map: silk(L, Wd, '#1f4fa8', 'HC-SR04', '#ffffff', ['VCC', 'Trig', 'Echo', 'GND']),
    roughness: 0.5,
  });
  const card = roundedSlab(L, Wd, T, 0.06, face, new THREE.MeshStandardMaterial({ color: '#1a3c7a', roughness: 0.7 }));
  card.position.set(L / 2, 0.06, 0);
  g.add(card);
  const top = 0.12;
  const mesh = new THREE.MeshStandardMaterial({
    roughness: 0.9,
    map: tex(1, 1, (c, w, h) => {
      c.fillStyle = '#2a2a2a';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#0a0a0a';
      for (let y = 4; y < h; y += 9) for (let x = 4; x < w; x += 9) c.fillRect(x, y, 5, 5);
    }),
  });
  for (const x of [0.7, 1.7]) {
    const can = add(g, new THREE.CylinderGeometry(0.4, 0.4, 0.45, 36, 1, true), m.metal, x, top + 0.225, 0);
    can.material = m.metal;
    add(g, new THREE.CylinderGeometry(0.37, 0.37, 0.02, 36), mesh, x, top + 0.43, 0);
  }
  // crystal + chips between the transducers
  box(g, 0.32, 0.12, 0.12, m.metal, 1.2, top, -0.3);
  box(g, 0.3, 0.06, 0.2, m.black, 1.2, top, 0.25);
  // 4-pin straight header along the near edge
  box(g, 0.12, 0.1, 0.5, m.black, 0.12, top, 0);
  for (let i = 0; i < 4; i++) add(g, new THREE.BoxGeometry(0.04, 0.3, 0.04), m.gold, 0.12, top + 0.1, -0.18 + i * 0.12);
  // the target the sound bounces off: a card held above the transducers, dragged up and down to set the distance
  const label = document.createElement('canvas');
  label.width = 288;
  label.height = 160;
  const labelTex = new THREE.CanvasTexture(label);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  let shown = -1;
  const write = (cm: number) => {
    const c = label.getContext('2d')!;
    c.fillStyle = '#e9dcc0';
    c.fillRect(0, 0, label.width, label.height);
    c.strokeStyle = '#b89f6e';
    c.lineWidth = 6;
    c.strokeRect(3, 3, label.width - 6, label.height - 6);
    c.fillStyle = '#3a2f1e';
    c.font = '700 64px sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(`${cm} cm`, label.width / 2, label.height / 2 + 4);
    labelTex.needsUpdate = true;
  };
  const board = new THREE.MeshStandardMaterial({ color: '#d9c7a2', roughness: 0.85 });
  const target = new THREE.Group();
  const plate = add(target, new THREE.BoxGeometry(1.8, 0.07, 1.0), [board, board, new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.8 }), board, board, board], 0, 0, 0);
  target.position.set(1.2, sonarHeight(50), 0);
  g.add(target);
  // faint beams from the transducers to the target
  const beamMat = new THREE.MeshBasicMaterial({ color: '#7fd6ff', transparent: true, opacity: 0.16, depthWrite: false });
  const beams = [0.7, 1.7].map((x) => {
    const b = add(g, new THREE.CylinderGeometry(0.34, 0.3, 1, 24, 1, true), beamMat, x, 0, 0);
    b.castShadow = b.receiveShadow = false;
    return b;
  });
  const base = top + 0.45;
  const show = (s: ModState, f: number) => {
    const cm = num(s.cm, 50);
    target.position.y = toward(target.position.y, sonarHeight(cm), Math.min(1, f * 1.5));
    const h = Math.max(0.01, target.position.y - 0.035 - base);
    for (const b of beams) {
      b.scale.y = h;
      b.position.y = base + h / 2;
    }
    if (Math.round(cm) !== shown) write((shown = Math.round(cm)));
  };
  return { group: g, parts: [{ kind: 'lift', key: 'cm', hit: [plate], toY: sonarHeight, fromY: sonarCm }], show };
}

// --- SG90 servo: blue plastic case with mounting ears, output spline and a white horn ---
function servo(): ModModel {
  const g = new THREE.Group();
  const m = mats();
  const blue = new THREE.MeshPhysicalMaterial({ color: '#2b5fd0', roughness: 0.25, transmission: 0.15, thickness: 0.3 });
  const label = new THREE.MeshStandardMaterial({
    roughness: 0.6,
    map: tex(1.15, 0.6, (c, w, h) => {
      c.fillStyle = '#1d47a8';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffffff';
      c.font = `700 ${Math.round(h * 0.32)}px sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('SG90', w / 2, h * 0.4);
      c.font = `500 ${Math.round(h * 0.16)}px sans-serif`;
      c.fillText('MICRO SERVO 9g', w / 2, h * 0.75);
    }),
  });
  box(g, 1.15, 1.0, 0.6, [blue, blue, blue, blue, label, blue], 0.8, 0, 0);
  box(g, 1.6, 0.06, 0.6, blue, 0.8, 0.72, 0); // mounting ears
  for (const x of [0.12, 1.48]) add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.08, 12), m.black, x, 0.76, 0);
  box(g, 0.6, 0.18, 0.6, blue, 0.55, 1.0, 0); // gear bump
  add(g, new THREE.CylinderGeometry(0.1, 0.1, 0.15, 16), m.white, 0.55, 1.25, 0);
  // single-arm horn, so its angle can be read; it follows the angle the design's pulses ask for
  const horn = new THREE.Group();
  box(horn, 0.62, 0.06, 0.14, m.white, 0.31, 0, 0);
  add(horn, new THREE.CylinderGeometry(0.07, 0.07, 0.06, 14), m.white, 0.62, 0, 0);
  add(horn, new THREE.CylinderGeometry(0.11, 0.11, 0.06, 18), m.white, 0, 0.03, 0);
  horn.position.set(0.55, 1.32, 0);
  horn.rotation.y = -Math.PI / 2;
  g.add(horn);
  // cable stub: brown, red, orange
  ['#5a3a22', '#d03030', '#f08a20'].forEach((c, i) => {
    const w = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
    add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.3, 8), w, 0.08, 0.2, -0.07 + i * 0.07).rotation.z = Math.PI / 2;
  });
  // 0° points the arm to the right (+x), 90° to the front, 180° to the left; without pulses it stays where it is
  let angle = -Math.PI / 2;
  const show = (s: ModState, f: number) => {
    const deg = num(s.deg, -1);
    if (deg >= 0) angle = (-deg * Math.PI) / 180;
    horn.rotation.y = toward(horn.rotation.y, angle, f * 0.5);
  };
  return { group: g, parts: [], show };
}

// generic breakout for any other module type
function breakout(title: string, accent: string, pins: number): ModModel {
  const g = new THREE.Group();
  const m = mats();
  const L = 1.8;
  const Wd = 1.2;
  const face = new THREE.MeshStandardMaterial({ map: silk(L, Wd, '#1d6b3c', title, accent, Array.from({ length: pins }, (_, i) => `P${i + 1}`)), roughness: 0.5 });
  const card = roundedSlab(L, Wd, 0.06, 0.06, face, new THREE.MeshStandardMaterial({ color: '#2a5236', roughness: 0.7 }));
  card.position.set(L / 2, 0.06, 0);
  g.add(card);
  box(g, 0.4, 0.07, 0.4, m.black, 1.0, 0.12, 0);
  box(g, 0.12, 0.1, Math.min(1.1, pins * 0.12), m.black, 0.12, 0.12, 0);
  return { group: g, parts: [], show: () => {} };
}

// plugged Pmods hang off the right edge; desk modules lie on the desk next to the board
export function moduleModel(type: string, title: string, accent: string, pins: number): ModModel {
  if (type.startsWith('pmod_')) return pmodCard(type, title, accent);
  if (type === 'hcsr04') return hcsr04();
  if (type === 'servo') return servo();
  return breakout(title, accent, pins);
}
