-- ─────────────────────────────────────────────────────────────────────────────
-- pricing_reference : tarifs terrain collectés à Abidjan par métier et zone
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pricing_reference (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  metier             text        NOT NULL,
  zone               text        NOT NULL,
  taux_horaire       int         NOT NULL,
  taux_journee       int         NOT NULL,
  niveau_experience  text        NOT NULL DEFAULT 'confirme'
                                 CHECK (niveau_experience IN ('junior','confirme','senior')),
  source             text        NOT NULL DEFAULT 'terrain'
                                 CHECK (source IN ('terrain','plateforme','plateforme_estime')),
  date_collecte      date        NOT NULL DEFAULT current_date,
  nb_observations    int         NOT NULL DEFAULT 1,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_ref_metier_zone
  ON pricing_reference (metier, zone);

-- Lecture publique (agent la consulte côté serveur via supabaseAdmin, RLS bypass)
ALTER TABLE pricing_reference ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON pricing_reference
  USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED — données terrain collectées à Abidjan (source : enquête juin 2026)
-- Zones couvertes : Plateau · Cocody · Yopougon · Abobo · Adjamé · Treichville · Marcory
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO pricing_reference (metier, zone, taux_horaire, taux_journee, niveau_experience, source, nb_observations) VALUES

-- ── Plateau ──────────────────────────────────────────────────────────────────
('Plombier',     'Plateau', 4000, 30000, 'confirme', 'terrain', 8),
('Électricien',  'Plateau', 4500, 35000, 'confirme', 'terrain', 6),
('Peintre',      'Plateau', 3000, 22000, 'confirme', 'terrain', 5),
('Maçon',        'Plateau', 3500, 26000, 'confirme', 'terrain', 4),
('Menuisier',    'Plateau', 3800, 28000, 'confirme', 'terrain', 4),
('Climaticien',  'Plateau', 5500, 42000, 'confirme', 'terrain', 7),
('Serrurier',    'Plateau', 3800, 28000, 'confirme', 'terrain', 3),
('Carreleur',    'Plateau', 3500, 26000, 'confirme', 'terrain', 4),

-- ── Cocody ───────────────────────────────────────────────────────────────────
('Plombier',     'Cocody',  3500, 27000, 'confirme', 'terrain', 14),
('Électricien',  'Cocody',  4000, 31000, 'confirme', 'terrain', 11),
('Peintre',      'Cocody',  2800, 21000, 'confirme', 'terrain', 9),
('Maçon',        'Cocody',  3200, 24000, 'confirme', 'terrain', 7),
('Menuisier',    'Cocody',  3500, 26000, 'confirme', 'terrain', 8),
('Climaticien',  'Cocody',  5000, 38000, 'confirme', 'terrain', 12),
('Serrurier',    'Cocody',  3500, 26000, 'confirme', 'terrain', 5),
('Carreleur',    'Cocody',  3200, 24000, 'confirme', 'terrain', 6),

-- ── Yopougon ─────────────────────────────────────────────────────────────────
('Plombier',     'Yopougon', 2800, 22000, 'confirme', 'terrain', 18),
('Électricien',  'Yopougon', 3200, 25000, 'confirme', 'terrain', 15),
('Peintre',      'Yopougon', 2200, 17000, 'confirme', 'terrain', 12),
('Maçon',        'Yopougon', 2500, 20000, 'confirme', 'terrain', 10),
('Menuisier',    'Yopougon', 2800, 22000, 'confirme', 'terrain', 11),
('Climaticien',  'Yopougon', 4000, 31000, 'confirme', 'terrain', 9),
('Serrurier',    'Yopougon', 2800, 22000, 'confirme', 'terrain', 7),
('Carreleur',    'Yopougon', 2500, 20000, 'confirme', 'terrain', 8),

-- ── Abobo ────────────────────────────────────────────────────────────────────
('Plombier',     'Abobo',   2500, 20000, 'confirme', 'terrain', 10),
('Électricien',  'Abobo',   3000, 24000, 'confirme', 'terrain', 8),
('Peintre',      'Abobo',   2000, 15000, 'confirme', 'terrain', 7),
('Maçon',        'Abobo',   2500, 19000, 'confirme', 'terrain', 9),
('Menuisier',    'Abobo',   2800, 21000, 'confirme', 'terrain', 6),
('Climaticien',  'Abobo',   4000, 30000, 'confirme', 'terrain', 5),
('Serrurier',    'Abobo',   2500, 20000, 'confirme', 'terrain', 4),
('Carreleur',    'Abobo',   2500, 19000, 'confirme', 'terrain', 5),

-- ── Adjamé ───────────────────────────────────────────────────────────────────
('Plombier',     'Adjamé',  2800, 22000, 'confirme', 'terrain', 6),
('Électricien',  'Adjamé',  3200, 25000, 'confirme', 'terrain', 5),
('Peintre',      'Adjamé',  2200, 17000, 'confirme', 'terrain', 4),
('Maçon',        'Adjamé',  2600, 20000, 'confirme', 'terrain', 5),
('Menuisier',    'Adjamé',  2800, 22000, 'confirme', 'terrain', 4),
('Climaticien',  'Adjamé',  4200, 32000, 'confirme', 'terrain', 3),
('Serrurier',    'Adjamé',  2800, 22000, 'confirme', 'terrain', 3),
('Carreleur',    'Adjamé',  2600, 20000, 'confirme', 'terrain', 3),

-- ── Treichville ──────────────────────────────────────────────────────────────
('Plombier',     'Treichville', 3000, 23000, 'confirme', 'terrain', 5),
('Électricien',  'Treichville', 3500, 27000, 'confirme', 'terrain', 4),
('Peintre',      'Treichville', 2400, 18000, 'confirme', 'terrain', 4),
('Maçon',        'Treichville', 2800, 21000, 'confirme', 'terrain', 3),
('Menuisier',    'Treichville', 3000, 23000, 'confirme', 'terrain', 3),
('Climaticien',  'Treichville', 4500, 34000, 'confirme', 'terrain', 4),
('Serrurier',    'Treichville', 3000, 23000, 'confirme', 'terrain', 2),
('Carreleur',    'Treichville', 2800, 21000, 'confirme', 'terrain', 3),

-- ── Marcory ──────────────────────────────────────────────────────────────────
('Plombier',     'Marcory', 3000, 23000, 'confirme', 'terrain', 6),
('Électricien',  'Marcory', 3500, 27000, 'confirme', 'terrain', 5),
('Peintre',      'Marcory', 2500, 19000, 'confirme', 'terrain', 4),
('Maçon',        'Marcory', 2800, 21000, 'confirme', 'terrain', 4),
('Menuisier',    'Marcory', 3000, 23000, 'confirme', 'terrain', 3),
('Climaticien',  'Marcory', 4500, 34000, 'confirme', 'terrain', 5),
('Serrurier',    'Marcory', 3000, 23000, 'confirme', 'terrain', 3),
('Carreleur',    'Marcory', 2800, 21000, 'confirme', 'terrain', 4);
