// api/config/firebase.js
require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Inicializar Firebase Admin SDK usando somente o caminho definido no api/.env
// Variável obrigatória:
// - FIREBASE_CREDENTIALS_PATH: caminho absoluto/relativo para o arquivo JSON
let serviceAccount = null;
let usingServiceAccount = false;

function normalizePrivateKey(key) {
  if (!key || typeof key !== 'string') return key;
  // Corrigir chaves com \n vindas de env
  return key.includes('\\n') ? key.replace(/\\n/g, '\n') : key;
}

function isValidServiceAccount(json) {
  if (!json || typeof json !== 'object') return false;
  const required = ['type', 'project_id', 'client_email', 'private_key'];
  const ok = required.every(k => json[k] && String(json[k]).trim() !== '');
  if (!ok) return false;
  if (json.type !== 'service_account') return false;
  const pk = normalizePrivateKey(json.private_key);
  return pk && pk.includes('BEGIN PRIVATE KEY');
}

function tryUseServiceAccount(raw, sourceLabel) {
  if (raw && raw.private_key) raw.private_key = normalizePrivateKey(raw.private_key);
  if (!isValidServiceAccount(raw)) return false;
  serviceAccount = raw;
  usingServiceAccount = true;
  console.log('Firebase: credenciais carregadas de', sourceLabel);
  return true;
}

function tryLoadServiceAccountFile(filePath) {
  try {
    if (!filePath || !fs.existsSync(filePath)) return false;
    const json = fs.readFileSync(filePath, 'utf8');
    const raw = JSON.parse(json);
    return tryUseServiceAccount(raw, filePath);
  } catch (e) {
    console.error('Erro ao ler credenciais do Firebase em', filePath, '-', e.message);
    return false;
  }
}

// 1º - Tenta usar o JSON armazenado na variável de ambiente
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

if (serviceAccountJson) {
  try {
    const raw = JSON.parse(serviceAccountJson);
    tryUseServiceAccount(raw, 'FIREBASE_SERVICE_ACCOUNT_JSON');
  } catch (e) {
    console.error('Firebase: JSON inválido em FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
  }
}

// 2º - Caso não exista, tenta carregar pelo caminho do arquivo (uso local)
if (!serviceAccount) {
  const credPath = String(process.env.FIREBASE_CREDENTIALS_PATH || '').trim();

  if (credPath) {
    const resolved = path.isAbsolute(credPath)
      ? credPath
      : path.resolve(process.cwd(), credPath);

    if (!fs.existsSync(resolved)) {
      console.error('Firebase: arquivo de credenciais não encontrado em', resolved);
    } else {
      tryLoadServiceAccountFile(resolved);
    }
  }
}

let firestoreAvailable = false;

if (!admin.apps.length) {
  try {
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: normalizePrivateKey(serviceAccount.private_key)
        }),
        projectId: serviceAccount.project_id,
        databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://coletoroficial-default-rtdb.firebaseio.com'
      });
      console.log('Firebase Admin SDK inicializado com credenciais do service account');
      console.log('Firebase: projeto', serviceAccount.project_id);
    } else {
      console.error('Firebase Admin SDK não inicializado: configure um service account válido em FIREBASE_CREDENTIALS_PATH no api/.env');
    }
  } catch (error) {
    console.error('Erro ao inicializar Firebase Admin SDK:', error.message);
  }
}

const auth = serviceAccount ? admin.auth() : null;
let firestore = null;

// Tentar inicializar Firestore com tratamento de erro
if (serviceAccount) {
  try {
    firestore = admin.firestore();
    
    // Configurar explicitamente as configurações do Firestore
    firestore.settings({
      ignoreUndefinedProperties: true,
      timestampsInSnapshots: true
    });
    console.log('Configurações do Firestore aplicadas com sucesso');
  } catch (error) {
    console.warn('Firestore não pôde ser inicializado:', error.message);
    firestore = null;
  }
} else {
  console.warn('Firestore não inicializado: credenciais do Firebase Admin ausentes ou inválidas no api/.env');
}

// Testar/atualizar conexão com Firestore (rechecagem periódica)
async function refreshFirestoreAvailability() {
  if (!firestore) {
    // Tenta obter instância novamente, caso tenha falhado anteriormente
    try {
      firestore = admin.firestore();
    } catch (e) {
      console.warn('Tentativa de reobter instância do Firestore falhou:', e.message);
      firestoreAvailable = false;
      return false;
    }
  }

  try {
    const testRef = firestore.collection('_test');
    await testRef.limit(1).get();
    if (!firestoreAvailable) {
      console.log('Conexão com Firestore restaurada com sucesso');
    }
    firestoreAvailable = true;
    return true;
  } catch (error) {
    const msg = String(error && error.message || error);
    if (firestoreAvailable) {
      console.warn('Firestore perdeu disponibilidade:', msg);
    } else {
      console.warn('Firestore não está disponível:', msg);
    }
    if (msg && msg.toUpperCase().includes('UNAUTHENTICATED')) {
      console.warn('Dica: verifique se as credenciais do service account são válidas (project_id, client_email, private_key) e possuem acesso ao Firestore. Evite usar applicationDefault com credenciais de usuário locais.');
    }
    firestoreAvailable = false;
    return false;
  }
}

// Executar teste de conexão na inicialização e revalidar periodicamente
if (usingServiceAccount) {
  refreshFirestoreAvailability();
  setInterval(refreshFirestoreAvailability, 60000); // rechecagem a cada 60s
} else {
  console.warn('Firestore: pulando verificações periódicas por não haver service account válido em FIREBASE_CREDENTIALS_PATH.');
}

// Função helper para verificar se Firestore está disponível
function isFirestoreAvailable() {
  return firestoreAvailable && firestore !== null;
}

module.exports = {
  admin,
  auth,
  firestore,
  isFirestoreAvailable,
  refreshFirestoreAvailability,
  usingServiceAccount
};
