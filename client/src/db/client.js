const worker = new Worker(new URL('./pglite.worker.js', import.meta.url), {
  type: 'module',
});

const pending = new Map();
let nextId = 1;

worker.onmessage = ({ data }) => {
  const call = pending.get(data.id);
  if (!call) return;
  pending.delete(data.id);
  if (data.ok) call.resolve(data.result);
  else call.reject(Object.assign(new Error(data.error.message), data.error));
};

function send(type, payload) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload });
  });
}

export const db = {
  run: (sql) => send('run', { sql }),
  reset: (seed) => send('reset', { seed }),
  explain: (sql) => send('explain', { sql }),
};
