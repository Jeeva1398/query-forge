import { useCallback, useState } from 'react';
import { db, sqlite } from '../db/client.js';
import { post } from '../lib/api.js';
import { schemaToDdl } from '../lib/ddl.js';
import { DIALECTS, findDialect } from '../lib/dialects.js';
import { dangerousStatements, isReadOnly } from '../lib/sqlSafety.js';
import SqlEditor from '../components/SqlEditor.jsx';
import ResultTable from '../components/ResultTable.jsx';
import SchemaBrowser from '../components/SchemaBrowser.jsx';
import TierBadge from '../components/TierBadge.jsx';
import ExplainPanel from '../components/ExplainPanel.jsx';

const CLIENTS = { postgres: db, sqlite };

function aiErrorText(err) {
  if (err.retryAfter && ['ai_quota', 'ai_busy'].includes(err.code)) {
    const mins = Math.max(1, Math.round(err.retryAfter / 60));
    return `${err.message} (about ${mins} min)`;
  }
  return err.message;
}

function answerTitle(answer) {
  if (answer.kind === 'fix') return 'Fixed the query';
  if (answer.kind === 'convert')
    return `Converted to ${findDialect(answer.to).label}`;
  return answer.prompt;
}

export default function Generator({
  dataset,
  tables,
  dbReady,
  dialect,
  onDialect,
  engine,
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
  const [converting, setConverting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [pending, setPending] = useState(null);

  const current = findDialect(dialect);
  // the AI always sees the Postgres schema, whatever the dialect
  const ddl = () => schemaToDdl(tables);

  const execute = useCallback(
    // meta: the prompt and model when the query came from the AI
    // target: the dialect to run on, when it differs from the one shown now
    async (text, meta = {}, target = dialect) => {
      setPending(null);
      setExplain(null);
      setRunning(true);
      setError(null);
      try {
        const res = await CLIENTS[target].run(text);
        setResult(res);
        const { skipHistory, ...info } = meta;
        if (!skipHistory)
          onHistory({
            dataset: dataset.id,
            dialect: target,
            sql: text,
            ...info,
          });
        // anything other than a plain SELECT may have changed tables or row counts
        if (
          (res.command !== 'SELECT' || res.statements > 1) &&
          target === dialect
        ) {
          await engine?.refresh();
        }
      } catch (err) {
        setResult(null);
        setError(err);
      } finally {
        setRunning(false);
      }
    },
    [engine, onHistory, dataset.id, dialect],
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

  const copy = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; the user can still select the text by hand
    }
  }, []);

  // results and errors belong to the old engine, so they're cleared
  function changeDialect(id) {
    if (id === dialect) return;
    setResult(null);
    setError(null);
    setExplain(null);
    setPending(null);
    setFixCount(0);
    onDialect(id);
  }

  // runs AI output right away when it only reads and the dialect can run
  function afterAi(text, meta, target = dialect) {
    if (findDialect(target).canRun && isReadOnly(text)) {
      execute(text, meta, target);
    } else {
      onHistory({ dataset: dataset.id, dialect: target, sql: text, ...meta });
      setResult(null);
      setError(null);
    }
  }

  async function generate(text = prompt) {
    const request = text.trim();
    if (!request || aiBusy) return;
    setPrompt(request);
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await post('/generate', {
        dialect,
        ddl: ddl(),
        prompt: request,
      });
      setAnswer({ kind: 'generate', prompt: request, ...res });
      setFixCount(0);
      setSql(res.data.sql);
      afterAi(res.data.sql, {
        prompt: request,
        model: res.meta.model,
        tier: res.meta.tier,
      });
    } catch (err) {
      setAiError(err);
    } finally {
      setAiBusy(false);
    }
  }

  // error text as the database reports it, for the AI and for the answer card
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
        dialect,
        ddl: ddl(),
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

  async function convert(to) {
    const query = sql.trim();
    if (!to || !query || converting) return;
    setConverting(true);
    setAiError(null);
    try {
      const res = await post('/convert', {
        from: dialect,
        to,
        ddl: ddl(),
        sql: query,
      });
      changeDialect(to);
      setAnswer({
        kind: 'convert',
        to,
        prompt: answer?.prompt,
        data: {
          explanation: res.data.summary,
          assumptions: res.data.changes,
        },
        meta: res.meta,
      });
      setFixCount(0);
      setSql(res.data.sql);
      afterAi(
        res.data.sql,
        { prompt: answer?.prompt, model: res.meta.model, tier: res.meta.tier },
        to,
      );
    } catch (err) {
      setAiError(err);
    } finally {
      setConverting(false);
    }
  }

  async function explainQuery() {
    const query = sql.trim();
    if (!query) return;
    setExplain({ loading: true });
    const [ai, plan] = await Promise.allSettled([
      post('/explain', { dialect, ddl: ddl(), sql: query }),
      engine
        ? engine.db.explain(query)
        : Promise.reject(
            new Error(
              "MySQL can't run in the browser, so there is no query plan to show.",
            ),
          ),
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
    if (engine) execute(text, { skipHistory: true });
  }

  return (
    <div className="layout">
      <SchemaBrowser
        tables={engine ? engine.tables : tables}
        onPick={queryTable}
      />

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
            <div
              className="segmented"
              role="radiogroup"
              aria-label="SQL dialect"
            >
              {DIALECTS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={d.id === dialect}
                  className={d.id === dialect ? 'active' : undefined}
                  onClick={() => changeDialect(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
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
              <strong>{answerTitle(answer)}</strong>
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
            onRun={engine ? run : copy}
            tables={engine ? engine.tables : tables}
            dialect={dialect}
          />
          <div className="toolbar">
            {engine ? (
              <button
                type="button"
                className="primary"
                onClick={() => run(sql)}
                disabled={!engine.ready || running}
              >
                Run
              </button>
            ) : (
              <button
                type="button"
                className="primary"
                onClick={() => copy(sql)}
                disabled={!sql.trim()}
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
            <span className="muted">Ctrl+Enter</span>
            <select
              className="push-right"
              value=""
              onChange={(e) => convert(e.target.value)}
              disabled={!dbReady || !sql.trim() || converting}
              aria-label="Convert the query to another dialect"
            >
              <option value="">
                {converting ? 'Converting…' : 'Convert to…'}
              </option>
              {DIALECTS.filter((d) => d.id !== dialect).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={explainQuery}
              disabled={!dbReady || !sql.trim() || explain?.loading}
            >
              {explain?.loading ? 'Explaining…' : 'Explain'}
            </button>
          </div>
        </section>

        {explain && (
          <ExplainPanel
            explain={explain}
            dialect={dialect}
            onClose={() => setExplain(null)}
          />
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

        {engine ? (
          <ResultTable
            result={result}
            error={error}
            running={running}
            onFix={error ? fix : undefined}
            fixing={fixing}
          />
        ) : (
          <div className="results muted">
            {current.label} can't run in the browser, so this query isn't
            executed here. Copy it into your own MySQL 8 server, or pick
            PostgreSQL or SQLite to try it on the sample data.
          </div>
        )}
      </main>
    </div>
  );
}
