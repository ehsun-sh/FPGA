// The Schematic document tab: the RTL netlist drawn as a schematic, with pan / zoom, an instance filter and cell details.
import type { Netlist } from "./netlist";
import { cellInfo, layout, renderSvg, type Layout } from "./schematic";

export class SchematicPanel {
  private nl: Netlist | null = null;
  private L: Layout | null = null;
  private scope = "";
  private showUnused = true;
  private k = 1;
  private tx = 0;
  private ty = 0;
  private view: HTMLElement;
  private info: HTMLElement;
  private bar: HTMLElement;
  private svg: SVGSVGElement | null = null;
  private fitted = false;

  constructor(
    host: HTMLElement,
    private onGoto: (line: number) => void,
    private onRefresh: () => void,
  ) {
    host.innerHTML = `<div class="schem-bar"></div><div class="schem-view"></div><div class="schem-info"></div>`;
    this.bar = host.querySelector(".schem-bar")!;
    this.view = host.querySelector(".schem-view")!;
    this.info = host.querySelector(".schem-info")!;
    this.bar.addEventListener("click", (ev) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (!b) return;
      const a = b.dataset.s;
      if (a === "fit") this.fit();
      if (a === "in") this.zoomAt(1.25);
      if (a === "out") this.zoomAt(0.8);
      if (a === "refresh") this.onRefresh();
    });
    this.bar.addEventListener("change", (ev) => {
      const t = ev.target as HTMLInputElement | HTMLSelectElement;
      if (t.dataset.s === "scope") this.scope = t.value;
      if (t.dataset.s === "unused")
        this.showUnused = (t as HTMLInputElement).checked;
      this.fitted = false;
      this.draw();
    });
    // pan and zoom
    let drag: {
      x: number;
      y: number;
      tx: number;
      ty: number;
      moved: boolean;
    } | null = null;
    this.view.addEventListener("pointerdown", (ev) => {
      drag = {
        x: ev.clientX,
        y: ev.clientY,
        tx: this.tx,
        ty: this.ty,
        moved: false,
      };
      this.view.setPointerCapture(ev.pointerId);
    });
    this.view.addEventListener("pointermove", (ev) => {
      if (!drag) return;
      const dx = ev.clientX - drag.x;
      const dy = ev.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        drag.moved = true;
        this.view.classList.add("drag");
      }
      this.tx = drag.tx + dx;
      this.ty = drag.ty + dy;
      this.apply();
    });
    this.view.addEventListener("pointerup", (ev) => {
      const moved = drag?.moved;
      drag = null;
      this.view.classList.remove("drag");
      if (!moved) this.pick(document.elementFromPoint(ev.clientX, ev.clientY));
    });
    this.view.addEventListener(
      "wheel",
      (ev) => {
        ev.preventDefault();
        const r = this.view.getBoundingClientRect();
        this.zoomAt(
          Math.exp(-ev.deltaY * 0.0015),
          ev.clientX - r.left,
          ev.clientY - r.top,
        );
      },
      { passive: false },
    );
  }

  get design() {
    return this.nl;
  }

  show(nl: Netlist) {
    const keep =
      this.nl?.design.top === nl.design.top &&
      nl.instances.some((i) => i.path === this.scope);
    this.nl = nl;
    if (!keep) {
      this.scope = "";
      this.fitted = false;
    }
    const cells = nl.cells.filter((c) => c.type !== "const");
    // a big design starts with its top level only when it has sub-instances
    if (!keep && cells.length > 400 && nl.instances.length > 1) this.scope = "";
    this.draw();
  }

  private draw() {
    const nl = this.nl;
    if (!nl) return;
    const insts = [...nl.instances].sort((a, b) =>
      a.path.localeCompare(b.path),
    );
    const opts = insts
      .map(
        (i) =>
          `<option value="${i.path}" ${i.path === this.scope ? "selected" : ""}>${i.path ? i.path.slice(0, -1) : `${nl.design.top} (whole design)`}</option>`,
      )
      .join("");
    const nCells = nl.cells.filter(
      (c) => c.type !== "const" && c.path.startsWith(this.scope),
    ).length;
    this.bar.innerHTML = `<b>RTL Schematic</b><span class="dim">— ${nl.design.top}</span>
      ${insts.length > 1 ? `<label>Instance <select data-s="scope">${opts}</select></label>` : ""}
      <label title="Show logic that synthesis removes because it drives no output"><input type="checkbox" data-s="unused" ${this.showUnused ? "checked" : ""}> unused logic</label>
      <span class="dim">${nCells} cells</span><span class="grow"></span>
      <button data-s="out" title="Zoom out">−</button><button data-s="in" title="Zoom in">+</button><button data-s="fit" title="Fit to window">Fit</button><button data-s="refresh" title="Re-run elaboration with the current code">↻ Refresh</button>`;
    this.L = layout(nl, this.scope, this.showUnused);
    this.view.innerHTML = renderSvg(this.L, nl);
    this.svg = this.view.querySelector("svg");
    this.info.innerHTML = `<span class="dim">Click a cell for details · drag to pan · scroll to zoom. Green wires are nets, thick ones are buses; constants are orange.</span>`;
    if (!this.fitted) this.fit();
    else this.apply();
  }

  // call when the tab becomes visible (the size was unknown while hidden)
  shown() {
    if (!this.fitted && this.nl) this.fit();
  }

  fit() {
    if (!this.L) return;
    const r = this.view.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.k = Math.min(
      1.6,
      Math.max(
        0.05,
        Math.min(
          (r.width - 20) / this.L.width,
          (r.height - 20) / this.L.height,
        ),
      ),
    );
    this.tx = (r.width - this.L.width * this.k) / 2;
    this.ty = Math.max(10, (r.height - this.L.height * this.k) / 2);
    this.fitted = true;
    this.apply();
  }

  private zoomAt(f: number, cx?: number, cy?: number) {
    const r = this.view.getBoundingClientRect();
    cx ??= r.width / 2;
    cy ??= r.height / 2;
    const k = Math.min(4, Math.max(0.03, this.k * f));
    this.tx = cx - ((cx - this.tx) * k) / this.k;
    this.ty = cy - ((cy - this.ty) * k) / this.k;
    this.k = k;
    this.apply();
  }

  private apply() {
    if (this.svg)
      this.svg.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.k})`;
  }

  private pick(el: Element | null) {
    if (!this.svg || !this.L || !this.nl) return;
    this.svg.querySelectorAll(".sel").forEach((e) => e.classList.remove("sel"));
    this.svg.querySelectorAll(".hl").forEach((e) => e.classList.remove("hl"));
    this.svg.classList.remove("dimmed");
    const g = el?.closest("[data-cell]") as SVGGElement | null;
    const w = el?.closest("[data-edge]") as SVGPathElement | null;
    if (g) {
      const id = Number(g.dataset.cell);
      const c = this.nl.cells[id];
      g.classList.add("sel");
      const node = this.L.nodes.find((n) => n.cell?.id === id);
      this.L.edges.forEach((e, i) => {
        if (node && (e.from === node.id || e.to === node.id))
          this.svg!.querySelector(`.w[data-edge="${i}"]`)?.classList.add("hl");
      });
      this.svg.classList.add("dimmed");
      this.info.innerHTML =
        cellInfo(c, this.nl) +
        (c.loc
          ? ` · <a data-line="${c.loc.line}">line ${c.loc.line} ↗</a>`
          : "");
      this.info
        .querySelector("a")
        ?.addEventListener("click", () => this.onGoto(c.loc!.line));
      return;
    }
    if (w) {
      const e = this.L.edges[Number(w.dataset.edge)];
      // every wire of the same net
      this.L.edges.forEach((o, i) => {
        if (
          o.src.cell === e.src.cell &&
          o.src.lo === e.src.lo &&
          o.src.width === e.src.width
        )
          this.svg!.querySelector(`.w[data-edge="${i}"]`)?.classList.add("hl");
      });
      this.svg.classList.add("dimmed");
      this.info.innerHTML = `net <b>${e.name || "(unnamed)"}</b> · ${e.width} bit${e.width > 1 ? "s" : ""}`;
      return;
    }
    this.info.innerHTML = `<span class="dim">Click a cell for details · drag to pan · scroll to zoom.</span>`;
  }
}
