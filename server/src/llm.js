import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';
import { cacheKey, createCache } from './cache.js';
import { blockUntil, createQuota } from './quota.js';
import { toResponseSchema } from './schemas.js';

export class LLMError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    Object.assign(this, extra);
  }
}

function parseJson(text) {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    try {
      return fenced ? JSON.parse(fenced[1]) : undefined;
    } catch {
      return undefined;
    }
  }
}

const BUSY_COOLDOWN_MS = 2 * 60 * 1000;

const isRetryable = (err) =>
  !err.status || err.status >= 500 || err.status === 408;

export function geminiGenerate({ apiKey, timeoutMs }) {
  const ai = new GoogleGenAI({ apiKey });
  return async ({ model, system, prompt, jsonSchema, tier }) => {
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        responseJsonSchema: jsonSchema,
        thinkingConfig: { thinkingLevel: tier === 'flash' ? 'MEDIUM' : 'LOW' },
        abortSignal: AbortSignal.timeout(timeoutMs),
      },
    });
    return res.text;
  };
}

export function createLLM({
  generate,
  lite,
  flash,
  quota = createQuota(),
  cache = createCache(),
  now = () => new Date(),
}) {
  const tierOf = (model) => (flash.includes(model) ? 'flash' : 'lite');
  const all = [...lite, ...flash];

  // preferred pool first, then the other one
  const order = (tier) =>
    (tier === 'flash' ? [...flash, ...lite] : [...lite, ...flash]).filter(
      (m) => !quota.isBlocked(m),
    );

  async function call({ route, tier, score = 0, system, prompt, schema }) {
    const key = cacheKey(route, system, prompt);
    const hit = cache.get(key);
    if (hit) return { data: hit.data, meta: { ...hit.meta, cached: true } };

    const started = Date.now();
    const jsonSchema = toResponseSchema(schema);
    const tried = new Set();
    let preferred = tier;
    let escalated = false;
    let lastError = null;
    const attempts = [];

    for (;;) {
      const model = order(preferred).find((m) => !tried.has(m));
      if (!model) break;
      tried.add(model);

      let raw;
      try {
        raw = await generate({
          model,
          system,
          prompt,
          jsonSchema,
          tier: tierOf(model),
        });
      } catch (err) {
        lastError = err;
        attempts.push({ model, status: err.status || err.name });
        if (err.status === 429) {
          quota.block(model, blockUntil(err, now()), 'quota');
          continue;
        }
        if (err.status === 503) {
          quota.block(
            model,
            new Date(now().getTime() + BUSY_COOLDOWN_MS),
            'busy',
          );
          continue;
        }
        if (isRetryable(err)) continue;
        throw new LLMError(502, 'ai_error', 'The AI request was rejected.', {
          detail: err.message,
        });
      }
      quota.recordUse(model);

      const parsed = schema.safeParse(parseJson(raw));
      attempts.push({ model, status: parsed.success ? 'ok' : 'invalid' });
      if (parsed.success) {
        const meta = {
          model,
          tier: tierOf(model),
          requestedTier: tier,
          score,
          cached: false,
          downgraded: tier === 'flash' && tierOf(model) === 'lite',
          escalated,
          attempts,
          ms: Date.now() - started,
        };
        cache.set(key, { data: parsed.data, meta });
        return { data: parsed.data, meta };
      }

      // wrong shape: give it one more go on the stronger pool, then stop
      if (escalated) {
        throw new LLMError(
          502,
          'invalid_output',
          'The AI answered in an unexpected format. Please try again.',
        );
      }
      escalated = true;
      preferred = 'flash';
    }

    const retryAt = quota.earliestUnblock(all);
    if (all.every((m) => quota.isBlocked(m))) {
      const retryAfter = Math.ceil((retryAt - now()) / 1000);
      if (all.some((m) => quota.reasonFor(m) === 'busy')) {
        throw new LLMError(
          503,
          'ai_busy',
          'The AI models are busy right now. Please try again in a couple of minutes.',
          { retryAfter },
        );
      }
      throw new LLMError(
        503,
        'ai_quota',
        'Daily AI limit reached. Try again later, or use the built-in practice exercises.',
        { retryAfter },
      );
    }
    throw new LLMError(
      502,
      'ai_unavailable',
      'The AI service did not respond. Please try again.',
      { detail: lastError?.message },
    );
  }

  function status() {
    return {
      pools: {
        lite: lite.map((model) => ({ model, ...quota.snapshot(model) })),
        flash: flash.map((model) => ({ model, ...quota.snapshot(model) })),
      },
      cacheSize: cache.size,
    };
  }

  return { call, status };
}

const { apiKey, lite, flash, timeoutMs } = config.gemini;

const instance = apiKey
  ? createLLM({ generate: geminiGenerate({ apiKey, timeoutMs }), lite, flash })
  : null;

export function callLLM(request) {
  if (!instance) {
    return Promise.reject(
      new LLMError(503, 'ai_not_configured', 'GEMINI_API_KEY is not set.'),
    );
  }
  return instance.call(request);
}

export function llmStatus() {
  return instance
    ? {
        configured: true,
        threshold: config.flashThreshold,
        ...instance.status(),
      }
    : { configured: false };
}
