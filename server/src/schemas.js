import { z } from 'zod';

// Shapes the model must answer with. The same schemas are sent to Gemini as
// the response JSON schema and used to validate what comes back.

export const generateOut = z.object({
  sql: z.string().min(1),
  explanation: z.string().min(1),
  assumptions: z.array(z.string()),
});

export const fixOut = z.object({
  sql: z.string().min(1),
  whatWasWrong: z.string().min(1),
});

export const convertOut = z.object({
  sql: z.string().min(1),
  summary: z.string().min(1),
  changes: z.array(z.string()),
});

export const explainOut = z.object({
  steps: z
    .array(z.object({ part: z.string(), explanation: z.string() }))
    .min(1),
  complexityNotes: z.string(),
});

export const exerciseOut = z.object({
  title: z.string().min(1),
  prompt: z.string().min(1),
  schema_ddl: z.string().min(1),
  seed_sql: z.string().min(1),
  reference_solution: z.string().min(1),
  hints: z.array(z.string()).length(3),
  orderMatters: z.boolean(),
});

export const gradeOut = z.object({
  feedback: z.string().min(1),
  betterSolution: z.string().nullable(),
  conceptTips: z.array(z.string()),
});

export const hintOut = z.object({
  hint: z.string().min(1),
});

export function toResponseSchema(schema) {
  // eslint-disable-next-line no-unused-vars
  const { $schema, ...rest } = z.toJSONSchema(schema);
  return rest;
}
