// "Buzzer sound" (EBAZ4205 extension board): plays the buzzer pin's frequency through the computer's speaker with
// Web Audio. The runner measures the pin's square wave in board time (BoardOutputs.buzzer, Hz); a square-wave
// oscillator plays the same pitch, quietly. Off by default: a page may only start audio after a click.
export class BuzzerSound {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private hz = 0;
  on = false;

  enable(on: boolean) {
    this.on = on;
    if (on && !this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.ctx.destination);
      this.osc = this.ctx.createOscillator();
      this.osc.type = 'square';
      this.osc.connect(this.gain);
      this.osc.start();
    }
    if (on) void this.ctx?.resume();
    this.set(on ? this.hz : 0, true);
  }

  // the buzzer's frequency now (0 = quiet); called every animation frame
  set(hz: number, force = false) {
    if (!force && Math.abs(hz - this.hz) < 0.5) return;
    this.hz = hz;
    const c = this.ctx;
    if (!c || !this.osc || !this.gain) return;
    const audible = this.on && hz >= 20 && hz <= 20000;
    if (audible) this.osc.frequency.setTargetAtTime(hz, c.currentTime, 0.005);
    this.gain.gain.setTargetAtTime(audible ? 0.04 : 0, c.currentTime, 0.01);
  }
}
