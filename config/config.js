// api/config/config.js
require('dotenv').config();

// Firebase configuration must be provided via environment. Do not force defaults
// to avoid accidentally using incomplete or placeholder credentials.

const nodeEnv = process.env.NODE_ENV || 'development';
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED != null
  ? String(process.env.RATE_LIMIT_ENABLED).trim().toLowerCase() === 'true'
  : nodeEnv !== 'development';

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv,
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'coletor-patrimonial-secret-key-2024',
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
    path: process.env.DB_PATH || '/data/database.sqlite'
  },

  // Firebase Configuration
  firebase: {
    credentialsPath: process.env.FIREBASE_CREDENTIALS_PATH,
    databaseURL: process.env.FIREBASE_DATABASE_URL
  }
};
