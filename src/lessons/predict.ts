// "Predict first" questions for chapters 1–3: guess what the board will show, run it, then reveal.
// Option order and the answer index are the same in both languages.
export interface Question {
  q: string;
  options: string[];
  answer: number; // 0-based
  why: string;
}

type Pair = { fa: Question[]; en: Question[] };

export const PREDICT: Record<string, Pair> = {
  intro: {
    fa: [
      {
        q: 'اگر فقط SW3 و SW5 بالا باشند، کدام LEDها روشن می‌شوند؟',
        options: ['LD3 و LD5', 'LD0 تا LD5', 'LD10 و LD12', 'هیچ‌کدام، تا BTNC را بزنید'],
        answer: 0,
        why: 'هر کلید مستقیم به LED بالای خودش وصل است؛ مدار ترکیبی است و منتظر دکمه یا کلاک نمی‌ماند.',
      },
    ],
    en: [
      {
        q: 'If only SW3 and SW5 are up, which LEDs light?',
        options: ['LD3 and LD5', 'LD0 to LD5', 'LD10 and LD12', 'None, until you press BTNC'],
        answer: 0,
        why: 'Each switch is wired straight to the LED above it; the circuit is combinational and waits for no button or clock.',
      },
    ],
  },
  gates: {
    fa: [
      {
        q: 'اگر SW0=1 و SW1=0 باشد، کدام LEDها روشن می‌شوند؟',
        options: ['LD1 و LD5', 'LD0 و LD6', 'فقط LD2', 'LD1، LD3 و LD5'],
        answer: 3,
        why: 'OR=1، NAND=1، XOR=1؛ AND و XNOR صفر و NOT A صفر است.',
      },
    ],
    en: [
      {
        q: 'With SW0=1 and SW1=0, which LEDs light?',
        options: ['LD1 and LD5', 'LD0 and LD6', 'Only LD2', 'LD1, LD3 and LD5'],
        answer: 3,
        why: 'OR=1, NAND=1, XOR=1; AND and XNOR are 0, and NOT A is 0.',
      },
    ],
  },
  mux: {
    fa: [
      {
        q: 'SW0=1، SW1=0 و SW15=1 است. LD0 چه می‌کند؟',
        options: ['روشن است', 'خاموش است', 'چشمک می‌زند', 'نیمه‌روشن است'],
        answer: 1,
        why: 'SW15=1 ورودی d1 یعنی SW1 را انتخاب می‌کند که صفر است.',
      },
      {
        q: 'SW5=1، SW4=0 و از SW0 تا SW3 فقط SW2 روشن است. LD1 چه می‌کند؟',
        options: ['خاموش است، چون SW0 خاموش است', 'روشن است', 'روشن است فقط اگر SW15 هم روشن باشد', 'خاموش است، چون دو کلید انتخاب لازم است'],
        answer: 1,
        why: 'انتخاب 10 یعنی ۲، پس LD1 همان SW2 را نشان می‌دهد که روشن است.',
      },
    ],
    en: [
      {
        q: 'SW0=1, SW1=0 and SW15=1. What does LD0 do?',
        options: ['It is on', 'It is off', 'It blinks', 'It glows dimly'],
        answer: 1,
        why: 'SW15=1 selects input d1, which is SW1, and SW1 is 0.',
      },
      {
        q: 'SW5=1, SW4=0, and of SW0 to SW3 only SW2 is on. What does LD1 do?',
        options: ['Off, because SW0 is off', 'On', 'On only if SW15 is on too', 'Off, because both select switches must be on'],
        answer: 1,
        why: 'Select 10 is 2, so LD1 follows SW2, which is on.',
      },
    ],
  },
  adder: {
    fa: [
      {
        q: 'A = 0101 (SW0 و SW2) و B = 0011 (SW4 و SW5) و SW8 خاموش است. LD4..LD0 چه نشان می‌دهند؟',
        options: ['01000', '00110', '00111', '01111'],
        answer: 0,
        why: '5 + 3 = 8 یعنی 01000. عدد 00110 حاصل XOR است و 00111 حاصل OR.',
      },
    ],
    en: [
      {
        q: 'A = 0101 (SW0 and SW2), B = 0011 (SW4 and SW5), SW8 off. What do LD4..LD0 show?',
        options: ['01000', '00110', '00111', '01111'],
        answer: 0,
        why: '5 + 3 = 8, which is 01000. 00110 would be the XOR and 00111 the OR.',
      },
    ],
  },
  seg7: {
    fa: [
      {
        q: 'SW3..SW0 = 1011. رقم سمت راست چه نشان می‌دهد؟',
        options: ['b', '11', '8', 'هیچ، چون فقط ۰ تا ۹ پشتیبانی می‌شود'],
        answer: 0,
        why: '1011 یعنی ۱۱ که در هگز B است؛ روی هفت‌قسمتی به شکل b کوچک نشان داده می‌شود.',
      },
    ],
    en: [
      {
        q: 'SW3..SW0 = 1011. What does the right-most digit show?',
        options: ['b', '11', '8', 'Nothing, only 0 to 9 are supported'],
        answer: 0,
        why: '1011 is 11, which is B in hex; a seven-segment digit draws it as a lower-case b.',
      },
    ],
  },
  decoder: {
    fa: [
      {
        q: 'SW3 خاموش است و SW2..SW0 = 101. کدام یک از LD7..LD0 روشن است؟',
        options: ['LD5', 'هیچ‌کدام', 'LD0 و LD2', 'LD5 چشمک می‌زند'],
        answer: 1,
        why: 'SW3 ورودی فعال‌ساز است؛ وقتی ۰ است همهٔ خروجی‌های دیکودر خاموش‌اند.',
      },
      {
        q: 'از SW15..SW8 فقط SW12 و SW9 روشن‌اند. LD15..LD12 چه نشان می‌دهند؟',
        options: ['1100', '1001', '0100', '1101'],
        answer: 0,
        why: 'SW12 اولویت بالاتری از SW9 دارد، پس کد 100 است و LD15 (valid) هم روشن است: 1100.',
      },
    ],
    en: [
      {
        q: 'SW3 is off and SW2..SW0 = 101. Which of LD7..LD0 is lit?',
        options: ['LD5', 'None', 'LD0 and LD2', 'LD5 blinks'],
        answer: 1,
        why: 'SW3 is the enable; while it is 0 every decoder output is off.',
      },
      {
        q: 'Of SW15..SW8 only SW12 and SW9 are on. What do LD15..LD12 show?',
        options: ['1100', '1001', '0100', '1101'],
        answer: 0,
        why: 'SW12 has a higher priority than SW9, so the code is 100, and LD15 (valid) is on: 1100.',
      },
    ],
  },
  shifter: {
    fa: [
      {
        q: 'فقط SW0 روشن است، SW10..SW8 = 010 و SW15 خاموش (راست). کدام LED از LD7..LD0 روشن است؟',
        options: ['LD2', 'LD6', 'هیچ‌کدام، بیت بیرون می‌افتد', 'LD0'],
        answer: 1,
        why: 'چرخش به راست به اندازهٔ ۲: بیت ۰ از پایین بیرون می‌رود و از بالا در بیت ۶ برمی‌گردد.',
      },
    ],
    en: [
      {
        q: 'Only SW0 is on, SW10..SW8 = 010 and SW15 is off (right). Which of LD7..LD0 is lit?',
        options: ['LD2', 'LD6', 'None, the bit falls off', 'LD0'],
        answer: 1,
        why: 'Rotating right by 2: bit 0 leaves at the bottom and comes back in at bit 6.',
      },
    ],
  },
  alu: {
    fa: [
      {
        q: 'A = 9، B = 3 و op = 001 (SUB). LD4..LD0 چه نشان می‌دهند؟',
        options: ['00110', '01100', '11010', '00011'],
        answer: 0,
        why: '9 − 3 = 6 یعنی 00110؛ قرض لازم نیست، پس بیت ۴ صفر است.',
      },
      {
        q: 'A و B هر دو 5 هستند و op = 001 (SUB). LD15 چه می‌کند؟',
        options: ['خاموش است', 'روشن است', 'چشمک می‌زند', 'فقط با op = 000 روشن می‌شود'],
        answer: 1,
        why: '5 − 5 = 0 و پرچم صفر روی LD15 روشن می‌شود.',
      },
    ],
    en: [
      {
        q: 'A = 9, B = 3 and op = 001 (SUB). What do LD4..LD0 show?',
        options: ['00110', '01100', '11010', '00011'],
        answer: 0,
        why: '9 − 3 = 6, which is 00110; there is no borrow, so bit 4 is 0.',
      },
      {
        q: 'A and B are both 5 and op = 001 (SUB). What does LD15 do?',
        options: ['It is off', 'It is on', 'It blinks', 'It lights only with op = 000'],
        answer: 1,
        why: '5 − 5 = 0, so the zero flag on LD15 lights.',
      },
    ],
  },
  ff: {
    fa: [
      {
        q: 'بعد از Run چند کلید را بالا می‌برید ولی BTNC را نمی‌زنید. LEDها چه می‌کنند؟',
        options: ['همان کلیدها را دنبال می‌کنند', 'خاموش می‌مانند', 'همه روشن می‌شوند', 'چشمک می‌زنند'],
        answer: 1,
        why: 'ثبات فقط وقتی BTNC فشرده است مقدار می‌گیرد؛ بدون آن مقدار قبلی (صفر) می‌ماند.',
      },
    ],
    en: [
      {
        q: 'After Run you raise a few switches but do not press BTNC. What do the LEDs do?',
        options: ['They follow the switches', 'They stay off', 'They all light', 'They blink'],
        answer: 1,
        why: 'The register loads only while BTNC is pressed; without it the old value (zero) stays.',
      },
    ],
  },
  counter: {
    fa: [
      {
        q: 'بعد از Run، LD0 با چه سرعتی عوض می‌شود؟',
        options: ['هر نیم ثانیه (یک چشمک در ثانیه)', 'هر ثانیه یک بار', '۱۰۰ میلیون بار در ثانیه، پس ثابت به نظر می‌رسد', 'هیچ‌وقت'],
        answer: 0,
        why: 'شمارنده هر ۵۰ میلیون کلاک، یعنی هر نیم ثانیه، blink را برعکس می‌کند؛ پس LD0 با ۱ هرتز چشمک می‌زند.',
      },
    ],
    en: [
      {
        q: 'After Run, how often does LD0 change?',
        options: ['Every half second (one blink a second)', 'Once a second', '100 million times a second, so it looks steady', 'Never'],
        answer: 0,
        why: 'The divider toggles blink every 50 million clocks, every half second, so LD0 blinks at 1 Hz.',
      },
    ],
  },
  testbench: {
    fa: [
      {
        q: 'روی برد SW0 را روشن می‌کنید. LEDها با چه سرعتی می‌شمارند؟',
        options: ['هر ۴ کلاک، مثل Testbench', 'هر نیم ثانیه', 'اصلاً نمی‌شمارند، چون DIV فقط در Testbench است', 'هر ثانیه'],
        answer: 1,
        why: 'روی برد مقدار پیش‌فرض DIV یعنی ۵۰ میلیون به کار می‌رود؛ عدد ۴ را فقط Testbench می‌دهد.',
      },
    ],
    en: [
      {
        q: 'On the board you turn SW0 on. How fast do the LEDs count?',
        options: ['Every 4 clocks, as in the testbench', 'Every half second', 'Not at all, DIV exists only in the testbench', 'Once a second'],
        answer: 1,
        why: 'The board uses the default DIV of 50 million; only the testbench sets it to 4.',
      },
    ],
  },
  shiftreg: {
    fa: [
      {
        q: 'SW0 را روشن می‌کنید و دو ثانیه صبر می‌کنید. روی LD15..LD8 چه می‌بینید؟',
        options: ['یک‌ها از LD8 وارد می‌شوند و هر ثانیه چهار خانه جلو می‌روند تا همه روشن شوند', 'فقط LD8 روشن می‌شود', 'یک الگوی تصادفی', 'هیچ تغییری تا BTNC را بزنید'],
        answer: 0,
        why: 'در هر تیک (چهار بار در ثانیه) SW0 از پایین وارد می‌شود و بقیه یک خانه بالا می‌روند.',
      },
    ],
    en: [
      {
        q: 'You turn SW0 on and wait two seconds. What do you see on LD15..LD8?',
        options: ['Ones enter at LD8 and move up four places a second until all are lit', 'Only LD8 lights', 'A random pattern', 'Nothing until you press BTNC'],
        answer: 0,
        why: 'On every tick (four a second) SW0 enters at the bottom and the other bits move up one place.',
      },
    ],
  },
  multiplex: {
    fa: [
      {
        q: 'SW = 0x1234 (SW12، SW9، SW5، SW4 و SW2 روشن). چهار رقم سمت راست چه نشان می‌دهند؟',
        options: ['1234', '4321', '4660', 'فقط 4 روی رقم راست'],
        answer: 0,
        why: 'هر رقم یک نیبل از SW را به صورت هگز نشان می‌دهد؛ چشم هر چهار رقم را با هم می‌بیند.',
      },
    ],
    en: [
      {
        q: 'SW = 0x1234 (SW12, SW9, SW5, SW4 and SW2 on). What do the four right-most digits show?',
        options: ['1234', '4321', '4660', 'Only a 4 on the right digit'],
        answer: 0,
        why: 'Each digit shows one nibble of SW in hex; the eye sees all four at once.',
      },
    ],
  },
  stopwatch: {
    fa: [
      {
        q: 'SW0 را سه ثانیه روشن و بعد خاموش می‌کنید. نمایشگر چه نشان می‌دهد؟',
        options: ['03.0', '00.3', '30.0', 'به شمردن ادامه می‌دهد'],
        answer: 0,
        why: 'هر ۰٫۱ ثانیه رقم دهم یکی جلو می‌رود؛ سه ثانیه ۳۰ تیک است، و با خاموش شدن SW0 زمان ثابت می‌ماند.',
      },
    ],
    en: [
      {
        q: 'You turn SW0 on for three seconds, then off. What does the display show?',
        options: ['03.0', '00.3', '30.0', 'It keeps counting'],
        answer: 0,
        why: 'The tenths digit steps every 0.1 s; three seconds is 30 ticks, and with SW0 off the time holds.',
      },
    ],
  },
};
