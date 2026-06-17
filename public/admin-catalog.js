const TOKEN_KEY = 'lider_admin_token';

let catalog = { brands: [], categories: [] };
let products = [];
let token = localStorage.getItem(TOKEN_KEY);
let addModalType = null;

const $ = (sel) => document.querySelector(sel);

function showToast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function authHeaders() {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function api(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Xatolik');
  return data;
}

function esc(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

async function checkAuth() {
  if (!token) return false;
  try {
    const { ok } = await api('/api/admin/verify', { headers: authHeaders() });
    return ok;
  } catch {
    return false;
  }
}

async function loadData() {
  [catalog, products] = await Promise.all([
    api('/api/admin/catalog', { headers: authHeaders() }),
    api('/api/admin/products', { headers: authHeaders() }),
  ]);
  render();
}

function catalogCol(type, items, label) {
  const rows = items.map((name, i) => `
    <div class="option-row">
      <input
        type="text"
        value="${esc(name)}"
        data-field="edit-${type}"
        data-index="${i}"
        placeholder="${label} nomi"
      >
      <button type="button" class="btn-danger btn-small" data-action="delete-${type}" data-index="${i}">×</button>
    </div>
  `).join('');

  return `
    <div class="catalog-col">
      <div class="variants-title">${label}lar</div>
      <div class="options-list">${rows || `<p class="sizes-empty">${label} yo'q</p>`}</div>
      <div class="add-option-row">
        <button type="button" class="btn-small btn-add-modal" data-action="open-add-modal" data-type="${type}">
          + Yangi ${label.toLowerCase()}
        </button>
      </div>
    </div>
  `;
}

function render() {
  $('#catalogContent').innerHTML = `
    ${catalogCol('brand', catalog.brands, 'Brend')}
    ${catalogCol('category', catalog.categories, 'Kategoriya')}
  `;
}

function openAddModal(type) {
  addModalType = type;
  const label = type === 'brand' ? 'brend' : 'kategoriya';
  $('#addModalTitle').textContent = `Yangi ${label}`;
  $('#addModalInput').value = '';
  $('#addModalInput').placeholder = `${label} nomini kiriting`;
  $('#addModal').classList.remove('hidden');
  setTimeout(() => $('#addModalInput').focus(), 0);
}

function closeAddModal() {
  addModalType = null;
  $('#addModal').classList.add('hidden');
}

async function saveCatalog() {
  await api('/api/admin/catalog', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(catalog),
  });
}

async function saveProducts() {
  await api('/api/admin/products', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(products),
  });
}

async function addCatalogItem(type, name) {
  const key = type === 'brand' ? 'brands' : 'categories';
  const label = type === 'brand' ? 'Brend' : 'Kategoriya';
  const trimmed = name.trim();

  if (!trimmed) {
    showToast(`${label} nomini kiriting`);
    return false;
  }

  if (catalog[key].includes(trimmed)) {
    showToast(`${label} mavjud`);
    return false;
  }

  catalog[key].push(trimmed);
  render();

  try {
    await saveCatalog();
    showToast(`${label} qo'shildi`);
    return true;
  } catch (err) {
    catalog[key].pop();
    render();
    showToast(err.message);
    return false;
  }
}

async function deleteCatalogItem(type, idx) {
  const key = type === 'brand' ? 'brands' : 'categories';
  const field = type === 'brand' ? 'brand' : 'category';
  const name = catalog[key][idx];
  if (products.some((p) => p[field] === name)) {
    showToast(`Bu ${type === 'brand' ? 'brend' : 'kategoriya'} ishlatilmoqda`);
    return;
  }
  const [removed] = catalog[key].splice(idx, 1);
  render();

  try {
    await saveCatalog();
    showToast('O\'chirildi');
  } catch (err) {
    catalog[key].splice(idx, 0, removed);
    render();
    showToast(err.message);
  }
}

async function renameCatalogItem(type, idx, newName) {
  const key = type === 'brand' ? 'brands' : 'categories';
  const field = type === 'brand' ? 'brand' : 'category';
  const oldName = catalog[key][idx];
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return;
  if (catalog[key].includes(trimmed)) {
    showToast(`${type === 'brand' ? 'Brend' : 'Kategoriya'} mavjud`);
    render();
    return;
  }
  catalog[key][idx] = trimmed;
  products.forEach((p) => {
    if (p[field] === oldName) p[field] = trimmed;
  });
  render();

  try {
    await saveCatalog();
    await saveProducts();
    showToast('Yangilandi');
  } catch (err) {
    catalog[key][idx] = oldName;
    products.forEach((p) => {
      if (p[field] === trimmed) p[field] = oldName;
    });
    render();
    showToast(err.message);
  }
}

function showApp() {
  $('#loginScreen').classList.add('hidden');
  $('#catalogApp').classList.remove('hidden');
}

function showLogin() {
  $('#loginScreen').classList.remove('hidden');
  $('#catalogApp').classList.add('hidden');
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginError').textContent = '';
  const btn = e.target.querySelector('button[type="submit"]');
  setButtonLoading(btn, true, 'Kirish...');

  try {
    const { token: t } = await api('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: $('#password').value }),
    });
    token = t;
    localStorage.setItem(TOKEN_KEY, token);
    showApp();
    $('#catalogContent').innerHTML = sectionLoaderHtml('Brend va kategoriyalar yuklanmoqda...');
    await loadData();
  } catch (err) {
    $('#loginError').textContent = err.message;
  } finally {
    setButtonLoading(btn, false);
  }
});

$('#logoutBtn').addEventListener('click', () => {
  token = null;
  localStorage.removeItem(TOKEN_KEY);
  showLogin();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#addModal').classList.contains('hidden')) {
    e.preventDefault();
    closeAddModal();
    return;
  }
  if (e.key === 'Enter' && e.target.id === 'addModalInput') {
    e.preventDefault();
    $('#addModalSaveBtn').click();
  }
});

document.addEventListener('change', (e) => {
  const { field, index } = e.target.dataset;
  if (field === 'edit-brand') {
    renameCatalogItem('brand', Number(index), e.target.value).catch((err) => showToast(err.message));
    return;
  }
  if (field === 'edit-category') {
    renameCatalogItem('category', Number(index), e.target.value).catch((err) => showToast(err.message));
  }
});

document.addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  if (!action) return;

  if (action === 'open-add-modal') {
    openAddModal(e.target.dataset.type);
    return;
  }

  if (action === 'close-add-modal') {
    closeAddModal();
    return;
  }

  if (action === 'delete-brand') {
    deleteCatalogItem('brand', Number(e.target.dataset.index)).catch((err) => showToast(err.message));
    return;
  }

  if (action === 'delete-category') {
    deleteCatalogItem('category', Number(e.target.dataset.index)).catch((err) => showToast(err.message));
  }
});

$('#addModalSaveBtn').addEventListener('click', async () => {
  if (!addModalType) return;
  const ok = await addCatalogItem(addModalType, $('#addModalInput').value);
  if (ok) closeAddModal();
});

$('#addModal').addEventListener('click', (e) => {
  if (e.target.id === 'addModal') {
    closeAddModal();
  }
});

(async () => {
  showBootLoader();
  if (await checkAuth()) {
    hideBootLoader();
    showApp();
    $('#catalogContent').innerHTML = sectionLoaderHtml('Brend va kategoriyalar yuklanmoqda...');
    try {
      await loadData();
    } catch (err) {
      showToast(err.message || 'Yuklanmadi');
      token = null;
      localStorage.removeItem(TOKEN_KEY);
      showLogin();
    }
  } else {
    hideBootLoader();
    showLogin();
  }
})();
