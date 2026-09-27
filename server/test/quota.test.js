import { describe, expect, it } from 'vitest';
import {
  blockUntil,
  createQuota,
  nextPacificMidnight,
  pacificDay,
} from '../src/quota.js';
import { createCache } from '../src/cache.js';

describe('pacific time helpers', () => {
  it('finds the next midnight in Los Angeles (summer time)', () => {
    const at = new Date('2026-09-27T10:00:00Z'); // 03:00 PDT
    expect(nextPacificMidnight(at).toISOString()).toBe(
      '2026-09-28T07:00:00.000Z',
    );
  });

  it('finds the next midnight in Los Angeles (winter time)', () => {
    const at = new Date('2026-01-15T20:30:00Z'); // 12:30 PST
    expect(nextPacificMidnight(at).toISOString()).toBe(
      '2026-01-16T08:00:00.000Z',
    );
  });

  it('uses the Pacific date, not UTC', () => {
    expect(pacificDay(new Date('2026-09-28T05:00:00Z'))).toBe('2026-09-27');
  });
});

describe('blockUntil', () => {
  const now = new Date('2026-09-27T10:00:00Z');

  it('reads the retry delay from the error', () => {
    const until = blockUntil({ message: 'Please retry in 37.4s.' }, now);
    expect(until.getTime() - now.getTime()).toBe(38_000);
  });

  it('reads retryDelay from the JSON details', () => {
    const until = blockUntil({ message: '{"retryDelay": "12s"}' }, now);
    expect(until.getTime() - now.getTime()).toBe(12_000);
  });

  it('defaults to a minute', () => {
    const until = blockUntil({ message: 'Too many requests' }, now);
    expect(until.getTime() - now.getTime()).toBe(60_000);
  });
});

describe('quota', () => {
  it('clears usage and blocks when the Pacific day changes', () => {
    let clock = new Date('2026-09-27T10:00:00Z');
    const quota = createQuota(() => clock);
    quota.recordUse('m');
    quota.block('m', new Date('2026-09-29T00:00:00Z'));
    expect(quota.isBlocked('m')).toBe(true);
    clock = new Date('2026-09-28T08:00:00Z'); // after midnight PT
    expect(quota.isBlocked('m')).toBe(false);
    expect(quota.snapshot('m').usedToday).toBe(0);
  });
});

describe('cache', () => {
  it('drops the least recently used entry', () => {
    const cache = createCache(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.get('a');
    cache.set('c', 3);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });
});
