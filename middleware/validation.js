// api/middleware/validation.js
const { body, param, query, validationResult } = require('express-validator');

// Middleware para processar resultados de validação
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      message: 'Verifique os dados enviados',
      details: errors.array()
    });
  }
  
  next();
};

// Validações para autenticação
const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Email deve ter formato válido')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),
  handleValidationErrors
];

const validateRegister = [
  body('email')
    .isEmail()
    .withMessage('Email deve ter formato válido')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('name')
    .optional()
    .isLength({ min: 2 })
    .withMessage('Nome deve ter pelo menos 2 caracteres')
    .trim(),
  body('fullName')
    .optional()
    .isLength({ min: 2 })
    .withMessage('Nome deve ter pelo menos 2 caracteres')
    .trim(),
  body()
    .custom((_, { req }) => {
      if (!req.body.name && !req.body.fullName) {
        throw new Error('Nome é obrigatório (name ou fullName)');
      }
      return true;
    }),
  body()
    .custom((_, { req }) => {
      const headerTenant = req.headers['x-tenant-id'] || req.headers['X-Tenant-Id'];
      const hasTenant = !!(req.body.tenantId || req.body.tenant_id || req.body.cnpj || headerTenant);
      if (!hasTenant) {
        throw new Error('tenantId é obrigatório (tenantId, tenant_id, cnpj ou header x-tenant-id)');
      }
      return true;
    }),
  handleValidationErrors
];

// Validações para inventário
const validateInventoryItem = [
  body('codigo')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Código não pode estar vazio'),
  body('placa')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Placa não pode estar vazia'),
  body('descricao')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Descrição não pode estar vazia'),
  body('local')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Local não pode estar vazio'),
  body('situacao')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Situação não pode estar vazia'),
  body('estado')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Estado não pode estar vazio'),
  body('inventariadoPor')
    .optional()
    .isLength({ min: 1 })
    .withMessage('inventariadoPor não pode estar vazio')
    .trim(),
  body('observacao')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Observação deve ter no máximo 500 caracteres'),
  handleValidationErrors
];

const validateInventoryUpdate = [
  body('local')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Local não pode estar vazio'),
  body('situacao')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Situação não pode estar vazia'),
  body('estado')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Estado não pode estar vazio'),
  body('inventariadoPor')
    .optional()
    .isLength({ min: 1 })
    .withMessage('inventariadoPor não pode estar vazio')
    .trim(),
  body('observacao')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Observação deve ter no máximo 500 caracteres'),
  handleValidationErrors
];

// Validações para parâmetros de rota
const validateId = [
  param('id')
    .isLength({ min: 1 })
    .withMessage('ID não pode estar vazio'),
  handleValidationErrors
];

const validateCode = [
  param('code')
    .isLength({ min: 1 })
    .withMessage('Código não pode estar vazio'),
  handleValidationErrors
];

// Validações para query parameters
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Página deve ser um número inteiro positivo'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Limite deve ser um número entre 1 e 1000'),
  query('since')
    .optional()
    .isISO8601()
    .withMessage('Parâmetro since deve ser uma data válida no formato ISO8601'),
  handleValidationErrors
];

const validateSearch = [
  query('q')
    .optional()
    .isLength({ min: 1 })
    .withMessage('Termo de busca não pode estar vazio'),
  query('field')
    .optional()
    .isIn(['codigo', 'placa', 'descricao', 'local'])
    .withMessage('Campo de busca deve ser: codigo, placa, descricao ou local'),
  handleValidationErrors
];

// Validação opcional para nrInventario em query params
const validateNrInventarioQuery = [
  query('nrInventario')
    .optional()
    .isLength({ min: 1 })
    .withMessage('nrInventario não pode estar vazio'),
  handleValidationErrors
];

module.exports = {
  handleValidationErrors,
  validateLogin,
  validateRegister,
  validateInventoryItem,
  validateInventoryUpdate,
  validateId,
  validateCode,
  validatePagination,
  validateSearch
  ,
  validateNrInventarioQuery
};
