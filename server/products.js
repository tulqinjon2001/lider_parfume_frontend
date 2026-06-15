const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '../data/products.json');
const IMAGES_DIR = path.join(__dirname, '../public/images');

function readProducts() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeProducts(products) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf8');
}

function nextProductId(products) {
  return products.length ? Math.max(...products.map((p) => p.id)) + 1 : 1;
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function makeVariantId(productId, scent, size) {
  return `${productId}-${slugify(scent)}-${slugify(size)}`;
}

const adminTokens = new Map();
const TOKEN_TTL = 24 * 60 * 60 * 1000;

function createToken() {
  const token = crypto.randomBytes(32).toString('hex');
  adminTokens.set(token, Date.now() + TOKEN_TTL);
  return token;
}

function verifyToken(token) {
  if (!token) return false;
  const expires = adminTokens.get(token);
  if (!expires) return false;
  if (Date.now() > expires) {
    adminTokens.delete(token);
    return false;
  }
  return true;
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!verifyToken(token)) {
    return res.status(401).json({ error: 'Kirish kerak' });
  }
  next();
}

module.exports = {
  readProducts,
  writeProducts,
  nextProductId,
  slugify,
  makeVariantId,
  createToken,
  verifyToken,
  authMiddleware,
  IMAGES_DIR,
};
