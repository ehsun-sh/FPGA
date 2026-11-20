// x-hdmi-tmds: one TMDS channel encoder (DVI 1.0, section 3.2.2), written without functions
// so the FPGA Lab simulator can run it. d = pixel byte, c = {C1, C0} control bits, de = video data enable.
// The running disparity is kept in a 5-bit two's-complement register; cnt[4] is its sign.
module tmds_encoder (
    input  wire       clk,
    input  wire [7:0] d,
    input  wire [1:0] c,
    input  wire       de,
    output reg  [9:0] q = 10'b1101010100
);
    // stage 1: transition-minimised 9-bit word
    wire [3:0] n1d = d[0] + d[1] + d[2] + d[3] + d[4] + d[5] + d[6] + d[7];
    wire       x   = (n1d > 4) || (n1d == 4 && d[0] == 1'b0);   // 1: use XNOR
    wire [8:0] qm;
    assign qm[0] = d[0];
    assign qm[1] = qm[0] ^ d[1] ^ x;
    assign qm[2] = qm[1] ^ d[2] ^ x;
    assign qm[3] = qm[2] ^ d[3] ^ x;
    assign qm[4] = qm[3] ^ d[4] ^ x;
    assign qm[5] = qm[4] ^ d[5] ^ x;
    assign qm[6] = qm[5] ^ d[6] ^ x;
    assign qm[7] = qm[6] ^ d[7] ^ x;
    assign qm[8] = ~x;

    // stage 2: DC balance
    wire [3:0] n1q  = qm[0] + qm[1] + qm[2] + qm[3] + qm[4] + qm[5] + qm[6] + qm[7];
    wire [4:0] diff = {1'b0, n1q, 1'b0} - 5'd8;     // n1q - n0q = 2*n1q - 8
    reg  [4:0] cnt = 0;
    wire       cnt_zero = (cnt == 0);
    wire       cnt_pos  = !cnt[4] && !cnt_zero;
    wire       cnt_neg  = cnt[4];
    wire       bal      = (n1q == 4);
    wire       more1    = (n1q > 4);
    wire       more0    = (n1q < 4);

    always @(posedge clk) begin
        if (!de) begin
            cnt <= 0;
            case (c)
                2'b00: q <= 10'b1101010100;
                2'b01: q <= 10'b0010101011;
                2'b10: q <= 10'b0101010100;
                default: q <= 10'b1010101011;
            endcase
        end else if (cnt_zero || bal) begin
            q <= {~qm[8], qm[8], qm[8] ? qm[7:0] : ~qm[7:0]};
            cnt <= qm[8] ? cnt + diff : cnt - diff;
        end else if ((cnt_pos && more1) || (cnt_neg && more0)) begin
            q <= {1'b1, qm[8], ~qm[7:0]};
            cnt <= cnt + {3'b000, qm[8], 1'b0} - diff;
        end else begin
            q <= {1'b0, qm[8], qm[7:0]};
            cnt <= cnt - {3'b000, ~qm[8], 1'b0} + diff;
        end
    end
endmodule
