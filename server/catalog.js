const { getSupabase } = require('./supabase');

const DEFAULT_CATALOG = {
  brands: [],
  categories: ['Parfyum', 'Shampun', 'Dezodorant', 'Kosmetika'],
};

async function readCatalog() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('catalog')
    .select('brands, categories')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ...DEFAULT_CATALOG };

  return {
    brands: data.brands || [],
    categories: data.categories || DEFAULT_CATALOG.categories,
  };
}

async function writeCatalog(catalog) {
  const supabase = getSupabase();
  const { error } = await supabase.from('catalog').upsert(
    {
      id: 1,
      brands: catalog.brands || [],
      categories: catalog.categories || [],
    },
    { onConflict: 'id' }
  );

  if (error) throw error;
}

module.exports = { readCatalog, writeCatalog, DEFAULT_CATALOG };
