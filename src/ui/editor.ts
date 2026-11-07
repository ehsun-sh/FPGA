import { HighlightStyle, StreamLanguage, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
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

// The editor is dark in both site themes; every colour is a token from theme.css, so it follows the theme switch.
const theme = EditorView.theme(
  {
    '&': { height: '100%', fontSize: '13px', background: 'var(--editor-bg)', color: 'var(--editor-text)' },
    '.cm-scroller': { fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, monospace', lineHeight: '1.5' },
    '.cm-content': { caretColor: 'var(--editor-cursor)' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--editor-cursor)' },
    '.cm-gutters': { background: 'var(--editor-gutter)', borderRight: '1px solid var(--editor-active)', color: 'var(--editor-muted)' },
    '.cm-activeLineGutter': { background: 'var(--editor-active)', color: 'var(--editor-text)' },
    '.cm-activeLine': { background: 'var(--editor-active)' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      background: 'var(--editor-sel) !important',
    },
    '.cm-selectionMatch': { background: 'rgba(127, 180, 255, 0.18)' },
    '&.cm-focused .cm-matchingBracket': { background: 'rgba(127, 180, 255, 0.25)', outline: 'none' },
    '.cm-foldPlaceholder': { background: 'var(--editor-active)', border: 'none', color: 'var(--editor-muted)' },
    '.cm-tooltip': { background: 'var(--panel)', color: 'var(--text)', border: '1px solid var(--line)' },
    '.cm-panels': { background: 'var(--editor-gutter)', color: 'var(--editor-text)' },
    '&.cm-focused': { outline: 'none' },
  },
  { dark: true },
);

const syntax = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.modifier], color: 'var(--syn-kw)', fontWeight: '600' },
  { tag: [t.typeName, t.standard(t.variableName), t.atom, t.bool], color: 'var(--syn-type)' },
  { tag: [t.number, t.integer, t.float], color: 'var(--syn-num)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--syn-str)' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.meta], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [t.operator, t.punctuation, t.bracket], color: 'var(--syn-op)' },
  { tag: [t.variableName, t.name, t.propertyName], color: 'var(--editor-text)' },
]);

export class CodeEditor {
  view: EditorView;
  private lang = new Compartment();
  private readOnly = new Compartment();
  onChange: (text: string) => void = () => {};
  // true while setText() is replacing the document (so onChange can tell user edits apart)
  programmatic = false;

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
          syntaxHighlighting(syntax),
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
    this.programmatic = true;
    this.view.dispatch({ changes: { from: 0, to: this.view.state.doc.length, insert: text }, effects });
    this.programmatic = false;
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
