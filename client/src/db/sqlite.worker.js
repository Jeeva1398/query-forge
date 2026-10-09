import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm-browser.wasm?url';

const MAX_ROWS = 1000;

let SQL = null;
let db = null;
let queue = Promise.resolve();

async function open(seed) {
  SQL ??= await initSqlJs({ locateFile: () => wasmUrl });
  db?.close();
  db = new SQL.Database();
  // SQLite ignores REFERENCES unless this is on
  db.run('PRAGMA foreign_keys = ON');
  if (seed) db.exec(seed);
}

function toError(err) {
  return { message: err?.message || String(err) };
}

const firstWord = (sql) =>
  sql
    .replace(/^(\s|--[^\n]*\n?|\/\*[\s\S]*?\*\/)*/, '')
    .match(/^\w+/)?.[0]
    ?.toUpperCase();

function run({ sql }) {
  const started = performance.now();
  let statements = 0;
  let shown = null;
  let last = null;

  // step through each statement so writes report how many rows they touched
  for (const stmt of db.iterateStatements(sql)) {
    statements++;
    const columns = stmt.getColumnNames();
    const rows = [];
    while (stmt.step()) rows.push(stmt.get());
    const current = {
      command: firstWord(stmt.getSQL()),
      columns,
      rows,
      affectedRows: columns.length ? undefined : db.getRowsModified(),
    };
    stmt.free();
    last = current;
    if (columns.length) shown = current;
  }
  const ms = performance.now() - started;

  // show the last statement that returned columns, otherwise the last one
  shown ??= last;
  const rows = shown?.rows || [];
  return {
    ms,
    statements,
    command: shown?.command,
    affectedRows: shown?.affectedRows,
    columns: shown?.columns || [],
    rows: rows.slice(0, MAX_ROWS),
    rowCount: rows.length,
    truncated: rows.length > MAX_ROWS,
  };
}

// EXPLAIN QUERY PLAN rows point at their parent, so indent by depth
function explain({ sql }) {
  const res = db.exec(
    'EXPLAIN QUERY PLAN ' + sql.trim().replace(/;\s*$/, ''),
  )[0];
  const depth = new Map([[0, -1]]);
  const lines = (res?.values || []).map(([id, parent, , detail]) => {
    const d = (depth.get(parent) ?? -1) + 1;
    depth.set(id, d);
    return `${'   '.repeat(d)}${d ? '└─ ' : ''}${detail}`;
  });
  return { plan: ['QUERY PLAN', ...lines].join('\n') };
}

const quote = (name) => `"${name.replace(/"/g, '""')}"`;

function rowsOf(sql) {
  const res = db.exec(sql)[0];
  if (!res) return [];
  return res.values.map((v) =>
    Object.fromEntries(res.columns.map((c, i) => [c, v[i]])),
  );
}

function schema() {
  const names = rowsOf(
    "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  ).map((r) => r.name);

  const tables = names.map((name) => {
    const fks = rowsOf(`PRAGMA foreign_key_list(${quote(name)})`);
    const columns = rowsOf(`PRAGMA table_info(${quote(name)})`).map((c) => {
      const fk = fks.find((f) => f.from === c.name);
      return {
        name: c.name,
        type: c.type || 'ANY',
        nullable: !c.notnull,
        ...(c.pk && { pk: true }),
        ...(fk && { fk: { table: fk.table, column: fk.to || 'rowid' } }),
      };
    });
    const [{ n }] = rowsOf(`SELECT count(*) AS n FROM ${quote(name)}`);
    return { name, columns, constraints: [], rowCount: n };
  });

  return { tables };
}

const handlers = {
  reset: ({ seed }) => open(seed).then(() => ({ ok: true })),
  run,
  explain,
  schema,
};

self.onmessage = ({ data }) => {
  const { id, type, payload } = data;
  queue = queue.then(async () => {
    try {
      if (!db && type !== 'reset') await open();
      const result = await handlers[type](payload || {});
      self.postMessage({ id, ok: true, result });
    } catch (err) {
      self.postMessage({ id, ok: false, error: toError(err) });
    }
  });
};
