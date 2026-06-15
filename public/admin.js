const TOKEN_KEY = 'lider_admin_token';
const PLACEHOLDER = 'images/placeholder.svg';

let products = [];
let catalog = { brands: [], categories: [] };
let editingIndex = null;
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

function ensureSizes(product) {
  if (!product.sizes?.length) {
    const map = new Map();
    for (const v of product.variants || []) {
      if (v.size && !map.has(v.size)) {
        map.set(v.size, Number(v.price) || 0);
      }
    }
    product.sizes = [...map.entries()].map(([label, price]) => ({ label, price }));
  }
  return product;
}

function getSizePrice(product, sizeLabel) {
  const opt = product.sizes?.find((s) => s.label === sizeLabel);
  return opt?.price ?? 0;
}

function syncVariantPrices(product) {
  product.variants.forEach((v) => {
    if (v.size) v.price = getSizePrice(product, v.size);
  });
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
  [products, catalog] = await Promise.all([
    api('/api/admin/products', { headers: authHeaders() }),
    api('/api/admin/catalog', { headers: authHeaders() }),
  ]);
  products.forEach(ensureSizes);
  render();
}

function pickerItems(items, selected) {
  const list = [...items];
  if (selected && !list.includes(selected)) list.unshift(selected);
  return list;
}

function metaPicker(field, items, selected, index) {
  const type = field === 'brand' ? 'brand' : 'category';
  const label = field === 'brand' ? 'brend' : 'kategoriya';
  const list = pickerItems(items, selected);
  const options = list.map((item) => `
    <button
      type="button"
      class="meta-picker-option ${item === selected ? 'is-selected' : ''}"
      data-action="pick-meta"
      data-field="${field}"
      data-index="${index}"
      data-value="${esc(item)}"
    >${esc(item)}</button>
  `).join('');

  return `
    <div class="meta-picker" data-picker="${type}" data-index="${index}">
      <button
        type="button"
        class="meta-picker-trigger"
        data-action="toggle-picker"
        data-field="${field}"
        data-index="${index}"
        aria-haspopup="listbox"
        aria-expanded="false"
      >
        <span class="meta-picker-value ${selected ? '' : 'is-placeholder'}">${selected ? esc(selected) : '— Tanlang —'}</span>
        <span class="meta-picker-chevron" aria-hidden="true"></span>
      </button>
      <div class="meta-picker-panel hidden" role="listbox">
        <input
          type="text"
          class="meta-picker-search"
          placeholder="Qidirish..."
          data-action="picker-search"
          data-field="${field}"
          data-index="${index}"
          autocomplete="off"
        >
        <div class="meta-picker-options">${options || `<p class="meta-picker-empty">Ro'yxat bo'sh</p>`}</div>
        <div class="meta-picker-add-form hidden">
          <input
            type="text"
            class="meta-picker-add-input"
            placeholder="Yangi ${label} nomi"
            data-action="picker-add-input"
            data-field="${field}"
            data-index="${index}"
          >
          <button
            type="button"
            class="btn-small meta-picker-add-confirm"
            data-action="confirm-add-meta"
            data-field="${field}"
            data-index="${index}"
          >Qo'shish</button>
        </div>
        <button
          type="button"
          class="meta-picker-add-btn"
          data-action="show-add-meta"
          data-field="${field}"
          data-index="${index}"
        >+ Yangi ${label}</button>
      </div>
    </div>
  `;
}

function closeAllPickers() {
  document.querySelectorAll('.meta-picker.is-open').forEach((el) => {
    el.classList.remove('is-open');
    el.querySelector('.meta-picker-trigger')?.setAttribute('aria-expanded', 'false');
    el.querySelector('.meta-picker-panel')?.classList.add('hidden');
    el.querySelector('.meta-picker-add-form')?.classList.add('hidden');
    el.querySelector('.meta-picker-add-btn')?.classList.remove('hidden');
    const addInput = el.querySelector('.meta-picker-add-input');
    if (addInput) addInput.value = '';
    const search = el.querySelector('.meta-picker-search');
    if (search) search.value = '';
    filterPickerOptions(el, '');
  });
}

function filterPickerOptions(picker, query) {
  const q = query.trim().toLowerCase();
  let visible = 0;
  picker.querySelectorAll('.meta-picker-option').forEach((btn) => {
    const match = !q || btn.dataset.value.toLowerCase().includes(q);
    btn.classList.toggle('hidden', !match);
    if (match) visible += 1;
  });
  const empty = picker.querySelector('.meta-picker-empty');
  if (empty) empty.classList.toggle('hidden', visible > 0 || !q);
}

async function saveCatalog() {
  await api('/api/admin/catalog', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(catalog),
  });
}

async function addCatalogItem(type, name, productIndex) {
  const key = type === 'brand' ? 'brands' : 'categories';
  const field = type;
  const label = type === 'brand' ? 'Brend' : 'Kategoriya';
  const trimmed = name.trim();
  if (!trimmed) {
    showToast(`${label} nomini kiriting`);
    return false;
  }
  if (!catalog[key].includes(trimmed)) {
    catalog[key].push(trimmed);
    try {
      await saveCatalog();
    } catch (e) {
      catalog[key].pop();
      showToast(e.message);
      return false;
    }
  }
  if (productIndex !== undefined && productIndex !== null && !Number.isNaN(productIndex)) {
    products[productIndex][field] = trimmed;
  }
  return true;
}

function sizesSection(pi, p) {
  const rows = (p.sizes || []).map((s, si) => `
    <div class="size-option-row">
      <input type="text" value="${esc(s.label)}" placeholder="200ml" data-field="size-label" data-product="${pi}" data-size-index="${si}">
      <input type="number" value="${s.price}" placeholder="Narx" data-field="size-price" data-product="${pi}" data-size-index="${si}" min="0" step="1000">
      <button type="button" class="btn-danger btn-small" data-action="delete-size" data-product="${pi}" data-size-index="${si}">×</button>
    </div>
  `).join('');

  return `
    <div class="sizes-section">
      <div class="variants-title">O'lchamlar (narx bilan)</div>
      <div class="sizes-list">${rows || '<p class="sizes-empty">O\'lcham qo\'shing</p>'}</div>
      <button type="button" class="btn-small" data-action="add-size" data-index="${pi}">+ O'lcham</button>
    </div>
  `;
}

function bulkSizeSelect(pi, p) {
  const options = (p.sizes || []).map((s) => `
    <option value="${esc(s.label)}">${esc(s.label)} — ${s.price.toLocaleString()} so'm</option>
  `).join('');

  return `
    <select data-bulk="size" data-index="${pi}" ${options ? '' : 'disabled'}>
      ${options || '<option value="">O\'lcham yo\'q</option>'}
    </select>
  `;
}

function getProductThumb(p) {
  return p.variants?.[0]?.image || PLACEHOLDER;
}

function getPriceRange(p) {
  ensureSizes(p);
  const prices = [
    ...(p.sizes || []).map((s) => Number(s.price) || 0),
    ...(p.variants || []).map((v) => Number(v.price) || 0),
  ].filter((n) => n > 0);
  if (!prices.length) return '—';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return `${min.toLocaleString()} so'm`;
  return `${min.toLocaleString()} – ${max.toLocaleString()} so'm`;
}

function scrollToEditor(pi) {
  requestAnimationFrame(() => {
    document.getElementById(`editor-row-${pi}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function normalizeEditingIndex() {
  if (editingIndex !== null && editingIndex >= products.length) {
    editingIndex = products.length ? products.length - 1 : null;
  }
}

function renderOverview() {
  const el = $('#productsOverview');
  normalizeEditingIndex();

  if (!products.length) {
    el.innerHTML = `
      <div class="page-head">
        <h1 class="page-title">Mahsulotlar</h1>
        <p class="page-desc">Hali mahsulot yo'q</p>
      </div>
      <div class="products-empty">
        <p>Mahsulot yo'q</p>
        <span class="products-empty-hint">Yuqoridagi <strong>+ Mahsulot</strong> tugmasini bosing</span>
      </div>`;
    return;
  }

  const rows = products.flatMap((p, pi) => {
    const main = productTableRow(p, pi);
    if (editingIndex !== pi) return [main];
    return [main, `
      <tr class="editor-row" id="editor-row-${pi}">
        <td colspan="7">
          <div class="editor-panel">
            ${renderProductEditor(pi, p)}
          </div>
        </td>
      </tr>`];
  });

  el.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">Mahsulotlar</h1>
      <p class="page-desc">${products.length} ta mahsulot</p>
    </div>
    <div class="products-table-wrap">
      <table class="products-table">
        <thead>
          <tr>
            <th class="col-thumb"></th>
            <th>Nomi</th>
            <th>Brend</th>
            <th>Kategoriya</th>
            <th class="col-num">Variantlar</th>
            <th>Narx</th>
            <th class="col-actions">Amallar</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>
    </div>`;
}

function productTableRow(p, pi) {
  const isActive = editingIndex === pi;
  return `
    <tr class="product-row ${isActive ? 'is-active' : ''}" data-product-index="${pi}">
      <td>
        <img class="product-thumb" src="${getProductThumb(p)}" alt="" onerror="this.src='${PLACEHOLDER}'">
      </td>
      <td>
        <input
          type="text"
          class="table-input"
          value="${esc(p.name)}"
          data-field="name"
          data-index="${pi}"
          placeholder="Mahsulot nomi"
        >
      </td>
      <td><span class="table-meta">${p.brand ? esc(p.brand) : '—'}</span></td>
      <td><span class="table-meta">${p.category ? esc(p.category) : '—'}</span></td>
      <td class="col-num">${p.variants?.length || 0}</td>
      <td class="col-price">${getPriceRange(p)}</td>
      <td class="col-actions">
        <button type="button" class="btn-small btn-edit ${isActive ? 'is-open' : ''}" data-action="edit-product" data-index="${pi}">
          ${isActive ? 'Yopish' : 'Tahrirlash'}
        </button>
      </td>
    </tr>`;
}

function renderProductEditor(pi, p) {
  return `
    <div class="admin-product" data-index="${pi}">
      <div class="editor-toolbar">
        <div>
          <h2 id="editor-title-${pi}">${esc(p.name) || 'Mahsulot'}</h2>
          <span class="editor-subtitle">O'lchamlar, hidlar va rasmlar</span>
        </div>
        <div class="editor-toolbar-actions">
          <button type="button" class="btn-danger btn-small" data-action="delete-product" data-index="${pi}">O'chirish</button>
          <button type="button" class="btn-ghost btn-small" data-action="close-editor" data-index="${pi}">Yopish</button>
        </div>
      </div>
      <div class="product-meta-edit">
        <div class="meta-field">
          <span class="variants-title">Brend</span>
          ${metaPicker('brand', catalog.brands, p.brand || '', pi)}
        </div>
        <div class="meta-field">
          <span class="variants-title">Kategoriya</span>
          ${metaPicker('category', catalog.categories, p.category || '', pi)}
        </div>
      </div>
      <div class="variants-section">
        ${sizesSection(pi, p)}
        <div class="variants-title">Hidlar (variantlar)</div>
        <div class="bulk-add" data-index="${pi}">
          <span class="bulk-label">Tez qo'shish:</span>
          ${bulkSizeSelect(pi, p)}
          <input type="number" placeholder="Hidlar soni" data-bulk="count" data-index="${pi}" min="1" max="50" value="10">
          <input type="text" placeholder="Hid prefiksi (Hid)" data-bulk="prefix" data-index="${pi}" value="Hid">
          <button type="button" class="btn-small" data-action="bulk-add" data-index="${pi}">Qo'shish</button>
        </div>
        ${p.variants.map((v, vi) => variantRow(pi, vi, v, p)).join('')}
        <button type="button" class="btn-small add-variant-btn" data-action="add-variant" data-index="${pi}">+ Variant</button>
      </div>
    </div>`;
}

function render() {
  products.forEach(ensureSizes);
  renderOverview();
}

function variantRow(pi, vi, v, p) {
  const img = v.image || PLACEHOLDER;
  const isExternal = /^https?:\/\//i.test(v.image || '');
  const options = (p.sizes || []).map((s) => `
    <option value="${esc(s.label)}" ${s.label === v.size ? 'selected' : ''}>${esc(s.label)}</option>
  `).join('');

  return `
    <div class="variant-row" data-product="${pi}" data-variant="${vi}">
      <div class="variant-img-col">
        <label class="variant-img-wrap" title="Kompyuterdan yuklash">
          <img src="${img}" alt="" onerror="this.src='${PLACEHOLDER}'">
          <span class="variant-img-overlay">Fayl</span>
          <input type="file" accept="image/*" data-action="upload" data-product="${pi}" data-variant="${vi}">
        </label>
      </div>
      <div class="variant-fields">
        <input type="text" value="${esc(v.scent)}" placeholder="Hid nomi" data-field="scent" data-product="${pi}" data-variant="${vi}">
        <select data-field="size" data-product="${pi}" data-variant="${vi}" ${options ? '' : 'disabled'}>
          ${options || '<option value="">O\'lcham qo\'shing</option>'}
        </select>
        <div class="img-url-row">
          <input
            type="url"
            value="${isExternal ? esc(v.image) : ''}"
            placeholder="Rasm linki — https://..."
            data-field="image-url"
            data-product="${pi}"
            data-variant="${vi}"
          >
          <button type="button" class="btn-small" data-action="upload-url" data-product="${pi}" data-variant="${vi}">Yuklash</button>
          <button type="button" class="btn-small" data-action="save-url" data-product="${pi}" data-variant="${vi}" title="Yuklamasdan, faqat link saqlash">↗</button>
        </div>
      </div>
      <button type="button" class="btn-danger btn-small" data-action="delete-variant" data-product="${pi}" data-variant="${vi}">×</button>
    </div>
  `;
}

function esc(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

async function saveProducts() {
  products.forEach((p) => {
    ensureSizes(p);
    syncVariantPrices(p);
    p.variants.forEach((v) => {
      v.id = makeVariantId(p.id, v.scent, v.size);
      v.price = getSizePrice(p, v.size);
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

async function uploadImageFromUrl(url, pi, vi) {
  const data = await api('/api/admin/upload-url', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ url }),
  });

  products[pi].variants[vi].image = data.image;
  render();
  showToast('Linkdan yuklandi');
}

function saveExternalUrl(pi, vi, url) {
  if (!url || !/^https?:\/\//i.test(url)) {
    showToast('To\'g\'ri link kiriting');
    return;
  }
  products[pi].variants[vi].image = url.trim();
  render();
  showToast('Link saqlandi');
}

function getImageUrlInput(pi, vi) {
  return document.querySelector(`input[data-field="image-url"][data-product="${pi}"][data-variant="${vi}"]`);
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
    brand: catalog.brands[0] || '',
    category: catalog.categories[0] || '',
    sizes: [{ label: '100ml', price: 0 }],
    variants: [{ id: `${id}-edt-100ml`, scent: 'EDT', size: '100ml', price: 0, image: PLACEHOLDER }],
  });
  editingIndex = products.length - 1;
  render();
  scrollToEditor(editingIndex);
});

document.addEventListener('input', (e) => {
  const { field, index, product, variant, sizeIndex } = e.target.dataset;
  if (!field) return;

  if (field === 'name') {
    products[Number(index)].name = e.target.value;
    const title = document.getElementById(`editor-title-${index}`);
    if (title) title.textContent = e.target.value || 'Mahsulot';
    return;
  }

  const pi = Number(product);
  const vi = Number(variant);
  const si = Number(sizeIndex);

  if (field === 'size-label') {
    const oldLabel = products[pi].sizes[si].label;
    const newLabel = e.target.value;
    products[pi].sizes[si].label = newLabel;
    products[pi].variants.forEach((v) => {
      if (v.size === oldLabel) v.size = newLabel;
    });
    return;
  }

  if (field === 'size-price') {
    products[pi].sizes[si].price = Number(e.target.value) || 0;
    syncVariantPrices(products[pi]);
    return;
  }

  if (field === 'scent') {
    products[pi].variants[vi].scent = e.target.value;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.target.dataset.field !== 'image-url') return;
  e.preventDefault();
  const pi = Number(e.target.dataset.product);
  const vi = Number(e.target.dataset.variant);
  const url = e.target.value.trim();
  if (!url) return;
  uploadImageFromUrl(url, pi, vi).catch((err) => showToast(err.message));
});

document.addEventListener('change', (e) => {
  const { field, product, variant, action } = e.target.dataset;

  if (field === 'size-label' || field === 'size-price') {
    render();
    return;
  }

  if (action === 'upload') {
    const file = e.target.files[0];
    if (!file) return;
    const pi = Number(e.target.dataset.product);
    const vi = Number(e.target.dataset.variant);
    uploadImage(file, pi, vi).catch((err) => showToast(err.message));
    e.target.value = '';
    return;
  }

  if (field !== 'size') return;

  const pi = Number(product);
  const vi = Number(variant);
  products[pi].variants[vi].size = e.target.value;
  products[pi].variants[vi].price = getSizePrice(products[pi], e.target.value);
});

document.addEventListener('input', (e) => {
  if (e.target.dataset.action !== 'picker-search') return;
  const picker = e.target.closest('.meta-picker');
  if (picker) filterPickerOptions(picker, e.target.value);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeAllPickers();
  if (e.key === 'Enter' && e.target.dataset.action === 'picker-add-input') {
    e.preventDefault();
    e.target.closest('.meta-picker')
      ?.querySelector('[data-action="confirm-add-meta"]')
      ?.click();
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.meta-picker')) closeAllPickers();

  const action = e.target.dataset.action;

  if (action === 'toggle-picker') {
    e.stopPropagation();
    const picker = e.target.closest('.meta-picker');
    const wasOpen = picker.classList.contains('is-open');
    closeAllPickers();
    if (!wasOpen) {
      picker.classList.add('is-open');
      picker.querySelector('.meta-picker-trigger')?.setAttribute('aria-expanded', 'true');
      picker.querySelector('.meta-picker-panel')?.classList.remove('hidden');
      requestAnimationFrame(() => picker.querySelector('.meta-picker-search')?.focus());
    }
    return;
  }

  if (action === 'pick-meta') {
    e.stopPropagation();
    const pi = Number(e.target.dataset.index);
    const field = e.target.dataset.field;
    products[pi][field] = e.target.dataset.value;
    closeAllPickers();
    render();
    return;
  }

  if (action === 'show-add-meta') {
    e.stopPropagation();
    const picker = e.target.closest('.meta-picker');
    const form = picker.querySelector('.meta-picker-add-form');
    form.classList.remove('hidden');
    e.target.classList.add('hidden');
    requestAnimationFrame(() => picker.querySelector('.meta-picker-add-input')?.focus());
    return;
  }

  if (action === 'confirm-add-meta') {
    e.stopPropagation();
    const pi = Number(e.target.dataset.index);
    const field = e.target.dataset.field;
    const type = field === 'brand' ? 'brand' : 'category';
    const picker = e.target.closest('.meta-picker');
    const input = picker.querySelector('.meta-picker-add-input');
    addCatalogItem(type, input?.value || '', pi).then((ok) => {
      if (!ok) return;
      closeAllPickers();
      render();
      showToast(`${type === 'brand' ? 'Brend' : 'Kategoriya'} qo'shildi`);
    });
    return;
  }

  const row = e.target.closest('tr[data-product-index]');
  if (row && !e.target.closest('button, input, select, a, label, .meta-picker')) {
    const pi = Number(row.dataset.productIndex);
    const wasOpen = editingIndex === pi;
    editingIndex = wasOpen ? null : pi;
    render();
    if (!wasOpen) scrollToEditor(pi);
    return;
  }

  if (!action) return;

  const pi = Number(e.target.dataset.index ?? e.target.dataset.product);
  const vi = Number(e.target.dataset.variant);
  const si = Number(e.target.dataset.sizeIndex);

  if (action === 'close-editor') {
    editingIndex = null;
    render();
    return;
  }

  if (action === 'edit-product') {
    const wasOpen = editingIndex === pi;
    editingIndex = wasOpen ? null : pi;
    render();
    if (!wasOpen) scrollToEditor(pi);
    return;
  }

  if (action === 'delete-product') {
    if (confirm('Mahsulotni o\'chirasizmi?')) {
      products.splice(pi, 1);
      if (editingIndex === pi) editingIndex = null;
      else if (editingIndex !== null && editingIndex > pi) editingIndex -= 1;
      render();
    }
    return;
  }

  if (action === 'add-size') {
    const p = products[pi];
    ensureSizes(p);
    p.sizes.push({ label: '', price: 0 });
    render();
  }

  if (action === 'delete-size') {
    const label = products[pi].sizes[si].label;
    if (label && products[pi].variants.some((v) => v.size === label)) {
      showToast('Bu o\'lcham ishlatilmoqda');
      return;
    }
    products[pi].sizes.splice(si, 1);
    render();
  }

  if (action === 'add-variant') {
    const p = products[pi];
    ensureSizes(p);
    const defaultSize = p.sizes[0]?.label || '';
    p.variants.push({
      id: `${p.id}-yangi`,
      scent: '',
      size: defaultSize,
      price: getSizePrice(p, defaultSize),
      image: PLACEHOLDER,
    });
    render();
  }

  if (action === 'bulk-add') {
    const panel = e.target.closest('.bulk-add');
    const size = panel.querySelector('[data-bulk="size"]').value.trim();
    const count = Number(panel.querySelector('[data-bulk="count"]').value) || 0;
    const prefix = panel.querySelector('[data-bulk="prefix"]').value.trim() || 'Hid';

    if (!size || count < 1) {
      showToast('O\'lcham va hidlar sonini kiriting');
      return;
    }

    const p = products[pi];
    const price = getSizePrice(p, size);
    const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const sizeSlug = slug(size);

    for (let i = 1; i <= count; i++) {
      const scent = `${prefix} ${i}`;
      p.variants.push({
        id: `${p.id}-${slug(scent)}-${sizeSlug}`,
        scent,
        size,
        price,
        image: `images/${slug(p.name)}-${sizeSlug}-${slug(scent)}.jpg`,
      });
    }

    render();
    showToast(`${count} ta variant qo'shildi`);
  }

  if (action === 'delete-variant') {
    products[pi].variants.splice(vi, 1);
    render();
  }

  if (action === 'upload-url') {
    const input = getImageUrlInput(pi, vi);
    const url = input?.value.trim();
    if (!url) {
      showToast('Link kiriting');
      return;
    }
    uploadImageFromUrl(url, pi, vi).catch((err) => showToast(err.message));
  }

  if (action === 'save-url') {
    const input = getImageUrlInput(pi, vi);
    saveExternalUrl(pi, vi, input?.value.trim());
  }
});

(async () => {
  if (await checkAuth()) {
    showAdmin();
    await loadProducts();
  } else {
    showLogin();
  }
})();
