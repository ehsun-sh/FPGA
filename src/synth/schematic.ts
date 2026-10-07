// RTL schematic of the netlist, drawn as SVG: a layered left-to-right layout (inputs on the left, outputs on the
// right) with gate symbols, multiplexers and registers, like Vivado's Schematic window.
import type { Cell, Netlist, Ref } from "./netlist";
import { fmtConst, prettyName } from "./netlist";
import { cellLabel, rtlName } from "./techmap";

export interface GNode {
  id: number; // index in nodes
  cell: Cell | null; // null: a routing slot of an edge, or a boundary port of an instance view
  kind: "cell" | "dummy" | "bin" | "bout";
  label?: string;
  w: number;
  h: number;
  rank: number;
  order: number;
  x: number;
  y: number;
  // input pin y offsets (relative to y), output pin offset
  pins: number[];
  outY: number;
}

export interface GEdge {
  from: number; // node
  to: number; // node
  pin: number; // input pin index on `to`
  src: Ref;
  back: boolean;
  path: number[]; // nodes along the edge (including the dummies)
  name: string;
  width: number;
  points: [number, number][];
}

export interface Layout {
  nodes: GNode[];
  edges: GEdge[];
  width: number;
  height: number;
  consts: { node: number; pin: number; text: string }[];
}

const GAP_X = 70;
const GAP_Y = 16;

function sizeOf(c: Cell): {
  w: number;
  h: number;
  pins: number[];
  outY: number;
} {
  const n = c.ins.length;
  const spread = (h: number, k: number, top = 0) =>
    Array.from({ length: k }, (_, i) => top + ((i + 1) * (h - top)) / (k + 1));
  switch (c.type) {
    case "in":
    case "out": {
      const w = Math.max(
        56,
        12 + (c.name!.length + (c.width > 1 ? 6 : 0)) * 6.4,
      );
      return { w, h: 20, pins: [10], outY: 10 };
    }
    case "gate": {
      if (c.op === "not") return { w: 34, h: 24, pins: [12], outY: 12 };
      const h = Math.max(30, n * 14 + 6);
      return { w: 44, h, pins: spread(h, n), outY: h / 2 };
    }
    case "mux": {
      const h = 50;
      return { w: 34, h, pins: [h - 7, 15, 31], outY: h / 2 - 2 };
    }
    case "bsel":
    case "insert": {
      const h = Math.max(44, n * 14 + 10);
      return { w: 36, h, pins: spread(h, n), outY: h / 2 };
    }
    case "pmux": {
      const items = n - 1;
      const h = Math.max(50, items * 14 + 24);
      const pins = [
        h - 8,
        ...Array.from({ length: items }, (_, i) => 12 + i * 14),
      ];
      return {
        w:
          46 +
          Math.min(
            40,
            Math.max(...(c.labels ?? [""]).map((l) => l.length)) * 5,
          ),
        h,
        pins,
        outY: h / 2,
      };
    }
    case "reg":
    case "latch": {
      const h = Math.max(44, n * 15 + 12);
      return { w: 64, h, pins: c.ins.map((_, i) => 13 + i * 15), outY: 13 };
    }
    case "concat": {
      const h = Math.max(24, n * 11 + 6);
      return { w: 8, h, pins: spread(h, n), outY: h / 2 };
    }
    case "ram": {
      const h = Math.max(50, n * 13 + 16);
      return { w: 84, h, pins: c.ins.map((_, i) => 14 + i * 13), outY: 14 };
    }
    case "ramrd":
      return { w: 56, h: 40, pins: [12, 28], outY: 20 };
    case "tri":
      return { w: 36, h: 32, pins: [16, 28], outY: 16 };
    default: {
      const h = Math.max(36, n * 16 + 8);
      return { w: 52, h, pins: spread(h, n), outY: h / 2 };
    }
  }
}

// builds the graph for the cells whose hierarchy path starts with `scope` ('' = everything)
export function layout(nl: Netlist, scope = "", showUnused = true): Layout {
  const cells = nl.cells;
  const inScope = (c: Cell) =>
    c.type !== "const" &&
    (showUnused || !c.unused) &&
    (c.type === "in" || c.type === "out" || c.type === "tri"
      ? scope === ""
      : c.path.startsWith(scope));
  const nodes: GNode[] = [];
  const nodeOf = new Map<number, number>();
  const mk = (n: Omit<GNode, "id" | "rank" | "order" | "x" | "y">) => {
    const id = nodes.length;
    nodes.push({ ...n, id, rank: 0, order: 0, x: 0, y: 0 });
    return id;
  };
  for (const c of cells) {
    if (!inScope(c)) continue;
    const s = sizeOf(c);
    nodeOf.set(c.id, mk({ cell: c, kind: "cell", ...s }));
  }
  const netName = (r: Ref) => {
    const base = nl.netNames.get(r.cell);
    const c = cells[r.cell];
    const nm = base ?? (c.type === "in" || c.type === "out" ? c.name! : "");
    if (!nm) return "";
    if (r.lo === 0 && r.width === c.width)
      return c.width > 1 ? `${nm}[${c.width - 1}:0]` : nm;
    return r.width > 1
      ? `${nm}[${r.lo + r.width - 1}:${r.lo}]`
      : `${nm}[${r.lo}]`;
  };
  const edges: GEdge[] = [];
  const consts: Layout["consts"] = [];
  const bins = new Map<string, number>();
  const bouts = new Map<number, number>();
  for (const c of cells) {
    const to = nodeOf.get(c.id);
    if (to === undefined) continue;
    c.ins.forEach((p, pin) => {
      if (!p.src) return;
      const s = cells[p.src.cell];
      if (s.type === "const") {
        consts.push({
          node: to,
          pin,
          text: fmtConst(
            ((s.value! >>> p.src.lo) & (2 ** Math.min(p.src.width, 32) - 1)) >>>
              0,
            p.src.width,
          ),
        });
        return;
      }
      let from = nodeOf.get(s.id);
      if (from === undefined) {
        if (!showUnused && s.unused) return;
        // a net coming from outside the instance: a boundary port
        const key = `${s.id}:${p.src.lo}:${p.src.width}`;
        from = bins.get(key);
        if (from === undefined) {
          const label = netName(p.src) || `${rtlName(s).toLowerCase()}_${s.id}`;
          from = mk({
            cell: null,
            kind: "bin",
            label,
            w: Math.max(56, 12 + label.length * 6.4),
            h: 20,
            pins: [],
            outY: 10,
          });
          bins.set(key, from);
        }
      }
      edges.push({
        from,
        to,
        pin,
        src: p.src,
        back: false,
        path: [],
        name: netName(p.src),
        width: p.src.width,
        points: [],
      });
    });
  }
  if (scope) {
    // nets that leave the instance
    for (const c of cells) {
      if (nodeOf.has(c.id) || c.type === "const") continue;
      for (const p of c.ins) {
        if (!p.src) continue;
        const from = nodeOf.get(p.src.cell);
        if (from === undefined || bouts.has(p.src.cell)) continue;
        const label =
          netName(full(cells[p.src.cell])) || cellLabel(cells[p.src.cell], nl);
        const to = mk({
          cell: null,
          kind: "bout",
          label,
          w: Math.max(56, 12 + label.length * 6.4),
          h: 20,
          pins: [10],
          outY: 10,
        });
        bouts.set(p.src.cell, to);
        const src = full(cells[p.src.cell]);
        edges.push({
          from,
          to,
          pin: 0,
          src,
          back: false,
          path: [],
          name: label,
          width: src.width,
          points: [],
        });
      }
    }
  }

  // ---------------------------------------------------------------- ranks (longest path; feedback edges reversed)
  const N = nodes.length;
  const outE: number[][] = Array.from({ length: N }, () => []);
  edges.forEach((e, i) => outE[e.from].push(i));
  const state = new Uint8Array(N); // 0 new, 1 on stack, 2 done
  const isSource = (n: GNode) => n.kind === "bin" || n.cell?.type === "in";
  const order = [...nodes].sort(
    (a, b) =>
      Number(isSource(b)) - Number(isSource(a)) ||
      Number(b.cell?.type === "reg") - Number(a.cell?.type === "reg"),
  );
  for (const root of order) {
    if (state[root.id]) continue;
    const stack: [number, number][] = [[root.id, 0]];
    state[root.id] = 1;
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [v, i] = top;
      if (i >= outE[v].length) {
        state[v] = 2;
        stack.pop();
        continue;
      }
      top[1]++;
      const e = edges[outE[v][i]];
      if (state[e.to] === 1) e.back = true;
      else if (state[e.to] === 0) {
        state[e.to] = 1;
        stack.push([e.to, 0]);
      }
    }
  }
  const indeg = new Array(N).fill(0);
  const fwd: number[][] = Array.from({ length: N }, () => []);
  for (const e of edges) {
    const [a, b] = e.back ? [e.to, e.from] : [e.from, e.to];
    if (a === b) continue;
    fwd[a].push(b);
    indeg[b]++;
  }
  const q: number[] = [];
  for (let i = 0; i < N; i++) if (!indeg[i]) q.push(i);
  while (q.length) {
    const v = q.shift()!;
    for (const w of fwd[v]) {
      nodes[w].rank = Math.max(nodes[w].rank, nodes[v].rank + 1);
      if (--indeg[w] === 0) q.push(w);
    }
  }
  // outputs on the far right; inputs that feed only later columns move right next to their readers
  let maxRank = 0;
  for (const n of nodes) maxRank = Math.max(maxRank, n.rank);
  for (const n of nodes)
    if (n.kind === "bout" || n.cell?.type === "out")
      n.rank = Math.max(maxRank, 1);
  maxRank = Math.max(maxRank, ...nodes.map((n) => n.rank));
  for (const n of nodes) {
    if (!(n.kind === "bin" || n.cell?.type === "in")) continue;
    const readers = edges
      .filter((e) => e.from === n.id)
      .map((e) => nodes[e.to].rank);
    if (readers.length) n.rank = Math.max(0, Math.min(...readers) - 1);
  }

  // ---------------------------------------------------------------- dummies for long edges
  for (const e of edges) {
    const a = nodes[e.from];
    const b = nodes[e.to];
    e.path = [e.from];
    if (!e.back && b.rank > a.rank) {
      for (let r = a.rank + 1; r < b.rank; r++) {
        const id = mk({
          cell: null,
          kind: "dummy",
          w: 0,
          h: 6,
          pins: [3],
          outY: 3,
        });
        nodes[id].rank = r;
        e.path.push(id);
      }
    } else {
      // feedback: a slot in every column from the source back to the target
      for (let r = a.rank; r >= b.rank; r--) {
        const id = mk({
          cell: null,
          kind: "dummy",
          w: 0,
          h: 6,
          pins: [3],
          outY: 3,
        });
        nodes[id].rank = r;
        e.path.push(id);
      }
    }
    e.path.push(e.to);
  }

  // ---------------------------------------------------------------- ordering within columns (barycenter sweeps)
  const R = maxRank + 1;
  const cols: GNode[][] = Array.from({ length: R }, () => []);
  for (const n of nodes) cols[n.rank].push(n);
  // neighbours along edge paths
  // neighbours along edge paths, with the pin offsets on both ends
  const nbr: { m: number; self: number; other: number }[][] = Array.from(
    { length: nodes.length },
    () => [],
  );
  for (const e of edges)
    for (let i = 1; i < e.path.length; i++) {
      const u = nodes[e.path[i - 1]];
      const v = nodes[e.path[i]];
      const uo = u.kind === "dummy" ? 3 : u.outY;
      const vo = v.kind === "dummy" ? 3 : (v.pins[e.pin] ?? v.h / 2);
      nbr[u.id].push({ m: v.id, self: uo, other: vo });
      nbr[v.id].push({ m: u.id, self: vo, other: uo });
    }
  cols.forEach((col) => col.forEach((n, i) => (n.order = i)));
  for (let it = 0; it < 8; it++) {
    const range = it % 2 === 0 ? [...cols.keys()] : [...cols.keys()].reverse();
    for (const r of range) {
      const col = cols[r];
      const dir = it % 2 === 0 ? -1 : 1;
      const bc = new Map<number, number>();
      for (const n of col) {
        const ns = nbr[n.id].filter((x) => nodes[x.m].rank === r + dir);
        bc.set(
          n.id,
          ns.length
            ? ns.reduce((s, x) => s + nodes[x.m].order, 0) / ns.length
            : n.order,
        );
      }
      col.sort((a, b) => bc.get(a.id)! - bc.get(b.id)! || a.order - b.order);
      col.forEach((n, i) => (n.order = i));
    }
  }

  // ---------------------------------------------------------------- coordinates
  // constants are written next to the pins: leave room for the longest one in each column
  const constW = new Map<number, number>();
  for (const k of consts)
    constW.set(
      k.node,
      Math.max(constW.get(k.node) ?? 0, k.text.length * 5.6 + 20),
    );
  let x = 20;
  for (const col of cols) {
    const pad = Math.max(0, ...col.map((n) => constW.get(n.id) ?? 0));
    x += Math.max(0, pad - GAP_X * 0.35);
    const w = Math.max(0, ...col.map((n) => n.w));
    for (const n of col) n.x = x + (w - n.w) / 2;
    x += w + GAP_X;
  }
  for (const col of cols) {
    let y = 30;
    for (const n of col) {
      n.y = y;
      y += n.h + (n.kind === "dummy" ? 4 : GAP_Y + 14);
    }
  }
  // pull nodes towards their neighbours, keeping the order and the spacing
  for (let it = 0; it < 12; it++) {
    const range = it % 2 === 0 ? [...cols.keys()] : [...cols.keys()].reverse();
    for (const r of range) {
      const col = cols[r];
      const want = col.map((n) => {
        const ns = nbr[n.id].filter((x) => nodes[x.m].rank !== r);
        if (!ns.length) return n.y;
        return (
          ns.reduce((s, x) => s + nodes[x.m].y + x.other - x.self, 0) /
          ns.length
        );
      });
      place(col, want);
    }
  }
  const minY = Math.min(30, ...nodes.map((n) => n.y));
  for (const n of nodes) n.y += 30 - minY;

  // ---------------------------------------------------------------- wires
  const colRight: number[] = [];
  const colLeft: number[] = [];
  cols.forEach((col, r) => {
    colLeft[r] = Math.min(...col.map((n) => n.x));
    colRight[r] = Math.max(...col.map((n) => n.x + n.w));
  });
  const tracks = new Map<number, number>();
  const track = (gap: number) => {
    const n = tracks.get(gap) ?? 0;
    tracks.set(gap, n + 1);
    return n;
  };
  for (const e of edges) {
    const pts: [number, number][] = [];
    const a = nodes[e.from];
    const b = nodes[e.to];
    const sy = a.y + a.outY;
    const ty = b.y + (b.pins[e.pin] ?? b.h / 2);
    pts.push([a.x + a.w, sy]);
    if (!e.back && b.rank > a.rank) {
      let cy = sy;
      let cx = a.x + a.w;
      for (let i = 1; i < e.path.length; i++) {
        const n = nodes[e.path[i]];
        const ny = n.kind === "dummy" ? n.y + 3 : ty;
        const gapL = colRight[n.rank - 1] ?? cx;
        if (Math.abs(ny - cy) > 0.5) {
          const t = track(n.rank);
          const jx = gapL + 10 + ((t * 5) % (GAP_X - 22));
          pts.push([jx, cy], [jx, ny]);
        }
        cy = ny;
        cx = n.kind === "dummy" ? colRight[n.rank] : n.x;
        pts.push([n.kind === "dummy" ? colLeft[n.rank] : n.x, ny]);
        if (n.kind === "dummy") pts.push([colRight[n.rank], ny]);
      }
    } else {
      // feedback wire: out to the right, then back through the reserved slots, into the target from the left
      const t = track(a.rank + 1);
      let cx = (colRight[a.rank] ?? a.x + a.w) + 8 + ((t * 5) % (GAP_X - 22));
      let cy = sy;
      pts.push([cx, cy]);
      for (let i = 1; i < e.path.length - 1; i++) {
        const n = nodes[e.path[i]];
        const ny = n.y + 3;
        pts.push([cx, ny]);
        cy = ny;
        cx = colLeft[n.rank] - 10 - ((track(n.rank) * 5) % (GAP_X - 22));
        pts.push([cx, cy]);
      }
      pts.push([cx, ty]);
    }
    pts.push([b.x, ty]);
    e.points = simplify(pts);
  }

  const width = Math.max(...nodes.map((n) => n.x + n.w), 100) + 40;
  const height = Math.max(...nodes.map((n) => n.y + n.h), 60) + 40;
  return { nodes, edges, width, height, consts };

  function full(c: Cell): Ref {
    return { cell: c.id, lo: 0, width: c.width };
  }
}

// ordered 1-D placement with minimum spacing that stays as close as possible to the wanted positions:
// with c_i = the space the items above need, z_i = y_i - c_i must not decrease, so this is an isotonic regression
function place(col: GNode[], want: number[]) {
  const gap = (n: GNode) => n.h + (n.kind === "dummy" ? 4 : GAP_Y + 14);
  const c: number[] = [];
  let acc = 0;
  for (const n of col) {
    c.push(acc);
    acc += gap(n);
  }
  const blocks: { sum: number; n: number; len: number }[] = [];
  want.forEach((w, i) => {
    blocks.push({ sum: w - c[i], n: 1, len: 1 });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1];
      const p = blocks[blocks.length - 2];
      if (p.sum / p.n <= b.sum / b.n) break;
      p.sum += b.sum;
      p.n += b.n;
      p.len += b.len;
      blocks.pop();
    }
  });
  let i = 0;
  for (const b of blocks) {
    const z = b.sum / b.n;
    for (let k = 0; k < b.len; k++, i++) col[i].y = z + c[i];
  }
}

function simplify(pts: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of pts) {
    const last = out[out.length - 1];
    if (
      last &&
      Math.abs(last[0] - p[0]) < 0.01 &&
      Math.abs(last[1] - p[1]) < 0.01
    )
      continue;
    out.push([+p[0].toFixed(1), +p[1].toFixed(1)]);
  }
  // drop middle points on straight lines
  for (let i = out.length - 2; i > 0; i--) {
    const [a, b, c] = [out[i - 1], out[i], out[i + 1]];
    if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]))
      out.splice(i, 1);
  }
  return out;
}

// ---------------------------------------------------------------- SVG
const esc = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );

function gateShape(op: string, w: number, h: number): string {
  const bubble = op === "nand" || op === "nor" || op === "xnor" || op === "not";
  const bw = bubble ? w - 8 : w;
  let d: string;
  if (op === "not") d = `M0,0 L${bw},${h / 2} L0,${h} Z`;
  else if (op === "and" || op === "nand")
    d = `M0,0 H${bw / 2} A${bw / 2},${h / 2} 0 0 1 ${bw / 2},${h} H0 Z`;
  else
    d = `M0,0 Q${bw * 0.55},0 ${bw},${h / 2} Q${bw * 0.55},${h} 0,${h} Q${bw * 0.3},${h / 2} 0,0 Z`;
  let s = `<path class="sh" d="${d}"/>`;
  if (op === "xor" || op === "xnor")
    s += `<path class="sh2" d="M-5,0 Q${bw * 0.3 - 5},${h / 2} -5,${h}"/>`;
  if (bubble) s += `<circle class="sh" cx="${bw + 4}" cy="${h / 2}" r="3.6"/>`;
  return s;
}

function cellSvg(n: GNode, nl: Netlist): string {
  const c = n.cell!;
  const { w, h } = n;
  const name = cellLabel(c, nl);
  const type = rtlName(c);
  let body = "";
  const pinText = (i: number, t: string, cls = "pt") =>
    `<text class="${cls}" x="4" y="${n.pins[i] + 3}">${esc(t)}</text>`;
  switch (c.type) {
    case "in":
      body = `<path class="sh port" d="M0,0 H${w - 10} L${w},${h / 2} L${w - 10},${h} H0 Z"/><text class="pn" x="6" y="${h / 2 + 4}">${esc(c.name! + (c.width > 1 ? `[${c.width - 1}:0]` : ""))}</text>`;
      return `<g class="cell in" data-cell="${c.id}" transform="translate(${n.x},${n.y})">${body}</g>`;
    case "out":
      body = `<path class="sh port" d="M0,${h / 2} L10,0 H${w} V${h} H10 Z"/><text class="pn" x="14" y="${h / 2 + 4}">${esc(c.name! + (c.width > 1 ? `[${c.width - 1}:0]` : ""))}</text>`;
      return `<g class="cell out" data-cell="${c.id}" transform="translate(${n.x},${n.y})">${body}</g>`;
    case "gate":
      body = gateShape(c.op!, w, h);
      break;
    case "mux":
      body =
        `<path class="sh" d="M0,0 L${w},10 V${h - 10} L0,${h} Z"/>` +
        pinText(1, "0") +
        pinText(2, "1") +
        `<text class="pt" x="${w / 2 - 3}" y="${h - 3}">S</text>`;
      break;
    case "bsel":
    case "insert":
      body =
        `<path class="sh" d="M0,0 L${w},10 V${h - 10} L0,${h} Z"/>` +
        c.ins.map((p, i) => pinText(i, p.name)).join("");
      break;
    case "pmux":
      body =
        `<path class="sh" d="M0,0 L${w},12 V${h - 12} L0,${h} Z"/>` +
        c.ins
          .slice(1)
          .map((p, i) =>
            pinText(
              i + 1,
              p.name.length > 8 ? p.name.slice(0, 7) + "…" : p.name,
            ),
          )
          .join("") +
        `<text class="pt" x="${w / 2 - 3}" y="${h - 4}">S</text>`;
      break;
    case "reg":
    case "latch":
      body =
        `<rect class="sh" width="${w}" height="${h}" rx="2"/>` +
        c.ins
          .map((p, i) =>
            p.name === "C"
              ? `<path class="sh2" d="M0,${n.pins[i] - 4} L6,${n.pins[i]} L0,${n.pins[i] + 4}"/><text class="pt" x="9" y="${n.pins[i] + 3}">C</text>`
              : pinText(i, p.name),
          )
          .join("") +
        `<text class="pt" x="${w - 12}" y="${n.outY + 3}">Q</text>`;
      break;
    case "concat":
      body = `<rect class="sh bar" width="${w}" height="${h}"/>`;
      break;
    case "ram":
      body =
        `<rect class="sh" width="${w}" height="${h}" rx="2"/>` +
        c.ins.map((p, i) => pinText(i, p.name)).join("") +
        `<text class="pt" x="${w - 22}" y="${n.outY + 3}">RD</text>`;
      break;
    case "ramrd":
      body =
        `<rect class="sh" width="${w}" height="${h}" rx="2"/>` +
        pinText(0, "M") +
        pinText(1, "A") +
        `<text class="pt" x="${w - 12}" y="${n.outY + 3}">O</text>`;
      break;
    case "tri":
      body = `<path class="sh" d="M0,2 L${w - 6},${n.outY} L0,${h - 2} Z"/><path class="sh2" d="M${(w - 6) / 2},${h - 2} V${n.pins[1]}"/>`;
      break;
    default: {
      const sym: Record<string, string> = {
        add: "+",
        sub: "−",
        neg: "−",
        mul: "×",
        div: "÷",
        mod: "%",
        eq: "=",
        ne: "≠",
        lt: "<",
        le: "≤",
        gt: ">",
        ge: "≥",
        redand: "&",
        redor: "≥1",
        redxor: "=1",
        shl: "<<",
        shr: ">>",
        sshr: ">>>",
        pow: "**",
      };
      body =
        `<rect class="sh" width="${w}" height="${h}" rx="4"/><text class="sym" x="${w / 2}" y="${h / 2 + 6}" text-anchor="middle">${esc(sym[c.op!] ?? c.op!)}</text>` +
        c.ins.map((p, i) => pinText(i, p.name, "pt small")).join("");
    }
  }
  const labels =
    c.type === "concat"
      ? ""
      : `<text class="cn" x="${w / 2}" y="-5" text-anchor="middle">${esc(name)}</text><text class="ct" x="${w / 2}" y="${h + 11}" text-anchor="middle">${esc(type)}</text>`;
  return `<g class="cell ${c.type}${c.unused ? " unused" : ""}" data-cell="${c.id}" transform="translate(${n.x},${n.y})">${body}${labels}</g>`;
}

export function renderSvg(L: Layout, nl: Netlist): string {
  const wires = L.edges
    .map((e, i) => {
      const d = "M" + e.points.map((p) => p.join(",")).join(" L");
      const bus = e.width > 1 ? " bus" : "";
      const unused = nl.cells[e.src.cell]?.unused ? " unused" : "";
      return `<path class="w${bus}${unused}" data-edge="${i}" d="${d}"><title>${esc(e.name || "(unnamed net)")}${e.width > 1 ? ` · ${e.width} bits` : ""}</title></path>`;
    })
    .join("");
  const hits = L.edges
    .map(
      (e, i) =>
        `<path class="wh" data-edge="${i}" d="M${e.points.map((p) => p.join(",")).join(" L")}"/>`,
    )
    .join("");
  const cells = L.nodes
    .map((n) => {
      if (n.kind === "cell") return cellSvg(n, nl);
      if (n.kind === "bin")
        return `<g class="cell bport" transform="translate(${n.x},${n.y})"><path class="sh port" d="M0,0 H${n.w - 10} L${n.w},${n.h / 2} L${n.w - 10},${n.h} H0 Z"/><text class="pn" x="6" y="${n.h / 2 + 4}">${esc(n.label!)}</text></g>`;
      if (n.kind === "bout")
        return `<g class="cell bport" transform="translate(${n.x},${n.y})"><path class="sh port" d="M0,${n.h / 2} L10,0 H${n.w} V${n.h} H10 Z"/><text class="pn" x="14" y="${n.h / 2 + 4}">${esc(n.label!)}</text></g>`;
      return "";
    })
    .join("");
  const consts = L.consts
    .map((k) => {
      const n = L.nodes[k.node];
      const y = n.y + (n.pins[k.pin] ?? n.h / 2);
      return `<g class="const"><path class="w" d="M${n.x - 14},${y} H${n.x}"/><text x="${n.x - 16}" y="${y + 3}" text-anchor="end">${esc(k.text)}</text></g>`;
    })
    .join("");
  const dots = junctions(L)
    .map(
      ([x, y, bus]) =>
        `<circle class="dot${bus ? " bus" : ""}" cx="${x}" cy="${y}" r="${bus ? 2.6 : 2.1}"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" class="schem" viewBox="0 0 ${L.width} ${L.height}" width="${L.width}" height="${L.height}"><g class="vp">${wires}${dots}${consts}${cells}${hits}</g></svg>`;
}

// where a net branches: points shared by several wires of the same source
function junctions(L: Layout): [number, number, boolean][] {
  const bySrc = new Map<string, GEdge[]>();
  for (const e of L.edges) {
    const k = `${e.from}`;
    const l = bySrc.get(k) ?? [];
    l.push(e);
    bySrc.set(k, l);
  }
  const out: [number, number, boolean][] = [];
  for (const list of bySrc.values()) {
    if (list.length < 2) continue;
    const seen = new Map<string, number>();
    for (const e of list)
      for (const p of e.points.slice(1, -1))
        seen.set(p.join(","), (seen.get(p.join(",")) ?? 0) + 1);
    for (const [k, n] of seen) {
      if (n < 2) continue;
      const [x, y] = k.split(",").map(Number);
      out.push([x, y, list[0].width > 1]);
    }
  }
  return out.slice(0, 2000);
}

export function cellInfo(c: Cell, nl: Netlist): string {
  const parts = [
    `<b>${esc(cellLabel(c, nl))}</b> · ${rtlName(c)}`,
    `${c.width} bit${c.width > 1 ? "s" : ""}`,
  ];
  if (c.path) parts.push(`instance ${esc(c.path.slice(0, -1))}`);
  if (c.type === "reg") {
    const clk = c.ins.find((p) => p.name === "C")?.src;
    if (clk)
      parts.push(
        `clock ${esc(nl.netNames.get(clk.cell) ?? nl.cells[clk.cell]?.name ?? "?")}${c.negedge ? " (falling edge)" : ""}`,
      );
    if (c.arst) parts.push(`async reset → ${fmtConst(c.arst.value, c.width)}`);
    if (c.srst !== undefined)
      parts.push(`sync reset → ${fmtConst(c.srst, c.width)}`);
    parts.push(`init ${fmtConst(c.init ?? 0, c.width)}`);
  }
  if (c.unused)
    parts.push(
      '<span class="warn">removed by synthesis: it does not drive any output</span>',
    );
  if (c.sig !== undefined && c.type !== "in" && c.type !== "out")
    parts.push(`net ${esc(prettyName(nl.design.sigs[c.sig].name))}`);
  return parts.join(" · ");
}
