-- ============================================================
-- AfriOne — Pricing v2 : tiers matériaux + prix marché réf.
-- ============================================================

-- Colonnes supplémentaires sur price_materials
ALTER TABLE price_materials
  ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'standard'
    CHECK (tier IN ('premium', 'standard', 'economique')),
  ADD COLUMN IF NOT EXISTS brand VARCHAR(100),
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS web_price INTEGER,
  ADD COLUMN IF NOT EXISTS physical_price INTEGER,
  ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ;

-- Prix de référence marché traditionnel (sans AfriOne)
CREATE TABLE IF NOT EXISTS market_reference_prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(100) UNIQUE NOT NULL,
  reference_price_fcfa INTEGER NOT NULL,
  basis TEXT DEFAULT 'Enquête terrain Abidjan 2026',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO market_reference_prices (category, reference_price_fcfa) VALUES
  ('Plomberie',    45000),
  ('Électricité',  65000),
  ('Peinture',     85000),
  ('Maçonnerie',   75000),
  ('Menuiserie',   70000),
  ('Climatisation',95000),
  ('Serrurerie',   32000),
  ('Carrelage',   130000)
ON CONFLICT (category) DO NOTHING;

-- Index
CREATE INDEX IF NOT EXISTS idx_materials_tier ON price_materials(tier);
CREATE INDEX IF NOT EXISTS idx_materials_category_tier ON price_materials(category, tier);

-- ── Seed data : 3 tiers par matériau courant ─────────────────────────────────

-- Plomberie
INSERT INTO price_materials (name, category, unit, price_market, price_min, price_max, source, tier, brand) VALUES
  ('Joint d''étanchéité silicone', 'Plomberie', 'tube', 800,  600,  1100, 'Adjamé',     'economique', 'Sans marque'),
  ('Joint silicone',               'Plomberie', 'tube', 1500, 1200, 2000, 'Treichville', 'standard',   'Rubson CI'),
  ('Joint silicone premium',       'Plomberie', 'tube', 2800, 2400, 3500, 'Jumia CI',    'premium',    'Sika'),
  ('Tuyau PVC 32mm',               'Plomberie', 'mètre', 400, 300,  600,  'Adjamé',     'economique', 'Local'),
  ('Tuyau PVC 32mm',               'Plomberie', 'mètre', 600, 500,  800,  'Adjamé',     'standard',   'Wavin'),
  ('Tuyau PVC 32mm renforcé',      'Plomberie', 'mètre', 950, 800,  1200, 'Jumia CI',   'premium',    'TOTAL'),
  ('Robinet mélangeur',            'Plomberie', 'unité', 5000, 3500, 7000, 'Adjamé',    'economique', 'Sans marque'),
  ('Robinet mélangeur',            'Plomberie', 'unité', 12000,9000, 16000,'Treichville','standard',  'Grohe CI'),
  ('Robinet mélangeur premium',    'Plomberie', 'unité', 28000,22000,35000,'Jumia CI',  'premium',    'Hansgrohe')
ON CONFLICT DO NOTHING;

-- Électricité
INSERT INTO price_materials (name, category, unit, price_market, price_min, price_max, source, tier, brand) VALUES
  ('Câble électrique 2.5mm',       'Électricité','mètre', 500, 400,  700,  'Adjamé',    'economique', 'Local'),
  ('Câble électrique 2.5mm',       'Électricité','mètre', 800, 700,  1000, 'Adjamé',    'standard',   'Nexans CI'),
  ('Câble électrique 2.5mm cuivre','Électricité','mètre', 1200,1000, 1500, 'Jumia CI',  'premium',    'Legrand'),
  ('Disjoncteur 16A',              'Électricité','unité', 3000, 2500, 4000, 'Adjamé',   'economique', 'Sans marque'),
  ('Disjoncteur 16A',              'Électricité','unité', 4500, 3500, 6000, 'Treichville','standard', 'Hager'),
  ('Disjoncteur 16A différentiel', 'Électricité','unité', 9000, 7500, 12000,'Jumia CI', 'premium',    'Schneider')
ON CONFLICT DO NOTHING;

-- Peinture
INSERT INTO price_materials (name, category, unit, price_market, price_min, price_max, source, tier, brand) VALUES
  ('Peinture vinylique',           'Peinture', 'litre', 1800, 1400, 2400, 'Adjamé',    'economique', 'Batipro'),
  ('Peinture vinylique',           'Peinture', 'litre', 2500, 2000, 3000, 'Treichville','standard',  'Valentine CI'),
  ('Peinture acrylique premium',   'Peinture', 'litre', 4500, 3800, 5500, 'Jumia CI',  'premium',    'Dulux'),
  ('Enduit de lissage',            'Peinture', 'kg',     600,  450,  800, 'Adjamé',    'economique', 'Local'),
  ('Enduit de lissage',            'Peinture', 'kg',     900,  750, 1100, 'Treichville','standard',  'Weber CI'),
  ('Enduit de lissage premium',    'Peinture', 'kg',    1600, 1300, 2000, 'Jumia CI',  'premium',    'Knauf')
ON CONFLICT DO NOTHING;

-- Maçonnerie
INSERT INTO price_materials (name, category, unit, price_market, price_min, price_max, source, tier, brand) VALUES
  ('Ciment CPA 50kg',  'Maçonnerie','sac', 6500,  6000, 7500, 'Adjamé',    'economique', 'CINAT'),
  ('Ciment CPA 50kg',  'Maçonnerie','sac', 7000,  6500, 8000, 'Treichville','standard',  'Cimaf CI'),
  ('Ciment CEM I 52.5','Maçonnerie','sac', 9500,  8500, 11000,'Jumia CI',  'premium',    'Lafarge'),
  ('Sable de rivière', 'Maçonnerie','m³',  18000,15000, 22000,'Adjamé',    'economique', 'Carrière locale'),
  ('Sable lavé',       'Maçonnerie','m³',  25000,20000, 30000,'Treichville','standard',  'Granulat CI'),
  ('Gravier concassé', 'Maçonnerie','m³',  32000,28000, 38000,'Fournisseur','premium',   'Granulat CI')
ON CONFLICT DO NOTHING;

-- Climatisation
INSERT INTO price_materials (name, category, unit, price_market, price_min, price_max, source, tier, brand) VALUES
  ('Gaz climatiseur R410a', 'Climatisation','kg', 10000, 8000, 13000,'Adjamé',    'economique', 'Générique'),
  ('Gaz climatiseur R32',   'Climatisation','kg', 15000,12000, 18000,'Treichville','standard',  'Daikin CI'),
  ('Gaz R32 certifié',      'Climatisation','kg', 22000,18000, 27000,'Jumia CI',  'premium',    'Carrier')
ON CONFLICT DO NOTHING;
