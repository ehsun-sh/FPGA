// RTL netlist, resource / timing estimate, schematic layout and the Vivado project export.
import { describe, expect, it } from "vitest";
import { synthesize } from "../src/hdl";
import { ALL_LESSONS } from "../src/lessons/course";
import { buildNetlist } from "../src/synth/netlist";
import { projectFiles } from "../src/synth/project";
import { layout, renderSvg } from "../src/synth/schematic";
import { techMap } from "../src/synth/techmap";
import { crc32, zip } from "../src/util/zip";

const net = (src: string, lang: "verilog" | "vhdl" = "verilog") =>
  buildNetlist(synthesize(src, lang));
const count = (nl: ReturnType<typeof net>, type: string) =>
  nl.cells.filter((c) => c.type === type).length;
const lesson = (id: string) => ALL_LESSONS.find((l) => l.id === id)!;

describe("RTL netlist", () => {
  it("turns continuous assignments into gates, without latches", () => {
    for (const lang of ["verilog", "vhdl"] as const) {
      const nl = net(lesson("gates")[lang], lang);
      expect(count(nl, "latch")).toBe(0);
      const ops = nl.cells.filter((c) => c.type === "gate").map((c) => c.op);
      expect(ops).toEqual(expect.arrayContaining(["and", "or", "xor", "not"]));
      expect(nl.warnings).toEqual([]);
    }
  });

  it("a clocked process becomes a register with D, clock enable and synchronous reset", () => {
    for (const lang of ["verilog", "vhdl"] as const) {
      const nl = net(lesson("ff")[lang], lang);
      const regs = nl.cells.filter((c) => c.type === "reg");
      expect(regs).toHaveLength(1);
      expect(regs[0].width).toBe(16);
      expect(regs[0].ins.map((p) => p.name)).toEqual(["D", "C", "CE", "R"]);
      expect(nl.cells[regs[0].ins[0].src!.cell].type).toBe("in"); // D = SW, no multiplexer left
      const r = techMap(nl);
      expect(r.util.ffs).toBe(16);
      expect(r.util.lutLogic).toBeLessThanOrEqual(1);
      expect(r.prims.find((p) => p.name === "FDRE")?.count).toBe(16);
    }
  });

  it("an incomplete combinational process infers a latch", () => {
    const nl = net(`module top (input wire [1:0] SW, output reg [0:0] LED);
  always @(*) if (SW[1]) LED = SW[0];
endmodule`);
    expect(count(nl, "latch")).toBe(1);
    expect(nl.warnings.map((w) => w.code)).toContain("Synth 8-327");
    expect(techMap(nl).util.latches).toBe(1);
  });

  it("asynchronous reset, unused registers and full case statements", () => {
    const nl =
      net(`module top (input wire CLK100MHZ, input wire CPU_RESETN, input wire [3:0] SW, output wire [3:0] LED);
  reg [3:0] q, spare;
  always @(posedge CLK100MHZ or negedge CPU_RESETN)
    if (!CPU_RESETN) q <= 4'hF; else q <= SW;
  always @(posedge CLK100MHZ) spare <= spare + 1;
  assign LED = q;
endmodule`);
    const q = nl.cells.find((c) => c.type === "reg" && c.name === "q")!;
    expect(q.ins.map((p) => p.name)).toContain("PRE");
    expect(q.arst?.value).toBe(15);
    const spare = nl.cells.find((c) => c.type === "reg" && c.name === "spare")!;
    expect(spare.unused).toBe(true);
    expect(
      nl.warnings.some(
        (w) => w.code === "Synth 8-3332" && w.msg.includes("spare_reg"),
      ),
    ).toBe(true);
    const r = techMap(nl);
    expect(r.util.ffs).toBe(4);
    expect(r.prims.find((p) => p.name === "FDPE")?.count).toBe(4);
    expect(r.removed).toEqual(["spare_reg"]);
  });

  it("recognises state machines, with the VHDL state names", () => {
    const v = techMap(net(lesson("fsm").verilog));
    expect(v.fsms.map((f) => f.reg)).toEqual(["state_reg"]);
    const h = techMap(net(lesson("fsm").vhdl, "vhdl"));
    expect(h.fsms[0].states.map((s) => s.name)).toEqual([
      "red",
      "green",
      "yellow",
    ]);
  });

  it("maps memories, multipliers and adders onto RAM, DSP and carry chains", () => {
    const r = techMap(
      net(`module top (input wire CLK100MHZ, input wire [15:0] SW, output reg [15:0] LED);
  reg [7:0] big [0:4095];
  reg [7:0] rd;
  reg [15:0] p;
  always @(posedge CLK100MHZ) begin
    big[SW[11:0]] <= SW[15:8];
    rd <= big[SW[11:0]];
    p <= SW[3:0] * SW[7:4] + {8'd0, rd};
    LED <= p;
  end
endmodule`),
    );
    expect(r.util.bram36).toBe(1);
    expect(r.util.dsp).toBe(0); // 4x4 bits: small enough for LUTs
    expect(r.util.carry4).toBeGreaterThan(0);
    const d = techMap(
      net(`module top (input wire CLK100MHZ, input wire [15:0] SW, output reg [15:0] LED);
  reg [15:0] a = 0, b = 0;
  always @(posedge CLK100MHZ) begin a <= SW; b <= ~SW; LED <= a * b; end
endmodule`),
    );
    expect(d.util.dsp).toBe(1);
  });

  it("long logic between registers fails timing at 100 MHz", () => {
    const chain = Array.from(
      { length: 10 },
      (_, i) => `wire [31:0] s${i + 1} = s${i} + x;`,
    ).join("\n");
    const r = techMap(
      net(`module top (input wire CLK100MHZ, input wire [15:0] SW, output wire [15:0] LED);
  reg [31:0] x = 0, y = 0;
  wire [31:0] s0 = x;
  ${chain}
  always @(posedge CLK100MHZ) begin x <= {SW, SW}; y <= s10; end
  assign LED = y[15:0];
endmodule`),
    );
    expect(r.timing.wns).toBeLessThan(0);
    expect(r.timing.worst?.from).toBe("x_reg[31:0]");
    const ok = techMap(net(lesson("counter").verilog));
    expect(ok.timing.wns).toBeGreaterThan(0);
    expect(ok.util.ffs).toBe(35);
  });
});

describe("schematic", () => {
  it("lays out every lesson without overlaps", () => {
    for (const l of ALL_LESSONS) {
      for (const lang of ["verilog", "vhdl"] as const) {
        const nl = net(l[lang], lang);
        const L = layout(nl);
        for (const n of L.nodes)
          expect(Number.isFinite(n.x) && Number.isFinite(n.y)).toBe(true);
        const cols = new Map<number, typeof L.nodes>();
        for (const n of L.nodes)
          cols.set(n.rank, [...(cols.get(n.rank) ?? []), n]);
        for (const col of cols.values()) {
          const s = [...col].sort((a, b) => a.y - b.y);
          for (let i = 1; i < s.length; i++)
            expect(s[i].y + 0.01).toBeGreaterThanOrEqual(
              s[i - 1].y + s[i - 1].h,
            );
        }
        for (const e of L.edges)
          expect(e.points.length).toBeGreaterThanOrEqual(2);
        const svg = renderSvg(L, nl);
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg).not.toContain("NaN");
      }
    }
  });

  it("shows one instance on its own, with its boundary nets as ports", () => {
    const nl = net(lesson("debounce").verilog);
    const L = layout(nl, "u_db.");
    expect(L.nodes.some((n) => n.kind === "bin")).toBe(true);
    expect(L.nodes.some((n) => n.kind === "bout")).toBe(true);
    expect(
      L.nodes
        .filter((n) => n.kind === "cell")
        .every((n) => n.cell!.path.startsWith("u_db.")),
    ).toBe(true);
  });
});

describe("project export", () => {
  it("writes a valid zip", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
    const z = zip([
      { name: "a/b.txt", data: "hello" },
      { name: "c.txt", data: "" },
    ]);
    const dv = new DataView(z.buffer);
    expect(dv.getUint32(0, true)).toBe(0x04034b50);
    const end = z.length - 22;
    expect(dv.getUint32(end, true)).toBe(0x06054b50);
    expect(dv.getUint16(end + 10, true)).toBe(2);
    const cd = dv.getUint32(end + 16, true);
    expect(dv.getUint32(cd, true)).toBe(0x02014b50);
    expect(new TextDecoder().decode(z.slice(30, 37))).toBe("a/b.txt");
    expect(new TextDecoder().decode(z.slice(37, 42))).toBe("hello");
  });

  it("creates a Vivado project script for Verilog and VHDL", () => {
    const l = lesson("counter");
    const v = projectFiles({
      name: "fpga_lab_counter",
      lang: "verilog",
      top: "top",
      src: l.verilog,
      xdc: "## xdc",
      xdcName: "nexys-a7-100t.xdc",
      tb: "module tb_top; endmodule",
      part: "xc7a100tcsg324-1",
      board: "Digilent Nexys A7-100T",
    });
    expect(v.map((f) => f.name)).toEqual([
      "fpga_lab_counter/src/top.v",
      "fpga_lab_counter/constrs/nexys-a7-100t.xdc",
      "fpga_lab_counter/sim/tb_top.v",
      "fpga_lab_counter/create_project.tcl",
      "fpga_lab_counter/README.txt",
    ]);
    const tcl = v.find((f) => f.name.endsWith(".tcl"))!.data;
    expect(tcl).toContain(
      "create_project $proj_name $origin/vivado -part xc7a100tcsg324-1",
    );
    expect(tcl).toContain("set_property top top [current_fileset]");
    expect(tcl).toContain("set_property top tb_top [get_filesets sim_1]");
    const h = projectFiles({
      name: "x",
      lang: "vhdl",
      top: "top",
      src: l.vhdl,
      xdc: "",
      xdcName: "n.xdc",
      tb: "entity tb_top is\nend tb_top;",
      part: "p",
      board: "b",
    });
    expect(h.find((f) => f.name.endsWith(".tcl"))!.data).toContain(
      "set_property file_type {VHDL 2008}",
    );
    expect(h.map((f) => f.name)).toContain("x/sim/tb_top.vhd");
  });
});
