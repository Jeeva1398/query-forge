import { PGlite } from '@electric-sql/pglite';

const MAX_ROWS = 1000;

let db = null;
let queue = Promise.resolve();

async function open(seed) {
  if (db) await db.close();
  db = new PGlite();
  await db.waitReady;
  if (seed) await db.exec(seed);
}

function toError(err) {
  return {
    message: err?.message || String(err),
    code: err?.code,
    position: err?.position ? Number(err.position) : undefined,
    detail: err?.detail,
    hint: err?.hint,
  };
}

async function run({ sql }) {
  const started = performance.now();
  const results = await db.exec(sql, { rowMode: 'array' });
  const ms = performance.now() - started;

  // show the last statement that returned columns, otherwise the last one
  const shown =
    [...results].reverse().find((r) => r.fields?.length) ||
    results[results.length - 1];
  const rows = shown?.rows || [];

  return {
    ms,
    statements: results.length,
    command: shown?.command,
    affectedRows: shown?.affectedRows,
    columns: (shown?.fields || []).map((f) => f.name),
    rows: rows.slice(0, MAX_ROWS),
    rowCount: rows.length,
    truncated: rows.length > MAX_ROWS,
  };
}

async function explain({ sql }) {
  const readOnly = /^\s*(select|with)\b/i.test(sql);
  const prefix = readOnly ? 'EXPLAIN (ANALYZE, FORMAT TEXT) ' : 'EXPLAIN ';
  const res = await db.query(prefix + sql.trim().replace(/;\s*$/, ''));
  return { plan: res.rows.map((r) => r['QUERY PLAN']).join('\n') };
}

const handlers = {
  reset: ({ seed }) => open(seed).then(() => ({ ok: true })),
  run,
  explain,
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
