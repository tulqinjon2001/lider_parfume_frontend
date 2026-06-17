const path = require('path');
const crypto = require('crypto');
const { getSupabase } = require('./supabase');

const IMAGES_DIR = path.join(__dirname, '../public/images');

function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand || '',
    category: row.category || '',
    sizes: row.sizes || [],
    variants: row.variants || [],
  };
}

async function readProducts() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('products')
    .select('id, name, brand, category, sizes, variants')
    .order('id');

  if (error) throw error;
  return (data || []).map(mapProduct);
}

async function writeProducts(products) {
  const supabase = getSupabase();
  const { data: existing, error: fetchError } = await supabase.from('products').select('id');
  if (fetchError) throw fetchError;

  const newIds = new Set(products.map((p) => p.id));
  const toDelete = (existing || []).map((r) => r.id).filter((id) => !newIds.has(id));

  if (toDelete.length) {
    const { error: deleteError } = await supabase.from('products').delete().in('id', toDelete);
    if (deleteError) throw deleteError;
  }

  if (!products.length) return;

  const rows = products.map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand || '',
    category: p.category || '',
    sizes: p.sizes || [],
    variants: p.variants || [],
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('products').upsert(rows, { onConflict: 'id' });
  if (error) throw error;
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

const TOKEN_TTL = 24 * 60 * 60 * 1000;

function getTokenSecret() {
  return process.env.ADMIN_PASSWORD || process.env.ADMIN_TOKEN_SECRET || '';
}

function createToken() {
  const secret = getTokenSecret();
  if (!secret) throw new Error('Admin parol sozlanmagan');

  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token) return false;

  const secret = getTokenSecret();
  if (!secret) return false;

  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.exp === 'number' && Date.now() < data.exp;
  } catch {
    return false;
  }
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
