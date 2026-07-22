// api/src/server.js
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('../config/config');
const { resolveProjectPath } = require('../config/runtimePaths');

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

// Swagger UI usa assets externos e script inline; liberamos apenas na rota de docs.
app.use('/api/docs', (req, res, next) => {
  res.removeHeader('Content-Security-Policy');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; style-src 'self' 'unsafe-inline' https://unpkg.com; script-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https:; font-src 'self' https: data:; connect-src 'self';"
  );
  next();
});

// Health check endpoint
const { isDbAvailable } = require('../db/sqlite');
const openApiSpec = require('../api-docs.json');
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.nodeEnv,
    database: isDbAvailable() ? 'available' : 'unavailable'
  });
});

app.get('/api/docs/openapi.json', (req, res) => {
  res.status(200).json(openApiSpec);
});

app.get('/api/docs', (req, res) => {
  const docsHtmlPath = resolveProjectPath('src', 'docs', 'swagger-ui.html');
  const docsHtml = fs.readFileSync(docsHtmlPath, 'utf8');
  res.type('html').send(docsHtml);
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
const server = app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Ambiente: ${config.nodeEnv}`);
  console.log(`🛡️ Rate limit: ${config.rateLimit?.enabled ? 'ativo' : 'desativado'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    console.error(`Porta ${PORT} já está em uso. Finalize a instância atual ou altere PORT no arquivo .env da API.`);
    process.exit(1);
  }

  console.error('Falha ao iniciar servidor:', error);
  process.exit(1);
});

module.exports = app;
