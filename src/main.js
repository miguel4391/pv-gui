const { app, BrowserWindow, ipcMain, dialog, clipboard, shell } = require('electron');
const path = require('path');
const vault = require('./vault-core');

let mainWindow;
let session = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#f5f7fb',
    title: 'Password Vault',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function requireSession() { if (!session) throw new Error('O cofre está bloqueado.'); return session; }

ipcMain.handle('vault:status', () => ({ exists: vault.vaultExists(), path: vault.getVaultFile() }));
ipcMain.handle('vault:unlock', async (_, password) => { session = await vault.unlock(password); return { entries: vault.listEntries(session) }; });
ipcMain.handle('vault:create', async (_, password) => { if (vault.vaultExists()) throw new Error('O cofre já existe.'); await vault.createVault(password); session = await vault.unlock(password); return { entries: vault.listEntries(session) }; });
ipcMain.handle('vault:lock', () => { session = null; return true; });
ipcMain.handle('vault:list', () => vault.listEntries(requireSession()));
ipcMain.handle('vault:search', (_, q) => vault.findEntries(requireSession(), q));
ipcMain.handle('vault:get', (_, id) => { const e = vault.getEntry(requireSession(), id); if (!e) throw new Error('Entrada não encontrada.'); return { ...e }; });
ipcMain.handle('vault:add', async (_, data) => vault.addEntry(requireSession(), data));
ipcMain.handle('vault:update', async (_, id, data) => vault.updateEntry(requireSession(), id, data));
ipcMain.handle('vault:delete', async (_, id) => vault.deleteEntry(requireSession(), id));
ipcMain.handle('vault:copy', (_, id, field) => { const value = vault.getSecret(requireSession(), id, field); clipboard.writeText(value); return true; });
ipcMain.handle('vault:change-master', async (_, currentPassword, newPassword) => vault.changeMasterPassword(requireSession(), currentPassword, newPassword));
ipcMain.handle('system:open-url', async (_, url) => { if (!/^https?:\/\//i.test(url)) throw new Error('URL inválido.'); await shell.openExternal(url); return true; });
ipcMain.handle('system:confirm-delete', async (_, title) => { const result = await dialog.showMessageBox(mainWindow, { type: 'warning', buttons: ['Cancelar', 'Apagar'], defaultId: 0, cancelId: 0, title: 'Apagar entrada', message: `Apagar "${title}"?`, detail: 'Esta operação não pode ser anulada.' }); return result.response === 1; });

app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { session = null; });
