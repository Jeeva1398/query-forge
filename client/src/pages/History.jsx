import { useMemo, useState } from 'react';
import { DATASETS, findDataset } from '../data/samples/index.js';

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

function timeAgo(iso) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) {
      return rtf.format(Math.round(seconds / size), unit);
    }
  }
  return 'just now';
}

export default function History({ entries, onOpen, onRemove, onClear }) {
  const [search, setSearch] = useState('');
  const [dataset, setDataset] = useState('all');

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (dataset === 'all' || e.dataset === dataset) &&
        (!q ||
          e.sql.toLowerCase().includes(q) ||
          e.prompt?.toLowerCase().includes(q)),
    );
  }, [entries, search, dataset]);

  return (
    <main className="history">
      <div className="history-bar">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search prompts and SQL"
          aria-label="Search history"
        />
        <select
          value={dataset}
          onChange={(e) => setDataset(e.target.value)}
          aria-label="Filter by dataset"
        >
          <option value="all">All datasets</option>
          {DATASETS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="push-right"
          disabled={!entries.length}
          onClick={() => {
            if (window.confirm('Delete your whole query history?')) onClear();
          }}
        >
          Clear history
        </button>
      </div>

      {entries.length === 0 && (
        <p className="muted empty">
          Queries you generate or run show up here, so you can find and re-run
          them later.
        </p>
      )}
      {entries.length > 0 && shown.length === 0 && (
        <p className="muted empty">Nothing matches that search.</p>
      )}

      <ul className="history-list">
        {shown.map((e) => (
          <li key={e.id} className="panel history-item">
            <div className="history-head">
              <strong>{e.prompt || 'Written by hand'}</strong>
              <span className="muted">
                {findDataset(e.dataset).label} · {timeAgo(e.at)}
                {e.model &&
                  ` · ${e.tier === 'flash' ? '⚡ ' : ''}${e.model.replace(/^gemini-/, '')}`}
              </span>
            </div>
            <pre className="history-sql">{e.sql}</pre>
            <div className="history-actions">
              <button
                type="button"
                className="primary"
                onClick={() => onOpen(e)}
              >
                Open
              </button>
              <button
                type="button"
                className="link small"
                onClick={() => onRemove(e.id)}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
