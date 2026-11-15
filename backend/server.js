require('dotenv').config();

const express = require('express');
const path = require('node:path');
const missionRoutes = require('./routes/missions');
const nasaRoutes = require('./routes/nasa');
const { initializeDatabase, isDatabaseEnabled } = require('./database');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));
app.use('/api/missions', missionRoutes);
app.use('/api/nasa', nasaRoutes);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', storage: isDatabaseEnabled() ? 'mysql' : 'demo' });
});
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('Request error:', err.message);
  if (res.headersSent) return next(err);
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body must be valid JSON.' });
  }
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.' });
});

async function start() {
  await initializeDatabase();
  app.listen(port, () => {
    console.log(`ASTRA COMMAND ready at http://localhost:${port} (${isDatabaseEnabled() ? 'MySQL' : 'demo'} storage)`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error('Could not start ASTRA COMMAND:', error.message);
    process.exitCode = 1;
  });
}

module.exports = app;
