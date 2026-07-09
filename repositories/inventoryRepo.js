// api/repositories/inventoryRepo.js
const { db, nowISO } = require('../db/sqlite');

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function firstName(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  return parts[0] || trimmed;
}

function toCanonicalRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    codigo: row.codigo || null,
    placa: row.placa || null,
    descricao: row.descricao || null,
    localizacaoNome: row.localizacaoNome || null,
    situacaoNome: row.situacaoNome || null,
    estadoConservacaoNome: row.estadoConservacaoNome || null,
    dsObservacao: row.dsObservacao || null,
    codigoLocalizacao: row.codigoLocalizacao || null,
    codigoSituacao: row.codigoSituacao || null,
    codigoEstado: row.codigoEstado || null,
    nrInventario: row.nrInventario || null,
    valorAtual: row.valorAtual !== null && row.valorAtual !== undefined ? Number(row.valorAtual) : null,
    inventariadoPor: row.inventariadoPor || null,
    StatusBem: row.statusBem || null,
    statusBem: row.statusBem || null,
    status: row.statusBem || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function list({ nrInventario, page = 1, limit = 50, q, field, since, tenantId }) {
  const offset = (page - 1) * limit;
  let where = '1=1';
  const params = [];

  if (nrInventario) {
    where += ' AND nrInventario = ?';
    params.push(nrInventario);
  }
  if (since) {
    where += ' AND inventory.updatedAt >= ?';
    params.push(since);
  }
  // Mapear alias 'local' para 'localizacaoNome' por compatibilidade
  const searchField = field === 'local' ? 'localizacaoNome' : field;
  if (q && searchField && ['codigo','placa','descricao','localizacaoNome'].includes(searchField)) {
    where += ` AND ${searchField} LIKE ?`;
    params.push(`${q}%`);
  }

  let rows = [];
  let total = 0;
  if (tenantId) {
    rows = db.prepare(`
      SELECT inventory.* FROM inventory
      JOIN users u ON u.id = inventory.userId
      WHERE ${where} AND u.tenantId = ?
      ORDER BY inventory.updatedAt DESC
      LIMIT ? OFFSET ?
    `).all(...params, tenantId, limit, offset);
    total = db.prepare(`
      SELECT COUNT(*) as c FROM inventory
      JOIN users u ON u.id = inventory.userId
      WHERE ${where} AND u.tenantId = ?
    `).get(...params, tenantId).c;
  } else {
    rows = db.prepare(`
      SELECT * FROM inventory WHERE ${where}
      ORDER BY inventory.updatedAt DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
    total = db.prepare(`SELECT COUNT(*) as c FROM inventory WHERE ${where}`).get(...params).c;
  }
  return {
    items: rows.map(toCanonicalRow),
    total,
    totalPages: Math.ceil(total / limit),
    page,
    limit,
  };
}

function listByInventario(nrInventario, tenantId) {
  if (!nrInventario) return [];
  let rows = [];
  if (tenantId) {
    rows = db.prepare(`
      SELECT inventory.* FROM inventory
      JOIN users u ON u.id = inventory.userId
      WHERE inventory.nrInventario = ? AND u.tenantId = ?
      ORDER BY inventory.updatedAt DESC
    `).all(nrInventario, tenantId);
  } else {
    rows = db.prepare(`
      SELECT * FROM inventory
      WHERE nrInventario = ?
      ORDER BY updatedAt DESC
    `).all(nrInventario);
  }
  return rows.map(toCanonicalRow);
}

function getById(id, nrInventario, tenantId) {
  let sql = 'SELECT inventory.* FROM inventory';
  const params = [];
  if (tenantId) sql += ' JOIN users u ON u.id = inventory.userId';
  sql += ' WHERE inventory.id = ?';
  params.push(id);
  if (nrInventario) {
    sql += ' AND inventory.nrInventario = ?';
    params.push(nrInventario);
  }
  if (tenantId) {
    sql += ' AND u.tenantId = ?';
    params.push(tenantId);
  }
  const row = db.prepare(sql).get(...params);
  return toCanonicalRow(row);
}

function getByCode(code, nrInventario, tenantId) {
  let row = null;
  if (nrInventario) {
    if (tenantId) {
      row = db.prepare('SELECT inventory.* FROM inventory JOIN users u ON u.id = inventory.userId WHERE inventory.nrInventario = ? AND inventory.codigo = ? AND u.tenantId = ?').get(nrInventario, code, tenantId);
      if (!row) {
        row = db.prepare('SELECT inventory.* FROM inventory JOIN users u ON u.id = inventory.userId WHERE inventory.nrInventario = ? AND inventory.placa = ? AND u.tenantId = ?').get(nrInventario, code, tenantId);
      }
    } else {
      row = db.prepare('SELECT * FROM inventory WHERE nrInventario = ? AND codigo = ?').get(nrInventario, code);
      if (!row) {
        row = db.prepare('SELECT * FROM inventory WHERE nrInventario = ? AND placa = ?').get(nrInventario, code);
      }
    }
  } else {
    if (tenantId) {
      row = db.prepare('SELECT inventory.* FROM inventory JOIN users u ON u.id = inventory.userId WHERE inventory.codigo = ? AND u.tenantId = ?').get(code, tenantId);
      if (!row) {
        row = db.prepare('SELECT inventory.* FROM inventory JOIN users u ON u.id = inventory.userId WHERE inventory.placa = ? AND u.tenantId = ?').get(code, tenantId);
      }
    } else {
      row = db.prepare('SELECT * FROM inventory WHERE codigo = ?').get(code);
      if (!row) {
        row = db.prepare('SELECT * FROM inventory WHERE placa = ?').get(code);
      }
    }
  }
  return toCanonicalRow(row);
}

function create(data, userId) {
  const id = genId();
  const ts = nowISO();
  db.prepare(`
    INSERT INTO inventory (
      id, userId, codigo, placa, descricao,
      localizacaoNome, situacaoNome, estadoConservacaoNome, dsObservacao,
      codigoLocalizacao, codigoSituacao, codigoEstado,
      nrInventario, valorAtual, statusBem, inventariadoPor,
      createdAt, updatedAt
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id, userId, data.codigo || null, data.placa || null, data.descricao || null,
    data.localizacaoNome || null, data.situacaoNome || null, data.estadoConservacaoNome || null, data.dsObservacao || null,
    data.codigoLocalizacao || null, data.codigoSituacao || null, data.codigoEstado || null,
    data.nrInventario || null, data.valorAtual ?? null, data.statusBem || null, firstName(data.inventariadoPor) || null,
    ts, ts
  );
  const row = db.prepare('SELECT * FROM inventory WHERE id = ?').get(id);
  return toCanonicalRow(row);
}

function updateById(id, data, tenantId) {
  let selectSql = 'SELECT inventory.* FROM inventory';
  const params = [];
  if (tenantId) selectSql += ' JOIN users u ON u.id = inventory.userId';
  selectSql += ' WHERE inventory.id = ?';
  params.push(id);
  if (tenantId) {
    selectSql += ' AND u.tenantId = ?';
    params.push(tenantId);
  }
  const existing = db.prepare(selectSql).get(...params);
  if (!existing) return null;
  const statusBem = existing.statusBem || '';
  const isInventariado = statusBem && String(statusBem).trim().startsWith('Bem Inventariado');
  if (isInventariado) {
    // Quando já inventariado, permitir atualização de campos de catálogo e observação,
    // além de inventariadoPor. Campos estruturais permanecem bloqueados.
    const incomingInvPorRaw = typeof data.inventariadoPor === 'string' ? data.inventariadoPor.trim() : null;
    const incomingInvPor = firstName(incomingInvPorRaw);

    const ts = nowISO();
    db.prepare(`
      UPDATE inventory SET
        localizacaoNome = COALESCE(?, localizacaoNome),
        situacaoNome = COALESCE(?, situacaoNome),
        estadoConservacaoNome = COALESCE(?, estadoConservacaoNome),
        dsObservacao = COALESCE(?, dsObservacao),
        codigoLocalizacao = COALESCE(?, codigoLocalizacao),
        codigoSituacao = COALESCE(?, codigoSituacao),
        codigoEstado = COALESCE(?, codigoEstado),
        inventariadoPor = COALESCE(?, inventariadoPor),
        updatedAt = ?
      WHERE id = ?
    `).run(
      data.localizacaoNome ?? null,
      data.situacaoNome ?? null,
      data.estadoConservacaoNome ?? null,
      data.dsObservacao ?? null,
      data.codigoLocalizacao ?? null,
      data.codigoSituacao ?? null,
      data.codigoEstado ?? null,
      incomingInvPor ?? null,
      ts,
      id
    );
    const row = db.prepare('SELECT * FROM inventory WHERE id = ?').get(id);
    return { skipped: false, item: toCanonicalRow(row) };
  }

  const ts = nowISO();
  db.prepare(`
    UPDATE inventory SET
      codigo = COALESCE(?, codigo),
      placa = COALESCE(?, placa),
      descricao = COALESCE(?, descricao),
      localizacaoNome = COALESCE(?, localizacaoNome),
      situacaoNome = COALESCE(?, situacaoNome),
      estadoConservacaoNome = COALESCE(?, estadoConservacaoNome),
      dsObservacao = COALESCE(?, dsObservacao),
      codigoLocalizacao = COALESCE(?, codigoLocalizacao),
      codigoSituacao = COALESCE(?, codigoSituacao),
      codigoEstado = COALESCE(?, codigoEstado),
      nrInventario = COALESCE(?, nrInventario),
      valorAtual = COALESCE(?, valorAtual),
      statusBem = COALESCE(?, statusBem),
      inventariadoPor = COALESCE(?, inventariadoPor),
      updatedAt = ?
    WHERE id = ?
  `).run(
    data.codigo ?? null, data.placa ?? null, data.descricao ?? null,
    data.localizacaoNome ?? null, data.situacaoNome ?? null, data.estadoConservacaoNome ?? null, data.dsObservacao ?? null,
    data.codigoLocalizacao ?? null, data.codigoSituacao ?? null, data.codigoEstado ?? null,
    data.nrInventario ?? null, data.valorAtual ?? null, data.statusBem ?? null,
    firstName(data.inventariadoPor) ?? null,
    ts, id
  );
  const row = db.prepare('SELECT * FROM inventory WHERE id = ?').get(id);
  return { skipped: false, item: toCanonicalRow(row) };
}

function deleteById(id, tenantId) {
  let sql = 'DELETE FROM inventory WHERE id = ?';
  const params = [id];
  if (tenantId) {
    sql += ' AND EXISTS (SELECT 1 FROM users u WHERE u.id = inventory.userId AND u.tenantId = ?)';
    params.push(tenantId);
  }
  const res = db.prepare(sql).run(...params);
  return res.changes > 0;
}

function deleteByInventario(nrInventario, tenantId) {
  if (!nrInventario) return 0;
  let sql = 'DELETE FROM inventory WHERE nrInventario = ?';
  const params = [nrInventario];
  if (tenantId) {
    sql += ' AND EXISTS (SELECT 1 FROM users u WHERE u.id = inventory.userId AND u.tenantId = ?)';
    params.push(tenantId);
  }
  const res = db.prepare(sql).run(...params);
  return res.changes || 0;
}

// Exclui todos os itens de inventário pertencentes a um tenant (CNPJ)
function deleteAllByTenant(tenantId) {
  if (!tenantId) return 0;
  const res = db.prepare(
    'DELETE FROM inventory WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = inventory.userId AND u.tenantId = ?)' 
  ).run(tenantId);
  return res.changes || 0;
}

function deleteByUserId(userId) {
  try {
    const res = db.prepare('DELETE FROM inventory WHERE userId = ?').run(userId);
    return res.changes || 0;
  } catch (error) {
    console.error('[InventoryRepo] Erro ao deletar inventários por userId:', error);
    throw error;
  }
}

function updateByCode(code, data, nrInventario, tenantId) {
  const row = getByCode(code, nrInventario, tenantId);
  if (!row) return null;
  return updateById(row.id, data, tenantId);
}

function distinctLocais(nrInventario, tenantId) {
  let sql = `
    SELECT DISTINCT
      COALESCE(codigoLocalizacao, NULL) AS codigo,
      COALESCE(localizacaoNome, localizacaoNome) AS nome
    FROM inventory
    WHERE localizacaoNome IS NOT NULL
  `;
  const params = [];
  if (nrInventario) {
    sql += ' AND nrInventario = ?';
    params.push(nrInventario);
  }
  if (tenantId) {
    sql += ' AND EXISTS (SELECT 1 FROM users u WHERE u.id = inventory.userId AND u.tenantId = ?)';
    params.push(tenantId);
  }
  const rows = db.prepare(sql).all(...params);
  return rows.map(r => ({ codigo: r.codigo || null, nome: r.nome })).filter(r => r && r.nome);
}

function distinctSituacoes(nrInventario, tenantId) {
  let sql = `
    SELECT DISTINCT
      COALESCE(codigoSituacao, NULL) AS codigo,
      COALESCE(situacaoNome, situacaoNome) AS nome
    FROM inventory
    WHERE situacaoNome IS NOT NULL
  `;
  const params = [];
  if (nrInventario) {
    sql += ' AND nrInventario = ?';
    params.push(nrInventario);
  }
  if (tenantId) {
    sql += ' AND EXISTS (SELECT 1 FROM users u WHERE u.id = inventory.userId AND u.tenantId = ?)';
    params.push(tenantId);
  }
  const rows = db.prepare(sql).all(...params);
  return rows.map(r => ({ codigo: r.codigo || null, nome: r.nome }));
}

function distinctEstados(nrInventario, tenantId) {
  let sql = `
    SELECT DISTINCT
      COALESCE(codigoEstado, NULL) AS codigo,
      COALESCE(estadoConservacaoNome, estadoConservacaoNome) AS nome
    FROM inventory
    WHERE estadoConservacaoNome IS NOT NULL
  `;
  const params = [];
  if (nrInventario) {
    sql += ' AND nrInventario = ?';
    params.push(nrInventario);
  }
  if (tenantId) {
    sql += ' AND EXISTS (SELECT 1 FROM users u WHERE u.id = inventory.userId AND u.tenantId = ?)';
    params.push(tenantId);
  }
  const rows = db.prepare(sql).all(...params);
  return rows.map(r => ({ codigo: r.codigo || null, nome: r.nome }));
}

function sync(items = [], userId, tenantId) {
  const results = [];
  const insert = db.prepare(`
    INSERT INTO inventory (
      id, userId, codigo, placa, descricao,
      localizacaoNome, situacaoNome, estadoConservacaoNome, dsObservacao,
      codigoLocalizacao, codigoSituacao, codigoEstado,
      nrInventario, valorAtual, statusBem, inventariadoPor,
      createdAt, updatedAt
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const update = db.prepare(`
    UPDATE inventory SET
      codigo = ?, placa = ?, descricao = ?,
      localizacaoNome = ?, situacaoNome = ?, estadoConservacaoNome = ?, dsObservacao = ?,
      codigoLocalizacao = ?, codigoSituacao = ?, codigoEstado = ?,
      nrInventario = ?, valorAtual = ?, statusBem = ?, inventariadoPor = ?,
      updatedAt = ?
    WHERE id = ?
  `);
  // Seleções escopadas por tenantId (CNPJ) para evitar colisões entre clientes
  const selectByIdTenant = db.prepare('SELECT inventory.* FROM inventory JOIN users u ON u.id = inventory.userId WHERE inventory.id = ? AND u.tenantId = ?');
  const selectByCodigoWithInvTenant = db.prepare('SELECT inventory.* FROM inventory JOIN users u ON u.id = inventory.userId WHERE inventory.nrInventario = ? AND inventory.codigo = ? AND u.tenantId = ?');
  const selectByCodigoGlobalTenant = db.prepare('SELECT inventory.* FROM inventory JOIN users u ON u.id = inventory.userId WHERE inventory.codigo = ? AND u.tenantId = ?');
  const selectByPlacaWithInvTenant = db.prepare('SELECT inventory.* FROM inventory JOIN users u ON u.id = inventory.userId WHERE inventory.nrInventario = ? AND inventory.placa = ? AND u.tenantId = ?');
  const selectByPlacaGlobalTenant = db.prepare('SELECT inventory.* FROM inventory JOIN users u ON u.id = inventory.userId WHERE inventory.placa = ? AND u.tenantId = ?');

  items.forEach(item => {
    const ts = nowISO();
    let existing = null;
    const sanitizeNull = (v) => {
      if (v === undefined || v === null) return null;
      const s = String(v).trim();
      return s === '' ? null : s;
    };
    const sanitizeUndef = (v) => {
      if (v === undefined || v === null) return undefined;
      const s = String(v).trim();
      return s === '' ? undefined : s;
    };
    if (tenantId) {
      if (item.id) existing = selectByIdTenant.get(item.id, tenantId);
      if (!existing && item.codigo) {
        existing = item.nrInventario ? selectByCodigoWithInvTenant.get(item.nrInventario, item.codigo, tenantId) : selectByCodigoGlobalTenant.get(item.codigo, tenantId);
      }
      if (!existing && item.placa) {
        existing = item.nrInventario ? selectByPlacaWithInvTenant.get(item.nrInventario, item.placa, tenantId) : selectByPlacaGlobalTenant.get(item.placa, tenantId);
      }
    } else {
      // Fallback sem tenantId (não recomendado): escopo global
      const selectById = db.prepare('SELECT * FROM inventory WHERE id = ?');
      const selectByCodigoWithInv = db.prepare('SELECT * FROM inventory WHERE nrInventario = ? AND codigo = ?');
      const selectByCodigoGlobal = db.prepare('SELECT * FROM inventory WHERE codigo = ?');
      const selectByPlacaWithInv = db.prepare('SELECT * FROM inventory WHERE nrInventario = ? AND placa = ?');
      const selectByPlacaGlobal = db.prepare('SELECT * FROM inventory WHERE placa = ?');
      if (item.id) existing = selectById.get(item.id);
      if (!existing && item.codigo) {
        existing = item.nrInventario ? selectByCodigoWithInv.get(item.nrInventario, item.codigo) : selectByCodigoGlobal.get(item.codigo);
      }
      if (!existing && item.placa) {
        existing = item.nrInventario ? selectByPlacaWithInv.get(item.nrInventario, item.placa) : selectByPlacaGlobal.get(item.placa);
      }
    }

    if (existing) {
      const statusBem = existing.statusBem || '';
      if (statusBem && String(statusBem).trim().startsWith('Bem Inventariado')) {
        const vLocNome = item.localizacaoNome && String(item.localizacaoNome).trim() !== '' ? String(item.localizacaoNome) : null;
        const vSitNome = item.situacaoNome && String(item.situacaoNome).trim() !== '' ? String(item.situacaoNome) : null;
        const vEstNome = item.estadoConservacaoNome && String(item.estadoConservacaoNome).trim() !== '' ? String(item.estadoConservacaoNome) : null;
        const vObs = item.dsObservacao && String(item.dsObservacao).trim() !== '' ? String(item.dsObservacao) : null;
        const vCdLoc = sanitizeNull(item.codigoLocalizacao);
        const vCdSit = sanitizeNull(item.codigoSituacao);
        const vCdEst = sanitizeNull(item.codigoEstado);
        const vInvPor = item.inventariadoPor ? firstName(String(item.inventariadoPor)) : null;
        db.prepare(`
          UPDATE inventory SET
            localizacaoNome = COALESCE(?, localizacaoNome),
            situacaoNome = COALESCE(?, situacaoNome),
            estadoConservacaoNome = COALESCE(?, estadoConservacaoNome),
            dsObservacao = COALESCE(?, dsObservacao),
            codigoLocalizacao = COALESCE(?, codigoLocalizacao),
            codigoSituacao = COALESCE(?, codigoSituacao),
            codigoEstado = COALESCE(?, codigoEstado),
            inventariadoPor = COALESCE(?, inventariadoPor),
            updatedAt = ?
          WHERE id = ?
        `).run(
          vLocNome, vSitNome, vEstNome, vObs,
          vCdLoc, vCdSit, vCdEst,
          vInvPor,
          ts,
          existing.id
        );
        results.push({ id: existing.id, action: 'updated-inventariado' });
      } else {
        // Sanitizar strings vazias para não apagar nomes/códigos existentes
        const up_codigo = sanitizeUndef(item.codigo) ?? existing.codigo;
        const up_placa = sanitizeUndef(item.placa) ?? existing.placa;
        const up_desc = sanitizeUndef(item.descricao) ?? existing.descricao;
        const up_locNome = sanitizeUndef(item.localizacaoNome) ?? existing.localizacaoNome;
        const up_sitNome = sanitizeUndef(item.situacaoNome) ?? existing.situacaoNome;
        const up_estNome = sanitizeUndef(item.estadoConservacaoNome) ?? existing.estadoConservacaoNome;
        const up_obs = sanitizeUndef(item.dsObservacao) ?? existing.dsObservacao;
        const up_cdLoc = sanitizeUndef(item.codigoLocalizacao) ?? existing.codigoLocalizacao;
        const up_cdSit = sanitizeUndef(item.codigoSituacao) ?? existing.codigoSituacao;
        const up_cdEst = sanitizeUndef(item.codigoEstado) ?? existing.codigoEstado;
        const up_nrInv = sanitizeUndef(item.nrInventario) ?? existing.nrInventario;
        const up_valor = (item.valorAtual !== undefined && item.valorAtual !== null) ? item.valorAtual : existing.valorAtual;
        const up_status = sanitizeUndef(item.statusBem) ?? existing.statusBem;
        const up_invPor = firstName(item.inventariadoPor) ?? existing.inventariadoPor;

        update.run(
          up_codigo,
          up_placa,
          up_desc,
          up_locNome,
          up_sitNome,
          up_estNome,
          up_obs,
          up_cdLoc,
          up_cdSit,
          up_cdEst,
          up_nrInv,
          up_valor,
          up_status,
          up_invPor,
          ts,
          existing.id
        );
        results.push({ id: existing.id, action: 'updated' });
      }
    } else {
      const id = item.id || genId();
      // Inserção com saneamento para evitar strings vazias
      insert.run(
        id, userId,
        sanitizeNull(item.codigo),
        sanitizeNull(item.placa),
        sanitizeNull(item.descricao),
        sanitizeNull(item.localizacaoNome),
        sanitizeNull(item.situacaoNome),
        sanitizeNull(item.estadoConservacaoNome),
        sanitizeNull(item.dsObservacao),
        sanitizeNull(item.codigoLocalizacao),
        sanitizeNull(item.codigoSituacao),
        sanitizeNull(item.codigoEstado),
        sanitizeNull(item.nrInventario),
        item.valorAtual ?? null,
        sanitizeNull(item.statusBem),
        sanitizeNull(item.inventariadoPor),
        ts, ts
      );
      results.push({ id, action: 'created' });
    }
  });

  return results;
}

module.exports = {
  list,
  getById,
  getByCode,
  create,
  updateById,
  updateByCode,
  deleteById,
  deleteByInventario,
  deleteByUserId,
  deleteAllByTenant,
  distinctLocais,
  distinctSituacoes,
  distinctEstados,
  sync,
  listByInventario,
};
