const app = require('../backend/server');
const { initializeDatabase } = require('../backend/database');

let databaseInitialization;

function restoreExpressPath(req) {
  const requestUrl = new URL(req.url, 'http://localhost');
  const routeValues = requestUrl.searchParams.getAll('vercelRoute');
  if (!routeValues.length) return;

  const routePath = routeValues[routeValues.length - 1].replace(/^\/+/, '');
  requestUrl.searchParams.delete('vercelRoute');
  requestUrl.pathname = routePath ? `/api/${routePath}` : '/api';
  req.url = `${requestUrl.pathname}${requestUrl.search}`;
}

module.exports = async function handler(req, res) {
  if (!databaseInitialization) {
    databaseInitialization = initializeDatabase();
  }

  try {
    await databaseInitialization;
  } catch (error) {
    console.error('Could not initialize ASTRA COMMAND database:', error.message);
    res.status(500).json({ error: 'Database is unavailable. Please try again later.' });
    return;
  }

  restoreExpressPath(req);
  return app(req, res);
};
