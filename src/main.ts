import './style.css';
import { BOARDS, getBoard } from './boards';
import { mapPorts, type Mapping } from './boards/mapping';
import { estimateUtilization, HdlError, synthesize, type Design, type Lang } from './hdl';
import { EN, LESSON_UI, type LessonText } from './lessons/en';
import { ALL_LESSONS, CHAPTERS, chapterOf } from './lessons/course';
import { LESSONS, PLAYGROUND, type Lesson } from './lessons/lessons';
import { Runner } from './sim/runner';
import { CodeEditor } from './ui/editor';
import { highlight } from './ui/highlight';

// ---------------------------------------------------------------- storage
const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem('fpgalab:' + k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem('fpgalab:' + k, v);
    } catch {
      /* private mode */
    }
  },
  del(k: string) {
    try {
      localStorage.removeItem('fpgalab:' + k);
    } catch {
      /* ignore */
    }
  },
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

// ---------------------------------------------------------------- board
const boardDef = getBoard(store.get('board'));
const xdcName = `${boardDef.id}.xdc`;
const hwDev = `${boardDef.part.replace(/csg.*|cpg.*|ftg.*|fgg.*/, '')}_0`;
const clockLabel = boardDef.clockHz >= 1e6 ? `${boardDef.clockHz / 1e6} MHz` : `${boardDef.clockHz / 1e3} kHz`;

// ---------------------------------------------------------------- layout
const app = $('#app');
app.innerHTML = `
<header class="titlebar">
  <div class="brand"><span class="logo"></span><b>FPGA Lab</b><span class="dim">— a Vivado-style learning environment</span></div>
  <div class="project">Board: <b>${boardDef.vendor} ${boardDef.name}</b> · Part: <b>${boardDef.part}</b></div>
</header>
<nav class="menubar">
  <div class="menu"><button>File</button><div class="dropdown">
    <button data-act="playground">Open Playground</button>
    <button data-act="reset-code">Reset lesson code</button>
    <hr/>
    <button data-act="download-src">Download design source</button>
    <button data-act="download-xdc">Download constraints (.xdc)</button>
  </div></div>
  <div class="menu"><button>Flow</button><div class="dropdown">
    <button data-act="synth">Run Synthesis</button>
    <button data-act="impl">Run Implementation</button>
    <button data-act="run">Generate Bitstream &amp; Program Device <kbd>Ctrl+Enter</kbd></button>
    <hr/>
    <button data-act="stop">Close Hardware Target</button>
  </div></div>
  <div class="menu"><button>View</button><div class="dropdown">
    <button data-act="view-reset">Board: perspective view</button>
    <button data-act="view-top">Board: top view</button>
    <button data-act="toggle-flow">Toggle Flow Navigator</button>
  </div></div>
  <div class="menu"><button>Help</button><div class="dropdown">
    <button data-act="about">About FPGA Lab</button>
    <button data-act="lesson-intro">Getting started</button>
  </div></div>
</nav>
<div class="toolbar">
  <button class="tb run" data-act="run" title="Synthesize, implement and program the board (Ctrl+Enter)"><span class="ico">▶</span> Run on Board</button>
  <button class="tb" data-act="stop" title="Stop"><span class="ico stop">■</span> Stop</button>
  <button class="tb" data-act="reset" title="Reset the design (like re-programming)"><span class="ico">↺</span> Reset</button>
  <span class="sep"></span>
  <div class="seg-ctl" role="group" aria-label="Site language">
    <button data-ui="fa">فارسی</button><button data-ui="en">English</button>
  </div>
  <span class="sep"></span>
  <div class="seg-ctl" role="group" aria-label="HDL language">
    <button data-lang="verilog">Verilog</button><button data-lang="vhdl">VHDL</button>
  </div>
  <span class="sep"></span>
  <label class="clock">Clock <select id="speed">
    <option value="${boardDef.clockHz}">${clockLabel} (real time)</option>
    <option value="1000000">1 MHz</option>
    <option value="10000">10 kHz</option>
    <option value="100">100 Hz</option>
    <option value="10">10 Hz</option>
    <option value="1">1 Hz</option>
  </select></label>
  <label class="bouncy" title="Simulate mechanical contact bounce on the push buttons"><input type="checkbox" id="bouncy"> <span id="bouncy-l"></span></label>
  <span class="grow"></span>
  <span class="run-state" id="run-state">Ready</span>
</div>
<main class="workspace">
  <aside class="flow" id="flow">
    <div class="flow-title">FLOW NAVIGATOR</div>
    <div class="flow-sec">
      <div class="sec-h" id="learn-h">▾ LEARN</div>
      <div id="lesson-list"></div>
    </div>
    <div class="flow-sec">
      <div class="sec-h">▾ PROJECT MANAGER</div>
      <button class="flow-item" data-act="tab-source">Design Sources</button>
      <button class="flow-item" data-act="tab-xdc">Constraints</button>
    </div>
    <div class="flow-sec">
      <div class="sec-h">▾ SIMULATION</div>
      <button class="flow-item" data-act="run">Run Simulation on Board</button>
    </div>
    <div class="flow-sec">
      <div class="sec-h">▾ RTL ANALYSIS</div>
      <button class="flow-item" data-act="elab">Open Elaborated Design</button>
    </div>
    <div class="flow-sec">
      <div class="sec-h">▾ SYNTHESIS</div>
      <button class="flow-item" data-act="synth">Run Synthesis</button>
    </div>
    <div class="flow-sec">
      <div class="sec-h">▾ IMPLEMENTATION</div>
      <button class="flow-item" data-act="impl">Run Implementation</button>
    </div>
    <div class="flow-sec">
      <div class="sec-h">▾ PROGRAM AND DEBUG</div>
      <button class="flow-item" data-act="run">Generate Bitstream</button>
      <button class="flow-item" data-act="run">Program Device</button>
    </div>
  </aside>
  <section class="pane left" id="left">
    <div class="tabs" id="doc-tabs">
      <button data-tab="lesson" class="active">📘 Lesson</button>
      <button data-tab="source"><span id="src-name">top.v</span></button>
      <button data-tab="xdc">${xdcName}</button>
    </div>
    <div class="tab-body">
      <article class="lesson" id="lesson"></article>
      <div class="editor-host hidden" id="src-editor"></div>
      <div class="editor-host hidden" id="xdc-editor"></div>
    </div>
  </section>
  <div class="splitter v" id="split-v" title="Drag to resize"></div>
  <section class="pane right">
    <div class="hw-title">
      <span><b>HARDWARE MANAGER</b> — localhost/xilinx_tcf/Digilent/210292A</span>
      <span class="hw-dev" id="hw-dev">${hwDev} (not programmed)</span>
    </div>
    <div class="board-host" id="board">
      <div class="board-tools">
        <button data-act="view-reset" title="Perspective view">⟲ 3D</button>
        <button data-act="view-top" title="Top view">⊤ Top</button>
      </div>
      <div class="board-hint">Click the switches and buttons · drag to rotate · scroll to zoom</div>
    </div>
  </section>
</main>
<div class="splitter h" id="split-h" title="Drag to resize"></div>
<section class="bottom" id="bottom">
  <div class="tabs small" id="bottom-tabs">
    <button data-btab="console" class="active">Tcl Console</button>
    <button data-btab="messages">Messages <span class="badge" id="msg-badge"></span></button>
    <button data-btab="reports">Reports</button>
  </div>
  <div class="bottom-body">
    <div class="console" id="console"><div class="log" id="log"></div>
      <form class="tcl-in" id="tcl-form"><span>Tcl&gt;</span><input id="tcl" autocomplete="off" spellcheck="false" placeholder="type help"/></form>
    </div>
    <div class="messages hidden" id="messages"></div>
    <div class="reports hidden" id="reports"><p class="dim">Run synthesis to see the utilization report.</p></div>
  </div>
</section>
<footer class="statusbar">
  <span id="st-design">No design loaded</span>
  <span id="st-speed"></span>
  <span id="st-cycles"></span>
</footer>
<dialog id="about"><form method="dialog">
  <h2>FPGA Lab</h2>
  <p>An in-browser FPGA course with a Vivado-inspired workflow and simulated FPGA boards (currently: ${BOARDS.map((b) => `${b.vendor} ${b.name}`).join(', ')}).</p>
  <p>Real Vivado cannot run in a browser. Instead, your Verilog/VHDL is parsed, elaborated and compiled to a fast cycle-accurate
  JavaScript model that drives the 3D board, following your XDC pin constraints. The same code and XDC work in real Vivado.</p>
  <p class="dim">Educational replica. Not affiliated with AMD/Xilinx or Digilent.</p>
  <button>Close</button>
</form></dialog>
`;

// ---------------------------------------------------------------- state
let lang: Lang = store.get('lang') === 'vhdl' ? 'vhdl' : 'verilog';
let lesson: Lesson = ALL_LESSONS.find((l) => l.id === store.get('lesson')) ?? LESSONS[0];
let tab: 'lesson' | 'source' | 'xdc' = 'lesson';
type UiLang = 'fa' | 'en';
let uiLang: UiLang = store.get('ui-lang') === 'en' ? 'en' : 'fa';
// lesson text in the selected site language (Persian lives in lessons.ts, English in en.ts)
const text = (l: Lesson): LessonText => (uiLang === 'en' && EN[l.id] ? EN[l.id] : l);

const srcKey = (l: Lesson, lg: Lang) => `src:${l.id}:${lg}`;
const xdcKey = (l: Lesson) => `xdc:${boardDef.id}:${l.id}`;
const sourceFor = (l: Lesson, lg: Lang) => store.get(srcKey(l, lg)) ?? (lg === 'verilog' ? l.verilog : l.vhdl);
const xdcFor = (l: Lesson) => store.get(xdcKey(l)) ?? boardDef.masterXdc(l.xdc);
const fileName = () => (lang === 'verilog' ? 'top.v' : 'top.vhd');

const srcEditor = new CodeEditor($('#src-editor'), lang, sourceFor(lesson, lang));
const xdcEditor = new CodeEditor($('#xdc-editor'), 'xdc', xdcFor(lesson));
let saveTimer = 0;
srcEditor.onChange = (t) => {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => store.set(srcKey(lesson, lang), t), 300);
};
xdcEditor.onChange = (t) => {
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => store.set(xdcKey(lesson), t), 300);
};

const board = boardDef.createView($('#board'));
const runner = new Runner(boardDef);
runner.speedHz = boardDef.clockHz;
(window as unknown as { fpgaLab: unknown }).fpgaLab = { board, runner };

// ---------------------------------------------------------------- console / messages
type Level = 'info' | 'warning' | 'error' | 'cmd' | 'ok' | 'plain';
interface Msg {
  level: 'info' | 'warning' | 'error';
  code: string;
  text: string;
  file?: 'src' | 'xdc';
  line?: number;
  col?: number;
}
let messages: Msg[] = [];
const logEl = $('#log');

function log(text: string, level: Level = 'plain') {
  const d = document.createElement('div');
  d.className = 'l-' + level;
  d.textContent = text;
  logEl.appendChild(d);
  while (logEl.childElementCount > 600) logEl.firstElementChild!.remove();
  logEl.scrollTop = logEl.scrollHeight;
}

function msg(m: Msg) {
  messages.push(m);
  const loc = m.line ? ` [${m.file === 'xdc' ? xdcName : fileName()}:${m.line}]` : '';
  log(`${m.level.toUpperCase()}: [${m.code}] ${m.text}${loc}`, m.level);
}

function renderMessages() {
  const el = $('#messages');
  const counts = { error: 0, warning: 0, info: 0 };
  messages.forEach((m) => counts[m.level]++);
  const badge = $('#msg-badge');
  badge.textContent = counts.error ? `${counts.error}` : counts.warning ? `${counts.warning}` : '';
  badge.className = 'badge ' + (counts.error ? 'err' : counts.warning ? 'warn' : '');
  if (!messages.length) {
    el.innerHTML = '<p class="dim">No messages.</p>';
    return;
  }
  el.innerHTML = `<div class="msg-sum">Errors: <b>${counts.error}</b> · Warnings: <b>${counts.warning}</b> · Info: <b>${counts.info}</b></div>` +
    messages
      .map(
        (m, i) =>
          `<div class="msg ${m.level}" data-i="${i}"><span class="mi">${m.level === 'error' ? '⛔' : m.level === 'warning' ? '⚠️' : 'ℹ️'}</span><span>[${esc(m.code)}] ${esc(m.text)}${
            m.line ? ` <a href="#" class="loc">${m.file === 'xdc' ? xdcName : fileName()}:${m.line}</a>` : ''
          }</span></div>`,
      )
      .join('');
}

$('#messages').addEventListener('click', (ev) => {
  const t = (ev.target as HTMLElement).closest('.msg') as HTMLElement | null;
  if (!t) return;
  ev.preventDefault();
  const m = messages[Number(t.dataset.i)];
  if (!m?.line) return;
  showTab(m.file === 'xdc' ? 'xdc' : 'source');
  (m.file === 'xdc' ? xdcEditor : srcEditor).goto(m.line);
});

// ---------------------------------------------------------------- flow
let lastDesign: Design | null = null;

function stamp() {
  return new Date().toLocaleTimeString([], { hour12: false });
}

function doSynth(): Design | null {
  messages = [];
  srcEditor.clearMarks();
  xdcEditor.clearMarks();
  log(`# launch_runs synth_1 -jobs 8   (${stamp()})`, 'cmd');
  log(`INFO: [Synth 8-7079] Multithreading enabled for synth_design`, 'info');
  try {
    const d = synthesize(srcEditor.text, lang);
    for (const m of d.modules) log(`INFO: [Synth 8-6157] synthesizing module '${m}'`, 'info');
    for (const w of d.warnings) msg({ level: 'warning', code: 'Synth 8-324', text: w.msg, file: 'src', line: w.loc?.line });
    for (const m of [...d.modules].reverse()) log(`INFO: [Synth 8-6155] done synthesizing module '${m}'`, 'info');
    const u = estimateUtilization(d);
    log(`Finished RTL Optimization : top = '${d.top}', ${u.ffs} registers, ~${u.luts} LUTs`, 'plain');
    log(`synth_design completed successfully`, 'ok');
    lastDesign = d;
    renderReports(d, null);
    $('#st-design').textContent = `Top: ${d.top} (${lang === 'verilog' ? 'Verilog' : 'VHDL'})`;
    return d;
  } catch (e) {
    if (!(e instanceof HdlError)) console.error(e);
    const he = e as HdlError;
    msg({ level: 'error', code: he.code ?? 'Synth 8-2715', text: he.message, file: 'src', line: he.loc?.line, col: he.loc?.col });
    srcEditor.markError(he.loc?.line, he.loc?.col, he.message);
    log(`ERROR: [Common 17-69] Command failed: Synthesis failed`, 'error');
    log(`synth_design failed`, 'error');
    showTab('source');
    lastDesign = null;
    return null;
  } finally {
    renderMessages();
  }
}

function doImpl(d: Design): Mapping | null {
  log(`# launch_runs impl_1   (${stamp()})`, 'cmd');
  log(`INFO: [Vivado 12-3482] Parsing XDC File [${xdcName}]`, 'info');
  const map = mapPorts(d, xdcEditor.text, boardDef);
  const unmatched = map.messages.filter((m) => m.code === 'Vivado 12-507');
  const other = map.messages.filter((m) => m.code !== 'Vivado 12-507');
  for (const m of other) msg({ level: m.level, code: m.code, text: m.msg, file: 'xdc', line: m.line });
  if (unmatched.length) {
    msg({
      level: 'warning',
      code: 'Vivado 12-507',
      text: `${unmatched.length} constraint(s) matched no port in the design (e.g. ${unmatched
        .slice(0, 3)
        .map((m) => m.msg.match(/'(.+?)'/)?.[1])
        .join(', ')}). Unused board pins are left unconnected.`,
      file: 'xdc',
      line: unmatched[0].line,
    });
  }
  renderMessages();
  if (map.messages.some((m) => m.level === 'error')) {
    log('ERROR: [Place 30-68] Implementation failed: I/O placement errors', 'error');
    showBottom('messages');
    return null;
  }
  log(`INFO: [Place 30-611] Placed ${map.bindings.length} I/O bit(s) on package pins`, 'info');
  if (map.clock !== undefined) log(`INFO: [Timing 38-35] Clock 'sys_clk_pin' on '${d.sigs[map.clock].name}': period 10.000 ns (100 MHz)`, 'info');
  log(`route_design completed successfully`, 'ok');
  renderReports(d, map);
  return map;
}

function doProgram(d: Design, map: Mapping) {
  log(`# write_bitstream -force ${d.top}.bit`, 'cmd');
  log(`INFO: [Common 17-83] Bitstream generated: ${d.top}.bit (simulated)`, 'info');
  log(`# program_hw_devices [get_hw_devices ${hwDev}]`, 'cmd');
  try {
    runner.program(d, map, { switches: board.switches, pressed: (b) => board.isPressed(b) });
  } catch (e) {
    const he = e as HdlError;
    msg({ level: 'error', code: he.code ?? 'Synth 8-2715', text: he.message, file: 'src', line: he.loc?.line });
    renderMessages();
    showBottom('messages');
    log('ERROR: programming failed', 'error');
    return;
  }
  log(`INFO: [Labtools 27-3164] End of startup status: HIGH — device is running`, 'ok');
  $('#hw-dev').textContent = `${hwDev} (Programmed)`;
  $('#hw-dev').classList.add('ok');
  setRunState();
}

function runFlow() {
  const d = doSynth();
  if (!d) {
    showBottom('messages');
    return;
  }
  const map = doImpl(d);
  if (!map) return;
  doProgram(d, map);
  if (messages.some((m) => m.level === 'warning')) showBottom('messages');
}

function stop() {
  runner.stop();
  board.setOutputs({ led: [], rgb: [], seg: [], done: false });
  $('#hw-dev').textContent = `${hwDev} (not programmed)`;
  $('#hw-dev').classList.remove('ok');
  log('# close_hw_target', 'cmd');
  setRunState();
}

runner.onError = (m) => {
  msg({ level: 'error', code: 'Simulation 43-3', text: m });
  renderMessages();
  showBottom('messages');
  setRunState();
};

function setRunState() {
  const el = $('#run-state');
  if (runner.error) {
    el.textContent = 'Error';
    el.className = 'run-state err';
  } else if (runner.running) {
    el.textContent = `● Running ${runner.design?.top ?? ''}`;
    el.className = 'run-state on';
  } else {
    el.textContent = 'Ready';
    el.className = 'run-state';
  }
}

// ---------------------------------------------------------------- reports
function renderReports(d: Design, map: Mapping | null) {
  const u = estimateUtilization(d);
  const row = (n: string, used: number, avail: number) =>
    `<tr><td>${n}</td><td>${used}</td><td>${avail.toLocaleString()}</td><td>${((used / avail) * 100).toFixed(2)}</td></tr>`;
  let html = `<h4>Utilization — ${esc(d.top)} (estimate)</h4>
<table class="rep"><thead><tr><th>Site Type</th><th>Used</th><th>Available</th><th>Util%</th></tr></thead><tbody>
${row('Slice LUTs', u.luts, boardDef.resources.luts)}${row('Slice Registers (FF)', u.ffs, boardDef.resources.ffs)}${row('Bonded IOB', u.io, boardDef.resources.iob)}${row('Block RAM Tile', u.bram, boardDef.resources.bram)}
</tbody></table>
<h4>Design hierarchy</h4><ul class="hier">${d.modules.map((m, i) => `<li style="padding-left:${i ? 16 : 0}px">${i ? '└ ' : ''}${esc(m)}</li>`).join('')}</ul>`;
  if (map) {
    html += `<h4>I/O placement</h4><table class="rep"><thead><tr><th>Port</th><th>Package pin</th><th>Board device</th></tr></thead><tbody>${map.bindings
      .map((b) => {
        const s = d.sigs[b.sig];
        const nm = s.width > 1 ? `${b.port}[${s.left >= s.right ? b.bit + s.right : s.right - b.bit}]` : b.port;
        const dev = b.device;
        const dn =
          dev.kind === 'sw' ? `SW${dev.index}` : dev.kind === 'led' ? `LD${dev.index}` : dev.kind === 'an' ? `AN${dev.index}` : dev.kind === 'seg' ? `C${dev.seg.toUpperCase()}` : dev.kind === 'btn' ? dev.name : dev.kind === 'rgb' ? `${boardDef.io.rgb[dev.index]} ${dev.color.toUpperCase()}` : dev.kind === 'clk' ? `${clockLabel} oscillator` : dev.name;
        return `<tr><td>${esc(nm)}</td><td>${b.pin}</td><td>${dn}</td></tr>`;
      })
      .join('')}</tbody></table>`;
  }
  $('#reports').innerHTML = html;
}

// ---------------------------------------------------------------- lessons UI
function renderLessonList() {
  const el = $('#lesson-list');
  const dir = uiLang === 'fa' ? 'rtl' : 'ltr';
  const ui = LESSON_UI[uiLang];
  let n = 0;
  el.innerHTML = CHAPTERS.map((c, ci) => {
    const items = c.lessons.map((l) => {
      const num = l === PLAYGROUND ? '★' : String(++n);
      return `<button class="flow-item lesson-item ${l.id === lesson.id ? 'active' : ''}" data-lesson="${l.id}" dir="${dir}"><span class="num">${num}</span>${esc(text(l).title)}</button>`;
    });
    const soon = (c.soon ?? []).map((s) => `<div class="flow-item lesson-item soon" dir="${dir}"><span class="num">·</span><span>${esc(s[uiLang])} <em>(${ui.soon})</em></span></div>`);
    const head = l10nChapter(ci);
    return `<div class="chapter-h" dir="${dir}">${esc(head)}</div>${items.join('')}${soon.join('')}`;
  }).join('');
}

function l10nChapter(ci: number) {
  const c = CHAPTERS[ci];
  return c.lessons.includes(PLAYGROUND) ? c.title[uiLang] : `${LESSON_UI[uiLang].chapter(ci + 1)}: ${c.title[uiLang]}`;
}

function codeBlock(code: string, lg: 'verilog' | 'vhdl') {
  return `<pre class="code" dir="ltr"><code>${highlight(code, lg)}</code></pre>`;
}

function renderLesson() {
  const idx = ALL_LESSONS.indexOf(lesson);
  const prev = ALL_LESSONS[idx - 1];
  const next = ALL_LESSONS[idx + 1];
  const el = $('#lesson');
  const tx = text(lesson);
  const ui = LESSON_UI[uiLang];
  const rtl = uiLang === 'fa';
  el.dir = rtl ? 'rtl' : 'ltr';
  el.lang = uiLang;
  el.innerHTML = `
<div class="lesson-head"><span class="chapter">${esc(l10nChapter(chapterOf(lesson)))}</span><h1>${esc(tx.title)}</h1><p class="summary">${esc(tx.summary)}</p></div>
<section><h2>${ui.explain}</h2>${tx.body}</section>
<section><h2>${ui.code}</h2>
  <div class="code-tabs" dir="ltr">
    <button data-code="verilog" class="${lang === 'verilog' ? 'active' : ''}">Verilog</button>
    <button data-code="vhdl" class="${lang === 'vhdl' ? 'active' : ''}">VHDL</button>
    <span class="grow"></span>
    <button class="open-ed" data-act="open-editor">${ui.openEditor}</button>
  </div>
  <div class="code-panel" data-panel="verilog" ${lang === 'verilog' ? '' : 'hidden'}>${codeBlock(lesson.verilog, 'verilog')}</div>
  <div class="code-panel" data-panel="vhdl" ${lang === 'vhdl' ? '' : 'hidden'}>${codeBlock(lesson.vhdl, 'vhdl')}</div>
</section>
<section class="try"><h2>${ui.tryIt}</h2>${tx.tryIt}
  <button class="big-run" data-act="run">${ui.runOn(esc(boardDef.name))}</button>
</section>
${tx.exercise ? `<section class="exercise"><h2>${ui.exercise}</h2>${tx.exercise}<p class="dim">${ui.exerciseHint}</p></section>` : ''}
<nav class="lesson-nav">
  ${prev ? `<button data-lesson="${prev.id}">${rtl ? '→' : '←'} ${esc(text(prev).title)}</button>` : '<span></span>'}
  ${next ? `<button data-lesson="${next.id}">${esc(text(next).title)} ${rtl ? '←' : '→'}</button>` : '<span></span>'}
</nav>`;
  el.scrollTop = 0;
}

$('#lesson').addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  const codeBtn = t.closest('[data-code]') as HTMLElement | null;
  if (codeBtn) {
    const lg = codeBtn.dataset.code as Lang;
    setLang(lg);
  }
});

function openLesson(l: Lesson, switchTab = true) {
  if (runner.running) stop();
  lesson = l;
  store.set('lesson', l.id);
  srcEditor.setText(sourceFor(l, lang), lang);
  xdcEditor.setText(xdcFor(l), 'xdc');
  renderLessonList();
  renderLesson();
  if (switchTab) showTab('lesson');
  log(`# open_lesson ${l.id}`, 'cmd');
}

function setLang(lg: Lang) {
  if (lg === lang) return;
  store.set(srcKey(lesson, lang), srcEditor.text);
  lang = lg;
  store.set('lang', lg);
  srcEditor.setText(sourceFor(lesson, lang), lang);
  $('#src-name').textContent = fileName();
  document.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
  document.querySelectorAll<HTMLElement>('.code-tabs [data-code]').forEach((b) => b.classList.toggle('active', b.dataset.code === lang));
  document.querySelectorAll<HTMLElement>('.code-panel').forEach((p) => (p.hidden = p.dataset.panel !== lang));
  log(`# set_property TARGET_LANGUAGE ${lang === 'verilog' ? 'Verilog' : 'VHDL'} [current_project]`, 'cmd');
}

function setUiLang(l: UiLang) {
  uiLang = l;
  store.set('ui-lang', l);
  applyUiLang();
  renderLessonList();
  renderLesson();
}

function applyUiLang() {
  document.documentElement.lang = uiLang;
  document.querySelectorAll<HTMLElement>('[data-ui]').forEach((b) => b.classList.toggle('active', b.dataset.ui === uiLang));
  $('#learn-h').textContent = `▾ LEARN · ${LESSON_UI[uiLang].learn}`;
  $('#bouncy-l').textContent = LESSON_UI[uiLang].bouncy;
}

function showTab(t: typeof tab) {
  tab = t;
  document.querySelectorAll<HTMLElement>('#doc-tabs [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
  $('#lesson').classList.toggle('hidden', t !== 'lesson');
  $('#src-editor').classList.toggle('hidden', t !== 'source');
  $('#xdc-editor').classList.toggle('hidden', t !== 'xdc');
  if (t === 'source') srcEditor.view.requestMeasure();
  if (t === 'xdc') xdcEditor.view.requestMeasure();
}

function showBottom(t: 'console' | 'messages' | 'reports') {
  document.querySelectorAll<HTMLElement>('#bottom-tabs [data-btab]').forEach((b) => b.classList.toggle('active', b.dataset.btab === t));
  $('#console').classList.toggle('hidden', t !== 'console');
  $('#messages').classList.toggle('hidden', t !== 'messages');
  $('#reports').classList.toggle('hidden', t !== 'reports');
}

function download(name: string, text: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------------------------------------------------------------- actions
function act(name: string) {
  switch (name) {
    case 'run':
      runFlow();
      break;
    case 'stop':
      stop();
      break;
    case 'reset':
      if (runner.sim) {
        runner.reset({ switches: board.switches, pressed: (b) => board.isPressed(b) });
        log('# reset_hw_device — design restarted', 'cmd');
      }
      break;
    case 'synth': {
      const d = doSynth();
      if (d) showBottom('reports');
      else showBottom('messages');
      break;
    }
    case 'impl': {
      const d = doSynth();
      if (d && doImpl(d)) showBottom('reports');
      else showBottom('messages');
      break;
    }
    case 'elab': {
      const d = doSynth();
      if (d) {
        log(`# open elaborated design: ${d.sigs.length} nets, ${d.procs.length} processes`, 'cmd');
        showBottom('reports');
      } else showBottom('messages');
      break;
    }
    case 'tab-source':
      showTab('source');
      break;
    case 'tab-xdc':
      showTab('xdc');
      break;
    case 'open-editor':
      showTab('source');
      break;
    case 'playground':
      openLesson(PLAYGROUND);
      break;
    case 'lesson-intro':
      openLesson(LESSONS[0]);
      break;
    case 'reset-code':
      if (confirm('Reset this lesson’s code and constraints to the original version?')) {
        store.del(srcKey(lesson, lang));
        store.del(xdcKey(lesson));
        srcEditor.setText(sourceFor(lesson, lang), lang);
        xdcEditor.setText(xdcFor(lesson), 'xdc');
        log('# reset lesson sources', 'cmd');
      }
      break;
    case 'download-src':
      download(fileName(), srcEditor.text);
      break;
    case 'download-xdc':
      download(xdcName, xdcEditor.text);
      break;
    case 'view-reset':
      board.resetView();
      break;
    case 'view-top':
      board.topView();
      break;
    case 'toggle-flow':
      $('#flow').classList.toggle('collapsed');
      break;
    case 'about':
      ($('#about') as HTMLDialogElement).showModal();
      break;
  }
}

document.addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  const a = t.closest('[data-act]') as HTMLElement | null;
  if (a) {
    act(a.dataset.act!);
    (document.activeElement as HTMLElement | null)?.blur?.();
  }
  const l = t.closest('[data-lesson]') as HTMLElement | null;
  if (l) {
    const found = ALL_LESSONS.find((x) => x.id === l.dataset.lesson);
    if (found) openLesson(found);
  }
  const ui = t.closest('[data-ui]') as HTMLElement | null;
  if (ui) setUiLang(ui.dataset.ui as UiLang);
  const lg = t.closest('[data-lang]') as HTMLElement | null;
  if (lg) setLang(lg.dataset.lang as Lang);
  const tb = t.closest('[data-tab]') as HTMLElement | null;
  if (tb) showTab(tb.dataset.tab as typeof tab);
  const bt = t.closest('[data-btab]') as HTMLElement | null;
  if (bt) showBottom(bt.dataset.btab as 'console');
});

document.addEventListener('keydown', (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
    ev.preventDefault();
    runFlow();
  }
  if (ev.key === 'F5') {
    ev.preventDefault();
    runFlow();
  }
});

// contact bounce on the push buttons
const bouncy = $<HTMLInputElement>('#bouncy');
bouncy.checked = runner.bounce = store.get('bouncy') === '1';
bouncy.addEventListener('change', () => {
  runner.bounce = bouncy.checked;
  store.set('bouncy', bouncy.checked ? '1' : '0');
  log(`# set_property BOUNCE ${bouncy.checked ? 'on' : 'off'} [get_hw_buttons]`, 'cmd');
});

// speed
const speedSel = $<HTMLSelectElement>('#speed');
speedSel.value = store.get('speed') ?? String(boardDef.clockHz);
if (!speedSel.value) speedSel.value = String(boardDef.clockHz);
runner.speedHz = Number(speedSel.value);
speedSel.addEventListener('change', () => {
  runner.speedHz = Number(speedSel.value);
  store.set('speed', speedSel.value);
});

// board I/O
board.onSwitch = (i, on) => runner.setSwitch(i, on);
board.onButton = (b, down) => runner.setButton(b, down);
let statTimer = 0;
board.onFrame = (dt) => {
  const out = runner.frame(dt);
  board.setOutputs(out);
  statTimer += dt;
  if (statTimer > 0.25) {
    statTimer = 0;
    if (runner.running && runner.mapping?.clock !== undefined) {
      const hz = runner.achievedHz;
      const f = hz >= 1e6 ? `${(hz / 1e6).toFixed(1)} MHz` : hz >= 1e3 ? `${(hz / 1e3).toFixed(1)} kHz` : `${hz.toFixed(1)} Hz`;
      $('#st-speed').textContent = `Sim clock: ${f} (${((hz / boardDef.clockHz) * 100).toFixed(hz < 1e6 ? 4 : 1)}% of ${clockLabel})`;
      const t = runner.totalCycles / boardDef.clockHz;
      $('#st-cycles').textContent = `Board time: ${t < 1 ? (t * 1000).toFixed(1) + ' ms' : t.toFixed(2) + ' s'}`;
    } else if (runner.running) {
      $('#st-speed').textContent = 'Combinational design (no clock)';
      $('#st-cycles').textContent = '';
    } else {
      $('#st-speed').textContent = '';
      $('#st-cycles').textContent = '';
    }
  }
};

// Tcl console
$('#tcl-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const input = $<HTMLInputElement>('#tcl');
  const cmd = input.value.trim();
  input.value = '';
  if (!cmd) return;
  log(cmd, 'cmd');
  const [c, ...args] = cmd.split(/\s+/);
  switch (c) {
    case 'help':
      log('Commands: synth_design, place_design, launch_simulation (run), program_hw_devices, close_hw, reset, clear, set_lang verilog|vhdl, get_ports, open_lesson <n>', 'plain');
      break;
    case 'synth_design':
      act('synth');
      break;
    case 'place_design':
    case 'route_design':
      act('impl');
      break;
    case 'run':
    case 'launch_simulation':
    case 'program_hw_devices':
      act('run');
      break;
    case 'close_hw':
    case 'close_hw_target':
    case 'stop':
      act('stop');
      break;
    case 'reset':
      act('reset');
      break;
    case 'clear':
      logEl.innerHTML = '';
      break;
    case 'set_lang':
      if (args[0] === 'verilog' || args[0] === 'vhdl') setLang(args[0]);
      else log('usage: set_lang verilog|vhdl', 'error');
      break;
    case 'get_ports':
      if (!lastDesign) log('ERROR: run synth_design first', 'error');
      else log(lastDesign.ports.map((p) => `${p.name}${p.width > 1 ? `[${p.left}:${p.right}]` : ''} (${p.dir})`).join('  '), 'plain');
      break;
    case 'open_lesson': {
      const n = Number(args[0]);
      const l = ALL_LESSONS[n - 1] ?? ALL_LESSONS.find((x) => x.id === args[0]);
      if (l) openLesson(l);
      else log('usage: open_lesson <number|id>', 'error');
      break;
    }
    default:
      log(`ERROR: [Common 17-9] invalid command name "${c}". Type help.`, 'error');
  }
});

// ---------------------------------------------------------------- splitters
function dragSplit(el: HTMLElement, onMove: (dx: number, dy: number) => void) {
  el.addEventListener('pointerdown', (ev) => {
    el.setPointerCapture(ev.pointerId);
    let x = ev.clientX;
    let y = ev.clientY;
    const move = (e: PointerEvent) => {
      onMove(e.clientX - x, e.clientY - y);
      x = e.clientX;
      y = e.clientY;
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  });
}
const left = $('#left');
dragSplit($('#split-v'), (dx) => {
  const w = Math.max(280, Math.min(window.innerWidth - 400, left.getBoundingClientRect().width + dx));
  left.style.flexBasis = w + 'px';
});
const bottom = $('#bottom');
dragSplit($('#split-h'), (_dx, dy) => {
  const h = Math.max(60, Math.min(window.innerHeight * 0.6, bottom.getBoundingClientRect().height - dy));
  bottom.style.height = h + 'px';
});

// ---------------------------------------------------------------- init
document.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.classList.toggle('active', b.dataset.lang === lang));
applyUiLang();
$('#src-name').textContent = fileName();
renderLessonList();
renderLesson();
renderMessages();
log('****** FPGA Lab — Vivado-style HDL environment (browser edition)', 'plain');
log('INFO: [Labtools 27-2285] Connecting to hw_server url TCP:localhost:3121', 'info');
log('INFO: [Labtools 27-3415] Connecting to cs_server url TCP:localhost:3042', 'info');
log(`INFO: [Labtools 27-1434] Device ${hwDev} on ${boardDef.vendor} ${boardDef.name} (JTAG device index = 0) is ready. Press ▶ Run on Board to program it.`, 'info');
