const express = require('express');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'auth-service' }));
app.use('/api/auth', authRoutes);

app.listen(PORT, () => console.log(`auth-service listening on :${PORT}`));
