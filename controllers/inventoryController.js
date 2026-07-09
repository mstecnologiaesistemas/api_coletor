// api/controllers/inventoryController.js
const inventoryRepo = require('../repositories/inventoryRepo');
const { addAuditLog, nowISO } = require('../db/sqlite');

// ----------------------- Helpers de normalização -----------------------
// Remover chaves com undefined (Firestore não aceita valores undefined)
function pruneUndefined(obj) {
  const out = {};
  Object.keys(obj || {}).forEach(k => {
    if (obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

// Normaliza um valor possivelmente string para número (valorAtual)
function normalizeValorAtual(v) {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s === '') return undefined;
    const normalized = s.replace(/\./g, '').replace(/,/g, '.');
    const num = Number(normalized);
    return Number.isNaN(num) ? undefined : num;
  }
  return undefined;
}

// Converte o corpo da requisição em campos canônicos aceitando aliases
function normalizeInput(body = {}) {
  const codigoLocalizacao = body.codigoLocalizacao ?? body.cdLocalizacao;
  const codigoSituacao = body.codigoSituacao ?? body.cdSituacao;
  const codigoEstado = body.codigoEstado ?? body.cdEstadoConser;
  const localizacaoNome = body.localizacaoNome ?? body.local ?? body.localizacao;
  const situacaoNome = body.situacaoNome ?? body.situacao;
  const estadoConservacaoNome = body.estadoConservacaoNome ?? body.estado;
  const dsObservacao = body.dsObservacao ?? body.observacoes;
  const valorAtual = normalizeValorAtual(body.valorAtual);
  const statusBem = body.StatusBem ?? body.statusBem ?? body.status;
  const inventariadoPor = body.inventariadoPor;

  return pruneUndefined({
    codigo: body.codigo,
    placa: body.placa,
    descricao: body.descricao,
    // nomes canônicos
    localizacaoNome,
    situacaoNome,
    estadoConservacaoNome,
    dsObservacao,
    inventariadoPor,
    // códigos canônicos
    codigoLocalizacao,
    codigoSituacao,
    codigoEstado,
    // outros
    nrInventario: body.nrInventario,
    valorAtual,
    statusBem,
    createdAt: body.createdAt,
    updatedAt: body.updatedAt,
  });
}

// Mapeia dados do Firestore para saída canônica, incluindo aliases por compatibilidade
function toCanonicalOutput(data = {}) {
  const codigoLocalizacao = data.codigoLocalizacao ?? data.cdLocalizacao ?? null;
  const codigoSituacao = data.codigoSituacao ?? data.cdSituacao ?? null;
  const codigoEstado = data.codigoEstado ?? data.cdEstadoConser ?? null;
  const localizacaoNome = data.localizacaoNome ?? data.local ?? data.localizacao ?? null;
  const situacaoNome = data.situacaoNome ?? data.situacao ?? null;
  const estadoConservacaoNome = data.estadoConservacaoNome ?? data.estado ?? null;
  const dsObservacao = data.dsObservacao ?? data.observacoes ?? null;
  const valorAtual = data.valorAtual ?? null;
  const statusBem = data.statusBem ?? data.StatusBem ?? data.status ?? null;
  const inventariadoPor = data.inventariadoPor ?? null;

  const canonical = {
    codigo: data.codigo ?? null,
    placa: data.placa ?? null,
    descricao: data.descricao ?? null,
    // nomes canônicos
    localizacaoNome,
    situacaoNome,
    estadoConservacaoNome,
    dsObservacao,
    inventariadoPor,
    // códigos canônicos
    codigoLocalizacao,
    codigoSituacao,
    codigoEstado,
    // demais campos
    nrInventario: data.nrInventario ?? null,
    valorAtual,
    StatusBem: statusBem, // manter chave solicitada
    statusBem,            // alias
    status: statusBem,    // alias
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
  };

  // Adicionar aliases esperados por clientes antigos
  return {
    ...canonical,
    local: localizacaoNome,
    situacao: situacaoNome,
    estado: estadoConservacaoNome,
    observacoes: dsObservacao,
    cdLocalizacao: codigoLocalizacao,
    cdSituacao: codigoSituacao,
    cdEstadoConser: codigoEstado,
  };
}

class InventoryController {
  // Listar todos os itens do inventário
  async getAll(req, res) {
    try {
      const { page = 1, limit = 50, q, field, since, nrInventario } = req.query;
      const tenantId = req.user?.tenantId || null;
      const result = inventoryRepo.list({
        nrInventario: nrInventario || null,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        q: q || null,
        field: field || null,
        since: since || null,
        tenantId,
      });
      res.json({
        success: true,
        data: {
          items: result.items,
          pagination: {
            page: result.page,
            limit: result.limit,
            total: result.total,
            totalPages: result.totalPages,
          }
        }
      });
    } catch (error) {
      console.error('Erro ao listar inventário:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: 'Erro ao listar itens do inventário'
      });
    }
  }

  // Obter item específico por ID
  async getById(req, res) {
    try {
      const { id } = req.params;
      const { nrInventario } = req.query;
      const tenantId = req.user?.tenantId || null;
      const item = inventoryRepo.getById(id, nrInventario || null, tenantId);
      if (!item) {
        return res.status(404).json({
          error: 'Item não encontrado',
          message: 'Item do inventário não existe'
        });
      }
      res.json({ success: true, data: item });
    } catch (error) {
      console.error('Erro ao obter item:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: 'Erro ao obter item do inventário'
      });
    }
  }

  // Buscar item por código ou placa
  async getByCode(req, res) {
    try {
      const { code } = req.params;
      const { nrInventario } = req.query;
      const tenantId = req.user?.tenantId || null;
      const item = inventoryRepo.getByCode(code, nrInventario || null, tenantId);
      if (!item) {
        return res.status(404).json({
          error: 'Item não encontrado',
          message: 'Item com este código/placa não existe'
        });
      }
      res.json({ success: true, data: item });
    } catch (error) {
      console.error('Erro ao buscar por código:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: 'Erro ao buscar item por código'
      });
    }
  }

  // Criar novo item
  async create(req, res) {
    try {
      const userId = req.user?.id || req.user?.uid;
      const normalized = normalizeInput(req.body);
      const created = inventoryRepo.create(normalized, userId);
      res.status(201).json({ success: true, message: 'Item criado com sucesso', data: created });
    } catch (error) {
      console.error('Erro ao criar item:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: 'Erro ao criar item do inventário'
      });
    }
  }

  // Atualizar item existente
  async update(req, res) {
    try {
      const { id } = req.params;
      const normalized = normalizeInput(req.body);
      const tenantId = req.user?.tenantId || null;
      const result = inventoryRepo.updateById(id, normalized, tenantId);
      if (!result) {
        return res.status(404).json({
          error: 'Item não encontrado',
          message: 'Item do inventário não existe'
        });
      }
      if (result.skipped) {
        return res.json({
          success: true,
          message: 'Item com status inventariado - atualização ignorada',
          data: result.item,
          skipped: true
        });
      }
      res.json({ success: true, message: 'Item atualizado com sucesso', data: result.item });
    } catch (error) {
      console.error('Erro ao atualizar item:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: 'Erro ao atualizar item do inventário'
      });
    }
  }

  // Atualizar item por código/placa
  async updateByCode(req, res) {
    try {
      const { code } = req.params;
      const { nrInventario } = req.query;
      const normalized = normalizeInput(req.body);
      const tenantId = req.user?.tenantId || null;
      const result = inventoryRepo.updateByCode(code, normalized, nrInventario || null, tenantId);
      if (!result) {
        return res.status(404).json({
          error: 'Item não encontrado',
          message: 'Item com este código/placa não existe'
        });
      }
      if (result.skipped) {
        return res.json({
          success: true,
          message: 'Item com status inventariado - atualização ignorada',
          data: result.item,
          skipped: true
        });
      }
      res.json({ success: true, message: 'Item atualizado com sucesso', data: result.item });
    } catch (error) {
      console.error('Erro ao atualizar por código:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: 'Erro ao atualizar item por código'
      });
    }
  }

  // Deletar item
  async delete(req, res) {
    try {
      const { id } = req.params;
      const tenantId = req.user?.tenantId || null;
      const ok = inventoryRepo.deleteById(id, tenantId);
      if (!ok) {
        return res.status(404).json({
          error: 'Item não encontrado',
          message: 'Item do inventário não existe'
        });
      }
      res.json({ success: true, message: 'Item deletado com sucesso' });
    } catch (error) {
      console.error('Erro ao deletar item:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: 'Erro ao deletar item do inventário'
      });
    }
  }

  // Deletar todos os itens de um inventário (por nrInventario)
  async deleteByInventario(req, res) {
    try {
      const { nrInventario } = req.query;
      if (!nrInventario || String(nrInventario).trim() === '') {
        return res.status(400).json({
          error: 'nrInventario ausente',
          message: 'É necessário informar nrInventario na query para exclusão em lote'
        });
      }
      const tenantId = req.user?.tenantId || null;
      const removed = inventoryRepo.deleteByInventario(String(nrInventario).trim(), tenantId);
      res.json({ success: true, message: 'Itens do inventário deletados', removed });
    } catch (error) {
      console.error('Erro ao deletar por nrInventario:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: 'Erro ao deletar itens do inventário por nrInventario'
      });
    }
  }

  // Deletar todos os itens pertencentes ao tenant atual (CNPJ)
  async deleteAllForTenant(req, res) {
    try {
      const tenantId = req.user?.tenantId || null;
      if (!tenantId) {
        return res.status(400).json({
          error: 'Tenant ausente',
          message: 'Token sem tenantId; não é possível excluir por CNPJ'
        });
      }
      const removed = inventoryRepo.deleteAllByTenant(String(tenantId));
      try {
        addAuditLog({
          tenantId: String(tenantId),
          email: req.user?.email || null,
          action: 'PURGE_TENANT_DATA',
          count: Number.isFinite(removed) ? removed : null,
          origin: 'api',
          details: { path: req?.originalUrl || '/api/inventory/purgeTenant', ip: req?.ip },
          createdAt: nowISO(),
        });
      } catch {}
      res.json({ success: true, message: 'Itens do tenant deletados', removed });
    } catch (error) {
      console.error('Erro ao deletar por tenant:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: 'Erro ao deletar itens do inventário por tenant'
      });
    }
  }

  // Sincronizar múltiplos itens
  async sync(req, res) {
    try {
      const { items } = req.body;
      const userId = req.user?.id || req.user?.uid;
      const tenantId = req.user?.tenantId || null;
      if (!Array.isArray(items)) {
        return res.status(400).json({
          error: 'Dados inválidos',
          message: 'Items deve ser um array'
        });
      }
      const normalized = items.map(normalizeInput);
      const results = inventoryRepo.sync(normalized, userId, tenantId);
      res.json({
        success: true,
        message: 'Sincronização realizada com sucesso',
        data: { results, total: results.length }
      });
    } catch (error) {
      console.error('Erro na sincronização:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: 'Erro ao sincronizar itens'
      });
    }
  }

  async exportResultado(req, res) {
    try {
      const { nrInventario } = req.query;
      if (!nrInventario || String(nrInventario).trim() === '') {
        return res.status(400).json({ error: 'nrInventario ausente', message: 'Informe nrInventario na query' });
      }
      const tenantId = req.user?.tenantId || null;
      const rows = inventoryRepo.listByInventario(String(nrInventario).trim(), tenantId);
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(404).json({ error: 'Sem dados', message: 'Nenhum item para este inventário' });
      }
      const s = (v) => (v == null ? '' : String(v));
      const padLeftZerosAny = (val, len) => {
        const t = s(val).slice(-len);
        return t.padStart(len, '0');
      };
      const padLeftZeros = (val, len) => {
        const t = s(val).replace(/\D+/g, '').slice(-len);
        return (''.padStart(len, '0') + t).slice(-len);
      };
      const lines = rows.map(r => {
        const placa = padLeftZerosAny(r?.placa, 12);
        const codLoc = padLeftZeros(r?.localAntigo ?? r?.codigoLocalizacao, 4);
        const codEst = padLeftZeros(r?.codigoEstado, 2);
        const codSit = padLeftZeros(r?.codigoSituacao, 2);
        const codLoc2 = padLeftZeros(r?.codigoLocalizacao, 4);
        return placa + codLoc + codEst + codSit + codLoc2;
      });
      const content = lines.join('\n') + '\n';
      res.set('Content-Type', 'text/plain; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="Resultado_${String(nrInventario).trim()}.txt"`);
      return res.send(content);
    } catch (error) {
      console.error('Erro ao exportar Resultado.txt:', error);
      return res.status(500).json({ error: 'Erro interno do servidor', message: 'Falha ao gerar Resultado.txt' });
    }
  }
}

module.exports = new InventoryController();
