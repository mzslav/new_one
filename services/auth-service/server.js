const express = require('express');
const { initSchema } = require('./db/pool');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// CORS is handled by api-gateway only; backend cors() caused duplicate ACAO headers.
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));
app.use('/api/auth', authRoutes);

async function start() {
  let attempts = 0;
  while (attempts < 10) {
    try {
      await initSchema();
      break;
    } catch (err) {
      attempts += 1;
      console.warn(`auth-service: DB not ready (attempt ${attempts}/10): ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  app.listen(PORT, () => console.log(`auth-service listening on :${PORT}`));
}

start().catch((err) => {
  console.error('auth-service fatal error', err);
  process.exit(1);
});
