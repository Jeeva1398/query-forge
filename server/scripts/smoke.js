// Makes one real call per pool so you can check the key and model names.
// Usage: npm run smoke            (two lite calls + one flash call)
//        npm run smoke -- lite    (lite only, saves the scarce flash quota)
//        npm run smoke -- flash   (flash only)
import { z } from 'zod';
import { createLLM, geminiGenerate } from '../src/llm.js';
import { config } from '../src/config.js';
import { gradeOut } from '../src/schemas.js';

const { apiKey, lite, flash, timeoutMs } = config.gemini;
if (!apiKey) {
  console.error('GEMINI_API_KEY is missing from server/.env');
  process.exit(1);
}

const generate = geminiGenerate({ apiKey, timeoutMs });
const onlyLite = process.argv.includes('lite');
const onlyFlash = process.argv.includes('flash');

const sqlOut = z.object({ sql: z.string().min(1), explanation: z.string() });
const system =
  'You write PostgreSQL 18 queries. Schema: customers(id, name, city), orders(id, customer_id, total, created_at).';

const checks = onlyFlash
  ? []
  : [
      {
        label: 'lite',
        llm: createLLM({ generate, lite, flash: [] }),
        schema: sqlOut,
        prompt: 'Count customers per city.',
      },
      {
        // nullable field: checks that Gemini accepts anyOf/null in the schema
        label: 'lite (nullable schema)',
        llm: createLLM({ generate, lite, flash: [] }),
        schema: gradeOut,
        prompt:
          'Give feedback on: SELECT city, count(*) FROM customers GROUP BY city. Use null for betterSolution if it is already fine.',
      },
    ];
if (!onlyLite) {
  checks.push({
    label: 'flash',
    llm: createLLM({ generate, lite: [], flash }),
    schema: sqlOut,
    prompt:
      'For each customer, show their orders with a running total of order value by date.',
  });
}

let failed = false;
for (const c of checks) {
  try {
    const { data, meta } = await c.llm.call({
      route: 'smoke',
      tier: c.label.startsWith('flash') ? 'flash' : 'lite',
      system,
      prompt: c.prompt,
      schema: c.schema,
    });
    console.log(`\n✓ ${c.label}: ${meta.model} in ${meta.ms} ms`);
    const tries = meta.attempts.map((a) => `${a.model}=${a.status}`);
    console.log(`attempts: ${tries.join(', ')}`);
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    failed = true;
    console.log(`\n✗ ${c.label}: ${err.code || err.status} ${err.message}`);
    if (err.detail) console.log(err.detail);
  }
}
process.exit(failed ? 1 : 0);
