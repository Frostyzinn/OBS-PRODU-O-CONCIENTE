const app = require('../server');
const { initDatabase } = require('../db/database');

let databaseReady;

module.exports = async function handler(req, res) {
  try {
    if (!databaseReady) databaseReady = initDatabase();
    await databaseReady;
    return app(req, res);
  } catch (error) {
    databaseReady = null;
    console.error('Falha ao inicializar banco:', error.code||error.name);
    return res.status(503).json({
      ok: false,
      error: 'Serviço temporariamente indisponível. Tente novamente em instantes.'
    });
  }
};
