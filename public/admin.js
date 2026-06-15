const TOKEN_KEY = 'lider_admin_token';
const PLACEHOLDER = 'images/placeholder.svg';

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

function slugify(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function makeVariantId(productId, scent, size) {
  return `${productId}-${slugify(scent)}-${slugify(size)}`;
}

function nextProductId() {
  return products.length ? Math.max(...products.map((p) => p.id)) + 1 : 1;
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

async function loadProducts() {
  products = await api('/api/admin/products', { headers: authHeaders() });
  render();
}

function render() {
  const list = $('#productList');
  list.innerHTML = products.map((p, pi) => `
    <div class="admin-product" data-index="${pi}">
      <div class="admin-product-header">
        <input type="text" value="${esc(p.name)}" data-field="name" data-index="${pi}" placeholder="Mahsulot nomi">
        <button type="button" class="btn-danger btn-small" data-action="delete-product" data-index="${pi}">O'chirish</button>
      </div>
      <div class="variants-section">
        <div class="variants-title">Hid va o'lchamlar</div>
        ${p.variants.map((v, vi) => variantRow(pi, vi, v)).join('')}
        <button type="button" class="btn-small add-variant-btn" data-action="add-variant" data-index="${pi}">+ Variant</button>
      </div>
    </div>
  `).join('');
}

function variantRow(pi, vi, v) {
  const img = v.image || PLACEHOLDER;
  return `
    <div class="variant-row" data-product="${pi}" data-variant="${vi}">
      <label class="variant-img-wrap">
        <img src="${img}" alt="" onerror="this.src='${PLACEHOLDER}'">
        <span class="variant-img-overlay">Rasm</span>
        <input type="file" accept="image/*" data-action="upload" data-product="${pi}" data-variant="${vi}">
      </label>
      <input type="text" value="${esc(v.scent)}" placeholder="Hid (EDT)" data-field="scent" data-product="${pi}" data-variant="${vi}">
      <input type="text" value="${esc(v.size)}" placeholder="O'lcham (100ml)" data-field="size" data-product="${pi}" data-variant="${vi}">
      <input type="number" value="${v.price}" placeholder="Narx" data-field="price" data-product="${pi}" data-variant="${vi}" min="0" step="1000">
      <button type="button" class="btn-danger btn-small" data-action="delete-variant" data-product="${pi}" data-variant="${vi}">×</button>
    </div>
  `;
}

function esc(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

async function saveProducts() {
  products.forEach((p) => {
    p.variants.forEach((v) => {
      v.id = makeVariantId(p.id, v.scent, v.size);
      v.price = Number(v.price) || 0;
    });
  });

  await api('/api/admin/products', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(products),
  });

  showToast('Saqlandi');
}

async function uploadImage(file, pi, vi) {
  const form = new FormData();
  form.append('image', file);

  const res = await fetch('/api/admin/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Yuklanmadi');

  products[pi].variants[vi].image = data.image;
  render();
  showToast('Rasm yuklandi');
}

function showAdmin() {
  $('#loginScreen').classList.add('hidden');
  $('#adminApp').classList.remove('hidden');
}

function showLogin() {
  $('#loginScreen').classList.remove('hidden');
  $('#adminApp').classList.add('hidden');
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
    showAdmin();
    await loadProducts();
  } catch (err) {
    $('#loginError').textContent = err.message;
  }
});

$('#logoutBtn').addEventListener('click', () => {
  token = null;
  localStorage.removeItem(TOKEN_KEY);
  showLogin();
});

$('#saveBtn').addEventListener('click', () => saveProducts().catch((e) => showToast(e.message)));

$('#addProductBtn').addEventListener('click', () => {
  const id = nextProductId();
  products.push({
    id,
    name: 'Yangi mahsulot',
    variants: [{ id: `${id}-edt-100ml`, scent: 'EDT', size: '100ml', price: 0, image: PLACEHOLDER }],
  });
  render();
});

document.addEventListener('input', (e) => {
  const { field, index, product, variant } = e.target.dataset;
  if (!field) return;

  if (field === 'name') {
    products[Number(index)].name = e.target.value;
    return;
  }

  const pi = Number(product);
  const vi = Number(variant);
  if (field === 'price') {
    products[pi].variants[vi].price = Number(e.target.value) || 0;
  } else {
    products[pi].variants[vi][field] = e.target.value;
  }
});

document.addEventListener('click', (e) => {
  const action = e.target.dataset.action;
  if (!action) return;

  const pi = Number(e.target.dataset.index ?? e.target.dataset.product);
  const vi = Number(e.target.dataset.variant);

  if (action === 'delete-product') {
    if (confirm('Mahsulotni o\'chirasizmi?')) {
      products.splice(pi, 1);
      render();
    }
  }

  if (action === 'add-variant') {
    const p = products[pi];
    p.variants.push({
      id: `${p.id}-yangi`,
      scent: '',
      size: '',
      price: 0,
      image: PLACEHOLDER,
    });
    render();
  }

  if (action === 'delete-variant') {
    products[pi].variants.splice(vi, 1);
    render();
  }
});

document.addEventListener('change', (e) => {
  if (e.target.dataset.action !== 'upload') return;
  const file = e.target.files[0];
  if (!file) return;

  const pi = Number(e.target.dataset.product);
  const vi = Number(e.target.dataset.variant);

  uploadImage(file, pi, vi).catch((err) => showToast(err.message));
  e.target.value = '';
});

(async () => {
  if (await checkAuth()) {
    showAdmin();
    await loadProducts();
  } else {
    showLogin();
  }
})();
