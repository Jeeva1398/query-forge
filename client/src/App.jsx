import { useCallback, useEffect, useState } from 'react';
import { db } from './db/client.js';
import { DATASETS, findDataset } from './data/samples/index.js';
import { load, save } from './lib/storage.js';
import SqlEditor from './components/SqlEditor.jsx';
import ResultTable from './components/ResultTable.jsx';
import SchemaBrowser from './components/SchemaBrowser.jsx';

export default function App() {
  const [datasetId, setDatasetId] = useState(
    () => findDataset(load('dataset', 'ecommerce')).id,
  );
  const [sql, setSql] = useState(() => findDataset(datasetId).starter);
  const [tables, setTables] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  const refreshSchema = useCallback(async () => {
    const { tables } = await db.schema();
    setTables(tables);
  }, []);

  const seed = useCallback(
    (id) =>
      db
        .reset(findDataset(id).seed)
        .then(refreshSchema)
        .catch(setError)
        .finally(() => setDbReady(true)),
    [refreshSchema],
  );

  // first load only; later loads come from the dataset picker and Reset
  useEffect(() => {
    seed(datasetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadDataset(id) {
    setDbReady(false);
    setResult(null);
    setError(null);
    seed(id);
  }

  function pickDataset(id) {
    save('dataset', id);
    setSql(findDataset(id).starter);
    setDatasetId(id);
    loadDataset(id);
  }

  const run = useCallback(
    async (text) => {
      const query = (text ?? '').trim();
      if (!query) return;
      setRunning(true);
      setError(null);
      try {
        const res = await db.run(query);
        setResult(res);
        // anything other than a plain SELECT may have changed tables or row counts
        if (res.command !== 'SELECT' || res.statements > 1)
          await refreshSchema();
      } catch (err) {
        setResult(null);
        setError(err);
      } finally {
        setRunning(false);
      }
    },
    [refreshSchema],
  );

  function queryTable(name) {
    const text = `SELECT *\nFROM ${name}\nLIMIT 50;\n`;
    setSql(text);
    run(text);
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Query Forge</h1>
        <div className="actions">
          <label className="field">
            <span className="muted">Dataset</span>
            <select
              value={datasetId}
              onChange={(e) => pickDataset(e.target.value)}
              disabled={!dbReady}
            >
              {DATASETS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => loadDataset(datasetId)}
            disabled={!dbReady}
            title="Drop everything and reload the dataset"
          >
            Reset DB
          </button>
          <span className="muted">
            {dbReady ? 'Postgres ready' : 'Loading…'}
          </span>
        </div>
      </header>

      <div className="layout">
        <SchemaBrowser tables={tables} onPick={queryTable} />

        <main className="workspace">
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

          <ResultTable result={result} error={error} running={running} />
        </main>
      </div>
    </div>
  );
}
