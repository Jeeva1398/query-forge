import { PGlite } from '@electric-sql/pglite';

const MAX_ROWS = 1000;

// Keep dates and times as Postgres prints them. JS Dates would shift
// `timestamp` values into the browser's time zone and change the day.
const asText = (value) => value;
const TEXT_TYPES = {
  1082: asText, // date
  1083: asText, // time
  1114: asText, // timestamp
  1184: asText, // timestamptz
  1186: asText, // interval
  1266: asText, // timetz
};

let db = null;
let queue = Promise.resolve();

async function open(seed) {
  if (db) await db.close();
  db = new PGlite({ parsers: TEXT_TYPES });
  await db.waitReady;
  // same results on every machine, whatever the browser's time zone
  await db.exec("SET TIME ZONE 'UTC'");
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

const COLUMNS_SQL = `
  SELECT c.table_name, c.column_name, c.data_type, c.is_nullable = 'YES' AS nullable
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
  WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  ORDER BY c.table_name, c.ordinal_position`;

const KEYS_SQL = `
  SELECT
    con.contype AS kind,
    rel.relname AS table_name,
    att.attname AS column_name,
    frel.relname AS ref_table,
    fatt.attname AS ref_column
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  CROSS JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, pos)
  JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = k.attnum
  LEFT JOIN pg_class frel ON frel.oid = con.confrelid
  LEFT JOIN pg_attribute fatt
    ON fatt.attrelid = con.confrelid AND fatt.attnum = con.confkey[k.pos]
  WHERE ns.nspname = 'public' AND con.contype IN ('p', 'f')`;

// CHECK and UNIQUE constraints, e.g. the allowed values of orders.status
const CONSTRAINTS_SQL = `
  SELECT rel.relname AS table_name, pg_get_constraintdef(con.oid) AS def
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = rel.relnamespace
  WHERE ns.nspname = 'public' AND con.contype IN ('c', 'u')
  ORDER BY rel.relname, con.conname`;

async function schema() {
  const [cols, keys, constraints] = await Promise.all([
    db.query(COLUMNS_SQL),
    db.query(KEYS_SQL),
    db.query(CONSTRAINTS_SQL),
  ]);

  const tables = new Map();
  for (const c of cols.rows) {
    if (!tables.has(c.table_name)) {
      tables.set(c.table_name, {
        name: c.table_name,
        columns: [],
        constraints: [],
      });
    }
    tables.get(c.table_name).columns.push({
      name: c.column_name,
      type: c.data_type,
      nullable: c.nullable,
    });
  }

  for (const k of keys.rows) {
    const col = tables
      .get(k.table_name)
      ?.columns.find((c) => c.name === k.column_name);
    if (!col) continue;
    if (k.kind === 'p') col.pk = true;
    else col.fk = { table: k.ref_table, column: k.ref_column };
  }

  for (const c of constraints.rows) {
    tables.get(c.table_name)?.constraints.push(c.def);
  }

  for (const table of tables.values()) {
    const res = await db.query(
      `SELECT count(*)::int AS n FROM "${table.name.replace(/"/g, '""')}"`,
    );
    table.rowCount = res.rows[0].n;
  }

  return { tables: [...tables.values()] };
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
