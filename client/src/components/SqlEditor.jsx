import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--syn-keyword)', fontWeight: '600' },
  { tag: [t.string, t.special(t.string)], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.null], color: 'var(--syn-number)' },
  {
    tag: [t.lineComment, t.blockComment],
    color: 'var(--muted)',
    fontStyle: 'italic',
  },
  { tag: [t.typeName, t.standard(t.name)], color: 'var(--syn-type)' },
]);

const theme = EditorView.theme({
  '&': { background: 'var(--surface)', color: 'var(--fg)', fontSize: '14px' },
  '.cm-content': { fontFamily: 'var(--mono)', caretColor: 'var(--fg)' },
  '.cm-gutters': {
    background: 'var(--surface)',
    color: 'var(--muted)',
    border: 'none',
  },
  '.cm-activeLine, .cm-activeLineGutter': { background: 'var(--active-line)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    background: 'var(--selection) !important',
  },
  '&.cm-focused': { outline: 'none' },
});

export default function SqlEditor({ value, onChange, onRun }) {
  const host = useRef(null);
  const view = useRef(null);
  const handlers = useRef({ onChange, onRun });

  useEffect(() => {
    handlers.current = { onChange, onRun };
  });

  useEffect(() => {
    view.current = new EditorView({
      parent: host.current,
      doc: value,
      extensions: [
        Prec.highest(
          keymap.of([
            {
              key: 'Mod-Enter',
              run: (v) => {
                handlers.current.onRun?.(v.state.doc.toString());
                return true;
              },
            },
          ]),
        ),
        basicSetup,
        sql({ dialect: PostgreSQL, upperCaseKeywords: true }),
        syntaxHighlighting(highlight),
        theme,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) handlers.current.onChange?.(u.state.doc.toString());
        }),
      ],
    });
    return () => view.current.destroy();
    // the editor is created once; later value changes are synced below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // push outside changes (e.g. loading a saved query) into the editor
  useEffect(() => {
    const v = view.current;
    if (v && value !== v.state.doc.toString()) {
      v.dispatch({
        changes: { from: 0, to: v.state.doc.length, insert: value },
      });
    }
  }, [value]);

  return <div className="editor" ref={host} />;
}
