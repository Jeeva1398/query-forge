import { useState } from 'react';

function Column({ column }) {
  return (
    <li className="column">
      <span className="column-name">
        {column.pk && (
          <span className="key" title="Primary key">
            PK
          </span>
        )}
        {column.name}
      </span>
      <span className="column-type">
        {column.type}
        {!column.nullable && !column.pk && ' · not null'}
      </span>
      {column.fk && (
        <span className="column-fk">
          → {column.fk.table}.{column.fk.column}
        </span>
      )}
    </li>
  );
}

export default function SchemaBrowser({ tables, onPick }) {
  const [open, setOpen] = useState({});

  if (!tables) return <aside className="schema muted">Loading schema…</aside>;

  return (
    <aside className="schema">
      <div className="schema-title">Tables ({tables.length})</div>
      {tables.length === 0 && (
        <p className="muted">No tables yet. Create one with CREATE TABLE.</p>
      )}
      <ul>
        {tables.map((t) => (
          <li key={t.name} className="table">
            <div className="table-row">
              <button
                type="button"
                className="link"
                onClick={() => setOpen((o) => ({ ...o, [t.name]: !o[t.name] }))}
                aria-expanded={!!open[t.name]}
              >
                <span className="caret">{open[t.name] ? '▾' : '▸'}</span>
                {t.name}
              </button>
              <span className="muted">{t.rowCount}</span>
              <button
                type="button"
                className="link small"
                title={`SELECT * FROM ${t.name}`}
                onClick={() => onPick(t.name)}
              >
                query
              </button>
            </div>
            {open[t.name] && (
              <ul className="columns">
                {t.columns.map((c) => (
                  <Column key={c.name} column={c} />
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
