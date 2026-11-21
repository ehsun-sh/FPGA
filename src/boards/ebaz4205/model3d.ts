// Procedural 3D model of the EBAZ4205 core board (Zynq-7010), in the style of the Nexys A7 model: no external model
// files. Sizes and positions are approximate (about 1 unit = 10 mm) until they are read from the board's KiCad files
// (docs/EBAZ4205-ROADMAP.md, E0.3).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { BoardOutputs, BoardView } from '../types';
import { roundedSlab } from '../nexys-a7/modules3d';
import { expandEbazParts } from './parts';
import { HEADERS, KEYS } from './pins';
import { buildExtension, EXT_PARTS, Z0 as EXT_Z0, ZD as EXT_ZD, type ExtModel } from './ext3d';

const W = 13.6; // board length (x)
const D = 7.7; // board depth (z)
const T = 0.16;
const TOP = T / 2;
const S = 160; // silkscreen pixels per unit
const HL_COLOR = '#f0803a';
const PITCH = 0.2; // 2.0 mm headers

// DATA1-3 along the front edge, pin 1 on the left, odd pins on the row nearer the edge
const HDR_X = [-4.6, -0.6, 3.4];
const HDR_Z = 3.15;
// the two LEDs (red W14, green W13)
const LED_POS: [number, number][] = [
  [5.6, -1.2],
  [5.6, -0.8],
];
const LED_COLORS = ['#ff3030', '#30ff60'];

// where the parts named in lesson text sit: [x, z, width, depth]
const PARTS: Record<string, [number, number, number, number]> = {
  LED_R: [LED_POS[0][0], LED_POS[0][1], 0.36, 0.3],
  LED_G: [LED_POS[1][0], LED_POS[1][1], 0.36, 0.3],
  DATA1: [HDR_X[0] + 0.9, HDR_Z, 2.2, 0.6],
  DATA2: [HDR_X[1] + 0.9, HDR_Z, 2.2, 0.6],
  DATA3: [HDR_X[2] + 0.9, HDR_Z, 2.2, 0.6],
  J7: [3.0, -1.6, 0.8, 0.4],
  J8: [1.0, -3.1, 1.6, 0.6],
  U7: [-1.6, -0.8, 1.6, 1.6],
  X5: [-2.2, 1.6, 0.7, 0.5],
  R2577: [0.9, 0.9, 0.4, 0.3],
  R2584: [0.9, 1.35, 0.4, 0.3],
  J3: [6.3, 1.6, 0.6, 0.5],
  J5: [6.3, 2.4, 0.6, 0.5],
  J4: [-6.1, -2.8, 1.0, 1.4],
};

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const glowTexture = () =>
  canvasTexture(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  });

function chipTexture(lines: string[], w = 512, h = 512): THREE.Texture {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = '#151515';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#cfcfcf';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((l, i) => {
      g.font = `${i === 0 ? 700 : 500} ${i === 0 ? h / 7 : h / 11}px Arial, sans-serif`;
      g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (h / 6));
    });
  });
}

const px = (x: number) => (x + W / 2) * S;
const pz = (z: number) => (z + D / 2) * S;

function drawSilkscreen(g: CanvasRenderingContext2D) {
  g.fillStyle = '#16351f';
  g.fillRect(0, 0, W * S, D * S);
  // copper traces, faintly under the mask
  g.strokeStyle = 'rgba(80,150,90,0.25)';
  g.lineWidth = 3;
  for (let i = 0; i < 40; i++) {
    const x = ((i * 97) % 120) / 10 - 6;
    const z = ((i * 53) % 70) / 10 - 3.5;
    g.beginPath();
    g.moveTo(px(x), pz(z));
    g.lineTo(px(x + 1.2), pz(z));
    g.lineTo(px(x + 1.6), pz(z + 0.4));
    g.stroke();
  }
  g.fillStyle = '#e8e8e8';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const label = (t: string, x: number, z: number, size = 0.22) => {
    g.font = `600 ${size * S}px Arial, sans-serif`;
    g.fillText(t, px(x), pz(z));
  };
  HDR_X.forEach((x, i) => {
    label(`DATA${i + 1}`, x + 0.9, HDR_Z - 0.55);
    label('1', x - 0.25, HDR_Z + 0.2, 0.14);
    label('20', x + 2.05, HDR_Z - 0.2, 0.14);
  });
  label('EBAZ4205', -4.4, -3.2, 0.34);
  label('J7', PARTS.J7[0], PARTS.J7[1] - 0.4, 0.18);
  label('J8', PARTS.J8[0] - 1.1, PARTS.J8[1], 0.18);
  label('U7', PARTS.U7[0], PARTS.U7[1] + 1.05, 0.18);
  label('X5', PARTS.X5[0], PARTS.X5[1] + 0.45, 0.18);
  label('R2577', PARTS.R2577[0] + 0.75, PARTS.R2577[1], 0.14);
  label('R2584', PARTS.R2584[0] + 0.75, PARTS.R2584[1], 0.14);
  label('J3', PARTS.J3[0] - 0.6, PARTS.J3[1], 0.16);
  label('J5', PARTS.J5[0] - 0.6, PARTS.J5[1], 0.16);
  label('J4', PARTS.J4[0], PARTS.J4[1] + 0.95, 0.18);
  label('D', LED_POS[0][0] - 0.4, LED_POS[0][1] + 0.2, 0.14);
  // footprints of parts that are not fitted on a stock board: X5 and the SD slot U7, J7 and J8
  g.strokeStyle = '#e8e8e8';
  g.lineWidth = 3;
  for (const k of ['X5', 'U7']) {
    const [x, z, w, d] = PARTS[k];
    g.strokeRect(px(x - w / 2), pz(z - d / 2), w * S, d * S);
  }
  g.fillStyle = '#c9b27a';
  const pads = (x: number, z: number, cols: number, rows: number) => {
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        g.beginPath();
        g.arc(px(x + (c - (cols - 1) / 2) * PITCH), pz(z + (r - (rows - 1) / 2) * PITCH), 0.05 * S, 0, Math.PI * 2);
        g.fill();
      }
  };
  pads(PARTS.J7[0], PARTS.J7[1], 3, 1);
  pads(PARTS.J8[0], PARTS.J8[1], 7, 2);
  // resistor pads (R2584 fitted on a stock board: NAND boot)
  for (const k of ['R2577', 'R2584']) g.fillRect(px(PARTS[k][0] - 0.15), pz(PARTS[k][1] - 0.08), 0.3 * S, 0.16 * S);
}

export class EbazModel implements BoardView {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  switches: boolean[] = [];
  onSwitch: (i: number, on: boolean) => void = () => {};
  onButton: (b: string, pressed: boolean) => void = () => {};
  onFrame: (dt: number) => void = () => {};

  private ledMats: THREE.MeshStandardMaterial[] = [];
  private ledGlows: THREE.Sprite[] = [];
  private doneMat!: THREE.MeshStandardMaterial;
  private glowTex = glowTexture();
  private deskMat!: THREE.MeshStandardMaterial;
  private last = performance.now();
  private view: 'persp' | 'top' = 'persp';
  private userMoved = false;
  private hl: { group: THREE.Group; ring: THREE.MeshBasicMaterial; halos: THREE.Sprite[]; t: number; still: boolean } | null = null;
  private probeGroup: THREE.Group | null = null;
  private ext: ExtModel | null = null;
  private pressed = new Set<string>();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private buzzHz = 0;
  private buzzT = 0;
  private lcdTex: THREE.CanvasTexture | null = null;
  private lcdMat: THREE.MeshBasicMaterial | null = null;

  constructor(
    private container: HTMLElement,
    attached = false,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#1d2026');
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 60;
    this.controls.addEventListener('start', () => (this.userMoved = true));
    this.resetView();
    this.buildLights();
    this.buildBoard();
    if (attached) {
      this.ext = buildExtension(TOP, this.glowTex, HDR_X.map((x) => x + 0.9));
      this.scene.add(this.ext.group);
      this.bindKeys();
    }
    this.resetView();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private fit(): number {
    const aspect = this.camera.aspect || 1.5;
    // the board is long and flat: a narrow (phone) panel needs the camera further back to keep both ends in view
    const k = aspect >= 1.7 ? 1 : (1.7 / aspect) ** 1.05;
    // the extension board doubles the depth of the scene
    return this.ext ? k * 1.45 : k;
  }

  // the middle of what is on the desk (z): the core board, or the core and the extension board
  private midZ() {
    return this.ext ? (-D / 2 + EXT_Z0 + EXT_ZD) / 2 : 0.4;
  }

  private buildLights() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight('#dfe8ff', '#2a2020', 1.3));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(-6, 14, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9 });
    this.scene.add(key);
    const fill = new THREE.DirectionalLight('#ffe7d6', 0.6);
    fill.position.set(8, 6, -6);
    this.scene.add(fill);
    this.deskMat = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.95 });
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), this.deskMat);
    desk.rotation.x = -Math.PI / 2;
    desk.position.y = -0.62;
    desk.receiveShadow = true;
    this.scene.add(desk);
  }

  private box(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  private glow(color: string, x: number, y: number, z: number, size: number): THREE.Sprite {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    s.position.set(x, y, z);
    s.scale.set(size, size, size);
    this.scene.add(s);
    return s;
  }

  // a chip with its marking on top
  private chip(w: number, h: number, d: number, x: number, z: number, lines: string[]) {
    const side = new THREE.MeshStandardMaterial({ color: '#151515', roughness: 0.5 });
    const top = new THREE.MeshStandardMaterial({ map: chipTexture(lines, 512, Math.round((512 * d) / w)), roughness: 0.5 });
    this.box(w, h, d, [side, side, top, side, side, side], x, TOP, z);
  }

  private buildBoard() {
    const silk = canvasTexture(W * S, D * S, drawSilkscreen);
    const edge = new THREE.MeshStandardMaterial({ color: '#0f2a18', roughness: 0.6 });
    const top = new THREE.MeshPhysicalMaterial({ map: silk, roughness: 0.55, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    const pcb = roundedSlab(W, D, T, 0.25, top, edge);
    pcb.position.y = -TOP;
    pcb.receiveShadow = true;
    pcb.castShadow = true;
    this.scene.add(pcb);
    // mounting holes at the corners, the board resting on four standoffs
    const brass = new THREE.MeshStandardMaterial({ color: '#b8a36a', metalness: 0.8, roughness: 0.35 });
    for (const [x, z] of [
      [-W / 2 + 0.4, -D / 2 + 0.4],
      [W / 2 - 0.4, -D / 2 + 0.4],
      [-W / 2 + 0.4, D / 2 - 0.4],
      [W / 2 - 0.4, D / 2 - 0.4],
    ]) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.55, 6), brass);
      st.position.set(x, -0.35, z);
      st.castShadow = true;
      this.scene.add(st);
    }
    const black = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.55 });
    const metal = new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 0.9, roughness: 0.28 });
    const gold = new THREE.MeshStandardMaterial({ color: '#d4b25a', metalness: 0.9, roughness: 0.3 });
    // Zynq, DDR3, NAND, Ethernet PHY
    this.chip(1.7, 0.16, 1.7, -0.2, -1.0, ['XC7Z010', 'CLG400', 'ZYNQ-7000']);
    this.chip(1.3, 0.1, 0.9, 2.1, -1.4, ['DDR3', 'MT41K128M16']);
    this.chip(1.4, 0.1, 0.85, -2.2, -2.4, ['NAND', 'W29N01HV']);
    this.chip(0.7, 0.08, 0.7, -3.6, 0.0, ['IP101GA']);
    // RJ45 with its two LEDs, on the left edge
    const rj = this.box(1.6, 1.3, 1.6, metal, -W / 2 + 0.8, TOP, 0.2);
    rj.castShadow = true;
    this.box(0.05, 0.9, 1.1, black, -W / 2 - 0.02, TOP + 0.12, 0.2);
    for (const [dz, c] of [
      [-0.55, '#ffb020'],
      [0.55, '#30d050'],
    ] as const)
      this.box(0.06, 0.18, 0.25, new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.15 }), -W / 2 - 0.03, TOP + 1.0, 0.2 + dz);
    // power connector J4 (6-pin Mini-Fit Jr.)
    this.box(PARTS.J4[2], 0.9, PARTS.J4[3], new THREE.MeshStandardMaterial({ color: '#e8e2d0', roughness: 0.6 }), PARTS.J4[0], TOP, PARTS.J4[1]);
    // fan headers J3 and J5 (3-pin)
    for (const k of ['J3', 'J5']) {
      const [x, z] = PARTS[k];
      this.box(0.3, 0.5, 0.75, new THREE.MeshStandardMaterial({ color: '#f2f2f2', roughness: 0.6 }), x, TOP, z);
    }
    // DATA1-3: black 2x10 shrouds with gold pins
    for (const hx of HDR_X) {
      this.box(10 * PITCH + 0.1, 0.25, 2 * PITCH + 0.1, black, hx + 0.9, TOP, HDR_Z);
      for (let i = 0; i < 20; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), gold);
        const { x, z } = this.pinPos(hx, i + 1);
        p.position.set(x, TOP + 0.35, z);
        this.scene.add(p);
      }
    }
    // a few passives and small parts, for texture
    const cap = new THREE.MeshStandardMaterial({ color: '#8a6a40', roughness: 0.6 });
    for (let i = 0; i < 24; i++) this.box(0.16, 0.06, 0.08, cap, -1.3 + (i % 8) * 0.35, TOP, 0.5 + Math.floor(i / 8) * 0.25);
    for (const k of ['R2584']) this.box(0.2, 0.05, 0.1, black, PARTS[k][0], TOP, PARTS[k][1]);
    // the two user LEDs and the DONE LED
    LED_POS.forEach(([x, z], i) => {
      const m = new THREE.MeshStandardMaterial({ color: '#f4f4f4', emissive: LED_COLORS[i], emissiveIntensity: 0, roughness: 0.3 });
      this.box(0.22, 0.1, 0.14, m, x, TOP, z);
      this.ledMats.push(m);
      this.ledGlows.push(this.glow(LED_COLORS[i], x, TOP + 0.15, z, 0.9));
    });
    this.doneMat = new THREE.MeshStandardMaterial({ color: '#f4f4f4', emissive: '#3090ff', emissiveIntensity: 0, roughness: 0.3 });
    this.box(0.2, 0.08, 0.12, this.doneMat, 4.8, TOP, -1.0);
  }

  // header pin position: odd pins on the row nearer the front edge, pin 1 at the left
  private pinPos(hx: number, num: number) {
    const col = Math.floor((num - 1) / 2);
    return { x: hx + col * PITCH, z: HDR_Z + (num % 2 ? PITCH / 2 : -PITCH / 2) };
  }

  setProbes(probes: { pin: string; color: string }[]) {
    if (this.probeGroup) {
      this.scene.remove(this.probeGroup);
      this.probeGroup.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      this.probeGroup = null;
    }
    if (!probes.length) return;
    const g = new THREE.Group();
    probes.forEach(({ pin, color }, n) => {
      const hi = HEADERS.findIndex((h) => Object.values(h.pins).includes(pin));
      if (hi < 0) return;
      const num = +Object.entries(HEADERS[hi].pins).find(([, p]) => p === pin)![0];
      const { x, z } = this.pinPos(HDR_X[hi], num);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
      const clip = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 10), mat);
      clip.position.set(x, TOP + 0.7, z);
      g.add(clip);
      const spread = (n % 8) * 0.06;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, TOP + 0.85, z),
        new THREE.Vector3(x, TOP + 1.3 + spread, z + 0.3),
        new THREE.Vector3(x + 0.3, TOP + 0.9 + spread, z + 1.6),
        new THREE.Vector3(x + 0.6, -0.4, z + 2.8),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.025, 6), mat.clone()));
    });
    this.probeGroup = g;
    this.scene.add(g);
  }

  resetView() {
    this.view = 'persp';
    this.userMoved = false;
    const k = this.fit();
    const z = this.midZ();
    if (this.monitor) {
      this.camera.position.set(0, 13 * k, z + 13 * k);
      this.controls.target.set(0, 2.2, z - 4.5);
    } else {
      this.camera.position.set(0, 11 * k, z + 9.6 * k);
      this.controls.target.set(0, 0, z);
    }
    this.controls.update();
  }

  topView() {
    this.view = 'top';
    this.userMoved = false;
    const k = this.fit();
    const z = this.midZ();
    this.camera.position.set(0, 15.5 * k, z + 0.1);
    this.controls.target.set(0, 0, z);
    this.controls.update();
  }

  fitView() {
    if (this.view === 'top') this.topView();
    else this.resetView();
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    const prev = this.camera.aspect;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (Math.abs(prev - this.camera.aspect) > 0.01 && !this.userMoved) this.fitView();
  }

  // light up the named parts (LED_R, DATA2, J7, R2577 ...): a frame on the PCB and a halo; [] clears
  highlight(names: string[]) {
    if (this.hl) {
      this.scene.remove(this.hl.group);
      this.hl.group.traverse((o) => o instanceof THREE.Mesh && o.geometry.dispose());
      for (const s of this.hl.halos) s.material.dispose();
      this.hl.ring.dispose();
      this.hl = null;
    }
    const parts = expandEbazParts(names).filter((p) => PARTS[p] || (this.ext && EXT_PARTS[p]));
    if (!parts.length) return;
    const group = new THREE.Group();
    const ring = new THREE.MeshBasicMaterial({ color: HL_COLOR, transparent: true, depthWrite: false });
    const halos: THREE.Sprite[] = [];
    for (const p of parts) {
      const [x, z, w, d] = PARTS[p] ?? EXT_PARTS[p];
      const y = PARTS[p] ? TOP : TOP + (p === 'LCD' ? 0.4 : 0.02);
      const t = 0.06;
      for (const [fx, fz, fw, fd] of [
        [x, z - d / 2 + t / 2, w, t],
        [x, z + d / 2 - t / 2, w, t],
        [x - w / 2 + t / 2, z, t, d - 2 * t],
        [x + w / 2 - t / 2, z, t, d - 2 * t],
      ]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(fw, 0.012, fd), ring);
        m.position.set(fx, y + 0.012, fz);
        group.add(m);
      }
      const s = this.glow(HL_COLOR, x, y + 0.3, z, Math.max(w, d) + 0.5);
      this.scene.remove(s);
      group.add(s);
      halos.push(s);
    }
    this.scene.add(group);
    this.hl = { group, ring, halos, t: 0, still: matchMedia('(prefers-reduced-motion: reduce)').matches };
  }

  setBackground(hex: string) {
    (this.scene.background as THREE.Color).set(hex);
    const n = parseInt(hex.slice(1), 16) + 0x0e0f10;
    this.deskMat.color.set('#' + n.toString(16).padStart(6, '0'));
  }

  isPressed(name: string) {
    return this.pressed.has(name);
  }

  press(name: string, down: boolean) {
    if (!this.ext?.keyCaps.has(name) || this.pressed.has(name) === down) return;
    if (down) this.pressed.add(name);
    else this.pressed.delete(name);
    this.keyButtons.get(name)?.setAttribute('aria-pressed', String(down));
    this.onButton(name, down);
  }

  setOutputs(o: BoardOutputs) {
    const mats = [...this.ledMats, ...(this.ext?.ledMats ?? [])];
    const glows = [...this.ledGlows, ...(this.ext?.ledGlows ?? [])];
    mats.forEach((m, i) => {
      const b = o.led[i] ?? 0;
      m.emissiveIntensity = b * 3.2;
      glows[i].material.opacity = Math.min(1, b * 1.1);
    });
    this.doneMat.emissiveIntensity = o.done ? 3 : 0;
    this.buzzHz = o.buzzer ?? 0;
  }

  // the extension board's LCD: the canvas the display model paints, or dark glass
  setLcd(screen: HTMLCanvasElement | null) {
    if (!this.ext) return;
    if (this.lcdTex && this.lcdTex.image !== screen) {
      this.lcdTex.dispose();
      this.lcdMat?.dispose();
      this.lcdTex = null;
      this.lcdMat = null;
    }
    if (screen && !this.lcdTex) {
      this.lcdTex = new THREE.CanvasTexture(screen);
      this.lcdTex.colorSpace = THREE.SRGBColorSpace;
      this.lcdTex.magFilter = THREE.NearestFilter;
      this.lcdMat = new THREE.MeshBasicMaterial({ map: this.lcdTex, toneMapped: false });
    }
    this.ext.lcd.material = this.lcdMat ?? this.ext.dark;
  }

  refreshLcd() {
    if (this.lcdTex) this.lcdTex.needsUpdate = true;
  }

  // the keys: pressed on the 3D board with the mouse or a finger (held while the pointer is down), and from the
  // keyboard on the key pad in the corner (Space or Enter, held while the key is down)
  private keyButtons = new Map<string, HTMLButtonElement>();
  private bindKeys() {
    const el = this.renderer.domElement;
    const caps = [...this.ext!.keyCaps.values()];
    const pick = (ev: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      this.pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(caps, false)[0];
      return hit ? (hit.object.userData.key as string) : null;
    };
    // capturing, so it runs before OrbitControls: pressing a key never turns the view as well
    el.addEventListener(
      'pointerdown',
      (ev) => {
        const k = pick(ev);
        if (!k) return;
        this.controls.enabled = false;
        this.press(k, true);
      },
      true,
    );
    const release = () => {
      for (const k of [...this.pressed]) if (!this.held.has(k)) this.press(k, false);
      this.controls.enabled = true;
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', () => {
      this.held.clear();
      release();
    });
    el.addEventListener('pointermove', (ev) => {
      el.style.cursor = pick(ev) ? 'pointer' : 'grab';
    });
    const pad = document.createElement('div');
    pad.className = 'key-pad';
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', 'Extension board keys');
    for (const [name] of KEYS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = name.replace('KEY', 'K');
      b.title = `${name}: hold Space or Enter, or press the key on the board`;
      b.setAttribute('aria-label', name);
      b.setAttribute('aria-pressed', 'false');
      const down = (e: Event) => {
        e.preventDefault();
        this.held.add(name);
        this.press(name, true);
      };
      const up = () => {
        this.held.delete(name);
        this.press(name, false);
      };
      b.addEventListener('pointerdown', down);
      b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('keydown', (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) down(e);
      });
      b.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') up();
      });
      b.addEventListener('blur', up);
      pad.appendChild(b);
      this.keyButtons.set(name, b);
    }
    this.container.appendChild(pad);
  }
  private held = new Set<string>();

  // HDMI monitor behind the boards, with a cable from the extension board's HDMI socket
  private monitor: { group: THREE.Group; tex: THREE.CanvasTexture; led: THREE.MeshStandardMaterial; signal: boolean | null } | null = null;
  setMonitor(screen: HTMLCanvasElement | null) {
    if (this.monitor && (!screen || this.monitor.tex.image !== screen)) {
      this.scene.remove(this.monitor.group);
      this.monitor.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      this.monitor.tex.dispose();
      this.monitor = null;
    }
    if (screen && !this.monitor && this.ext) this.buildMonitor(screen);
    if (!this.userMoved) this.fitView();
  }

  refreshMonitor() {
    if (this.monitor) this.monitor.tex.needsUpdate = true;
  }

  updateMonitor(signal: boolean) {
    const m = this.monitor;
    if (!m || m.signal === signal) return;
    m.signal = signal;
    m.led.emissive.set(signal ? '#27d65a' : '#ffae1a');
  }

  private buildMonitor(screen: HTMLCanvasElement) {
    const g = new THREE.Group();
    const add = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y + h / 2, z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };
    const plastic = new THREE.MeshStandardMaterial({ color: '#16181c', roughness: 0.55, metalness: 0.1 });
    const dark = new THREE.MeshStandardMaterial({ color: '#0b0c0e', roughness: 0.4 });
    const tex = new THREE.CanvasTexture(screen);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const MZ = -D / 2 - 2.6; // screen plane, behind the core board
    const SW_ = 11.2; // screen size (4:3)
    const SH = 8.4;
    const BOT = 1.6;
    const DESK = -0.62;
    add(4.6, 0.18, 2.8, plastic, 0, DESK, MZ - 0.6);
    add(1.1, BOT - DESK - 0.2, 0.5, plastic, 0, DESK + 0.18, MZ - 0.75);
    add(SW_ + 0.7, SH + 0.8, 0.5, plastic, 0, BOT - 0.55, MZ - 0.3);
    add(SW_ + 0.7, 0.45, 0.12, dark, 0, BOT - 0.55, MZ);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(SW_, SH), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    scr.position.set(0, BOT + SH / 2 - 0.05, MZ - 0.04);
    g.add(scr);
    const led = new THREE.MeshStandardMaterial({ color: '#222', emissive: '#ffae1a', emissiveIntensity: 2.5 });
    const ledM = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), led);
    ledM.position.set(SW_ / 2 - 0.2, BOT - 0.33, MZ + 0.08);
    g.add(ledM);
    // cable from the HDMI socket on the right edge, round the boards on the desk and up into the monitor
    const [hx, hz] = EXT_PARTS.HDMI;
    const cableMat = new THREE.MeshStandardMaterial({ color: '#1b1b1f', roughness: 0.6 });
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(hx + 0.6, TOP + 0.4, hz),
      new THREE.Vector3(hx + 1.6, TOP + 0.2, hz),
      new THREE.Vector3(W / 2 + 1.2, DESK + 0.1, 2),
      new THREE.Vector3(W / 2 + 0.6, DESK + 0.1, MZ + 1.2),
      new THREE.Vector3(SW_ / 2 - 1.5, BOT + 0.6, MZ - 0.62),
    ]);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.09, 8), cableMat);
    cable.castShadow = true;
    g.add(cable);
    add(0.7, 0.4, 1.0, cableMat, hx + 0.85, TOP + 0.15, hz);
    this.scene.add(g);
    this.monitor = { group: g, tex, led, signal: null };
  }

  private tick() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.onFrame(dt);
    const h = this.hl;
    if (h) {
      h.t += dt;
      const k = h.still ? 1 : 0.5 + 0.5 * Math.sin((h.t / 1.2) * Math.PI * 2);
      for (const s of h.halos) s.material.opacity = 0.35 + 0.55 * k;
      h.ring.opacity = 0.6 + 0.4 * k;
    }
    const ext = this.ext;
    if (ext) {
      // key caps go down while pressed; the buzzer trembles and glows faintly while it sounds
      for (const [name, cap] of ext.keyCaps) {
        const target = TOP + 0.41 - (this.pressed.has(name) ? 0.08 : 0);
        cap.position.y += (target - cap.position.y) * Math.min(1, dt * 30);
      }
      this.buzzT += dt;
      const on = this.buzzHz > 0;
      const m = ext.buzzer.material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = on ? 0.25 + 0.15 * Math.sin(this.buzzT * 40) : 0;
      const sc = on ? 1 + 0.03 * Math.sin(this.buzzT * 60) : 1;
      ext.buzzer.scale.set(sc, 1, sc);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
