// "Modules" drawer in the board area: add sensors and Pmods, choose the pins they are wired to, and play with their
// controls (temperature, distance, buttons ...). The on-board sensors are listed too, on their fixed pins.
import type { BoardDef, BoardView } from '../boards';
import type { Runner } from '../sim/runner';
import type { ModuleInst } from './bus';
import { MODULES, moduleDef, ONBOARD_MODULES, type ModuleDef } from './library';
import { keyFromCode } from './ps2codes';

const KEY_ROWS = [
  ['Esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'Backspace'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Enter'],
  ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Up'],
  ['Space', 'Left', 'Down', 'Right'],
];
const KEY_LABEL: Record<string, string> = { Backspace: '⌫', Enter: '⏎', Shift: '⇧', Up: '↑', Down: '↓', Left: '←', Right: '→', Space: 'Space', Esc: 'Esc' };

type UiLang = 'fa' | 'en';

export interface SavedModule {
  id: string;
  type: string;
  pins: Record<string, string>;
  values: Record<string, number>;
}

interface Item {
  saved: SavedModule;
  def: ModuleDef;
  inst: ModuleInst;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const L = {
  fa: {
    title: 'ماژول‌ها',
    add: '＋ افزودن ماژول',
    onboard: 'روی برد',
    remove: 'حذف',
    plug: 'وصل به هدر:',
    xdc: '＋ خطوط XDC',
    xdcDone: 'به XDC اضافه شد',
    capture: 'تایپ با صفحه‌کلید خودم',
    conflict: (pin: string, other: string) => `پایهٔ ${pin} به ${other} هم وصل است`,
    empty: 'ماژول‌های بیرونی را با «افزودن ماژول» به هدرهای Pmod وصل کنید. پایه‌ها را از فهرست انتخاب کنید و در XDC همان پایه‌ها را به پورت‌های طرح بدهید.',
  },
  en: {
    title: 'Modules',
    add: '＋ Add Module',
    onboard: 'on board',
    remove: 'Remove',
    plug: 'Plug into:',
    xdc: '＋ XDC lines',
    xdcDone: 'added to the XDC',
    capture: 'type on my own keyboard',
    conflict: (pin: string, other: string) => `pin ${pin} is also wired to ${other}`,
    empty: 'Connect external modules to the Pmod headers with “Add Module”. Pick their pins from the lists and give the same pins to your design’s ports in the XDC.',
  },
};

export class ModulePanel {
  el: HTMLElement;
  private items: Item[] = [];
  private list: HTMLElement;
  private menu: HTMLElement;
  private lastRead = 0;
  private capture: Item | null = null;
  onSave: (mods: SavedModule[]) => void = () => {};
  onXdc: (lines: string) => void = () => {};

  constructor(
    host: HTMLElement,
    private board: BoardDef,
    private runner: Runner,
    private view: BoardView,
    private lang: () => UiLang,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'mod-drawer';
    this.el.hidden = true;
    this.el.innerHTML = `<div class="mod-top"><b class="mod-t"></b><span class="grow"></span><div class="mod-addw"><button class="mod-add"></button><div class="mod-menu" hidden></div></div><button class="mod-x" title="Close">✕</button></div><div class="mod-list"></div>`;
    host.appendChild(this.el);
    this.list = this.el.querySelector('.mod-list')!;
    this.menu = this.el.querySelector('.mod-menu')!;
    this.el.querySelector('.mod-x')!.addEventListener('click', () => this.hide());
    this.el.querySelector('.mod-add')!.addEventListener('click', (e) => {
      e.stopPropagation();
      this.menu.hidden = !this.menu.hidden;
    });
    document.addEventListener('click', () => (this.menu.hidden = true));
    this.menu.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('[data-type]') as HTMLElement | null;
      if (b) this.add(b.dataset.type!);
    });
    this.wire();
  }

  get open() {
    return !this.el.hidden;
  }
  show() {
    this.el.hidden = false;
    this.render();
    // scroll to the first module the running design is wired to (the keyboard in the PS/2 lesson, ...)
    const used = new Set(this.runner.mapping?.bindings.map((b) => b.pin));
    const i = this.items.findIndex((it) => Object.values(it.saved.pins).some((p) => used.has(p)));
    const row = this.list.children[i] as HTMLElement | undefined;
    if (row) this.list.scrollTop = row.offsetTop - this.list.offsetTop;
  }
  hide() {
    this.el.hidden = true;
  }
  get count() {
    return this.items.length;
  }

  // restores the saved modules (the on-board ones are always there)
  load(saved: SavedModule[]) {
    for (const it of this.items) this.runner.bus.detach(it.inst);
    this.items = [];
    for (const d of ONBOARD_MODULES) {
      const s = saved.find((x) => x.type === d.type) ?? { id: d.type, type: d.type, pins: { ...d.onboard! }, values: {} };
      this.attach({ ...s, pins: { ...d.onboard! } });
    }
    for (const s of saved) if (!ONBOARD_MODULES.some((d) => d.type === s.type) && moduleDef(s.type)) this.attach(s);
    this.runner.modulesChanged();
    this.update3d();
    this.render();
  }

  private attach(s: SavedModule): Item | null {
    const def = moduleDef(s.type);
    if (!def) return null;
    const values = { ...defaults(def), ...s.values };
    s.values = values;
    const inst = this.runner.bus.attach({
      pins: s.pins,
      io: Object.fromEntries(def.roles.map((r) => [r.role, r.io])),
      timed: def.timed,
      create: (ctx) => def.create(ctx, values),
    });
    inst.reset?.();
    const it = { saved: s, def, inst };
    this.items.push(it);
    return it;
  }

  private add(type: string) {
    const def = moduleDef(type)!;
    const used = new Set(this.items.flatMap((i) => Object.values(i.saved.pins)));
    // first header with all the pins it needs still free
    const order = [1, 2, 3, 4, 7, 8, 9, 10];
    let pins: Record<string, string> | null = null;
    for (const h of this.board.headers) {
      const cand = def.roles.map((_, i) => h.pins[order[i]]);
      if (cand.every((p) => p && !used.has(p))) {
        pins = Object.fromEntries(def.roles.map((r, i) => [r.role, cand[i]]));
        break;
      }
    }
    pins ??= Object.fromEntries(def.roles.map((r, i) => [r.role, this.board.headers[0].pins[order[i]]]));
    const id = `${type}-${Date.now().toString(36)}`;
    this.attach({ id, type, pins, values: {} });
    this.changed();
  }

  private remove(id: string) {
    const it = this.items.find((i) => i.saved.id === id);
    if (!it || it.def.onboard) return;
    this.runner.bus.detach(it.inst);
    this.items = this.items.filter((i) => i !== it);
    this.changed();
  }

  private setPin(id: string, role: string, pin: string) {
    const it = this.items.find((i) => i.saved.id === id);
    if (!it) return;
    it.saved.pins = { ...it.saved.pins, [role]: pin };
    this.reattach(it);
  }

  private plug(id: string, header: number) {
    const it = this.items.find((i) => i.saved.id === id);
    if (!it) return;
    const order = [1, 2, 3, 4, 7, 8, 9, 10];
    it.saved.pins = Object.fromEntries(it.def.roles.map((r, i) => [r.role, this.board.headers[header].pins[order[i]]]));
    this.reattach(it);
  }

  private reattach(it: Item) {
    const idx = this.items.indexOf(it);
    this.runner.bus.detach(it.inst);
    this.items.splice(idx, 1);
    const n = this.attach(it.saved);
    if (n) {
      this.items.pop();
      this.items.splice(idx, 0, n); // keep the list order
    }
    this.changed();
  }

  private changed() {
    this.runner.modulesChanged();
    this.onSave(this.items.map((i) => i.saved));
    this.update3d();
    this.render();
  }

  private update3d() {
    this.view.setModules?.(this.items.filter((i) => !i.def.onboard).map((i) => ({ label: i.def.name, color: i.def.color, pins: Object.values(i.saved.pins), pmod: !!i.def.pmod })));
  }

  private pinLabel(pin: string): string {
    for (const h of this.board.headers) for (const [n, p] of Object.entries(h.pins)) if (p === pin) return `${h.name}${n}`;
    const d = this.board.pins[pin];
    return d && 'name' in d ? d.name : pin;
  }

  private xdcLines(it: Item): string {
    const taken = new Map<string, number>();
    return (
      `## ${it.def.name}\n` +
      it.def.roles
        .map((r) => {
          const base = (r.label ?? r.role).toUpperCase();
          const n = (taken.get(base) ?? 0) + 1;
          taken.set(base, n);
          const same = this.items.filter((x) => x.def === it.def);
          const name = same.length > 1 && !it.def.onboard ? `${base}_${same.indexOf(it) + 1}` : base;
          const pin = it.saved.pins[r.role];
          return `set_property -dict { PACKAGE_PIN ${pin}   IOSTANDARD LVCMOS33 } [get_ports { ${name} }]; # ${it.def.name} ${r.label ?? r.role} on ${this.pinLabel(pin)}`;
        })
        .join('\n')
    );
  }

  render() {
    const ui = L[this.lang()];
    const lg = this.lang();
    this.el.dir = lg === 'fa' ? 'rtl' : 'ltr';
    this.el.querySelector('.mod-t')!.textContent = ui.title;
    this.el.querySelector('.mod-add')!.textContent = ui.add;
    this.menu.innerHTML = MODULES.filter((d) => !d.onboard)
      .map((d) => `<button data-type="${d.type}"><span class="dot" style="background:${d.color}"></span><b>${esc(d.name)}</b> <span class="dim">${esc(d.title[lg])}</span></button>`)
      .join('');
    if (!this.open) return;
    const all = this.board.headers.flatMap((h) => Object.entries(h.pins).map(([n, p]) => ({ label: `${h.name}${n}`, pin: p })));
    const users = new Map<string, Item[]>();
    for (const it of this.items) for (const p of Object.values(it.saved.pins)) users.set(p, [...(users.get(p) ?? []), it]);
    const external = this.items.filter((i) => !i.def.onboard).length;
    this.list.innerHTML =
      this.items
        .map((it) => {
          const d = it.def;
          const s = it.saved;
          const pins = d.roles
            .map((r) => {
              const pin = s.pins[r.role];
              const others = (users.get(pin) ?? []).filter((x) => x !== it && !(r.io === 'od' && x.def.roles.some((q) => q.io === 'od' && x.saved.pins[q.role] === pin)));
              const warn = others.length ? `<div class="mod-warn">⚠ ${esc(ui.conflict(this.pinLabel(pin), others.map((o) => o.def.name).join(', ')))}</div>` : '';
              const field = d.onboard
                ? `<code>${pin}</code>`
                : `<select data-role="${r.role}">${all.map((o) => `<option value="${o.pin}" ${o.pin === pin ? 'selected' : ''}>${o.label} (${o.pin})</option>`).join('')}</select>`;
              return `<div class="mod-pin"><span class="role">${esc(r.label ?? r.role)} <span class="io">${r.io === 'in' ? '→ FPGA' : r.io === 'out' ? 'FPGA →' : '⇄'}</span></span>${field}</div>${warn}`;
            })
            .join('');
          const plug =
            !d.onboard && d.pmod
              ? `<div class="mod-plug">${ui.plug} ${this.board.headers.map((h, i) => `<button data-plug="${i}">${h.name}</button>`).join('')}</div>`
              : '';
          const ctl = d.controls
            .map((c) => {
              switch (c.kind) {
                case 'slider':
                  return `<label class="mod-slider"><span>${esc(c.label[lg])}</span><input type="range" data-key="${c.key}" min="${c.min}" max="${c.max}" step="${c.step}" value="${s.values[c.key] ?? c.def}"><output>${fmt(s.values[c.key] ?? c.def)} ${c.unit}</output></label>`;
                case 'button':
                  return `<button class="mod-btn" data-press="${c.key}">${esc(c.label)}</button>`;
                case 'toggle':
                  return `<label class="mod-toggle"><input type="checkbox" data-toggle="${c.key}" ${s.values[c.key] ? 'checked' : ''}> ${esc(c.label)}</label>`;
                case 'leds':
                  return `<div class="mod-leds" data-leds="${c.key}">${Array.from({ length: c.n }, (_, i) => `<span title="LD${i}"></span>`).join('')}</div>`;
                case 'readout':
                  return `<div class="mod-read"><span>${esc(c.label[lg])}:</span> <b data-read="${c.key}">…</b></div>`;
                case 'keys':
                  return `<div class="mod-keys">${KEY_ROWS.map((row) => `<div>${row.map((k) => `<button class="mod-key${k.length > 1 ? ' wide' : ''}" data-press="${c.key}:${k}">${KEY_LABEL[k] ?? k}</button>`).join('')}</div>`).join('')}</div><label class="mod-toggle"><input type="checkbox" data-capture ${this.capture === it ? 'checked' : ''}> ⌨ ${esc(ui.capture)}</label>`;
              }
            })
            .join('');
          return `<div class="mod-card" data-id="${s.id}">
  <div class="mod-h"><span class="dot" style="background:${d.color}"></span><b>${esc(d.name)}</b>${d.onboard ? `<span class="mod-badge">${ui.onboard}</span>` : ''}<span class="grow"></span>${d.onboard ? '' : `<button class="mod-rm" title="${ui.remove}">✕</button>`}</div>
  <div class="mod-desc">${d.desc[lg]}</div>
  ${plug}<div class="mod-pins">${pins}</div>
  <div class="mod-ctls">${ctl}</div>
  <button class="mod-xdc">${ui.xdc}</button>
</div>`;
        })
        .join('') + (external ? '' : `<p class="mod-empty">${esc(ui.empty)}</p>`);
    this.frame(true);
  }

  private wire() {
    const card = (e: Event) => {
      const c = (e.target as HTMLElement).closest('.mod-card') as HTMLElement | null;
      return c ? this.items.find((i) => i.saved.id === c.dataset.id) : undefined;
    };
    this.list.addEventListener('change', (e) => {
      const t = e.target as HTMLInputElement;
      const it = card(e);
      if (!it) return;
      if (t.dataset.role) this.setPin(it.saved.id, t.dataset.role, t.value);
      if (t.dataset.toggle) this.control(it, t.dataset.toggle, t.checked ? 1 : 0);
      if (t.hasAttribute('data-capture')) this.capture = t.checked ? it : null;
    });
    // "use my keyboard": keys typed anywhere outside the editors go to the PS/2 keyboard
    const onKey = (e: KeyboardEvent, v: number) => {
      const it = this.capture;
      if (!it || !this.items.includes(it) || e.repeat) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"], .cm-editor')) return;
      const k = keyFromCode(e.code);
      if (!k) return;
      e.preventDefault();
      this.control(it, `k:${k}`, v, false);
    };
    window.addEventListener('keydown', (e) => onKey(e, 1));
    window.addEventListener('keyup', (e) => onKey(e, 0));
    this.list.addEventListener('input', (e) => {
      const t = e.target as HTMLInputElement;
      const it = card(e);
      if (!it || !t.dataset.key) return;
      const c = it.def.controls.find((x) => x.kind === 'slider' && x.key === t.dataset.key) as { unit: string } | undefined;
      (t.nextElementSibling as HTMLOutputElement).textContent = `${fmt(+t.value)} ${c?.unit ?? ''}`;
      this.control(it, t.dataset.key, +t.value);
    });
    this.list.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const it = card(e);
      if (!it) return;
      if (t.closest('.mod-rm')) this.remove(it.saved.id);
      const plug = t.closest('[data-plug]') as HTMLElement | null;
      if (plug) this.plug(it.saved.id, +plug.dataset.plug!);
      if (t.closest('.mod-xdc')) {
        this.onXdc(this.xdcLines(it));
        const b = t.closest('.mod-xdc') as HTMLElement;
        b.textContent = `✓ ${L[this.lang()].xdcDone}`;
      }
    });
    const press = (e: PointerEvent, v: number) => {
      const b = (e.target as HTMLElement).closest('[data-press]') as HTMLElement | null;
      const it = card(e);
      if (!b || !it) return;
      b.classList.toggle('down', !!v);
      this.control(it, b.dataset.press!, v, false);
    };
    this.list.addEventListener('pointerdown', (e) => press(e, 1));
    this.list.addEventListener('pointerup', (e) => press(e, 0));
    this.list.addEventListener('pointerleave', (e) => press(e, 0), true);
  }

  private control(it: Item, key: string, v: number, save = true) {
    this.runner.bus.now = this.runner.now;
    it.inst.set?.(key, v);
    this.runner.poke();
    if (save) {
      it.saved.values = { ...it.saved.values, [key]: v };
      this.onSave(this.items.map((i) => i.saved));
    }
  }

  // updates the readouts and LEDs a few times a second
  frame(force = false) {
    if (!this.open) return;
    const now = performance.now();
    if (!force && now - this.lastRead < 100) return;
    this.lastRead = now;
    for (const it of this.items) {
      const el = this.list.querySelector(`.mod-card[data-id="${it.saved.id}"]`);
      if (!el) continue;
      el.querySelectorAll<HTMLElement>('[data-read]').forEach((r) => (r.textContent = String(it.inst.read?.(r.dataset.read!) ?? '')));
      el.querySelectorAll<HTMLElement>('[data-leds]').forEach((r) => {
        const v = (this.runner.sim ? it.inst.read?.(r.dataset.leds!) : null) as number[] | null;
        r.querySelectorAll('span').forEach((s, i) => ((s as HTMLElement).style.opacity = String(0.15 + 0.85 * (v?.[i] ?? 0))));
      });
    }
  }
}

function defaults(def: ModuleDef): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of def.controls) if (c.kind === 'slider') out[c.key] = c.def;
  return out;
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, ''));
