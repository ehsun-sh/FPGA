// The EBAZ4205 extension board ("adapter board"), procedural like the core board. It lies beside the core board's
// front edge, its three right-angle sockets H1-H3 on the DATA headers, as in the vendor's photos. Positions are read
// off the vendor's photo (adapter board_SCH.pdf and EBAZ4205-Instruction.pdf): 100 x 86 mm, turned so its socket
// edge faces the core board. Sizes are approximate (about 1 unit = 10 mm).
import * as THREE from 'three';
import { roundedSlab } from '../nexys-a7/modules3d';
import { KEYS } from './pins';

export const EXT_T = 0.16;
// the board's outline in scene units: x from X0 to X0 + XW, z from Z0 to Z0 + ZD
export const X0 = -4.9;
export const XW = 10.4;
export const Z0 = 3.93;
export const ZD = 8.6;
const S = 150; // silkscreen pixels per unit

// where the parts sit, [x, z, width, depth] (also the frames the lesson-text chips light up)
const KEY_C = { x: -2.6, z: 9.2 };
const KEY_STEP = 0.95;
// the five keys sit in a cross: KEY3 in the middle, KEY1 and KEY4 on either side, KEY2 and KEY5 front and back
const KEY_POS: Record<string, [number, number]> = {
  KEY1: [KEY_C.x + KEY_STEP, KEY_C.z],
  KEY2: [KEY_C.x, KEY_C.z - KEY_STEP],
  KEY3: [KEY_C.x, KEY_C.z],
  KEY4: [KEY_C.x - KEY_STEP, KEY_C.z],
  KEY5: [KEY_C.x, KEY_C.z + KEY_STEP],
};
export const EXT_LED_POS: [number, number][] = [
  [2.6, 11.85],
  [2.18, 11.85],
  [1.76, 11.85],
];
const LCD_C = { x: 1.0, z: 9.25 };
const LCD_SIZE = 2.34; // the 240 x 240 active area (23.4 mm)
const LCD_MOD = 2.8;
export const EXT_PARTS: Record<string, [number, number, number, number]> = {
  ...Object.fromEntries(Object.entries(KEY_POS).map(([k, [x, z]]) => [k, [x, z, 0.75, 0.75]])),
  LED1: [EXT_LED_POS[0][0], EXT_LED_POS[0][1], 0.34, 0.3],
  LED2: [EXT_LED_POS[1][0], EXT_LED_POS[1][1], 0.34, 0.3],
  LED3: [EXT_LED_POS[2][0], EXT_LED_POS[2][1], 0.34, 0.3],
  BUZZER: [3.5, 11.4, 1.3, 1.3],
  LCD: [LCD_C.x, LCD_C.z, LCD_MOD + 0.2, LCD_MOD + 0.2],
  HDMI: [4.95, 9.6, 1.3, 1.7],
  USB_C: [5.0, 7.35, 1.1, 1.1],
};

const px = (x: number) => (x - X0) * S;
const pz = (z: number) => (z - Z0) * S;

function texture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function drawSilk(g: CanvasRenderingContext2D, sockets: number[]) {
  g.fillStyle = '#1f6b34';
  g.fillRect(0, 0, XW * S, ZD * S);
  g.strokeStyle = 'rgba(140,220,150,0.22)';
  g.lineWidth = 3;
  // traces fanning out from the sockets
  for (let i = 0; i < 36; i++) {
    const x = sockets[i % 3] - 0.9 + (i % 12) * 0.16;
    g.beginPath();
    g.moveTo(px(x), pz(Z0 + 0.8));
    g.lineTo(px(x), pz(Z0 + 1.4 + (i % 5) * 0.2));
    g.lineTo(px(x * 0.6 + 0.6), pz(Z0 + 2.6 + (i % 7) * 0.25));
    g.stroke();
  }
  g.fillStyle = '#f2f2f2';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const label = (t: string, x: number, z: number, size = 0.2, rot = 0) => {
    g.save();
    g.translate(px(x), pz(z));
    g.rotate(rot);
    g.font = `600 ${size * S}px Arial, sans-serif`;
    g.fillText(t, 0, 0);
    g.restore();
  };
  sockets.forEach((x, i) => label(`H${i + 1}`, x, Z0 + 0.95, 0.2));
  for (const [k, [x, z]] of Object.entries(KEY_POS)) label(k, x, z + 0.48, 0.15);
  EXT_LED_POS.forEach(([x, z], i) => label(`LED${i + 1}`, x, z - 0.32, 0.12));
  label('BEEP', EXT_PARTS.BUZZER[0], EXT_PARTS.BUZZER[1] - 0.85, 0.15);
  label('HDMI', EXT_PARTS.HDMI[0] - 1.0, EXT_PARTS.HDMI[1], 0.17, -Math.PI / 2);
  label('USB', EXT_PARTS.USB_C[0] - 0.9, EXT_PARTS.USB_C[1], 0.15, -Math.PI / 2);
  label('UART_USB_TTL', 4.55, 5.3, 0.13, -Math.PI / 2);
  label('H4', -0.13, 12.4, 0.16);
  label('EBAZ4205 adapter', -2.4, 12.2, 0.2);
  label('LCD_T20', LCD_C.x, LCD_C.z - LCD_MOD / 2 - 0.25, 0.14);
}

export interface ExtModel {
  group: THREE.Group;
  ledMats: THREE.MeshStandardMaterial[];
  ledGlows: THREE.Sprite[];
  keyCaps: Map<string, THREE.Mesh>;
  buzzer: THREE.Mesh;
  lcd: THREE.Mesh; // the screen; its material shows the LCD canvas, or dark glass
  dark: THREE.Material;
}

export function buildExtension(top: number, glowTex: THREE.Texture, sockets: number[]): ExtModel {
  const group = new THREE.Group();
  const add = (w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const glow = (color: string, x: number, y: number, z: number, size: number) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    s.position.set(x, y, z);
    s.scale.set(size, size, size);
    group.add(s);
    return s;
  };
  const silk = texture(XW * S, ZD * S, (g) => drawSilk(g, sockets));
  const pcbTop = new THREE.MeshPhysicalMaterial({ map: silk, roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const edge = new THREE.MeshStandardMaterial({ color: '#145225', roughness: 0.6 });
  const pcb = roundedSlab(XW, ZD, EXT_T, 0.3, pcbTop, edge);
  pcb.position.set(X0 + XW / 2, top - EXT_T, Z0 + ZD / 2);
  pcb.receiveShadow = true;
  pcb.castShadow = true;
  group.add(pcb);
  const brass = new THREE.MeshStandardMaterial({ color: '#b8a36a', metalness: 0.8, roughness: 0.35 });
  for (const [x, z] of [
    [X0 + 0.45, Z0 + 0.45],
    [X0 + XW - 0.45, Z0 + 0.45],
    [X0 + 0.45, Z0 + ZD - 0.45],
    [X0 + XW - 0.45, Z0 + ZD - 0.45],
  ]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.55, 6), brass);
    st.position.set(x, -0.35, z);
    group.add(st);
  }
  const black = new THREE.MeshStandardMaterial({ color: '#121212', roughness: 0.5 });
  const metal = new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 0.9, roughness: 0.28 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d4b25a', metalness: 0.9, roughness: 0.3 });
  const y = top;
  // H1-H3: right-angle sockets over the core board's DATA headers
  for (const x of sockets) add(2.25, 0.45, 0.75, black, x, y - 0.05, Z0 + 0.05);
  // H4: a 2x10 pin header with the pins no part uses
  add(2.6, 0.25, 0.52, black, -0.13, y, 11.95);
  for (let i = 0; i < 20; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), gold);
    p.position.set(-0.13 - 1.143 + Math.floor(i / 2) * 0.254, y + 0.4, 11.95 + (i % 2 ? 0.127 : -0.127));
    group.add(p);
  }
  // UART_USB_TTL: a 4-pin header
  add(0.3, 0.25, 1.05, black, 4.85, y, 5.3);
  for (let i = 0; i < 4; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), gold);
    p.position.set(4.85, y + 0.4, 5.3 - 0.38 + i * 0.254);
    group.add(p);
  }
  // USB-C and the CH340C, HDMI on the right edge
  const [ux, uz] = EXT_PARTS.USB_C;
  add(0.75, 0.32, 0.9, metal, ux + 0.15, y, uz);
  add(0.05, 0.12, 0.62, black, ux + 0.53, y + 0.1, uz);
  add(0.5, 0.12, 0.95, new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.45 }), 3.3, y, 7.15);
  const [hx, hz] = EXT_PARTS.HDMI;
  add(1.1, 0.55, 1.5, metal, hx, y, hz);
  add(0.05, 0.3, 1.15, black, hx + 0.56, y + 0.12, hz);
  // the buzzer: a black cylinder with a hole on top
  const [bx, bz] = EXT_PARTS.BUZZER;
  const buzzer = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.6, 28), new THREE.MeshStandardMaterial({ color: '#191919', roughness: 0.6, emissive: '#ff9a3c', emissiveIntensity: 0 }));
  buzzer.position.set(bx, y + 0.3, bz);
  buzzer.castShadow = true;
  group.add(buzzer);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16), new THREE.MeshBasicMaterial({ color: '#050505' }));
  hole.position.set(bx, y + 0.61, bz);
  group.add(hole);
  // the LCD module: a black frame, the screen, and its ribbon towards -x
  add(LCD_MOD, 0.3, LCD_MOD, black, LCD_C.x, y + 0.05, LCD_C.z);
  add(0.4, 0.04, 1.6, new THREE.MeshStandardMaterial({ color: '#c27a2a', roughness: 0.5 }), LCD_C.x - LCD_MOD / 2 - 0.15, y, LCD_C.z);
  const dark = new THREE.MeshStandardMaterial({ color: '#0a0d12', roughness: 0.15, metalness: 0.3 });
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(LCD_SIZE, LCD_SIZE), dark);
  // the display's top row points to +x (as on the real board with its sockets away from you)
  lcd.rotation.order = 'YXZ';
  lcd.rotation.set(-Math.PI / 2, -Math.PI / 2, 0);
  lcd.position.set(LCD_C.x + 0.05, y + 0.36, LCD_C.z);
  group.add(lcd);
  // the keys: tactile switches with round caps
  const body = new THREE.MeshStandardMaterial({ color: '#d8d8d8', metalness: 0.7, roughness: 0.35 });
  const capMat = new THREE.MeshStandardMaterial({ color: '#202020', roughness: 0.5 });
  const keyCaps = new Map<string, THREE.Mesh>();
  for (const [name] of KEYS) {
    const [x, z] = KEY_POS[name];
    add(0.6, 0.3, 0.6, body, x, y, z);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.22, 20), capMat.clone());
    cap.position.set(x, y + 0.41, z);
    cap.castShadow = true;
    cap.userData.key = name;
    group.add(cap);
    keyCaps.set(name, cap);
  }
  // LED1-LED3 (white bodies, red light, as fitted) and the 3.3 V power LED
  const ledMats: THREE.MeshStandardMaterial[] = [];
  const ledGlows: THREE.Sprite[] = [];
  for (const [x, z] of EXT_LED_POS) {
    const m = new THREE.MeshStandardMaterial({ color: '#f4f4f4', emissive: '#ff3a2a', emissiveIntensity: 0, roughness: 0.3 });
    add(0.2, 0.1, 0.14, m, x, y, z);
    ledMats.push(m);
    ledGlows.push(glow('#ff3a2a', x, y + 0.15, z, 0.8));
  }
  const pwr = new THREE.MeshStandardMaterial({ color: '#f4f4f4', emissive: '#ff3a2a', emissiveIntensity: 1.6, roughness: 0.3 });
  add(0.2, 0.1, 0.14, pwr, 4.0, y, 8.4);
  const g = glow('#ff3a2a', 4.0, y + 0.15, 8.4, 0.6);
  g.material.opacity = 0.6;
  // a few passives
  const cap = new THREE.MeshStandardMaterial({ color: '#8a6a40', roughness: 0.6 });
  for (let i = 0; i < 10; i++) add(0.16, 0.06, 0.08, cap, 2.3 + (i % 5) * 0.3, y, 6.0 + Math.floor(i / 5) * 0.3);
  return { group, ledMats, ledGlows, keyCaps, buzzer, lcd, dark };
}
