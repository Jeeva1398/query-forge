import { createHash } from 'node:crypto';

export function cacheKey(...parts) {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

// Map keeps insertion order, so the first key is always the least recently used
export function createCache(limit = 200) {
  const map = new Map();
  return {
    get(key) {
      if (!map.has(key)) return undefined;
      const value = map.get(key);
      map.delete(key);
      map.set(key, value);
      return value;
    },
    set(key, value) {
      map.delete(key);
      map.set(key, value);
      if (map.size > limit) map.delete(map.keys().next().value);
    },
    get size() {
      return map.size;
    },
  };
}
