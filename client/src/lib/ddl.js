// Rebuilds a compact CREATE TABLE script from the schema the worker reports.
// This is what the AI sees, so it only needs to be readable, not exact.
export function schemaToDdl(tables = []) {
  return tables
    .map((t) => {
      const pk = t.columns.filter((c) => c.pk).map((c) => c.name);
      const lines = t.columns.map((c) => {
        let line = `  ${c.name} ${c.type}`;
        if (c.pk && pk.length === 1) line += ' PRIMARY KEY';
        else if (!c.nullable) line += ' NOT NULL';
        if (c.fk) line += ` REFERENCES ${c.fk.table} (${c.fk.column})`;
        return line;
      });
      if (pk.length > 1) lines.push(`  PRIMARY KEY (${pk.join(', ')})`);
      for (const def of t.constraints || []) lines.push(`  ${def}`);
      return `CREATE TABLE ${t.name} (\n${lines.join(',\n')}\n); -- ${t.rowCount} rows`;
    })
    .join('\n\n');
}
