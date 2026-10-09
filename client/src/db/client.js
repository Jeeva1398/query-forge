// Promise wrapper around a database worker. The worker is only started on the
// first call, so the SQLite engine isn't downloaded until someone uses it.
function connect(createWorker) {
  let worker = null;
  const pending = new Map();
  let nextId = 1;

  function send(type, payload) {
    if (!worker) {
      worker = createWorker();
      worker.onmessage = ({ data }) => {
        const call = pending.get(data.id);
        if (!call) return;
        pending.delete(data.id);
        if (data.ok) call.resolve(data.result);
        else
          call.reject(Object.assign(new Error(data.error.message), data.error));
      };
    }
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, type, payload });
    });
  }

  return {
    run: (sql) => send('run', { sql }),
    reset: (seed) => send('reset', { seed }),
    explain: (sql) => send('explain', { sql }),
    schema: () => send('schema'),
  };
}

export const db = connect(
  () =>
    new Worker(new URL('./pglite.worker.js', import.meta.url), {
      type: 'module',
    }),
);

export const sqlite = connect(
  () =>
    new Worker(new URL('./sqlite.worker.js', import.meta.url), {
      type: 'module',
    }),
);
