// Pointer maths for operating the module models' controls in 3D: turning a knob around its centre on screen and
// lifting the sonar's target. Kept free of three.js so it can be unit tested.

// detents per turn of the Pmod ENC knob
export const ENC_DETENTS = 24;
export const DETENT = (2 * Math.PI) / ENC_DETENTS;

// the change from angle a to angle b, wrapped to (-π, π]
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

// angle of the pointer around a knob's centre, in screen pixels (y down): growing angles turn clockwise on screen
export const screenAngle = (cx: number, cy: number, x: number, y: number) => Math.atan2(y - cy, x - cx);

// turns a knob through its detents: add() takes the turned angle (radians, clockwise positive) and returns how many
// whole detents were passed (positive = clockwise); frac is the part of the next detent turned so far
export class Detents {
  private acc = 0;
  constructor(private step = DETENT) {}
  add(rad: number): number {
    this.acc += rad;
    const x = this.acc / this.step;
    const n = Math.trunc(x + Math.sign(x) * 1e-9); // a whole detent, give or take rounding
    this.acc -= n * this.step;
    return n;
  }
  get frac() {
    return this.acc / this.step;
  }
}

// HC-SR04 target: the distance (2..400 cm) on a log scale, as the height of the target above the sensor's card
export const SONAR_MIN = 2;
export const SONAR_MAX = 400;
const H0 = 0.75; // just above the transducers
const H_SPAN = 2.6;

export function sonarHeight(cm: number): number {
  const c = Math.max(SONAR_MIN, Math.min(SONAR_MAX, cm));
  return H0 + (H_SPAN * Math.log(c / SONAR_MIN)) / Math.log(SONAR_MAX / SONAR_MIN);
}

// the inverse, rounded to whole centimetres like the card's slider
export function sonarCm(h: number): number {
  const t = Math.max(0, Math.min(1, (h - H0) / H_SPAN));
  return Math.round(SONAR_MIN * (SONAR_MAX / SONAR_MIN) ** t);
}

// wheel deltas in pixels (lines and pages scaled like the browsers do)
export const wheelPx = (dy: number, mode: number) => dy * (mode === 1 ? 40 : mode === 2 ? 800 : 1);
