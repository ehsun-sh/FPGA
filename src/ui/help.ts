// Help in both workbench modes: the "?" menu in the top bar, the keyboard-shortcuts dialog and the simulator-limits
// dialog. The limits carry stable ids (lim-*) so error messages can link to the matching item.
import { icon } from './icons';
import type { UiLang } from './strings';

export const HELP = {
  fa: {
    help: 'راهنما',
    tour: 'گشت آشنایی',
    shortcuts: 'میان‌برهای صفحه‌کلید',
    limits: 'محدودیت‌های شبیه‌ساز',
    downloads: 'دانلودها',
    dlSrc: 'کد طرح',
    dlTb: 'Testbench',
    dlXdc: 'فایل قیود (.xdc)',
    dlProject: 'پروژه‌ی Vivado (.zip)',
    report: 'گزارش مشکل',
    about: 'درباره‌ی FPGA Lab',
    close: 'بستن',
    keys: [
      ['Ctrl+Enter', 'Run on Board'],
      ['Shift+F6', 'Simulate (Testbench)'],
      ['F5', 'Reset و اجرای دوباره'],
      ['Ctrl+L', 'Logic Analyzer'],
      ['Ctrl+M', 'Serial Console'],
      ['Esc', 'بستن منوها و پنجره‌ها'],
    ],
    limitsIntro: 'شبیه‌ساز داخل مرورگر بخشی از Verilog و VHDL را پشتیبانی می‌کند. این‌ها چیزهایی است که هنوز ندارد:',
    lims: [
      ['lim-xz', 'فقط دو حالت ۰ و ۱ وجود دارد؛ مقدار X (نامعلوم) شبیه‌سازی نمی‌شود.'],
      ['lim-z', 'مقدار z (امپدانس بالا) فقط روی پورت‌های inout ماژول اصلی کار می‌کند.'],
      ['lim-width', 'بردارها حداکثر ۳۲ بیت پهنا دارند.'],
      ['lim-generate', 'ساختار generate پشتیبانی نمی‌شود.'],
      ['lim-function', 'function و task پشتیبانی نمی‌شوند.'],
      ['lim-package', 'در VHDL فقط بسته‌های ieee.std_logic_1164 و numeric_std در دسترس‌اند.'],
      ['lim-clock', 'طرح فقط یک حوزه‌ی کلاک دارد.'],
      ['lim-estimate', 'اعداد زمان‌بندی و منابع مصرفی تخمین FPGA Lab است، نه نتیجه‌ی اجرای واقعی Vivado.'],
    ],
  },
  en: {
    help: 'Help',
    tour: 'Take the tour',
    shortcuts: 'Keyboard shortcuts',
    limits: 'Simulator limits',
    downloads: 'Downloads',
    dlSrc: 'Design source',
    dlTb: 'Testbench',
    dlXdc: 'Constraints (.xdc)',
    dlProject: 'Vivado project (.zip)',
    report: 'Report a problem',
    about: 'About FPGA Lab',
    close: 'Close',
    keys: [
      ['Ctrl+Enter', 'Run on Board'],
      ['Shift+F6', 'Simulate (testbench)'],
      ['F5', 'Reset and run again'],
      ['Ctrl+L', 'Logic Analyzer'],
      ['Ctrl+M', 'Serial Console'],
      ['Esc', 'Close menus and windows'],
    ],
    limitsIntro: 'The in-browser simulator supports a subset of Verilog and VHDL. This is what it does not do yet:',
    lims: [
      ['lim-xz', 'Two-state only: signals are 0 or 1, there is no X (unknown).'],
      ['lim-z', 'z (high impedance) only works on inout ports of the top module.'],
      ['lim-width', 'Vectors are at most 32 bits wide.'],
      ['lim-generate', 'No generate blocks.'],
      ['lim-function', 'No functions or tasks.'],
      ['lim-package', 'In VHDL, no packages beyond ieee.std_logic_1164 and numeric_std.'],
      ['lim-clock', 'A single clock domain.'],
      ['lim-estimate', 'Timing and utilization numbers are estimates, not a Vivado run.'],
    ],
  },
} satisfies Record<UiLang, unknown>;

export const ISSUES_URL = 'https://github.com/ehsun-sh/FPGA/issues/new';

// the "?" button and its menu; `where` keeps the ids apart (the landing page and the workbench each have one)
export function helpMenu(lang: UiLang, where: string): string {
  const h = HELP[lang];
  const item = (act: string, label: string) => `<button role="menuitem" data-act="${act}" tabindex="-1">${label}</button>`;
  return `<div class="lang-dd help-dd">
    <button class="lang-btn help-btn" data-act="help-menu" aria-haspopup="menu" aria-expanded="false" aria-controls="help-menu-${where}" aria-label="${h.help}" title="${h.help}">?</button>
    <div class="lang-menu help-menu" id="help-menu-${where}" dir="${lang === 'fa' ? 'rtl' : 'ltr'}" role="menu" aria-label="${h.help}" hidden>
      ${item('tour', h.tour)}${item('shortcuts', h.shortcuts)}${item('limits', h.limits)}
      <div class="menu-h" role="presentation">${h.downloads}</div>
      ${item('download-src', h.dlSrc)}${item('download-tb', h.dlTb)}${item('download-xdc', h.dlXdc)}${item('download-project', h.dlProject)}
      <hr role="separator"/>
      <a role="menuitem" tabindex="-1" href="${ISSUES_URL}" target="_blank" rel="noopener">${h.report}${icon('external', 13)}</a>
      ${item('about', h.about)}
    </div>
  </div>`;
}

export function shortcutsDialog(lang: UiLang): string {
  const h = HELP[lang];
  return `<form method="dialog" dir="${lang === 'fa' ? 'rtl' : 'ltr'}" lang="${lang}"><h2>${h.shortcuts}</h2>
<table class="keys"><tbody>${h.keys.map(([k, d]) => `<tr><td dir="ltr"><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('')}</tbody></table>
<button>${h.close}</button></form>`;
}

export function limitsDialog(lang: UiLang): string {
  const h = HELP[lang];
  return `<form method="dialog" dir="${lang === 'fa' ? 'rtl' : 'ltr'}" lang="${lang}"><h2>${h.limits}</h2><p>${h.limitsIntro}</p>
<ul class="limits">${h.lims.map(([id, t]) => `<li id="${id}">${t}</li>`).join('')}</ul>
<button>${h.close}</button></form>`;
}
