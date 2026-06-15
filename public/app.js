const PLACEHOLDER = 'images/placeholder.svg';

let PRODUCTS = [];
const cart = {};
const qtyState = {};
const selectedVariant = {};

const $ = (sel) => document.querySelector(sel);

function getVariant(productId, variantId) {
  const product = PRODUCTS.find((p) => p.id === productId);
  return product?.variants.find((v) => v.id === variantId);
}

function getSelectedVariant(product) {
  return product.variants.find((v) => v.id === selectedVariant[product.id]) || product.variants[0];
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

  if (!PRODUCTS.length) {
    container.innerHTML = '<div class="cart-empty">Mahsulotlar yo\'q</div>';
    return;
  }

  container.innerHTML = PRODUCTS.map((p) => {
    if (!p.variants?.length) return '';

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

function addToCart(productId) {
  const qty = qtyState[productId];
  if (!qty) return;

  const product = PRODUCTS.find((p) => p.id === productId);
  const variant = getSelectedVariant(product);
  const key = variant.id;

  if (cart[key]) {
    cart[key].qty += qty;
  } else {
    cart[key] = {
      variantId: variant.id,
      productId: product.id,
      name: product.name,
      scent: variant.scent,
      size: variant.size,
      price: variant.price,
      image: variant.image,
      qty,
    };
  }

  qtyState[productId] = 1;
  updateQtyUI(productId);
  renderCart();
  showToast('Savatga qo\'shildi');
}

function showToast(msg) {
  const toast = $('#toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

function openCart() {
  $('#cartPanel').classList.add('open');
  $('#overlay').classList.add('open');
}

function closeCart() {
  $('#cartPanel').classList.remove('open');
  $('#overlay').classList.remove('open');
}

document.addEventListener('click', (e) => {
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

$('#cartBtn').addEventListener('click', openCart);
$('#closeCart').addEventListener('click', closeCart);
$('#overlay').addEventListener('click', closeCart);

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
    const res = await fetch('/api/products');
    PRODUCTS = await res.json();
    renderProducts();
  } catch {
    $('#products').innerHTML = '<div class="cart-empty">Yuklanmadi</div>';
  }
}

init();
