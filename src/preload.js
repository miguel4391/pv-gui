const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vaultAPI', {
  status: () => ipcRenderer.invoke('vault:status'),
  unlock: password => ipcRenderer.invoke('vault:unlock', password),
  create: password => ipcRenderer.invoke('vault:create', password),
  lock: () => ipcRenderer.invoke('vault:lock'),
  list: () => ipcRenderer.invoke('vault:list'),
  search: q => ipcRenderer.invoke('vault:search', q),
  get: id => ipcRenderer.invoke('vault:get', id),
  add: data => ipcRenderer.invoke('vault:add', data),
  update: (id, data) => ipcRenderer.invoke('vault:update', id, data),
  remove: id => ipcRenderer.invoke('vault:delete', id),
  copy: (id, field) => ipcRenderer.invoke('vault:copy', id, field),
  changeMaster: (currentPassword, newPassword) => ipcRenderer.invoke('vault:change-master', currentPassword, newPassword),
  openUrl: url => ipcRenderer.invoke('system:open-url', url),
  confirmDelete: title => ipcRenderer.invoke('system:confirm-delete', title)
});
