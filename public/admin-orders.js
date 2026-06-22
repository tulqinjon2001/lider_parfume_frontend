const TOKEN_KEY = 'lider_admin_token';

let token = localStorage.getItem(TOKEN_KEY);
let customers = [];
let selectedPhone = null;
let searchQuery = '';
let searchTimer = null;

const PAYMENT_LABELS = {
  naqd: 'Naqd',
  terminal: 'Terminal',
  transfer: "Kartaga o'tkazma",
};

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

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatPrice(n) {
  return Number(n).toLocaleString('uz-UZ');
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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

async function loadCustomers() {
  const params = new URLSearchParams();
  if (searchQuery.trim()) params.set('search', searchQuery.trim());
  const path = `/api/admin/orders/customers${params.toString() ? `?${params}` : ''}`;
  customers = await api(path, { headers: authHeaders() });
  renderCustomers();
}

function renderCustomers() {
  const el = $('#customersList');
  if (!customers.length) {
    el.innerHTML = `<p class="orders-empty">${searchQuery.trim() ? 'Mijoz topilmadi' : 'Hali buyurtmalar yo\'q'}</p>`;
    return;
  }

  el.innerHTML = customers.map((c) => `
    <button
      type="button"
      class="customer-card${selectedPhone === c.phone ? ' is-active' : ''}"
      data-phone="${esc(c.phone)}"
    >
      <div class="customer-card-top">
        <span class="customer-phone">${esc(c.phoneDisplay)}</span>
        <span class="customer-badge">${c.orderCount} ta buyurtma</span>
      </div>
      <div class="customer-name">${esc(c.name)}</div>
      <div class="customer-meta">
        <span>${formatPrice(c.totalSpent)} so'm</span>
        <span>${formatDate(c.lastOrderAt)}</span>
      </div>
    </button>
  `).join('');
}

async function loadCustomerDetail(phone) {
  selectedPhone = phone;
  renderCustomers();

  const detail = $('#orderDetail');
  detail.innerHTML = '<p class="orders-empty">Yuklanmoqda...</p>';

  try {
    const history = await api(`/api/admin/orders/history?phone=${encodeURIComponent(phone)}`, {
      headers: authHeaders(),
    });
    renderDetail(history);
  } catch (err) {
    detail.innerHTML = `<p class="orders-empty">${esc(err.message)}</p>`;
  }
}

function renderDetail(history) {
  const detail = $('#orderDetail');

  const productRows = history.products.map((p) => {
    const variant = [p.scent, p.size].filter(Boolean).join(' · ');
    return `
      <tr>
        <td>
          <strong>${esc(p.name)}</strong>
          ${variant ? `<div class="orders-sub">${esc(variant)}</div>` : ''}
        </td>
        <td class="orders-num">${p.orderCount} marta</td>
        <td class="orders-num">${p.totalQty} ta</td>
        <td class="orders-num">${formatPrice(p.totalSpent)} so'm</td>
      </tr>
    `;
  }).join('');

  const orderCards = history.orders.map((order) => {
    const items = order.items.map((item) => {
      const variant = [item.scent, item.size].filter(Boolean).join(' · ');
      return `
        <li>
          <span>${esc(item.name)}${variant ? ` <span class="orders-sub">(${esc(variant)})</span>` : ''}</span>
          <span>${item.qty} × ${formatPrice(item.price)} so'm</span>
        </li>
      `;
    }).join('');

    const [address] = String(order.location).split(' | ');

    return `
      <article class="order-card">
        <header class="order-card-head">
          <div>
            <strong>#${order.id}</strong>
            <span class="orders-sub">${formatDate(order.createdAt)}</span>
          </div>
          <div class="order-card-total">${formatPrice(order.total)} so'm</div>
        </header>
        <div class="order-card-meta">
          <span>${esc(PAYMENT_LABELS[order.paymentType] || order.paymentType)}</span>
          ${address ? `<span>${esc(address)}</span>` : ''}
        </div>
        ${order.note ? `<p class="order-note">${esc(order.note)}</p>` : ''}
        <ul class="order-items">${items}</ul>
      </article>
    `;
  }).join('');

  detail.innerHTML = `
    <div class="orders-detail-head">
      <div>
        <h2>${esc(history.phoneDisplay)}</h2>
        <p class="orders-sub">${esc(history.name)}</p>
      </div>
      <div class="orders-stats">
        <div class="orders-stat">
          <span class="orders-stat-val">${history.orderCount}</span>
          <span class="orders-stat-label">Buyurtma</span>
        </div>
        <div class="orders-stat">
          <span class="orders-stat-val">${formatPrice(history.totalSpent)}</span>
          <span class="orders-stat-label">Jami (so'm)</span>
        </div>
        <div class="orders-stat">
          <span class="orders-stat-val">${history.products.length}</span>
          <span class="orders-stat-label">Turli mahsulot</span>
        </div>
      </div>
    </div>

    <section class="orders-section">
      <h3>Mahsulotlar bo'yicha statistika</h3>
      ${history.products.length ? `
        <div class="orders-table-wrap">
          <table class="orders-table">
            <thead>
              <tr>
                <th>Mahsulot</th>
                <th>Buyurtmalar</th>
                <th>Jami miqdor</th>
                <th>Jami summa</th>
              </tr>
            </thead>
            <tbody>${productRows}</tbody>
          </table>
        </div>
      ` : '<p class="orders-empty">Mahsulotlar yo\'q</p>'}
    </section>

    <section class="orders-section">
      <h3>Barcha buyurtmalar</h3>
      <div class="orders-list">${orderCards}</div>
    </section>
  `;
}

function bindEvents() {
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = $('#password').value;
    const errEl = $('#loginError');
    errEl.textContent = '';
    try {
      const { token: t } = await api('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      token = t;
      localStorage.setItem(TOKEN_KEY, token);
      $('#loginScreen').classList.add('hidden');
      $('#ordersApp').classList.remove('hidden');
      await loadCustomers();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });

  $('#logoutBtn').addEventListener('click', () => {
    token = null;
    localStorage.removeItem(TOKEN_KEY);
    $('#ordersApp').classList.add('hidden');
    $('#loginScreen').classList.remove('hidden');
    $('#password').value = '';
  });

  $('#phoneSearch').addEventListener('input', (e) => {
    searchQuery = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      selectedPhone = null;
      $('#orderDetail').innerHTML = `
        <div class="orders-detail-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M7 4h10l2 4H5l2-4z"/><path d="M5 10h14l-1 10H6L5 10z"/>
          </svg>
          <p>Mijozni tanlang yoki telefon raqamini qidiring</p>
        </div>
      `;
      loadCustomers().catch((err) => showToast(err.message));
    }, 300);
  });

  $('#customersList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-phone]');
    if (!btn) return;
    loadCustomerDetail(btn.dataset.phone).catch((err) => showToast(err.message));
  });
}

async function init() {
  bindEvents();
  if (await checkAuth()) {
    $('#loginScreen').classList.add('hidden');
    $('#ordersApp').classList.remove('hidden');
    try {
      await loadCustomers();
    } catch (err) {
      showToast(err.message);
    }
  }
}

init();
