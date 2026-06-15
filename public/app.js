const PLACEHOLDER = 'images/placeholder.svg';

let PRODUCTS = [];
let CATALOG = { brands: [], categories: [] };
let filterBrand = '';
let filterCategory = '';
const cart = {};
const qtyState = {};
const selectedVariant = {};

const pickerState = {
  productId: null,
  scent: null,
  size: null,
  qty: 1,
};

const $ = (sel) => document.querySelector(sel);

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
  $('#scentGrid').innerHTML = variants.map((v) => `
    <button type="button" class="scent-option ${v.scent === selectedScent ? 'selected' : ''}" data-scent="${v.scent}">
      <img src="${v.image}" alt="${v.scent}" onerror="imgFallback(event)">
      <span>${v.scent}</span>
    </button>
  `).join('');
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
  return PRODUCTS.filter((p) => {
    if (filterBrand && p.brand !== filterBrand) return false;
    if (filterCategory && p.category !== filterCategory) return false;
    return true;
  });
}

function renderFilters() {
  const brandOpts = CATALOG.brands.map((b) => `
    <option value="${b}" ${filterBrand === b ? 'selected' : ''}>${b}</option>
  `).join('');

  const catOpts = CATALOG.categories.map((c) => `
    <option value="${c}" ${filterCategory === c ? 'selected' : ''}>${c}</option>
  `).join('');

  $('#filters').innerHTML = `
    <select id="filterBrand" class="filter-select">
      <option value="">Barcha brendlar</option>
      ${brandOpts}
    </select>
    <select id="filterCategory" class="filter-select">
      <option value="">Barcha kategoriyalar</option>
      ${catOpts}
    </select>
  `;

  $('#filterBrand').addEventListener('change', (e) => {
    filterBrand = e.target.value;
    renderProducts();
  });

  $('#filterCategory').addEventListener('change', (e) => {
    filterCategory = e.target.value;
    renderProducts();
  });
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

    if (needsPicker(p)) {
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
    }

    qtyState[p.id] = qtyState[p.id] ?? 1;
    if (!selectedVariant[p.id]) selectedVariant[p.id] = p.variants[0].id;
    const current = getSelectedVariant(p);

    const thumbs = p.variants.map((v) => `
      <button
        type="button"
        class="variant-thumb ${v.id === current.id ? 'selected' : ''}"
        data-product-id="${p.id}"
        data-variant-id="${v.id}"
        title="${v.scent} · ${v.size}"
      >
        <img src="${v.image}" alt="${v.scent} ${v.size}" loading="lazy" onerror="imgFallback(event)">
        <span class="variant-label">${v.scent}<br>${v.size}</span>
      </button>
    `).join('');

    return `
      <div class="product-card" data-product-id="${p.id}">
        ${productMeta(p)}
        <div class="product-name">${p.name}</div>
        <div class="product-preview">
          <img
            id="preview-${p.id}"
            src="${current.image}"
            alt="${p.name}"
            loading="lazy"
            onerror="imgFallback(event)"
          >
        </div>
        <div class="variant-grid">${thumbs}</div>
        <div class="product-price" id="price-${p.id}">${formatPrice(current.price)}</div>
        <div class="qty-control">
          <button class="qty-btn minus" data-product-id="${p.id}">−</button>
          <span class="qty-value" id="qty-${p.id}">${qtyState[p.id]}</span>
          <button class="qty-btn plus" data-product-id="${p.id}">+</button>
        </div>
        <button class="add-btn" data-product-id="${p.id}">Savatga (${qtyState[p.id]})</button>
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
  $('#modalTitle').textContent = `${product.name} — ${scent}`;
  $('#modalPrice').textContent = formatPrice(price);
  $('#modalQty').textContent = pickerState.qty;
  $('#pickerSummary').innerHTML = `Tanlangan: <strong>${scent} · ${size}</strong>`;

  renderScentGrid(product, size, scent);

  document.querySelectorAll('.size-option').forEach((el) => {
    el.classList.toggle('selected', el.dataset.size === size);
    el.textContent = `${el.dataset.size} — ${formatPrice(getPriceForSize(product, el.dataset.size))}`;
  });
}

function openProductPicker(productId) {
  const product = PRODUCTS.find((p) => p.id === productId);
  if (!product || !needsPicker(product)) return;

  const firstVariant = product.variants[0];
  const sizes = getUniqueSizes(product);

  pickerState.productId = productId;
  pickerState.size = firstVariant.size;
  pickerState.scent = getScentsForSize(product, firstVariant.size)[0];
  pickerState.qty = 1;

  $('#sizeOptions').innerHTML = sizes.map((s) => `
    <button type="button" class="size-option" data-size="${s}">${s}</button>
  `).join('');

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

function renderCart() {
  $('#cartCount').textContent = cartCount();
  $('#cartTotal').textContent = formatPrice(cartTotal());

  const items = Object.values(cart);
  const container = $('#cartItems');

  if (!items.length) {
    container.innerHTML = '<div class="cart-empty">Savat bo\'sh</div>';
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
  closeProductPicker();
  showToast('Savatga qo\'shildi');
}

function showToast(msg) {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

function openCart() {
  closeProductPicker();
  $('#cartPanel').classList.add('open');
  $('#overlay').classList.add('open');
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
      pickerState.scent = scents[0];
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
$('#modalPlus').addEventListener('click', () => {
  pickerState.qty++;
  $('#modalQty').textContent = pickerState.qty;
});
$('#modalMinus').addEventListener('click', () => {
  if (pickerState.qty > 1) {
    pickerState.qty--;
    $('#modalQty').textContent = pickerState.qty;
  }
});

$('#cartBtn').addEventListener('click', openCart);
$('#closeCart').addEventListener('click', closeCart);
$('#overlay').addEventListener('click', () => {
  closeProductPicker();
  closeCart();
});

$('#orderForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const items = Object.values(cart);
  if (!items.length) return;

  const btn = e.target.querySelector('.order-btn');
  btn.disabled = true;
  btn.textContent = 'Yuborilmoqda...';

  try {
    const res = await fetch('/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: $('#customerName').value.trim(),
        phone: $('#customerPhone').value.trim(),
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
      Object.keys(cart).forEach((k) => delete cart[k]);
      e.target.reset();
      renderCart();
      closeCart();
      showToast('Zakaz qabul qilindi!');
    } else {
      showToast(data.error || 'Xatolik yuz berdi');
    }
  } catch {
    showToast('Serverga ulanib bo\'lmadi');
  }

  btn.disabled = false;
  btn.textContent = 'Zakaz berish';
});

async function init() {
  try {
    const [productsRes, catalogRes] = await Promise.all([
      fetch('/api/products'),
      fetch('/api/catalog'),
    ]);
    PRODUCTS = await productsRes.json();
    CATALOG = await catalogRes.json();
    renderFilters();
    renderProducts();
  } catch {
    $('#products').innerHTML = '<div class="cart-empty">Yuklanmadi</div>';
  }
}

init();
