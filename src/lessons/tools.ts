// The bench instruments a lesson works with (logic analyzer, serial console, VGA monitor, add-on modules), shown as
// icons on the lesson in the course lists and explained at the top of the lesson.
import type { Lesson } from './lessons';

export type Tool = 'la' | 'serial' | 'vga' | 'modules';
type L = 'fa' | 'en';

const DECODER: Record<string, string> = { uart: 'UART', spi: 'SPI', i2c: 'I²C', ps2: 'PS/2' };
const MODULE: Record<string, Record<L, string>> = {
  tmp: { fa: 'سنسور دمای ADT7420', en: 'the ADT7420 temperature sensor' },
  acl: { fa: 'شتاب‌سنج ADXL362', en: 'the ADXL362 accelerometer' },
  ps2: { fa: 'صفحه‌کلید PS/2', en: 'the PS/2 keyboard' },
};
const list = (xs: string[], lang: L) =>
  xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(lang === 'fa' ? '، ' : ', ')}${lang === 'fa' ? ' و ' : ' and '}${xs[xs.length - 1]}`;

export const TOOLS: Record<Tool, { icon: 'logic' | 'terminal' | 'monitor' | 'plug'; act: string; name: string; desc: (l: Lesson, lang: L) => string }> = {
  la: {
    icon: 'logic',
    act: 'la',
    name: 'Logic Analyzer',
    desc: (l, lang) => {
      const dec = [...new Set((l.la?.decs ?? []).map((d) => DECODER[d.type]).filter(Boolean))];
      const d = dec.length ? list(dec, lang) : '';
      return lang === 'fa'
        ? `پایه‌های این درس روی کانال‌های آن قرار گرفته‌اند. بعد از Run on Board بازش کنید تا سیگنال‌ها را در طول زمان ببینید${d ? ` و داده‌های ${d} را رمزگشایی‌شده بخوانید` : ''}.`
        : `This lesson's pins are already on its channels. Open it after Run on Board to watch the signals over time${d ? ` and read the decoded ${d} data` : ''}.`;
    },
  },
  serial: {
    icon: 'terminal',
    act: 'serial',
    name: 'Serial Console',
    desc: (_l, lang) =>
      lang === 'fa'
        ? 'بایت‌هایی که FPGA روی USB-UART می‌فرستد اینجا نمایش داده می‌شوند و از همین‌جا می‌توانید به FPGA داده بفرستید.'
        : 'Shows the bytes the FPGA sends over the USB-UART, and sends your typing back to it.',
  },
  vga: {
    icon: 'monitor',
    act: 'vga',
    name: 'VGA Monitor',
    desc: (_l, lang) =>
      lang === 'fa' ? 'تصویری که طرح روی درگاه VGA می‌سازد روی یک مانیتور مجازی کنار برد دیده می‌شود.' : 'The picture your design drives onto the VGA port appears on a virtual monitor next to the board.',
  },
  modules: {
    icon: 'plug',
    act: 'modules',
    name: 'Modules',
    desc: (l, lang) => {
      const m = list(
        Object.keys(MODULE)
          .filter((g) => l.xdc[g as keyof Lesson['xdc']])
          .map((g) => MODULE[g][lang]),
        lang,
      );
      return lang === 'fa'
        ? `${m} در پنل Modules کنار برد است. از آنجا ورودی‌اش را تغییر دهید و ببینید طرح چه می‌خواند.`
        : `${m[0].toUpperCase()}${m.slice(1)} lives in the Modules panel next to the board. Change its input there and see what the design reads.`;
    },
  },
};

// the instruments that are part of the lesson: a hand-made analyzer setup or a clocked design (whose signals change
// over time), the USB-UART, the VGA port, an on-board sensor or keyboard
export function lessonTools(l: Lesson): Tool[] {
  const x = l.xdc;
  return (
    [
      ['la', !!l.la || !!x.clk],
      ['serial', !!x.uart],
      ['vga', !!x.vga],
      ['modules', !!(x.tmp || x.acl || x.ps2)],
    ] as [Tool, boolean][]
  )
    .filter(([, on]) => on)
    .map(([t]) => t);
}
