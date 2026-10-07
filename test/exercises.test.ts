// Every exercise checker must accept a correct solution and reject the lesson's unchanged code.
import { describe, expect, it } from 'vitest';
import { DEFAULT_BOARD, type XdcGroup } from '../src/boards';
import { EXERCISES } from '../src/grade/exercises';
import { gradeExercise, type GradeResult } from '../src/grade/grade';
import { ALL_LESSONS } from '../src/lessons/course';
import { HEX_CASE_V, type Lesson } from '../src/lessons/lessons';

const lesson = (id: string) => ALL_LESSONS.find((l) => l.id === id)!;

// edits the lesson's Verilog code; every edit must match
function edit(id: string, edits: [string | RegExp, string][]): string {
  let s = lesson(id).verilog;
  for (const [from, to] of edits) {
    const n = typeof from === 'string' ? s.split(from).join(to) : s.replace(from, to);
    if (n === s) throw new Error(`${id}: edit not applied: ${from}`);
    s = n;
  }
  return s;
}

// extra XDC groups a solution needs beyond the lesson's own
const EXTRA: Record<string, Partial<Record<XdcGroup, boolean>>> = {
  decoder: { seg: true },
  alu: { seg: true },
  fsm: { sw: true },
  bin2bcd: { btn: true },
  sensors: { rgb: true },
};

const HEX7SEG = `module hex7seg (input wire [3:0] x, output reg [6:0] seg);
    always @(*) begin
${HEX_CASE_V}
    end
endmodule
`;

const SOLUTIONS: Record<string, () => string> = {
  intro: () => `module top (input wire [15:0] SW, output reg [15:0] LED);
    integer i;
    always @(*)
        for (i = 0; i < 16; i = i + 1)
            LED[i] = SW[15 - i];
endmodule`,
  gates: () =>
    edit('gates', [
      ['input  wire [1:0] SW', 'input  wire [2:0] SW'],
      ['output wire [6:0] LED', 'output wire [7:0] LED'],
      ['endmodule', '    assign LED[7] = &SW;\nendmodule'],
    ]),
  mux: () =>
    edit('mux', [
      ['output reg  [1:0]  LED', 'output reg  [2:0]  LED'],
      ['LED[0] = y2;', 'LED[0] = y2;\n        LED[2] = SW[SW[15:13]];'],
    ]),
  adder: () => edit('adder', [['wire [3:0] b = SW[7:4];', 'wire [3:0] b = SW[8] ? ~SW[7:4] : SW[7:4];']]),
  seg7: () =>
    edit('seg7', [
      ['input  wire [3:0] SW', 'input  wire [15:0] SW'],
      ['wire [3:0] x = SW;', 'wire [3:0] x = SW[3:0];'],
      ["assign DP = 1'b1;", 'assign DP = ~SW[15];'],
      ["assign AN = 8'b1111_1110;", "assign AN = 8'b0000_0000;"],
    ]),
  decoder: () =>
    edit('decoder', [
      ['output wire [15:0] LED', 'output wire [15:0] LED,\n    output wire [7:0]  AN'],
      ['endmodule', "    assign AN = ~(8'b1 << SW[1:0]) | 8'hF0;\nendmodule"],
    ]),
  shifter: () =>
    edit('shifter', [
      [
        'assign LED = {a, s2};',
        'wire [7:0] sh = left ? (a << SW[10:8]) : (a >> SW[10:8]);\n    assign LED = {a, SW[14] ? sh : s2};',
      ],
    ]),
  alu: () =>
    HEX7SEG +
    edit('alu', [
      ['output wire [15:0] LED', 'output wire [15:0] LED,\n    output wire CA, CB, CC, CD, CE, CF, CG, DP,\n    output wire [7:0] AN'],
      [
        'endmodule',
        "    wire [6:0] seg;\n    hex7seg dec (.x(r[3:0]), .seg(seg));\n    assign {CG, CF, CE, CD, CC, CB, CA} = seg;\n    assign DP = 1'b1;\n    assign AN = 8'hFE;\nendmodule",
      ],
    ]),
  ff: () =>
    edit('ff', [
      ['input  wire        BTNC,', 'input  wire        BTNC, BTNU, BTND,'],
      [
        'LED <= SW;        // capture the switches while BTNC is pressed',
        "LED <= SW;\n        else if (BTNU)\n            LED <= {LED[14:0], 1'b0};\n        else if (BTND)\n            LED <= {1'b0, LED[15:1]};",
      ],
    ]),
  counter: () => `module top #(parameter DIV = 10_000_000) (
    input  wire        CLK100MHZ,
    input  wire        CPU_RESETN,
    output reg  [15:0] LED = 16'h0001
);
    reg [31:0] cnt = 0;
    reg        dir = 0;
    always @(posedge CLK100MHZ) begin
        if (!CPU_RESETN) begin
            cnt <= 0; LED <= 16'h0001; dir <= 0;
        end else if (cnt == DIV - 1) begin
            cnt <= 0;
            if (!dir) begin
                if (LED[14]) dir <= 1;
                LED <= LED << 1;
            end else begin
                if (LED[1]) dir <= 0;
                LED <= LED >> 1;
            end
        end else
            cnt <= cnt + 1;
    end
endmodule`,
  shiftreg: () => `module top #(parameter DIV = 25_000_000) (
    input  wire        CLK100MHZ,
    input  wire        CPU_RESETN,
    input  wire [15:0] SW,
    output wire [15:0] LED
);
    reg  [31:0] cnt = 0;
    wire        tick = (cnt == DIV - 1);
    always @(posedge CLK100MHZ)
        cnt <= tick ? 0 : cnt + 1;
    reg [15:0] q = 16'h0001;
    always @(posedge CLK100MHZ)
        if (!CPU_RESETN) q <= 16'h0001;
        else if (tick)   q <= {q[14:0], q[15] ^ q[13] ^ q[12] ^ q[10]};
    assign LED = q;
endmodule`,
  multiplex: () =>
    edit('multiplex', [
      ['module top (', 'module top #(parameter DIV = 100_000_000) ('],
      ['reg  [17:0] refresh = 0;', "reg  [18:0] refresh = 0;\n    reg  [31:0] pre = 0;\n    reg  [15:0] cnt = 0;\n    always @(posedge CLK100MHZ)\n        if (pre == DIV - 1) begin pre <= 0; cnt <= cnt + 1; end\n        else pre <= pre + 1;"],
      ['wire [1:0]  digit = refresh[17:16];', 'wire [2:0]  digit = refresh[18:16];'],
      [
        /case \(digit\)[\s\S]*?endcase/,
        "case (digit)\n            3'd0: nibble = SW[3:0];\n            3'd1: nibble = SW[7:4];\n            3'd2: nibble = SW[11:8];\n            3'd3: nibble = SW[15:12];\n            3'd4: nibble = cnt[3:0];\n            3'd5: nibble = cnt[7:4];\n            3'd6: nibble = cnt[11:8];\n            default: nibble = cnt[15:12];\n        endcase",
      ],
    ]),
  stopwatch: () =>
    edit('stopwatch', [
      ['module top (', 'module top #(parameter DIV = 10_000_000) ('],
      ["reg  [23:0] ms = 0;\n    wire        tick = (ms == 24'd9_999_999);", 'reg  [31:0] ms = 0;\n    wire        tick = (ms == DIV - 1);'],
      ["ms <= tick ? 24'd0 : ms + 1;", 'ms <= tick ? 0 : ms + 1;'],
      ['reg [3:0] d0 = 0, d1 = 0, d2 = 0;', 'reg [3:0] d0 = 0, d1 = 0, d2 = 0, d3 = 0;'],
      ['d0 <= 0; d1 <= 0; d2 <= 0;', 'd0 <= 0; d1 <= 0; d2 <= 0; d3 <= 0;'],
      [
        "d2 <= (d2 == 4'd9) ? 4'd0 : d2 + 1;",
        "if (d2 != 4'd5) d2 <= d2 + 1;\n                        else begin\n                            d2 <= 0;\n                            d3 <= (d3 == 4'd9) ? 4'd0 : d3 + 1;\n                        end",
      ],
      ['default: ;                            // digit 3 stays dark', "default: begin AN[3] = 1'b0; nibble = d3; end"],
    ]),
  fsm: () =>
    edit('fsm', [
      ['module top (', 'module top #(parameter integer ONE_SECOND = 100_000_000) ('],
      ['    localparam integer ONE_SECOND = 100_000_000;\n', ''],
      ['input  wire BTNC,          // pedestrian request', 'input  wire BTNC,\n    input  wire [15:0] SW,'],
      ['if (!CPU_RESETN) begin', 'if (!CPU_RESETN || SW[0]) begin'],
      [
        '// Moore outputs',
        "reg [27:0] nt = 0;\n    reg        nb = 1'b1;\n    always @(posedge CLK100MHZ)\n        if (!SW[0]) begin nt <= 0; nb <= 1'b1; end\n        else if (nt == ONE_SECOND / 2 - 1) begin nt <= 0; nb <= ~nb; end\n        else nt <= nt + 1;\n\n    // Moore outputs",
      ],
      [
        'LED16_B = 1\'b0;',
        "LED16_B = 1'b0;\n        if (SW[0]) begin LED16_R = nb; LED16_G = nb; end",
      ],
    ]),
  debounce: () =>
    edit('debounce', [
      [
        'assign LED = {db_cnt, raw_cnt};',
        "wire dbu, dbu_tick;\n    debounce    u_dbu (.clk(CLK100MHZ), .sw(BTNU), .db(dbu));\n    edge_detect e_dbu (.clk(CLK100MHZ), .level(dbu), .tick(dbu_tick));\n    reg [15:0] r = 16'h0001;\n    always @(posedge CLK100MHZ)\n        if (dbu_tick) r <= {r[14:0], r[15]};\n    assign LED = r;",
      ],
    ]),
  bin2bcd: () =>
    edit('bin2bcd', [
      ['input  wire [15:0] SW,\n    output wire [15:0] LED,', 'input  wire [15:0] SW,\n    input  wire        BTNC,\n    output wire [15:0] LED,'],
      [".start(1'b1)", '.start(BTNC)'],
      ["assign LED = {3'b000, SW[12:0]};", "assign LED = {ready, 2'b00, SW[12:0]};"],
    ]),
  ram: () => `module top #(parameter DIV = 50_000_000) (
    input  wire        CLK100MHZ,
    input  wire [15:0] SW,
    input  wire        BTNC,
    output wire [15:0] LED
);
    reg [31:0] cnt = 0;
    reg [2:0]  i = 0;
    reg [7:0]  ch;
    always @(*)
        case (i)
            3'd0: ch = 8'h48;
            3'd1: ch = 8'h45;
            3'd2, 3'd3: ch = 8'h4C;
            default: ch = 8'h4F;
        endcase
    always @(posedge CLK100MHZ)
        if (cnt == DIV - 1) begin
            cnt <= 0;
            i <= (i == 3'd4) ? 3'd0 : i + 1;
        end else
            cnt <= cnt + 1;
    assign LED = {8'b0, ch};
endmodule`,
  pwm: () =>
    edit('pwm', [
      ['module top (', 'module top #(parameter DIV = 200_000) ('],
      [
        'wire r, g;',
        "wire r, g, br;\n    reg [31:0] c = 0;\n    reg [7:0]  d = 0;\n    reg        up = 1'b1;\n    always @(posedge CLK100MHZ)\n        if (c == DIV - 1) begin\n            c <= 0;\n            if (up) begin if (d == 8'd254) up <= 1'b0; d <= d + 1; end\n            else    begin if (d == 8'd1)   up <= 1'b1; d <= d - 1; end\n        end else c <= c + 1;\n    pwm #(.W(8)) pwm_b (.clk(CLK100MHZ), .duty(d), .pwm_o(br));",
      ],
      ['assign LED = {14\'b0, g, r};', "assign LED = {14'b0, g, br};"],
    ]),
  uart: () => edit('uart', [['868', '10417']]),
  uart_rx: () => edit('uart_rx', [['868', '10417']]),
  spi: () =>
    edit('spi', [
      ['parameter DIV = 50', 'parameter DIV = 5'],
      ["output reg        sclk = 1'b0,", "output reg        sclk = 1'b1,"],
      [
        /XFER:\n\s*if \(half\) begin[\s\S]*?\n {16}end\n/,
        "XFER:\n                if (half) begin\n                    if (sclk) begin            // falling edge: put out the next bit\n                        sclk <= 1'b0;\n                        if (n != 0) begin\n                            sh   <= {sh[6:0], 1'b0};\n                            mosi <= sh[6];\n                        end\n                    end else begin             // rising edge: both sides sample\n                        sclk <= 1'b1;\n                        rsh  <= {rsh[6:0], miso};\n                        if (n == 3'd7) state <= TAIL;\n                        else           n <= n + 1;\n                    end\n                end\n",
      ],
    ]),
  i2c: () =>
    edit('i2c', [
      ['wire       sda = !(m_low || d_low);', 'wire       d2_low;\n    wire [7:0] stored2;\n    wire       sda = !(m_low || d_low || d2_low);'],
      [
        'assign JB  = {sda, scl};',
        "i2c_device #(.ADDR(7'h49)) sensor2 (.clk(CLK100MHZ), .scl(scl), .sda(sda), .sda_low(d2_low), .data(stored2));\n\n    assign JB  = {sda, scl};",
      ],
    ]),
  sensors: () =>
    edit('sensors', [
      ['output wire [15:0] LED,', 'output wire [15:0] LED,\n    output wire        LED16_R, LED16_G, LED16_B,'],
      ["assign LED = {nack, 2'b00, t16};", "assign LED = {nack, 2'b00, t16};\n    wire hot = !neg && (t16 >= 13'd480);   // 30.0 degrees = 480 sixteenths\n    assign LED16_R = hot;\n    assign LED16_G = !hot;\n    assign LED16_B = 1'b0;"],
    ]),
  ps2: () =>
    edit('ps2', [
      [
        'wire [15:0] show = {before, last};',
        `reg  [15:0] num = 0;
    reg  [3:0]  d;
    reg         isd;
    always @(*) begin
        isd = 1'b1;
        case (code)
            8'h45: d = 4'd0;  8'h16: d = 4'd1;  8'h1E: d = 4'd2;  8'h26: d = 4'd3;  8'h25: d = 4'd4;
            8'h2E: d = 4'd5;  8'h36: d = 4'd6;  8'h3D: d = 4'd7;  8'h3E: d = 4'd8;  8'h46: d = 4'd9;
            default: begin d = 4'd0; isd = 1'b0; end
        endcase
    end
    always @(posedge CLK100MHZ)
        if (done && !brk && code != 8'hF0 && code != 8'hE0) begin
            if (isd)                num <= {num[11:0], d};
            else if (code == 8'h66) num <= 0;
        end
    wire [15:0] show = num;`,
      ],
    ]),
  softcore: () =>
    edit('softcore', [
      [
        /6'd0: {2}rom = \{LDI, {2}8'd0\};[\s\S]*?6'd11: rom = \{JMP, {2}8'd2\};/,
        `6'd0:  rom = {LDI,  8'd1};
            6'd1:  rom = {ST,   8'd0};     // x = 1
            6'd2:  rom = {LDI,  8'd2};
            6'd3:  rom = {ST,   8'd1};     // y = 2
            6'd4:  rom = {LD,   8'd0};     // loop: A = x
            6'd5:  rom = {OUT,  8'd0};
            6'd6:  rom = {WAIT, 8'd0};
            6'd7:  rom = {XORI, 8'd233};   // x == 233: start again
            6'd8:  rom = {JZ,   8'd0};
            6'd9:  rom = {LD,   8'd0};
            6'd10: rom = {ADD,  8'd1};
            6'd11: rom = {ST,   8'd2};     // t = x + y
            6'd12: rom = {LD,   8'd1};
            6'd13: rom = {ST,   8'd0};     // x = y
            6'd14: rom = {LD,   8'd2};
            6'd15: rom = {ST,   8'd1};     // y = t
            6'd16: rom = {JMP,  8'd4};`,
      ],
    ]),
  vga: () =>
    edit('vga', [
      [
        'wire [11:0] rgb   = SW[0] ? check : bar;',
        'wire        sq    = (x >= 270) && (x < 370) && (y >= 190) && (y < 290);\n    wire [11:0] rgb   = sq ? SW[15:4] : SW[0] ? check : bar;',
      ],
    ]),
};

// the testbench exercise: reset in the middle of the run and check the counter
const TB_SOLUTION = {
  verilog: (tb: string) =>
    tb.replace(
      '        $finish;',
      `        SW[0] = 1;
        repeat (8) @(posedge CLK100MHZ);
        CPU_RESETN = 0;
        repeat (3) @(posedge CLK100MHZ);
        #1;
        if (LED[7:0] !== 8'd0)
            $error("reset did not clear the counter");
        $finish;`,
    ),
  vhdl: (tb: string) =>
    tb.replace(
      '        std.env.finish;',
      `        SW(0) <= '1';
        for i in 1 to 8 loop
            wait until rising_edge(CLK100MHZ);
        end loop;
        CPU_RESETN <= '0';
        for i in 1 to 3 loop
            wait until rising_edge(CLK100MHZ);
        end loop;
        wait for 1 ns;
        assert LED(7 downto 0) = x"00" report "reset did not clear the counter" severity error;
        std.env.finish;`,
    ),
};

function grade(l: Lesson, src: string, lang: 'verilog' | 'vhdl' = 'verilog', tb?: string): GradeResult {
  return gradeExercise(
    l.id,
    { lang, src, xdc: DEFAULT_BOARD.masterXdc({ ...l.xdc, ...EXTRA[l.id] }), tb, original: lang === 'verilog' ? l.verilog : l.vhdl },
    DEFAULT_BOARD,
  );
}

const show = (r: GradeResult) => r.items.map((i) => `${i.ok ? '✓' : '✗'} ${i.en}`).join('\n');

describe('exercise checkers', () => {
  it('every lesson but the playground has an exercise', () => {
    for (const l of ALL_LESSONS) if (l.id !== 'playground') expect(EXERCISES[l.id], l.id).toBeDefined();
  });

  for (const [id, sol] of Object.entries(SOLUTIONS)) {
    it(`${id}: accepts a solution and rejects the lesson code`, () => {
      const l = lesson(id);
      const good = grade(l, sol());
      expect(good.passed, show(good)).toBe(true);
      const bad = grade(l, l.verilog);
      expect(bad.passed, show(bad)).toBe(false);
    });
  }

  for (const lang of ['verilog', 'vhdl'] as const)
    it(`testbench (${lang}): a reset check catches the broken design`, () => {
      const l = lesson('testbench');
      const tb = l.tb![lang];
      const good = grade(l, lang === 'verilog' ? l.verilog : l.vhdl, lang, TB_SOLUTION[lang](tb));
      expect(good.passed, show(good)).toBe(true);
      const bad = grade(l, lang === 'verilog' ? l.verilog : l.vhdl, lang, tb);
      expect(bad.passed, show(bad)).toBe(false);
    });

  it('reports a design that does not synthesize', () => {
    const r = grade(lesson('intro'), 'module top(input wire [15:0] SW, output wire [15:0] LED); assign LED = ; endmodule');
    expect(r.passed).toBe(false);
    expect(r.items[0].en).toMatch(/does not synthesize/);
  });

  it('asks for a missing parameter', () => {
    const r = grade(lesson('counter'), lesson('counter').verilog);
    expect(r.items[0].en).toMatch(/parameter\/generic named DIV/);
    expect(r.items[0].ok).toBe(false);
  });
});

describe('exercise checkers in VHDL', () => {
  it('uart: accepts a VHDL solution', () => {
    const l = lesson('uart');
    const r = grade(l, l.vhdl.split('868').join('10417'), 'vhdl');
    expect(r.passed, show(r)).toBe(true);
    expect(grade(l, l.vhdl, 'vhdl').passed).toBe(false);
  });
});
