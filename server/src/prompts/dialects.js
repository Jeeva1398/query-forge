// The schema always comes from the Postgres playground, so for other dialects
// the model has to translate types and functions while it writes the query.
const DIALECTS = {
  postgres: {
    name: 'PostgreSQL',
    version: 'PostgreSQL 18',
    notes: [],
  },
  mysql: {
    name: 'MySQL',
    version: 'MySQL 8',
    notes: [
      '- The schema is written in PostgreSQL syntax. Write the query for MySQL 8: backtick quoting when needed, IFNULL/COALESCE, DATE_FORMAT, CONCAT instead of ||, LIMIT offset syntax, JSON_EXTRACT / ->> for JSON columns.',
      '- If the query needs DDL, translate types: serial → INT AUTO_INCREMENT, jsonb → JSON, boolean → BOOLEAN, text → TEXT or VARCHAR(255).',
    ],
  },
  sqlite: {
    name: 'SQLite',
    version: 'SQLite 3',
    notes: [
      '- The schema is written in PostgreSQL syntax. Write the query for SQLite 3: || for concatenation, strftime/date functions instead of date_trunc and EXTRACT, json_extract for JSON columns, no ILIKE (use LIKE, which is case-insensitive for ASCII).',
      '- SQLite has no BOOLEAN type (use 0/1), and window functions and CTEs are supported.',
    ],
  },
};

export const dialectNames = Object.keys(DIALECTS);

export function dialectInfo(dialect = 'postgres') {
  return DIALECTS[dialect] || DIALECTS.postgres;
}
