import { dialectInfo } from './dialects.js';
import { schemaBlock } from './generate.js';

export function convertPrompt({ from, to, ddl, sql }) {
  const source = dialectInfo(from);
  const target = dialectInfo(to);
  const system = [
    schemaBlock(ddl),
    '',
    `You are a senior database developer helping someone learn SQL. Rewrite their ${source.version} query for ${target.version} so it returns the same rows.`,
    '',
    'Rules:',
    `- Keep the structure, aliases and column names; change only what ${target.name} needs (functions, casts, quoting, date handling, LIMIT syntax, booleans, JSON access).`,
    '- Use only tables and columns that exist in the schema above.',
    '- Format the SQL over several lines, one clause per line, uppercase keywords.',
    `- If something has no exact ${target.name} equivalent, write the closest version and say what differs in changes.`,
    '- summary: one plain sentence on how much had to change.',
    "- changes: one short note per change, like \"date_trunc('month', d) → strftime('%Y-%m', d)\". Use an empty list if the query works as it is.",
    ...target.notes,
  ].join('\n');

  return {
    system,
    prompt: [`${source.name} query:`, '```sql', sql, '```'].join('\n'),
  };
}
