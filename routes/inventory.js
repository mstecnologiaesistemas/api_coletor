// api/routes/inventory.js
const express = require('express');
const router = express.Router();

const inventoryController = require('../controllers/inventoryController');
const { verifyAuth } = require('../middleware/auth');
const { 
  validateInventoryItem, 
  validateInventoryUpdate,
  validateId,
  validateCode,
  validatePagination,
  validateSearch,
  validateNrInventarioQuery
} = require('../middleware/validation');

// Todas as rotas requerem autenticação
router.use(verifyAuth);

// Aplicar cabeçalhos no-cache
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Rotas principais
router.get('/', validatePagination, validateSearch, validateNrInventarioQuery, inventoryController.getAll);
router.post('/', validateInventoryItem, inventoryController.create);
router.post('/sync', inventoryController.sync);
router.get('/resultado', validateNrInventarioQuery, inventoryController.exportResultado);

// Exclusão em lote por nrInventario (deve vir ANTES das rotas com :id)
router.delete('/by-inventario', validateNrInventarioQuery, inventoryController.deleteByInventario);
// Exclusão de todos os itens do tenant atual (CNPJ)
router.delete('/tenant', inventoryController.deleteAllForTenant);

// Rotas por ID
router.get('/:id', validateId, validateNrInventarioQuery, inventoryController.getById);
router.put('/:id', validateId, validateInventoryUpdate, validateNrInventarioQuery, inventoryController.update);
router.delete('/:id', validateId, inventoryController.delete);

// Rotas por código/placa
router.get('/code/:code', validateCode, validateNrInventarioQuery, inventoryController.getByCode);
router.put('/code/:code', validateCode, validateInventoryUpdate, validateNrInventarioQuery, inventoryController.updateByCode);

module.exports = router;
