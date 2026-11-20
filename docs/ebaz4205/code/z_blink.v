// z-blink: the first PL design on the EBAZ4205.
// clk comes from the PS (FCLK_CLK0 = 50 MHz); the board has no PL oscillator unless X5 is fitted.
// LED_R (W14) and LED_G (W13) blink in turn, once per second.
module top #(parameter DIV = 25_000_000) (
    input  wire clk,
    output wire LED_R,
    output wire LED_G
);
    reg [24:0] cnt = 0;
    reg        tick = 0;
    always @(posedge clk) begin
        if (cnt == DIV - 1) begin
            cnt  <= 0;
            tick <= ~tick;
        end else
            cnt <= cnt + 1;
    end
    assign LED_R = tick;
    assign LED_G = ~tick;
endmodule
