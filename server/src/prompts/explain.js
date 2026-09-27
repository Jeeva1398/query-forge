import { dialectInfo } from './dialects.js';
import { schemaBlock } from './generate.js';

export function explainPrompt({ dialect, ddl, sql }) {
  const d = dialectInfo(dialect);
  const system = [
    schemaBlock(ddl),
    '',
    `You are a patient ${d.name} teacher. Explain the query below to someone learning SQL.`,
    '',
    'Rules:',
    '- steps: walk through the query in the order the database evaluates it (FROM and JOINs, WHERE, GROUP BY, HAVING, window functions, SELECT, ORDER BY, LIMIT). CTEs and subqueries come first, as their own steps.',
    '- part: the exact SQL fragment the step is about, copied from the query (keep it short).',
    '- explanation: one or two plain sentences on what that part does to the rows. Mention concrete table and column names.',
    '- complexityNotes: one to three sentences on performance: which indexes would help and what gets expensive as tables grow. The sample tables are small, so say that it runs fast here.',
    ...d.notes,
  ].join('\n');

  return { system, prompt: ['Query:', '```sql', sql, '```'].join('\n') };
}
