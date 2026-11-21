// The EBAZ4205 versions of six Nexys lessons (docs/EBAZ4205-ROADMAP.md, E3.4): the same circuit and the same idea,
// with the board's own clock (FCLK_CLK0, 50 MHz), its five LEDs (LED_R and LED_G on the core board, LED1-LED3 on
// the extension board), the five keys and the USB-C serial port of the extension board. The code is in
// boards/ebaz4205/varcode.ts and the exercises in grade/variants.ts. lessons/boards.ts applies them at start-up.
import * as V from '../boards/ebaz4205/varcode';
import type { Variant } from './boards';
import { figDivider, figFsm, figure } from './figures';
import { part, term, truth } from './helpers';
import type { Question } from './predict';

const q = (text: string, options: string[], answer: number, why: string): Question => ({ q: text, options, answer, why });
// the extension board's keys sit in a cross: KEY3 in the middle (like BTNC), KEY2 and KEY5 above and below it,
// KEY1 and KEY4 to its left and right
const KEYS_FA = `<p class="note">🔘 کلیدهای برد توسعه <b>فعال پایین</b> هستند: هر کلید یک مقاومت pull-up دارد و وقتی فشرده شود پایه را به زمین وصل می‌کند. پس پایه در حالت عادی 1 و هنگام فشار 0 است.</p>`;
const KEYS_EN = `<p class="note">🔘 The extension board's keys are <b>active low</b>: each key has a pull-up resistor and shorts its pin to ground while pressed. So the pin reads 1 normally and 0 while the key is down.</p>`;
const CLOCK_FA = `<p class="note">⏱️ برد EBAZ4205 در بخش PL اسیلاتور ندارد. کلاک <code>clk</code> همان <b>FCLK_CLK0</b> است که بخش PS با فرکانس <b>50MHz</b> می‌سازد؛ نصف کلاک Nexys. پس هر زمانی را باید با 50 میلیون کلاک در ثانیه حساب کنید.</p>`;
const CLOCK_EN = `<p class="note">⏱️ The EBAZ4205 has no oscillator on the PL side. The clock <code>clk</code> is <b>FCLK_CLK0</b>, which the PS makes at <b>50 MHz</b>, half the Nexys clock. So count every time in units of 50 million clocks per second.</p>`;

export const EBAZ_VARIANTS: Record<string, Variant> = {
  // ---------------------------------------------------------------- counter
  counter: {
    summary: 'چشمک‌زن ۱ هرتز و شمارنده‌ی ۴ بیتی روی پنج LED برد EBAZ4205.',
    prereq: ['z-blink', 'x-leds'],
    body: `
<p>کلاک 50MHz برای چشم ما خیلی سریع است. برای ساختن رویدادهای کند، یک <b>شمارنده</b> می‌سازیم که کلاک‌ها را بشمارد و هر وقت به عدد مشخصی رسید یک کار انجام دهد. به این کار <b>تقسیم فرکانس</b> می‌گویند.</p>
${CLOCK_FA}
<pre class="formula">نیم ثانیه = 0.5 s × 50,000,000 Hz = 25,000,000 کلاک</pre>
${figure(figDivider({ title: 'تقسیم‌کننده‌ی کلاک: شمارنده تا N−1 می‌شمارد، tick یک کلاک یک می‌شود و blink در هر tick عوض می‌شود', note: 'اینجا N = 4 است؛ کد این درس N را 25,000,000 می‌گیرد' }), 'شمارنده با هر کلاک یکی زیاد می‌شود و بعد از N−1 به صفر برمی‌گردد. در همان کلاک آخر پالس <code>tick</code> یک می‌شود و <code>blink</code> برعکس می‌شود؛ پس blink با فرکانس clk ÷ 2N چشمک می‌زند.')}
<p>برای شمردن تا ۲۵ میلیون به <b>25 بیت</b> نیاز داریم (2<sup>25</sup> ≈ 33.5 میلیون).</p>
<ul>
  <li><code>div</code>: شمارنده‌ی تقسیم فرکانس؛ هر نیم ثانیه صفر می‌شود.</li>
  <li><code>blink</code>: هر نیم ثانیه برعکس می‌شود ← ${part('LED_R')} با فرکانس ۱ هرتز چشمک می‌زند.</li>
  <li><code>count</code>: شمارنده‌ی ۴ بیتی که هر نیم ثانیه یکی زیاد می‌شود ← بیت ۰ روی ${part('LED_G')} و بیت‌های ۱ تا ۳ روی ${part('LED1')} تا ${part('LED3')}.</li>
  <li>${part('KEY1')} ریست است. مثل دکمه‌ی CPU RESET در Nexys فعال پایین است: تا وقتی فشرده است همه‌چیز صفر می‌ماند.</li>
</ul>
${KEYS_FA}
<p>در شبیه‌سازی‌های Vivado هم معمولاً برای تست سریع، مقدار <code>HALF_SECOND</code> را کوچک می‌کنند. این کار را امتحان کنید!</p>`,
    verilog: V.V_COUNTER_V,
    vhdl: V.V_COUNTER_VHD,
    xdc: { led: true, ext_led: true, key: true },
    tryIt: `<p>Run را بزنید. ${part('LED_R')} روی برد اصلی هر ثانیه یک بار چشمک می‌زند و ${part('LED_G')} با ${part('LED1')} تا ${part('LED3')} شمردن دودویی از ۰ تا ۱۵ را نشان می‌دهند. ${part('KEY1')} را نگه دارید تا شمارنده صفر شود.</p>`,
    takeaways: [
      'نیم ثانیه در ۵۰ مگاهرتز یعنی ۲۵ میلیون کلاک و یک شمارنده‌ی ۲۵ بیتی.',
      'تقسیم کلاک یعنی شمردن کلاک‌ها و کاری انجام دادن وقتی شمارنده به یک مقدار می‌رسد.',
      'برای شبیه‌سازی سریع مقدار تقسیم را کوچک می‌کنیم؛ روی برد مقدار واقعی می‌ماند.',
    ],
    en: {
      summary: 'A 1 Hz blinker and a 4-bit counter on the five LEDs of the EBAZ4205.',
      body: `
<p>A 50 MHz clock is far too fast for our eyes. To make slow events we build a <b>counter</b> that counts clock cycles and does something whenever it reaches a given number. This is called <b>clock division</b>.</p>
${CLOCK_EN}
<pre class="formula">half a second = 0.5 s × 50,000,000 Hz = 25,000,000 clocks</pre>
${figure(figDivider({ title: 'A clock divider: the counter counts to N−1, tick is high for one clock, and blink flips on every tick', note: 'N = 4 here; this lesson’s code uses N = 25,000,000' }), 'The counter goes up by one every clock and returns to zero after N−1. On that last clock the <code>tick</code> pulse is high and <code>blink</code> flips, so blink toggles at clk ÷ 2N.')}
<p>Counting to 25 million needs <b>25 bits</b> (2<sup>25</sup> ≈ 33.5 million).</p>
<ul>
  <li><code>div</code>: the divider counter; it returns to zero every half second.</li>
  <li><code>blink</code>: flips every half second → ${part('LED_R')} blinks at 1 Hz.</li>
  <li><code>count</code>: a 4-bit counter that goes up every half second → bit 0 on ${part('LED_G')} and bits 1 to 3 on ${part('LED1')} to ${part('LED3')}.</li>
  <li>${part('KEY1')} is the reset. Like CPU RESET on the Nexys it is active low: while it is held everything stays at zero.</li>
</ul>
${KEYS_EN}
<p>Vivado simulations usually shrink <code>HALF_SECOND</code> to test quickly. Try it!</p>`,
      tryIt: `<p>Press Run. ${part('LED_R')} on the core board blinks once a second, and ${part('LED_G')} with ${part('LED1')} to ${part('LED3')} count in binary from 0 to 15. Hold ${part('KEY1')} to clear the counter.</p>`,
      takeaways: [
        'Half a second at 50 MHz is 25 million clocks, which needs a 25-bit counter.',
        'Clock division means counting clocks and acting when the counter reaches a value.',
        'Simulations shrink the divider to run fast; the board keeps the real value.',
      ],
    },
  },

  // ---------------------------------------------------------------- fsm
  fsm: {
    summary: 'ماشین حالت Moore با تایمر، روی سه LED برد توسعه.',
    prereq: ['counter', 'x-keys'],
    body: `
<p><b>ماشین حالت متناهی (${term('fsm', 'FSM')})</b> مداری است که در هر لحظه در یکی از چند <b>حالت</b> مشخص قرار دارد و بر اساس ورودی‌ها و زمان به حالت بعدی می‌رود. تقریباً همه‌ی کنترلرها (پروتکل‌ها، منوها، بازی‌ها) با FSM ساخته می‌شوند.</p>
<h3>چراغ راهنمایی</h3>
${figure(figFsm(['RED', 'GREEN', 'YELLOW'], [[0, 1, '2 s'], [1, 2, '2 s یا KEY3'], [2, 0, '1 s']], { title: 'نمودار حالت چراغ راهنمایی', sub: ['LED1', 'LED3', 'LED2'], angle: 210, h: 280 }), 'هر دایره یک حالت است و هر پیکان یک گذار با شرطش. نقطه‌ی سیاه حالت شروع بعد از reset را نشان می‌دهد. خروجی (کدام LED روشن است) فقط به حالت بستگی دارد؛ پس این یک ماشین Moore است.')}
<p>برد EBAZ4205 LED سه‌رنگ ندارد، پس سه LED برد توسعه سه چراغ هستند: ${part('LED1')} قرمز، ${part('LED2')} زرد و ${part('LED3')} سبز (رنگ واقعی LEDها مهم نیست؛ جایشان را در نظر بگیرید).</p>
<ul>
  <li>حالت‌ها با یک نوع شمارشی تعریف می‌شوند: Verilog با <code>localparam</code> و VHDL با <code>type state_t is (...)</code>.</li>
  <li>یک <b>تایمر</b> زمان ماندن در هر حالت را می‌شمارد. یک ثانیه در کلاک 50MHz یعنی <code>ONE_SECOND = 50_000_000</code> کلاک.</li>
  <li>خروجی فقط به حالت بستگی دارد (<b>Moore</b>).</li>
  <li>اگر در حالت GREEN کلید وسط ${part('KEY3')} (دکمه‌ی عابر پیاده) زده شود، زودتر به YELLOW می‌رویم.</li>
  <li>${part('KEY1')} ریست است و چراغ را به RED برمی‌گرداند.</li>
</ul>
${KEYS_FA}`,
    verilog: V.V_FSM_V,
    vhdl: V.V_FSM_VHD,
    xdc: { ext_led: true, key: true },
    tryIt: `<p>Run را بزنید: ${part('LED1')} (قرمز) دو ثانیه، ${part('LED3')} (سبز) دو ثانیه و ${part('LED2')} (زرد) یک ثانیه روشن می‌شوند. وقتی سبز است ${part('KEY3')} را بزنید تا زودتر زرد شود. ${part('KEY1')} چراغ را به قرمز برمی‌گرداند.</p>`,
    objectives: [
      'یک ماشین حالت Moore را با حالت‌های شمارشی و یک تایمر بنویسید.',
      'ثبت حالت و خروجی‌ها را در دو بلوک جدا توصیف کنید.',
      'با یک ورودی (KEY3) مسیر ماشین حالت را عوض کنید.',
    ],
    quiz: [
      q('در ماشین Moore خروجی به چه بستگی دارد؟', ['به حالت و ورودی‌ها', 'فقط به حالت فعلی', 'فقط به ورودی‌ها', 'به کلاک'], 1, 'در ماشین Mealy خروجی به ورودی‌ها هم بستگی دارد؛ در Moore فقط به حالت.'),
      q('در چراغ راهنمایی، اگر KEY3 را در حالت RED بزنید چه می‌شود؟', ['فوراً زرد می‌شود', 'به GREEN می‌رود', 'ریست می‌شود', 'هیچ، فقط در GREEN اثر دارد'], 3, 'شرط KEY3 فقط در شاخه‌ی GREEN بررسی می‌شود.'),
      q('چرا در کد EBAZ4205 به‌جای KEY3 از <code>~KEY3</code> استفاده می‌شود؟', ['تا سریع‌تر شود', 'چون کلید فعال پایین است و هنگام فشار 0 می‌خواند', 'چون Vivado آن را لازم دارد', 'برای حذف لرزش'], 1, 'کلید با pull-up به 3.3 ولت وصل است و فشار دادنش پایه را به زمین می‌برد.'),
    ],
    en: {
      summary: 'A Moore FSM with a timer, on the three LEDs of the extension board.',
      body: `
<p>A <b>finite state machine (${term('fsm', 'FSM')})</b> is a circuit that is always in one of a few defined <b>states</b> and moves to the next one based on its inputs and on time. Almost every controller (protocols, menus, games) is built as an FSM.</p>
<h3>A traffic light</h3>
${figure(figFsm(['RED', 'GREEN', 'YELLOW'], [[0, 1, '2 s'], [1, 2, '2 s or KEY3'], [2, 0, '1 s']], { title: 'State diagram of the traffic light', sub: ['LED1', 'LED3', 'LED2'], angle: 210, h: 280 }), 'Each circle is a state and each arrow a transition with its condition. The black dot marks the state after reset. The output (which LED is on) depends only on the state, so this is a Moore machine.')}
<p>The EBAZ4205 has no RGB LED, so the three LEDs of the extension board are the three lamps: ${part('LED1')} red, ${part('LED2')} yellow and ${part('LED3')} green (their real colour does not matter; think of their places).</p>
<ul>
  <li>The states are an enumerated type: a <code>localparam</code> list in Verilog, <code>type state_t is (...)</code> in VHDL.</li>
  <li>A <b>timer</b> counts how long we stay in each state. One second at 50 MHz is <code>ONE_SECOND = 50_000_000</code> clocks.</li>
  <li>The output depends only on the state (<b>Moore</b>).</li>
  <li>If the middle key ${part('KEY3')} (the pedestrian button) is pressed during GREEN, we go to YELLOW early.</li>
  <li>${part('KEY1')} is the reset and returns the light to RED.</li>
</ul>
${KEYS_EN}`,
      tryIt: `<p>Press Run: ${part('LED1')} (red) is on for two seconds, ${part('LED3')} (green) for two and ${part('LED2')} (yellow) for one. Press ${part('KEY3')} while it is green to turn yellow early. ${part('KEY1')} returns the light to red.</p>`,
      objectives: [
        'Write a Moore state machine with named states and a timer.',
        'Describe the state register and the outputs in two separate blocks.',
        'Change the machine’s path with an input (KEY3).',
      ],
      quiz: [
        q('In a Moore machine, what do the outputs depend on?', ['The state and the inputs', 'Only the current state', 'Only the inputs', 'The clock'], 1, 'In a Mealy machine the outputs also depend on the inputs; in Moore only on the state.'),
        q('In the traffic light, what happens if you press KEY3 during RED?', ['It turns yellow at once', 'It goes to GREEN', 'It resets', 'Nothing, it only matters in GREEN'], 3, 'The KEY3 condition is only tested in the GREEN branch.'),
        q('Why does the EBAZ4205 code use <code>~KEY3</code> rather than KEY3?', ['To make it faster', 'Because the key is active low and reads 0 while pressed', 'Because Vivado needs it', 'To remove bounce'], 1, 'The key has a pull-up to 3.3 V, and pressing it pulls the pin to ground.'),
      ],
    },
  },

  // ---------------------------------------------------------------- debounce
  debounce: {
    prereq: ['fsm', 'x-keys'],
    body: `
<p>کنتاکت فلزی کلید هنگام فشردن و رها شدن چند میلی‌ثانیه <b>می‌لرزد</b> و به‌جای یک تغییر تمیز، ده‌ها بار بین 0 و 1 می‌پرد. مدار ما با کلاک 50MHz هر کدام از این پرش‌ها را می‌بیند؛ یعنی یک فشار چند فشار شمرده می‌شود.</p>
${KEYS_FA}
<h3>ماشین حالت Debounce</h3>
<p>ورودی را فقط وقتی قبول می‌کنیم که <b>۱۰ میلی‌ثانیه ثابت</b> مانده باشد. ورودی ماشین «1 یعنی فشرده» است، پس کلید فعال پایین را اول برعکس می‌کنیم (<code>~KEY3</code>):</p>
${truth(
  ['حالت', 'خروجی db', 'رفتن به حالت بعد'],
  [
    ['ZERO', 0, 'اگر ورودی 1 شد ← WAIT1'],
    ['WAIT1', 0, 'اگر ۱۰ms یک ماند ← ONE؛ اگر 0 شد ← ZERO'],
    ['ONE', 1, 'اگر ورودی 0 شد ← WAIT0'],
    ['WAIT0', 1, 'اگر ۱۰ms صفر ماند ← ZERO؛ اگر 1 شد ← ONE'],
  ],
)}
<pre class="formula">10 ms × 50 MHz = 500,000 کلاک  (شمارنده‌ی ۱۹ بیتی کافی است)</pre>
${figure(figFsm(['ZERO', 'WAIT1', 'ONE', 'WAIT0'], [[0, 0, 'in=0'], [0, 1, 'in=1'], [1, 0, 'in=0'], [1, 2, '10 ms'], [2, 2, 'in=1'], [2, 3, 'in=0'], [3, 2, 'in=1'], [3, 0, '10 ms']], { title: 'نمودار حالت debouncer', sub: ['db=0', 'db=0', 'db=1', 'db=1'] }), 'خروجی db فقط وقتی عوض می‌شود که ورودی ۱۰ میلی‌ثانیه ثابت مانده باشد. هر پرش کوتاه‌تر ماشین را به حالت قبلی برمی‌گرداند.')}
<h3>آشکارساز لبه (Edge Detector)</h3>
<p>برای شمردن فشارها، باید <b>لحظه</b>‌ی فشرده شدن را پیدا کنیم، نه مدت فشرده بودن را. مقدار کلاک قبل را در یک فلیپ‌فلاپ نگه می‌داریم: <code>tick = level &amp; ~prev</code> فقط یک کلاک بعد از هر لبه‌ی بالارونده یک است.</p>
<h3>آزمایش</h3>
<p>دو شمارنده داریم: یکی لبه‌های ورودی <b>خام</b> ${part('KEY3')} را می‌شمارد (دو بیت روی ${part('LED_R')} و ${part('LED_G')}) و دیگری لبه‌های ورودی <b>فیلترشده</b> را (سه بیت روی ${part('LED1')} تا ${part('LED3')}). ${part('KEY2')} هر دو را صفر می‌کند.</p>
<p class="note">💡 کلیدهای شبیه‌ساز به‌طور پیش‌فرض تمیز هستند. گزینه‌ی <b>Bouncy buttons</b> را در بالای برد روشن کنید تا مثل کلید واقعی بلرزند.</p>`,
    verilog: V.V_DEBOUNCE_V,
    vhdl: V.V_DEBOUNCE_VHD,
    xdc: { led: true, ext_led: true, key: true },
    tryIt: `<p>ابتدا <b>Bouncy buttons</b> را در بالای برد روشن کنید. بعد چند بار ${part('KEY3')} (کلید وسط) را بزنید: ${part('LED1')} تا ${part('LED3')} (فیلترشده) دقیقاً تعداد فشارها را می‌شمارند، ولی ${part('LED_R')} و ${part('LED_G')} (خام) در هر فشار چند عدد جلو می‌روند. ${part('KEY2')} هر دو را صفر می‌کند.</p>`,
    objectives: [
      'توضیح دهید چرا لرزش کلید در ۵۰ مگاهرتز چند فشار به نظر می‌رسد.',
      'یک debouncer با ماشین حالت و شمارنده‌ی ۱۰ میلی‌ثانیه بسازید.',
      'با یک آشکارساز لبه برای هر فشار فقط یک پالس بسازید.',
    ],
    en: {
      body: `
<p>A key's metal contact <b>bounces</b> for a few milliseconds when pressed and released: instead of one clean change it jumps between 0 and 1 dozens of times. Our circuit, clocked at 50 MHz, sees every jump, so one press is counted as several.</p>
${KEYS_EN}
<h3>The debounce state machine</h3>
<p>We accept the input only once it has been <b>stable for 10 ms</b>. The machine's input means “1 = pressed”, so the active-low key is inverted first (<code>~KEY3</code>):</p>
${truth(
  ['State', 'Output db', 'Next state'],
  [
    ['ZERO', 0, 'input 1 → WAIT1'],
    ['WAIT1', 0, 'stays 1 for 10 ms → ONE; input 0 → ZERO'],
    ['ONE', 1, 'input 0 → WAIT0'],
    ['WAIT0', 1, 'stays 0 for 10 ms → ZERO; input 1 → ONE'],
  ],
)}
<pre class="formula">10 ms × 50 MHz = 500,000 clocks  (a 19-bit counter is enough)</pre>
${figure(figFsm(['ZERO', 'WAIT1', 'ONE', 'WAIT0'], [[0, 0, 'in=0'], [0, 1, 'in=1'], [1, 0, 'in=0'], [1, 2, '10 ms'], [2, 2, 'in=1'], [2, 3, 'in=0'], [3, 2, 'in=1'], [3, 0, '10 ms']], { title: 'State diagram of the debouncer', sub: ['db=0', 'db=0', 'db=1', 'db=1'] }), 'The output db changes only after the input has stayed the same for 10 ms. Any shorter jump sends the machine back to the previous state.')}
<h3>The edge detector</h3>
<p>To count presses we need the <b>moment</b> a key goes down, not how long it is held. Keep last clock's value in a flip-flop: <code>tick = level &amp; ~prev</code> is high for exactly one clock after each rising edge.</p>
<h3>The experiment</h3>
<p>There are two counters: one counts the edges of the <b>raw</b> ${part('KEY3')} input (two bits on ${part('LED_R')} and ${part('LED_G')}), the other the edges of the <b>debounced</b> input (three bits on ${part('LED1')} to ${part('LED3')}). ${part('KEY2')} clears both.</p>
<p class="note">💡 The simulator's keys are clean by default. Turn on <b>Bouncy buttons</b> above the board to make them bounce like real keys.</p>`,
      tryIt: `<p>First turn on <b>Bouncy buttons</b> above the board. Then press ${part('KEY3')} (the middle key) a few times: ${part('LED1')} to ${part('LED3')} (debounced) count the presses exactly, while ${part('LED_R')} and ${part('LED_G')} (raw) jump several counts per press. ${part('KEY2')} clears both.</p>`,
      objectives: [
        'Explain why key bounce looks like many presses at 50 MHz.',
        'Build a debouncer from a state machine and a 10 ms counter.',
        'Turn every press into a single pulse with an edge detector.',
      ],
    },
  },

  // ---------------------------------------------------------------- pwm
  pwm: {
    summary: 'مدولاسیون پهنای پالس با ماژول پارامتری و سه سطح روشنایی روی LEDهای برد توسعه.',
    prereq: ['counter', 'x-leds'],
    body: `
<p>خروجی دیجیتال فقط 0 یا 1 است؛ پس چطور یک LED را کم‌نور کنیم؟ با <b>PWM</b> (Pulse Width Modulation): خروجی را خیلی سریع روشن و خاموش می‌کنیم و نسبت زمان روشن بودن (<b>${term('duty-cycle', 'Duty Cycle')}</b>) میزان نور را تعیین می‌کند. همین روش برای کنترل سرعت موتور، سروو و صدا هم به کار می‌رود.</p>
<h3>مدار</h3>
<p>یک شمارنده‌ی W بیتی آزاد می‌شمارد و خروجی تا وقتی شمارنده از <code>duty</code> کوچک‌تر است یک است:</p>
<pre class="formula">pwm = (cnt &lt; duty)      Duty = duty / 2^W</pre>
<p>با W=8 و کلاک 50MHz، فرکانس PWM حدود <b>195kHz</b> است (50,000,000 ÷ 256)؛ چشم فقط میانگین را می‌بیند.</p>
<h3>ماژول پارامتری</h3>
<p>عرض شمارنده با <code>parameter</code> در Verilog و <code>generic</code> در VHDL تعیین می‌شود تا ماژول برای دقت‌های مختلف قابل استفاده باشد. این طرح سه نمونه از همان ماژول دارد:</p>
<ul>
  <li>${part('LED1')}: duty = 16 (حدود ۶٪)</li>
  <li>${part('LED2')}: duty = 64 (۲۵٪)</li>
  <li>${part('LED3')}: duty = 255 (تقریباً ۱۰۰٪)</li>
</ul>
<p>برد EBAZ4205 کلید کشویی ندارد، پس یک سطح قابل تنظیم هم با کلیدها ساخته‌ایم: تا وقتی ${part('KEY3')} نگه داشته شود هر سه LED همین سطح را نشان می‌دهند، و ${part('KEY4')} و ${part('KEY2')} (نگه دارید) آن را آرام بالا و پایین می‌برند.</p>
${KEYS_FA}`,
    verilog: V.V_PWM_V,
    vhdl: V.V_PWM_VHD,
    xdc: { ext_led: true, key: true },
    la: {
      chans: [
        { name: 'LED1', probe: 'pin:E19' },
        { name: 'LED2', probe: 'pin:K17' },
        { name: 'LED3', probe: 'pin:H18' },
      ],
      decs: [],
      base: 2e-6,
      pos: 4,
      trig: { ch: 1, edge: 'rise' },
    },
    tryIt: `<p>Run را بزنید: ${part('LED1')} کم‌نور، ${part('LED2')} متوسط و ${part('LED3')} پرنور است. ${part('KEY3')} را نگه دارید و با ${part('KEY4')} و ${part('KEY2')} روشنایی هر سه را تغییر دهید. در Logic Analyzer پهنای پالس‌های سه خط را ببینید و با دو نشانگر duty را اندازه بگیرید.</p>`,
    en: {
      summary: 'Pulse-width modulation with a parameterised module, three brightness levels on the extension board’s LEDs.',
      body: `
<p>A digital output is only 0 or 1, so how do we dim an LED? With <b>PWM</b> (pulse-width modulation): switch the output on and off very fast, and the fraction of time it is on (the <b>${term('duty-cycle', 'duty cycle')}</b>) sets the brightness. The same method drives motors, servos and sound.</p>
<h3>The circuit</h3>
<p>A free-running W-bit counter counts, and the output is 1 while the counter is below <code>duty</code>:</p>
<pre class="formula">pwm = (cnt &lt; duty)      duty cycle = duty / 2^W</pre>
<p>With W=8 and a 50 MHz clock the PWM frequency is about <b>195 kHz</b> (50,000,000 ÷ 256); the eye only sees the average.</p>
<h3>A parameterised module</h3>
<p>The counter width is a <code>parameter</code> in Verilog and a <code>generic</code> in VHDL, so the module can be reused at different resolutions. This design has three instances of it:</p>
<ul>
  <li>${part('LED1')}: duty = 16 (about 6%)</li>
  <li>${part('LED2')}: duty = 64 (25%)</li>
  <li>${part('LED3')}: duty = 255 (nearly 100%)</li>
</ul>
<p>The EBAZ4205 has no slide switches, so the keys make an adjustable level too: while ${part('KEY3')} is held all three LEDs show that level, and holding ${part('KEY4')} or ${part('KEY2')} moves it slowly up or down.</p>
${KEYS_EN}`,
      tryIt: `<p>Press Run: ${part('LED1')} is dim, ${part('LED2')} medium and ${part('LED3')} bright. Hold ${part('KEY3')} and change the brightness of all three with ${part('KEY4')} and ${part('KEY2')}. In the logic analyzer, look at the pulse widths of the three lines and measure the duty with two cursors.</p>`,
    },
  },

  // ---------------------------------------------------------------- uart
  uart: {
    prereq: ['fsm', 'x-uart'],
    body: `
<p><b>UART</b> ساده‌ترین پروتکل سریال است. برد توسعه یک تراشه‌ی <b>CH340C</b> دارد که درگاه USB-C را به یک درگاه سریال تبدیل می‌کند. پایه‌ی ${part('USB_C', 'UART_TX')} (پایه‌ی H17) از FPGA به این تراشه می‌رود و از آنجا به کامپیوتر.</p>
<h3>قاب (Frame) در حالت 8N1</h3>
<ul>
  <li>خط در حالت بیکار <b>1</b> است.</li>
  <li><b>بیت شروع</b>: یک بیت 0</li>
  <li><b>۸ بیت داده</b>، اول کم‌ارزش‌ترین بیت (LSB first)</li>
  <li>بدون بیت توازن (N)، و یک <b>بیت پایان</b> 1</li>
</ul>
<h3>زمان هر بیت</h3>
<pre class="formula">CLKS_PER_BIT = 50,000,000 / 115,200 ≈ 434 کلاک</pre>
<p>ماژول <code>uart_tx</code> همان فرستنده‌ی درس Nexys است؛ فقط مقدار پیش‌فرض <code>CLKS_PER_BIT</code> برای کلاک 50MHz نصف شده است. یک ماشین حالت چهار حالته (IDLE، START، DATA، STOP) هر بیت را 434 کلاک روی خط نگه می‌دارد.</p>
<h3>پیام</h3>
<p>یک ROM کوچک حرف‌های <code>"Hello FPGA!\\r\\n"</code> را نگه می‌دارد. با فشار ${part('KEY3')} (کلید وسط) ماشین حالت بالایی حرف‌ها را یکی‌یکی به فرستنده می‌دهد و صبر می‌کند تا <code>busy</code> صفر شود. ${part('LED1')} وقتی فرستنده مشغول است روشن است.</p>
${KEYS_FA}`,
    verilog: V.V_UART_V,
    vhdl: V.V_UART_VHD,
    xdc: { ext_led: true, ext_uart: true, key: true },
    la: {
      chans: [
        { name: 'TX', probe: 'pin:H17' },
        { name: 'busy', probe: 'pin:E19' },
      ],
      decs: [{ type: 'uart', name: 'UART', ch: 0, baud: 115200, bits: 8, parity: 'none', stop: 1 }],
      base: 2e-4,
      pos: 4,
      trig: { ch: 0, edge: 'fall' },
    },
    tryIt: `<p>طرح را اجرا کنید و Logic Analyzer را باز کنید (دکمه‌ی <span class="kbd">⎍ Logic Analyzer</span> یا Ctrl+L). در پنجره‌ی آن <b>Run</b> را بزنید و بعد ${part('KEY3')} را روی برد توسعه فشار دهید. شکل موج خط TX و بایت‌های دیکودشده‌ی <b>H e l l o …</b> را می‌بینید. <b>Serial Console</b> را هم باز کنید: پیام آنجا چاپ می‌شود. طول یک بیت را با دو نشانگر اندازه بگیرید (حدود 8.68µs).</p>`,
    en: {
      body: `
<p><b>UART</b> is the simplest serial protocol. The extension board has a <b>CH340C</b> chip that turns its USB-C port into a serial port. The pin ${part('USB_C', 'UART_TX')} (pin H17) goes from the FPGA to that chip and on to the PC.</p>
<h3>The 8N1 frame</h3>
<ul>
  <li>The line idles at <b>1</b>.</li>
  <li><b>Start bit</b>: one 0 bit</li>
  <li><b>8 data bits</b>, least significant bit first</li>
  <li>No parity bit (N), and one <b>stop bit</b> of 1</li>
</ul>
<h3>The time of one bit</h3>
<pre class="formula">CLKS_PER_BIT = 50,000,000 / 115,200 ≈ 434 clocks</pre>
<p>The <code>uart_tx</code> module is the transmitter of the Nexys lesson; only the default <code>CLKS_PER_BIT</code> is halved for the 50 MHz clock. A four-state machine (IDLE, START, DATA, STOP) holds each bit on the line for 434 clocks.</p>
<h3>The message</h3>
<p>A small ROM holds the characters <code>"Hello FPGA!\\r\\n"</code>. When ${part('KEY3')} (the middle key) is pressed, the upper state machine hands them to the transmitter one by one and waits for <code>busy</code> to drop. ${part('LED1')} is on while the transmitter is busy.</p>
${KEYS_EN}`,
      tryIt: `<p>Run the design and open the logic analyzer (the <span class="kbd">⎍ Logic Analyzer</span> button or Ctrl+L). Press <b>Run</b> in its window, then press ${part('KEY3')} on the extension board. You see the TX waveform and the decoded bytes <b>H e l l o …</b>. Open the <b>Serial Console</b> too: the message is printed there. Measure one bit with two cursors (about 8.68 µs).</p>`,
    },
  },

  // ---------------------------------------------------------------- uart_rx
  uart_rx: {
    prereq: ['uart'],
    body: `
<p>حالا جهت مخالف: کامپیوتر می‌فرستد و FPGA دریافت می‌کند. حرف‌هایی که در <b>کنسول سریال</b> تایپ می‌کنید از تراشه‌ی CH340C روی پایه‌ی <code>UART_RX</code> (پایه‌ی H16) به FPGA می‌رسند.</p>
<h3>گیرنده</h3>
<ul>
  <li>ورودی با کلاک ما همگام نیست، پس اول از دو فلیپ‌فلاپ (<b>synchronizer</b>) می‌گذرد.</li>
  <li>گیرنده منتظر لبه‌ی پایین‌رونده‌ی بیت شروع می‌ماند و بعد <b>نیم بیت</b> (217 کلاک) صبر می‌کند تا به وسط بیت برسد. اگر خط هنوز 0 باشد، یک قاب واقعی شروع شده است.</li>
  <li>از آنجا هر 434 کلاک یک نمونه برمی‌دارد: همیشه وسط بیت، دورترین نقطه از لبه‌ها.</li>
  <li>بعد از بیت پایان، بایت را روی <code>data</code> می‌گذارد و <code>done</code> را یک کلاک یک می‌کند.</li>
</ul>
<pre class="formula">CLKS_PER_BIT = 50,000,000 / 115,200 ≈ 434      HALF = 217</pre>
<h3>اکو با حروف بزرگ</h3>
<p>حروف کوچک (0x61 تا 0x7A) با کم کردن 0x20 بزرگ می‌شوند و از همان فرستنده‌ی درس قبل برمی‌گردند. اگر بایت بعدی برسد وقتی فرستنده هنوز مشغول است، یک ثبات (<code>hold</code>) آن را نگه می‌دارد. ${part('LED1')} تا ${part('LED3')} سه بیت پایین آخرین بایت دریافتی را نشان می‌دهند.</p>`,
    verilog: V.V_UART_RX_V,
    vhdl: V.V_UART_RX_VHD,
    xdc: { ext_led: true, ext_uart: true },
    la: {
      chans: [
        { name: 'RX in', probe: 'pin:H16' },
        { name: 'TX out', probe: 'pin:H17' },
      ],
      decs: [
        { type: 'uart', name: 'PC→FPGA', ch: 0, baud: 115200, bits: 8, parity: 'none', stop: 1 },
        { type: 'uart', name: 'FPGA→PC', ch: 1, baud: 115200, bits: 8, parity: 'none', stop: 1 },
      ],
      base: 5e-5,
      pos: 4,
      trig: { ch: 0, edge: 'fall' },
    },
    tryIt: `<p>طرح را اجرا کنید و <b>کنسول سریال</b> را باز کنید (دکمه‌ی <span class="kbd">⌨ Serial Console</span> یا Ctrl+M). سرعت باید 115200 و قالب 8N1 باشد. یک متن تایپ کنید و Enter بزنید: FPGA آن را با حروف بزرگ برمی‌گرداند. LEDهای برد توسعه سه بیت پایین آخرین حرف را نشان می‌دهند. Logic Analyzer هم برای این درس آماده است و هر دو خط را با دیکودر نشان می‌دهد.</p>`,
    en: {
      body: `
<p>Now the other direction: the PC sends and the FPGA receives. The characters you type in the <b>serial console</b> reach the FPGA from the CH340C chip on the pin <code>UART_RX</code> (pin H16).</p>
<h3>The receiver</h3>
<ul>
  <li>The input is not in step with our clock, so it first passes two flip-flops (a <b>synchronizer</b>).</li>
  <li>The receiver waits for the falling edge of the start bit, then waits <b>half a bit</b> (217 clocks) to reach its middle. If the line is still 0, a real frame has started.</li>
  <li>From there it takes one sample every 434 clocks: always in the middle of a bit, as far from the edges as possible.</li>
  <li>After the stop bit it puts the byte on <code>data</code> and raises <code>done</code> for one clock.</li>
</ul>
<pre class="formula">CLKS_PER_BIT = 50,000,000 / 115,200 ≈ 434      HALF = 217</pre>
<h3>An upper-case echo</h3>
<p>Lower-case letters (0x61 to 0x7A) become upper case by subtracting 0x20 and go back through the transmitter of the previous lesson. If the next byte arrives while the transmitter is still busy, a register (<code>hold</code>) keeps it. ${part('LED1')} to ${part('LED3')} show the low three bits of the last byte received.</p>`,
      tryIt: `<p>Run the design and open the <b>serial console</b> (the <span class="kbd">⌨ Serial Console</span> button or Ctrl+M). It must be at 115200 and 8N1. Type some text and press Enter: the FPGA sends it back in upper case. The extension board's LEDs show the low three bits of the last character. The logic analyzer is set up for this lesson too and shows both lines with decoders.</p>`,
    },
  },
};
