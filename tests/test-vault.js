const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'password-vault-test-'));
  process.env.VAULT_FILE = path.join(dir, 'vault.enc');
  const vault = require('../src/vault-core');
  const password = 'uma-master-password-segura';
  await vault.createVault(password);
  assert.equal(vault.vaultExists(), true);
  const session = await vault.unlock(password);
  const created = await vault.addEntry(session, {title:'Teste', username:'user', password:'secret', command:'ssh user@host', tags:['teste']});
  assert.equal(created.title, 'Teste');
  assert.equal(created.password, undefined);
  const loaded = await vault.getEntry(session, created.id);
  assert.equal(loaded.password, 'secret');
  assert.equal(vault.findEntries(session, 'ssh').length, 1);
  await vault.updateEntry(session, created.id, {notes:'nota'});
  assert.equal(vault.getEntry(session, created.id).notes, 'nota');
  await vault.deleteEntry(session, created.id);
  assert.equal(vault.listEntries(session).length, 0);
  console.log('Todos os testes passaram.');
})().catch(err => { console.error(err); process.exit(1); });
