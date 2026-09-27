import { useCallback, useState } from 'react';
import { db } from '../db/client.js';
import { post } from '../lib/api.js';
import { schemaToDdl } from '../lib/ddl.js';
import { dangerousStatements, isReadOnly } from '../lib/sqlSafety.js';
import SqlEditor from '../components/SqlEditor.jsx';
import ResultTable from '../components/ResultTable.jsx';
import SchemaBrowser from '../components/SchemaBrowser.jsx';
import TierBadge from '../components/TierBadge.jsx';

function aiErrorText(err) {
  if (err.retryAfter && ['ai_quota', 'ai_busy'].includes(err.code)) {
    const mins = Math.max(1, Math.round(err.retryAfter / 60));
    return `${err.message} (about ${mins} min)`;
  }
  return err.message;
}

export default function Generator({
  dataset,
  tables,
  dbReady,
  refreshSchema,
  sql,
  setSql,
}) {
  const [prompt, setPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [answer, setAnswer] = useState(null);

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState(null);

  const execute = useCallback(
    async (text) => {
      setPending(null);
      setRunning(true);
      setError(null);
      try {
        const res = await db.run(text);
        setResult(res);
        // anything other than a plain SELECT may have changed tables or row counts
        if (res.command !== 'SELECT' || res.statements > 1) {
          await refreshSchema();
        }
      } catch (err) {
        setResult(null);
        setError(err);
      } finally {
        setRunning(false);
      }
    },
    [refreshSchema],
  );

  const run = useCallback(
    (text) => {
      const query = (text ?? '').trim();
      if (!query) return;
      const warnings = dangerousStatements(query);
      if (warnings.length) setPending({ sql: query, warnings });
      else execute(query);
    },
    [execute],
  );

  async function generate(text = prompt) {
    const request = text.trim();
    if (!request || aiBusy) return;
    setPrompt(request);
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await post('/generate', {
        dialect: 'postgres',
        ddl: schemaToDdl(tables),
        prompt: request,
      });
      setAnswer({ kind: 'generate', prompt: request, ...res });
      setSql(res.data.sql);
      if (isReadOnly(res.data.sql)) execute(res.data.sql);
      else {
        setResult(null);
        setError(null);
      }
    } catch (err) {
      setAiError(err);
    } finally {
      setAiBusy(false);
    }
  }

  function queryTable(name) {
    const text = `SELECT *\nFROM ${name}\nLIMIT 50;\n`;
    setSql(text);
    run(text);
  }

  return (
    <div className="layout">
      <SchemaBrowser tables={tables} onPick={queryTable} />

      <main className="workspace">
        <section className="panel ask">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                generate();
              }
            }}
            placeholder="Describe the query you want, e.g. “customers who never placed an order”"
            rows={2}
            maxLength={1000}
            aria-label="Describe the query you want"
          />
          <div className="toolbar">
            <button
              type="button"
              className="primary"
              onClick={() => generate()}
              disabled={!dbReady || aiBusy || prompt.trim().length < 3}
            >
              {aiBusy ? 'Writing SQL…' : 'Generate SQL'}
            </button>
            <span className="muted">Ctrl+Enter</span>
            <div className="chips">
              {dataset.examples.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="chip"
                  onClick={() => generate(ex)}
                  disabled={!dbReady || aiBusy}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
          {aiError && <div className="error">{aiErrorText(aiError)}</div>}
        </section>

        {answer && (
          <section className="panel answer">
            <div className="answer-head">
              <strong>{answer.prompt}</strong>
              <TierBadge meta={answer.meta} />
            </div>
            <p>{answer.data.explanation}</p>
            {answer.data.assumptions?.length > 0 && (
              <ul className="assumptions">
                {answer.data.assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="panel">
          <SqlEditor
            value={sql}
            onChange={setSql}
            onRun={run}
            tables={tables}
          />
          <div className="toolbar">
            <button
              type="button"
              className="primary"
              onClick={() => run(sql)}
              disabled={!dbReady || running}
            >
              Run
            </button>
            <span className="muted">Ctrl+Enter</span>
          </div>
        </section>

        {pending && (
          <div className="confirm" role="alertdialog">
            <div>
              <strong>
                This query will change data in a way you can't undo:
              </strong>
              <ul>
                {pending.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
              <span className="muted">
                It's a sandbox, so Reset DB brings everything back.
              </span>
            </div>
            <div className="confirm-actions">
              <button type="button" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => execute(pending.sql)}
              >
                Run anyway
              </button>
            </div>
          </div>
        )}

        <ResultTable result={result} error={error} running={running} />
      </main>
    </div>
  );
}
