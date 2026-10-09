import { useCallback, useEffect, useRef, useState } from 'react';
import { db, sqlite } from './db/client.js';
import { DATASETS, findDataset } from './data/samples/index.js';
import { findDialect } from './lib/dialects.js';
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
  const [dialect, setDialect] = useState(
    () => findDialect(load('dialect', 'postgres')).id,
  );
  // the SQLite copy of the dataset, seeded the first time SQLite is used
  // after each load, so Postgres-only users never download the engine
  const [liteTables, setLiteTables] = useState(null);
  const liteLoad = useRef(null);
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

  const refreshLite = useCallback(async () => {
    const { tables } = await sqlite.schema();
    setLiteTables(tables);
  }, []);

  // liteTables stays null (loading) until the reset and schema read finish
  function startLite(id, count) {
    liteLoad.current = count;
    sqlite
      .reset(findDataset(id).sqliteSeed)
      .then(refreshLite)
      .catch((err) => {
        setDbError(err);
        setLiteTables([]);
      });
  }

  function seedLite(id, count) {
    setLiteTables(null);
    startLite(id, count);
  }

  // first load only; later loads come from the dataset picker and Reset
  useEffect(() => {
    seed(datasetId);
    if (dialect === 'sqlite') startLite(datasetId, loadCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // forDialect: the dialect that will be active once this load finishes
  function loadDataset(id, forDialect = dialect) {
    setDbReady(false);
    setDbError(null);
    setLoadCount((n) => n + 1);
    seed(id);
    if (forDialect === 'sqlite') seedLite(id, loadCount + 1);
  }

  function pickDialect(id, { seedNow = true } = {}) {
    save('dialect', id);
    setDialect(id);
    if (seedNow && id === 'sqlite' && liteLoad.current !== loadCount) {
      seedLite(datasetId, loadCount);
    }
  }

  function pickDataset(id, forDialect) {
    save('dataset', id);
    setSql(findDataset(id).starter);
    setDatasetId(id);
    loadDataset(id, forDialect);
  }

  function openFromHistory(entry) {
    const entryDialect = findDialect(entry.dialect).id;
    if (entry.dataset !== datasetId) {
      pickDialect(entryDialect, { seedNow: false });
      pickDataset(entry.dataset, entryDialect);
    } else {
      pickDialect(entryDialect);
    }
    setSql(entry.sql);
    setPage('generator');
  }

  // the engine queries run on; MySQL has none, and Postgres still
  // provides the schema the AI sees for every dialect
  const engine = {
    postgres: { db, tables, ready: dbReady, refresh: refreshSchema },
    sqlite: {
      db: sqlite,
      tables: liteTables,
      ready: dbReady && liteTables !== null,
      refresh: refreshLite,
    },
  }[dialect];

  const status = !dbReady
    ? 'Loading…'
    : engine && !engine.ready
      ? 'Loading SQLite…'
      : engine
        ? `${findDialect(dialect).short} ready`
        : 'MySQL: generate and copy';

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
          <span className="muted">{status}</span>
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
          dialect={dialect}
          onDialect={pickDialect}
          engine={engine}
          sql={sql}
          setSql={setSql}
        />
      </div>
    </div>
  );
}
