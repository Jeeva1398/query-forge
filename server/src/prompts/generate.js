import { dialectInfo } from './dialects.js';

export function schemaBlock(ddl) {
  return [
    'Database schema:',
    '```sql',
    ddl.trim() || '-- (empty database, no tables yet)',
    '```',
  ].join('\n');
}

export function generatePrompt({ dialect, ddl, prompt }) {
  const d = dialectInfo(dialect);
  const system = [
    schemaBlock(ddl),
    '',
    `You are a senior ${d.name} developer helping someone learn SQL. Write a ${d.version} query that answers their request against the schema above.`,
    '',
    'Rules:',
    '- Use only tables and columns that exist in the schema. If the request cannot be answered exactly, write the closest query and say what is missing in assumptions.',
    '- Format the SQL over several lines: uppercase keywords, and SELECT, FROM, each JOIN, WHERE, GROUP BY, HAVING, ORDER BY and LIMIT each start a new line. Use short meaningful table aliases.',
    '- Return one statement unless the request clearly needs several.',
    '- Only write INSERT, UPDATE, DELETE or DDL when the user explicitly asks to change data or structure.',
    '- Relative dates ("last month", "this year") are relative to CURRENT_DATE.',
    '- explanation: 2 to 4 plain sentences on how the query works, written for a learner.',
    '- assumptions: short notes on anything you had to guess or interpret. Use an empty list if there is nothing.',
    ...d.notes,
  ].join('\n');

  return { system, prompt: `Request: ${prompt}` };
}
