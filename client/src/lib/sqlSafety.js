// Removes comments and quoted text so keywords inside strings don't count
function strip(sql) {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, "''")
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, 'x');
}

function statements(sql) {
  return strip(sql)
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Returns a list of plain-English warnings for statements that destroy data
export function dangerousStatements(sql) {
  const warnings = [];
  for (const stmt of statements(sql)) {
    const s = stmt.replace(/\s+/g, ' ');
    let m;
    if (
      (m = s.match(
        /^drop\s+(table|schema|database|view|index)\s+(?:if exists\s+)?([\w.]+)/i,
      ))
    ) {
      warnings.push(`DROP ${m[1].toUpperCase()} ${m[2]}`);
    } else if ((m = s.match(/^truncate\s+(?:table\s+)?([\w.]+)/i))) {
      warnings.push(`TRUNCATE ${m[1]} (deletes every row)`);
    } else if (
      (m = s.match(/^delete\s+from\s+([\w.]+)/i)) &&
      !/\bwhere\b/i.test(s)
    ) {
      warnings.push(`DELETE from ${m[1]} with no WHERE (deletes every row)`);
    } else if ((m = s.match(/^update\s+([\w.]+)/i)) && !/\bwhere\b/i.test(s)) {
      warnings.push(`UPDATE ${m[1]} with no WHERE (changes every row)`);
    } else if ((m = s.match(/^alter\s+table\s+([\w.]+)\s+drop\b/i))) {
      warnings.push(`ALTER TABLE ${m[1]} … DROP`);
    }
  }
  return warnings;
}

// True when every statement only reads (safe to run automatically)
export function isReadOnly(sql) {
  const list = statements(sql);
  return (
    list.length > 0 &&
    list.every(
      (s) =>
        /^(select|with|explain|show|values|table)\b/i.test(s) &&
        !/\b(insert|update|delete|drop|alter|create|truncate)\b/i.test(s),
    )
  );
}
