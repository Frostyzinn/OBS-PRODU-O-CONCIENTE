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
    console.error('Falha ao inicializar banco:', error);
    return res.status(503).json({
      ok: false,
      error: 'Banco de dados indisponível. Verifique as variáveis MYSQL_* na Vercel.'
    });
  }
};
