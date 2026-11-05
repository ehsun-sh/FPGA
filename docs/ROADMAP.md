# FPGA Lab — Product roadmap in four phases

This document is written as a set of **implementation briefs** for an AI coding model (or a developer). Each phase is
self-contained: hand over the *Global rules* section plus one *Phase N* section as the task. Phases are ordered by
impact; do them in order, one pull request per phase.

The briefs are deliberately explicit about file paths, data shapes, UI copy (Persian and English), behaviour, and
acceptance criteria. Where a decision had to be made, it is made here; do not re-open it unless it turns out to be
impossible, and then say so in the PR.

---

## Global rules (apply to every phase)

### What the product is

A browser-only FPGA course. The learner writes Verilog or VHDL, presses **Run on Board**, and watches the design run
on a 3D Digilent Nexys A7-100T. There is an in-browser HDL simulator, a testbench simulator with waveforms, a logic
analyzer, a serial console, a VGA monitor, add-on modules, Vivado-style reports, and 27 lessons in 7 chapters plus a
playground, in Persian (primary) and English. The site is live at `https://learn.shahmohammadi.dev/fpga/`.

### Stack and conventions

- **Build:** Vite 8, TypeScript 7 (`strict`), vanilla DOM (no framework, no JSX), CodeMirror 6, Three.js, Vitest.
  `npm run dev`, `npm test`, `npm run build` (`build` runs `tsc --noEmit` first). Node 22.
- **Do not add a UI framework** or a CSS framework. New runtime dependencies need a one-line justification in the PR.
- **All HTML is produced by template strings** in `src/main.ts` and `src/ui/*.ts`. Escape user/lesson-derived text with
  the local `esc()` helper. Events are delegated: buttons carry `data-act="<name>"` and `act(name)` in `src/main.ts`
  dispatches them (big `switch`). Lesson links carry `data-lesson="<id>"` (handled at `src/main.ts` ≈ line 1597).
- **State and persistence:** the `store` object at the top of `src/main.ts` wraps `localStorage` with the prefix
  `fpgalab:`. Existing keys: `lang` (verilog|vhdl), `ui-lang` (fa|en), `lesson`, `solved`, `seen`, `flow-closed`,
  `src:<id>:<lang>`, `xdc:<board>:<id>`, `tb:<id>:<lang>`, `board`. Keep this pattern; add new keys through `store`.
- **i18n:** site chrome strings live in `src/ui/strings.ts` (`UI`, `HOME`); lesson-page labels in `LESSON_UI` in
  `src/lessons/en.ts`. Persian lesson text lives in `src/lessons/lessons.ts`, `advanced.ts`, `sim.ts`, `vga.ts`,
  `sensors.ts`, `ps2.ts`, `softcore.ts`; English text lives in `src/lessons/en.ts` as `EN[id]` (type `LessonText`).
  `text(l)` in `src/main.ts` picks the right one. Tool and Vivado terms (Run on Board, Synthesis, Testbench, Tcl
  Console…) stay in English in both languages; guidance text is translated. Numbers in running text go through
  `num(n, lang)` (Persian digits in Persian). Code, pin names and part numbers keep Latin digits.
- **Every new user-facing string must exist in both `fa` and `en`.** This document supplies the Persian copy; use it
  verbatim. If you must write new Persian, keep the existing register (formal "شما", ZWNJ in compounds such as
  «می‌شود», «درس‌ها»).
- **Lesson data model** (`src/lessons/lessons.ts`):
  ```ts
  interface Lesson { id; title; summary; body: string /* HTML */; verilog; vhdl; xdc: Partial<Record<XdcGroup, boolean>>;
                     tryIt: string; exercise?: string; la?: LaConfig; tb?: { verilog; vhdl } }
  ```
  `src/lessons/course.ts` builds `CHAPTERS` (title fa/en, lessons, optional `soon`) and `ALL_LESSONS`.
  **Never rename a lesson id** (ids are in URLs and localStorage).
- **Exercises** (`src/grade/exercises.ts`): `EXERCISES[id] = { fa, en, params?, testbench?, check?(h: BoardHarness, t: Tester) }`.
  `Tester.ok(cond, fa, en)` / `Tester.need(...)` record `CheckItem { ok, fa, en }`. `gradeExercise()` in
  `src/grade/grade.ts` returns `{ passed, items }`. `test/exercises.test.ts` holds a Verilog `SOLUTIONS` map and asserts
  that every checker accepts the solution and rejects the unchanged lesson code.
- **Board view** interface: `src/boards/types.ts` (`BoardView`, `BoardDef`). The Nexys model is
  `src/boards/nexys-a7/model3d.ts` (`NexysA7Model`, with `knobs[]`, `ledGlows[]`, `ledMats[]`, `btnCaps: Map`,
  `toScreen()`, `switchScreenPos()`). The same board element moves between the hero on the landing page
  (`#hero-stage`) and the workbench (`.board-host`); do not break `renderHomePage()` / `showHome()`.
- **CSS:** one file, `src/style.css` (~3600 lines). It currently has **three** `:root` token blocks (line 1, ≈2002,
  ≈2284); the last one wins. Responsive rules are at the end ("keep last"). Phone layout is `max-width: 900px`,
  one pane at a time via `body[data-m]` and the `#mtabs` bar. Keep the accessibility work: skip link, visible focus,
  ARIA on menus/tabs, 4.5:1 text contrast, `prefers-reduced-motion`.
- **Tests:** Vitest runs in Node (no DOM). Put pure logic in importable modules and test it under `test/`. DOM behaviour
  is verified manually (and with the optional Playwright script described in Phase 1). `npm test` and `npm run build`
  must pass before every commit. CI (`.github/workflows/ci.yml`) runs both; `deploy.yml` deploys `main` to Cloudflare.
- **Code style:** match the file you edit (`src/main.ts` uses double quotes; most other files use single quotes;
  2-space indent; comments explain *why*). Keep functions small; prefer adding a module under `src/ui/` or
  `src/lessons/` over growing `src/main.ts` further.
- **Mobile:** every change must still work at 390 px wide (lesson readable, buttons reachable, no horizontal scroll).
- **Docs:** update the *Features* list in `README.md` for anything user-visible, and this file's phase checklist.
- **Commits/PR:** one commit per numbered task (e.g. `1.3 Add the onboarding tour`), one draft PR per phase with a
  short "how to verify" list. Do not bump `package.json` version; the maintainer does.

### How to work a phase

1. Read this whole document once, then the phase you are doing.
2. Run `npm ci && npm test && npm run build` to confirm a green baseline (143 tests at the time of writing).
3. Implement the tasks in order. After each task: `npm test`, `npm run build`, open `npm run dev`, click through
   the changed screens at 1440 px and 390 px, in both languages.
4. Finish with the phase's *Acceptance checklist*; every box must be true.

---

## Phase 1 — Beginner-first workbench (UX foundation)

**Goal.** A first-time learner in lesson 1 sees only what lesson 1 needs: the lesson, the code, Run on Board, the
board, the exercise. The Vivado chrome (menus, Flow Navigator sections, Tcl console, Hardware Manager jargon) is one
switch away for people who want it. A 5-step tour explains the screen once.

**Why.** The biggest drop-off risk is the first minute. Today the workbench shows three stacked bars (site bar,
Vivado menu bar, toolbar), a Flow Navigator with seven sections, a Tcl console printing fake `hw_server` lines, and
three instrument buttons the learner cannot use yet.

### 1.1 Two workbench modes: *Learn* and *Vivado*

- Add state `mode: 'learn' | 'vivado'` in `src/main.ts`, persisted as `store` key `mode`. Default `learn` for
  everyone (also for returning users).
- Add `applyMode()` that sets `document.body.classList` to `mode-learn` or `mode-vivado` and updates the toggle's
  `aria-pressed`. Call it at init and on change. No reload.
- **Toggle UI:** a segmented control (`.seg-ctl`, same component as the Verilog/VHDL one) rendered in the titlebar
  through the `extra` argument of `homeNav()` in `src/ui/home.ts` when `current` is `lab` or `playground`. Two
  buttons: `data-act="mode-learn"` and `data-act="mode-vivado"`. Labels:
  - fa: «آموزش» / «Vivado»  en: "Learn" / "Vivado"
  - `aria-label` of the group: fa «حالت میز کار» en "Workbench mode".
  Also add "Workbench: Learn mode" / "Workbench: Vivado mode" radio items to the **View** menu for Vivado-mode users.
- **What Learn mode hides** (CSS on `body.mode-learn`, do not remove DOM so shortcuts keep working):
  - `nav.menubar` (File/Flow/View/Tools/Help). Its two useful entries get other homes: *Reset lesson code* becomes a
    small link in the lesson's Code section (`data-act="reset-code"`, label fa «بازگرداندن کد درس» en "Reset lesson
    code"); *Download Vivado project* stays reachable from the Help button (1.4) under "Downloads".
  - Flow Navigator sections `project`, `sim`, `rtl`, `synth`, `impl`, `prog` (keep `learn`). Rename the aside's title
    in Learn mode from `FLOW NAVIGATOR` to the course name: fa «دوره» en "Course" (the title element is
    `.flow-title`; make its text come from `UI[lang]`, new keys `flowTitle` / `courseTitle`).
  - Toolbar instrument buttons `#la-btn`, `#serial-btn`, `#vga-btn` **unless** `lessonTools(lesson)` (in
    `src/lessons/tools.ts`) includes that tool for the current lesson. Implement by toggling a `hidden-tool` class on
    these buttons in `openLesson()`; the lesson's "Tools in this lesson" box keeps working as today.
  - The right-pane header text `HARDWARE MANAGER — localhost/xilinx_tcf/Digilent` becomes just the board name
    (`boardDef.name`) and `SIMULATION — Behavioral` becomes fa «شبیه‌سازی» en "Simulation". The `#hw-dev`
    "(not programmed)" label is hidden in Learn mode.
  - The Tcl prompt form `#tcl-form` is hidden in Learn mode (the log stays readable).
- **Vivado mode** must look and behave exactly as the site does today.
- **Phones** (`max-width: 900px`): the toggle is hidden and the body always gets `mode-learn` behaviour (the menubar
  is already hidden there; make sure the other rules apply too).
- The playground (`body.in-playground`) keeps today's layout in both modes, except the menubar rule above.
- Keyboard shortcuts (Ctrl+Enter, Shift+F6, Ctrl+L, Ctrl+M, F5) keep working in both modes; Ctrl+L / Ctrl+M in Learn
  mode open the instrument even if its button is hidden (the window is still useful; just do not surprise with a
  hidden button state — un-hide the button while its window is open).

### 1.2 Quiet console in Learn mode

- Move the four start-up `log("****** FPGA Lab …")` / `INFO: [Labtools …]` calls at the end of `src/main.ts` into
  `logBanner()`. Call it at init only when mode is `vivado`, and the first time the user switches to Vivado mode.
- In Learn mode the bottom panel (`#bottom`) starts **collapsed** (height of its tab bar only; add class
  `collapsed`). Clicking a bottom tab expands it; clicking the active tab again collapses it. Persist the state in
  `store` key `bottom-open` (`1`/`0`), Vivado mode ignores it (always open, as today).
- Auto-expand the bottom panel, switching to **Messages**, when `renderMessages()` has at least one error or
  warning after a run/synth/sim, and switch to **Tcl Console** when an exercise check finishes (the check already
  logs there). Never auto-collapse.
- In Learn mode the bottom tab order is Messages, Tcl Console, Reports (Messages first). Keep DOM order; use CSS
  `order` on `body.mode-learn #bottom-tabs [data-btab]`.
- Add a statusbar chip `#st-msgs` (left of the version) showing "n messages" / «n پیام» with a warning colour when
  there are errors; clicking it expands the panel on Messages.

### 1.3 Onboarding tour

- New module `src/ui/tour.ts` exporting:
  ```ts
  export interface TourStep { target: string /* CSS selector */; title: string; body: string; placement?: 'top'|'bottom'|'left'|'right'|'auto' }
  export function startTour(steps: TourStep[], opts: { lang: 'fa'|'en'; onDone(): void }): void
  ```
  Implementation: one overlay `div.tour` appended to `body` with (a) a dimming layer made of a `div.tour-hole`
  positioned on the target's `getBoundingClientRect()` with `box-shadow: 0 0 0 9999px rgba(0,0,0,.45)` and a 6 px
  padding, (b) a card `div.tour-card[role=dialog][aria-modal=true]` with `h2`, `p`, a step counter («۱ از ۵» / "1 of
  5"), and buttons *Back* / *Next* / *Skip* (last step: *Done*). Reposition on `resize` and `scroll` (capture). Esc =
  skip. Trap Tab focus inside the card; restore focus to the previously focused element on close. Scroll the target
  into view before showing a step. `prefers-reduced-motion`: no transitions.
  Strings (fa / en): Back «قبلی» / "Back", Next «بعدی» / "Next", Skip «رد کردن» / "Skip", Done «تمام» / "Done".
- **Desktop steps** (selectors exist today):
  1. target `#lesson` — fa «درس را اینجا بخوانید» / «هر درس یک مفهوم را توضیح می‌دهد، کد آماده دارد و با یک تمرین
     تمام می‌شود.» — en "Read the lesson here" / "Each lesson explains one idea, ships working code and ends with an
     exercise."
  2. target `#doc-tabs [data-tab="source"]` — fa «کد اینجاست» / «تب top.v کد درس را در ویرایشگر باز می‌کند. می‌توانید
     آن را تغییر دهید؛ تغییرات در مرورگر ذخیره می‌شود.» — en "The code lives here" / "The top.v tab opens the
     lesson's code in the editor. Edit it freely; your changes are saved in the browser."
  3. target `.toolbar .tb.run` — fa «اجرا روی برد» / «Run on Board کد را سنتز می‌کند و روی برد سه‌بعدی اجرا
     می‌کند (میان‌بر: Ctrl+Enter).» — en "Run it on the board" / "Run on Board synthesizes the code and runs it on
     the 3D board (shortcut: Ctrl+Enter)."
  4. target `#board` — fa «برد زنده است» / «روی کلیدها و دکمه‌ها کلیک کنید، برد را بچرخانید و LEDها و نمایشگر را
     ببینید.» — en "The board is live" / "Click the switches and buttons, rotate the board, and watch the LEDs and
     the display."
  5. target `#sec-exercise` (fallback `#sec-try` if the lesson has no exercise) — fa «خودتان را محک بزنید» / «هر درس
     یک تمرین دارد. «بررسی راه‌حل من» طرح شما را روی یک برد مجازی آزمایش می‌کند.» — en "Check yourself" / "Every
     lesson ends with an exercise. “Check my solution” tests your design on a virtual board."
- **Phone steps** (when `matchMedia('(max-width: 900px)')` matches): targets `#mtabs [data-m="lesson"]`,
  `#mtabs [data-m="code"]`, `.toolbar .tb.run`, `#mtabs [data-m="board"]`; reuse the texts of steps 1–4.
- Auto-start the tour 600 ms after the workbench is first shown (`showHome(false)`) when `store.get('tour-done')` is
  null and the lesson is not the playground. On finish or skip set `tour-done = 1`. Re-run from Help → "Take the
  tour" (1.4). Never auto-start on the landing page.

### 1.4 Help in both modes

- Add a round icon button `?` (`data-act="help-menu"`, `aria-label` fa «راهنما» en "Help") next to the language menu
  in the titlebar (both landing page and workbench, via `homeNav()`), opening a dropdown with the same keyboard
  behaviour as the language menu (reuse `bindLangMenu()` patterns; roles `menu` / `menuitem`). Items:
  1. *Take the tour* — fa «گشت آشنایی» — runs 1.3.
  2. *Keyboard shortcuts* — fa «میان‌برهای صفحه‌کلید» — opens `<dialog id="shortcuts">` listing: Ctrl+Enter Run on
     Board; Shift+F6 Simulate; F5 Reset; Ctrl+L Logic Analyzer; Ctrl+M Serial Console; Esc close menus/windows;
     Ctrl+K Search (reserved for Phase 4, list it only once Phase 4 ships).
  3. *Simulator limits* — fa «محدودیت‌های شبیه‌ساز» — opens `<dialog id="limits">` with this content (fa and en):
     2-state only (0/1, no X); `z` only on `inout` ports of the top module; vectors up to 32 bits; no `generate`;
     no functions/tasks; no VHDL packages beyond `ieee.std_logic_1164` / `numeric_std`; single clock domain; the
     timing/utilization numbers are estimates, not a Vivado run. Each item gets an `id` (`lim-generate`,
     `lim-function`, `lim-width`, `lim-xz`, `lim-package`) so Phase 2.7 can deep-link to it.
  4. *Downloads* submenu (or three items): design source, testbench, constraints, Vivado project (`data-act`
     `download-src`, `download-tb`, `download-xdc`, `download-project` already exist).
  5. *Report a problem* — fa «گزارش مشکل» — link to `https://github.com/ehsun-sh/FPGA/issues/new` (new tab, `rel="noopener"`).
  6. *About FPGA Lab* — existing `about` dialog.
- The Vivado-mode **Help** menu in the menubar gets the same items.

### 1.5 One HDL language switch

- In **Learn mode** hide the toolbar `.seg-ctl[aria-label="HDL language"]`. Render a second, identical segmented
  control with `id="doc-lang"` at the right end of `#doc-tabs` (after the tabs; `margin-inline-start: auto`), hidden
  in Vivado mode. `markLang()` already updates every `[data-lang]` button, so both stay in sync. The lesson's Code
  section keeps its Verilog/VHDL tabs (they switch the global language too, via `setLang`).
- Under the Code section tabs add a one-line hint, muted: fa «این انتخاب زبان ویرایشگر و تمرین را هم عوض می‌کند.»
  en "This choice also sets the editor and exercise language."

### 1.6 Honest time estimates

- New pure function in `src/lessons/time.ts`:
  ```ts
  export function lessonTime(l: { body: string; tryIt: string; exercise?: string }, hasExercise: boolean, chapter: number): { read: number; practice: number }
  ```
  `read` = max(2, round(words/180)) using the existing word count logic (move it out of `renderLesson`);
  `practice` = 5 (try-it) + (hasExercise ? 10 : 0) + (chapter >= 4 ? 5 : 0). Allow an override `time?: { read; practice }`
  on `Lesson` (use it in `softcore` = `{ read: 8, practice: 30 }` and `i2c` = `{ read: 6, practice: 25 }`).
- Lesson head shows: fa «حدود ۳ دقیقه مطالعه · ۱۵ دقیقه تمرین» en "about 3 min read · 15 min practice". Update
  `LESSON_UI.readTime` into `time(read, practice)`.
- Home chapter cards show the chapter total as a muted line under the title: fa «≈ ۱ ساعت و ۱۰ دقیقه» / «≈ ۴۵ دقیقه»
  en "≈ 1 h 10 min" / "≈ 45 min". Put the formatting in `src/lessons/time.ts` (`formatMinutes(min, lang)`).
- Test: `test/time.test.ts` covering the formula and formatting in both languages (Persian digits, hour/minute split).

### 1.7 Instrument legend

- On the landing page, under the big progress bar of the *Lessons* section, add `<ul class="legend">` with one item
  per tool that any lesson uses (derive from `lessonTools` over `ALL_LESSONS`): icon + name (`TOOLS[t].name`) + a
  short description: fa «لاجیک‌آنالایزر», «کنسول سریال», «مانیتور VGA», «ماژول‌ها» / en "Logic analyzer", "Serial
  console", "VGA monitor", "Modules". Prefix: fa «ابزارهای درس:» en "Lesson tools:".
- The same legend, compact, at the bottom of the Flow Navigator's LEARN section (`.sec-body#lesson-list` footer).

### 1.8 Phone notice in the code pane

- When `body[data-m="code"]` is active on a phone, show a dismissible note above the editor (`store` key
  `phone-note` = `1` after dismiss): fa «ویرایش کد روی لپ‌تاپ راحت‌تر است. اینجا می‌توانید کد درس را اجرا کنید و
  تمرین‌ها را بخوانید.» en "Editing is easier on a laptop. Here you can still run the lesson code and read the
  exercises."

### 1.9 Optional: screenshot smoke script

- Add `scripts/screenshots.cjs` (not part of the build): if `playwright` can be required, it serves `dist/` with
  `vite preview` on a free port and captures `home`, `lesson/intro`, `lesson/counter` at 1440×900 and 390×844 in both
  languages and both modes into `screenshots/` (git-ignored). Document it in README under *Development*. If
  Playwright is not installed the script prints how to install it and exits 0.

### Acceptance checklist — Phase 1

- [x] Fresh browser → landing page → "Start with lesson 1": the workbench opens in Learn mode, the tour starts,
      the menubar and Flow Navigator extras are hidden, the bottom panel is collapsed, no `hw_server` lines.
- [x] Switching to Vivado mode restores today's UI pixel-for-pixel (compare with a screenshot from `main`).
- [x] The three instrument buttons appear only in lessons whose `lessonTools()` include them; Ctrl+L still works.
- [x] Run a lesson with a deliberate syntax error: the bottom panel opens on Messages and the chip shows the count.
- [x] Tour: all 5 steps position correctly at 1440 px and 1280 px; Esc skips; it never shows twice; Help re-runs it.
- [x] Language switch works from the lesson Code tabs and from `#doc-lang`; the toolbar one is hidden in Learn mode.
- [x] Time estimates render in both languages; `test/time.test.ts` passes.
- [x] Phone (390 px): toggle hidden, note shows once in the code pane, tour uses the phone steps.
- [x] `npm test`, `npm run build` green; README updated; PR lists how to verify.

---

## Phase 2 — The learning loop inside every lesson

**Goal.** Every lesson states what you will learn, lets you predict before you run, checks understanding with a short
quiz, gives staged hints and a solution when you are stuck, and explains failures with expected-vs-actual evidence.
Cross-references stop being hard-coded numbers.

**Why.** Today a lesson is read → run → "change the code"; a learner who gets stuck gets a red ✗ and nothing else,
and there is no way to make progress on a phone.

### 2.1 Learning objectives, key takeaways, level and prerequisites

- Extend `Lesson` (fa) and `LessonText` (en) with:
  ```ts
  objectives?: string[];   // 3 items, ≤ 20 words, "می‌توانید …" / "You can …" form, plain text
  takeaways?: string[];    // 3–4 items, ≤ 20 words, plain text (inline <code> allowed)
  ```
  and `Lesson` with `level?: 'intro' | 'core' | 'advanced'` and `prereq?: string[]` (lesson ids).
- Write objectives and takeaways for **all 27 lessons in both languages**. They must match the lesson body (no new
  concepts). Example for `gates` — fa objectives: «هفت گیت پایه را با عملگرهای Verilog و VHDL بنویسید.», «جدول درستی
  یک گیت را روی LEDها بخوانید.», «توضیح دهید چرا FPGA گیت جدا نمی‌سازد و LUT چه می‌کند.»; en takeaways: "A LUT
  implements any function of its inputs; the synthesizer packs several gates into one LUT.", "`&`, `|`, `~`, `^` in
  Verilog map to `and`, `or`, `not`, `xor` in VHDL.", "Every `assign` / concurrent `<=` is a wire, evaluated all the
  time."
- Levels: chapters 1–2 `intro`, 3–5 `core`, 6–7 `advanced`. Prerequisites (exact):
  `mux: ['gates']`, `adder: ['gates']`, `seg7: ['mux']`, `decoder: ['mux']`, `shifter: ['mux']`, `alu: ['adder','mux']`,
  `counter: ['ff']`, `testbench: ['counter']`, `shiftreg: ['ff']`, `multiplex: ['seg7','counter']`,
  `stopwatch: ['multiplex']`, `fsm: ['counter']`, `debounce: ['fsm','counter']`, `bin2bcd: ['fsm','shiftreg']`,
  `uart: ['fsm','counter']`, `uart_rx: ['uart']`, `spi: ['fsm','shiftreg']`, `i2c: ['fsm','spi']`,
  `pwm: ['counter']`, `sensors: ['i2c']`, `ps2: ['shiftreg','debounce']`, `vga: ['counter']`, `ram: ['ff']`,
  `softcore: ['ram','fsm','alu']`.
- Rendering (in `renderLesson`): after `.summary`, a box `<section class="objectives">` with heading fa «در پایان
  این درس می‌توانید» en "By the end of this lesson you can", a level badge (`.level.intro|core|advanced`; fa
  «مقدماتی» / «اصلی» / «پیشرفته», en "Intro" / "Core" / "Advanced") and, if `prereq`, a line fa «پیش‌نیاز:» en
  "Before this:" with lesson links (use `ref()` from 2.2). After the Try-it section and before the exercise, a
  `<section class="takeaways" id="sec-takeaways">` headed fa «نکات کلیدی» en "Key takeaways". Add both to the
  on-page TOC (`toc` array). Show the level badge on the landing-page lesson rows and in the Flow Navigator (tiny
  coloured dot with `title`).
- Test (`test/lessons.test.ts`): every course lesson has 3 objectives and 3–4 takeaways in both languages, each
  ≤ 160 characters; every `prereq` id exists and comes earlier in `ALL_LESSONS`; level is set for every course lesson.

### 2.2 Stable cross-references

- `src/lessons/helpers.ts`: add `export const ref = (id: string) => \`<a class="xref" data-ref="${id}" href="#lesson/${id}"></a>\`;`
  (Phase 4 later rewrites the `href` through its router; keep the `data-ref` contract.)
- In `renderLesson()`, after setting `innerHTML`, fill every `.xref`: text = fa «درس ۵: نمایشگر ۷ قسمتی» / en
  "lesson 5: Seven-segment display" (number = 1-based position in the course without the playground; title via
  `text(l).title`), add `data-lesson="<id>"` so the existing click delegation opens it. Unknown id → throw in dev,
  render the id in prod.
- Replace **every** hard-coded reference in lesson prose (`grep -n "درس [۰-۹0-9]\+\|lesson [0-9]\+" src/lessons/*.ts`,
  34 hits today) with `${ref('<id>')}`. Also the Tiny8 and other texts that say "از دیکودر درس ۵" etc.
- Test: no `body`, `tryIt`, `exercise`, `objectives`, `takeaways` string in any lesson (fa and en) matches
  `/(درس|lesson)\s*[۰-۹0-9]+/i`; every `data-ref` id exists in `ALL_LESSONS`.

### 2.3 Staged hints and a solution

- Extend `Exercise` in `src/grade/exercises.ts`:
  ```ts
  hints?: { fa: string; en: string }[];      // exactly 2: [concept hint, code-skeleton hint]; HTML allowed
  solution?: { verilog: string; vhdl: string }; // a complete top module that passes the checker
  ```
  Move the Verilog solutions from `test/exercises.test.ts` `SOLUTIONS` into `EXERCISES[id].solution.verilog` (keep
  the `edit()` helper by generating the strings at module load) and **write the VHDL solution for every exercise**.
  Write 2 hints per exercise in both languages. Example (`intro`): hint 1 fa «ترتیب بیت‌ها را برعکس کنید؛ یعنی
  بیت ۰ خروجی باید از بیت ۱۵ ورودی بیاید.» / en "Reverse the bit order: output bit 0 must come from input bit 15.";
  hint 2 fa «در Verilog: <code>always @(*) for (i = 0; i < 16; i = i + 1) LED[i] = SW[15 - i];</code> و <code>LED</code> را
  <code>reg</code> کنید. در VHDL از یک حلقه‌ی <code>for</code> داخل یک process استفاده کنید.» / en "In Verilog:
  <code>always @(*) for (i = 0; i < 16; i = i + 1) LED[i] = SW[15 - i];</code> and make <code>LED</code> a <code>reg</code>.
  In VHDL use a <code>for</code> loop inside a process."
- `test/exercises.test.ts`: iterate `EXERCISES`; for each, `gradeExercise` must pass with `solution.verilog` (lang
  verilog) **and** `solution.vhdl` (lang vhdl), and fail with the lesson's unchanged code in both languages. Keep
  the existing `EXTRA` XDC groups logic. Also assert every exercise has exactly 2 hints in both languages.
- **UI** in `exerciseHtml()` under the task text, before the check button:
  - Button *Hint 1* (fa «راهنمایی ۱») reveals hint 1 inline; then *Hint 2* (fa «راهنمایی ۲») appears.
  - Button *Show solution* (fa «نمایش راه‌حل») is **disabled** until (failed checks ≥ 2) **or** (both hints open).
    Tooltip while disabled: fa «بعد از دو تلاش یا دیدن هر دو راهنمایی فعال می‌شود» en "Enabled after two attempts or
    both hints". Revealed solution = highlighted code block (`codeBlock()`) in the current HDL language with a
    button *Copy into editor* (fa «گذاشتن در ویرایشگر») that asks `confirm()` (fa «کد فعلی ویرایشگر جایگزین می‌شود.
    ادامه؟» en "This replaces the code in the editor. Continue?") then `srcEditor.setText(...)`.
  - Counters in `store`: `attempts:<id>` (failed checks), `hints:<id>` (0–2), `solution:<id>` = `1` once shown.
  - If the solution was shown before the exercise passed, mark the lesson "solved with help": store the id in
    `solved-help` (comma list). Lists show a hollow check (`icon('check')` inside `.done.help`) with title fa «حل
    شده با راه‌حل» en "solved with the solution". It still counts as done.
- Reset hints/attempts when the user picks *Reset lesson code*.

### 2.4 Evidence in checker results

- `CheckItem` gains `detail?: { expected: string; actual: string; scene?: { sw?: number; btn?: string } }`.
  `Tester.ok(cond, fa, en, detail?)` and `Tester.need(...)` accept it.
- Update the checkers of these exercises to pass `detail` on every switch/LED comparison: `intro`, `gates`, `mux`,
  `adder`, `seg7`, `ff`, `counter`, `shiftreg`, `multiplex`, `stopwatch`, `decoder`, `shifter`, `alu`. Example:
  ```ts
  h.sw(v); t.ok(h.led() === rev16(v), `…`, `…`, { expected: hex(rev16(v)), actual: hex(h.led()), scene: { sw: v } });
  ```
- Result box (`#ex-result`): when any item has `detail`, render a table with columns fa «بررسی | انتظار | شما»
  en "Check | Expected | Yours" (`dir="auto"` cells, `dir="ltr"` for hex), plus a button *Show on board* (fa «نمایش
  روی برد») on failed items with a `scene`: it sets the 16 switches via `board.setSwitch(i, on, true)` (notify so the
  runner sees them), presses the button if `scene.btn`, starts the design with `act("run")` if it is not running, and
  on phones switches to the board pane. Items without `detail` render as today.

### 2.5 Predict before you run

- `Lesson` / `LessonText` gain `predict?: { q: string; options: string[]; answer: number; why: string }[]`.
  Write 1–2 questions for each lesson in chapters 1–3 (`intro, gates, mux, adder, seg7, decoder, shifter, alu, ff,
  counter, testbench, shiftreg, multiplex, stopwatch`) in both languages, about what the board will show. Example
  (`gates`): q fa «اگر SW0=1 و SW1=0 باشد، کدام LEDها روشن می‌شوند؟» options «LD1 و LD5», «LD0 و LD6», «فقط LD2»,
  «LD1، LD3 و LD5»; answer 3 (0-based: OR, NAND, XOR → LD1, LD3, LD5); why «OR=1، NAND=1، XOR=1؛ AND و XNOR صفر و
  NOT A صفر است.»
- Render inside `#sec-try`, above the Run buttons: heading fa «اول حدس بزنید» en "Predict first", radio options,
  button *Lock in* (fa «ثبت حدس»). After locking, options are disabled, the Run button pulses once
  (`.pulse` class, respects reduced motion). When the runner starts (`setRunState()` with running = true) show
  *Reveal* (fa «نمایش پاسخ»); reveal marks the chosen option right/wrong and shows `why`. Store choice in
  `predict:<id>` (index) so a return visit shows it answered.

### 2.6 Quick-check quiz

- `Lesson` / `LessonText` gain `quiz?: { q: string; options: string[]; answer: number; why?: string }[]`. Write
  **3 questions for every course lesson (27), both languages**. Rules: test the concept, not trivia; exactly one
  correct option; 3–4 options; distractors must be plausible misconceptions; no "all of the above"; `why` ≤ 25 words.
- Render `<section class="quiz" id="sec-quiz">` after takeaways and before the exercise; heading fa «خودآزمایی» en
  "Quick check"; TOC entry. Each question: radio group, *Check* button (fa «بررسی»), immediate right/wrong with
  `why`; wrong answers can be retried. The section is *passed* when all questions are currently correct; store
  `quiz:<id>` = `1`. Show fa «✓ خودآزمایی کامل شد» en "✓ Quick check passed".
- **Progress rule change** (`isDone` in `src/main.ts`): a lesson is done when (exercise solved, if it has one) **and**
  (quiz passed, if it has one); a lesson with neither is done once opened. Mention in the PR that existing users may
  see lessons drop back to "not done" until they pass the quiz. Landing-page lesson rows show two tiny marks: quiz
  (`icon('list')`) and exercise (`icon('target')`), filled when passed, with `title`s.
- Test: every course lesson has 3 quiz questions in both languages; `answer` is in range; option counts equal in
  fa and en.

### 2.7 Friendly simulator-limit errors

- `HdlError` already has `code`. Make the parsers throw with **stable codes**: `generate` → `'lim-generate'`,
  `function`/`task` → `'lim-function'`, VHDL `package`/`use` of a non-ieee package → `'lim-package'`, vector width
  > 32 → `'lim-width'`, `x`/`z` literal outside the allowed `inout` form → `'lim-xz'`. Find the current throw sites
  in `src/hdl/verilog.ts` (≈ line 443), `src/hdl/vhdl.ts`, `src/hdl/elaborate.ts`.
- `renderMessages()`: for messages whose `code` starts with `lim-`, prepend a friendly line, fa «این شبیه‌ساز هنوز
  … را پشتیبانی نمی‌کند.» en "This simulator does not support … yet." and append a link *Why?* (fa «چرا؟») that opens
  the limits dialog (1.4) and scrolls to `#<code>`.
- Test (`test/sim.test.ts`): one snippet per code throws `HdlError` with that code (Verilog and, where applicable,
  VHDL).

### Acceptance checklist — Phase 2

- [ ] Every course lesson shows objectives, level, prerequisites (where defined), takeaways, a 3-question quiz; both languages.
- [ ] No hard-coded lesson numbers remain in lesson text; cross-reference links open the right lesson.
- [ ] Every exercise has 2 hints and Verilog + VHDL solutions; `test/exercises.test.ts` proves both languages pass.
- [ ] Hint/solution gating works as specified; "solved with help" shows the hollow check.
- [ ] Chapter 1–3 checkers show the Expected/Yours table; *Show on board* reproduces the failing case.
- [ ] Predict-first appears in chapters 1–3 and reveals after Run.
- [ ] `generate` in the editor produces the friendly message with a working *Why?* link.
- [ ] Progress on the landing page reflects quiz + exercise; phone users can complete quizzes.
- [ ] `npm test`, `npm run build` green; README updated.

---

## Phase 3 — One visual system, diagrams, and a board that answers the text

**Goal.** One token set and a dark theme across landing page and workbench; a figure in every lesson that needs one;
hovering a pin name in the text lights that part on the 3D board; Persian headings set properly; a real logo and a
social preview image.

**Why.** The lessons contain **zero** images or diagrams; the landing page (warm paper, orange) and the workbench
(cool grey, blue) look like two products; the editor and instruments are dark while everything else is light; and
`--fa` currently lists Inter *before* Vazirmatn, so Persian text mixes two fonts' metrics.

### 3.1 Design tokens and dark theme

- Create `src/theme.css`, imported first from `src/main.ts`, containing **the only** `:root` token block. Delete the
  three `:root` blocks in `src/style.css` (lines ≈1–20, ≈2002–2017, ≈2284–2303) and make `style.css` consume tokens.
  Light values (keep the current warm look):
  ```
  --bg:#f1ece2 --paper:#f6eddd --panel:#fffdf9 --panel-2:#f8f4ec --line:#e2d9c8 --line-soft:#ece5d8
  --text:#211d17 --muted:#6b6254 --title:#2a2419 --accent:#2459d6 --accent-soft:#e4ebfb --brand:#e2621b
  --brand-soft:#fbe6d6 --run:#1f8f3b --ok-soft:#e3f4e7 --err:#c62828 --warn:#b7791f
  --editor-bg:#1e2128 --editor-gutter:#1a1d23 --editor-active:#262a33   (editor stays dark in both themes)
  --radius:8px --radius-lg:14px --shadow:0 1px 2px rgba(60,40,10,.05),0 1px 3px rgba(60,40,10,.08)
  --ui:'Inter','Vazirmatn',system-ui,sans-serif  --fa:'Vazirmatn','Inter',Tahoma,sans-serif  --mono:'JetBrains Mono',Consolas,monospace
  --space-1:4px … --space-6:32px
  ```
  Dark values under `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` **and**
  `:root[data-theme="dark"] {…}`:
  ```
  --bg:#15171c --paper:#191c22 --panel:#1d2027 --panel-2:#242831 --line:#2e333d --line-soft:#272b34
  --text:#e8e6e1 --muted:#a0a6b1 --title:#f2f0ea --accent:#7fb0ff --accent-soft:#1f2c47 --brand:#f0803a
  --brand-soft:#3a2416 --run:#4ccb6a --ok-soft:#163d22 --err:#ff6b6b --warn:#e2b14a
  --editor-bg:#15171c --editor-gutter:#121418 --editor-active:#1c1f26
  --shadow:0 1px 2px rgba(0,0,0,.4),0 1px 3px rgba(0,0,0,.5)
  ```
  Syntax colours (`src/ui/highlight.ts`, editor theme in `src/ui/editor.ts`) become tokens `--syn-kw`, `--syn-type`,
  `--syn-num`, `--syn-str`, `--syn-comment`, `--syn-op` with values for both themes. Waveform/LA/serial colours become
  `--wave-*`, `--la-*` tokens (dark in both themes; only borders/headers follow the theme).
- Replace raw hex colours in `style.css` with tokens wherever they are UI colours (grep `#[0-9a-f]{3,6}`); keep
  physical colours (LED green, board PCB, flag SVGs, monitor LED) as literals with a `/* physical */` comment.
- `index.html`: `<meta name="color-scheme" content="light dark">`; keep `theme-color` and update it from JS on theme
  change (`#f6eddd` light, `#15171c` dark).
- Theme control: a button next to the language menu cycling *System → Light → Dark* (icons: add `sun`, `moon`,
  `monitor` to `src/ui/icons.ts`), `aria-label` fa «پوسته: سیستم/روشن/تاریک» en "Theme: system/light/dark"; stored
  as `store` key `theme` (`system|light|dark`); sets `document.documentElement.dataset.theme` (`light|dark`, removed
  for system). Apply before first paint (inline `<script>` in `index.html` reading `localStorage['fpgalab:theme']`).
- Three.js: the board host background (`.board-host`) and the scene clear colour follow `--bg`-like tokens; pass the
  colour to `NexysA7Model` via a `setBackground(hex)` method called on theme change.
- Test `test/theme.test.ts`: parse `src/theme.css` with a regex into {light, dark} token maps and assert WCAG
  contrast (relative luminance formula) ≥ 4.5 for `text/bg`, `text/panel`, `muted/panel`, and ≥ 3 for `accent/panel`
  and `brand/panel`, in both themes. Fail with the pair and ratio.

### 3.2 Persian typography

- `[lang="fa"]`, `.lesson[dir="rtl"]`, `#home[dir="rtl"]`: `font-family: var(--fa)` (Vazirmatn first). Headings in
  Persian: weight 800, `line-height: 1.55`, `letter-spacing: 0`. Latin fragments inside Persian headings (part
  names, "FPGA") keep Vazirmatn's Latin glyphs — do **not** wrap them in Inter.
- Hero `h1` in Persian: `font-size: clamp(2rem, 4.5vw, 3.4rem)`; `.motto` separators use `·` with
  `margin-inline: .6em`.
- Body text in Persian: `font-size: 1.02rem; line-height: 1.9`. Code inside Persian text (`code`, `.kbd`) gets
  `direction: ltr; unicode-bidi: isolate`.
- Check at 390 px that no heading wraps mid-word (the current «FPGA چیست؟ آشنایی با برد Nexys A7» wraps "Nexys / A7"
  on two lines — allow `white-space: nowrap` on the `.pin`/part spans introduced in 3.4).

### 3.3 Figures in the lessons

- New module `src/lessons/figures.ts`. Each figure is a function returning an inline `<svg>` string: `viewBox` set,
  `width="100%"`, `role="img"`, `aria-labelledby` pointing at a `<title>`; strokes/fills use `currentColor`,
  `var(--accent)`, `var(--line)`, `var(--muted)`, `var(--brand)` so they work in both themes; text via `<text>` with
  `font-family: var(--ui)`; **no external files**, each ≤ 8 KB. Labels are parameters so fa/en both work (default
  English; the Persian lessons pass Persian labels). Wrap in `<figure class="fig" dir="ltr"><figcaption>…</figcaption></figure>`;
  the caption is in the page language.
- Figures to implement and where to place them (fa **and** en bodies):
  1. `figLut()` — 4-input LUT as a 16-row table feeding a 16:1 mux, next to a D flip-flop → `intro`.
  2. `figGates()` — the seven IEEE gate symbols with A/B inputs and output names LD0…LD6 → `gates`.
  3. `figMux()` — 2:1 and 4:1 mux symbols, select lines labelled SW → `mux`.
  4. `figAdder()` — one full-adder block, then a 4-bit ripple chain with carries → `adder`.
  5. `figSeg7(value?)` — segments a–g (+dp) with labels; **interactive**: clicking a segment toggles it and a line
     under the figure shows the 7-bit pattern `gfedcba` (delegate `click` on `[data-seg]` in `src/main.ts`) → `seg7`.
  6. `figFlipFlop()` — clk/d/q timing with rising-edge markers → `ff`.
  7. `figDivider()` — clk, prescaler value sketch, `tick`, `blink` → `counter`.
  8. `figMultiplex()` — AN3…AN0 active-low scan vs. segment bus over time → `multiplex`.
  9. `figFsm(states: string[], edges: [from, to, label][], opts?)` — generic state diagram (nodes on a circle, arrows,
     self-loops, start marker) → `fsm` (traffic light), `debounce`, `bin2bcd`, `softcore` (fetch/execute).
  10. `figUartFrame()` — idle, start, 8 data bits LSB first, stop; bit-time annotation → `uart`, `uart_rx`.
  11. `figSpi()` — SCLK, MOSI, MISO, CS for mode 0, 8 bits → `spi`.
  12. `figI2c()` — SDA/SCL with START, 7-bit address, R/W, ACK, data byte, STOP → `i2c`, `sensors`.
  13. `figVga()` — one line and one frame: visible, front porch, sync, back porch → `vga`.
  14. `figTiny8()` — block diagram: PC → ROM → IR → control; A, ALU, RAM, IN/OUT → `softcore`.
  15. `figShiftReg()` — 8 flip-flops in a chain with the LFSR XOR taps → `shiftreg`.
- CSS: `.fig { margin: var(--space-5) 0; padding: var(--space-4); border: 1px solid var(--line-soft); border-radius: var(--radius-lg); background: var(--panel) } .fig svg { display:block; max-width: 100%; height: auto } .fig figcaption { color: var(--muted); font-size: .9em; margin-top: var(--space-2) }`.
- Test (`test/figures.test.ts`): every exported figure function returns a string that starts with `<svg`, contains
  one `<title>`, has balanced `<svg`/`</svg>` and `<g`/`</g>` counts, contains no `undefined`/`NaN`, and is ≤ 8192
  bytes. `test/lessons.test.ts`: the lessons listed above contain `<figure class="fig"` in both languages.

### 3.4 Board highlighting from the text

- `src/lessons/helpers.ts`: `export const part = (name: string) => \`<b class="pin" data-part="${name}">${name}</b>\`;`
  Convert mentions in lesson prose (fa and en) of `SW0…SW15`, `LD0…LD17`, `BTNC/BTNU/BTNL/BTNR/BTND`, `CPU RESET`,
  `AN0…AN7` to `${part('SW0')}` — at least in every `tryIt`, every `exercise`, and the board tour in `intro`. A
  regex pass is acceptable if reviewed by hand (do not touch code blocks or `<code>`).
- `BoardView` gains `highlight?(parts: string[]): void`. Implement in `NexysA7Model`: switches → scale-pulse the knob
  in `knobs[i]`; LEDs → set the glow sprite opacity to 0.9 with the brand colour; buttons → emissive pulse on
  `btnCaps.get(name)`; `AN<n>` → a translucent brand-coloured rectangle over the digit; `CPU RESET` → the reset cap.
  Animate in `onFrame()` (sine pulse, 1.2 s period); `highlight([])` clears. Respect reduced motion (static ring).
- `src/main.ts`: `mouseenter`/`focus` on `.pin` (delegated with `mouseover`/`focusin`) calls
  `board.highlight?.([name])`; `mouseleave`/`blur` clears. `.pin` is focusable (`tabindex="0"`) and styled as a
  subtle chip (border `--line`, `white-space: nowrap`, `direction: ltr`).
- After the first successful **Run on Board** in a lesson (store `ran:<id>` absent), highlight every part mentioned
  in that lesson's `tryIt` for 2 s, then set `ran:<id>`.
- Phones: skip hovering; the chip is still styled.

### 3.5 Brand and social preview

- New logo: a 4×4 grid of rounded cells (LUT) with one cell in `--brand`, drawn as inline SVG in `.brand .logo`
  (replace the plain orange square) and as `public/favicon.svg`. Monochrome variant for the footer.
- `public/og.png` (1200×630): dark background, the logo, "FPGA Lab", tagline "Learn FPGA design in your browser",
  a rendered still of the 3D board (take it from the screenshot script, or draw a flat board illustration if
  Playwright is unavailable). Add to `index.html`:
  `<meta property="og:image" content="https://learn.shahmohammadi.dev/fpga/og.png">`, `og:image:width/height`,
  `<meta name="twitter:card" content="summary_large_image">`, `og:locale` `fa_IR` with `og:locale:alternate` `en_US`.

### Acceptance checklist — Phase 3

- [ ] Exactly one `:root` token block exists (`grep -c "^:root" src/theme.css src/style.css` → 1 and 0).
- [ ] Light and dark themes render the landing page, workbench, editor, waveform viewer, LA, serial console,
      modules panel, schematic and the dialogs without unreadable text; `test/theme.test.ts` passes.
- [ ] Theme cycles System/Light/Dark, persists, no flash of wrong theme on reload.
- [ ] Persian pages use Vazirmatn for body and headings; hero and lesson titles look right at 1440/1280/390 px.
- [ ] 15 figures implemented and placed; each lesson listed has its figure in both languages; the 7-segment figure is interactive.
- [ ] Hovering `SW3` in a lesson pulses switch 3 on the board; first Run pulses the Try-it parts.
- [ ] New logo and `og.png` in place; sharing the URL shows the image (check with an OG debugger or `curl` the head).
- [ ] `npm test`, `npm run build` green; README updated.

---

## Phase 4 — Reach, retention, and finishing the course

**Goal.** Every lesson has a real, indexable, shareable URL in both languages; learners can search the course and
look up terms; the course explains *why* FPGA and ends with a path to real hardware, timing, clocking, CDC and
block RAM; a guided project ties lessons together; progress can be exported and a certificate earned.

**Out of scope (explicitly, for a later phase):** user accounts and cloud sync, an instructor dashboard,
auto-generated animations/GIFs from the simulator, a comments/community feature.

### 4.1 Real URLs, SEO and prerendering

- **Routes** (replace the `#lesson/<id>` hash scheme):
  `/` → landing page in the stored language; `/fa/`, `/en/` → landing page in that language (and store it);
  `/fa/lesson/<id>`, `/en/lesson/<id>`; `/fa/lab`, `/en/lab` (workbench, current lesson); `/fa/playground`,
  `/en/playground`; `/fa/glossary`, `/en/glossary` (4.2). Legacy `#lesson/<id>` and `#lab` are mapped to the new
  URL with `history.replaceState` on boot.
- Implement `src/ui/router.ts` with `parse(pathname): Route`, `urlFor(route): string`, `BASE` from
  `import.meta.env.BASE_URL`. Replace `route()`, `goHome()`, `goLab()`, `openLesson()`'s `replaceState`, and the
  language switch with `pushState` to the new URLs (switching language rewrites the `/fa|en/` segment).
- **Base path:** `vite.config.ts` `base: process.env.VITE_BASE ?? '/'`; `deploy.yml` and the README set
  `VITE_BASE=/fpga/` for the Cloudflare build. `wrangler.toml` `[assets]`: add `not_found_handling = "single-page-application"`
  and keep `run_worker_first = true`; the worker keeps stripping `/fpga` and otherwise falls back to `index.html`
  for paths without a file extension.
- **Prerender for crawlers:** `scripts/prerender.mjs`, run by `npm run build` after `vite build`
  (`"build": "tsc --noEmit && vite build && node scripts/prerender.mjs"`). It imports the built lesson data
  (compile `src/lessons/course.ts` with `tsx`/`vite-node`, or build a small `lessons.json` during `vite build`
  through a Vite plugin — pick one and document it) and writes, for each language and each course lesson plus the
  landing page and glossary, `dist/<lang>/lesson/<id>/index.html` = `dist/index.html` with:
  `<html lang dir>`, `<title>` = `"<lesson title> · FPGA Lab"`, `<meta name="description">` = summary,
  `<link rel="canonical">`, `<link rel="alternate" hreflang="fa|en|x-default">`, `og:title/description/url/image`,
  and a `<div id="seo" hidden>` containing the lesson `h1`, summary, objectives and body HTML (scripts stripped).
  The app removes `#seo` on boot. Also write `dist/sitemap.xml` (all URLs, both languages, `lastmod` = build date)
  and `dist/robots.txt` (`Sitemap:` line).
- Update `<title>` and `description` at runtime on navigation (`document.title`).
- Test (`test/router.test.ts`): `parse`/`urlFor` round-trip for every route, legacy hash mapping, base-path handling.

### 4.2 Search and glossary

- `src/lessons/glossary.ts`: `GLOSSARY: { id; term: {fa,en}; def: {fa,en}; lesson?: id }[]` with **at least these
  45 terms**: FPGA, LUT, flip-flop, slice/CLB, BRAM, DSP slice, routing, bitstream, synthesis, implementation,
  place and route, XDC/constraint, clock, rising edge, combinational, sequential, register, latch, counter,
  prescaler/clock divider, debounce, metastability, FSM, FSMD, Moore vs Mealy, testbench, waveform, timescale,
  baud rate, UART, start/stop bit, parity, SPI, MOSI/MISO, CPOL/CPHA, I²C, open-drain, pull-up, ACK/NACK, PWM,
  duty cycle, seven-segment, multiplexing, persistence of vision, VGA, porch, sync pulse, BCD, double dabble,
  ROM/RAM, soft-core, opcode, accumulator, Pmod, Tcl, utilization, Fmax, setup/hold time. Definitions ≤ 40 words.
- Glossary page (`/<lang>/glossary`): rendered like a lesson page (alphabetical in the page language, anchor per
  term, link to the lesson that introduces it). Link from the landing-page footer and the Help menu
  (fa «واژه‌نامه» en "Glossary").
- `term(id)` helper in `helpers.ts` → `<abbr class="term" data-term="id" tabindex="0">label</abbr>`; a tooltip
  (`role="tooltip"`, shown on hover/focus, Esc hides) shows the definition. Use it for the first occurrence of
  LUT, flip-flop, synthesis, XDC, testbench, FSM, baud, open-drain, duty cycle, BRAM in the lessons that introduce them.
- `src/ui/search.ts`: Ctrl+K and a search icon in the titlebar/landing nav open a dialog with an input and a
  result list (`role="listbox"`, arrow keys, Enter opens). Index: lesson titles (weight 5), glossary terms (4),
  summaries/objectives (3), body text stripped of tags (1). Normalise Persian for matching: `ي→ی`, `ك→ک`, remove
  ZWNJ and diacritics, map Persian/Arabic digits to Latin, lower-case Latin. Show chapter, title, and a 90-char
  snippet with the match highlighted. Placeholder fa «جستجو در درس‌ها و واژه‌نامه…» en "Search lessons and
  glossary…". Test: normalisation and ranking in `test/search.test.ts`.

### 4.3 Why FPGA, and a chapter that finishes the course

- Landing page: new section between the hero and *How a lesson works*, heading fa «چرا FPGA؟» en "Why FPGA?", three
  cards (fa/en copy to write, ≤ 60 words each): *Where FPGAs are used* (telecom, video, instruments, automotive,
  aerospace, AI accelerators), *FPGA vs. microcontroller* (parallel hardware vs. sequential software; nanosecond
  determinism), *What you will build here* (counters, displays, UART/SPI/I²C, VGA, a small CPU — then the same code
  on a real board).
- New chapter 8 in `course.ts`, fa «فراتر از مبانی» en "Beyond the basics", inserted before the Lab chapter, with
  five lessons written to the Phase 2 standard (objectives, takeaways, quiz, exercise with checker + hints +
  solutions, figure where listed, fa and en, Verilog and VHDL that compile in the simulator — `test/lessons.test.ts`
  compiles every lesson automatically):
  1. `timing` — setup/hold, the register-to-register path, what Fmax means, reading this site's timing summary;
     design: a long combinational chain (32-bit multiply-add) vs. the same pipelined; exercise: pipeline it so the
     estimated Fmax ≥ 100 MHz (checker reads `techMap` timing estimate). Figure: setup/hold timing.
  2. `clocking` — why a divided signal must be a clock enable, not a clock; MMCM/PLL concept (not simulated: say so
     with the limits dialog link); design: one 100 MHz clock with enables at 1 kHz and 1 Hz; exercise: add a 2 Hz
     enable without a second clock.
  3. `cdc` — metastability, the two-flop synchroniser, why buttons need it; design: BTNC through 2 flops into a
     counter with the bouncy-button option on; exercise: add the synchroniser to the debouncer. Figure: metastable Q.
  4. `bram` — inferring block RAM, read-first vs. write-first, the RAMB36 in the utilization report; design: 1 K×8
     RAM written from switches and read to the display; exercise: dual-port read.
  5. `realboard` — no code: how to buy a Nexys A7 / Basys 3 / cheaper alternatives, install Vivado, use **File →
     Download Vivado project**, create a bitstream, program, and troubleshoot (board not found, wrong XDC, timing
     fails). Exercise: none; quiz: 3 questions. Marks done when opened and quiz passed.
- Update the README feature list and the lesson count on the landing page (it is computed; verify it says 32).

### 4.4 Guided project track

- New chapter `projects` (fa «پروژه‌ها» en "Projects") listed on the landing page as its own section (fa «پروژه‌های
  راهنمایی‌شده» en "Guided projects") with a separate progress line «۰ از ۳ پروژه»; projects are **not** counted in
  the course lesson total or `isDone` progress.
- Implement **Project 1 fully** (`proj-clock`): a digital clock HH:MM:SS on the 8-digit display with set buttons.
  Lesson body = brief + 4 milestones with checkboxes (store `ms:<id>` bitmask): (1) 1 Hz tick from a prescaler,
  (2) seconds/minutes/hours counters with wrap, (3) multiplexed 6-digit display, (4) debounced BTNU/BTND to set
  minutes. Starter code with `TODO` markers in both languages; final checker (`DIV` parameter small) verifies the
  wraps and the set buttons; hints and solutions per Phase 2.
- Projects 2 (`proj-terminal`: UART echo with a 3-command parser) and 3 (`proj-pong`: VGA bouncing ball) are listed
  through the chapter's existing `soon` field.

### 4.5 Progress export/import and certificate

- Landing page, under the lessons progress bar: *Export progress* (fa «خروجی گرفتن از پیشرفت») downloads
  `fpgalab-progress.json` = all `localStorage` keys with the `fpgalab:` prefix; *Import* (fa «بارگذاری پیشرفت») reads
  a file, validates the shape (`{ version: 1, keys: Record<string,string> }`), merges (union of `solved`, `seen`,
  `quiz:*`; newer `src:*` wins by a `savedAt` timestamp you add when writing editor text), then reloads the page.
- When all course lessons are done: a *Certificate* button (fa «گواهی») opens a dialog asking for a display name,
  then renders an SVG certificate (logo, name, "completed the FPGA Lab course: 32 lessons, Verilog and VHDL", date,
  site URL, a short hash of name+date for a visual seal) and offers *Download SVG* and *Download PNG* (draw the SVG
  on a canvas). No backend; state it in the dialog: fa «این گواهی خودتأییدی است و فقط در مرورگر شما ساخته می‌شود.»
  en "This certificate is self-attested and generated in your browser."

### 4.6 Privacy-friendly analytics (optional, off by default)

- If `VITE_CF_BEACON` is set at build time, inject the Cloudflare Web Analytics beacon script in `index.html` (via
  a Vite `transformIndexHtml` plugin); otherwise inject nothing. Document in README. No cookies, no other vendors.

### Acceptance checklist — Phase 4

- [ ] `/fa/lesson/counter` and `/en/lesson/counter` load directly (deep link) in dev and in the Worker; legacy
      `#lesson/counter` redirects; language switch rewrites the URL; back/forward work.
- [ ] `dist/` contains prerendered pages for every lesson in both languages, `sitemap.xml`, `robots.txt`; `curl`
      of a lesson page shows its title, description and body without JavaScript.
- [ ] Ctrl+K search finds «دیباونس» and "debounce" and opens the lesson; glossary page lists ≥ 45 terms; term tooltips work by keyboard.
- [ ] Chapter 8's five lessons compile in both languages, have quizzes/exercises/hints/solutions, and appear in progress.
- [ ] Project 1 is playable end to end; projects 2–3 show as coming soon.
- [ ] Export → clear site data → import restores progress and edited code; certificate downloads as SVG and PNG.
- [ ] `npm test`, `npm run build` green; README updated; deploy to Cloudflare verified on a preview.

---

## Phase 5 candidates (not planned in detail)

Accounts with GitHub/email sign-in and cloud progress sync (Cloudflare D1), an instructor dashboard (class codes,
who solved what, view a student's code), simulator-generated animations/GIFs for timing-heavy concepts, community
Q&A per lesson, a second board (Basys 3) using the existing board plug-in interface, and SystemVerilog basics.
