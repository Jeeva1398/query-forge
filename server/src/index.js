import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const PORT = Number(process.env.PORT) || 7100;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();

app.use(helmet());
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: '200kb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'not_found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'server_error' });
});

app.listen(PORT, () => {
  console.log(`server listening on http://localhost:${PORT}`);
});
