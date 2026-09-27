// Procedural 3D model of the Digilent Nexys A7-100T with interactive switches/buttons and glowing LEDs / 7-segment digits.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ButtonName = 'BTNC' | 'BTNU' | 'BTNL' | 'BTNR' | 'BTND' | 'CPU_RESETN';

export interface BoardOutputs {
  led: number[]; // 16 brightness values 0..1
  rgb: [number, number, number][]; // LD16, LD17
  seg: number[][]; // [digit 0..7][a,b,c,d,e,f,g,dp] brightness
  done: boolean;
}

const W = 13; // board width (x)
const D = 11; // board depth (z)
const T = 0.16; // pcb thickness
const TOP = T / 2;
const S = 180; // silkscreen texture pixels per unit

const SW_X = (i: number) => -5.9 + (15 - i) * 0.6;
const SW_Z = 4.7;
const LED_Z = 3.85;
const SEG_Z = 2.35;
const DIGIT_X = (i: number) => -5.55 + (7 - i) * 0.62 + (i < 4 ? 0.25 : 0);
const BTN_C = new THREE.Vector3(4.95, 0, 3.3);
const BTN_OFF = 0.9;

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function glowTexture(): THREE.Texture {
  return canvasTexture(128, 128, (g) => {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  });
}

// board coordinates -> silkscreen canvas pixels
const px = (x: number) => (x + W / 2) * S;
const pz = (z: number) => (z + D / 2) * S;

function drawSilkscreen(g: CanvasRenderingContext2D) {
  const w = W * S;
  const h = D * S;
  // solder mask
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, '#b3202a');
  grd.addColorStop(1, '#9c1a23');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  // faint copper traces
  g.strokeStyle = 'rgba(120,10,18,0.55)';
  g.lineWidth = 3;
  const rnd = mulberry(7);
  for (let i = 0; i < 260; i++) {
    let x = rnd() * w;
    let y = rnd() * h;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      if (rnd() < 0.5) x += (rnd() - 0.5) * 500;
      else y += (rnd() - 0.5) * 500;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // vias
  g.fillStyle = 'rgba(210,170,90,0.55)';
  for (let i = 0; i < 500; i++) {
    g.beginPath();
    g.arc(rnd() * w, rnd() * h, 4, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#f4f1ea';
  g.strokeStyle = '#f4f1ea';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const text = (t: string, x: number, z: number, size = 34, weight = '600') => {
    g.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
    g.fillText(t, px(x), pz(z));
  };
  const box = (x: number, z: number, bw: number, bd: number, lw = 4) => {
    g.lineWidth = lw;
    g.strokeRect(px(x - bw / 2), pz(z - bd / 2), bw * S, bd * S);
  };
  // board edge outline
  g.lineWidth = 6;
  g.strokeRect(20, 20, w - 40, h - 40);

  text('NEXYS A7', -3.3, -2.2, 120, '800');
  text('DIGILENT', -3.3, -1.45, 64, '700');
  text('FPGA Trainer Board · Artix-7 100T', -3.3, -0.95, 34, '500');
  for (let i = 0; i < 16; i++) {
    text(`SW${i}`, SW_X(i), SW_Z + 0.55, 30);
    text(`LD${i}`, SW_X(i), LED_Z + 0.3, 26);
    box(SW_X(i), SW_Z, 0.4, 0.66, 3);
  }
  text('ON ▲', SW_X(15) - 0.05, SW_Z - 0.52, 22);
  box(DIGIT_X(5.5), SEG_Z, 2.55, 1.35);
  box(DIGIT_X(1.5), SEG_Z, 2.55, 1.35);
  for (let i = 0; i < 8; i++) text(`AN${i}`, DIGIT_X(i), SEG_Z + 0.85, 24);
  text('BTNU', BTN_C.x, BTN_C.z - BTN_OFF - 0.45, 26);
  text('BTND', BTN_C.x, BTN_C.z + BTN_OFF + 0.45, 26);
  text('BTNL', BTN_C.x - BTN_OFF, BTN_C.z + 0.48, 24);
  text('BTNR', BTN_C.x + BTN_OFF, BTN_C.z + 0.48, 24);
  text('BTNC', BTN_C.x, BTN_C.z + 0.48, 24);
  text('CPU RESET', 5.2, 0.95, 26);
  text('LD16', 2.0, 3.0, 24);
  text('LD17', 2.9, 3.0, 24);
  text('DONE', -0.75, -3.25, 24);
  text('POWER', -5.55, -4.3, 26);
  text('PROG / UART', -3.4, -4.3, 26);
  text('VGA', -0.9, -4.1, 30);
  text('USB HOST', 1.6, -4.3, 26);
  text('ETHERNET', 4.2, -3.8, 26);
  text('AUDIO', 2.9, 1.25, 22);
  text('MIC', 3.8, 1.2, 22);
  text('JXADC', -6.05 + 0.5, -0.2, 24);
  ['JA', 'JB', 'JC', 'JD'].forEach((j, i) => text(j, 5.35, -3.6 + i * 1.25, 30, '700'));
  text('PROG', -2.0, -3.25, 22);
  text('xc7a100tcsg324-1', 0.55, 0.95, 24);
  text('Educational 3D replica of the Nexys A7-100T · not affiliated with Digilent', -1.2, 5.38, 22, '400');
  // mounting-hole rings
  for (const [x, z] of [
    [-6.1, -5.1],
    [6.1, -5.1],
    [-6.1, 5.1],
    [6.1, 5.1],
  ]) {
    g.lineWidth = 8;
    g.beginPath();
    g.arc(px(x), pz(z), 0.22 * S, 0, Math.PI * 2);
    g.stroke();
  }
}

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function chipTexture(lines: { t: string; size: number; weight?: string }[], w = 512, h = 512, bg = '#161616'): THREE.Texture {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(8, 8, w - 16, h - 16);
    g.fillStyle = '#cfcfcf';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const total = lines.reduce((s, l) => s + l.size * 1.3, 0);
    let y = h / 2 - total / 2;
    for (const l of lines) {
      g.font = `${l.weight ?? '600'} ${l.size}px Arial, sans-serif`;
      y += l.size * 0.65;
      g.fillText(l.t, w / 2, y);
      y += l.size * 0.65;
    }
    g.beginPath();
    g.arc(40, h - 40, 12, 0, Math.PI * 2);
    g.fillStyle = '#0b0b0b';
    g.fill();
  });
}

interface Interactive {
  kind: 'sw' | 'btn';
  index: number;
  name?: ButtonName;
}

export class Board3D {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  switches: boolean[] = new Array(16).fill(false);
  onSwitch: (i: number, on: boolean) => void = () => {};
  onButton: (b: ButtonName, pressed: boolean) => void = () => {};
  onFrame: (dt: number) => void = () => {};

  private knobs: THREE.Mesh[] = [];
  private btnCaps = new Map<ButtonName, THREE.Mesh>();
  private pressed = new Set<ButtonName>();
  private ledMats: THREE.MeshStandardMaterial[] = [];
  private ledGlows: THREE.Sprite[] = [];
  private rgbMats: THREE.MeshStandardMaterial[] = [];
  private rgbGlows: THREE.Sprite[] = [];
  private segMats: THREE.MeshStandardMaterial[][] = [];
  private doneMat!: THREE.MeshStandardMaterial;
  private doneGlow!: THREE.Sprite;
  private pickables: THREE.Object3D[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private last = performance.now();
  private glowTex = glowTexture();
  private disposed = false;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#1d2026');
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.48;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 40;
    this.controls.addEventListener('start', () => (this.userMoved = true));
    this.resetView();
    this.buildLights();
    this.buildBoard();
    this.bindPointer();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  private view: 'persp' | 'top' = 'persp';
  private userMoved = false;

  // distance multiplier so the whole board fits the panel's aspect ratio
  private fit(): number {
    const aspect = this.camera.aspect || 1.5;
    return aspect >= 1.45 ? 1 : (1.45 / aspect) ** 0.95;
  }

  resetView() {
    this.view = 'persp';
    this.userMoved = false;
    const k = this.fit();
    this.camera.position.set(0, 14.5 * k, 11.5 * k);
    this.controls.target.set(0, 0, 0.6);
    this.controls.update();
  }

  topView() {
    this.view = 'top';
    this.userMoved = false;
    const k = this.fit();
    this.camera.position.set(0, 19 * k, 0.6);
    this.controls.target.set(0, 0, 0.5);
    this.controls.update();
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
    // re-frame on resize unless the user is exploring (keeps their orbit otherwise)
    if (Math.abs(prev - this.camera.aspect) > 0.01 && !this.userMoved) {
      if (this.view === 'top') this.topView();
      else this.resetView();
    }
  }

  private buildLights() {
    this.scene.add(new THREE.HemisphereLight('#dfe8ff', '#2a2020', 1.3));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(-6, 14, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -9;
    sc.right = 9;
    sc.top = 9;
    sc.bottom = -9;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight('#ffe7d6', 0.6);
    fill.position.set(8, 6, -6);
    this.scene.add(fill);
    // desk
    const desk = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.95 }));
    desk.rotation.x = -Math.PI / 2;
    desk.position.y = -0.62;
    desk.receiveShadow = true;
    this.scene.add(desk);
  }

  private box(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number, parent: THREE.Object3D = this.scene) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  private glow(color: string, x: number, y: number, z: number, size: number): THREE.Sprite {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    s.position.set(x, y, z);
    s.scale.set(size, size, size);
    this.scene.add(s);
    return s;
  }

  private buildBoard() {
    const silk = canvasTexture(W * S, D * S, drawSilkscreen);
    const edge = new THREE.MeshStandardMaterial({ color: '#7d141b', roughness: 0.6 });
    const top = new THREE.MeshStandardMaterial({ map: silk, roughness: 0.5, metalness: 0.05 });
    const bottom = new THREE.MeshStandardMaterial({ color: '#8a161e', roughness: 0.7 });
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), [edge, edge, top, bottom, edge, edge]);
    pcb.receiveShadow = true;
    pcb.castShadow = true;
    this.scene.add(pcb);
    // standoffs
    const brass = new THREE.MeshStandardMaterial({ color: '#b8a36a', metalness: 0.8, roughness: 0.35 });
    for (const [x, z] of [
      [-6.1, -5.1],
      [6.1, -5.1],
      [-6.1, 5.1],
      [6.1, 5.1],
    ]) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.55, 6), brass);
      st.position.set(x, -0.35, z);
      st.castShadow = true;
      this.scene.add(st);
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.02, 20), new THREE.MeshStandardMaterial({ color: '#c9b27a', metalness: 0.9, roughness: 0.3 }));
      hole.position.set(x, TOP + 0.005, z);
      this.scene.add(hole);
    }

    const black = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.55 });
    const metal = new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 0.9, roughness: 0.28 });
    const white = new THREE.MeshStandardMaterial({ color: '#f1efe8', roughness: 0.6 });

    // FPGA
    const fpgaTop = new THREE.MeshStandardMaterial({
      map: chipTexture([
        { t: 'XILINX', size: 78, weight: '800' },
        { t: 'ARTIX™-7', size: 50 },
        { t: 'XC7A100T', size: 46 },
        { t: 'CSG324ABX1729', size: 30, weight: '500' },
        { t: 'D4487213A  1C', size: 30, weight: '500' },
      ]),
      roughness: 0.45,
    });
    this.box(2.1, 0.22, 2.1, [black, black, fpgaTop, black, black, black], 0.55, TOP, -0.45);
    // decoupling caps around FPGA
    const capMat = new THREE.MeshStandardMaterial({ color: '#b89c6a', roughness: 0.5 });
    const capGeo = new THREE.BoxGeometry(0.12, 0.07, 0.07);
    const caps = new THREE.InstancedMesh(capGeo, capMat, 96);
    const mtx = new THREE.Matrix4();
    let ci = 0;
    for (let k = 0; k < 12; k++) {
      for (const [x, z] of [
        [0.55 - 1.2 + k * 0.2, -1.75],
        [0.55 - 1.2 + k * 0.2, 0.85],
      ]) {
        mtx.makeTranslation(x, TOP + 0.035, z);
        caps.setMatrixAt(ci++, mtx);
      }
      for (const [x, z] of [
        [-0.85, -1.55 + k * 0.2],
        [1.95, -1.55 + k * 0.2],
      ]) {
        mtx.makeRotationY(Math.PI / 2).setPosition(x, TOP + 0.035, z);
        caps.setMatrixAt(ci++, mtx);
      }
    }
    caps.count = ci;
    this.scene.add(caps);

    // DDR2, flash, USB-UART, ethernet PHY, misc chips
    const chip = (w: number, d: number, x: number, z: number, lines: { t: string; size: number }[]) => {
      const t = new THREE.MeshStandardMaterial({ map: chipTexture(lines, 512, Math.round((512 * d) / w)), roughness: 0.5 });
      this.box(w, 0.12, d, [black, black, t, black, black, black], x, TOP, z);
    };
    chip(1.5, 0.85, 3.3, -0.6, [
      { t: 'Micron', size: 70 },
      { t: 'D9LHT  DDR2', size: 44 },
    ]);
    chip(0.8, 0.8, -1.9, 0.2, [
      { t: 'S25FL128S', size: 50 },
      { t: 'QSPI', size: 50 },
    ]);
    chip(0.9, 0.9, -3.2, -3.4, [
      { t: 'FTDI', size: 90 },
      { t: 'FT2232HQ', size: 60 },
    ]);
    chip(0.8, 0.8, 3.1, -2.6, [{ t: 'LAN8720A', size: 70 }]);
    chip(0.5, 0.5, -1.2, 1.2, [{ t: 'ADT7420', size: 60 }]);
    chip(0.5, 0.5, 1.8, 1.4, [{ t: 'ADXL362', size: 60 }]);
    chip(0.9, 0.6, -5.0, -2.8, [{ t: 'ADP5052', size: 70 }]);
    // crystal oscillator 100 MHz
    this.box(0.55, 0.12, 0.35, metal, -0.9, TOP, -1.4);

    // Connectors on the top edge
    // power jack
    this.box(0.8, 0.8, 1.2, black, -5.55, TOP, -4.95);
    // power switch
    this.box(0.5, 0.35, 0.3, black, -4.55, TOP, -5.2);
    this.box(0.14, 0.25, 0.14, white, -4.55, TOP + 0.35, -5.2);
    // micro-USB
    this.box(0.6, 0.22, 0.5, metal, -3.4, TOP, -5.25);
    // VGA DB15
    const vgaBlue = new THREE.MeshStandardMaterial({ color: '#2d56b3', roughness: 0.5 });
    this.box(2.1, 0.3, 0.3, metal, -0.9, TOP, -5.35);
    this.box(1.4, 0.5, 0.9, vgaBlue, -0.9, TOP, -4.85);
    // USB host type-A
    this.box(1.0, 0.55, 1.2, metal, 1.6, TOP, -4.95);
    // RJ45
    this.box(1.3, 1.05, 1.6, metal, 4.2, TOP, -4.75);
    const rjHole = this.box(0.75, 0.55, 0.05, black, 4.2, TOP + 0.2, -5.56);
    rjHole.castShadow = false;
    // audio jack
    this.box(0.6, 0.5, 0.9, black, 2.9, TOP, 0.55);
    // microphone
    const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 20), metal);
    mic.position.set(3.8, TOP + 0.06, 0.6);
    this.scene.add(mic);

    // Pmod headers on the right edge (2x6)
    const gold = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 1, roughness: 0.3 });
    const pinGeo = new THREE.BoxGeometry(0.06, 0.4, 0.06);
    const pins = new THREE.InstancedMesh(pinGeo, gold, 12 * 5);
    let pi = 0;
    const header = (x: number, z: number) => {
      this.box(0.55, 0.3, 1.45, black, x, TOP, z);
      for (let r = 0; r < 2; r++)
        for (let k = 0; k < 6; k++) {
          mtx.makeTranslation(x - 0.12 + r * 0.24, TOP + 0.35, z - 0.6 + k * 0.24);
          pins.setMatrixAt(pi++, mtx);
        }
    };
    for (let i = 0; i < 4; i++) header(6.05, -3.6 + i * 1.25);
    header(-6.05, -1.2);
    pins.count = pi;
    this.scene.add(pins);

    // PROG button + DONE LED
    this.box(0.4, 0.18, 0.4, black, -2.0, TOP, -2.85);
    this.box(0.18, 0.06, 0.18, metal, -2.0, TOP + 0.18, -2.85);
    this.doneMat = new THREE.MeshStandardMaterial({ color: '#dfe7df', emissive: '#22ff55', emissiveIntensity: 0, roughness: 0.3 });
    this.box(0.2, 0.08, 0.12, this.doneMat, -0.75, TOP, -2.9);
    this.doneGlow = this.glow('#33ff66', -0.75, TOP + 0.12, -2.9, 0.9);
    // power LED (always on)
    const pwr = new THREE.MeshStandardMaterial({ color: '#ffd8d8', emissive: '#ff2020', emissiveIntensity: 2 });
    this.box(0.2, 0.08, 0.12, pwr, -4.6, TOP, -4.3);
    const pg = this.glow('#ff3030', -4.6, TOP + 0.12, -4.3, 0.8);
    (pg.material as THREE.SpriteMaterial).opacity = 0.8;

    // Slide switches
    for (let i = 0; i < 16; i++) {
      const x = SW_X(i);
      const housing = this.box(0.34, 0.26, 0.6, black, x, TOP, SW_Z);
      housing.userData.pick = { kind: 'sw', index: i } as Interactive;
      this.pickables.push(housing);
      const slot = this.box(0.12, 0.01, 0.42, new THREE.MeshStandardMaterial({ color: '#050505' }), x, TOP + 0.26, SW_Z);
      slot.castShadow = false;
      const knob = this.box(0.16, 0.2, 0.18, new THREE.MeshStandardMaterial({ color: '#e9e9e9', roughness: 0.4 }), x, TOP + 0.2, SW_Z + 0.12);
      knob.userData.pick = { kind: 'sw', index: i } as Interactive;
      this.pickables.push(knob);
      this.knobs.push(knob);
    }

    // User LEDs
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.MeshStandardMaterial({ color: '#e6ece4', emissive: '#29ff55', emissiveIntensity: 0, roughness: 0.25 });
      this.box(0.22, 0.09, 0.13, mat, SW_X(i), TOP, LED_Z);
      this.ledMats.push(mat);
      this.ledGlows.push(this.glow('#40ff70', SW_X(i), TOP + 0.14, LED_Z, 1.0));
    }
    // RGB LEDs
    for (const [k, x] of [
      [0, 2.0],
      [1, 2.9],
    ]) {
      const mat = new THREE.MeshStandardMaterial({ color: '#f3f3f3', emissive: '#000000', emissiveIntensity: 1, roughness: 0.25 });
      this.box(0.3, 0.12, 0.3, mat, x, TOP, 2.55);
      this.rgbMats[k] = mat;
      this.rgbGlows[k] = this.glow('#ffffff', x, TOP + 0.18, 2.55, 1.4);
    }

    // Seven-segment displays (2 x 4 digits)
    const segBody = new THREE.MeshStandardMaterial({ color: '#1b1b1b', roughness: 0.35 });
    for (const center of [DIGIT_X(5.5), DIGIT_X(1.5)]) this.box(2.45, 0.3, 1.2, segBody, center, TOP, SEG_Z);
    const segH = new THREE.BoxGeometry(0.3, 0.012, 0.07);
    const segV = new THREE.BoxGeometry(0.07, 0.012, 0.3);
    const dpG = new THREE.CylinderGeometry(0.045, 0.045, 0.012, 12);
    const yTop = TOP + 0.3 + 0.006;
    for (let dgt = 0; dgt < 8; dgt++) {
      const cx = DIGIT_X(dgt);
      const cz = SEG_Z - 0.03;
      const mats: THREE.MeshStandardMaterial[] = [];
      // a b c d e f g dp
      const layout: [THREE.BufferGeometry, number, number][] = [
        [segH, 0, -0.36],
        [segV, 0.19, -0.18],
        [segV, 0.19, 0.18],
        [segH, 0, 0.36],
        [segV, -0.19, 0.18],
        [segV, -0.19, -0.18],
        [segH, 0, 0],
        [dpG, 0.3, 0.38],
      ];
      for (const [geo, dx, dz] of layout) {
        const mat = new THREE.MeshStandardMaterial({ color: '#2e2a2a', emissive: '#ff2a1a', emissiveIntensity: 0, roughness: 0.4 });
        const m = new THREE.Mesh(geo, mat);
        // slight italic slant like real displays
        m.position.set(cx + dx - dz * 0.12, yTop, cz + dz);
        this.scene.add(m);
        mats.push(mat);
      }
      this.segMats.push(mats);
    }

    // Push buttons
    const btnBase = black;
    const capGrey = new THREE.MeshStandardMaterial({ color: '#8d9299', roughness: 0.45, metalness: 0.2 });
    const capRed = new THREE.MeshStandardMaterial({ color: '#c8202a', roughness: 0.45 });
    const addBtn = (name: ButtonName, x: number, z: number, mat: THREE.Material) => {
      const base = this.box(0.6, 0.22, 0.6, btnBase, x, TOP, z);
      base.userData.pick = { kind: 'btn', index: 0, name } as Interactive;
      this.pickables.push(base);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.18, 24), mat);
      cap.position.set(x, TOP + 0.22 + 0.09, z);
      cap.castShadow = true;
      cap.userData.pick = { kind: 'btn', index: 0, name } as Interactive;
      this.scene.add(cap);
      this.pickables.push(cap);
      this.btnCaps.set(name, cap);
    };
    addBtn('BTNC', BTN_C.x, BTN_C.z, capGrey);
    addBtn('BTNU', BTN_C.x, BTN_C.z - BTN_OFF, capGrey);
    addBtn('BTND', BTN_C.x, BTN_C.z + BTN_OFF, capGrey);
    addBtn('BTNL', BTN_C.x - BTN_OFF, BTN_C.z, capGrey);
    addBtn('BTNR', BTN_C.x + BTN_OFF, BTN_C.z, capGrey);
    addBtn('CPU_RESETN', 5.2, 1.5, capRed);
  }

  private pick(ev: PointerEvent): Interactive | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
    return hit ? (hit.object.userData.pick as Interactive) : null;
  }

  private bindPointer() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (ev) => {
      const p = this.pick(ev);
      if (!p) return;
      this.controls.enabled = false;
      if (p.kind === 'sw') this.setSwitch(p.index, !this.switches[p.index], true);
      else if (p.name) this.press(p.name, true);
    });
    const release = () => {
      this.controls.enabled = true;
      for (const b of [...this.pressed]) this.press(b, false);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('blur', release);
    el.addEventListener('pointermove', (ev) => {
      el.style.cursor = this.pick(ev) ? 'pointer' : 'grab';
    });
  }

  setSwitch(i: number, on: boolean, notify = false) {
    this.switches[i] = on;
    if (notify) this.onSwitch(i, on);
  }

  press(name: ButtonName, down: boolean) {
    if (down) this.pressed.add(name);
    else this.pressed.delete(name);
    this.onButton(name, down);
  }

  // screen position (CSS px, relative to the canvas) of a switch knob; used by automated UI checks
  switchScreenPos(i: number): { x: number; y: number } {
    const p = this.knobs[i].position.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height };
  }

  isPressed(name: ButtonName) {
    return this.pressed.has(name);
  }

  setOutputs(o: BoardOutputs) {
    for (let i = 0; i < 16; i++) {
      const b = o.led[i] ?? 0;
      this.ledMats[i].emissiveIntensity = b * 3.2;
      (this.ledGlows[i].material as THREE.SpriteMaterial).opacity = Math.min(1, b * 1.1);
    }
    for (let k = 0; k < 2; k++) {
      const [r, g, b] = o.rgb[k] ?? [0, 0, 0];
      this.rgbMats[k].emissive.setRGB(r, g, b);
      this.rgbMats[k].emissiveIntensity = 3;
      const m = this.rgbGlows[k].material as THREE.SpriteMaterial;
      const mx = Math.max(r, g, b);
      m.opacity = Math.min(1, mx * 1.2);
      if (mx > 0) m.color.setRGB(r / mx, g / mx, b / mx);
    }
    for (let dgt = 0; dgt < 8; dgt++) for (let s = 0; s < 8; s++) this.segMats[dgt][s].emissiveIntensity = (o.seg[dgt]?.[s] ?? 0) * 4;
    this.doneMat.emissiveIntensity = o.done ? 3 : 0;
    (this.doneGlow.material as THREE.SpriteMaterial).opacity = o.done ? 0.9 : 0;
  }

  private tick() {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    // animate switch knobs (ON = pushed away from the user)
    for (let i = 0; i < 16; i++) {
      const k = this.knobs[i];
      const target = SW_Z + (this.switches[i] ? -0.12 : 0.12);
      k.position.z += (target - k.position.z) * Math.min(1, dt * 25);
    }
    for (const [name, cap] of this.btnCaps) {
      const target = TOP + 0.22 + 0.09 - (this.pressed.has(name) ? 0.08 : 0);
      cap.position.y += (target - cap.position.y) * Math.min(1, dt * 30);
    }
    this.onFrame(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
