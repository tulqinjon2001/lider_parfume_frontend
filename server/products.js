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
