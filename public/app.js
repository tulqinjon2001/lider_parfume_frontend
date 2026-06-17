const PLACEHOLDER = 'images/placeholder.svg';
const CART_STORAGE_KEY = 'lider_parfum_cart';

let PRODUCTS = [];
let CATALOG = { brands: [], categories: [] };
let filterBrand = '';
let filterCategory = '';
let filterSearch = '';
const cart = {};
const qtyState = {};
const selectedVariant = {};

const pickerState = {
  productId: null,
  scent: null,
  size: null,
  qty: 1,
  scentExpanded: false,
};

const SCENT_THUMB_LIMIT = 3;

const SIZE_CHECK_SVG = `<svg class="size-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>`;

const $ = (sel) => document.querySelector(sel);

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function phoneDigitsOnly(value) {
  return value.replace(/\D/g, '');
}

function normalizeUzPhoneDigits(input) {
  let d = phoneDigitsOnly(input);
  if (d.startsWith('998')) {
    // ok
  } else if (d.startsWith('8') && d.length <= 10) {
    d = `998${d.slice(1)}`;
  } else if (d.length <= 9) {
    d = `998${d}`;
  }
  return d.slice(0, 12);
}

function formatUzPhone(digits) {
  const d = digits.slice(0, 12);
  if (!d) return '';
  if (d.length <= 3) return `+${d}`;
  let out = `+${d.slice(0, 3)} ${d.slice(3, 5)}`;
  if (d.length <= 5) return out;
  out += ` ${d.slice(5, 8)}`;
  if (d.length <= 8) return out;
  out += ` ${d.slice(8, 10)}`;
  if (d.length <= 10) return out;
  return `${out} ${d.slice(10, 12)}`;
}

function isValidUzPhone(digits) {
  return digits.length === 12 && digits.startsWith('998');
}

function getUzPhoneDigits() {
  return normalizeUzPhoneDigits($('#customerPhone').value);
}

function setPhoneValidity() {
  const input = $('#customerPhone');
  const digits = getUzPhoneDigits();
  if (!digits.length) {
    input.setCustomValidity('');
    return;
  }
  if (digits.length < 12) {
    input.setCustomValidity('To\'liq raqam kiriting: +998 XX XXX XX XX');
    return;
  }
  input.setCustomValidity('');
}

function handlePhoneInput(e) {
  const input = e.target;
  const digits = normalizeUzPhoneDigits(input.value);
  input.value = formatUzPhone(digits);
  setPhoneValidity();
}

function getVariant(productId, variantId) {
  const product = PRODUCTS.find((p) => p.id === productId);
  return product?.variants.find((v) => v.id === variantId);
}

function getSelectedVariant(product) {
  return product.variants.find((v) => v.id === selectedVariant[product.id]) || product.variants[0];
}

function getUniqueScents(product) {
  return [...new Set(product.variants.map((v) => v.scent))];
}

function getPriceForSize(product, size) {
  const fromSizes = product.sizes?.find((s) => s.label === size);
  if (fromSizes) return fromSizes.price;
  const variant = product.variants.find((v) => v.size === size);
  return variant?.price ?? 0;
}

function getUniqueSizes(product) {
  if (product.sizes?.length) {
    return product.sizes.map((s) => s.label);
  }
  return [...new Set(product.variants.map((v) => v.size))];
}

function needsPicker(product) {
  return getUniqueScents(product).length > 1 && getUniqueSizes(product).length > 1;
}

function getSizesForScent(product, scent) {
  return [...new Set(product.variants.filter((v) => v.scent === scent).map((v) => v.size))];
}

function getScentsForSize(product, size) {
  return [...new Set(product.variants.filter((v) => v.size === size).map((v) => v.scent))];
}

function getVariantsForSize(product, size) {
  return product.variants.filter((v) => v.size === size);
}

function getImageForScent(product, scent, size) {
  const variant = size
    ? product.variants.find((v) => v.scent === scent && v.size === size)
    : product.variants.find((v) => v.scent === scent);
  return variant?.image || PLACEHOLDER;
}

function renderScentGrid(product, size, selectedScent) {
  const variants = getVariantsForSize(product, size);
  const extra = pickerState.scentExpanded ? 0 : Math.max(0, variants.length - SCENT_THUMB_LIMIT);
  const shown = extra > 0 ? variants.slice(0, SCENT_THUMB_LIMIT) : variants;

  let html = shown.map((v) => `
    <button type="button" class="scent-option ${v.scent === selectedScent ? 'selected' : ''}" data-scent="${v.scent}">
      <img src="${v.image}" alt="${v.scent}" onerror="imgFallback(event)">
    </button>
  `).join('');

  if (extra > 0) {
    html += `<button type="button" class="scent-more" data-action="expand-scents">+${extra}</button>`;
  }

  $('#scentGrid').innerHTML = html;
}

function renderSizeOptions(product, selectedSize) {
  const sizes = getUniqueSizes(product);
  $('#sizeOptions').innerHTML = sizes.map((s) => {
    const selected = s === selectedSize;
    const price = formatPrice(getPriceForSize(product, s));
    return `
      <button type="button" class="size-option ${selected ? 'selected' : ''}" data-size="${s}">
        <span class="size-option-label">${s} — ${price}</span>
        ${selected ? SIZE_CHECK_SVG : ''}
      </button>
    `;
  }).join('');
}

function resolveVariant(product, scent, size) {
  return (
    product.variants.find((v) => v.scent === scent && v.size === size) ||
    product.variants.find((v) => v.scent === scent) ||
    product.variants.find((v) => v.size === size) ||
    product.variants[0]
  );
}

function getMinPrice(product) {
  if (product.sizes?.length) {
    return Math.min(...product.sizes.map((s) => s.price));
  }
  return Math.min(...product.variants.map((v) => v.price));
}

function productMeta(p) {
  const parts = [p.brand, p.category].filter(Boolean);
  if (!parts.length) return '';
  return `<div class="product-meta">${parts.join(' · ')}</div>`;
}

function filteredProducts() {
  const q = filterSearch.trim().toLowerCase();
  return PRODUCTS.filter((p) => {
    if (filterBrand && p.brand !== filterBrand) return false;
    if (filterCategory && p.category !== filterCategory) return false;
    if (q) {
      const haystack = [p.name, p.brand, p.category].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

function closeFilterDropdowns() {
  document.querySelectorAll('.filter-dropdown.is-open').forEach((wrap) => {
    wrap.classList.remove('is-open');
    const btn = wrap.querySelector('.filter-dropdown-btn');
    const menu = wrap.querySelector('.filter-dropdown-menu');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (menu) menu.hidden = true;
  });
}

function buildFilterDropdown(id, placeholder, currentValue, options) {
  const label = currentValue || placeholder;
  const items = [{ value: '', label: placeholder }, ...options.map((o) => ({ value: o, label: o }))];
  const menuItems = items.map((item) => `
    <button
      type="button"
      class="filter-dropdown-item${currentValue === item.value ? ' is-selected' : ''}"
      data-value="${escapeHtml(item.value)}"
      role="option"
      aria-selected="${currentValue === item.value}"
    >
      <span>${escapeHtml(item.label)}</span>
      <svg class="filter-dropdown-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <path d="M20 6L9 17l-5-5"/>
      </svg>
    </button>
  `).join('');

  return `
    <div class="filter-dropdown" data-filter-id="${id}">
      <button type="button" class="filter-dropdown-btn" aria-haspopup="listbox" aria-expanded="false">
        <span class="filter-dropdown-label">${escapeHtml(label)}</span>
        <svg class="filter-dropdown-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      <div class="filter-dropdown-menu" role="listbox" hidden>
        ${menuItems}
      </div>
    </div>
  `;
}

function bindFilterDropdownEvents() {
  const filters = $('#filters');
  if (filters._dropdownBound) return;
  filters._dropdownBound = true;

  filters.addEventListener('click', (e) => {
    if (e.target.closest('.filter-dropdown-menu')) {
      e.stopPropagation();
    }

    const btn = e.target.closest('.filter-dropdown-btn');
    if (btn) {
      e.stopPropagation();
      const wrap = btn.closest('.filter-dropdown');
      const menu = wrap.querySelector('.filter-dropdown-menu');
      const isOpen = wrap.classList.contains('is-open');
      closeFilterDropdowns();
      if (!isOpen) {
        wrap.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
        menu.hidden = false;
      }
      return;
    }

    const item = e.target.closest('.filter-dropdown-item');
    if (!item) return;

    const wrap = item.closest('.filter-dropdown');
    const filterId = wrap.dataset.filterId;
    const value = item.dataset.value;
    const placeholder = filterId === 'filterBrand' ? 'Barcha brendlar' : 'Barcha kategoriyalar';

    if (filterId === 'filterBrand') filterBrand = value;
    else filterCategory = value;

    wrap.querySelector('.filter-dropdown-label').textContent = value || placeholder;
    wrap.querySelectorAll('.filter-dropdown-item').forEach((el) => {
      const selected = el.dataset.value === value;
      el.classList.toggle('is-selected', selected);
      el.setAttribute('aria-selected', selected);
    });

    closeFilterDropdowns();
    renderProducts();
  });

  document.addEventListener('click', closeFilterDropdowns);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeFilterDropdowns();
  });
}

function renderFilters() {
  $('#filters').innerHTML = `
    <div class="search-box">
      <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/>
        <line x1="16.5" y1="16.5" x2="21" y2="21"/>
      </svg>
      <input type="search" id="searchInput" class="search-input" placeholder="Mahsulotlarni qidirish..." value="${filterSearch}">
    </div>
    <div class="toolbar-filters">
      ${buildFilterDropdown('filterBrand', 'Barcha brendlar', filterBrand, CATALOG.brands)}
      ${buildFilterDropdown('filterCategory', 'Barcha kategoriyalar', filterCategory, CATALOG.categories)}
    </div>
  `;

  $('#searchInput').addEventListener('input', (e) => {
    filterSearch = e.target.value;
    renderProducts();
  });

  bindFilterDropdownEvents();
}

function formatPrice(n) {
  return n.toLocaleString('uz-UZ') + " so'm";
}

function imgFallback(e) {
  e.target.onerror = null;
  e.target.src = PLACEHOLDER;
}

function renderProducts() {
  const container = $('#products');
  const list = filteredProducts();

  if (!list.length) {
    container.innerHTML = '<div class="cart-empty">Mahsulotlar yo\'q</div>';
    return;
  }

  container.innerHTML = list.map((p) => {
    if (!p.variants?.length) return '';

    const minPrice = getMinPrice(p);
    const preview = p.variants[0];

    return `
      <div class="product-card pickable" data-product-id="${p.id}" data-action="open-picker">
        ${productMeta(p)}
        <div class="product-name">${p.name}</div>
        <div class="product-preview">
          <img
            src="${preview.image}"
            alt="${p.name}"
            loading="lazy"
            onerror="imgFallback(event)"
          >
        </div>
        <div class="product-price-range">dan <span>${formatPrice(minPrice)}</span></div>
        <button type="button" class="pick-btn" data-product-id="${p.id}" data-action="open-picker">Tanlash</button>
      </div>
    `;
  }).join('');
}

function selectVariant(productId, variantId) {
  const product = PRODUCTS.find((p) => p.id === productId);
  const variant = getVariant(productId, variantId);
  if (!product || !variant) return;

  selectedVariant[productId] = variantId;

  const preview = $(`#preview-${productId}`);
  preview.src = variant.image;
  preview.onerror = imgFallback;

  $(`#price-${productId}`).textContent = formatPrice(variant.price);

  document.querySelectorAll(`.variant-thumb[data-product-id="${productId}"]`).forEach((el) => {
    el.classList.toggle('selected', el.dataset.variantId === variantId);
  });
}

function formatPickerLabel(scent, size) {
  return [scent, size].filter(Boolean).join(' · ');
}

function formatModalTitle(product, scent) {
  return scent ? `${product.name} — ${scent}` : product.name;
}

function syncModalQtyInput() {
  $('#modalQty').value = pickerState.qty;
}

function commitModalQty() {
  const input = $('#modalQty');
  const raw = input.value.trim();
  if (!raw) {
    pickerState.qty = 1;
    input.value = '1';
    return;
  }
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    pickerState.qty = 1;
    input.value = '1';
    return;
  }
  pickerState.qty = n;
  input.value = String(n);
}

function updatePickerUI() {
  const product = PRODUCTS.find((p) => p.id === pickerState.productId);
  if (!product) return;

  const { scent, size } = pickerState;
  const price = getPriceForSize(product, size);
  const image = getImageForScent(product, scent, size);

  $('#modalPreview').src = image;
  $('#modalPreview').onerror = imgFallback;
  const meta = [product.brand, product.category].filter(Boolean).join(' · ');
  $('#modalBrand').textContent = meta || '';
  $('#modalTitle').textContent = formatModalTitle(product, scent);
  $('#modalPrice').textContent = formatPrice(price);
  syncModalQtyInput();
  const summary = formatPickerLabel(scent, size);
  $('#pickerSummary').innerHTML = summary
    ? `Tanlangan: <strong>${summary}</strong>`
    : '';
  $('#modalDescription').textContent = product.description || '';
  $('#modalDescription').hidden = true;
  $('#modalDescToggle').setAttribute('aria-expanded', 'false');
  $('#modalDescToggle').classList.remove('open');

  renderScentGrid(product, size, scent);
  renderSizeOptions(product, size);
}

function openProductPicker(productId) {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product?.variants?.length) return;

  if (product.variants.length === 1) {
    addToCartFromVariant(product, product.variants[0], 1);
    renderCart();
    showToast('Savatga qo\'shildi');
    return;
  }

  const firstVariant = product.variants[0];

  pickerState.productId = productId;
  pickerState.size = firstVariant.size;
  pickerState.scent = getScentsForSize(product, firstVariant.size).find(Boolean) ?? firstVariant.scent ?? '';
  pickerState.qty = 1;
  pickerState.scentExpanded = false;

  updatePickerUI();

  $('#productModal').classList.add('open');
  $('#productModal').setAttribute('aria-hidden', 'false');
  $('#overlay').classList.add('open');
}

function closeProductPicker() {
  $('#productModal').classList.remove('open');
  $('#productModal').setAttribute('aria-hidden', 'true');

  if (!$('#cartPanel').classList.contains('open')) {
    $('#overlay').classList.remove('open');
  }

  pickerState.productId = null;
}

function updateQtyUI(productId) {
  $(`#qty-${productId}`).textContent = qtyState[productId];
  const btn = document.querySelector(`.add-btn[data-product-id="${productId}"]`);
  if (btn) btn.textContent = `Savatga (${qtyState[productId]})`;
}

function cartCount() {
  return Object.values(cart).reduce((s, i) => s + i.qty, 0);
}

function cartTotal() {
  return Object.values(cart).reduce((s, i) => s + i.qty * i.price, 0);
}

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return;
    const items = JSON.parse(raw);
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      if (item?.variantId && item.qty > 0) {
        cart[item.variantId] = item;
      }
    });
  } catch {
    localStorage.removeItem(CART_STORAGE_KEY);
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(Object.values(cart)));
  } catch {
    // localStorage band yoki o'chirilgan
  }
}

function clearCart() {
  Object.keys(cart).forEach((k) => delete cart[k]);
  saveCart();
  renderCart();
}

function renderCart() {
  $('#cartCount').textContent = cartCount();
  $('#cartTotal').textContent = formatPrice(cartTotal());

  const items = Object.values(cart);
  const container = $('#cartItems');

  if (!items.length) {
    container.innerHTML = '<div class="cart-empty">Savat bo\'sh</div>';
    saveCart();
    return;
  }

  container.innerHTML = items.map((item) => `
    <div class="cart-item" data-variant-id="${item.variantId}">
      <img class="cart-item-img" src="${item.image}" alt="" onerror="imgFallback(event)">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-meta">${item.scent} · ${item.size}</div>
        <div class="cart-item-price">${formatPrice(item.price)}</div>
      </div>
      <div class="cart-item-qty">
        <button class="cart-minus" data-variant-id="${item.variantId}">−</button>
        <span>${item.qty}</span>
        <button class="cart-plus" data-variant-id="${item.variantId}">+</button>
      </div>
    </div>
  `).join('');

  saveCart();
}

function addToCartFromVariant(product, variant, qty) {
  const key = `${product.id}-${variant.scent}-${variant.size}`;

  if (cart[key]) {
    cart[key].qty += qty;
  } else {
    cart[key] = {
      variantId: key,
      productId: product.id,
      name: product.name,
      scent: variant.scent,
      size: variant.size,
      price: getPriceForSize(product, variant.size),
      image: variant.image,
      qty,
    };
  }
}

function addToCart(productId) {
  const qty = qtyState[productId];
  if (!qty) return;

  const product = PRODUCTS.find((p) => p.id === productId);
  const variant = getSelectedVariant(product);

  addToCartFromVariant(product, variant, qty);

  qtyState[productId] = 1;
  updateQtyUI(productId);
  renderCart();
  showToast('Savatga qo\'shildi');
}

function addFromPicker() {
  const product = PRODUCTS.find((p) => p.id === pickerState.productId);
  if (!product) return;

  commitModalQty();

  const variant = resolveVariant(product, pickerState.scent, pickerState.size);
  const price = getPriceForSize(product, pickerState.size);

  const cartVariant = {
    ...variant,
    price,
    image: getImageForScent(product, pickerState.scent, pickerState.size),
    scent: pickerState.scent,
    size: pickerState.size,
  };

  addToCartFromVariant(product, cartVariant, pickerState.qty);
  renderCart();
  animateFlyToCart(cartVariant.image, $('#modalPreview'));
}

function showToast(msg) {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

function animateFlyToCart(imageSrc, sourceEl) {
  if (!sourceEl) return;

  const cartBtn = $('#cartBtn');
  const sourceRect = sourceEl.getBoundingClientRect();
  const cartRect = cartBtn.getBoundingClientRect();

  const startX = sourceRect.left + sourceRect.width / 2;
  const startY = sourceRect.top + sourceRect.height / 2;
  const endX = cartRect.left + cartRect.width / 2;
  const endY = cartRect.top + cartRect.height / 2;

  const flyer = document.createElement('img');
  flyer.className = 'cart-flyer';
  flyer.src = imageSrc || PLACEHOLDER;
  flyer.alt = '';
  flyer.style.setProperty('--fly-dx', `${endX - startX}px`);
  flyer.style.setProperty('--fly-dy', `${endY - startY}px`);
  flyer.style.left = `${startX}px`;
  flyer.style.top = `${startY}px`;
  document.body.appendChild(flyer);

  let finished = false;
  const bumpCart = () => {
    if (finished) return;
    finished = true;
    flyer.remove();
    cartBtn.classList.add('cart-bump');
    $('#cartCount').classList.add('count-bump');
    setTimeout(() => {
      cartBtn.classList.remove('cart-bump');
      $('#cartCount').classList.remove('count-bump');
    }, 600);
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(() => flyer.classList.add('fly'));
  });

  flyer.addEventListener('transitionend', bumpCart, { once: true });
  setTimeout(bumpCart, 900);
}

function openCart() {
  closeProductPicker();
  $('#cartPanel').classList.add('open');
  $('#overlay').classList.add('open');
  if (!$('#customerLocation').value) detectLocation();
}

function resetOrderForm() {
  $('#orderForm').reset();
  $('#customerLocation').value = '';
  $('#locationStatus').textContent = 'Savat ochilganda avtomatik aniqlanadi';
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=uz,ru,en`,
      { headers: { Accept: 'application/json', 'User-Agent': 'LiderParfum/1.0' } }
    );
    if (!res.ok) throw new Error('reverse failed');
    const data = await res.json();
    return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } catch {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  }
}

function detectLocation() {
  const status = $('#locationStatus');
  const input = $('#customerLocation');
  const btn = $('#detectLocationBtn');

  if (!navigator.geolocation) {
    status.textContent = 'Brauzeringiz lokatsiyani qo\'llab-quvvatlamaydi';
    input.value = '';
    return;
  }

  setLocationLoading(true);
  btn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      const address = await reverseGeocode(lat, lng);
      const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
      input.value = `${address} | ${mapsLink}`;
      status.textContent = address;
      btn.disabled = false;
    },
    (err) => {
      const messages = {
        1: 'Lokatsiya ruxsati berilmadi. Brauzer sozlamalaridan ruxsat bering.',
        2: 'Lokatsiyani aniqlab bo\'lmadi',
        3: 'So\'rov vaqti tugadi, qayta urinib ko\'ring',
      };
      status.textContent = messages[err.code] || 'Lokatsiyani aniqlab bo\'lmadi';
      input.value = '';
      btn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
  );
}

function closeCart() {
  $('#cartPanel').classList.remove('open');
  if (!$('#productModal').classList.contains('open')) {
    $('#overlay').classList.remove('open');
  }
}

document.addEventListener('click', (e) => {
  const openPicker = e.target.closest('[data-action="open-picker"]');
  if (openPicker) {
    openProductPicker(Number(openPicker.dataset.productId));
    return;
  }

  if (e.target.closest('[data-action="expand-scents"]')) {
    pickerState.scentExpanded = true;
    const product = PRODUCTS.find((p) => p.id === pickerState.productId);
    if (product) renderScentGrid(product, pickerState.size, pickerState.scent);
    return;
  }

  const scentBtn = e.target.closest('.scent-option');
  if (scentBtn) {
    pickerState.scent = scentBtn.dataset.scent;
    updatePickerUI();
    return;
  }

  const sizeBtn = e.target.closest('.size-option');
  if (sizeBtn) {
    const product = PRODUCTS.find((p) => p.id === pickerState.productId);
    pickerState.size = sizeBtn.dataset.size;
    const scents = getScentsForSize(product, pickerState.size);
    if (!scents.includes(pickerState.scent)) {
      pickerState.scent = scents.find(Boolean) ?? '';
    }
    updatePickerUI();
    return;
  }

  const thumb = e.target.closest('.variant-thumb');
  if (thumb) {
    selectVariant(Number(thumb.dataset.productId), thumb.dataset.variantId);
    return;
  }

  const productId = Number(e.target.dataset.productId);
  const variantId = e.target.dataset.variantId;

  if (e.target.classList.contains('plus') && productId) {
    qtyState[productId]++;
    updateQtyUI(productId);
  }

  if (e.target.classList.contains('minus') && !e.target.classList.contains('cart-minus') && productId) {
    if (qtyState[productId] > 1) qtyState[productId]--;
    updateQtyUI(productId);
  }

  if (e.target.classList.contains('add-btn') && productId) {
    addToCart(productId);
  }

  if (e.target.classList.contains('cart-plus') && variantId) {
    cart[variantId].qty++;
    renderCart();
  }

  if (e.target.classList.contains('cart-minus') && variantId) {
    cart[variantId].qty--;
    if (cart[variantId].qty <= 0) delete cart[variantId];
    renderCart();
  }
});

$('#closeProductModal').addEventListener('click', closeProductPicker);
$('#modalAddBtn').addEventListener('click', addFromPicker);
$('#modalDescToggle').addEventListener('click', () => {
  const body = $('#modalDescription');
  const toggle = $('#modalDescToggle');
  const open = body.hidden;
  body.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  toggle.classList.toggle('open', open);
});
$('#modalPlus').addEventListener('click', () => {
  pickerState.qty++;
  syncModalQtyInput();
});
$('#modalMinus').addEventListener('click', () => {
  if (pickerState.qty > 1) {
    pickerState.qty--;
    syncModalQtyInput();
  }
});
$('#modalQty').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '');
});
$('#modalQty').addEventListener('blur', commitModalQty);
$('#modalQty').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    commitModalQty();
    e.target.blur();
  }
});

$('#cartBtn').addEventListener('click', openCart);
$('#closeCart').addEventListener('click', closeCart);
$('#detectLocationBtn').addEventListener('click', detectLocation);
$('#customerPhone').addEventListener('input', handlePhoneInput);
$('#customerPhone').addEventListener('blur', () => {
  const input = $('#customerPhone');
  input.value = formatUzPhone(getUzPhoneDigits());
  setPhoneValidity();
});
$('#overlay').addEventListener('click', () => {
  closeProductPicker();
  closeCart();
});

$('#orderForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const items = Object.values(cart);
  if (!items.length) return;

  const location = $('#customerLocation').value.trim();
  if (!location) {
    showToast('Avval lokatsiyani aniqlang');
    detectLocation();
    return;
  }

  const paymentType = document.querySelector('input[name="paymentType"]:checked')?.value;
  if (!paymentType) {
    showToast('To\'lov turini tanlang');
    return;
  }

  const phoneDigits = getUzPhoneDigits();
  if (!isValidUzPhone(phoneDigits)) {
    setPhoneValidity();
    showToast('Telefon raqamini to\'g\'ri kiriting (+998 XX XXX XX XX)');
    $('#customerPhone').reportValidity();
    return;
  }
  const phone = `+${phoneDigits}`;

  const btn = e.target.querySelector('.order-btn');
  setButtonLoading(btn, true, 'Yuborilmoqda...');

  try {
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: $('#customerName').value.trim(),
        phone,
        location,
        paymentType,
        note: $('#customerNote').value.trim(),
        items: items.map((i) => ({
          name: i.name,
          scent: i.scent,
          size: i.size,
          qty: i.qty,
          price: i.price,
        })),
        total: cartTotal(),
      }),
    });

    const data = await res.json();

    if (res.ok) {
      clearCart();
      resetOrderForm();
      closeCart();
      showToast('Zakaz qabul qilindi!');
    } else {
      showToast(data.error || 'Xatolik yuz berdi');
    }
  } catch {
    showToast('Serverga ulanib bo\'lmadi');
  }

  setButtonLoading(btn, false);
});

async function init() {
  $('#filters').innerHTML = sectionLoaderHtml('Filtrlarni yuklash...', true);
  $('#products').innerHTML = sectionLoaderHtml('Mahsulotlar yuklanmoqda...');
  try {
    const [productsRes, catalogRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/catalog'),
    ]);
    PRODUCTS = await productsRes.json();
    CATALOG = await catalogRes.json();
    loadCart();
    renderFilters();
    renderProducts();
    renderCart();
  } catch {
    const errHtml = '<div class="cart-empty">Yuklanmadi</div>';
    $('#products').innerHTML = errHtml;
    $('#filters').innerHTML = errHtml;
  }
}

init();
