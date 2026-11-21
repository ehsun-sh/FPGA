// x-tone: a square-wave tone generator that plays a C-major scale up and down on the audio jack
// (EBAZEXT-V2: AUDIO_L/AUDIO_R go through an RC low-pass to the 3.5 mm jack, so a square wave is heard as a tone).
// The note table is computed from CLK_HZ; NOTE_TICKS sets how long each note lasts.
// Checkers and tests shrink CLK_HZ and NOTE_TICKS so a whole scale fits in a short run.
module top #(
    parameter CLK_HZ     = 50_000_000,
    parameter NOTE_TICKS = 12_500_000      // 0.25 s per note at 50 MHz
) (
    input  wire clk,
    input  wire KEY0,                      // hold to mute: KEY0 is active low (10 kOhm pull-up, pressed = 0)
    output wire AUDIO_L,
    output wire AUDIO_R
);
    // half periods for C4 D4 E4 F4 G4 A4 B4 C5 (262 294 330 349 392 440 494 523 Hz)
    reg [3:0]  step = 0;                    // 0..13: up 0..7, down 6..1
    reg [2:0]  note;
    always @(*) begin
        if (step < 8) note = step[2:0];
        else          note = 14 - step;
    end
    reg [23:0] half;
    always @(*) begin
        case (note)
            3'd0: half = CLK_HZ / 524;
            3'd1: half = CLK_HZ / 588;
            3'd2: half = CLK_HZ / 660;
            3'd3: half = CLK_HZ / 698;
            3'd4: half = CLK_HZ / 784;
            3'd5: half = CLK_HZ / 880;
            3'd6: half = CLK_HZ / 988;
            default: half = CLK_HZ / 1046;
        endcase
    end

    reg        wave = 0;
    assign AUDIO_L = wave;
    assign AUDIO_R = wave;

    reg [23:0] pcnt = 0;   // tone period counter
    reg [23:0] ncnt = 0;   // note length counter
    always @(posedge clk) begin
        if (pcnt >= half - 1) begin
            pcnt   <= 0;
            wave   <= KEY0 ? ~wave : 1'b0;
        end else
            pcnt <= pcnt + 1;

        if (ncnt == NOTE_TICKS - 1) begin
            ncnt <= 0;
            step <= (step == 13) ? 4'd0 : step + 1;
            pcnt <= 0;
        end else
            ncnt <= ncnt + 1;
    end
endmodule
