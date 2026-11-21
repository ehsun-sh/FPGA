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

type Text = { fa: string; en: string };

export interface Chapter {
  title: Text;
  lessons: Lesson[];
  soon?: Text[]; // planned lessons, shown greyed out
  projects?: boolean; // the guided projects: listed on their own, not counted in the course progress
  // the boards this chapter is for (default: the Nexys A7); '*' = any board (no board-specific hardware)
  boards?: string[];
}

const pool = new Map([...LESSONS, ...ADVANCED, TESTBENCH_LESSON, VGA_LESSON, SENSORS_LESSON, PS2_LESSON, SOFTCORE_LESSON, ...BEYOND, PROJECT_CLOCK, PLAYGROUND].map((l) => [l.id, l]));
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
    l.level = c.projects ? 'core' : LEVELS[ci];
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
// the chapters a learner on this board sees: its own and the board-independent ones
export const chaptersFor = (board: string) => CHAPTERS.filter((c) => chapterOnBoard(c, board));
export const courseChaptersFor = (board: string) => chaptersFor(board).filter((c) => COURSE_CHAPTERS.includes(c));
export const courseLessonsFor = (board: string) => courseChaptersFor(board).flatMap((c) => c.lessons);
// the boards a lesson can run on (those of its chapter)
export const lessonBoards = (l: Lesson) => chapterBoards(CHAPTERS.find((c) => c.lessons.includes(l)) ?? CHAPTERS[0]);
export const lessonOnBoard = (l: Lesson, board: string) => lessonBoards(l).some((b) => b === '*' || b === board);

export const chapterOf = (l: Lesson) => CHAPTERS.findIndex((c) => c.lessons.includes(l));
export { PLAYGROUND };
