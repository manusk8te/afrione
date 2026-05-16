-- ============================================================
-- AfriOne — Migration : artisan_questionnaire_submissions
-- ============================================================

CREATE TABLE IF NOT EXISTS artisan_questionnaire_submissions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artisan_id            UUID REFERENCES artisan_pros(id) ON DELETE CASCADE NOT NULL,
  status                TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_at          TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at           TIMESTAMPTZ,
  reviewed_by           TEXT,
  admin_notes           TEXT,

  -- Crédibilité
  experience_years      INTEGER,
  has_id_card           BOOLEAN DEFAULT FALSE,
  has_training_cert     BOOLEAN DEFAULT FALSE,
  zones_travail         TEXT[],
  transport_moyen       TEXT,

  -- Tarification
  intervention_types    TEXT[],
  daily_hours           NUMERIC,
  daily_earnings        INTEGER,
  hourly_rate_declared  INTEGER,

  -- Matériaux
  materials_used        JSONB DEFAULT '[]',

  -- Équipement
  has_own_tools         BOOLEAN DEFAULT TRUE,
  tools_description     TEXT,

  UNIQUE (artisan_id)
);

-- RLS
ALTER TABLE artisan_questionnaire_submissions ENABLE ROW LEVEL SECURITY;

-- L'artisan peut lire et modifier sa propre soumission
CREATE POLICY "artisan_own" ON artisan_questionnaire_submissions
  FOR ALL
  USING (
    artisan_id IN (
      SELECT id FROM artisan_pros WHERE user_id = auth.uid()
    )
  );

-- L'admin peut tout lire
CREATE POLICY "admin_all" ON artisan_questionnaire_submissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- Seed : données réalistes pour les artisans existants
-- ============================================================

-- Plombiers
INSERT INTO artisan_questionnaire_submissions (
  artisan_id, status, experience_years, has_id_card, has_training_cert,
  zones_travail, intervention_types, transport_moyen,
  daily_hours, daily_earnings, hourly_rate_declared,
  materials_used, has_own_tools, tools_description
)
SELECT
  id,
  'approved',
  8, TRUE, FALSE,
  ARRAY['Cocody','Marcory','Plateau','Zone 4'],
  ARRAY['Fuite d''eau','Robinet cassé','Débouchage WC','Installation évier'],
  'moto',
  8, 25000, 3125,
  '[{"name":"Joint plomberie","category":"Plomberie","unit":"pièce","price_fcfa":350,"qty_per_intervention":3},{"name":"Tuyau PVC 1m","category":"Plomberie","unit":"mètre","price_fcfa":1200,"qty_per_intervention":2},{"name":"Robinet mélangeur","category":"Plomberie","unit":"pièce","price_fcfa":8500,"qty_per_intervention":1},{"name":"Colle PVC","category":"Plomberie","unit":"tube","price_fcfa":1500,"qty_per_intervention":1},{"name":"Ruban téflon","category":"Plomberie","unit":"rouleau","price_fcfa":200,"qty_per_intervention":2}]'::jsonb,
  TRUE, 'Clé à molette, pince multiprise, coupe-tuyau, débouchoir'
FROM artisan_pros WHERE metier = 'Plombier' LIMIT 3
ON CONFLICT (artisan_id) DO NOTHING;

-- Électriciens
INSERT INTO artisan_questionnaire_submissions (
  artisan_id, status, experience_years, has_id_card, has_training_cert,
  zones_travail, intervention_types, transport_moyen,
  daily_hours, daily_earnings, hourly_rate_declared,
  materials_used, has_own_tools, tools_description
)
SELECT
  id,
  'approved',
  12, TRUE, TRUE,
  ARRAY['Cocody','Deux-Plateaux','Angré','Riviera'],
  ARRAY['Panne électrique','Installation prise','Tableau électrique','Éclairage'],
  'moto',
  8, 28000, 3500,
  '[{"name":"Câble électrique 2.5mm","category":"Électricité","unit":"mètre","price_fcfa":1500,"qty_per_intervention":10},{"name":"Disjoncteur","category":"Électricité","unit":"pièce","price_fcfa":4500,"qty_per_intervention":1},{"name":"Gaine ICTA 20mm","category":"Électricité","unit":"mètre","price_fcfa":500,"qty_per_intervention":5},{"name":"Prise de courant","category":"Électricité","unit":"pièce","price_fcfa":2500,"qty_per_intervention":2},{"name":"Interrupteur","category":"Électricité","unit":"pièce","price_fcfa":1800,"qty_per_intervention":2}]'::jsonb,
  TRUE, 'Multimètre, pince ampèremétrique, tournevis isolés, perceuse'
FROM artisan_pros WHERE metier = 'Électricien' LIMIT 3
ON CONFLICT (artisan_id) DO NOTHING;

-- Peintres
INSERT INTO artisan_questionnaire_submissions (
  artisan_id, status, experience_years, has_id_card, has_training_cert,
  zones_travail, intervention_types, transport_moyen,
  daily_hours, daily_earnings, hourly_rate_declared,
  materials_used, has_own_tools, tools_description
)
SELECT
  id,
  'approved',
  6, TRUE, FALSE,
  ARRAY['Yopougon','Abobo','Adjamé','Attécoubé'],
  ARRAY['Peinture intérieure','Enduit','Ravalement façade','Peinture plafond'],
  'pied',
  9, 22000, 2444,
  '[{"name":"Peinture acrylique 20L","category":"Peinture","unit":"pot","price_fcfa":22000,"qty_per_intervention":1},{"name":"Sous-couche universelle","category":"Peinture","unit":"pot","price_fcfa":15000,"qty_per_intervention":1},{"name":"Enduit de lissage","category":"Peinture","unit":"sac","price_fcfa":4500,"qty_per_intervention":2},{"name":"Rouleau peinture","category":"Peinture","unit":"pièce","price_fcfa":2500,"qty_per_intervention":1},{"name":"Pinceau 100mm","category":"Peinture","unit":"pièce","price_fcfa":1500,"qty_per_intervention":1}]'::jsonb,
  TRUE, 'Rouleaux, pinceaux, bac à peinture, ponceuse, échafaudage léger'
FROM artisan_pros WHERE metier = 'Peintre' LIMIT 3
ON CONFLICT (artisan_id) DO NOTHING;

-- Maçons
INSERT INTO artisan_questionnaire_submissions (
  artisan_id, status, experience_years, has_id_card, has_training_cert,
  zones_travail, intervention_types, transport_moyen,
  daily_hours, daily_earnings, hourly_rate_declared,
  materials_used, has_own_tools, tools_description
)
SELECT
  id,
  'approved',
  15, TRUE, FALSE,
  ARRAY['Cocody','Marcory','Koumassi','Port-Bouët'],
  ARRAY['Réparation fissure','Carrelage','Enduit béton','Construction muret'],
  'voiture',
  9, 25000, 2778,
  '[{"name":"Ciment 50kg","category":"Maçonnerie","unit":"sac","price_fcfa":8500,"qty_per_intervention":2},{"name":"Sable grossier","category":"Maçonnerie","unit":"sac","price_fcfa":2000,"qty_per_intervention":3},{"name":"Brique creuse","category":"Maçonnerie","unit":"pièce","price_fcfa":300,"qty_per_intervention":20},{"name":"Fer à béton 10mm","category":"Maçonnerie","unit":"barre","price_fcfa":4500,"qty_per_intervention":5},{"name":"Gravier","category":"Maçonnerie","unit":"sac","price_fcfa":2500,"qty_per_intervention":2}]'::jsonb,
  TRUE, 'Truelle, niveau, masse, perceuse béton, bétonnière'
FROM artisan_pros WHERE metier = 'Maçon' LIMIT 3
ON CONFLICT (artisan_id) DO NOTHING;
