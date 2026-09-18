const app = require('../server');
const { initDatabase } = require('../db/database');

let databaseReady;

module.exports = async function handler(req, res) {
  // Rewrites internos preservam o caminho original recebido pelo Express.
  // Health é liveness: deve funcionar mesmo durante indisponibilidade do MySQL.
  if (req.url.split('?')[0] === '/api/health') return app(req, res);
  try {
    if (!databaseReady) databaseReady = initDatabase();
    await databaseReady;
    return app(req, res);
  } catch (error) {
    databaseReady = null;
    console.error('Falha ao inicializar banco:', error.code||error.name);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({
      ok: false,
      error: 'Serviço temporariamente indisponível. Tente novamente em instantes.'
    }));
  }
};
