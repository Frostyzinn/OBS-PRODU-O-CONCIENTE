// Catch-all serverless function for /api/* on Vercel.
// Express receives the original request path, so routes such as
// /api/v1/auth/login continue to work without rewrites.
const handler = require('./index');
module.exports = handler;
