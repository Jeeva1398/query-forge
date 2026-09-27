import { useCallback, useEffect, useState } from 'react';
import { db } from './db/client.js';
import SqlEditor from './components/SqlEditor.jsx';
import ResultTable from './components/ResultTable.jsx';

const STARTER = 'SELECT version();\n';

export default function App() {
  const [sql, setSql] = useState(STARTER);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    db.reset().then(() => setDbReady(true));
  }, []);

  const run = useCallback(async (text) => {
    const query = (text ?? '').trim();
    if (!query) return;
    setRunning(true);
    setError(null);
    try {
      setResult(await db.run(query));
    } catch (err) {
      setResult(null);
      setError(err);
    } finally {
      setRunning(false);
    }
  }, []);

  async function reset() {
    setDbReady(false);
    await db.reset();
    setResult(null);
    setError(null);
    setDbReady(true);
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Query Forge</h1>
        <div className="actions">
          <span className="muted">
            {dbReady ? 'Postgres ready' : 'Starting Postgres…'}
          </span>
          <button type="button" onClick={reset} disabled={!dbReady}>
            Reset DB
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="panel">
          <SqlEditor value={sql} onChange={setSql} onRun={run} />
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

        <ResultTable result={result} error={error} running={running} />
      </main>
    </div>
  );
}
