const app = require('../backend/server');
const { initializeDatabase } = require('../backend/database');

let databaseInitialization;

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

  return app(req, res);
};
