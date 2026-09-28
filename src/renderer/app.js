let entries = [];
let currentFilter = 'all';
let currentDetailId = null;

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

async function boot() {
  const status = await window.vaultAPI.status();
  if (!status.exists) $('createHint').classList.remove('hidden');
}

function showVault() { $('lockScreen').classList.add('hidden'); $('vaultScreen').classList.remove('hidden'); }
function showError(message) { $('lockError').textContent = message; $('lockError').classList.remove('hidden'); }

async function unlock(event) {
  event.preventDefault(); $('lockError').classList.add('hidden');
  const password = $('masterPassword').value;
  if (!password) return showError('Introduza a master password.');
  try { const result = await window.vaultAPI.unlock(password); entries = result.entries; $('masterPassword').value = ''; showVault(); render(); }
  catch (e) { showError(e.message); $('masterPassword').select(); }
}

async function refresh() { entries = await window.vaultAPI.list(); render(); }

function filteredEntries() {
  let result = entries;
  if (currentFilter === 'passwords') result = result.filter(e => e.hasPassword);
  if (currentFilter === 'commands') result = result.filter(e => e.command);
  if (currentFilter === 'favorites') result = result.filter(e => (e.tags || []).includes('favorito'));
  const q = $('searchInput').value.trim().toLowerCase();
  if (q) result = result.filter(e => [e.title,e.username,e.command,e.url,e.notes,...(e.tags||[])].join(' ').toLowerCase().includes(q));
  return result;
}

function render() {
  const list = filteredEntries().sort((a, b) =>
    (a.title || '').localeCompare(b.title || '', 'pt-PT', {
      sensitivity: 'base'
    })
  );
  $('entryCount').textContent = `${list.length} ${list.length === 1 ? 'entrada' : 'entradas'}`;
  $('entryList').innerHTML = list.map(e => `
    <article class="entry-card" data-id="${escapeHtml(e.id)}">
      <div class="entry-top"><div class="entry-icon">${e.command ? '💻' : '🔑'}</div><div class="entry-info"><h3>${escapeHtml(e.title || '(sem título)')}</h3><p>${escapeHtml(e.username || e.url || e.command || 'Sem informação adicional')}</p></div></div>
      <div class="entry-tags">${(e.tags||[]).slice(0,4).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
    </article>`).join('');
  $('emptyState').classList.toggle('hidden', list.length > 0);
  document.querySelectorAll('.entry-card').forEach(card => card.addEventListener('click', () => openDetail(card.dataset.id)));
}

function openEntryModal(entry = null) {
  $('modalTitle').textContent = entry ? 'Editar entrada' : 'Nova entrada';
  $('modalSubtitle').textContent = entry ? 'Atualize os dados desta credencial.' : 'Guarde uma credencial de forma segura.';
  $('entryId').value = entry?.id || '';
  $('fTitle').value = entry?.title || ''; $('fUsername').value = entry?.username || ''; $('fPassword').value = entry?.password || '';
  $('fUrl').value = entry?.url || ''; $('fCommand').value = entry?.command || ''; $('fTags').value = (entry?.tags || []).join(', '); $('fNotes').value = entry?.notes || '';
  $('formError').classList.add('hidden'); $('modalBackdrop').classList.remove('hidden'); $('fTitle').focus();
}

async function saveEntry(event) {
  event.preventDefault(); $('formError').classList.add('hidden');
  const id = $('entryId').value;
  const data = { title:$('fTitle').value.trim(), username:$('fUsername').value, password:$('fPassword').value, url:$('fUrl').value.trim(), command:$('fCommand').value, tags:$('fTags').value.split(',').map(x=>x.trim()).filter(Boolean), notes:$('fNotes').value };
  try { if (id) await window.vaultAPI.update(id, data); else await window.vaultAPI.add(data); $('modalBackdrop').classList.add('hidden'); await refresh(); }
  catch (e) { $('formError').textContent = e.message; $('formError').classList.remove('hidden'); }
}

async function openDetail(id) {
  currentDetailId = id;
  const e = await window.vaultAPI.get(id);
  $('detailTitle').textContent = e.title || '(sem título)'; $('detailMeta').textContent = e.username || e.url || '';
  const secret = value => `<div class="secret-row"><span class="detail-value secret-value">••••••••••</span><button class="copy-btn" data-copy="${value}">Copiar</button></div>`;
  $('detailBody').innerHTML = `
    ${row('Utilizador', escapeHtml(e.username))}
    ${row('Password', secret('password'), true)}
    ${row('Comando', e.command ? `<div class="secret-row"><span class="detail-value secret-value">${escapeHtml(e.command)}</span><button class="copy2-btn" data-copy="command">Copiar</button></div>` : '')}
    ${row('URL', e.url ? `<a href="#" id="detailUrl">${escapeHtml(e.url)}</a>` : '')}
    ${row('Tags', escapeHtml((e.tags||[]).join(', ')))}
    ${row('Notas', escapeHtml(e.notes))}`;
  $('detailBackdrop').classList.remove('hidden');
  document.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async ev => { const field = ev.currentTarget.dataset.copy; await window.vaultAPI.copy(id, field); ev.currentTarget.textContent='Copiado'; setTimeout(()=>ev.currentTarget.textContent='Copiar',1200); }));
  const url = $('detailUrl'); if (url) url.addEventListener('click', async ev => { ev.preventDefault(); await window.vaultAPI.openUrl(e.url); });
}
function row(label, value, secret=false) { if (!value) return ''; return `<div class="detail-row"><div class="detail-label">${label}</div>${secret?value:`<div class="detail-value">${value}</div>`}</div>`; }

async function deleteCurrent() {
  const e = await window.vaultAPI.get(currentDetailId);
  if (!(await window.vaultAPI.confirmDelete(e.title || '(sem título)'))) return;
  await window.vaultAPI.remove(currentDetailId); $('detailBackdrop').classList.add('hidden'); await refresh();
}

async function changeMaster() {
  const first = prompt('Nova master password (mínimo 12 caracteres):');
  if (!first) return;
  const second = prompt('Confirme a nova master password:');
  if (first !== second) return alert('As master passwords não coincidem.');
  try { await window.vaultAPI.changeMaster(first); alert('Master password alterada com sucesso.'); $('settingsBackdrop').classList.add('hidden'); }
  catch (e) { alert(e.message); }
}

$('unlockForm').addEventListener('submit', unlock);
$('newEntryBtn').addEventListener('click', () => openEntryModal()); $('emptyNewBtn').addEventListener('click', () => openEntryModal());
$('entryForm').addEventListener('submit', saveEntry);
$('closeModal').addEventListener('click', () => $('modalBackdrop').classList.add('hidden')); $('cancelModal').addEventListener('click', () => $('modalBackdrop').classList.add('hidden'));
$('closeDetail').addEventListener('click', () => $('detailBackdrop').classList.add('hidden')); $('detailEdit').addEventListener('click', async () => { const e=await window.vaultAPI.get(currentDetailId); $('detailBackdrop').classList.add('hidden'); openEntryModal(e); }); $('detailDelete').addEventListener('click', deleteCurrent);
$('togglePassword').addEventListener('click', () => { const input=$('fPassword'); const visible=input.type==='text'; input.type=visible?'password':'text'; $('togglePassword').textContent=visible?'Mostrar':'Ocultar'; });
$('searchInput').addEventListener('input', render);
$('lockBtn').addEventListener('click', async () => { await window.vaultAPI.lock(); entries=[]; $('vaultScreen').classList.add('hidden'); $('lockScreen').classList.remove('hidden'); $('masterPassword').value=''; $('masterPassword').focus(); });
$('settingsBtn').addEventListener('click', async () => { const s=await window.vaultAPI.status(); $('vaultPath').textContent=s.path; $('settingsBackdrop').classList.remove('hidden'); });
$('closeSettings').addEventListener('click', () => $('settingsBackdrop').classList.add('hidden')); $('changeMasterBtn').addEventListener('click', changeMaster);
document.querySelectorAll('.nav-item[data-filter]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.nav-item[data-filter]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');currentFilter=btn.dataset.filter;render();}));
window.addEventListener('keydown', e => { if (e.key === 'Escape') { ['modalBackdrop','detailBackdrop','settingsBackdrop'].forEach(id=>$(id).classList.add('hidden')); } if (e.ctrlKey && e.key.toLowerCase()==='f') { e.preventDefault(); $('searchInput').focus(); } });
boot();
