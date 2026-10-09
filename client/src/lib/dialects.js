// canRun: whether an in-browser engine exists for the dialect. MySQL has none,
// so its queries are generated and explained but only copied, never run.
export const DIALECTS = [
  { id: 'postgres', label: 'PostgreSQL', short: 'Postgres', canRun: true },
  { id: 'mysql', label: 'MySQL', short: 'MySQL', canRun: false },
  { id: 'sqlite', label: 'SQLite', short: 'SQLite', canRun: true },
];

export const findDialect = (id) =>
  DIALECTS.find((d) => d.id === id) || DIALECTS[0];
