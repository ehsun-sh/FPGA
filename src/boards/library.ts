// Board library modules: parts of a design that real hardware builds from FPGA primitives the simulator does not
// model. A lesson's code instantiates them by name; the simulator appends a behavioural stand-in when the design
// uses one and does not define it itself, and the Vivado project gets the real module instead (src/synth/project.ts).
//
// tmds_serializer (EBAZ4205 extension board, HDMI lessons): takes the three 10-bit TMDS symbols of a pixel and drives
// the four HDMI pairs. Real hardware: an MMCM makes the 25 MHz pixel clock and the 125 MHz bit clock from
// FCLK_CLK0, two cascaded OSERDESE2 per lane shift the symbols out at 250 Mbit/s (10:1, DDR) and OBUFDS drive the
// TMDS_33 pairs. In the simulator the symbols go to the HDMI monitor through fpgalab_hdmi_tap (src/vga/hdmi.ts);
// the pins only carry a slow picture of the clock lane.
import type { Lang } from '../hdl';

export const TMDS_SERIALIZER_SIM_V = `
// ---- FPGA Lab: simulation stand-in for tmds_serializer (added because the design uses it; Vivado gets the real
// OSERDESE2 serializer instead). It hands the symbols to the HDMI monitor through fpgalab_hdmi_tap.
module tmds_serializer (
    input  wire       clk,
    input  wire [9:0] d0, d1, d2,
    output wire clk_p, clk_n, d0_p, d0_n, d1_p, d1_n, d2_p, d2_n
);
    wire [29:0] fpgalab_hdmi_tap = {d2, d1, d0};
    reg  half = 1'b0;
    always @(posedge clk) half <= ~half;
    assign clk_p = half;
    assign clk_n = ~half;
    assign d0_p = d0[0];
    assign d0_n = ~d0[0];
    assign d1_p = d1[0];
    assign d1_n = ~d1[0];
    assign d2_p = d2[0];
    assign d2_n = ~d2[0];
endmodule
`;

export const TMDS_SERIALIZER_SIM_VHD = `
-- ---- FPGA Lab: simulation stand-in for tmds_serializer (added because the design uses it; Vivado gets the real
-- OSERDESE2 serializer instead). It hands the symbols to the HDMI monitor through fpgalab_hdmi_tap.
library ieee;
use ieee.std_logic_1164.all;

entity tmds_serializer is
    port (
        clk                                            : in  std_logic;
        d0, d1, d2                                     : in  std_logic_vector(9 downto 0);
        clk_p, clk_n, d0_p, d0_n, d1_p, d1_n, d2_p, d2_n : out std_logic
    );
end entity;

architecture sim of tmds_serializer is
    signal fpgalab_hdmi_tap : std_logic_vector(29 downto 0);
    signal half             : std_logic := '0';
begin
    fpgalab_hdmi_tap <= d2 & d1 & d0;
    process (clk)
    begin
        if rising_edge(clk) then
            half <= not half;
        end if;
    end process;
    clk_p <= half;
    clk_n <= not half;
    d0_p  <= d0(0);
    d0_n  <= not d0(0);
    d1_p  <= d1(0);
    d1_n  <= not d1(0);
    d2_p  <= d2(0);
    d2_n  <= not d2(0);
end architecture;
`;

// The real serializer for Vivado (Verilog; a VHDL design instantiates it as a component, Vivado mixes the two).
// Port names are lower case so that VHDL and Verilog agree on them.
export const TMDS_SERIALIZER_V = `// tmds_serializer: HDMI/DVI output for the EBAZ4205 extension board (FPGA Lab).
// clk = FCLK_CLK0 (50 MHz). An MMCM makes the 25 MHz pixel clock and the 125 MHz bit clock (5x, used on both edges:
// 250 Mbit/s). d0, d1, d2 are the TMDS symbols of channel 0 (blue, HSYNC/VSYNC), 1 (green) and 2 (red); each one
// is held for two clk cycles (one pixel) and is sampled once by the pixel clock. Bit 0 goes out first.
// Two cascaded OSERDESE2 make a 10:1 serializer per lane; OBUFDS with TMDS_33 drives the pair.
module tmds_serializer (
    input  wire       clk,
    input  wire [9:0] d0, d1, d2,
    output wire clk_p, clk_n, d0_p, d0_n, d1_p, d1_n, d2_p, d2_n
);
    wire fb, fb_buf, pclk_u, sclk_u, pclk, sclk, locked;
    MMCME2_BASE #(
        .CLKIN1_PERIOD   (20.0),   // 50 MHz in
        .DIVCLK_DIVIDE   (1),
        .CLKFBOUT_MULT_F (20.0),   // VCO 1000 MHz
        .CLKOUT0_DIVIDE_F(8.0),    // 125 MHz bit clock (DDR)
        .CLKOUT1_DIVIDE  (40)      // 25 MHz pixel clock
    ) mmcm (
        .CLKIN1(clk), .CLKFBIN(fb_buf), .CLKFBOUT(fb), .CLKFBOUTB(),
        .CLKOUT0(sclk_u), .CLKOUT0B(), .CLKOUT1(pclk_u), .CLKOUT1B(),
        .CLKOUT2(), .CLKOUT2B(), .CLKOUT3(), .CLKOUT3B(), .CLKOUT4(), .CLKOUT5(), .CLKOUT6(),
        .LOCKED(locked), .PWRDWN(1'b0), .RST(1'b0)
    );
    BUFG bufg_fb (.I(fb), .O(fb_buf));
    BUFG bufg_p  (.I(pclk_u), .O(pclk));
    BUFG bufg_s  (.I(sclk_u), .O(sclk));

    // hold the serializers in reset until the MMCM has locked
    reg [3:0] rst_sr = 4'hF;
    always @(posedge pclk or negedge locked)
        if (!locked) rst_sr <= 4'hF;
        else         rst_sr <= {rst_sr[2:0], 1'b0};
    wire rst = rst_sr[3];

    // the symbols into the pixel clock domain (the MMCM keeps pclk in phase with clk)
    reg [9:0] s0 = 0, s1 = 0, s2 = 0;
    always @(posedge pclk) begin
        s0 <= d0;
        s1 <= d1;
        s2 <= d2;
    end

    tmds_lane lane0 (.pclk(pclk), .sclk(sclk), .rst(rst), .d(s0), .p(d0_p), .n(d0_n));
    tmds_lane lane1 (.pclk(pclk), .sclk(sclk), .rst(rst), .d(s1), .p(d1_p), .n(d1_n));
    tmds_lane lane2 (.pclk(pclk), .sclk(sclk), .rst(rst), .d(s2), .p(d2_p), .n(d2_n));
    // the clock lane sends five ones and five zeros: one TMDS clock period per pixel
    tmds_lane lanec (.pclk(pclk), .sclk(sclk), .rst(rst), .d(10'b0000011111), .p(clk_p), .n(clk_n));
endmodule

module tmds_lane (
    input  wire       pclk, sclk, rst,
    input  wire [9:0] d,
    output wire       p, n
);
    wire ser, sh1, sh2;
    OSERDESE2 #(
        .DATA_RATE_OQ("DDR"), .DATA_RATE_TQ("SDR"), .DATA_WIDTH(10),
        .SERDES_MODE("MASTER"), .TRISTATE_WIDTH(1), .TBYTE_CTL("FALSE"), .TBYTE_SRC("FALSE")
    ) master (
        .OQ(ser), .OFB(), .TQ(), .TFB(), .SHIFTOUT1(), .SHIFTOUT2(), .TBYTEOUT(),
        .CLK(sclk), .CLKDIV(pclk), .RST(rst), .OCE(1'b1), .TCE(1'b0), .TBYTEIN(1'b0),
        .D1(d[0]), .D2(d[1]), .D3(d[2]), .D4(d[3]), .D5(d[4]), .D6(d[5]), .D7(d[6]), .D8(d[7]),
        .SHIFTIN1(sh1), .SHIFTIN2(sh2),
        .T1(1'b0), .T2(1'b0), .T3(1'b0), .T4(1'b0)
    );
    OSERDESE2 #(
        .DATA_RATE_OQ("DDR"), .DATA_RATE_TQ("SDR"), .DATA_WIDTH(10),
        .SERDES_MODE("SLAVE"), .TRISTATE_WIDTH(1), .TBYTE_CTL("FALSE"), .TBYTE_SRC("FALSE")
    ) slave (
        .OQ(), .OFB(), .TQ(), .TFB(), .SHIFTOUT1(sh1), .SHIFTOUT2(sh2), .TBYTEOUT(),
        .CLK(sclk), .CLKDIV(pclk), .RST(rst), .OCE(1'b1), .TCE(1'b0), .TBYTEIN(1'b0),
        .D1(1'b0), .D2(1'b0), .D3(d[8]), .D4(d[9]), .D5(1'b0), .D6(1'b0), .D7(1'b0), .D8(1'b0),
        .SHIFTIN1(1'b0), .SHIFTIN2(1'b0),
        .T1(1'b0), .T2(1'b0), .T3(1'b0), .T4(1'b0)
    );
    OBUFDS #(.IOSTANDARD("TMDS_33")) obuf (.I(ser), .O(p), .OB(n));
endmodule
`;

const uses = (src: string, name: string) => new RegExp(`\\b${name}\\b`, 'i').test(src.replace(/\/\/.*$|--.*$/gm, ''));
const defines = (src: string, name: string, lang: Lang) =>
  (lang === 'verilog' ? new RegExp(`^\\s*module\\s+${name}\\b`, 'm') : new RegExp(`^\\s*entity\\s+${name}\\s+is`, 'im')).test(src);

// the library modules a design uses but does not define
export function libraryModules(src: string, lang: Lang): string[] {
  return uses(src, 'tmds_serializer') && !defines(src, 'tmds_serializer', lang) ? ['tmds_serializer'] : [];
}

// the design with the simulator's stand-ins appended (after the learner's code, so line numbers do not move and
// the learner's top stays the top: the stand-in is instantiated, so it is not a root)
export function withLibrary(src: string, lang: Lang): string {
  const mods = libraryModules(src, lang);
  if (!mods.length) return src;
  return src + (lang === 'verilog' ? TMDS_SERIALIZER_SIM_V : TMDS_SERIALIZER_SIM_VHD);
}
