const express = require('express');
const { connectMongo } = require('./db/mongo');
const { ensureBucket } = require('./storage/minio');
const mediaRoutes = require('./routes/media');

const app = express();
const PORT = Number(process.env.PORT) || 3003;

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'media-service' }));
app.use('/api/media', mediaRoutes);

async function withRetry(fn, label) {
  let attempts = 0;
  while (attempts < 15) {
    try {
      await fn();
      return;
    } catch (err) {
      attempts += 1;
      console.warn(`media-service: ${label} not ready (${attempts}/15): ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error(`media-service: ${label} failed to initialize`);
}

async function start() {
  await withRetry(connectMongo, 'Mongo');
  await withRetry(ensureBucket, 'MinIO');
  app.listen(PORT, () => console.log(`media-service listening on :${PORT}`));
}

start().catch((err) => {
  console.error('media-service fatal error', err);
  process.exit(1);
});
