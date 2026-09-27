import { useCallback, useState } from 'react';
import { load, save } from './storage.js';

const KEY = 'history';
const LIMIT = 200;

const normalize = (sql) => sql.trim().replace(/\s+/g, ' ').toLowerCase();

export function useHistory() {
  const [entries, setEntries] = useState(() => load(KEY, []));

  const update = useCallback((fn) => {
    setEntries((prev) => {
      const next = fn(prev);
      save(KEY, next);
      return next;
    });
  }, []);

  // the same query on the same dataset is kept once, moved to the top;
  // an AI prompt attached earlier is kept when the query is re-run by hand
  const add = useCallback(
    (entry) =>
      update((prev) => {
        const key = normalize(entry.sql);
        const existing = prev.find(
          (e) => e.dataset === entry.dataset && normalize(e.sql) === key,
        );
        const merged = {
          ...existing,
          ...entry,
          prompt: entry.prompt || existing?.prompt || null,
          model: entry.model || existing?.model || null,
          tier: entry.tier || existing?.tier || null,
          id: existing?.id || crypto.randomUUID(),
          at: new Date().toISOString(),
        };
        return [merged, ...prev.filter((e) => e !== existing)].slice(0, LIMIT);
      }),
    [update],
  );

  const remove = useCallback(
    (id) => update((prev) => prev.filter((e) => e.id !== id)),
    [update],
  );

  const clear = useCallback(() => update(() => []), [update]);

  return { entries, add, remove, clear };
}
