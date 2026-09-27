import { useCallback, useEffect, useState } from 'react';
import { db } from './db/client.js';
import { DATASETS, findDataset } from './data/samples/index.js';
import { load, save } from './lib/storage.js';
import Generator from './pages/Generator.jsx';

export default function App() {
  const [datasetId, setDatasetId] = useState(
    () => findDataset(load('dataset', 'ecommerce')).id,
  );
  const [sql, setSql] = useState(() => findDataset(datasetId).starter);
  const [tables, setTables] = useState(null);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState(null);
  // bumped on every (re)load so the pages start fresh
  const [loadCount, setLoadCount] = useState(0);

  const refreshSchema = useCallback(async () => {
    const { tables } = await db.schema();
    setTables(tables);
  }, []);

  const seed = useCallback(
    (id) =>
      db
        .reset(findDataset(id).seed)
        .then(refreshSchema)
        .catch(setDbError)
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
    setDbError(null);
    setLoadCount((n) => n + 1);
    seed(id);
  }

  function pickDataset(id) {
    save('dataset', id);
    setSql(findDataset(id).starter);
    setDatasetId(id);
    loadDataset(id);
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

      {dbError && (
        <div className="error">
          Could not load the dataset: {dbError.message}
        </div>
      )}

      <Generator
        key={loadCount}
        dataset={findDataset(datasetId)}
        tables={tables}
        dbReady={dbReady}
        refreshSchema={refreshSchema}
        sql={sql}
        setSql={setSql}
      />
    </div>
  );
}
