const TOKEN_KEY = 'lider_admin_token';

let catalog = { brands: [], categories: [] };
let products = [];
let token = localStorage.getItem(TOKEN_KEY);

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
        <input type="text" placeholder="Yangi ${label.toLowerCase()}" data-field="new-${type}">
        <button type="button" class="btn-small" data-action="add-${type}">+</button>
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

function addCatalogItem(type, name) {
  const key = type === 'brand' ? 'brands' : 'categories';
  const label = type === 'brand' ? 'Brend' : 'Kategoriya';
  if (!name) return showToast(`${label} nomini kiriting`);
  if (catalog[key].includes(name)) return showToast(`${label} mavjud`);
  catalog[key].push(name);
  render();
}

function deleteCatalogItem(type, idx) {
  const key = type === 'brand' ? 'brands' : 'categories';
  const field = type === 'brand' ? 'brand' : 'category';
  const name = catalog[key][idx];
  if (products.some((p) => p[field] === name)) {
    return showToast(`Bu ${type === 'brand' ? 'brend' : 'kategoriya'} ishlatilmoqda`);
  }
  catalog[key].splice(idx, 1);
  render();
}

function renameCatalogItem(type, idx, newName) {
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
}

async function saveCatalog() {
  await api('/api/admin/catalog', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(catalog),
  });

  if (products.length) {
    await api('/api/admin/products', {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(products),
    });
  }

  showToast('Saqlandi');
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

  try {
    const { token: t } = await api('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: $('#password').value }),
    });
    token = t;
    localStorage.setItem(TOKEN_KEY, token);
    showApp();
    await loadData();
  } catch (err) {
    $('#loginError').textContent = err.message;
  }
});

$('#logoutBtn').addEventListener('click', () => {
  token = null;
  localStorage.removeItem(TOKEN_KEY);
  showLogin();
});

$('#saveBtn').addEventListener('click', () => saveCatalog().catch((e) => showToast(e.message)));

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.dataset.field === 'new-brand') {
    e.preventDefault();
    addCatalogItem('brand', e.target.value.trim());
    e.target.value = '';
    return;
  }
  if (e.key === 'Enter' && e.target.dataset.field === 'new-category') {
    e.preventDefault();
    addCatalogItem('category', e.target.value.trim());
    e.target.value = '';
  }
});

document.addEventListener('change', (e) => {
  const { field, index } = e.target.dataset;
  if (field === 'edit-brand') {
    renameCatalogItem('brand', Number(index), e.target.value);
    return;
  }
  if (field === 'edit-category') {
    renameCatalogItem('category', Number(index), e.target.value);
  }
});

document.addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  if (!action) return;

  if (action === 'add-brand') {
    const input = document.querySelector('input[data-field="new-brand"]');
    addCatalogItem('brand', input?.value.trim());
    if (input) input.value = '';
  }

  if (action === 'delete-brand') {
    deleteCatalogItem('brand', Number(e.target.dataset.index));
  }

  if (action === 'add-category') {
    const input = document.querySelector('input[data-field="new-category"]');
    addCatalogItem('category', input?.value.trim());
    if (input) input.value = '';
  }

  if (action === 'delete-category') {
    deleteCatalogItem('category', Number(e.target.dataset.index));
  }
});

(async () => {
  if (await checkAuth()) {
    showApp();
    await loadData();
  } else {
    showLogin();
  }
})();
