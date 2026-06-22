const TOKEN_KEY = 'lider_admin_token';
const PLACEHOLDER = 'images/placeholder.svg';

const ICON_TRASH = '<svg class="btn-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
const ICON_SAVE = '<svg class="btn-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm3-10H5V5h10v4z"/></svg>';
const ICON_BOLT = '<svg class="btn-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/></svg>';
const ICON_UPLOAD = '<svg class="btn-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>';
const ICON_CAMERA = '<svg class="btn-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/><path d="M9 4 7.17 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-3.17L15 4H9zm3 13c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>';
const ICON_IMAGE = '<svg class="variant-img-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';

let products = [];
let catalog = { brands: [], categories: [] };
let editingIndex = null;
let productIsNew = false;
let token = getAdminToken();
let autoSaveTimer = null;
let saveInFlight = false;
let queuedSaveMessage = null;
let filterSearch = '';
let filterBrands = [];
let filterCategories = [];
let draftBrands = [];
let draftCategories = [];

const $ = (sel) => document.querySelector(sel);

function showToast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

let confirmResolve = null;

function ensureConfirmModal() {
  if ($('#confirmModal')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="confirmModal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="confirmModalTitle">
      <div class="modal-dialog confirm-modal">
        <div class="modal-header">
          <h2 id="confirmModalTitle"></h2>
          <button type="button" class="modal-close" data-action="confirm-cancel" aria-label="Yopish">&times;</button>
        </div>
        <div class="modal-body">
          <p id="confirmModalMessage" class="confirm-modal-message"></p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn-ghost" data-action="confirm-cancel">Bekor qilish</button>
          <button type="button" class="btn-danger btn-with-icon" id="confirmModalOk" data-action="confirm-ok"></button>
        </div>
      </div>
    </div>
  `);

  const modal = $('#confirmModal');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeConfirmModal(false);
  });
  modal.querySelectorAll('[data-action="confirm-cancel"]').forEach((btn) => {
    btn.addEventListener('click', () => closeConfirmModal(false));
  });
  modal.querySelector('#confirmModalOk')?.addEventListener('click', () => closeConfirmModal(true));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || modal.classList.contains('hidden')) return;
    closeConfirmModal(false);
  });
}

function closeConfirmModal(result) {
  $('#confirmModal')?.classList.add('hidden');
  document.body.classList.remove('modal-open');
  if (confirmResolve) {
    confirmResolve(result);
    confirmResolve = null;
  }
}

function confirmDialog({
  title = 'Tasdiqlash',
  message = 'Davom etasizmi?',
  confirmLabel = 'Ha',
  danger = false,
} = {}) {
  ensureConfirmModal();
  return new Promise((resolve) => {
    confirmResolve = resolve;
    $('#confirmModalTitle').textContent = title;
    $('#confirmModalMessage').textContent = message;
    const okBtn = $('#confirmModalOk');
    okBtn.innerHTML = danger ? `${ICON_TRASH} ${confirmLabel}` : confirmLabel;
    okBtn.className = danger ? 'btn-danger btn-with-icon' : 'btn-primary';
    $('#confirmModal').classList.remove('hidden');
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => okBtn.focus());
  });
}

function deleteProductAt(pi) {
  const p = products[pi];
  if (!p) return;

  if (window.__ADMIN_PAGE === 'product') {
    const doDelete = () => {
      if (productIsNew) {
        window.location.href = '/admin';
        return;
      }
      api(`/api/admin/products/${p.id}`, { method: 'DELETE', headers: authHeaders() })
        .then(() => { window.location.href = '/admin'; })
        .catch((err) => showToast(err.message));
    };
    doDelete();
    return;
  }

  const [removed] = products.splice(pi, 1);
  if (editingIndex === pi) editingIndex = null;
  else if (editingIndex !== null && editingIndex > pi) editingIndex -= 1;

  render();

  saveProducts('Mahsulot o\'chirildi').catch((err) => {
    products.splice(pi, 0, removed);
    if (editingIndex === null) editingIndex = pi;
    render();
    showToast(err.message);
  });
}

function authHeaders() {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function api(path, options = {}) {
  const url = path.startsWith('http') ? path : apiUrl(path);
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
  token = getAdminToken();
  const ok = await verifyAdminSession(token);
  if (!ok) token = null;
  return ok;
}

async function loadProducts() {
  [products, catalog] = await Promise.all([
    api('/api/admin/products', { headers: authHeaders() }),
    api('/api/admin/catalog', { headers: authHeaders() }),
  ]);
  products.forEach(ensureSizes);
  try {
    sessionStorage.setItem('lider_admin_products', JSON.stringify(products));
  } catch { /* ignore quota */ }
  render();
}

function metaPicker(field, items, selected, index) {
  const type = field === 'brand' ? 'brand' : 'category';
  const label = field === 'brand' ? 'brend' : 'kategoriya';
  const list = orderedCatalogItems(items, selected);
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
      <div class="size-field">
        <span class="field-label">O'lcham</span>
        <input type="text" class="editor-input" value="${esc(s.label)}" placeholder="3 kg" data-field="size-label" data-product="${pi}" data-size-index="${si}">
      </div>
      <div class="size-field">
        <span class="field-label">Narx (so'm)</span>
        <input type="number" class="editor-input" value="${s.price}" placeholder="0" data-field="size-price" data-product="${pi}" data-size-index="${si}" min="0" step="1000">
      </div>
      <button type="button" class="btn-icon-delete" data-action="delete-size" data-product="${pi}" data-size-index="${si}" title="O'chirish" aria-label="O'chirish">${ICON_TRASH}</button>
    </div>
  `).join('');

  return `
    <div class="sizes-section">
      <div class="section-title">O'lchamlar va narxlar</div>
      <div class="sizes-list">${rows || '<p class="sizes-empty">O\'lcham qo\'shing</p>'}</div>
      <button type="button" class="btn-add-size" data-action="add-size" data-index="${pi}">+ Yangi o'lcham qo'shish</button>
    </div>
  `;
}

function sizeSelectItems(product, selected = '') {
  const sizes = product.sizes || [];
  if (!sizes.length) return [];

  const active = selected || sizes[0].label;
  return sizes.map((s) => ({
    value: s.label,
    label: `${s.label} — ${formatUzs(s.price)}`,
    selected: s.label === active,
  }));
}

function renderSizeSelect(product, { selected = '', emptyLabel = "O'lcham yo'q", hiddenAttrs = {} } = {}) {
  const items = sizeSelectItems(product, selected).map(({ value, label }) => ({ value, label }));
  const value = items.find((item) => item.value === selected)?.value
    || items[0]?.value
    || '';

  return buildAppSelect({
    items,
    value,
    placeholder: emptyLabel,
    disabled: !items.length,
    hiddenAttrs,
  });
}

function bulkSizeSelect(pi, p) {
  const value = p.sizes?.[0]?.label || '';
  return renderSizeSelect(p, {
    selected: value,
    emptyLabel: "O'lcham yo'q",
    hiddenAttrs: { bulk: 'size', index: pi },
  });
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

function scrollToEditor() {
  if (window.__ADMIN_PAGE === 'product') return;
  requestAnimationFrame(() => {
    document.getElementById('productEditorPanel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function catalogFilterItems(type) {
  const key = type === 'brand' ? 'brands' : 'categories';
  const fromProducts = products.map((p) => p[type]).filter(Boolean);
  return orderedCatalogItems([...new Set([...(catalog[key] || []), ...fromProducts])]);
}

function activeFilterCount() {
  return filterBrands.length + filterCategories.length;
}

function hasActiveProductFilters() {
  return Boolean(filterSearch.trim()) || activeFilterCount() > 0;
}

function filteredProducts() {
  const q = filterSearch.trim().toLowerCase();
  return products
    .map((p, i) => ({ product: p, index: i }))
    .filter(({ product: p }) => {
      if (filterBrands.length && !filterBrands.includes(p.brand)) return false;
      if (filterCategories.length && !filterCategories.includes(p.category)) return false;
      if (q) {
        const haystack = [p.name, p.brand, p.category].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .reverse();
}

const ICON_FILTER = '<svg class="btn-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/></svg>';

function syncProductSearchInputs() {
  const pageSearch = document.getElementById('productsPageSearch');
  const headerSearch = document.getElementById('adminSearch');
  if (pageSearch && pageSearch.value !== filterSearch) pageSearch.value = filterSearch;
  if (headerSearch && headerSearch.value !== filterSearch) headerSearch.value = filterSearch;
}

function renderProductsToolbar() {
  const count = activeFilterCount();
  return `
    <div class="products-toolbar">
      <div class="products-search">
        <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/>
        </svg>
        <input
          type="search"
          id="productsPageSearch"
          class="products-page-search-input"
          placeholder="Mahsulot, brend yoki kategoriya..."
          value="${esc(filterSearch)}"
          autocomplete="off"
        >
      </div>
      <button
        type="button"
        class="products-filter-btn${count ? ' is-active' : ''}"
        data-action="open-filter"
        aria-label="Filter"
      >
        ${ICON_FILTER}
        <span>Filter</span>
        ${count ? `<span class="products-filter-badge">${count}</span>` : ''}
      </button>
    </div>`;
}

function renderFilterChecklist(type, items, selected) {
  if (!items.length) {
    const label = type === 'brand' ? 'Brend' : 'Kategoriya';
    return `<p class="filter-empty">${label} yo'q</p>`;
  }
  return items.map((item) => `
    <label class="filter-check">
      <input
        type="checkbox"
        data-action="filter-toggle"
        data-type="${type}"
        value="${esc(item)}"
        ${selected.includes(item) ? 'checked' : ''}
      >
      <span class="filter-check-box" aria-hidden="true"></span>
      <span class="filter-check-label">${esc(item)}</span>
    </label>
  `).join('');
}

function ensureFilterModal() {
  if ($('#filterModal')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div id="filterModal" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="filterModalTitle">
      <div class="modal-dialog filter-modal">
        <div class="modal-header">
          <h2 id="filterModalTitle">Filter</h2>
          <button type="button" class="modal-close" data-action="close-filter" aria-label="Yopish">&times;</button>
        </div>
        <div class="modal-body filter-modal-body">
          <section class="filter-section">
            <h3 class="filter-section-title">Brendlar</h3>
            <div class="filter-checklist" id="filterBrandList"></div>
          </section>
          <section class="filter-section">
            <h3 class="filter-section-title">Kategoriyalar</h3>
            <div class="filter-checklist" id="filterCategoryList"></div>
          </section>
        </div>
        <div class="modal-footer filter-modal-footer">
          <button type="button" class="btn-ghost" data-action="clear-filter">Tozalash</button>
          <button type="button" class="btn-primary" data-action="apply-filter">Qo'llash</button>
        </div>
      </div>
    </div>
  `);

  const modal = $('#filterModal');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeFilterModal(false);
  });
}

function refreshFilterModalLists() {
  $('#filterBrandList').innerHTML = renderFilterChecklist('brand', catalogFilterItems('brand'), draftBrands);
  $('#filterCategoryList').innerHTML = renderFilterChecklist('category', catalogFilterItems('category'), draftCategories);
}

function openFilterModal() {
  ensureFilterModal();
  draftBrands = [...filterBrands];
  draftCategories = [...filterCategories];
  refreshFilterModalLists();
  $('#filterModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeFilterModal(apply) {
  if (apply) {
    filterBrands = [...draftBrands];
    filterCategories = [...draftCategories];
    render();
  }
  $('#filterModal')?.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function toggleDraftFilter(type, value, checked) {
  const list = type === 'brand' ? draftBrands : draftCategories;
  const idx = list.indexOf(value);
  if (checked && idx === -1) list.push(value);
  if (!checked && idx !== -1) list.splice(idx, 1);
}

function buildProductsCountLabel(listLength, total) {
  if (!hasActiveProductFilters()) {
    return `Sizning do'koningizda ${total} ta mahsulot mavjud`;
  }
  return `${listLength} ta ko'rsatilmoqda (${total} tadan)`;
}

const EDIT_ICON = `<svg viewBox="0 0 24 24" class="edit-icon" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.83H5v-.92l9.06-9.06.92.92-9 9.06zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;

function productCard(p, pi) {
  return `
    <article class="product-card" data-product-index="${pi}">
      <a
        href="/admin/product?id=${p.id}"
        class="product-card-edit"
        title="Tahrirlash"
        aria-label="Tahrirlash"
      >${EDIT_ICON}</a>
      <h3 class="product-card-title">${esc(p.name) || '—'}</h3>
      <dl class="product-card-meta">
        <div class="product-card-row">
          <dt>Brand</dt>
          <dd>${p.brand ? esc(p.brand) : '—'}</dd>
        </div>
        <div class="product-card-row">
          <dt>Kategoriya</dt>
          <dd>${p.category ? `<span class="table-pill">${esc(p.category)}</span>` : '—'}</dd>
        </div>
        <div class="product-card-row">
          <dt>Turlari</dt>
          <dd>${p.variants?.length || 0}</dd>
        </div>
        <div class="product-card-row">
          <dt>Narxi</dt>
          <dd class="product-card-price">${getPriceRange(p)}</dd>
        </div>
      </dl>
    </article>`;
}

function renderAddProductCard() {
  return `
    <a href="/admin/product/new" class="product-card product-card-add">
      <span class="product-card-add-icon" aria-hidden="true">+</span>
      <span class="product-card-add-title">Yangi mahsulot qo'shish</span>
      <span class="product-card-add-hint">Yangi parfyum yoki kosmetika qo'shing</span>
    </a>`;
}

function renderOverview() {
  const el = $('#productsOverview');
  if (!el) return;
  const list = filteredProducts();
  const total = products.length;
  const countLabel = buildProductsCountLabel(list.length, total);

  if (!total) {
    el.innerHTML = `
      <div class="page-head">
        <h1 class="page-title">Mahsulotlar</h1>
        <p class="page-desc">Hali mahsulot yo'q</p>
      </div>
      <div class="products-grid products-grid-empty">
        ${renderAddProductCard()}
      </div>`;
    return;
  }

  const cards = list.map(({ product: p, index: pi }) => productCard(p, pi)).join('');

  el.innerHTML = `
    <div class="page-head">
      <h1 class="page-title">Mahsulotlar</h1>
      <p class="page-desc">${countLabel}</p>
    </div>
    ${renderProductsToolbar()}
    <div class="products-grid">
      ${renderAddProductCard()}
      ${cards || '<p class="products-no-results">Qidiruv yoki filter bo\'yicha mahsulot topilmadi</p>'}
    </div>`;
  syncProductSearchInputs();
}

function createNewProductDraft(nextId) {
  const id = nextId ?? nextProductId();
  const draft = {
    id,
    name: 'Yangi mahsulot',
    brand: catalog.brands[0] || '',
    category: catalog.categories[0] || '',
    sizes: [{ label: '100ml', price: 0 }],
    variants: [{ id: `${id}-edt-100ml`, scent: 'EDT', size: '100ml', price: 0, image: PLACEHOLDER }],
  };
  products = [draft];
  editingIndex = 0;
  productIsNew = true;
  return 0;
}

function showProductPageLoader(text = 'Mahsulot yuklanmoqda...') {
  const el = $('#productEditorRoot');
  if (el) el.innerHTML = sectionLoaderHtml(text);
}

function resolveProductIdFromUrl() {
  const params = new URLSearchParams(location.search);
  const idParam = params.get('id');
  if (idParam !== null && idParam !== '') {
    const id = Number(idParam);
    if (Number.isInteger(id) && id > 0) return id;
  }
  const indexParam = params.get('index');
  if (indexParam !== null && indexParam !== '') {
    const cached = sessionStorage.getItem('lider_admin_products');
    if (cached) {
      try {
        const list = JSON.parse(cached);
        const idx = Number(indexParam);
        if (Number.isInteger(idx) && idx >= 0 && idx < list.length) return list[idx].id;
      } catch { /* ignore */ }
    }
  }
  return null;
}

async function bootstrapProductPage() {
  const isNew = location.pathname.endsWith('/new');
  showProductPageLoader(isNew ? 'Yangi mahsulot ochilmoqda...' : 'Mahsulot yuklanmoqda...');

  if (isNew) {
    try {
      const [catalogData, { nextId }] = await Promise.all([
        api('/api/admin/catalog', { headers: authHeaders() }),
        api('/api/admin/products/next-id', { headers: authHeaders() }),
      ]);
      catalog = catalogData;
      createNewProductDraft(nextId);
      render();
      return;
    } catch {
      const [catalogData, allProducts] = await Promise.all([
        api('/api/admin/catalog', { headers: authHeaders() }),
        api('/api/admin/products', { headers: authHeaders() }),
      ]);
      catalog = catalogData;
      products = allProducts;
      createNewProductDraft();
      render();
      return;
    }
  }

  const productId = resolveProductIdFromUrl();
  if (!productId) {
    window.location.replace('/admin');
    return;
  }

  try {
    const [catalogData, product] = await Promise.all([
      api('/api/admin/catalog', { headers: authHeaders() }),
      api(`/api/admin/products/${productId}`, { headers: authHeaders() }),
    ]);
    catalog = catalogData;
    products = [product];
    editingIndex = 0;
    productIsNew = false;
    ensureSizes(product);
    render();
    return;
  } catch {
    const [catalogData, allProducts] = await Promise.all([
      api('/api/admin/catalog', { headers: authHeaders() }),
      api('/api/admin/products', { headers: authHeaders() }),
    ]);
    const product = allProducts.find((p) => p.id === productId);
    if (!product) {
      window.location.replace('/admin');
      return;
    }
    catalog = catalogData;
    products = [product];
    editingIndex = 0;
    productIsNew = false;
    ensureSizes(product);
    render();
  }
}

function addNewProduct() {
  window.location.href = '/admin/product/new';
}

function renderProductPage() {
  const el = $('#productEditorRoot');
  if (!el || editingIndex === null || !products[editingIndex]) return;
  el.innerHTML = renderProductEditor(editingIndex, products[editingIndex]);
  const p = products[editingIndex];
  document.title = `${p.name || 'Mahsulot'} — Lider Parfum`;
}

async function initProductPage() {
  showProductPageLoader();
  if (hasAdminToken()) {
    token = getAdminToken();
    showAdmin();
  }
  if (!(await checkAuth())) {
    showLogin();
    return;
  }
  showAdmin();
  await bootstrapProductPage();
}

function isNewProductPage() {
  return window.__ADMIN_PAGE === 'product' && location.pathname.endsWith('/new');
}

function editorTitle(p) {
  if (productIsNew) return 'Yangi mahsulot';
  return esc(p.name) || 'Mahsulot tahrirlash';
}

function renderProductEditor(pi, p) {
  const closeLabel = 'Yopish';
  return `
    <div class="admin-product" data-index="${pi}">
      <div class="editor-toolbar">
        <div class="editor-toolbar-head">
          <h2 id="editor-title-${pi}">${editorTitle(p)}</h2>
          <span class="editor-subtitle">Mahsulot tafsilotlarini yangilang</span>
        </div>
        <div class="editor-toolbar-actions">
          <button type="button" class="btn-danger btn-with-icon" data-action="delete-product" data-index="${pi}">${ICON_TRASH} O'chirish</button>
          <button type="button" class="btn-ghost" data-action="close-editor" data-index="${pi}">${closeLabel}</button>
        </div>
      </div>

      <div class="product-meta-edit">
        <div class="meta-field">
          <span class="field-label">Mahsulot nomi</span>
          <input
            type="text"
            class="editor-input"
            value="${esc(p.name)}"
            data-field="name"
            data-index="${pi}"
            placeholder="Mahsulot nomi"
          >
        </div>
        <div class="meta-field">
          <span class="field-label">Brend</span>
          ${metaPicker('brand', catalog.brands, p.brand || '', pi)}
        </div>
        <div class="meta-field">
          <span class="field-label">Kategoriya</span>
          ${metaPicker('category', catalog.categories, p.category || '', pi)}
        </div>
      </div>

      <div class="variants-section">
        ${sizesSection(pi, p)}

        <div class="section-title">Hidlar (variantlar)</div>
        <div class="bulk-add" data-index="${pi}">
          ${bulkSizeSelect(pi, p)}
          <input type="number" class="editor-input bulk-count" placeholder="10" data-bulk="count" data-index="${pi}" min="1" max="50" value="10" aria-label="Hidlar soni">
          <input type="text" class="editor-input bulk-prefix" placeholder="Hid/Rang nomi" data-bulk="prefix" data-index="${pi}" value="">
          <button type="button" class="btn-quick-add" data-action="bulk-add" data-index="${pi}">${ICON_BOLT} Tez qo'shish</button>
        </div>

        <div class="variants-grid">
          ${p.variants.map((v, vi) => variantRow(pi, vi, v, p)).join('')}
        </div>
        <button type="button" class="btn-add-variant" data-action="add-variant" data-index="${pi}">+ Variant qo'shish</button>
      </div>

      <div class="editor-footer">
        <button type="button" class="btn-ghost" data-action="close-editor" data-index="${pi}">Bekor qilish</button>
        <button type="button" class="btn-save btn-with-icon" data-action="save-product" data-index="${pi}">${ICON_SAVE} Saqlash</button>
      </div>
    </div>`;
}

function render() {
  products.forEach(ensureSizes);
  if (window.__ADMIN_PAGE === 'product') renderProductPage();
  else renderOverview();
}

function variantCardTitle(p, v) {
  const name = (p.name || '').trim();
  const scent = (v.scent || '').trim();
  const size = (v.size || '').trim();
  const parts = [];
  if (name) parts.push(name);
  if (scent) parts.push(scent);
  if (size) parts.push(size);
  if (parts.length) return parts.join(' ');
  return 'Variant';
}

function variantRow(pi, vi, v, p) {
  const img = v.image || PLACEHOLDER;
  const isExternal = /^https?:\/\//i.test(v.image || '');
  const hasImage = v.image && v.image !== PLACEHOLDER;
  const options = renderSizeSelect(p, {
    selected: v.size,
    emptyLabel: "O'lcham qo'shing",
    hiddenAttrs: { field: 'size', product: pi, variant: vi },
  });

  return `
    <div class="variant-card" data-product="${pi}" data-variant="${vi}">
      <div class="variant-card-header">
        <span class="variant-card-title">${esc(variantCardTitle(p, v))}</span>
        <button type="button" class="variant-card-close" data-action="delete-variant" data-product="${pi}" data-variant="${vi}" aria-label="O'chirish">×</button>
      </div>
      <div class="variant-card-body">
        <label class="variant-img-wrap" title="Galereyadan yuklash">
          ${hasImage
            ? `<img src="${imageUrl(img)}" alt="" onerror="imgFallback(event)">`
            : `<span class="variant-img-placeholder">${ICON_IMAGE}<span>RASM</span></span>`}
          <span class="variant-img-overlay">Galereya</span>
          <input type="file" accept="image/*" data-action="upload" data-product="${pi}" data-variant="${vi}">
        </label>
        <div class="variant-fields">
          <div class="variant-field">
            <span class="field-label">Hid nomi</span>
            <input
              type="text"
              class="editor-input"
              value="${esc(v.scent)}"
              placeholder="Masalan: EDT, Floral, Clear Men"
              data-field="scent"
              data-product="${pi}"
              data-variant="${vi}"
            >
          </div>
          <div class="variant-field">
            <span class="field-label">O'lcham</span>
            ${options}
          </div>
          <div class="img-url-row">
            <input
              type="url"
              class="editor-input"
              value="${isExternal ? esc(v.image) : ''}"
              placeholder="Rasm URL havolasi..."
              data-field="image-url"
              data-product="${pi}"
              data-variant="${vi}"
            >
          </div>
          <div class="img-upload-actions">
            <button type="button" class="btn-upload" data-action="upload-url" data-product="${pi}" data-variant="${vi}">${ICON_UPLOAD} Yuklash</button>
            <button type="button" class="btn-upload btn-camera" data-action="trigger-camera" data-product="${pi}" data-variant="${vi}">${ICON_CAMERA} Kameradan</button>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              class="variant-file-hidden"
              data-action="upload-camera"
              data-product="${pi}"
              data-variant="${vi}"
              tabindex="-1"
              aria-hidden="true"
            >
          </div>
        </div>
      </div>
    </div>
  `;
}

function esc(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function prepareProductForSave(p) {
  ensureSizes(p);
  syncVariantPrices(p);
  p.variants.forEach((v) => {
    v.id = makeVariantId(p.id, v.scent, v.size);
    v.price = getSizePrice(p, v.size);
  });
  return p;
}

async function saveCurrentProduct(message = 'Saqlandi') {
  const p = products[editingIndex];
  prepareProductForSave(p);

  if (productIsNew) {
    const saved = await api('/api/admin/products', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(p),
    });
    products[editingIndex] = saved;
    productIsNew = false;
    if (location.pathname.endsWith('/new')) {
      history.replaceState(null, '', `/admin/product?id=${saved.id}`);
    }
  } else {
    await api(`/api/admin/products/${p.id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(p),
    });
    products[editingIndex] = p;
  }

  if (message) showToast(message);
}

async function saveProducts(message = 'Saqlandi') {
  if (window.__ADMIN_PAGE === 'product' && editingIndex !== null) {
    await saveCurrentProduct(message);
    return;
  }

  products.forEach((p) => prepareProductForSave(p));

  await api('/api/admin/products', {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(products),
  });

  if (message) showToast(message);
}

function queueAutoSave(message = '', delay = 700) {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    persistProducts(message).catch((err) => showToast(err.message));
  }, delay);
}

async function persistProducts(message = '') {
  if (saveInFlight) {
    queuedSaveMessage = message;
    return;
  }
  saveInFlight = true;
  try {
    await saveProducts(message);
  } finally {
    saveInFlight = false;
    if (queuedSaveMessage !== null) {
      const nextMessage = queuedSaveMessage;
      queuedSaveMessage = null;
      queueAutoSave(nextMessage, 0);
    }
  }
}

async function uploadImage(file, pi, vi) {
  const form = new FormData();
  form.append('image', file);

  const res = await fetch(apiUrl('/api/admin/upload'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Yuklanmadi');

  products[pi].variants[vi].image = data.image;
  render();
  await persistProducts('Rasm yuklandi');
}

async function uploadImageFromUrl(url, pi, vi) {
  const data = await api('/api/admin/upload-url', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ url }),
  });

  products[pi].variants[vi].image = data.image;
  render();
  await persistProducts('Linkdan yuklandi');
}

function saveExternalUrl(pi, vi, url) {
  if (!url || !/^https?:\/\//i.test(url)) {
    showToast('To\'g\'ri link kiriting');
    return;
  }
  products[pi].variants[vi].image = url.trim();
  render();
  queueAutoSave('Link saqlandi', 0);
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
    setAdminToken(token);
    showAdmin();
    if (window.__ADMIN_PAGE === 'product') {
      await bootstrapProductPage();
    } else {
      await loadProducts();
    }
  } catch (err) {
    $('#loginError').textContent = err.message;
  }
});

$('#logoutBtn').addEventListener('click', () => {
  token = null;
  setAdminToken(null);
  showLogin();
});

$('#addProductBtn')?.addEventListener('click', addNewProduct);

document.addEventListener('input', (e) => {
  if (e.target.id !== 'productsPageSearch' && e.target.id !== 'adminSearch') return;
  filterSearch = e.target.value;
  syncProductSearchInputs();
  render();
});

document.addEventListener('input', (e) => {
  const { field, index, product, variant, sizeIndex } = e.target.dataset;
  if (!field) return;

  if (field === 'name') {
    products[Number(index)].name = e.target.value;
    const title = document.getElementById(`editor-title-${index}`);
    if (title && !productIsNew) {
      title.textContent = e.target.value || 'Mahsulot tahrirlash';
    }
    document.querySelectorAll(`.variant-card[data-product="${index}"]`).forEach((card) => {
      const vi = Number(card.dataset.variant);
      const v = products[Number(index)].variants[vi];
      const titleEl = card.querySelector('.variant-card-title');
      if (v && titleEl) titleEl.textContent = variantCardTitle(products[Number(index)], v);
    });
    queueAutoSave();
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
    queueAutoSave();
    return;
  }

  if (field === 'size-price') {
    products[pi].sizes[si].price = Number(e.target.value) || 0;
    syncVariantPrices(products[pi]);
    queueAutoSave();
    return;
  }

  if (field === 'scent') {
    products[pi].variants[vi].scent = e.target.value;
    const card = e.target.closest('.variant-card');
    const titleEl = card?.querySelector('.variant-card-title');
    if (titleEl) titleEl.textContent = variantCardTitle(products[pi], products[pi].variants[vi]);
    queueAutoSave();
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
  if (e.target.dataset.action === 'filter-toggle') {
    toggleDraftFilter(e.target.dataset.type, e.target.value, e.target.checked);
    return;
  }

  const { field, product, variant, action } = e.target.dataset;

  if (field === 'size-label' || field === 'size-price') {
    render();
    return;
  }

  if (action === 'upload' || action === 'upload-camera') {
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
  const card = e.target.closest('.variant-card');
  const titleEl = card?.querySelector('.variant-card-title');
  if (titleEl) titleEl.textContent = variantCardTitle(products[pi], products[pi].variants[vi]);
  queueAutoSave();
});

document.addEventListener('input', (e) => {
  if (e.target.dataset.action !== 'picker-search') return;
  const picker = e.target.closest('.meta-picker');
  if (picker) filterPickerOptions(picker, e.target.value);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeAllPickers();
    closeAllAppSelects();
    if (!$('#filterModal')?.classList.contains('hidden')) closeFilterModal(false);
  }
  if (e.key === 'Enter' && e.target.dataset.action === 'picker-add-input') {
    e.preventDefault();
    e.target.closest('.meta-picker')
      ?.querySelector('[data-action="confirm-add-meta"]')
      ?.click();
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.meta-picker')) closeAllPickers();

  const actionEl = e.target.closest('[data-action]');
  const action = actionEl?.dataset.action;

  if (action === 'toggle-picker') {
    e.stopPropagation();
    closeAllAppSelects();
    const picker = actionEl.closest('.meta-picker');
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
    const pi = Number(actionEl.dataset.index);
    const field = actionEl.dataset.field;
    products[pi][field] = actionEl.dataset.value;
    closeAllPickers();
    render();
    queueAutoSave();
    return;
  }

  if (action === 'show-add-meta') {
    e.stopPropagation();
    const picker = actionEl.closest('.meta-picker');
    const form = picker.querySelector('.meta-picker-add-form');
    form.classList.remove('hidden');
    actionEl.classList.add('hidden');
    requestAnimationFrame(() => picker.querySelector('.meta-picker-add-input')?.focus());
    return;
  }

  if (action === 'confirm-add-meta') {
    e.stopPropagation();
    const pi = Number(actionEl.dataset.index);
    const field = actionEl.dataset.field;
    const type = field === 'brand' ? 'brand' : 'category';
    const picker = actionEl.closest('.meta-picker');
    const input = picker.querySelector('.meta-picker-add-input');
    addCatalogItem(type, input?.value || '', pi).then((ok) => {
      if (!ok) return;
      closeAllPickers();
      render();
      persistProducts(`${type === 'brand' ? 'Brend' : 'Kategoriya'} qo'shildi`).catch((err) => showToast(err.message));
    });
    return;
  }

  if (!action) return;

  const pi = Number(actionEl.dataset.index ?? actionEl.dataset.product);
  const vi = Number(actionEl.dataset.variant);
  const si = Number(actionEl.dataset.sizeIndex);

  if (action === 'open-filter') {
    openFilterModal();
    return;
  }

  if (action === 'close-filter') {
    closeFilterModal(false);
    return;
  }

  if (action === 'apply-filter') {
    closeFilterModal(true);
    return;
  }

  if (action === 'clear-filter') {
    draftBrands = [];
    draftCategories = [];
    refreshFilterModalLists();
    return;
  }

  if (action === 'add-product-card') {
    addNewProduct();
    return;
  }

  if (action === 'close-editor') {
    if (window.__ADMIN_PAGE === 'product') {
      window.location.href = '/admin';
    } else {
      editingIndex = null;
      render();
    }
    return;
  }

  if (action === 'save-product') {
    clearTimeout(autoSaveTimer);
    const btn = actionEl;
    setButtonLoading(btn, true, 'Saqlanmoqda...');
    persistProducts('Saqlandi')
      .then(() => {
        if (window.__ADMIN_PAGE === 'product') {
          window.location.href = '/admin';
        }
      })
      .catch((err) => showToast(err.message))
      .finally(() => setButtonLoading(btn, false));
    return;
  }

  if (action === 'delete-product') {
    e.stopPropagation();
    confirmDialog({
      title: 'Mahsulotni o\'chirish',
      message: 'Mahsulotni o\'chirasizmi? Bu amalni ortga qaytarib bo\'lmaydi.',
      confirmLabel: 'O\'chirish',
      danger: true,
    }).then((ok) => {
      if (ok) deleteProductAt(pi);
    });
    return;
  }

  if (action === 'add-size') {
    const p = products[pi];
    ensureSizes(p);
    p.sizes.push({ label: '', price: 0 });
    render();
    queueAutoSave('O\'lcham qo\'shildi', 0);
  }

  if (action === 'delete-size') {
    const label = products[pi].sizes[si].label;
    if (label && products[pi].variants.some((v) => v.size === label)) {
      showToast('Bu o\'lcham ishlatilmoqda');
      return;
    }
    products[pi].sizes.splice(si, 1);
    render();
    queueAutoSave('O\'lcham o\'chirildi', 0);
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
    queueAutoSave('Variant qo\'shildi', 0);
  }

  if (action === 'bulk-add') {
    const panel = e.target.closest('.bulk-add');
    const size = panel.querySelector('input[data-bulk="size"]')?.value.trim();
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
    queueAutoSave(`${count} ta variant qo'shildi`, 0);
  }

  if (action === 'delete-variant') {
    products[pi].variants.splice(vi, 1);
    render();
    queueAutoSave('Variant o\'chirildi', 0);
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

  if (action === 'trigger-camera') {
    actionEl.closest('.variant-card')
      ?.querySelector('[data-action="upload-camera"]')
      ?.click();
    return;
  }

  if (action === 'save-url') {
    const input = getImageUrlInput(pi, vi);
    saveExternalUrl(pi, vi, input?.value.trim());
  }
});

(async () => {
  initAppSelectHandlers();
  if (window.__ADMIN_PAGE === 'product') {
    await initProductPage();
    return;
  }
  if (hasAdminToken()) {
    token = getAdminToken();
    showAdmin();
  }
  if (await checkAuth()) {
    showAdmin();
    await loadProducts();
  } else {
    showLogin();
  }
})();
