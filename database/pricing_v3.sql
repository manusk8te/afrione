-- ─────────────────────────────────────────────────────────────────────────────
-- AfriOne Pricing v3 — vendor_quartier + vendeurs physiques Abidjan
-- Coller dans Supabase SQL Editor puis Exécuter
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Colonne vendor_quartier sur price_materials (vendeurs physiques)
ALTER TABLE price_materials
  ADD COLUMN IF NOT EXISTS vendor_quartier text;

-- 2. Mise à jour des vendeurs physiques connus à Abidjan
--    Source ≠ 'Jumia CI' → prix marché traditionnel
--    Les ciments, carrelage et matériaux lourds → marchés physiques

UPDATE price_materials SET vendor_quartier = 'Adjamé'
WHERE source IN ('Marché Adjamé', 'Quincaillerie Adjamé')
   OR (source IS NULL AND category IN ('Plomberie','Électricité') AND web_price IS NULL);

UPDATE price_materials SET vendor_quartier = 'Koumassi'
WHERE source IN ('Marché Koumassi', 'Sogeha')
   OR (source IS NULL AND category IN ('Maçonnerie','Carrelage') AND web_price IS NULL);

UPDATE price_materials SET vendor_quartier = 'Marcory'
WHERE source IN ('Bricorama Marcory', 'Quincaillerie Marcory');

UPDATE price_materials SET vendor_quartier = 'Yopougon'
WHERE source IN ('Marché Yopougon','Cimaf Yopougon')
   OR (source IS NULL AND category = 'Menuiserie' AND web_price IS NULL);

-- 3. Vendeurs physiques seed — quincailleries et marchés Abidjan
--    Ces entrées représentent les prix moyens du marché physique (source ≠ Jumia)
INSERT INTO price_materials
  (name, category, unit, tier, price_market, price_min, price_max, source, brand, vendor_quartier)
VALUES
  -- Plomberie — Adjamé
  ('Tuyau PVC 32mm éco',         'Plomberie', 'mètre', 'economique', 800,  600,  1100, 'Quincaillerie Adjamé', 'Sans marque', 'Adjamé'),
  ('Tuyau PVC 32mm',             'Plomberie', 'mètre', 'standard',   1200, 900,  1600, 'Quincaillerie Adjamé', 'Wavin',       'Adjamé'),
  ('Tuyau PVC 32mm premium',     'Plomberie', 'mètre', 'premium',    2000, 1600, 2600, 'Quincaillerie Adjamé', 'Aliaxis',     'Adjamé'),

  ('Robinet mélangeur éco',      'Plomberie', 'unité', 'economique', 4500, 3500, 6000, 'Marché Adjamé',        'Générique',   'Adjamé'),
  ('Robinet mélangeur',          'Plomberie', 'unité', 'standard',   8000, 6000, 11000,'Marché Adjamé',        'Vitra',       'Adjamé'),
  ('Robinet mélangeur premium',  'Plomberie', 'unité', 'premium',   18000,14000, 24000,'Marché Adjamé',        'Grohe',       'Adjamé'),

  -- Électricité — Adjamé
  ('Câble 2.5mm éco',            'Électricité','mètre','economique', 600,  450,  800,  'Quincaillerie Adjamé', 'Générique',   'Adjamé'),
  ('Câble 2.5mm',                'Électricité','mètre','standard',   900,  700,  1200, 'Quincaillerie Adjamé', 'Nexans',      'Adjamé'),
  ('Câble 2.5mm premium',        'Électricité','mètre','premium',   1400, 1100, 1800, 'Quincaillerie Adjamé', 'Legrand',     'Adjamé'),

  -- Maçonnerie — Koumassi
  ('Ciment CPA éco',             'Maçonnerie','sac',  'economique', 5500, 4500, 7000, 'Marché Koumassi',      'Cimaf',       'Koumassi'),
  ('Ciment CPA',                 'Maçonnerie','sac',  'standard',   7000, 5500, 9000, 'Marché Koumassi',      'Lafarge',     'Koumassi'),
  ('Ciment CPA premium',         'Maçonnerie','sac',  'premium',    9000, 7000,11500, 'Marché Koumassi',      'CimCI',       'Koumassi'),

  -- Carrelage — Koumassi
  ('Carrelage sol éco',          'Carrelage', 'm²',   'economique', 5000, 4000, 7000, 'Sogeha Koumassi',      'Générique',   'Koumassi'),
  ('Carrelage sol',              'Carrelage', 'm²',   'standard',   8500, 6500,11000, 'Sogeha Koumassi',      'Vitra',       'Koumassi'),
  ('Carrelage sol premium',      'Carrelage', 'm²',   'premium',   15000,12000,20000, 'Sogeha Koumassi',      'Ragno',       'Koumassi'),

  -- Peinture — Marcory
  ('Peinture vinylique éco',     'Peinture',  'litre','economique', 2200, 1700, 3000, 'Bricorama Marcory',    'SOTACI',      'Marcory'),
  ('Peinture vinylique',         'Peinture',  'litre','standard',   3500, 2800, 4500, 'Bricorama Marcory',    'Dulux',       'Marcory'),
  ('Peinture vinylique premium', 'Peinture',  'litre','premium',    6000, 4800, 8000, 'Bricorama Marcory',    'Sikkens',     'Marcory')

ON CONFLICT (name, category, tier) DO NOTHING;
