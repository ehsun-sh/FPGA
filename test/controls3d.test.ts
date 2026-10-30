// Pointer maths for the 3D module controls: knob angles, detents and the sonar target's height.
import { describe, expect, it } from 'vitest';
import { angleDelta, DETENT, Detents, ENC_DETENTS, screenAngle, sonarCm, sonarHeight, SONAR_MAX, SONAR_MIN, wheelPx } from '../src/boards/nexys-a7/controls';

describe('knob angles', () => {
  it('wraps the change between two angles to (-π, π]', () => {
    expect(angleDelta(0, 0.5)).toBeCloseTo(0.5);
    expect(angleDelta(0.5, 0)).toBeCloseTo(-0.5);
    // across the ±π seam: a small clockwise step, not almost a whole turn back
    expect(angleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
    expect(angleDelta(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(-0.2);
    expect(angleDelta(0, Math.PI)).toBeCloseTo(Math.PI);
  });

  it('measures pointer angles clockwise on screen (y grows downwards)', () => {
    const right = screenAngle(100, 100, 150, 100);
    const below = screenAngle(100, 100, 100, 150);
    expect(angleDelta(right, below)).toBeCloseTo(Math.PI / 2); // right -> bottom is clockwise
  });
});

describe('encoder detents', () => {
  it('counts whole detents each way and keeps the remainder', () => {
    const d = new Detents();
    expect(d.add(DETENT * 0.6)).toBe(0);
    expect(d.frac).toBeCloseTo(0.6);
    expect(d.add(DETENT * 0.6)).toBe(1);
    expect(d.frac).toBeCloseTo(0.2);
    expect(d.add(-DETENT * 2.5)).toBe(-2);
    expect(d.frac).toBeCloseTo(-0.3);
  });

  it('gives one full turn of detents for a turn of the pointer', () => {
    const d = new Detents();
    let n = 0;
    let a = screenAngle(0, 0, 50, 0);
    for (let i = 1; i <= 360; i++) {
      const b = screenAngle(0, 0, 50 * Math.cos((i * Math.PI) / 180), 50 * Math.sin((i * Math.PI) / 180));
      n += d.add(angleDelta(a, b));
      a = b;
    }
    expect(n).toBe(ENC_DETENTS);
  });
});

describe('sonar target', () => {
  it('rises with the distance and maps back to the same centimetres', () => {
    expect(sonarHeight(SONAR_MIN)).toBeLessThan(sonarHeight(50));
    expect(sonarHeight(50)).toBeLessThan(sonarHeight(SONAR_MAX));
    for (const cm of [2, 3, 10, 50, 123, 399, 400]) expect(sonarCm(sonarHeight(cm))).toBe(cm);
  });

  it('clamps to the sensor range', () => {
    expect(sonarCm(-5)).toBe(SONAR_MIN);
    expect(sonarCm(100)).toBe(SONAR_MAX);
    expect(sonarHeight(1000)).toBe(sonarHeight(SONAR_MAX));
  });

  it('scales wheel deltas given in lines or pages', () => {
    expect(wheelPx(100, 0)).toBe(100);
    expect(wheelPx(3, 1)).toBe(120);
    expect(wheelPx(-1, 2)).toBe(-800);
  });
});
