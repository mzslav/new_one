const express = require('express');
const { initSchema } = require('./db/pool');
const jobRoutes = require('./routes/jobs');

const app = express();
const PORT = Number(process.env.PORT) || 3002;

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'job-service' }));
app.use('/api/jobs', jobRoutes);

async function start() {
  let attempts = 0;
  while (attempts < 15) {
    try {
      await initSchema();
      break;
    } catch (err) {
      attempts += 1;
      console.warn(`job-service: DB not ready (${attempts}/15): ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  app.listen(PORT, () => console.log(`job-service listening on :${PORT}`));
}

start().catch((err) => {
  console.error('job-service fatal error', err);
  process.exit(1);
});
