import { useCallback, useEffect, useState } from 'react';
import { db } from './db/client.js';
import { DATASETS, findDataset } from './data/samples/index.js';
import { load, save } from './lib/storage.js';
import { useHistory } from './lib/useHistory.js';
import Generator from './pages/Generator.jsx';
import History from './pages/History.jsx';

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
  const [page, setPage] = useState('generator');
  const history = useHistory();

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

  function openFromHistory(entry) {
    if (entry.dataset !== datasetId) pickDataset(entry.dataset);
    setSql(entry.sql);
    setPage('generator');
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>Query Forge</h1>
          <nav className="tabs" aria-label="Pages">
            <button
              type="button"
              className={page === 'generator' ? 'tab active' : 'tab'}
              aria-current={page === 'generator' ? 'page' : undefined}
              onClick={() => setPage('generator')}
            >
              Generator
            </button>
            <button
              type="button"
              className={page === 'history' ? 'tab active' : 'tab'}
              aria-current={page === 'history' ? 'page' : undefined}
              onClick={() => setPage('history')}
            >
              History
              {history.entries.length > 0 && (
                <span className="count">{history.entries.length}</span>
              )}
            </button>
          </nav>
        </div>
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

      {page === 'history' && (
        <History
          entries={history.entries}
          onOpen={openFromHistory}
          onRemove={history.remove}
          onClear={history.clear}
        />
      )}

      {/* kept mounted while on History so results and the editor survive */}
      <div hidden={page !== 'generator'}>
        <Generator
          key={loadCount}
          onHistory={history.add}
          dataset={findDataset(datasetId)}
          tables={tables}
          dbReady={dbReady}
          refreshSchema={refreshSchema}
          sql={sql}
          setSql={setSql}
        />
      </div>
    </div>
  );
}
