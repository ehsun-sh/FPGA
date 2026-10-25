// Course outline. The early chapters follow Pong P. Chu, "FPGA Prototyping by Verilog/VHDL Examples":
// gate-level basics, RT-level combinational circuits, regular sequential circuits, FSM and FSMD. Then the I/O
// lessons in two chapters of four (serial links first, since the sensor lesson builds on I²C),
// and memory last, right before the soft-core processor that uses it.
import { ADVANCED } from './advanced';
import { LESSONS, PLAYGROUND, type Lesson } from './lessons';
import { TESTBENCH_LESSON } from './sim';
import { PS2_LESSON } from './ps2';
import { SENSORS_LESSON } from './sensors';
import { SOFTCORE_LESSON } from './softcore';
import { VGA_LESSON } from './vga';

type Text = { fa: string; en: string };

export interface Chapter {
  title: Text;
  lessons: Lesson[];
  soon?: Text[]; // planned lessons, shown greyed out
}

const pool = new Map([...LESSONS, ...ADVANCED, TESTBENCH_LESSON, VGA_LESSON, SENSORS_LESSON, PS2_LESSON, SOFTCORE_LESSON, PLAYGROUND].map((l) => [l.id, l]));
const pick = (...ids: string[]) =>
  ids.map((id) => {
    const l = pool.get(id);
    if (!l) throw new Error(`unknown lesson ${id}`);
    return l;
  });

export const CHAPTERS: Chapter[] = [
  { title: { fa: 'مبانی: گیت‌ها و مدارهای ترکیبی ساده', en: 'Basics: gates and simple combinational circuits' }, lessons: pick('intro', 'gates', 'mux', 'adder', 'seg7') },
  { title: { fa: 'مدارهای ترکیبی در سطح RT', en: 'RT-level combinational circuits' }, lessons: pick('decoder', 'shifter', 'alu') },
  { title: { fa: 'مدارهای ترتیبی منظم', en: 'Regular sequential circuits' }, lessons: pick('ff', 'counter', 'testbench', 'shiftreg', 'multiplex', 'stopwatch') },
  { title: { fa: 'ماشین حالت: FSM و FSMD', en: 'State machines: FSM and FSMD' }, lessons: pick('fsm', 'debounce', 'bin2bcd') },
  { title: { fa: 'ارتباط سریال: UART، SPI و I²C', en: 'Serial communication: UART, SPI and I²C' }, lessons: pick('uart', 'uart_rx', 'spi', 'i2c') },
  { title: { fa: 'ورودی/خروجی و تجهیزات جانبی', en: 'I/O and peripherals' }, lessons: pick('pwm', 'sensors', 'ps2', 'vga') },
  { title: { fa: 'حافظه و پردازنده‌ی نرم', en: 'Memory and a soft-core processor' }, lessons: pick('ram', 'softcore') },
  { title: { fa: 'آزمایشگاه', en: 'Lab' }, lessons: [PLAYGROUND] },
];

export const ALL_LESSONS: Lesson[] = CHAPTERS.flatMap((c) => c.lessons);
export const chapterOf = (l: Lesson) => CHAPTERS.findIndex((c) => c.lessons.includes(l));
export { PLAYGROUND };
