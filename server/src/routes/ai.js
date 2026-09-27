import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { callLLM } from '../llm.js';
import { pickTier } from '../router.js';
import { generateOut } from '../schemas.js';
import { dialectNames } from '../prompts/dialects.js';
import { generatePrompt } from '../prompts/generate.js';

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

const generateIn = z.object({
  dialect,
  ddl,
  prompt: z
    .string()
    .trim()
    .min(3, 'Describe what you want in a few words.')
    .max(1000, 'Keep the request under 1000 characters.'),
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

export { router as aiRoutes };
