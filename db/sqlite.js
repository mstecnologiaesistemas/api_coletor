// api/db/sqlite.js
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config/config');

let db = null;
let dbAvailable = false;

function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function init() {
  try {
    const dbPath = config.database.path;
    ensureDirExists(dbPath);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Criar tabelas se não existirem (com FK que não apaga inventários)
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT,
        tenantId TEXT,
        createdAt TEXT,
        updatedAt TEXT
      );

      CREATE TABLE IF NOT EXISTS inventory (
        id TEXT PRIMARY KEY,
        userId TEXT,
        codigo TEXT,
        placa TEXT,
        descricao TEXT,
        localizacaoNome TEXT,
        situacaoNome TEXT,
        estadoConservacaoNome TEXT,
        dsObservacao TEXT,
        codigoLocalizacao TEXT,
        codigoSituacao TEXT,
        codigoEstado TEXT,
        nrInventario TEXT,
        valorAtual REAL,
        statusBem TEXT,
        inventariadoPor TEXT,
        createdAt TEXT,
        updatedAt TEXT,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_inventory_userId ON inventory (userId);
      CREATE INDEX IF NOT EXISTS idx_inventory_updatedAt ON inventory (updatedAt);
      CREATE INDEX IF NOT EXISTS idx_inventory_nrInventario ON inventory (nrInventario);
      CREATE INDEX IF NOT EXISTS idx_inventory_codigo ON inventory (codigo);
      CREATE INDEX IF NOT EXISTS idx_inventory_placa ON inventory (placa);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenantId TEXT,
        email TEXT,
        action TEXT,
        count INTEGER,
        origin TEXT,
        details TEXT,
        createdAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs (tenantId);
      CREATE INDEX IF NOT EXISTS idx_audit_createdAt ON audit_logs (createdAt);
    `);

    dbAvailable = true;
    try {
      const userCols = db.prepare("PRAGMA table_info('users')").all();
      const hasTenantId = Array.isArray(userCols) && userCols.some(c => c.name === 'tenantId');
      if (!hasTenantId) {
        db.prepare('ALTER TABLE users ADD COLUMN tenantId TEXT').run();
      }
      db.exec("CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenantId);");
    } catch (migUsersErr) {
      console.warn('SQLite users migration warning:', migUsersErr?.message || migUsersErr);
    }
    // Migrações: garantir que o FK de inventory não apague itens ao excluir usuário
    try {
      const cols = db.prepare("PRAGMA table_info('inventory')").all();
      const fkList = db.prepare("PRAGMA foreign_key_list('inventory')").all();
      const userIdCol = Array.isArray(cols) ? cols.find(c => c.name === 'userId') : null;
      const fkToUsers = Array.isArray(fkList) ? fkList.find(fk => fk.table === 'users' && fk.from === 'userId') : null;

      const needsNullableUserId = !!userIdCol && userIdCol.notnull === 1;
      const needsOnDeleteSetNull = !fkToUsers || (fkToUsers.on_delete && fkToUsers.on_delete.toUpperCase() !== 'SET NULL');

      if (needsNullableUserId || needsOnDeleteSetNull) {
        // Realizar migração recriando a tabela inventory
        db.transaction(() => {
          db.exec(`
            CREATE TABLE IF NOT EXISTS inventory_tmp (
              id TEXT PRIMARY KEY,
              userId TEXT,
              codigo TEXT,
              placa TEXT,
              descricao TEXT,
              localizacaoNome TEXT,
              situacaoNome TEXT,
              estadoConservacaoNome TEXT,
              dsObservacao TEXT,
              codigoLocalizacao TEXT,
              codigoSituacao TEXT,
              codigoEstado TEXT,
              nrInventario TEXT,
              valorAtual REAL,
              statusBem TEXT,
              inventariadoPor TEXT,
              createdAt TEXT,
              updatedAt TEXT,
              FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
            );
          `);

          // Copiar dados
          const insertTmp = db.prepare(`
            INSERT INTO inventory_tmp (
              id, userId, codigo, placa, descricao,
              localizacaoNome, situacaoNome, estadoConservacaoNome, dsObservacao,
              codigoLocalizacao, codigoSituacao, codigoEstado,
              nrInventario, valorAtual, statusBem, inventariadoPor,
              createdAt, updatedAt
            )
            SELECT 
              id, userId, codigo, placa, descricao,
              localizacaoNome, situacaoNome, estadoConservacaoNome, dsObservacao,
              codigoLocalizacao, codigoSituacao, codigoEstado,
              nrInventario, valorAtual, statusBem, inventariadoPor,
              createdAt, updatedAt
            FROM inventory;
          `);
          insertTmp.run();

          // Dropar tabela antiga e renomear
          db.exec(`DROP TABLE inventory;`);
          db.exec(`ALTER TABLE inventory_tmp RENAME TO inventory;`);

          // Recriar índices
          db.exec(`
            CREATE INDEX IF NOT EXISTS idx_inventory_userId ON inventory (userId);
            CREATE INDEX IF NOT EXISTS idx_inventory_updatedAt ON inventory (updatedAt);
            CREATE INDEX IF NOT EXISTS idx_inventory_nrInventario ON inventory (nrInventario);
            CREATE INDEX IF NOT EXISTS idx_inventory_codigo ON inventory (codigo);
            CREATE INDEX IF NOT EXISTS idx_inventory_placa ON inventory (placa);
          `);
        })();
      }

      // Migration adicional: garantir coluna inventariadoPor (caso bases antigas faltem)
      const hasInventariadoPor = Array.isArray(cols) && cols.some(c => c.name === 'inventariadoPor');
      if (!hasInventariadoPor) {
        db.prepare('ALTER TABLE inventory ADD COLUMN inventariadoPor TEXT').run();
      }
    } catch (migErr) {
      console.warn('SQLite migration warning:', migErr?.message || migErr);
    }
  } catch (e) {
    console.error('Erro ao inicializar SQLite:', e?.message || e);
    dbAvailable = false;
  }
}

function isDbAvailable() {
  return !!db && dbAvailable;
}

function nowISO() {
  return new Date().toISOString();
}

init();

module.exports = {
  db,
  isDbAvailable,
  nowISO,
  addAuditLog: (payload = {}) => {
    try {
      if (!dbAvailable) return false;
      const stmt = db.prepare(`
        INSERT INTO audit_logs (tenantId, email, action, count, origin, details, createdAt)
        VALUES (@tenantId, @email, @action, @count, @origin, @details, @createdAt);
      `);
      const createdAt = payload.createdAt || nowISO();
      const detailsStr = typeof payload.details === 'string' ? payload.details : JSON.stringify(payload.details || {});
      stmt.run({
        tenantId: payload.tenantId || null,
        email: payload.email || null,
        action: payload.action || null,
        count: Number.isFinite(payload.count) ? payload.count : null,
        origin: payload.origin || 'api',
        details: detailsStr,
        createdAt,
      });
      return true;
    } catch (e) {
      console.warn('Falha ao registrar audit log (API):', e?.message || e);
      return false;
    }
  },
};
