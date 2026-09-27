import { useCallback, useState } from 'react';
import { db } from '../db/client.js';
import { post } from '../lib/api.js';
import { schemaToDdl } from '../lib/ddl.js';
import { dangerousStatements, isReadOnly } from '../lib/sqlSafety.js';
import SqlEditor from '../components/SqlEditor.jsx';
import ResultTable from '../components/ResultTable.jsx';
import SchemaBrowser from '../components/SchemaBrowser.jsx';
import TierBadge from '../components/TierBadge.jsx';
import ExplainPanel from '../components/ExplainPanel.jsx';

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
  onHistory,
}) {
  const [prompt, setPrompt] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [answer, setAnswer] = useState(null);
  const [fixing, setFixing] = useState(false);
  // how many fixes in a row; the second one goes to the stronger model
  const [fixCount, setFixCount] = useState(0);
  const [explain, setExplain] = useState(null);

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState(null);

  const execute = useCallback(
    // meta: the prompt and model when the query came from the AI
    async (text, meta = {}) => {
      setPending(null);
      setExplain(null);
      setRunning(true);
      setError(null);
      try {
        const res = await db.run(text);
        setResult(res);
        const { skipHistory, ...info } = meta;
        if (!skipHistory)
          onHistory({ dataset: dataset.id, sql: text, ...info });
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
    [refreshSchema, onHistory, dataset.id],
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
      setFixCount(0);
      setSql(res.data.sql);
      const meta = {
        prompt: request,
        model: res.meta.model,
        tier: res.meta.tier,
      };
      if (isReadOnly(res.data.sql)) execute(res.data.sql, meta);
      else {
        onHistory({ dataset: dataset.id, sql: res.data.sql, ...meta });
        setResult(null);
        setError(null);
      }
    } catch (err) {
      setAiError(err);
    } finally {
      setAiBusy(false);
    }
  }

  // error text as Postgres reports it, for the AI and for the answer card
  function errorText(err) {
    return [
      err.code && `ERROR ${err.code}:`,
      err.message,
      err.detail && `DETAIL: ${err.detail}`,
      err.hint && `HINT: ${err.hint}`,
      err.position && `(at character ${err.position})`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  async function fix() {
    if (!error || fixing) return;
    const broken = sql;
    setFixing(true);
    try {
      const res = await post('/fix', {
        dialect: 'postgres',
        ddl: schemaToDdl(tables),
        sql: broken,
        error: errorText(error),
        request: answer?.kind === 'generate' ? answer.prompt : undefined,
        attempt: fixCount + 1,
      });
      setFixCount((n) => n + 1);
      setAnswer({
        kind: 'fix',
        prompt: answer?.prompt,
        data: { explanation: res.data.whatWasWrong, assumptions: [] },
        meta: res.meta,
      });
      setSql(res.data.sql);
      const meta = {
        prompt: answer?.prompt,
        model: res.meta.model,
        tier: res.meta.tier,
      };
      if (isReadOnly(res.data.sql)) execute(res.data.sql, meta);
      else setError(null);
    } catch (err) {
      setAiError(err);
    } finally {
      setFixing(false);
    }
  }

  async function explainQuery() {
    const query = sql.trim();
    if (!query) return;
    setExplain({ loading: true });
    const [ai, plan] = await Promise.allSettled([
      post('/explain', {
        dialect: 'postgres',
        ddl: schemaToDdl(tables),
        sql: query,
      }),
      db.explain(query),
    ]);
    setExplain({
      loading: false,
      ai: ai.status === 'fulfilled' ? ai.value : null,
      aiError: ai.status === 'rejected' ? ai.reason : null,
      plan: plan.status === 'fulfilled' ? plan.value.plan : null,
      planError: plan.status === 'rejected' ? plan.reason : null,
    });
  }

  function queryTable(name) {
    const text = `SELECT *\nFROM ${name}\nLIMIT 50;\n`;
    setSql(text);
    execute(text, { skipHistory: true });
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
              <strong>
                {answer.kind === 'fix' ? 'Fixed the query' : answer.prompt}
              </strong>
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
            <button
              type="button"
              className="push-right"
              onClick={explainQuery}
              disabled={!dbReady || !sql.trim() || explain?.loading}
            >
              {explain?.loading ? 'Explaining…' : 'Explain'}
            </button>
          </div>
        </section>

        {explain && (
          <ExplainPanel explain={explain} onClose={() => setExplain(null)} />
        )}

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

        <ResultTable
          result={result}
          error={error}
          running={running}
          onFix={error ? fix : undefined}
          fixing={fixing}
        />
      </main>
    </div>
  );
}
