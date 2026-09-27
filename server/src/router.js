import { config } from './config.js';

// Words that usually mean window functions, recursion or multi-step logic
const HEAVY =
  /\b(rank(ing|ed)?|dense_rank|top \d+ \w*\s*(per|in each|for each|by each)|running (total|sum|count)|cumulative|moving average|rolling|percentiles?|median|recursive|hierarch\w*|org chart|chain of|pivot|cohorts?|retention|gaps?|streaks?|consecutive|year over year|month over month|yoy|mom|lag|lead|window)\b/gi;

// Words that usually mean a join or an aggregate
const MEDIUM =
  /\b(join\w*|each|per|group(ed)?|average|avg|sum|count|compare|except|not in|never|without|latest|most recent|highest|lowest|distinct|having)\b/i;

export function tableNames(ddl = '') {
  const names = [];
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?"?(\w+)"?/gi;
  for (const m of ddl.matchAll(re)) names.push(m[1].toLowerCase());
  return names;
}

// "order_items" -> "order item", "categories" -> "categor"
function stem(name) {
  return name
    .replace(/_/g, ' ')
    .replace(/(ies|es|s)$/i, '')
    .trim();
}

export function mentionedTables(text, ddl) {
  const lower = text.toLowerCase().replace(/_/g, ' ');
  return tableNames(ddl).filter((name) => {
    const s = stem(name);
    return s.length > 2 && new RegExp(`\\b${s}`, 'i').test(lower);
  });
}

// The same ideas written as SQL (explain and fix route on the query itself)
const SQL_HEAVY =
  /\bover\s*\(|\bpartition\s+by\b|\bwith\s+recursive\b|\blateral\b|\brollup\b|\bgrouping\s+sets\b|\bcrosstab\b|\bfilter\s*\(\s*where\b/gi;

// first heavy feature +3, each different extra one +1 (max +4)
function heavyPoints(text) {
  const matches = [...text.matchAll(HEAVY), ...text.matchAll(SQL_HEAVY)];
  const hits = new Set(
    matches.map((m) => m[0].toLowerCase().split(/[\s(]/)[0]),
  );
  return hits.size ? Math.min(2 + hits.size, 4) : 0;
}

export function scoreComplexity({ prompt = '', ddl = '', sql = '' }) {
  const text = `${prompt}\n${sql}`;
  let score = Math.min(Math.max(mentionedTables(text, ddl).length - 2, 0), 2);
  score += heavyPoints(text);
  if (MEDIUM.test(text)) score += 1;
  if (prompt.length > 200) score += 1;
  return score;
}

export function pickTier(route, ctx = {}) {
  const threshold = ctx.threshold ?? config.flashThreshold;
  const score = scoreComplexity(ctx);
  const tier = (() => {
    switch (route) {
      case 'generate':
        return score >= threshold ? 'flash' : 'lite';
      case 'explain':
        return score >= threshold + 1 ? 'flash' : 'lite';
      case 'fix':
        return (ctx.attempt ?? 1) >= 2 ? 'flash' : 'lite';
      case 'exercise':
        return ctx.difficulty === 'hard' ? 'flash' : 'lite';
      case 'grade':
        return !ctx.passed && ctx.difficulty === 'hard' ? 'flash' : 'lite';
      default:
        return 'lite';
    }
  })();
  return { tier, score };
}
