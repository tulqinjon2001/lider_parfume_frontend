require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
  readProducts,
  writeProducts,
  makeVariantId,
  createToken,
  verifyToken,
  authMiddleware,
  IMAGES_DIR,
} = require('./products');
const { generatePlaceholderSvg, findVariantByImage } = require('./placeholder');
const { readCatalog, writeCatalog } = require('./catalog');

const app = express();
const PORT = process.env.PORT || 3001;

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: IMAGES_DIR,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(jpe?g|png|webp|gif)$/i.test(file.originalname);
    cb(ok ? null : new Error('Faqat rasm'), ok);
  },
});

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PUBLIC_DIR = path.join(__dirname, '../public');

app.get('/admin/catalog', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin-catalog.html'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.get('/images/:filename', asyncHandler(async (req, res) => {
  const filePath = path.join(IMAGES_DIR, req.params.filename);
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  const products = await readProducts();
  const match = findVariantByImage(products, req.params.filename);
  const svg = generatePlaceholderSvg(
    match
      ? { name: match.product.name, scent: match.variant.scent, size: match.variant.size }
      : { name: req.params.filename.replace(/\.[^.]+$/, '').replace(/-/g, ' ') }
  );

  res.type('image/svg+xml').send(svg);
}));

app.use(express.static(PUBLIC_DIR));

app.get('/api/products', asyncHandler(async (_req, res) => {
  res.json(await readProducts());
}));

app.get('/api/catalog', asyncHandler(async (_req, res) => {
  res.json(await readCatalog());
}));

app.get('/api/admin/catalog', authMiddleware, asyncHandler(async (_req, res) => {
  res.json(await readCatalog());
}));

app.put('/api/admin/catalog', authMiddleware, asyncHandler(async (req, res) => {
  const { brands, categories } = req.body;
  if (!Array.isArray(brands) || !Array.isArray(categories)) {
    return res.status(400).json({ error: 'Noto\'g\'ri ma\'lumot' });
  }
  await writeCatalog({ brands, categories });
  res.json({ success: true });
}));

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ error: 'Admin parol sozlanmagan' });
  }

  if (password !== adminPassword) {
    return res.status(401).json({ error: 'Parol noto\'g\'ri' });
  }

  res.json({ token: createToken() });
});

app.get('/api/admin/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  res.json({ ok: verifyToken(token) });
});

app.get('/api/admin/products', authMiddleware, asyncHandler(async (_req, res) => {
  res.json(await readProducts());
}));

app.put('/api/admin/products', authMiddleware, asyncHandler(async (req, res) => {
  const products = req.body;
  if (!Array.isArray(products)) {
    return res.status(400).json({ error: 'Noto\'g\'ri ma\'lumot' });
  }
  await writeProducts(products);
  res.json({ success: true });
}));

app.post('/api/admin/upload', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Rasm tanlanmadi' });
  }
  res.json({ image: `images/${req.file.filename}` });
});

app.post('/api/admin/upload-url', authMiddleware, asyncHandler(async (req, res) => {
  const { url } = req.body;

  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Noto\'g\'ri link' });
  }

  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    return res.status(400).json({ error: 'Rasm topilmadi' });
  }

  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim();
  const extMap = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };

  let ext = extMap[contentType];
  if (!ext) {
    try {
      ext = path.extname(new URL(url).pathname).toLowerCase();
    } catch {
      ext = '';
    }
  }
  if (!/^\.(jpe?g|png|webp|gif)$/i.test(ext)) ext = '.jpg';

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Rasm juda katta (max 5MB)' });
  }

  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  fs.writeFileSync(path.join(IMAGES_DIR, name), buffer);
  res.json({ image: `images/${name}` });
}));

app.post('/api/order', asyncHandler(async (req, res) => {
  const { name, phone, items, total } = req.body;

  if (!name || !phone || !items?.length) {
    return res.status(400).json({ error: 'Ma\'lumotlar to\'liq emas' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return res.status(500).json({ error: 'Telegram sozlanmagan' });
  }

  const lines = items.map((item) => {
    const detail = [item.scent, item.size].filter(Boolean).join(' · ');
    const label = detail ? `${item.name} (${detail})` : item.name;
    return `• ${label} — ${item.qty} ta × ${item.price.toLocaleString()} = ${(item.qty * item.price).toLocaleString()} so'm`;
  });

  const text = [
    '🛍 Yangi zakaz — Lider Parfum',
    '',
    `👤 ${name}`,
    `📞 ${phone}`,
    '',
    '📦 Mahsulotlar:',
    ...lines,
    '',
    `💰 Jami: ${total.toLocaleString()} so'm`,
  ].join('\n');

  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    }
  );

  const data = await response.json();
  if (!data.ok) {
    return res.status(500).json({ error: 'Telegramga yuborilmadi' });
  }

  res.json({ success: true });
}));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, _req, res, _next) => {
  if (err.code === 'PGRST205') {
    console.error('Supabase: products/catalog jadvallari topilmadi. supabase/schema.sql ni SQL Editor da ishga tushiring.');
  } else {
    console.error(err);
  }
  res.status(500).json({ error: err.message || 'Server xatosi' });
});

async function checkSupabase() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (key.startsWith('sb_publishable_')) {
    console.error('\n[!] SUPABASE_SERVICE_ROLE_KEY noto\'g\'ri — publishable key emas, service_role key kerak.');
    console.error('    Supabase → Project Settings → API → service_role (secret)\n');
  }

  try {
    await readCatalog();
    await readProducts();
    console.log('Supabase: ulandi');
  } catch (err) {
    if (err.code === 'PGRST205') {
      console.error('\n[!] Supabase jadvallari yo\'q.');
      console.error('    1. https://supabase.com/dashboard → loyihangiz');
      console.error('    2. SQL Editor → supabase/schema.sql ni nusxalab RUN bosing\n');
    } else {
      console.error('\n[!] Supabase xatosi:', err.message || err);
    }
  }
}

app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Admin:  http://localhost:${PORT}/admin`);
  checkSupabase();
});

module.exports = { makeVariantId };
