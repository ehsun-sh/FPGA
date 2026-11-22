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
import { BEYOND, PROJECT_CLOCK } from './beyond';
import { EN } from './en';
import { GOALS, PREREQ, type Level } from './goals';
import { PREDICT, type Question } from './predict';
import { QUIZ } from './quiz';
import { ZYNQ_EN, ZYNQ_GOALS, ZYNQ_LESSONS, ZYNQ_LEVEL, ZYNQ_PREREQ, ZYNQ_QUIZ } from './zynq';
import { EXT_EN, EXT_GOALS, EXT_LESSONS, EXT_LEVEL, EXT_PREREQ, EXT_QUIZ } from './ext';
import { LINUX_EN, LINUX_GOALS, LINUX_LESSONS, LINUX_LEVEL, LINUX_PREREQ, LINUX_QUIZ } from './linux';
import { hasVariant } from './boards';

// the EBAZ4205 chapters keep their learning-loop data in zynq.ts (chapter Z), ext.ts (extension board, HDMI) and
// linux.ts (Linux on Zynq)
Object.assign(EN, ZYNQ_EN, EXT_EN, LINUX_EN);
Object.assign(GOALS, ZYNQ_GOALS, EXT_GOALS, LINUX_GOALS);
Object.assign(QUIZ, ZYNQ_QUIZ, EXT_QUIZ, LINUX_QUIZ);
Object.assign(PREREQ, ZYNQ_PREREQ, EXT_PREREQ, LINUX_PREREQ);
Object.assign(ZYNQ_LEVEL, EXT_LEVEL, LINUX_LEVEL);

type Text = { fa: string; en: string };

export interface Chapter {
  title: Text;
  lessons: Lesson[];
  soon?: Text[]; // planned lessons, shown greyed out
  projects?: boolean; // the guided projects: listed on their own, not counted in the course progress
  // the boards this chapter is for (default: the Nexys A7); '*' = any board (no board-specific hardware)
  boards?: string[];
  // listed with the board's own versions of lessons from the other boards' chapters (lessons/boards.ts)
  variants?: boolean;
}

const pool = new Map([...LESSONS, ...ADVANCED, TESTBENCH_LESSON, VGA_LESSON, SENSORS_LESSON, PS2_LESSON, SOFTCORE_LESSON, ...BEYOND, ...ZYNQ_LESSONS, ...EXT_LESSONS, ...LINUX_LESSONS, PROJECT_CLOCK, PLAYGROUND].map((l) => [l.id, l]));
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
  { title: { fa: 'فراتر از مبانی', en: 'Beyond the basics' }, lessons: pick('timing', 'clocking', 'cdc', 'bram', 'realboard') },
  { title: { fa: 'Zynq و برد EBAZ4205', en: 'Zynq and the EBAZ4205' }, lessons: pick('z-intro', 'z-blink', 'z-bootflow', 'z-ps-hello', 'z-ethernet'), boards: ['ebaz4205'] },
  { title: { fa: 'برد توسعه: LED، کلید، سریال، بازر و LCD', en: 'Extension board: LEDs, keys, serial, buzzer and LCD' }, lessons: pick('x-leds', 'x-keys', 'x-uart', 'x-buzzer', 'x-lcd'), boards: ['ebaz4205'] },
  { title: { fa: 'درس‌های پایه روی EBAZ4205', en: 'Core lessons on the EBAZ4205' }, lessons: [], boards: ['ebaz4205'], variants: true },
  { title: { fa: 'HDMI', en: 'HDMI' }, lessons: pick('x-hdmi-tmds', 'x-hdmi-bars'), boards: ['ebaz4205'] },
  { title: { fa: 'لینوکس روی Zynq', en: 'Linux on Zynq' }, lessons: pick('lx-boot', 'lx-console', 'lx-gpio', 'lx-driver', 'lx-fpgamgr'), boards: ['ebaz4205'] },
  { title: { fa: 'آزمایشگاه', en: 'Lab' }, lessons: [PLAYGROUND], boards: ['*'] },
  {
    title: { fa: 'پروژه‌ها', en: 'Projects' },
    lessons: pick('proj-clock'),
    soon: [
      { fa: 'پروژه ۲: ترمینال UART با سه فرمان', en: 'Project 2: a UART terminal with three commands' },
      { fa: 'پروژه ۳: توپ جهنده روی VGA', en: 'Project 3: a bouncing ball on VGA' },
    ],
    projects: true,
  },
];

// every lesson that can be opened: the course, the playground and the projects
export const ALL_LESSONS: Lesson[] = CHAPTERS.flatMap((c) => c.lessons);
// the course itself, in order: what the progress, the lesson numbers and the certificate count
export const COURSE_CHAPTERS: Chapter[] = CHAPTERS.filter((c) => !c.projects && !c.lessons.includes(PLAYGROUND));
export const COURSE_LESSONS: Lesson[] = COURSE_CHAPTERS.flatMap((c) => c.lessons);
export const PROJECTS: Chapter = CHAPTERS.find((c) => c.projects)!;
export const isProject = (l: Lesson) => PROJECTS.lessons.includes(l);

// the quiz is written with the right answer first; a fixed per-question order (the same in both languages) spreads it
function shuffled(q: Question, key: string): Question {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const idx = q.options.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    const j = h % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return { ...q, options: idx.map((i) => q.options[i]), answer: idx.indexOf(q.answer) };
}

// merge the learning-loop data into the lessons once, at load: chapters 1–2 are intro, 3–5 core, 6–8 advanced;
// the projects are core (they reuse chapters 3–5)
const LEVELS: Level[] = ['intro', 'intro', 'core', 'core', 'core', 'advanced', 'advanced', 'advanced'];
CHAPTERS.forEach((c, ci) => {
  for (const l of c.lessons) {
    if (l === PLAYGROUND) continue;
    l.level = ZYNQ_LEVEL[l.id] ?? (c.projects ? 'core' : LEVELS[ci]);
    if (PREREQ[l.id]) l.prereq = PREREQ[l.id];
    const g = GOALS[l.id];
    if (g) {
      Object.assign(l, g.fa);
      if (EN[l.id]) Object.assign(EN[l.id], g.en);
    }
    const z = QUIZ[l.id];
    if (z) {
      l.quiz = z.fa.map((q, i) => shuffled(q, `${l.id}:${i}`));
      if (EN[l.id]) EN[l.id].quiz = z.en.map((q, i) => shuffled(q, `${l.id}:${i}`));
    }
    const p = PREDICT[l.id];
    if (p) {
      l.predict = p.fa;
      if (EN[l.id]) EN[l.id].predict = p.en;
    }
  }
});
export const NEXYS = 'nexys-a7-100t';
export const chapterBoards = (c: Chapter) => c.boards ?? [NEXYS];
export const chapterOnBoard = (c: Chapter, board: string) => chapterBoards(c).some((b) => b === '*' || b === board);
// a board's versions of lessons from other boards' chapters, in course order; they fill its `variants` chapter
const variantLessons = (board: string) =>
  CHAPTERS.filter((c) => !c.variants && !chapterOnBoard(c, board)).flatMap((c) => c.lessons).filter((l) => hasVariant(l.id, board));
const filled = (c: Chapter, board: string): Chapter => (c.variants ? { ...c, lessons: variantLessons(board) } : c);
// the chapters a learner on this board sees: its own (one of them may hold its versions of other lessons) and the
// board-independent ones
export const chaptersFor = (board: string) =>
  CHAPTERS.filter((c) => chapterOnBoard(c, board))
    .map((c) => filled(c, board))
    .filter((c) => c.lessons.length > 0 || !!c.soon);
export const courseChaptersFor = (board: string) =>
  CHAPTERS.filter((c) => chapterOnBoard(c, board) && COURSE_CHAPTERS.includes(c))
    .map((c) => filled(c, board))
    .filter((c) => c.lessons.length > 0);
export const courseLessonsFor = (board: string) => courseChaptersFor(board).flatMap((c) => c.lessons);
// the boards a lesson can run on (those of its chapter)
export const lessonBoards = (l: Lesson) => chapterBoards(CHAPTERS.find((c) => c.lessons.includes(l)) ?? CHAPTERS[0]);
// a lesson runs on its chapter's boards and on every board it has a version for
export const lessonOnBoard = (l: Lesson, board: string) => lessonBoards(l).some((b) => b === '*' || b === board) || hasVariant(l.id, board);

export const chapterOf = (l: Lesson) => CHAPTERS.findIndex((c) => c.lessons.includes(l));
export { PLAYGROUND };
