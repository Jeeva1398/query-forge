import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createLLM } from '../src/llm.js';
import { createQuota } from '../src/quota.js';

const schema = z.object({ sql: z.string().min(1) });
const good = JSON.stringify({ sql: 'SELECT 1' });

const apiError = (status, message = 'error') =>
  Object.assign(new Error(message), { status });

// Fake Gemini: `plan` maps a model name to what it should do on each call
function fakeGenerate(plan) {
  const calls = [];
  const fn = vi.fn(async ({ model }) => {
    calls.push(model);
    const step = plan[model];
    const next = Array.isArray(step) ? step.shift() : step;
    if (next instanceof Error) throw next;
    return next ?? good;
  });
  fn.calls = calls;
  return fn;
}

function setup(
  plan,
  { lite = ['lite-a', 'lite-b'], flash = ['flash-a', 'flash-b'] } = {},
) {
  let clock = new Date('2026-09-27T10:00:00Z');
  const now = () => clock;
  const generate = fakeGenerate(plan);
  const llm = createLLM({
    generate,
    lite,
    flash,
    quota: createQuota(now),
    now,
  });
  const request = (prompt = 'q', tier = 'lite') =>
    llm.call({ route: 'generate', tier, system: 's', prompt, schema });
  const advance = (ms) => {
    clock = new Date(clock.getTime() + ms);
  };
  return { llm, generate, request, advance };
}

describe('callLLM', () => {
  it('uses the first model of the requested pool', async () => {
    const { request } = setup({});
    const { data, meta } = await request();
    expect(data).toEqual({ sql: 'SELECT 1' });
    expect(meta).toMatchObject({
      model: 'lite-a',
      tier: 'lite',
      cached: false,
    });
  });

  it('serves repeated requests from the cache', async () => {
    const { request, generate } = setup({});
    await request('same');
    const second = await request('same');
    expect(second.meta.cached).toBe(true);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('moves to the next model on 429 and keeps skipping the blocked one', async () => {
    const { request, generate } = setup({
      'lite-a': apiError(429, 'Please retry in 30s'),
    });
    const first = await request('one');
    expect(first.meta.model).toBe('lite-b');
    await request('two');
    expect(generate.calls).toEqual(['lite-a', 'lite-b', 'lite-b']);
  });

  it('comes back to a rate-limited model after its retry delay', async () => {
    const { request, generate, advance } = setup({
      'lite-a': [apiError(429, 'Please retry in 30s'), good],
    });
    await request('one');
    advance(31_000);
    const again = await request('two');
    expect(again.meta.model).toBe('lite-a');
    expect(generate.calls).toEqual(['lite-a', 'lite-b', 'lite-a']);
  });

  it('blocks a model until the next day when the daily quota is used up', async () => {
    const { llm, request } = setup({
      'lite-a': apiError(
        429,
        'Quota exceeded: GenerateRequestsPerDayPerProjectPerModel-FreeTier',
      ),
    });
    await request();
    const lite = llm.status().pools.lite.find((m) => m.model === 'lite-a');
    // 10:00Z is 03:00 in Los Angeles, so the reset is at 07:00Z the next day
    expect(lite.blockedUntil).toBe('2026-09-28T07:00:00.000Z');
    expect(lite.reason).toBe('quota');
  });

  it('puts busy models (503) on a short cooldown', async () => {
    const { request, generate, advance } = setup({
      'flash-a': [apiError(503, 'high demand'), good],
    });
    const first = await request('one', 'flash');
    expect(first.meta.model).toBe('flash-b');
    await request('two', 'flash');
    advance(3 * 60_000);
    await request('three', 'flash');
    expect(generate.calls).toEqual([
      'flash-a',
      'flash-b',
      'flash-b',
      'flash-a',
    ]);
  });

  it('retries once on flash when lite answers in the wrong shape', async () => {
    const { request } = setup({ 'lite-a': '{"nope": true}' });
    const { meta } = await request();
    expect(meta).toMatchObject({
      model: 'flash-a',
      escalated: true,
      requestedTier: 'lite',
    });
  });

  it('accepts JSON wrapped in a code fence', async () => {
    const { request } = setup({
      'lite-a': '```json\n{"sql": "SELECT 2"}\n```',
    });
    const { data } = await request();
    expect(data.sql).toBe('SELECT 2');
  });

  it('gives up after the second wrong-shaped answer', async () => {
    const { request } = setup({ 'lite-a': 'not json', 'flash-a': '{}' });
    await expect(request()).rejects.toMatchObject({
      status: 502,
      code: 'invalid_output',
    });
  });

  it('falls back to lite when every flash model is out, and says so', async () => {
    const limit = apiError(429, 'PerDay limit');
    const { request } = setup({ 'flash-a': limit, 'flash-b': limit });
    const { meta } = await request('q', 'flash');
    expect(meta).toMatchObject({ model: 'lite-a', downgraded: true });
  });

  it('reports ai_quota with retryAfter when every model is out', async () => {
    const limit = apiError(429, 'Please retry in 20s');
    const { request } = setup({
      'lite-a': limit,
      'lite-b': limit,
      'flash-a': limit,
      'flash-b': limit,
    });
    await expect(request()).rejects.toMatchObject({
      status: 503,
      code: 'ai_quota',
      retryAfter: 20,
    });
  });

  it('reports ai_busy when the models are overloaded rather than out of quota', async () => {
    const busy = apiError(503, 'high demand');
    const { request } = setup({
      'lite-a': busy,
      'lite-b': busy,
      'flash-a': busy,
      'flash-b': busy,
    });
    await expect(request()).rejects.toMatchObject({
      status: 503,
      code: 'ai_busy',
    });
  });

  it('does not retry other models on a 400', async () => {
    const { request, generate } = setup({
      'lite-a': apiError(400, 'bad schema'),
    });
    await expect(request()).rejects.toMatchObject({
      status: 502,
      code: 'ai_error',
    });
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('tries the next model on a network error', async () => {
    const { request } = setup({ 'lite-a': new Error('fetch failed') });
    const { meta } = await request();
    expect(meta.model).toBe('lite-b');
  });

  it('counts usage per model', async () => {
    const { llm, request } = setup({});
    await request('a');
    await request('b');
    expect(llm.status().pools.lite[0]).toMatchObject({
      model: 'lite-a',
      usedToday: 2,
    });
  });
});
