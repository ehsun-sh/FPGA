// Course outline. Chapter order follows Pong P. Chu, "FPGA Prototyping by Verilog/VHDL Examples":
// gate-level basics, RT-level combinational circuits, regular sequential circuits, FSM, FSMD, memory, I/O.
import { ADVANCED } from './advanced';
import { LESSONS, PLAYGROUND, type Lesson } from './lessons';
import { TESTBENCH_LESSON } from './sim';
import { SENSORS_LESSON } from './sensors';
import { VGA_LESSON } from './vga';

type Text = { fa: string; en: string };

export interface Chapter {
  title: Text;
  lessons: Lesson[];
  soon?: Text[]; // planned lessons, shown greyed out
}

const pool = new Map([...LESSONS, ...ADVANCED, TESTBENCH_LESSON, VGA_LESSON, SENSORS_LESSON, PLAYGROUND].map((l) => [l.id, l]));
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
  { title: { fa: 'ماشین حالت متناهی (FSM)', en: 'Finite state machines (FSM)' }, lessons: pick('fsm', 'debounce') },
  { title: { fa: 'FSMD: مسیر داده و کنترل', en: 'FSMD: datapath and control' }, lessons: pick('bin2bcd') },
  { title: { fa: 'حافظه', en: 'Memory' }, lessons: pick('ram') },
  {
    title: { fa: 'ورودی/خروجی و ارتباط با دنیای بیرون', en: 'I/O and peripherals' },
    lessons: pick('pwm', 'uart', 'uart_rx', 'spi', 'i2c', 'sensors', 'vga'),
    soon: [
      { fa: 'صفحه‌کلید PS/2', en: 'PS/2 keyboard' },
      { fa: 'پردازنده نرم‌افزاری (Soft-core)', en: 'Soft-core processor' },
    ],
  },
  { title: { fa: 'آزمایشگاه', en: 'Lab' }, lessons: [PLAYGROUND] },
];

export const ALL_LESSONS: Lesson[] = CHAPTERS.flatMap((c) => c.lessons);
export const chapterOf = (l: Lesson) => CHAPTERS.findIndex((c) => c.lessons.includes(l));
export { PLAYGROUND };
