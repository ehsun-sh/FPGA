// The extension board's LCD as an instrument (EBAZ4205, Phase E4.1): listens to the running design's LCD lines,
// runs them through the ST7789 model and paints the panel into a 240 x 240 canvas that the 3D board shows on the
// display. The model's warnings (a wrong start-up sequence) go to the Messages panel through onWarn.
import type { BoardView } from '../boards';
import type { Mapping } from '../boards/mapping';
import type { Runner } from '../sim/runner';
import { LCD_H, LCD_W, lcdTap, St7789, type LcdTap, type LcdWarning } from './st7789';

export class LcdScreen {
  canvas = document.createElement('canvas');
  model: St7789;
  onWarn: (w: LcdWarning) => void = () => {};
  private tap: LcdTap | null = null;
  private img: ImageData;
  private lit = false;

  constructor(
    clockHz: number,
    private view: BoardView,
    private runner: Runner,
  ) {
    this.canvas.width = LCD_W;
    this.canvas.height = LCD_H;
    this.model = new St7789(clockHz);
    this.model.onWarn = (w) => this.onWarn(w);
    this.img = new ImageData(LCD_W, LCD_H);
  }

  // true when the design drives the LCD
  get connected() {
    return !!this.tap;
  }

  setDesign(mapping: Mapping | null) {
    this.tap = mapping && this.runner.sim ? lcdTap(mapping.bindings) : null;
    if (!this.tap) {
      this.runner.setProbe('lcd', null);
      this.view.setLcd?.(null);
      return;
    }
    const tap = this.tap;
    const restart = () => this.model.restart(this.runner.now, tap.read(this.runner.sim!.v));
    restart();
    this.runner.setProbe('lcd', {
      sigs: tap.sigs,
      onSample: (t) => {
        if (this.runner.sim) this.model.feed(t, tap.read(this.runner.sim.v));
      },
      onRestart: restart,
    });
    this.view.setLcd?.(this.canvas);
    this.paint();
  }

  // once per animation frame: repaint when the frame memory or the panel's state changed
  frame() {
    if (!this.tap) return;
    if (this.model.dirty || this.model.lit !== this.lit) this.paint();
  }

  private paint() {
    this.lit = this.model.lit;
    this.model.render(this.img.data);
    this.canvas.getContext('2d')!.putImageData(this.img, 0, 0);
    this.view.refreshLcd?.();
  }
}
