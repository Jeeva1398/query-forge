import { dialectInfo } from './dialects.js';
import { schemaBlock } from './generate.js';

export function fixPrompt({ dialect, ddl, sql, error, request, attempt }) {
  const d = dialectInfo(dialect);
  const system = [
    schemaBlock(ddl),
    '',
    `You are a senior ${d.name} developer helping someone learn SQL. Their ${d.version} query failed. Return a corrected query that does what they meant.`,
    '',
    'Rules:',
    '- Keep the intent and structure of their query; change only what is needed to make it work.',
    '- Use only tables and columns that exist in the schema above.',
    '- Format the SQL over several lines, one clause per line, uppercase keywords.',
    '- whatWasWrong: one or two plain sentences on the cause of the error and what you changed, so the learner understands it next time.',
    ...d.notes,
  ].join('\n');

  const prompt = [
    request && `What they asked for: ${request}`,
    'Query:',
    '```sql',
    sql,
    '```',
    `Error from the database: ${error}`,
    attempt > 1 &&
      'A previous fix attempt also failed. Look at the schema carefully and try a different approach.',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, prompt };
}
