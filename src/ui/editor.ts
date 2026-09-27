import { StreamLanguage } from '@codemirror/language';
import { tcl } from '@codemirror/legacy-modes/mode/tcl';
import { verilog } from '@codemirror/legacy-modes/mode/verilog';
import { vhdl } from '@codemirror/legacy-modes/mode/vhdl';
import { linter, lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { indentWithTab } from '@codemirror/commands';

export type EditorLang = 'verilog' | 'vhdl' | 'xdc';

const langExt = (l: EditorLang) => StreamLanguage.define(l === 'verilog' ? verilog : l === 'vhdl' ? vhdl : tcl);

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '13px' },
  '.cm-scroller': { fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace', lineHeight: '1.5' },
  '.cm-gutters': { background: 'var(--editor-gutter)', borderRight: '1px solid var(--line)', color: 'var(--muted)' },
  '.cm-activeLineGutter': { background: 'var(--editor-active)' },
  '.cm-activeLine': { background: 'var(--editor-active)' },
  '&.cm-focused': { outline: 'none' },
});

export class CodeEditor {
  view: EditorView;
  private lang = new Compartment();
  private readOnly = new Compartment();
  onChange: (text: string) => void = () => {};

  constructor(parent: HTMLElement, lang: EditorLang, doc = '') {
    this.view = new EditorView({
      parent,
      state: EditorState.create({
        doc,
        extensions: [
          basicSetup,
          keymap.of([indentWithTab]),
          this.lang.of(langExt(lang)),
          this.readOnly.of(EditorState.readOnly.of(false)),
          theme,
          lintGutter(),
          linter(null),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) this.onChange(u.state.doc.toString());
          }),
        ],
      }),
    });
  }

  get text(): string {
    return this.view.state.doc.toString();
  }

  setText(text: string, lang?: EditorLang) {
    const effects = lang ? [this.lang.reconfigure(langExt(lang))] : [];
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: text }, effects });
    this.view.dispatch(setDiagnostics(this.view.state, []));
  }

  markError(line: number | undefined, col: number | undefined, message: string, severity: 'error' | 'warning' = 'error') {
    const doc = this.view.state.doc;
    if (!line || line < 1 || line > doc.lines) {
      this.view.dispatch(setDiagnostics(this.view.state, []));
      return;
    }
    const l = doc.line(line);
    const from = Math.min(l.to, l.from + Math.max(0, (col ?? 1) - 1));
    const d: Diagnostic = { from, to: Math.max(from + 1, l.to), severity, message };
    if (d.to > doc.length) d.to = doc.length;
    this.view.dispatch(setDiagnostics(this.view.state, [d]));
  }

  clearMarks() {
    this.view.dispatch(setDiagnostics(this.view.state, []));
  }

  goto(line: number) {
    const doc = this.view.state.doc;
    if (line < 1 || line > doc.lines) return;
    const l = doc.line(line);
    this.view.dispatch({ selection: { anchor: l.from }, effects: EditorView.scrollIntoView(l.from, { y: 'center' }) });
    this.view.focus();
  }
}
