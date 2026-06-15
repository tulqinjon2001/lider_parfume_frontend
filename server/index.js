require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
  readProducts,
  writeProducts,
  nextProductId,
  makeVariantId,
  createToken,
  verifyToken,
  authMiddleware,
  IMAGES_DIR,
} = require('./products');

const app = express();
const PORT = process.env.PORT || 3001;

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
app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/products', (_req, res) => {
  res.json(readProducts());
});

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

app.get('/api/admin/products', authMiddleware, (_req, res) => {
  res.json(readProducts());
});

app.put('/api/admin/products', authMiddleware, (req, res) => {
  const products = req.body;
  if (!Array.isArray(products)) {
    return res.status(400).json({ error: 'Noto\'g\'ri ma\'lumot' });
  }
  writeProducts(products);
  res.json({ success: true });
});

app.post('/api/admin/upload', authMiddleware, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Rasm tanlanmadi' });
  }
  res.json({ image: `images/${req.file.filename}` });
});

app.post('/api/order', async (req, res) => {
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

  try {
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
  } catch {
    res.status(500).json({ error: 'Server xatosi' });
  }
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`Admin:  http://localhost:${PORT}/admin`);
});

module.exports = { makeVariantId, nextProductId };
