import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { llmStatus } from './llm.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '200kb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/ai/status', (req, res) => {
  res.json(llmStatus());
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  if (err.retryAfter) res.set('Retry-After', String(err.retryAfter));
  res.status(status).json({
    error: err.code || (status === 400 ? 'bad_request' : 'server_error'),
    message: status < 500 || err.code ? err.message : 'Something went wrong.',
    ...(err.retryAfter ? { retryAfter: err.retryAfter } : {}),
  });
});

app.listen(config.port, () => {
  console.log(`server listening on http://localhost:${config.port}`);
});
