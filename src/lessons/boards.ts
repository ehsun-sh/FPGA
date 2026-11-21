// Per-board versions of lessons (docs/EBAZ4205-ROADMAP.md, E1.1 and E3.4). The board is fixed for a page load
// (switching it reloads the page), so applyBoardVariants() rewrites the lessons in place once, at start-up. A lesson
// with a version for a board is listed on that board too (course.ts), and its exercise there is in grade/variants.ts.
import { Z_BLINK_V, Z_BLINK_VHD } from '../boards/ebaz4205/code';
import { EBAZ_VARIANTS } from './ebaz-variants';
import type { LessonText } from './en';
import type { Lesson } from './lessons';

export type Variant = Partial<Pick<Lesson, 'summary' | 'body' | 'verilog' | 'vhdl' | 'xdc' | 'tryIt' | 'la' | 'prereq' | 'objectives' | 'takeaways' | 'quiz'>> & {
  en?: Partial<LessonText>;
};

const PORTS_FA = (rows: string) =>
  `<h3>نام پورت‌های آماده</h3>
<table class="truth"><thead><tr><th>پورت</th><th>جهت</th><th>توضیح</th></tr></thead><tbody>${rows}</tbody></table>`;
const PORTS_EN = (rows: string) =>
  `<h3>Ready-made port names</h3>
<table class="truth"><thead><tr><th>Port</th><th>Dir</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table>`;

export const VARIANTS: Record<string, Record<string, Variant>> = {
  playground: {
    ebaz4205: {
      body: `
<p>اینجا آزاد هستید! هر طرح سنتزپذیری بنویسید و روی برد EBAZ4205 اجرا کنید. این برد Zynq است: بخش PL منطق شماست
و بخش PS دو هسته‌ی ARM دارد. شبیه‌ساز فقط PL را اجرا می‌کند.</p>
${PORTS_FA(`<tr><td><code>clk</code></td><td>in</td><td>کلاک 50MHz از PS (‏FCLK_CLK0)؛ در XDC به پایه نیاز ندارد</td></tr>
<tr><td><code>LED_R</code></td><td>out</td><td>LED قرمز روی برد (W14)</td></tr>
<tr><td><code>LED_G</code></td><td>out</td><td>LED سبز روی برد (W13)</td></tr>
<tr><td><code>DATA1_5 … DATA3_20</code></td><td>in/out</td><td>پایه‌های هدرهای DATA1 تا DATA3 (گام 2.0 میلی‌متر)</td></tr>`)}
<p>برد کلید و دکمه ندارد؛ آن‌ها با برد توسعه می‌آیند. پروب‌های تحلیلگر منطقی را به پایه‌های DATA وصل کنید.</p>`,
      verilog: Z_BLINK_V,
      vhdl: Z_BLINK_VHD,
      xdc: { led: true },
      tryIt: `<p>کد را بنویسید و <span class="kbd">▶ Run</span> را بزنید: LED قرمز و سبز به نوبت چشمک می‌زنند. در کنسول خط
<code>clk is driven by FCLK_CLK0</code> را می‌بینید؛ یعنی کلاک از بخش PS می‌آید.</p>`,
      en: {
        body: `
<p>You are free here! Write any synthesizable design and run it on the EBAZ4205. It is a Zynq board: the PL is your
logic, the PS holds two ARM cores. The simulator runs the PL only.</p>
${PORTS_EN(`<tr><td><code>clk</code></td><td>in</td><td>50 MHz clock from the PS (FCLK_CLK0); needs no pin in the XDC</td></tr>
<tr><td><code>LED_R</code></td><td>out</td><td>red LED on the board (W14)</td></tr>
<tr><td><code>LED_G</code></td><td>out</td><td>green LED on the board (W13)</td></tr>
<tr><td><code>DATA1_5 … DATA3_20</code></td><td>in/out</td><td>pins of the DATA1 to DATA3 headers (2.0 mm pitch)</td></tr>`)}
<p>The board has no switches or buttons; they come with the extension board. Clip logic-analyzer probes onto the DATA pins.</p>`,
        tryIt: `<p>Write your code and press <span class="kbd">▶ Run</span>: the red and green LEDs blink in turn. The console
shows <code>clk is driven by FCLK_CLK0</code>: the clock comes from the PS.</p>`,
      },
    },
  },
};
for (const [id, v] of Object.entries(EBAZ_VARIANTS)) (VARIANTS[id] ??= {}).ebaz4205 = v;

export const hasVariant = (id: string, board: string) => !!VARIANTS[id]?.[board];

export function applyBoardVariants(board: string, lessons: Lesson[], en: Record<string, LessonText>) {
  for (const l of lessons) {
    const v = VARIANTS[l.id]?.[board];
    if (!v) continue;
    const { en: vEn, ...rest } = v;
    Object.assign(l, rest);
    if (vEn && en[l.id]) en[l.id] = { ...en[l.id], ...vEn };
  }
}
