const TOKEN_KEY = 'lider_admin_token';

let catalog = { brands: [], categories: [] };
let products = [];
let token = getAdminToken();
let addModalType = null;
let catalogSearch = '';
let pointerDrag = null;

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

async function api(path, options = {}) {
  const url = path.startsWith('http') ? path : apiUrl(path);
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Xatolik');
  return data;
}

function filterItems(items) {
  const q = catalogSearch.trim().toLowerCase();
  if (!q) return items;
  return items.filter((name) => name.toLowerCase().includes(q));
}

async function checkAuth() {
  token = getAdminToken();
  const ok = await verifyAdminSession(token);
  if (!ok) token = null;
  return ok;
}

async function loadData() {
  [catalog, products] = await Promise.all([
    api('/api/admin/catalog', { headers: authHeaders() }),
    api('/api/admin/products', { headers: authHeaders() }),
  ]);
  render();
}

function esc(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function canReorderCatalog() {
  return !catalogSearch.trim();
}

function catalogCol(type, items, label) {
  const filtered = filterItems(items);
  const reorderable = canReorderCatalog();
  const rows = filtered.map((name) => {
    const i = items.indexOf(name);
    return `
    <div class="option-row${reorderable ? '' : ' option-row--static'}" data-index="${i}">
      <span class="option-drag-handle" title="Tartibni o'zgartirish" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="7" r="1.5"/><circle cx="15" cy="7" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="17" r="1.5"/><circle cx="15" cy="17" r="1.5"/></svg>
      </span>
      <input
        type="text"
        value="${esc(name)}"
        data-field="edit-${type}"
        data-index="${i}"
        placeholder="${label} nomi"
      >
      <button type="button" class="btn-danger btn-small" data-action="delete-${type}" data-index="${i}">×</button>
    </div>`;
  }).join('');

  return `
    <div class="catalog-col">
      <div class="variants-title">${label}lar</div>
      <div class="options-list" data-list-type="${type}">${rows || `<p class="sizes-empty">${label} yo'q</p>`}</div>
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
  $('#catalogContent').className = 'catalog-page-grid';
  bindCatalogDrag();
}

function calcDropIndex(fromIdx, overIdx, insertBefore) {
  let toIdx = insertBefore ? overIdx : overIdx + 1;
  if (fromIdx < toIdx) toIdx -= 1;
  return toIdx;
}

function clearDragOverMarks() {
  document.querySelectorAll('.option-row.drag-over-top, .option-row.drag-over-bottom').forEach((el) => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });
}

function markDropTarget(row, clientY) {
  if (!row) return null;
  clearDragOverMarks();
  const rect = row.getBoundingClientRect();
  const insertBefore = clientY < rect.top + rect.height / 2;
  row.classList.add(insertBefore ? 'drag-over-top' : 'drag-over-bottom');
  return { row, insertBefore };
}

async function reorderCatalogItem(type, fromIdx, toIdx) {
  if (fromIdx === toIdx) return;
  const key = type === 'brand' ? 'brands' : 'categories';
  const prev = [...catalog[key]];
  const [item] = catalog[key].splice(fromIdx, 1);
  catalog[key].splice(toIdx, 0, item);
  render();

  try {
    await saveCatalog();
    showToast('Tartib yangilandi');
  } catch (err) {
    catalog[key] = prev;
    render();
    showToast(err.message);
  }
}

function bindCatalogDrag() {
  if (!canReorderCatalog()) return;

  document.querySelectorAll('.options-list[data-list-type]').forEach((listEl) => {
    const type = listEl.dataset.listType;

    listEl.querySelectorAll('.option-row:not(.option-row--static) .option-drag-handle').forEach((handle) => {
      const row = handle.closest('.option-row');

      const startDrag = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pointerDrag = {
          type,
          fromIdx: Number(row.dataset.index),
          row,
          listEl,
          pointerId: e.pointerId,
          target: null,
        };
        row.classList.add('is-dragging');
        handle.setPointerCapture(e.pointerId);
        e.preventDefault();
      };

      const moveDrag = (e) => {
        if (!pointerDrag || pointerDrag.pointerId !== e.pointerId) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const overRow = el?.closest('.option-row');
        if (overRow && overRow.closest('.options-list') === pointerDrag.listEl) {
          pointerDrag.target = markDropTarget(overRow, e.clientY);
        } else {
          clearDragOverMarks();
          pointerDrag.target = null;
        }
      };

      const finishDrag = (e) => {
        if (!pointerDrag || pointerDrag.pointerId !== e.pointerId) return;
        const { type: dragType, fromIdx, target } = pointerDrag;
        pointerDrag.row.classList.remove('is-dragging');
        clearDragOverMarks();
        pointerDrag = null;

        if (target?.row) {
          const overIdx = Number(target.row.dataset.index);
          const toIdx = calcDropIndex(fromIdx, overIdx, target.insertBefore);
          reorderCatalogItem(dragType, fromIdx, toIdx).catch((err) => showToast(err.message));
        }
      };

      handle.addEventListener('pointerdown', startDrag);
      handle.addEventListener('pointermove', moveDrag);
      handle.addEventListener('pointerup', finishDrag);
      handle.addEventListener('pointercancel', finishDrag);
    });
  });
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
    setAdminToken(token);
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
  setAdminToken(null);
  showLogin();
});

const catalogSearchEl = document.getElementById('catalogSearch');
if (catalogSearchEl) {
  catalogSearchEl.addEventListener('input', (e) => {
    catalogSearch = e.target.value;
    render();
  });
}

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
  if (hasAdminToken()) {
    token = getAdminToken();
    hideBootLoader();
    showApp();
  }
  if (await checkAuth()) {
    hideBootLoader();
    showApp();
    $('#catalogContent').innerHTML = sectionLoaderHtml('Brend va kategoriyalar yuklanmoqda...');
    try {
      await loadData();
    } catch (err) {
      showToast(err.message || 'Yuklanmadi');
    }
  } else {
    hideBootLoader();
    showLogin();
  }
})();
