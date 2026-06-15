-- Supabase SQL Editor da ishga tushiring

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  brands JSONB NOT NULL DEFAULT '[]'::jsonb,
  categories JSONB NOT NULL DEFAULT '["Parfyum","Shampun","Dezodorant","Kosmetika"]'::jsonb
);

INSERT INTO catalog (id, brands, categories)
VALUES (1, '[]'::jsonb, '["Parfyum","Shampun","Dezodorant","Kosmetika"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read products" ON products FOR SELECT USING (true);
CREATE POLICY "Public read catalog" ON catalog FOR SELECT USING (true);
