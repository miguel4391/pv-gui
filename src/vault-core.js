const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const argon2 = require('argon2');

const VERSION = 1;
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 64 * 1024,
  timeCost: 3,
  parallelism: 2,
  hashLength: KEY_BYTES
};

function getVaultFile() {
  return path.resolve(process.env.VAULT_FILE || path.join(process.cwd(), 'vault.enc'));
}

function getBackupFile() { return `${getVaultFile()}.bak`; }
function now() { return new Date().toISOString(); }
function tags(v) { return String(v ?? '').split(',').map(x => x.trim()).filter(Boolean); }
function emptyVault() { return { schemaVersion: 1, createdAt: now(), updatedAt: now(), entries: [] }; }

async function deriveKey(password, saltB64) {
  return argon2.hash(password, { ...ARGON2_OPTIONS, salt: Buffer.from(saltB64, 'base64'), raw: true });
}

function encrypt(text, key) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const data = Buffer.concat([cipher.update(Buffer.from(text, 'utf8')), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
}

function decrypt(payload, key) {
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()]).toString('utf8');
}

function writeContainer(container) {
  const vaultFile = getVaultFile();
  const backupFile = getBackupFile();
  const dir = path.dirname(vaultFile);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${vaultFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(container, null, 2), { encoding: 'utf8', mode: 0o600 });
  if (fs.existsSync(vaultFile)) fs.copyFileSync(vaultFile, backupFile);
  fs.renameSync(tmp, vaultFile);
  try {
    fs.chmodSync(vaultFile, 0o600);
    if (fs.existsSync(backupFile)) fs.chmodSync(backupFile, 0o600);
  } catch (_) {}
}

function readContainer() {
  const vaultFile = getVaultFile();
  if (!fs.existsSync(vaultFile)) return null;
  const c = JSON.parse(fs.readFileSync(vaultFile, 'utf8'));
  if (c.format !== 'node-password-vault' || c.version !== VERSION || c.kdf?.algorithm !== 'argon2id' || c.cipher?.algorithm !== ALGORITHM) {
    throw new Error('Formato do cofre desconhecido ou incompatível.');
  }
  return c;
}

async function createVault(password) {
  const salt = crypto.randomBytes(16).toString('base64');
  const key = await deriveKey(password, salt);
  const container = {
    format: 'node-password-vault', version: VERSION,
    kdf: { algorithm: 'argon2id', memoryCost: ARGON2_OPTIONS.memoryCost, timeCost: ARGON2_OPTIONS.timeCost, parallelism: ARGON2_OPTIONS.parallelism, hashLength: KEY_BYTES, salt },
    cipher: { algorithm: ALGORITHM, ivBytes: IV_BYTES },
    encrypted: encrypt(JSON.stringify(emptyVault()), key)
  };
  writeContainer(container);
}

async function unlock(password) {
  const container = readContainer();
  if (!container) { await createVault(password); return unlock(password); }
  try {
    const key = await deriveKey(password, container.kdf.salt);
    const vault = JSON.parse(decrypt(container.encrypted, key));
    return { vault, key, container };
  } catch (_) {
    throw new Error('Master password incorreta ou cofre corrompido.');
  }
}

async function save(session) {
  session.vault.updatedAt = now();
  session.container.encrypted = encrypt(JSON.stringify(session.vault), session.key);
  writeContainer(session.container);
}

function getEntry(session, id) { return session.vault.entries.find(e => e.id === id); }
function listEntries(session) { return session.vault.entries.map(e => ({ ...e, hasPassword: Boolean(e.password), password: undefined })); }
function findEntries(session, q) {
  q = q.trim().toLowerCase();
  if (!q) return listEntries(session);
  return listEntries(session).filter(e => [e.title, e.username, e.command, e.url, e.notes, ...(e.tags || [])].join(' ').toLowerCase().includes(q));
}

async function addEntry(session, data) {
  const e = {
    id: crypto.randomUUID(), title: data.title || '', username: data.username || '', password: data.password || '',
    command: data.command || '', url: data.url || '', notes: data.notes || '', tags: Array.isArray(data.tags) ? data.tags : tags(data.tags),
    createdAt: now(), updatedAt: now()
  };
  session.vault.entries.push(e); await save(session); return { ...e, password: undefined };
}

async function updateEntry(session, id, data) {
  const e = getEntry(session, id);
  if (!e) throw new Error('Entrada não encontrada.');
  for (const field of ['title', 'username', 'password', 'command', 'url', 'notes']) {
    if (data[field] !== undefined) e[field] = data[field];
  }
  if (data.tags !== undefined) e.tags = Array.isArray(data.tags) ? data.tags : tags(data.tags);
  e.updatedAt = now(); await save(session); return { ...e, password: undefined };
}

async function deleteEntry(session, id) {
  const index = session.vault.entries.findIndex(e => e.id === id);
  if (index < 0) throw new Error('Entrada não encontrada.');
  session.vault.entries.splice(index, 1); await save(session); return true;
}

function getSecret(session, id, field) {
  const e = getEntry(session, id);
  if (!e) throw new Error('Entrada não encontrada.');
  return e[field] || '';
}

async function changeMasterPassword(session, newPassword) {
  if (!newPassword || newPassword.length < 12) throw new Error('A master password deve ter pelo menos 12 caracteres.');
  const salt = crypto.randomBytes(16).toString('base64');
  const key = await deriveKey(newPassword, salt);
  session.container.kdf.salt = salt;
  session.key = key;
  session.container.encrypted = encrypt(JSON.stringify(session.vault), key);
  writeContainer(session.container);
}

function vaultExists() { return fs.existsSync(getVaultFile()); }

module.exports = { getVaultFile, vaultExists, createVault, unlock, save, listEntries, findEntries, getEntry, addEntry, updateEntry, deleteEntry, getSecret, changeMasterPassword, tags };
