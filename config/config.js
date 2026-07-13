// api/config/config.js
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env')
});

// Firebase configuration must be provided via environment. Do not force defaults
// to avoid accidentally using incomplete or placeholder credentials.
const jwtSecret = String(process.env.JWT_SECRET || '').trim();
const globalPurgeSecret = String(process.env.GLOBAL_PURGE_SECRET || '').trim();
const dbPathRaw = String(process.env.DB_PATH || './data/database.sqlite').trim() || './data/database.sqlite';
const dbPath = path.isAbsolute(dbPathRaw)
  ? dbPathRaw
  : path.resolve(__dirname, '..', dbPathRaw);

if (!jwtSecret || jwtSecret === 'troque-esta-chave-em-producao') {
  throw new Error(
    'JWT_SECRET obrigatorio. Defina uma chave forte no arquivo api/.env antes de iniciar a API.'
  );
}

const nodeEnv = process.env.NODE_ENV || 'development';
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED != null
  ? String(process.env.RATE_LIMIT_ENABLED).trim().toLowerCase() === 'true'
  : nodeEnv !== 'development';

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv,
  
  // JWT Configuration
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    // Prazo de expiração do refresh token
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  },
  
  // Rate Limiting
  rateLimit: {
    enabled: rateLimitEnabled,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    trustProxy: true, // Enable trust proxy to handle X-Forwarded-For headers
    skip: (req) => {
      // Skip rate limiting for health checks and auth endpoints
      const path = req.path || req.originalUrl || '';
      if (path === '/health') return true;
      // Evitar 429 em login/registro/refresh/logout para experiência consistente
      if (path.startsWith('/api/auth/')) return true;
      return false;
    },
    keyGenerator: (req /*, res*/ ) => {
      // Garante uma chave consistente por IP mesmo atrás de proxy
      return req.ip || req.headers['x-forwarded-for'] || 'unknown';
    }
  },
  
  // Database Configuration (for future SQLite integration)
  database: {
    type: 'sqlite',
    path: dbPath
  },

  // Firebase Configuration
  firebase: {
    credentialsPath: process.env.FIREBASE_CREDENTIALS_PATH,
    databaseURL: process.env.FIREBASE_DATABASE_URL
  },

  // Administrative security configuration
  security: {
    globalPurgeSecret
  }
};
