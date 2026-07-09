// api/src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('../config/config');

// Importar rotas
const authRoutes = require('../routes/auth');
const inventoryRoutes = require('../routes/inventory');
const userRoutes = require('../routes/users');
const catalogsRoutes = require('../routes/catalogs');

const app = express();

// Trust proxy configuration to handle X-Forwarded-For headers properly
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors(config.cors));

// Rate limiting
if (config.rateLimit?.enabled) {
  const limiter = rateLimit(config.rateLimit);
  app.use(limiter);
}

// Compression middleware
app.use(compression());

// Logging middleware
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
const { isDbAvailable } = require('../db/sqlite');
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    database: isDbAvailable() ? 'available' : 'unavailable'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/catalogs', catalogsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint não encontrado',
    message: `Rota ${req.originalUrl} não existe`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  const status = err.status || 500;
  const message = config.nodeEnv === 'development' 
    ? err.message 
    : 'Erro interno do servidor';
  
  res.status(status).json({
    error: message,
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Ambiente: ${config.nodeEnv}`);
  console.log(`🛡️ Rate limit: ${config.rateLimit?.enabled ? 'ativo' : 'desativado'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
