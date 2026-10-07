// Exercises with an automatic checker. Each one describes the task (Persian and English) and checks the
// student's design on a virtual board: it drives switches, buttons and pins and reads LEDs, the display and pins.
// Exercises that depend on long delays ask for a parameter (DIV ...) that the checker sets to a small value.
import type { Lang } from '../hdl';
import { decodeI2c, decodeSpi } from '../la/decode';
import { BoardHarness, HEX7 } from './harness';

export interface CheckItem {
  ok: boolean;
  fa: string;
  en: string;
}

class Stop extends Error {}

export class Tester {
  items: CheckItem[] = [];
  // records one check; returns whether it passed
  ok(cond: boolean, fa: string, en: string): boolean {
    this.items.push({ ok: cond, fa, en });
    return cond;
  }
  // a check that the rest depends on: stops at the first failure
  need(cond: boolean, fa: string, en: string) {
    if (!this.ok(cond, fa, en)) throw new Stop();
  }
  static isStop(e: unknown) {
    return e instanceof Stop;
  }
}

export interface Exercise {
  fa: string; // task, HTML
  en: string;
  // parameters / generics the checker overrides (the task asks for them); the design must declare them
  params?: Record<string, number>;
  // the exercise is about the testbench, not the design
  testbench?: { mutate: Record<Lang, [RegExp, string]> };
  check?(h: BoardHarness, t: Tester): void;
}

const hex = (v: number, n = 4) => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(n, '0');
const bits = (v: number) => {
  let n = 0;
  while (v) {
    n += v & 1;
    v >>>= 1;
  }
  return n;
};
const rev16 = (v: number) => {
  let r = 0;
  for (let i = 0; i < 16; i++) if ((v >> i) & 1) r |= 1 << (15 - i);
  return r;
};

// presses a button for `hold` clocks
function press(h: BoardHarness, name: string, hold = 4, after = 4) {
  h.btn(name, 1);
  h.run(hold);
  h.btn(name, 0);
  h.run(after);
}

// reads the display until two scans agree (the value may change while scanning)
function stable(h: BoardHarness, hi: number, lo: number, cycles = 1 << 20): string {
  let a = h.text(hi, lo, cycles);
  for (let i = 0; i < 6; i++) {
    const b = h.text(hi, lo, cycles);
    if (a === b) return a;
    a = b;
  }
  return a;
}

function needDevice(h: BoardHarness, t: Tester, kind: string, fa: string, en: string) {
  t.need(h.has(kind), fa, en);
}

const XDC_SEG = {
  fa: 'سگمنت‌ها و AN به پایه‌ها وصل‌اند (خطوط 7-segment را در فایل XDC از حالت توضیح خارج کنید)',
  en: 'the segments and AN are connected to pins (uncomment the 7-segment lines in the XDC)',
};

export const EXERCISES: Record<string, Exercise> = {
  intro: {
    fa: `<p>ترتیب LEDها را برعکس کنید: SW0 باید LD15 را روشن کند، SW1 باید LD14 را، و همین‌طور تا SW15 که LD0 را روشن می‌کند. راهنمایی: در Verilog از <code>{SW[0], SW[1], ...}</code> یا یک حلقه <code>for</code> استفاده کنید.</p>`,
    en: `<p>Reverse the LED order: SW0 must light LD15, SW1 lights LD14, and so on until SW15 lights LD0. Hint: in Verilog use <code>{SW[0], SW[1], ...}</code> or a <code>for</code> loop.</p>`,
    check(h, t) {
      for (const v of [0x0001, 0x8000, 0x00ff, 0xa5c3]) {
        h.sw(v);
        t.ok(h.led() === rev16(v), `SW=${hex(v)} → LED=${hex(rev16(v))} (شما: ${hex(h.led())})`, `SW=${hex(v)} → LED=${hex(rev16(v))} (yours: ${hex(h.led())})`);
      }
    },
  },
  gates: {
    fa: `<p>یک گیت AND سه‌ورودی اضافه کنید: <b>LD7 = SW0 AND SW1 AND SW2</b>. برای این کار SW را ۳ بیتی و LED را ۸ بیتی کنید. بقیهٔ گیت‌ها (LD0 تا LD6) باید مثل قبل کار کنند.</p>`,
    en: `<p>Add a three-input AND gate: <b>LD7 = SW0 AND SW1 AND SW2</b>. Make SW 3 bits and LED 8 bits wide for it. The other gates (LD0 to LD6) must keep working as before.</p>`,
    check(h, t) {
      let and3 = true;
      let others = true;
      for (let v = 0; v < 8; v++) {
        h.sw(v);
        const [a, b, c] = [v & 1, (v >> 1) & 1, (v >> 2) & 1];
        if (((h.led() >> 7) & 1) !== (a & b & c)) and3 = false;
        const outs = [a & b, a | b, a ^ 1, (a & b) ^ 1, (a | b) ^ 1, a ^ b, a ^ b ^ 1];
        if ((h.led() & 0x7f) !== outs.reduce((r, o, i) => r | (o << i), 0)) others = false;
      }
      t.ok(and3, 'LD7 برای هر ۸ حالت SW2..SW0 برابر AND سه ورودی است', 'LD7 is the 3-input AND for all 8 combinations of SW2..SW0');
      t.ok(others, 'LD0 تا LD6 هنوز همان گیت‌های درس هستند', 'LD0 to LD6 are still the gates of the lesson');
    },
  },
  mux: {
    fa: `<p>یک مالتی‌پلکسر ۸ به ۱ بسازید: ورودی‌های داده <b>SW7..SW0</b>، انتخاب <b>SW15..SW13</b> (SW13 کم‌ارزش‌ترین بیت انتخاب است) و خروجی <b>LD2</b>.</p>`,
    en: `<p>Build an 8-to-1 multiplexer: data inputs <b>SW7..SW0</b>, select <b>SW15..SW13</b> (SW13 is the lowest select bit), output <b>LD2</b>.</p>`,
    check(h, t) {
      let good = true;
      for (const data of [0xa5, 0x5a, 0x01, 0x80])
        for (let sel = 0; sel < 8; sel++) {
          h.sw(data | (sel << 13));
          if (((h.led() >> 2) & 1) !== ((data >> sel) & 1)) good = false;
        }
      t.ok(good, 'LD2 برای هر ۸ مقدار انتخاب، همان بیت SW انتخاب‌شده است', 'LD2 equals the selected switch for all 8 select values');
    },
  },
  adder: {
    fa: `<p>جمع‌کننده را به جمع/تفریق‌کننده تبدیل کنید. A = SW3..SW0 و B = SW7..SW4، و <b>SW8</b> عمل را انتخاب می‌کند: 0 یعنی جمع (LED3..LED0 = A + B و LD4 = رقم نقلی)، 1 یعنی تفریق (LED3..LED0 = A − B که به صورت A + ~B + 1 حساب می‌شود).</p>`,
    en: `<p>Turn the adder into an adder/subtractor. A = SW3..SW0 and B = SW7..SW4, and <b>SW8</b> selects the operation: 0 adds (LED3..LED0 = A + B, LD4 = carry out), 1 subtracts (LED3..LED0 = A − B, computed as A + ~B + 1).</p>`,
    check(h, t) {
      let add = true;
      let sub = true;
      for (const [a, b] of [
        [5, 3],
        [15, 15],
        [9, 8],
        [2, 7],
        [0, 1],
      ]) {
        h.sw(a | (b << 4));
        if ((h.led() & 0x1f) !== a + b) add = false;
        h.sw(a | (b << 4) | 0x100);
        if ((h.led() & 0xf) !== ((a - b) & 0xf)) sub = false;
      }
      t.ok(add, 'SW8=0: جمع و رقم نقلی درست است', 'SW8=0: the sum and carry are right');
      t.ok(sub, 'SW8=1: تفریق درست است (مثلاً 2 − 7 = 0xB)', 'SW8=1: the difference is right (for example 2 − 7 = 0xB)');
    },
  },
  seg7: {
    fa: `<p>هر هشت رقم نمایشگر همان مقدار SW3..SW0 را نشان دهند، و <b>SW15</b> نقطهٔ اعشار (DP) را روشن کند (SW15 = 1 یعنی DP روشن). یادتان باشد AN و DP فعال‌پایین هستند و SW باید ۱۶ بیتی شود.</p>`,
    en: `<p>Make all eight digits show the same value, SW3..SW0, and let <b>SW15</b> light the decimal point (SW15 = 1 → DP on). Remember that AN and DP are active-low and SW must become 16 bits wide.</p>`,
    check(h, t) {
      needDevice(h, t, 'an', XDC_SEG.fa, XDC_SEG.en);
      let digits = true;
      for (const v of [0x0, 0x7, 0xa, 0xf]) {
        h.sw(v);
        if (h.an() !== 0 || h.seg() !== HEX7[v]) digits = false;
      }
      t.ok(digits, 'هر ۸ رقم روشن‌اند و مقدار SW3..SW0 را نشان می‌دهند', 'all 8 digits are on and show SW3..SW0');
      h.sw(0x8003);
      const on = h.dp() === 0;
      h.sw(0x0003);
      const off = h.dp() === 1;
      t.ok(on && off, 'SW15 نقطهٔ اعشار را روشن و خاموش می‌کند', 'SW15 turns the decimal point on and off');
    },
  },
  decoder: {
    fa: `<p>یک دیکودر ۲ به ۴ بسازید که فعال‌سازی رقم‌های نمایشگر را انتخاب کند: <b>SW1..SW0</b> مشخص می‌کند کدام یک از AN3..AN0 روشن باشد (فعال‌پایین، 0 یعنی روشن) و AN7..AN4 خاموش بمانند. AN را به صورت خروجی ۸ بیتی اضافه کنید و خطوط AN را در XDC از حالت توضیح خارج کنید.</p>`,
    en: `<p>Build a 2-to-4 decoder that selects the display digits: <b>SW1..SW0</b> choose which one of AN3..AN0 is on (active-low, 0 = on), and AN7..AN4 stay off. Add AN as an 8-bit output and uncomment the AN lines in the XDC.</p>`,
    check(h, t) {
      needDevice(h, t, 'an', 'AN به پایه‌ها وصل است (خطوط AN را در XDC فعال کنید)', 'AN is connected to pins (uncomment the AN lines in the XDC)');
      let good = true;
      for (let s = 0; s < 4; s++) {
        h.sw(s);
        if (h.an() !== (0xff & ~(1 << s))) good = false;
      }
      t.ok(good, 'برای SW1..SW0 = 0..3 فقط AN مربوطه صفر است', 'for SW1..SW0 = 0..3 only the matching AN is 0');
    },
  },
  shifter: {
    fa: `<p>یک ورودی کنترلی سوم اضافه کنید: <b>SW14 = 0</b> مثل حالا چرخش (rotate) انجام می‌دهد، و <b>SW14 = 1</b> شیفت منطقی انجام می‌دهد و جای خالی را با صفر پر می‌کند. جهت شیفت را مثل قبل SW15 تعیین می‌کند.</p>`,
    en: `<p>Add a third control input: <b>SW14 = 0</b> rotates as it does now, and <b>SW14 = 1</b> does a logical shift that fills the empty bits with zeros. SW15 still chooses the direction.</p>`,
    check(h, t) {
      const a = 0xb1;
      let rot = true;
      let shl = true;
      for (let k = 0; k < 8; k++) {
        for (const left of [0, 1]) {
          const base = a | (k << 8) | (left << 15);
          h.sw(base);
          const r = left ? ((a << k) | (a >> (8 - k))) & 0xff : ((a >> k) | (a << (8 - k))) & 0xff;
          if ((h.led() & 0xff) !== r) rot = false;
          h.sw(base | 0x4000);
          const s = left ? (a << k) & 0xff : a >> k;
          if ((h.led() & 0xff) !== s) shl = false;
        }
      }
      t.ok(rot, 'SW14 = 0: چرخش به چپ و راست درست است', 'SW14 = 0: rotating left and right is right');
      t.ok(shl, 'SW14 = 1: شیفت منطقی با صفر درست است', 'SW14 = 1: the logical shift with zeros is right');
    },
  },
  alu: {
    fa: `<p>نتیجهٔ ALU یعنی r[3:0] را علاوه بر LEDها به صورت یک رقم هگز روی نمایشگر هفت‌قسمتی نشان دهید (فقط رقم ۰، یعنی AN0). از رمزگشای درس ۵ استفاده کنید و خطوط هفت‌قسمتی را در XDC فعال کنید.</p>`,
    en: `<p>Show the ALU result r[3:0] as a hex digit on the seven-segment display (digit 0 only, AN0), in addition to the LEDs. Reuse the decoder from lesson 5 and uncomment the seven-segment lines in the XDC.</p>`,
    check(h, t) {
      needDevice(h, t, 'seg', XDC_SEG.fa, XDC_SEG.en);
      const cases: [number, number, number, number][] = [
        [9, 3, 0, 12],
        [9, 3, 1, 6],
        [9, 3, 2, 1],
        [9, 3, 3, 11],
        [5, 5, 1, 0],
        [6, 1, 5, 9],
      ];
      let good = true;
      for (const [a, b, op, r] of cases) {
        h.sw(a | (b << 4) | (op << 13));
        if ((h.an() & 1) !== 0 || h.seg() !== HEX7[r]) good = false;
      }
      t.ok(good, 'رقم ۰ نتیجهٔ ALU را درست نشان می‌دهد (جمع، تفریق، AND، OR، NOT)', 'digit 0 shows the ALU result (add, subtract, AND, OR, NOT)');
    },
  },
  ff: {
    fa: `<p>دو دکمهٔ شیفت اضافه کنید: تا وقتی <b>BTNU</b> نگه داشته شده، ثبات در هر کلاک یک بیت به چپ شیفت می‌خورد (از LD0 صفر وارد می‌شود)، و تا وقتی <b>BTND</b> نگه داشته شده، یک بیت به راست (از LD15 صفر وارد می‌شود). BTNC مثل قبل کلیدها را بار می‌کند. سؤال: چرا یک فشار دکمه روی برد ثبات را این‌قدر سریع خالی می‌کند؟ (جواب در درس بعد است!)</p>`,
    en: `<p>Add two shift buttons: while <b>BTNU</b> is held, the register shifts one bit left every clock (a 0 enters at LD0), and while <b>BTND</b> is held it shifts one bit right (a 0 enters at LD15). BTNC still loads the switches. Question: why does one press on the board empty the register so quickly? (The answer is in the next lesson!)</p>`,
    check(h, t) {
      h.sw(0x0180);
      press(h, 'BTNC', 1, 1);
      t.need(h.led() === 0x0180, 'BTNC مقدار کلیدها را بار می‌کند', 'BTNC loads the switches');
      h.btn('BTNU', 1);
      h.run(1);
      h.btn('BTNU', 0);
      h.run(1);
      t.ok(h.led() === 0x0300, `یک کلاک BTNU: 0x0180 → 0x0300 (شما: ${hex(h.led())})`, `one clock of BTNU: 0x0180 → 0x0300 (yours: ${hex(h.led())})`);
      h.btn('BTND', 1);
      h.run(3);
      h.btn('BTND', 0);
      h.run(1);
      t.ok(h.led() === 0x0060, `سه کلاک BTND: 0x0300 → 0x0060 (شما: ${hex(h.led())})`, `three clocks of BTND: 0x0300 → 0x0060 (yours: ${hex(h.led())})`);
    },
  },
  counter: {
    fa: `<p>یک چراغ «Knight Rider» روی LD15..LD0 بسازید: همیشه دقیقاً یک LED روشن است و هر <b>DIV</b> کلاک یک خانه جابه‌جا می‌شود و در LD0 و LD15 برمی‌گردد. DIV را به صورت <code>parameter</code> (در VHDL یک <code>generic</code>) با مقدار پیش‌فرض <code>10_000_000</code> (۱۰۰ میلی‌ثانیه) تعریف کنید. بررسی‌کننده آن را کوچک می‌کند تا سریع‌تر تست شود.</p>`,
    en: `<p>Build a “Knight Rider” light on LD15..LD0: exactly one LED is lit, and it moves one position every <b>DIV</b> clocks, bouncing back at LD0 and LD15. Declare DIV as a <code>parameter</code> (a <code>generic</code> in VHDL) with the default <code>10_000_000</code> (100 ms). The checker makes it small so the test runs fast.</p>`,
    params: { DIV: 64 },
    check(h, t) {
      h.run(32);
      const pos: number[] = [];
      let single = true;
      for (let i = 0; i < 40; i++) {
        const l = h.led();
        if (bits(l) !== 1) single = false;
        pos.push(Math.log2(l || 1));
        h.run(64);
      }
      t.need(single, 'همیشه دقیقاً یک LED روشن است', 'exactly one LED is lit at all times');
      let steps = true;
      for (let i = 1; i < pos.length; i++) if (Math.abs(pos[i] - pos[i - 1]) !== 1) steps = false;
      t.ok(steps, 'نور هر DIV کلاک دقیقاً یک خانه جابه‌جا می‌شود', 'the light moves exactly one position every DIV clocks');
      const seen = new Set(pos);
      t.ok(seen.has(0) && seen.has(15) && seen.size === 16, 'نور از LD0 تا LD15 می‌رود و در دو سر برمی‌گردد', 'the light travels from LD0 to LD15 and bounces at both ends');
    },
  },
  testbench: {
    fa: `<p>Testbench را کامل کنید: وسط شبیه‌سازی دوباره ریست بدهید (<code>CPU_RESETN = 0</code> برای چند کلاک) و با <code>$error</code> یا <code>assert</code> بررسی کنید که شمارنده به صفر برگشته است. بررسی‌کننده Testbench شما را دو بار اجرا می‌کند: یک بار با طرح درست که باید بدون خطا تمام شود، و یک بار با طرحی خراب که ریستش کار نمی‌کند. Testbench شما باید این خرابی را پیدا کند و خطا گزارش دهد.</p>`,
    en: `<p>Complete the testbench: in the middle of the run, apply reset again (<code>CPU_RESETN = 0</code> for a few clocks) and check with <code>$error</code> or <code>assert</code> that the counter is back to zero. The checker runs your testbench twice: with the correct design, where it must finish without errors, and with a broken design whose reset does not work. Your testbench must catch that and report an error.</p>`,
    testbench: {
      mutate: {
        verilog: [/count\s*<=\s*0\s*;/, 'count <= count;'],
        vhdl: [/count\s*<=\s*\(others\s*=>\s*'0'\)\s*;/, 'count <= count;'],
      },
    },
  },
  shiftreg: {
    fa: `<p>LFSR را ۱۶ بیتی کنید و روی LED15..LED0 نشان دهید (شیفت رجیستر سریال حذف می‌شود). بیت جدید <b>q15 ⊕ q13 ⊕ q12 ⊕ q10</b> در بیت ۰ وارد می‌شود و بقیهٔ بیت‌ها یک خانه بالا می‌روند. بعد از ریست مقدار <code>0x0001</code> است. سرعت را مثل قبل نگه دارید، اما طول هر قدم را یک <code>parameter</code> به نام <b>DIV</b> با مقدار پیش‌فرض <code>25_000_000</code> کنید. سؤال: این LFSR بعد از چند قدم تکرار می‌شود؟</p>`,
    en: `<p>Make the LFSR 16 bits wide and show it on LED15..LED0 (the serial shift register goes away). The new bit <b>q15 ⊕ q13 ⊕ q12 ⊕ q10</b> enters at bit 0 and the other bits move up by one. After reset the value is <code>0x0001</code>. Keep the speed, but make the length of a step a <code>parameter</code> named <b>DIV</b> with the default <code>25_000_000</code>. Question: after how many steps does this LFSR repeat?</p>`,
    params: { DIV: 40 },
    check(h, t) {
      h.reset(0);
      h.run(3);
      h.reset(1);
      h.run(1);
      t.need(h.led() === 1, 'بعد از ریست LED = 0x0001', 'LED = 0x0001 after reset');
      const vals = [h.led()];
      const times: number[] = [];
      for (let c = 0; c < 40 * 22 && vals.length < 21; c++) {
        h.run(1);
        const l = h.led();
        if (l !== vals[vals.length - 1]) {
          vals.push(l);
          times.push(c);
        }
      }
      let s = 1;
      const want = [1];
      for (let i = 0; i < 20; i++) {
        const fb = ((s >> 15) ^ (s >> 13) ^ (s >> 12) ^ (s >> 10)) & 1;
        s = ((s << 1) | fb) & 0xffff;
        want.push(s);
      }
      t.ok(vals.length === want.length && vals.every((v, i) => v === want[i]), `دنبالهٔ ۲۰ قدم اول درست است (${want.slice(0, 6).map((v) => hex(v)).join(', ')} …)`, `the first 20 steps are right (${want.slice(0, 6).map((v) => hex(v)).join(', ')} …)`);
      const gaps = times.slice(1).map((x, i) => x - times[i]);
      t.ok(gaps.length > 0 && gaps.every((g) => g === 40), 'هر DIV کلاک یک قدم برداشته می‌شود', 'one step every DIV clocks');
    },
  },
  multiplex: {
    fa: `<p>از هر هشت رقم استفاده کنید: رقم‌های ۳ تا ۰ مثل قبل SW را به صورت هگز نشان می‌دهند، و رقم‌های ۷ تا ۴ یک شمارندهٔ ۱۶ بیتی هگز را نشان می‌دهند که هر <b>DIV</b> کلاک یکی زیاد می‌شود. DIV را یک <code>parameter</code> با مقدار پیش‌فرض <code>100_000_000</code> (یک ثانیه) تعریف کنید.</p>`,
    en: `<p>Use all eight digits: digits 3..0 show SW in hex as before, and digits 7..4 show a 16-bit hex counter that counts up once every <b>DIV</b> clocks. Declare DIV as a <code>parameter</code> with the default <code>100_000_000</code> (one second).</p>`,
    params: { DIV: 8_000_000 },
    check(h, t) {
      needDevice(h, t, 'an', XDC_SEG.fa, XDC_SEG.en);
      h.sw(0x3a7f);
      const low = stable(h, 3, 0);
      t.ok(low === '3A7F', `رقم‌های ۳..۰ مقدار SW را نشان می‌دهند: 3A7F (شما: ${low})`, `digits 3..0 show SW: 3A7F (yours: ${low})`);
      const a = stable(h, 7, 4);
      t.need(/^[0-9A-F]{4}$/.test(a), `رقم‌های ۷..۴ یک عدد هگز نشان می‌دهند (شما: "${a}")`, `digits 7..4 show a hex number (yours: "${a}")`);
      h.run(8_000_000);
      const b = stable(h, 7, 4);
      const d = (parseInt(b, 16) - parseInt(a, 16)) & 0xffff;
      t.ok(d === 1 || d === 2, `بعد از DIV کلاک شمارنده یکی زیاد شده است (${a} → ${b})`, `the counter went up by one after DIV clocks (${a} → ${b})`);
    },
  },
  stopwatch: {
    fa: `<p>یک رقم دقیقه روی <b>AN3</b> اضافه کنید تا زمان‌سنج تا <b>9:59.9</b> بشمارد: رقم ده‌ثانیه (AN2) حالا از ۵ به ۰ برمی‌گردد و یکی به دقیقه اضافه می‌کند، و بعد از 9:59.9 همه‌چیز به 0:00.0 برمی‌گردد. تقسیم‌کنندهٔ ۰٫۱ ثانیه را یک <code>parameter</code> به نام <b>DIV</b> با مقدار پیش‌فرض <code>10_000_000</code> کنید.</p>`,
    en: `<p>Add a minutes digit on <b>AN3</b> so the stopwatch counts up to <b>9:59.9</b>: the tens-of-seconds digit (AN2) now wraps from 5 to 0 and carries into the minutes, and after 9:59.9 everything returns to 0:00.0. Make the 0.1 s divider a <code>parameter</code> named <b>DIV</b> with the default <code>10_000_000</code>.</p>`,
    params: { DIV: 16 },
    check(h, t) {
      needDevice(h, t, 'an', XDC_SEG.fa, XDC_SEG.en);
      const read = () => {
        const s = h.text(3, 0, 1 << 20);
        const m = /^([0-9])([0-5])([0-9])([0-9])$/.exec(s);
        return { s, n: m ? ((+m[1] * 6 + +m[2]) * 10 + +m[3]) * 10 + +m[4] : -1 };
      };
      const runFor = (ticks: number) => {
        h.sw(1);
        h.run(ticks * 16);
        h.sw(0);
        h.run(4);
      };
      press(h, 'BTNU');
      runFor(595);
      const a = read();
      t.need(a.n >= 0, `نمایشگر یک زمان معتبر m:ss.t نشان می‌دهد (شما: ${a.s})`, `the display shows a valid time m:ss.t (yours: ${a.s})`);
      t.ok(a.n >= 590 && a.n <= 600, `بعد از ۵۹٫۵ ثانیه حدود 0:59.5 دیده می‌شود (شما: ${a.s})`, `after 59.5 s it shows about 0:59.5 (yours: ${a.s})`);
      runFor(10);
      const b = read();
      t.ok(b.n === a.n + 10, `عبور از ۵۹ ثانیه به ۱ دقیقه درست است (${a.s} → ${b.s})`, `going past 59 s into one minute is right (${a.s} → ${b.s})`);
      runFor(5990 - b.n);
      const c = read();
      runFor(20);
      const d = read();
      t.ok(c.n === 5990 && d.n === 10, `بعد از 9:59.9 به 0:00.0 برمی‌گردد (${c.s} → ${d.s})`, `after 9:59.9 it returns to 0:00.0 (${c.s} → ${d.s})`);
    },
  },
  fsm: {
    fa: `<p>یک «حالت شب» اضافه کنید: تا وقتی <b>SW0</b> روشن است، چراغ زرد چشمک می‌زند (قرمز و سبز با هم روشن، بعد همه خاموش) و هر نیم ثانیه عوض می‌شود. وقتی SW0 خاموش شود، چراغ دوباره چرخهٔ عادی را از قرمز شروع می‌کند. برای این کار SW را به ورودی‌ها اضافه کنید، خطوط SW را در XDC فعال کنید و <code>ONE_SECOND</code> را از <code>localparam</code> به <code>parameter</code> تبدیل کنید.</p>`,
    en: `<p>Add a “night mode”: while <b>SW0</b> is on, the light flashes yellow (red and green on together, then all off), changing every half second. When SW0 goes off, the light starts its normal cycle again from red. Add SW to the inputs, uncomment the SW lines in the XDC and turn <code>ONE_SECOND</code> from a <code>localparam</code> into a <code>parameter</code>.</p>`,
    params: { ONE_SECOND: 1000 },
    check(h, t) {
      needDevice(h, t, 'sw', 'SW به پایه‌ها وصل است (خطوط SW را در XDC فعال کنید)', 'SW is connected to pins (uncomment the SW lines in the XDC)');
      h.sw(1);
      h.run(10);
      let onlyYellow = true;
      let on = 0;
      let off = 0;
      let changes = 0;
      let prev = -1;
      for (let i = 0; i < 80; i++) {
        const [r, g, b] = h.rgb(0);
        const y = r && g && !b ? 1 : !r && !g && !b ? 0 : -1;
        if (y < 0) onlyYellow = false;
        if (y === 1) on++;
        if (y === 0) off++;
        if (prev >= 0 && y !== prev) changes++;
        prev = y;
        h.run(50);
      }
      t.ok(onlyYellow && on > 0 && off > 0, 'با SW0 روشن فقط زرد و خاموش دیده می‌شود', 'with SW0 on only yellow and off are shown');
      t.ok(changes >= 5 && changes <= 11, `هر نیم ثانیه عوض می‌شود (${changes} تغییر در ۴ ثانیه)`, `it changes every half second (${changes} changes in 4 s)`);
      h.sw(0);
      let red = false;
      for (let i = 0; i < 60 && !red; i++) {
        h.run(50);
        const [r, g] = h.rgb(0);
        red = !!r && !g;
      }
      t.ok(red, 'بعد از خاموش شدن SW0 چرخهٔ عادی (قرمز) برمی‌گردد', 'the normal cycle (red) comes back when SW0 goes off');
    },
  },
  debounce: {
    fa: `<p>LED15..LED0 را یک ثبات کنید که با مقدار <code>0x0001</code> شروع می‌شود و با هر فشار <b>BTNU</b> دقیقاً یک بیت به چپ می‌چرخد (بعد از LD15 به LD0 برمی‌گردد). از debouncer همین درس استفاده کنید. BTNU هم لرزش دارد و بدون debouncer یک فشار چند بار ثبات را جابه‌جا می‌کند.</p>`,
    en: `<p>Make LED15..LED0 a register that starts at <code>0x0001</code> and rotates left by exactly one bit on every press of <b>BTNU</b> (after LD15 it wraps to LD0). Use this lesson's debouncer. BTNU bounces too, so without the debouncer one press moves the register several times.</p>`,
    check(h, t) {
      h.run(100);
      t.need(h.led() === 1, `در شروع LED = 0x0001 (شما: ${hex(h.led())})`, `LED = 0x0001 at the start (yours: ${hex(h.led())})`);
      const bouncy = (v: number) => {
        for (let i = 0; i < 9; i++) {
          h.btn('BTNU', i % 2 === 0 ? v : 1 - v);
          h.run(15_000);
        }
        h.btn('BTNU', v);
        h.run(2_500_000);
      };
      const got: number[] = [];
      for (let p = 0; p < 3; p++) {
        bouncy(1);
        bouncy(0);
        got.push(h.led());
      }
      t.ok(got.join() === [2, 4, 8].join(), `هر فشار (با لرزش) دقیقاً یک بیت: 0x0002, 0x0004, 0x0008 (شما: ${got.map((x) => hex(x)).join(', ')})`, `each bouncy press moves exactly one bit: 0x0002, 0x0004, 0x0008 (yours: ${got.map((x) => hex(x)).join(', ')})`);
    },
  },
  bin2bcd: {
    fa: `<p>کنترل‌کننده را طوری تغییر دهید که تبدیل فقط با فشار <b>BTNC</b> شروع شود (با مقدار کلیدها در همان لحظه) و نمایشگر تا فشار بعدی نتیجهٔ قبلی را نگه دارد. <b>LD15</b> هم وقتی مبدل آماده است (<code>ready = 1</code>) روشن باشد. BTNC را به ورودی‌ها اضافه کنید و خطوط دکمه‌ها را در XDC فعال کنید.</p>`,
    en: `<p>Change the controller so a conversion starts only when <b>BTNC</b> is pressed (with the switch value at that moment) and the display keeps the last result until the next press. Also light <b>LD15</b> while the converter is ready (<code>ready = 1</code>). Add BTNC to the inputs and uncomment the button lines in the XDC.</p>`,
    check(h, t) {
      needDevice(h, t, 'btn', 'BTNC به پایه وصل است (خطوط دکمه‌ها را در XDC فعال کنید)', 'BTNC is connected to a pin (uncomment the button lines in the XDC)');
      h.sw(1234);
      h.run(10);
      t.ok(((h.led() >> 15) & 1) === 1, 'LD15 وقتی مبدل بیکار است روشن است', 'LD15 is on while the converter is idle');
      h.btn('BTNC', 1);
      let busy = false;
      for (let i = 0; i < 6; i++) {
        h.run(1);
        if (!((h.led() >> 15) & 1)) busy = true;
      }
      h.btn('BTNC', 0);
      h.run(100);
      t.ok(busy, 'LD15 هنگام تبدیل خاموش می‌شود', 'LD15 goes off during the conversion');
      const a = stable(h, 3, 0, 1 << 20);
      t.ok(a === '1234', `بعد از فشار BTNC نمایشگر 1234 را نشان می‌دهد (شما: ${a})`, `after pressing BTNC the display shows 1234 (yours: ${a})`);
      h.sw(4321);
      h.run(100);
      const b = stable(h, 3, 0, 1 << 20);
      t.ok(b === '1234', `بدون فشار دکمه نتیجه عوض نمی‌شود (شما: ${b})`, `without a press the result does not change (yours: ${b})`);
      press(h, 'BTNC', 4, 100);
      const c = stable(h, 3, 0, 1 << 20);
      t.ok(c === '4321', `فشار بعدی 4321 را تبدیل می‌کند (شما: ${c})`, `the next press converts 4321 (yours: ${c})`);
    },
  },
  ram: {
    fa: `<p>حافظه را به یک ROM تبدیل کنید که متن <b>"HELLO"</b> را نگه می‌دارد (کدهای ASCII: 0x48 0x45 0x4C 0x4C 0x4F) و یک شمارنده حرف‌ها را یکی‌یکی روی LED7..LED0 نشان دهد: هر <b>DIV</b> کلاک یک حرف، و بعد از O دوباره از H. DIV یک <code>parameter</code> با مقدار پیش‌فرض <code>50_000_000</code> است.</p>`,
    en: `<p>Turn the memory into a ROM that holds the text <b>"HELLO"</b> (ASCII codes 0x48 0x45 0x4C 0x4C 0x4F) and use a counter to show the letters one by one on LED7..LED0: one letter every <b>DIV</b> clocks, and after O start again with H. DIV is a <code>parameter</code> with the default <code>50_000_000</code>.</p>`,
    params: { DIV: 32 },
    check(h, t) {
      h.run(16);
      let s = '';
      for (let i = 0; i < 15; i++) {
        const c = h.led() & 0xff;
        s += c >= 32 && c < 127 ? String.fromCharCode(c) : '·';
        h.run(32);
      }
      t.ok('HELLOHELLOHELLOHELLO'.includes(s), `LED7..LED0 حرف‌های HELLO را به ترتیب نشان می‌دهند (دیده‌شده: ${s})`, `LED7..LED0 show H E L L O in order (seen: ${s})`);
    },
  },
  pwm: {
    fa: `<p>LD0 را «نفس‌کشنده» کنید: روشنایی آن آرام از خاموش تا کامل زیاد و بعد دوباره کم شود و این کار تکرار شود. PWM را ۸ بیتی نگه دارید و هر <b>DIV</b> کلاک duty را یک پله بالا یا پایین ببرید. DIV یک <code>parameter</code> با مقدار پیش‌فرض <code>200_000</code> است.</p>`,
    en: `<p>Make LD0 “breathe”: its brightness rises slowly from off to full, falls again, and repeats. Keep the 8-bit PWM and move the duty one step up or down every <b>DIV</b> clocks. DIV is a <code>parameter</code> with the default <code>200_000</code>.</p>`,
    params: { DIV: 256 },
    check(h, t) {
      const W = 4096;
      const duty: number[] = [];
      for (let w = 0; w < 48; w++) {
        let on = 0;
        for (let i = 0; i < W; i += 4) {
          h.run(4);
          on += h.led() & 1;
        }
        duty.push(on / (W / 4));
      }
      const lo = Math.min(...duty);
      const hi = Math.max(...duty);
      t.ok(lo < 0.1 && hi > 0.9, `روشنایی از تقریباً خاموش (${Math.round(lo * 100)}٪) تا تقریباً کامل (${Math.round(hi * 100)}٪) می‌رود`, `brightness goes from nearly off (${Math.round(lo * 100)}%) to nearly full (${Math.round(hi * 100)}%)`);
      let turns = 0;
      let dir = 0;
      let jumps = 0;
      for (let i = 1; i < duty.length; i++) {
        const d = duty[i] - duty[i - 1];
        if (Math.abs(d) > 0.3) jumps++;
        if (Math.abs(d) < 0.01) continue;
        const s = Math.sign(d);
        if (dir && s !== dir) turns++;
        dir = s;
      }
      t.ok(turns >= 1 && turns <= 6 && jumps === 0, 'روشنایی آرام بالا و پایین می‌رود (بدون پرش ناگهانی)', 'brightness rises and falls smoothly (no sudden jumps)');
    },
  },
  uart: {
    fa: `<p>سرعت فرستنده را به <b>9600 baud</b> تغییر دهید. <code>CLKS_PER_BIT</code> حالا چند است؟ بعد baud دیکودر UART را در Logic Analyzer هم 9600 کنید. اگر فقط یکی از دو طرف عوض شود، دیکودر حرف‌های اشتباه یا framing error نشان می‌دهد.</p>`,
    en: `<p>Change the transmitter to <b>9600 baud</b>. What is <code>CLKS_PER_BIT</code> now? Then set the UART decoder in the logic analyzer to 9600 too. If only one side changes, the decoder shows wrong characters or framing errors.</p>`,
    check(h, t) {
      const r = h.uartOut('D4', 14 * 10 * 10417 + 20000, 9600, () => h.btn('BTNC', 1));
      h.btn('BTNC', 0);
      t.ok(r.text === 'Hello FPGA!\r\n' && r.errors === 0, `با 9600 baud پیام "Hello FPGA!" درست دریافت می‌شود (دریافت‌شده: ${JSON.stringify(r.text)})`, `at 9600 baud the message "Hello FPGA!" arrives intact (received: ${JSON.stringify(r.text)})`);
    },
  },
  uart_rx: {
    fa: `<p>طرح را (هم گیرنده و هم فرستنده) روی <b>9600 baud</b> ببرید: <code>CLKS_PER_BIT</code> را برای 9600 درست کنید، سرعت Serial Console را هم 9600 بگذارید، چیزی تایپ کنید و پاسخ را ببینید. قبلش امتحان کنید: اگر کنسول 9600 باشد و طرح 115200، چه چیزی برمی‌گردد و چرا؟</p>`,
    en: `<p>Move the design (receiver and transmitter) to <b>9600 baud</b>: set <code>CLKS_PER_BIT</code> for 9600, set the serial console to 9600 too, type something and look at the echo. Try this first: with the console at 9600 and the design at 115200, what comes back, and why?</p>`,
    check(h, t) {
      h.pin('C4', 1);
      h.run(1000);
      const out = uartEcho(h, 'fpga', 9600);
      t.ok(out.text === 'FPGA' && out.errors === 0, `با 9600 baud، "fpga" به صورت "FPGA" برمی‌گردد (دریافت‌شده: ${JSON.stringify(out.text)})`, `at 9600 baud "fpga" comes back as "FPGA" (received: ${JSON.stringify(out.text)})`);
    },
  },
  spi: {
    fa: `<p>SCLK را به <b>10 MHz</b> برسانید (<code>DIV = 5</code>) و master را به <b>SPI mode 3</b> ببرید: SCLK در حالت بیکار بالا است (CPOL = 1) و داده هنوز روی لبهٔ بالارونده نمونه‌برداری می‌شود (CPHA = 1). برای بررسی، دیکودر SPI را در Logic Analyzer روی mode 3 بگذارید.</p>`,
    en: `<p>Raise SCLK to <b>10 MHz</b> (<code>DIV = 5</code>) and switch the master to <b>SPI mode 3</b>: SCLK idles high (CPOL = 1) and data is still sampled on the rising edge (CPHA = 1). To check it, set the SPI decoder in the logic analyzer to mode 3.</p>`,
    check(h, t) {
      h.run(20);
      h.sw(0x3c);
      const tr = h.capture(['C17', 'D18', 'E18', 'G17'], 400, () => h.btn('BTNC', 1));
      h.btn('BTNC', 0);
      // SCLK idle level while CS is high, and the SCLK period while CS is low
      let idleHigh = true;
      const rises: number[] = [];
      let prevClk = tr.init >> 3 & 1;
      const at = (i: number) => tr.vals[i];
      for (let i = 0; i < tr.times.length; i++) {
        const w = at(i);
        const cs = w & 1;
        const clk = (w >> 3) & 1;
        if (cs && !clk) idleHigh = false;
        if (clk && !prevClk && !cs) rises.push(tr.times[i]);
        prevClk = clk;
      }
      if (!((tr.init & 1) && (tr.init >> 3) & 1)) idleHigh = false;
      t.ok(idleHigh, 'SCLK وقتی CS بالاست، بالا می‌ماند (CPOL = 1)', 'SCLK stays high while CS is high (CPOL = 1)');
      const periods = rises.slice(1).map((x, i) => x - rises[i]);
      t.ok(rises.length === 8 && periods.every((p) => p === 10), `هشت پالس SCLK با دورهٔ ۱۰ کلاک (10 MHz) (دیده‌شده: ${rises.length} پالس، دوره‌ها ${[...new Set(periods)].join('/') || '-'})`, `eight SCLK pulses with a 10-clock period (10 MHz) (seen: ${rises.length} pulses, periods ${[...new Set(periods)].join('/') || '-'})`);
      const anns = decodeSpi(tr, { clk: 3, mosi: 1, miso: 2, cs: 0, mode: 3, bits: 8, msbFirst: true });
      const mosi = anns.filter((a) => a.row === 0).map((a) => a.short);
      const miso = anns.filter((a) => a.row === 1).map((a) => a.short);
      t.ok(mosi[0] === '0x3C', `دیکودر mode 3 روی MOSI مقدار 0x3C را می‌خواند (شما: ${mosi.join(' ') || '-'})`, `the mode 3 decoder reads 0x3C on MOSI (yours: ${mosi.join(' ') || '-'})`);
      t.ok(miso[0] === '0xA5', `پاسخ دستگاه روی MISO هم درست است: 0xA5 (شما: ${miso.join(' ') || '-'})`, `the device's answer on MISO is right too: 0xA5 (yours: ${miso.join(' ') || '-'})`);
    },
  },
  i2c: {
    fa: `<p>یک دستگاه دوم با آدرس <b>0x49</b> به همان دو سیم وصل کنید (یک نمونهٔ دیگر از <code>i2c_device</code> با <code>ADDR = 7'h49</code>، و <code>sda_low</code> آن هم مثل اولی در باس OR شود). حالا با SW14 روشن، master با 0x49 حرف می‌زند و باید ACK بگیرد و داده را دوباره بخواند.</p>`,
    en: `<p>Connect a second device with address <b>0x49</b> to the same two wires (another <code>i2c_device</code> instance with <code>ADDR = 7'h49</code>, its <code>sda_low</code> ORed into the bus like the first one). With SW14 on, the master now talks to 0x49, and it must get an ACK and read the data back.</p>`,
    check(h, t) {
      const run = (sw: number) => {
        const tr = h.capture(['G16', 'H14'], 60_000, () => {
          h.sw(sw);
          h.btn('BTNC', 1);
        });
        h.btn('BTNC', 0);
        h.run(10);
        return decodeI2c(tr, { scl: 0, sda: 1 })
          .map((x) => x.short)
          .join(' ');
      };
      const b = run(0x4000 | 0x33);
      t.ok(b === 'S 0x49 W A 0x01 A 0x33 A P S 0x49 R A 0x33 N P', `SW14 روشن: دستگاه 0x49 پاسخ می‌دهد (${b})`, `SW14 on: device 0x49 answers (${b})`);
      t.ok((h.led() & 0xff) === 0x33 && !(h.led() >> 15), 'داده از 0x49 خوانده شد و NACK نیامد', 'the data was read back from 0x49 without a NACK');
      const a = run(0x5a);
      t.ok(a === 'S 0x48 W A 0x01 A 0x5A A P S 0x48 R A 0x5A N P', `SW14 خاموش: دستگاه 0x48 هنوز کار می‌کند (${a})`, `SW14 off: device 0x48 still works (${a})`);
    },
  },
  sensors: {
    fa: `<p>یک هشدار دما بسازید: وقتی دما <b>30.0 درجه یا بیشتر</b> است، LED رنگی <b>LD16 قرمز</b> شود و وقتی کمتر است <b>سبز</b>. خروجی‌های <code>LED16_R</code>، <code>LED16_G</code> و <code>LED16_B</code> را اضافه کنید و خطوط RGB را در XDC فعال کنید. بازهٔ بین خواندن‌ها <code>DIV</code> است. بررسی‌کننده آن را کوچک می‌کند و دمای سنسور را عوض می‌کند.</p>`,
    en: `<p>Build a temperature alarm: when it is <b>30.0 degrees or more</b>, the RGB LED <b>LD16 turns red</b>, and below that it is <b>green</b>. Add the outputs <code>LED16_R</code>, <code>LED16_G</code> and <code>LED16_B</code> and uncomment the RGB lines in the XDC. The time between readings is <code>DIV</code>; the checker makes it small and changes the sensor's temperature.</p>`,
    params: { DIV: 50_000 },
    check(h, t) {
      needDevice(h, t, 'rgb', 'LD16 به پایه‌ها وصل است (خطوط RGB را در XDC فعال کنید)', 'LD16 is connected to pins (uncomment the RGB LED lines in the XDC)');
      t.need(h.hasPin('C14') && h.hasPin('C15'), 'TMP_SCL و TMP_SDA به سنسور وصل‌اند', 'TMP_SCL and TMP_SDA are connected to the sensor');
      const s = h.attach('adt7420');
      const at = (temp: number) => {
        s.set!('temp', temp);
        h.run(150_000);
        return h.rgb(0).join('');
      };
      const cases: [number, string, string][] = [
        [35, '100', 'قرمز'],
        [24.5, '010', 'سبز'],
        [30, '100', 'قرمز'],
        [29.9375, '010', 'سبز'],
        [-5, '010', 'سبز'],
      ];
      for (const [temp, want, fa] of cases) {
        const got = at(temp);
        t.ok(got === want, `در ${temp} درجه LD16 ${fa} است (R G B = ${got.split('').join(' ')})`, `at ${temp} °C LD16 is ${want === '100' ? 'red' : 'green'} (R G B = ${got.split('').join(' ')})`);
      }
    },
  },
  vga: {
    fa: `<p>یک مربع ۱۰۰×۱۰۰ پیکسلی وسط صفحه روی نوارهای رنگی بکشید: ستون‌های <b>270 تا 369</b> و خط‌های <b>190 تا 289</b>. رنگ مربع را کلیدها تعیین می‌کنند: R = SW15..SW12، G = SW11..SW8 و B = SW7..SW4. بیرون مربع نوارهای رنگی مثل قبل دیده می‌شوند.</p>`,
    en: `<p>Draw a 100×100-pixel square in the middle of the screen, over the colour bars: columns <b>270 to 369</b> and lines <b>190 to 289</b>. The switches set its colour: R = SW15..SW12, G = SW11..SW8 and B = SW7..SW4. Outside the square the colour bars stay as they are.</p>`,
    check(h, t) {
      needDevice(h, t, 'vga', 'VGA به پایه‌ها وصل است (خطوط VGA را در XDC فعال کنید)', 'VGA is connected to pins (uncomment the VGA lines in the XDC)');
      h.sw(0xf80 << 4);
      const m = h.vga(1);
      t.need(!!m && m.state(h.cycles) === 'ok', 'مانیتور سیگنال 640×480 @ 60 Hz می‌گیرد', 'the monitor gets a 640×480 @ 60 Hz signal');
      const px = (x: number, y: number) => m!.pixel(x, y).toString(16).toUpperCase().padStart(3, '0');
      const inside = [px(270, 190), px(369, 190), px(270, 289), px(369, 289), px(320, 240)];
      t.ok(inside.every((c) => c === 'F80'), `داخل مربع رنگ کلیدها (F80) است (شما: ${[...new Set(inside)].join(', ')})`, `inside the square the colour is the switches' (F80) (yours: ${[...new Set(inside)].join(', ')})`);
      const outside = [px(269, 240), px(370, 240), px(320, 189), px(320, 290)];
      const want = ['0F0', 'F0F', 'F0F', 'F0F'];
      t.ok(outside.every((c, i) => c === want[i]), 'بیرون مربع نوارهای رنگی دست نخورده‌اند', 'outside the square the colour bars are untouched');
      h.sw(0x00f << 4);
      const m2 = h.vga(1);
      t.ok(!!m2 && m2.pixel(320, 240) === 0x00f, 'رنگ مربع با کلیدها عوض می‌شود (00F)', 'the square changes colour with the switches (00F)');
    },
  },
  ps2: {
    fa: `<p>یک «ماشین‌حساب» کوچک بسازید: نمایشگر <b>چهار رقم آخری</b> را نشان دهد که با کلیدهای عددی <b>0 تا 9</b> تایپ شده‌اند. هر رقم تازه از راست وارد می‌شود و بقیه یک رقم به چپ می‌روند (بعد از تایپ 1، 2 و 3: <b>0123</b>). <b>Backspace</b> همه را صفر می‌کند. کلیدهای دیگر و کد رها کردن (بعد از F0) نادیده گرفته می‌شوند. کدهای make ارقام: <code>0 = 45</code>، <code>1 = 16</code>، <code>2 = 1E</code>، <code>3 = 26</code>، <code>4 = 25</code>، <code>5 = 2E</code>، <code>6 = 36</code>، <code>7 = 3D</code>، <code>8 = 3E</code>، <code>9 = 46</code> و Backspace = <code>66</code>.</p>`,
    en: `<p>Build a small “calculator” display: it shows the <b>last four digits</b> typed with the number keys <b>0 to 9</b>. Each new digit comes in on the right and the others move one place left (after typing 1, 2 and 3: <b>0123</b>). <b>Backspace</b> clears everything to zero. Other keys and release codes (after F0) are ignored. The digits' make codes: <code>0 = 45</code>, <code>1 = 16</code>, <code>2 = 1E</code>, <code>3 = 26</code>, <code>4 = 25</code>, <code>5 = 2E</code>, <code>6 = 36</code>, <code>7 = 3D</code>, <code>8 = 3E</code>, <code>9 = 46</code> and Backspace = <code>66</code>.</p>`,
    check(h, t) {
      t.need(h.hasPin('F4') && h.hasPin('B2'), 'PS2_CLK و PS2_DATA به صفحه‌کلید وصل‌اند', 'PS2_CLK and PS2_DATA are connected to the keyboard');
      const k = h.attach('ps2kbd');
      h.run(1000);
      const type = (...keys: string[]) => {
        for (const key of keys) {
          k.set!(`k:${key}`, 1);
          h.run(150_000);
          k.set!(`k:${key}`, 0);
          h.run(250_000);
        }
        return h.text(3, 0, 1 << 18);
      };
      const steps: [string[], string, string, string][] = [
        [['1', '2', '3'], '0123', 'بعد از تایپ 1، 2 و 3', 'after typing 1, 2 and 3'],
        [['4', '5'], '2345', 'بعد از 4 و 5', 'after 4 and 5'],
        [['A', 'Space', 'Up'], '2345', 'کلیدهای A، Space و جهت بالا چیزی را عوض نمی‌کنند', 'the A, Space and Up keys change nothing'],
        [['Backspace'], '0000', 'Backspace همه را صفر می‌کند', 'Backspace clears everything'],
        [['9', '0'], '0090', 'بعد از 9 و 0', 'after 9 and 0'],
      ];
      for (const [keys, want, fa, en] of steps) {
        const got = type(...keys);
        if (!t.ok(got === want, `${fa} نمایشگر ${want} است (شما: ${got})`, `${en} the display shows ${want} (yours: ${got})`)) break;
      }
    },
  },
  softcore: {
    fa: `<p>فقط برنامه‌ی ROM را عوض کنید: پردازنده اعداد <b>فیبوناچی</b> ‎1، 2، 3، 5، 8، …، 233 را روی <b>LD7..LD0</b> نشان دهد، در هر تیک (<code>WAIT</code>) یک عدد، و بعد از 233 دوباره از 1 شروع کند. راهنمایی: دو عدد آخر را در RAM نگه دارید؛ 233 آخرین عدد فیبوناچی است که در ۸ بیت جا می‌شود. بررسی‌کننده <code>PERIOD</code> را کوچک می‌کند.</p>`,
    en: `<p>Change only the program in the ROM: the processor shows the <b>Fibonacci</b> numbers 1, 2, 3, 5, 8, …, 233 on <b>LD7..LD0</b>, one number per tick (<code>WAIT</code>), and after 233 it starts again from 1. Hint: keep the last two numbers in RAM; 233 is the last Fibonacci number that fits in 8 bits. The checker makes <code>PERIOD</code> small.</p>`,
    params: { PERIOD: 400 },
    check(h, t) {
      const want = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 1, 2, 3];
      const seen: number[] = [];
      const at: number[] = [];
      let prev = h.led() & 0xff;
      for (let i = 0; i < 4000 && seen.length < want.length; i++) {
        h.run(10);
        const v = h.led() & 0xff;
        if (v !== prev) {
          seen.push(v);
          at.push(h.cycles);
        }
        prev = v;
      }
      const list = (a: number[]) => a.join(', ');
      t.need(seen.length >= 3, 'LD7..LD0 عوض می‌شود', 'LD7..LD0 changes');
      const per = Math.round((at[at.length - 1] - at[0]) / (at.length - 1));
      t.ok(Math.abs(per - 400) <= 20, `در هر تیک یک عدد می‌آید (هر ${per} کلاک یک عدد، تیک = 400 کلاک)`, `one number comes per tick (one every ${per} clocks, tick = 400 clocks)`);
      t.ok(list(seen.slice(0, 12)) === list(want.slice(0, 12)), `دنباله ${list(want.slice(0, 12))} است (شما: ${list(seen.slice(0, 12))})`, `the sequence is ${list(want.slice(0, 12))} (yours: ${list(seen.slice(0, 12))})`);
      t.ok(list(seen.slice(12)) === list(want.slice(12)), `بعد از 233 دوباره از 1 شروع می‌شود (شما: ${list(seen.slice(11))})`, `after 233 it starts again from 1 (yours: ${list(seen.slice(11))})`);
    },
  },
};

// types "text" into UART_TXD_IN (C4) and decodes what comes back on UART_RXD_OUT (D4) at the same time
function uartEcho(h: BoardHarness, text: string, baud: number): { text: string; errors: number } {
  const T = h.board.clockHz / baud;
  const bitsOut: number[] = [];
  const sample = () => bitsOut.push(h.readPin('D4'));
  let acc = 0;
  for (const ch of text) {
    const byte = ch.charCodeAt(0);
    for (const bit of [0, ...Array.from({ length: 8 }, (_, k) => (byte >> k) & 1), 1]) {
      h.pin('C4', bit);
      acc += T;
      const n = Math.round(acc);
      acc -= n;
      for (let i = 0; i < n; i++) {
        h.run(1);
        sample();
      }
    }
  }
  for (let i = 0; i < 12 * T; i++) {
    h.run(1);
    sample();
  }
  // simple 8N1 decoder on the recorded samples
  let out = '';
  let errors = 0;
  for (let i = 1; i < bitsOut.length; i++) {
    if (bitsOut[i - 1] === 1 && bitsOut[i] === 0) {
      const mid = (k: number) => bitsOut[Math.round(i + (k + 0.5) * T)] ?? 1;
      if (mid(0) !== 0) continue;
      let v = 0;
      for (let k = 0; k < 8; k++) v |= mid(k + 1) << k;
      if (mid(9) !== 1) errors++;
      out += String.fromCharCode(v);
      i = Math.round(i + 9.5 * T);
    }
  }
  return { text: out, errors };
}

