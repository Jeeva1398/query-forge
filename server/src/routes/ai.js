import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { callLLM } from '../llm.js';
import { pickTier } from '../router.js';
import { convertOut, explainOut, fixOut, generateOut } from '../schemas.js';
import { dialectNames } from '../prompts/dialects.js';
import { generatePrompt } from '../prompts/generate.js';
import { fixPrompt } from '../prompts/fix.js';
import { explainPrompt } from '../prompts/explain.js';
import { convertPrompt } from '../prompts/convert.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    error: 'rate_limited',
    message: 'Too many AI requests in a minute. Give it a few seconds.',
  },
});

const dialect = z.enum(dialectNames).default('postgres');
const ddl = z.string().max(30_000, 'The schema is too large to send.');
const sql = z
  .string()
  .trim()
  .min(1, 'There is no query to work with.')
  .max(20_000, 'The query is too long.');

const generateIn = z.object({
  dialect,
  ddl,
  prompt: z
    .string()
    .trim()
    .min(3, 'Describe what you want in a few words.')
    .max(1000, 'Keep the request under 1000 characters.'),
});

const fixIn = z.object({
  dialect,
  ddl,
  sql,
  error: z.string().trim().min(1).max(2000),
  request: z.string().trim().max(1000).optional(),
  attempt: z.number().int().min(1).max(5).default(1),
});

const explainIn = z.object({ dialect, ddl, sql });

const convertIn = z
  .object({ from: dialect, to: z.enum(dialectNames), ddl, sql })
  .refine((v) => v.from !== v.to, {
    path: ['to'],
    message: 'Pick a different dialect to convert to.',
  });

// validates the body, then hands the parsed input to the route
function handle(schema, fn) {
  return async (req, res, next) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return res.status(400).json({
        error: 'bad_request',
        message: `${issue.path.join('.') || 'body'}: ${issue.message}`,
      });
    }
    try {
      res.json(await fn(parsed.data));
    } catch (err) {
      next(err);
    }
  };
}

router.post(
  '/generate',
  aiLimiter,
  handle(generateIn, (input) => {
    const { tier, score } = pickTier('generate', {
      prompt: input.prompt,
      ddl: input.ddl,
    });
    return callLLM({
      route: 'generate',
      tier,
      score,
      ...generatePrompt(input),
      schema: generateOut,
    });
  }),
);

router.post(
  '/fix',
  aiLimiter,
  handle(fixIn, (input) => {
    const { tier, score } = pickTier('fix', {
      attempt: input.attempt,
      sql: input.sql,
      ddl: input.ddl,
    });
    return callLLM({
      route: 'fix',
      tier,
      score,
      ...fixPrompt(input),
      schema: fixOut,
    });
  }),
);

router.post(
  '/explain',
  aiLimiter,
  handle(explainIn, (input) => {
    const { tier, score } = pickTier('explain', {
      sql: input.sql,
      ddl: input.ddl,
    });
    return callLLM({
      route: 'explain',
      tier,
      score,
      ...explainPrompt(input),
      schema: explainOut,
    });
  }),
);

router.post(
  '/convert',
  aiLimiter,
  handle(convertIn, (input) => {
    const { tier, score } = pickTier('convert', {
      sql: input.sql,
      ddl: input.ddl,
    });
    return callLLM({
      route: 'convert',
      tier,
      score,
      ...convertPrompt(input),
      schema: convertOut,
    });
  }),
);

export { router as aiRoutes };
