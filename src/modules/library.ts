// The modules that can be attached to the board. The two on-board sensors of the Nexys A7 are always there, on
// fixed pins; the others plug into a Pmod header or are wired to any header pins.
import type { ModuleCtx, ModuleInst, PinIo } from './bus';

type Text = { fa: string; en: string };

export type Control =
  | { kind: 'slider'; key: string; label: Text; min: number; max: number; step: number; unit: string; def: number }
  | { kind: 'button'; key: string; label: string }
  | { kind: 'toggle'; key: string; label: string }
  | { kind: 'leds'; key: string; n: number }
  | { kind: 'readout'; key: string; label: Text };

export interface ModuleDef {
  type: string;
  name: string; // part name, e.g. "ADT7420"
  title: Text;
  desc: Text; // HTML
  color: string;
  roles: { role: string; io: PinIo; label?: string }[];
  // fixed pins of an on-board device (package pins); otherwise the user picks the pins
  onboard?: Record<string, string>;
  // Pmod: plugs into a header, roles take pins 1, 2, 3, 4 (then 7, 8, 9, 10)
  pmod?: boolean;
  timed?: boolean;
  controls: Control[];
  create(ctx: ModuleCtx, values: Record<string, number>): ModuleInst;
}

const us = (ctx: ModuleCtx, x: number) => Math.round((x * ctx.clockHz) / 1e6);

// ---------------------------------------------------------------- I²C slave core
// Byte-level I²C device: calls write(byte, index) for bytes after the address and read(index) for bytes it sends.
function i2cSlave(ctx: ModuleCtx, addr: () => number, dev: { start(): void; write(b: number, i: number): void; read(i: number): number }): ModuleInst {
  let active = false;
  let k = 0; // SCL rising edges in the current byte
  let ack = false; // in the acknowledge bit
  let sh = 0;
  let rw = 0;
  let index = -1; // byte number after the address
  let out = 0;
  let sending = false;
  let nack = false;
  const release = () => ctx.drive('sda', null);
  const put = (bit: number) => ctx.drive('sda', bit ? null : 0);
  return {
    reset() {
      active = false;
      release();
    },
    onChange(role, level) {
      if (role === 'sda') {
        if (ctx.level('scl') !== 1) return;
        // SDA falling while SCL is high: START (or repeated START); rising: STOP
        active = level === 0;
        k = 0;
        ack = false;
        index = -1;
        sending = false;
        sh = 0;
        release();
        return;
      }
      if (!active) return;
      if (level === 1) {
        // rising SCL: sample
        if (ack) {
          if (sending) nack = ctx.level('sda') === 1;
        } else if (k < 8) {
          if (!sending) sh = ((sh << 1) | ctx.level('sda')) & 0xff;
          k++;
        }
        return;
      }
      // falling SCL
      if (!ack) {
        if (k < 8) {
          if (sending && k > 0) put((out >> (7 - k)) & 1);
          return;
        }
        ack = true;
        if (sending) return release(); // the master acknowledges (or not)
        if (index === -1) {
          if (sh >> 1 !== addr()) {
            active = false; // not for us
            return;
          }
          rw = sh & 1;
          dev.start();
        } else dev.write(sh, index);
        ctx.drive('sda', 0); // ACK
        return;
      }
      // end of the acknowledge bit
      ack = false;
      k = 0;
      index++;
      if (rw && !(sending && nack)) {
        sending = true;
        out = dev.read(index) & 0xff;
        put(out & 0x80);
      } else {
        if (sending) active = false;
        sending = false;
        release();
      }
    },
  };
}

// ---------------------------------------------------------------- ADT7420
const ADT7420: ModuleDef = {
  type: 'adt7420',
  name: 'ADT7420',
  title: { fa: 'سنسور دمای ADT7420 (روی برد)', en: 'ADT7420 temperature sensor (on board)' },
  desc: {
    fa: 'سنسور دمای ۱۶ بیتی روی برد، I²C با آدرس <code>0x4B</code>. ثبات 0x00/0x01: دما (۱۳ بیت، هر واحد 1/16 درجه، در بیت‌های 15..3). ثبات 0x0B: شناسه 0xCB.',
    en: 'On-board 16-bit temperature sensor, I²C at address <code>0x4B</code>. Registers 0x00/0x01: temperature (13 bits, 1/16 °C per step, in bits 15..3). Register 0x0B: ID 0xCB.',
  },
  color: '#e0703a',
  roles: [
    { role: 'scl', io: 'od', label: 'TMP_SCL' },
    { role: 'sda', io: 'od', label: 'TMP_SDA' },
  ],
  onboard: { scl: 'C14', sda: 'C15' },
  controls: [{ kind: 'slider', key: 'temp', label: { fa: 'دما', en: 'Temperature' }, min: -20, max: 60, step: 0.25, unit: '°C', def: 24.5 }],
  create(ctx, values) {
    let temp = values.temp ?? 24.5;
    const reg = new Uint8Array(256);
    let ptr = 0;
    const setup = () => {
      reg.fill(0);
      reg[0x03] = 0x00;
      reg[0x04] = 0x20; // T_HIGH 64 °C
      reg[0x06] = 0x05; // T_LOW 10 °C
      reg[0x08] = 0x49; // T_CRIT 147 °C
      reg[0x0a] = 0x05;
      reg[0x0b] = 0xcb;
    };
    setup();
    const tempReg = () => {
      const hi = reg[0x03] & 0x80;
      const code = hi ? Math.round(temp * 128) & 0xffff : (Math.round(temp * 16) << 3) & 0xffff;
      return code;
    };
    const core = i2cSlave(ctx, () => 0x4b, {
      start() {},
      write(b, i) {
        if (i === 0) ptr = b;
        else {
          if (ptr > 0x02 && ptr !== 0x0b) reg[ptr] = b;
          if (ptr === 0x2f) setup(); // software reset
          ptr = (ptr + 1) & 0xff;
        }
      },
      read() {
        const t = tempReg();
        const v = ptr === 0 ? t >> 8 : ptr === 1 ? t & 0xff : ptr === 2 ? 0x00 : reg[ptr];
        ptr = ptr === 1 ? 0 : (ptr + 1) & 0xff; // the temperature pair wraps around
        return v;
      },
    });
    return {
      ...core,
      reset() {
        setup();
        ptr = 0;
        core.reset?.();
      },
      set(key, v) {
        if (key === 'temp') temp = v;
      },
      read(key) {
        return key === 'reg' ? tempReg() : '';
      },
    };
  },
};

// ---------------------------------------------------------------- ADXL362
const ADXL362: ModuleDef = {
  type: 'adxl362',
  name: 'ADXL362',
  title: { fa: 'شتاب‌سنج ADXL362 (روی برد)', en: 'ADXL362 accelerometer (on board)' },
  desc: {
    fa: 'شتاب‌سنج سه‌محوره روی برد، SPI در mode 0. فرمان <code>0x0B</code> خواندن و <code>0x0A</code> نوشتن ثبات است: [فرمان، آدرس، داده…]. ثبات 0x00 = 0xAD (شناسه)، 0x08/0x09/0x0A = X/Y/Z هشت بیتی، 0x0E..0x13 = X/Y/Z دوازده بیتی. برای اندازه‌گیری، در ثبات 0x2D (POWER_CTL) مقدار 0x02 بنویسید.',
    en: 'On-board 3-axis accelerometer, SPI mode 0. Command <code>0x0B</code> reads and <code>0x0A</code> writes registers: [command, address, data…]. Register 0x00 = 0xAD (ID), 0x08/0x09/0x0A = 8-bit X/Y/Z, 0x0E..0x13 = 12-bit X/Y/Z. Write 0x02 to register 0x2D (POWER_CTL) to start measuring.',
  },
  color: '#3a8fe0',
  roles: [
    { role: 'sclk', io: 'out', label: 'ACL_SCLK' },
    { role: 'mosi', io: 'out', label: 'ACL_MOSI' },
    { role: 'miso', io: 'in', label: 'ACL_MISO' },
    { role: 'cs', io: 'out', label: 'ACL_CSN' },
  ],
  onboard: { sclk: 'F15', mosi: 'F14', miso: 'E15', cs: 'D15' },
  controls: [
    { kind: 'slider', key: 'x', label: { fa: 'X', en: 'X' }, min: -2, max: 2, step: 0.01, unit: 'g', def: 0 },
    { kind: 'slider', key: 'y', label: { fa: 'Y', en: 'Y' }, min: -2, max: 2, step: 0.01, unit: 'g', def: 0 },
    { kind: 'slider', key: 'z', label: { fa: 'Z', en: 'Z' }, min: -2, max: 2, step: 0.01, unit: 'g', def: 1 },
  ],
  create(ctx, values) {
    const g = { x: values.x ?? 0, y: values.y ?? 0, z: values.z ?? 1 };
    const reg = new Uint8Array(64);
    const setup = () => {
      reg.fill(0);
      reg[0x00] = 0xad;
      reg[0x01] = 0x1d;
      reg[0x02] = 0xf2;
      reg[0x03] = 0x01;
      reg[0x2c] = 0x13;
    };
    setup();
    let bit = 0;
    let sh = 0;
    let n = 0; // byte number in this transfer
    let cmd = 0;
    let addr = 0;
    let out = 0;
    const measuring = () => (reg[0x2d] & 3) === 2;
    const lsbPerG = () => [1000, 500, 250, 250][(reg[0x2c] >> 6) & 3];
    const axis = (v: number) => Math.max(-2048, Math.min(2047, Math.round(v * lsbPerG())));
    const value = (a: number): number => {
      if (a === 0x0b) return measuring() ? 0x41 : 0x40;
      if (!measuring()) return a < 0x08 || a >= 0x1f ? reg[a] : 0;
      const [x, y, z] = [axis(g.x), axis(g.y), axis(g.z)];
      if (a >= 0x08 && a <= 0x0a) return ([x, y, z][a - 0x08] >> 4) & 0xff;
      if (a >= 0x0e && a <= 0x13) {
        const v = [x, y, z][(a - 0x0e) >> 1] & 0xffff;
        return a & 1 ? (v >> 8) & 0xff : v & 0xff;
      }
      if (a === 0x14 || a === 0x15) {
        const t = Math.round(25 / 0.065) & 0xffff;
        return a === 0x14 ? t & 0xff : (t >> 8) & 0xff;
      }
      return reg[a];
    };
    return {
      reset() {
        setup();
        ctx.drive('miso', null);
      },
      set(key, v) {
        if (key === 'x' || key === 'y' || key === 'z') g[key] = v;
      },
      onChange(role, level) {
        if (role === 'cs') {
          if (level === 0) {
            bit = 0;
            sh = 0;
            n = 0;
            out = 0;
            ctx.drive('miso', 0);
          } else ctx.drive('miso', null);
          return;
        }
        if (ctx.level('cs') !== 0 || role !== 'sclk') return;
        if (level === 1) {
          sh = ((sh << 1) | ctx.level('mosi')) & 0xff;
          if (++bit < 8) return;
          bit = 0;
          if (n === 0) cmd = sh;
          else if (n === 1) addr = sh & 0x3f;
          else if (cmd === 0x0a) {
            if (addr === 0x1f && sh === 0x52) setup();
            else if (addr >= 0x20) reg[addr] = sh;
            addr = (addr + 1) & 0x3f;
          }
          n++;
          if (cmd === 0x0b && n >= 2) {
            out = value(addr);
            addr = (addr + 1) & 0x3f;
          } else out = 0;
        } else ctx.drive('miso', (out >> (7 - bit)) & 1 ? 1 : 0);
      },
    };
  },
};

// ---------------------------------------------------------------- HC-SR04
const HCSR04: ModuleDef = {
  type: 'hcsr04',
  name: 'HC-SR04',
  title: { fa: 'فاصله‌سنج فراصوت HC-SR04', en: 'HC-SR04 ultrasonic distance sensor' },
  desc: {
    fa: 'یک پالس ۱۰ میکروثانیه‌ای روی <b>TRIG</b> بفرستید. کمی بعد <b>ECHO</b> به اندازهٔ زمان رفت و برگشت صدا بالا می‌ماند: هر سانتی‌متر حدود ۵۸ میکروثانیه.',
    en: 'Send a 10 µs pulse on <b>TRIG</b>. Shortly after, <b>ECHO</b> stays high for the sound’s round trip: about 58 µs per centimetre.',
  },
  color: '#4fb0a8',
  roles: [
    { role: 'trig', io: 'out', label: 'TRIG' },
    { role: 'echo', io: 'in', label: 'ECHO' },
  ],
  timed: true,
  controls: [
    { kind: 'slider', key: 'cm', label: { fa: 'فاصله', en: 'Distance' }, min: 2, max: 400, step: 1, unit: 'cm', def: 50 },
    { kind: 'readout', key: 'state', label: { fa: 'آخرین اندازه‌گیری', en: 'Last measurement' } },
  ],
  create(ctx, values) {
    let cm = values.cm ?? 50;
    let rise = -1;
    let busyUntil = -1;
    let pings = 0;
    return {
      reset() {
        rise = -1;
        busyUntil = -1;
        pings = 0;
        ctx.drive('echo', 0);
      },
      set(key, v) {
        if (key === 'cm') cm = v;
      },
      read() {
        return pings ? `${pings} ping(s), echo ${(cm * 58).toFixed(0)} µs` : 'waiting for a TRIG pulse';
      },
      onChange(role, level, t) {
        if (role !== 'trig') return;
        if (level === 1) {
          rise = t;
          return;
        }
        if (rise < 0 || t - rise < us(ctx, 8) || t < busyUntil) return;
        const start = t + us(ctx, 250);
        const len = us(ctx, cm > 400 ? 38000 : cm * 58);
        busyUntil = start + len + us(ctx, 100);
        pings++;
        ctx.at(start, () => ctx.drive('echo', 1));
        ctx.at(start + len, () => ctx.drive('echo', 0));
      },
    };
  },
};

// ---------------------------------------------------------------- simple Pmods
const PMOD_BTN: ModuleDef = {
  type: 'pmod_btn',
  name: 'Pmod BTN',
  title: { fa: 'Pmod BTN: چهار دکمه', en: 'Pmod BTN: four push buttons' },
  desc: { fa: 'چهار دکمهٔ فشاری. فشرده = 1.', en: 'Four push buttons. Pressed = 1.' },
  color: '#c94f4f',
  pmod: true,
  roles: [0, 1, 2, 3].map((i) => ({ role: `btn${i}`, io: 'in' as const, label: `BTN${i}` })),
  controls: [0, 1, 2, 3].map((i) => ({ kind: 'button' as const, key: `btn${i}`, label: `BTN${i}` })),
  create(ctx) {
    const down = [0, 0, 0, 0];
    return {
      reset() {
        down.forEach((v, i) => ctx.drive(`btn${i}`, v as 0 | 1));
      },
      set(key, v) {
        const i = +key.slice(3);
        down[i] = v ? 1 : 0;
        ctx.drive(key, down[i] as 0 | 1);
      },
    };
  },
};

const PMOD_SWT: ModuleDef = {
  type: 'pmod_swt',
  name: 'Pmod SWT',
  title: { fa: 'Pmod SWT: چهار کلید', en: 'Pmod SWT: four slide switches' },
  desc: { fa: 'چهار کلید لغزشی. روشن = 1.', en: 'Four slide switches. On = 1.' },
  color: '#8a6fd1',
  pmod: true,
  roles: [0, 1, 2, 3].map((i) => ({ role: `sw${i}`, io: 'in' as const, label: `SW${i}` })),
  controls: [0, 1, 2, 3].map((i) => ({ kind: 'toggle' as const, key: `sw${i}`, label: `SW${i}` })),
  create(ctx, values) {
    const on = [0, 1, 2, 3].map((i) => (values[`sw${i}`] ? 1 : 0));
    return {
      reset() {
        on.forEach((v, i) => ctx.drive(`sw${i}`, v as 0 | 1));
      },
      set(key, v) {
        const i = +key.slice(2);
        on[i] = v ? 1 : 0;
        ctx.drive(key, on[i] as 0 | 1);
      },
    };
  },
};

// LED brightness: the share of time each line was high since the last read
function dutyMeter(ctx: ModuleCtx, roles: string[]) {
  const high = roles.map(() => 0);
  const since = roles.map(() => 0);
  let from = 0;
  return {
    reset() {
      from = ctx.now();
      high.fill(0);
      roles.forEach((r, i) => (since[i] = ctx.now()));
    },
    change(role: string, level: number, t: number) {
      const i = roles.indexOf(role);
      if (i < 0) return;
      if (level === 0) high[i] += t - since[i];
      since[i] = t;
    },
    read(): number[] {
      const now = ctx.now();
      const span = now - from;
      const out = roles.map((r, i) => {
        const h = high[i] + (ctx.level(r) ? now - since[i] : 0);
        return span > 0 ? Math.min(1, h / span) : ctx.level(r);
      });
      from = now;
      high.fill(0);
      roles.forEach((r, i) => (since[i] = now));
      return out;
    },
  };
}

const PMOD_8LD: ModuleDef = {
  type: 'pmod_8ld',
  name: 'Pmod 8LD',
  title: { fa: 'Pmod 8LD: هشت LED', en: 'Pmod 8LD: eight LEDs' },
  desc: { fa: 'هشت LED روی یک هدر کامل (پایه‌های 1-4 و 7-10). 1 = روشن.', en: 'Eight LEDs on a whole header (pins 1-4 and 7-10). 1 = on.' },
  color: '#d1b33f',
  pmod: true,
  roles: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ role: `ld${i}`, io: 'out' as const, label: `LD${i}` })),
  controls: [{ kind: 'leds', key: 'leds', n: 8 }],
  create(ctx) {
    const m = dutyMeter(
      ctx,
      [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `ld${i}`),
    );
    return { reset: () => m.reset(), onChange: (r, l, t) => m.change(r, l, t), read: () => m.read() };
  },
};

// ---------------------------------------------------------------- rotary encoder
const PMOD_ENC: ModuleDef = {
  type: 'pmod_enc',
  name: 'Pmod ENC',
  title: { fa: 'Pmod ENC: انکودر چرخشی', en: 'Pmod ENC: rotary encoder' },
  desc: {
    fa: 'دو خط A و B یک موج مربعی با ۹۰ درجه اختلاف فاز می‌سازند. در هر پله هر دو یک بار پایین و بالا می‌روند. در چرخش ساعتگرد A زودتر از B پایین می‌آید. BTN دکمهٔ روی محور و SWT یک کلید است.',
    en: 'Lines A and B make two square waves 90° apart. Every detent takes both low and high once. Turning clockwise, A falls before B. BTN is the shaft button and SWT a slide switch.',
  },
  color: '#5a9e4b',
  pmod: true,
  timed: true,
  roles: [
    { role: 'a', io: 'in', label: 'A' },
    { role: 'b', io: 'in', label: 'B' },
    { role: 'btn', io: 'in', label: 'BTN' },
    { role: 'swt', io: 'in', label: 'SWT' },
  ],
  controls: [
    { kind: 'button', key: 'ccw', label: '⟲' },
    { kind: 'button', key: 'cw', label: '⟳' },
    { kind: 'button', key: 'btn', label: 'BTN' },
    { kind: 'toggle', key: 'swt', label: 'SWT' },
    { kind: 'readout', key: 'pos', label: { fa: 'موقعیت', en: 'Position' } },
  ],
  create(ctx, values) {
    let pos = 0;
    let swt = values.swt ? 1 : 0;
    let free = 0; // board cycle when the last turn has finished
    return {
      reset() {
        free = ctx.now();
        ctx.drive('a', 1);
        ctx.drive('b', 1);
        ctx.drive('btn', 0);
        ctx.drive('swt', swt as 0 | 1);
      },
      read: () => String(pos),
      set(key, v) {
        if (key === 'btn') ctx.drive('btn', v ? 1 : 0);
        else if (key === 'swt') {
          swt = v ? 1 : 0;
          ctx.drive('swt', swt as 0 | 1);
        } else if (v) {
          const cw = key === 'cw';
          pos += cw ? 1 : -1;
          // one detent: 11 -> 01 -> 00 -> 10 -> 11 (clockwise, A first); counter-clockwise: B first
          const seq: [number, number][] = cw
            ? [
                [0, 1],
                [0, 0],
                [1, 0],
                [1, 1],
              ]
            : [
                [1, 0],
                [0, 0],
                [0, 1],
                [1, 1],
              ];
          let t = Math.max(ctx.now() + 1, free);
          for (const [a, b] of seq) {
            ctx.at(t, () => {
              ctx.drive('a', a as 0 | 1);
              ctx.drive('b', b as 0 | 1);
            });
            t += us(ctx, 1000);
          }
          free = t;
        }
      },
    };
  },
};

// ---------------------------------------------------------------- servo
const SERVO: ModuleDef = {
  type: 'servo',
  name: 'Servo SG90',
  title: { fa: 'سروو موتور SG90', en: 'SG90 servo motor' },
  desc: {
    fa: 'هر ۲۰ میلی‌ثانیه یک پالس بفرستید. طول پالس زاویه را تعیین می‌کند: ۱ میلی‌ثانیه = ۰ درجه، ۱٫۵ = ۹۰ درجه، ۲ = ۱۸۰ درجه.',
    en: 'Send a pulse every 20 ms. Its length sets the angle: 1 ms = 0°, 1.5 ms = 90°, 2 ms = 180°.',
  },
  color: '#3b6fb5',
  roles: [{ role: 'pwm', io: 'out', label: 'PWM' }],
  controls: [{ kind: 'readout', key: 'angle', label: { fa: 'زاویه', en: 'Angle' } }],
  create(ctx) {
    let rise = -1;
    let width = 0;
    let period = 0;
    let last = -1;
    let lastRise = -1;
    return {
      reset() {
        rise = lastRise = last = -1;
        width = period = 0;
      },
      onChange(_role, level, t) {
        if (level === 1) {
          if (lastRise >= 0) period = t - lastRise;
          lastRise = rise = t;
        } else if (rise >= 0) {
          width = t - rise;
          last = t;
        }
      },
      read(key) {
        const ms = (width / ctx.clockHz) * 1e3;
        if (last < 0 || ctx.now() - last > ctx.clockHz * 0.1) return key === 'deg' ? -1 : 'no pulses';
        const deg = Math.max(0, Math.min(180, (ms - 1) * 180));
        if (key === 'deg') return deg;
        const hz = period ? ctx.clockHz / period : 0;
        return `${deg.toFixed(0)}° (${ms.toFixed(2)} ms${hz ? `, ${hz.toFixed(0)} Hz` : ''})`;
      },
    };
  },
};

export const ONBOARD_MODULES: ModuleDef[] = [ADT7420, ADXL362];
export const MODULES: ModuleDef[] = [ADT7420, ADXL362, HCSR04, PMOD_BTN, PMOD_SWT, PMOD_8LD, PMOD_ENC, SERVO];
export const moduleDef = (type: string) => MODULES.find((m) => m.type === type);
