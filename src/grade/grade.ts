// Runs an exercise's checker on the student's design (or testbench) and collects the results.
import type { BoardDef } from '../boards';
import { HdlError, synthesize, synthesizeFiles, type Lang } from '../hdl';
import { TbSim } from '../sim/tbsim';
import { EXERCISES, Tester, type CheckItem } from './exercises';
import { BoardHarness } from './harness';

export interface GradeInput {
  lang: Lang;
  src: string; // the student's design
  xdc: string;
  tb?: string; // the student's testbench
  original?: string; // the lesson's own design (for testbench exercises)
}

export interface GradeResult {
  passed: boolean;
  items: CheckItem[];
}

const MAX_CYCLES = 400_000_000;

export function hasExercise(id: string) {
  return !!EXERCISES[id];
}

export function gradeExercise(id: string, input: GradeInput, board: BoardDef): GradeResult {
  const ex = EXERCISES[id];
  const t = new Tester();
  if (!ex) return { passed: false, items: [] };
  try {
    if (ex.testbench) gradeTestbench(ex.testbench.mutate[input.lang], input, t);
    else {
      const params: Record<string, number> = {};
      let names: string[] = [];
      try {
        names = synthesize(input.src, input.lang).topParams ?? [];
      } catch (e) {
        const he = e as HdlError;
        t.need(false, `طرح سنتز نمی‌شود: ${he.message}${he.loc ? ` (خط ${he.loc.line})` : ''}`, `the design does not synthesize: ${he.message}${he.loc ? ` (line ${he.loc.line})` : ''}`);
      }
      for (const [k, v] of Object.entries(ex.params ?? {})) {
        const has = names.some((n) => n.toLowerCase() === k.toLowerCase());
        t.need(has, `ماژول top یک parameter/generic به نام ${k} دارد`, `the top module has a parameter/generic named ${k}`);
        params[k] = v;
      }
      const d = synthesize(input.src, input.lang, undefined, params);
      let h: BoardHarness;
      try {
        h = new BoardHarness(d, input.xdc, board);
      } catch (e) {
        t.need(false, `پیاده‌سازی (XDC) خطا دارد: ${(e as Error).message}`, `implementation (XDC) failed: ${(e as Error).message}`);
        throw e;
      }
      h.maxCycles = MAX_CYCLES;
      ex.check!(h, t);
    }
  } catch (e) {
    if (!Tester.isStop(e)) {
      const m = (e as Error).message;
      if (m === 'time budget') t.ok(false, 'بررسی بیش از حد طول کشید (آیا مقدار parameter به‌درستی استفاده شده است؟)', 'the check ran too long (is the parameter used correctly?)');
      else t.ok(false, `خطا هنگام بررسی: ${m}`, `error while checking: ${m}`);
    }
  }
  return { passed: t.items.length > 0 && t.items.every((i) => i.ok), items: t.items };
}

function gradeTestbench(mutate: [RegExp, string], input: GradeInput, t: Tester) {
  const design = input.original ?? input.src;
  const run = (src: string) => {
    const s = new TbSim(synthesizeFiles([{ name: 'design', src }, { name: 'tb', src: input.tb ?? '' }], input.lang));
    s.run(Infinity, 3000);
    return s;
  };
  let good: TbSim;
  try {
    good = run(design);
  } catch (e) {
    const he = e as HdlError;
    t.need(false, `Testbench کامپایل نمی‌شود: ${he.message}${he.loc ? ` (خط ${he.loc.line})` : ''}`, `the testbench does not compile: ${he.message}${he.loc ? ` (line ${he.loc.line})` : ''}`);
    return;
  }
  t.need(good.finished && !good.error, 'Testbench با $finish / std.env.finish تمام می‌شود', 'the testbench ends with $finish / std.env.finish');
  t.ok(good.errors === 0, `با طرح درست هیچ خطایی گزارش نمی‌شود (${good.errors} خطا)`, `with the correct design no error is reported (${good.errors} errors)`);
  const broken = design.replace(mutate[0], mutate[1]);
  if (broken === design) throw new Error('internal: the broken design could not be made');
  const bad = run(broken);
  t.ok(bad.errors > 0 || !!bad.error, 'با طرحی که ریستش کار نمی‌کند، Testbench خطا گزارش می‌کند', 'with a design whose reset does not work, the testbench reports an error');
}
