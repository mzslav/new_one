const express = require('express');
const { connectMongo } = require('./db/mongo');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = Number(process.env.PORT) || 3004;

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'notification-service' }));
app.use('/api/notifications', notificationRoutes);

async function start() {
  let attempts = 0;
  while (attempts < 15) {
    try {
      await connectMongo();
      break;
    } catch (err) {
      attempts += 1;
      console.warn(`notification-service: Mongo not ready (${attempts}/15): ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  app.listen(PORT, () => console.log(`notification-service listening on :${PORT}`));
}

start().catch((err) => {
  console.error('notification-service fatal error', err);
  process.exit(1);
});
