const ADMIN_TOKEN_KEY = 'lider_admin_token';

function apiUrl(path) {
  const base = (window.API_BASE || '').replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function getAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

function setAdminToken(value) {
  if (value) localStorage.setItem(ADMIN_TOKEN_KEY, value);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
}

function hasAdminToken() {
  return Boolean(getAdminToken());
}

async function verifyAdminSession(token) {
  if (!token) return false;
  try {
    const res = await fetch(apiUrl('/api/admin/verify'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setAdminToken(null);
      return false;
    }
    if (!res.ok) return true;
    return !!data.ok;
  } catch {
    return true;
  }
}

function imageUrl(path) {
  if (!path) return '/images/placeholder.svg';
  if (/^https?:\/\//i.test(path)) return path;
  if (path.includes('placeholder.svg')) {
    return path.startsWith('/') ? path : `/${path}`;
  }
  return apiUrl(path.startsWith('/') ? path : `/${path}`);
}

function imgFallback(e) {
  e.target.onerror = null;
  e.target.src = '/images/placeholder.svg';
}

function orderedCatalogItems(items, extraValue) {
  const list = Array.isArray(items) ? [...items] : [];
  const extra = extraValue != null && extraValue !== '' ? String(extraValue) : '';
  if (extra && !list.includes(extra)) list.push(extra);
  return list;
}

function orderedSizeLabels(product, allowedSet) {
  const sizes = product?.sizes;
  if (Array.isArray(sizes) && sizes.length) {
    const labels = sizes.map((s) => s.label).filter(Boolean);
    if (allowedSet) return labels.filter((label) => allowedSet.has(label));
    return labels;
  }

  const labels = [...new Set((product?.variants || []).map((v) => v.size).filter(Boolean))];
  if (allowedSet) return labels.filter((label) => allowedSet.has(label));
  return labels;
}

function formatUzs(price) {
  return `${Number(price || 0).toLocaleString('uz-UZ')} so'm`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function dataAttrs(obj) {
  return Object.entries(obj || {})
    .filter(([, v]) => v != null && v !== false)
    .map(([k, v]) => ` data-${k}="${escapeHtml(v)}"`)
    .join('');
}

function closeAllAppSelects() {
  document.querySelectorAll('.app-select').forEach((el) => {
    el.classList.remove('is-open');
    el.querySelector('.app-select-trigger')?.setAttribute('aria-expanded', 'false');
    el.querySelector('.app-select-panel')?.classList.add('hidden');
  });
}

function buildAppSelect({
  items = [],
  value = '',
  placeholder = '— Tanlang —',
  disabled = false,
  className = '',
  hiddenAttrs = {},
} = {}) {
  const selectedItem = items.find((item) => item.value === value);
  const display = selectedItem ? selectedItem.label : placeholder;
  const isPlaceholder = !selectedItem;

  const options = items.length
    ? items.map((item) => `
      <button
        type="button"
        class="app-select-option${item.value === value ? ' is-selected' : ''}"
        data-action="pick-app-select"
        data-value="${escapeHtml(item.value)}"
      >${escapeHtml(item.label)}</button>
    `).join('')
    : `<p class="app-select-empty">${escapeHtml(placeholder)}</p>`;

  return `
    <div class="app-select${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}">
      <button
        type="button"
        class="app-select-trigger"
        data-action="toggle-app-select"
        aria-haspopup="listbox"
        aria-expanded="false"
        ${disabled ? 'disabled' : ''}
      >
        <span class="app-select-value${isPlaceholder ? ' is-placeholder' : ''}">${escapeHtml(display)}</span>
        <span class="app-select-chevron" aria-hidden="true"></span>
      </button>
      <div class="app-select-panel hidden" role="listbox">
        <div class="app-select-options">${options}</div>
      </div>
      <input type="hidden"${dataAttrs(hiddenAttrs)} value="${escapeHtml(value)}">
    </div>
  `;
}

function initAppSelectHandlers() {
  if (window.__appSelectBound) return;
  window.__appSelectBound = true;

  document.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');

    if (actionEl?.dataset.action === 'toggle-app-select') {
      e.stopPropagation();
      const select = actionEl.closest('.app-select');
      if (!select || select.classList.contains('is-disabled')) return;
      if (typeof closeAllPickers === 'function') closeAllPickers();
      const wasOpen = select.classList.contains('is-open');
      closeAllAppSelects();
      if (!wasOpen) {
        select.classList.add('is-open');
        actionEl.setAttribute('aria-expanded', 'true');
        select.querySelector('.app-select-panel')?.classList.remove('hidden');
      }
      return;
    }

    if (actionEl?.dataset.action === 'pick-app-select') {
      e.stopPropagation();
      const select = actionEl.closest('.app-select');
      if (!select || select.classList.contains('is-disabled')) return;
      const hidden = select.querySelector('input[type="hidden"]');
      const nextValue = actionEl.dataset.value;
      hidden.value = nextValue;

      const valueEl = select.querySelector('.app-select-value');
      valueEl.textContent = actionEl.textContent.trim();
      valueEl.classList.toggle('is-placeholder', !nextValue);

      select.querySelectorAll('.app-select-option').forEach((btn) => {
        btn.classList.toggle('is-selected', btn.dataset.value === nextValue);
      });

      closeAllAppSelects();
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

    if (!e.target.closest('.app-select')) closeAllAppSelects();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllAppSelects();
  });
}
