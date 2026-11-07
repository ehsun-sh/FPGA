// Tiny syntax highlighter for read-only code blocks in lessons.
const VERILOG_KW =
  'module endmodule input output inout parameter localparam assign always always_ff always_comb initial begin end if else case casez casex endcase default for posedge negedge or signed genvar';
const VHDL_KW =
  'library use all entity is port in out inout buffer end architecture of begin signal constant variable type process if then elsif else case when others select with and or not xor nand nor xnor downto to loop for generic map component range array rising_edge falling_edge work null';
// type names get their own colour (--syn-type)
const VERILOG_TYPES = 'wire reg logic integer';
const VHDL_TYPES = 'integer natural std_logic std_logic_vector unsigned signed boolean bit bit_vector';

export function highlight(code: string, lang: 'verilog' | 'vhdl'): string {
  const kws = new Set((lang === 'verilog' ? VERILOG_KW : VHDL_KW).split(' '));
  const types = new Set((lang === 'verilog' ? VERILOG_TYPES : VHDL_TYPES).split(' '));
  const re =
    lang === 'verilog'
      ? /(\/\/[^\n]*)|("(?:[^"\\]|\\.)*")|(\d*'[sS]?[bodhBODH][0-9a-fA-FxXzZ_?]+|\b\d[\d_]*\b)|([A-Za-z_$][\w$]*)|([\s\S])/g
      : /(--[^\n]*)|("[^"]*"|[xXbBoO]"[^"]*"|'.')|(\b\d[\d_]*\b)|([A-Za-z_][\w]*)|([\s\S])/g;
  let out = '';
  let m: RegExpExecArray | null;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  while ((m = re.exec(code))) {
    if (m[1]) out += `<span class="hl-c">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="hl-s">${esc(m[2])}</span>`;
    else if (m[3]) out += `<span class="hl-n">${esc(m[3])}</span>`;
    else if (m[4]) {
      const w = lang === 'vhdl' ? m[4].toLowerCase() : m[4];
      out += kws.has(w) ? `<span class="hl-k">${esc(m[4])}</span>` : types.has(w) ? `<span class="hl-t">${esc(m[4])}</span>` : esc(m[4]);
    } else out += esc(m[5]);
  }
  return out;
}
