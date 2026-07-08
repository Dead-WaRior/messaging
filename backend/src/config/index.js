require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  databaseUrl: process.env.DATABASE_URL,
};

if (!process.env.JWT_SECRET) {
  // Warn loudly but don't crash in dev so the health check still works.
  // eslint-disable-next-line no-console
  console.warn('[config] JWT_SECRET not set — using insecure default. Set it in .env before production.');
}

module.exports = config;
