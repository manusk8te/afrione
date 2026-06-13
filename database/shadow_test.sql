-- ─────────────────────────────────────────────────────────────────────────────
-- Shadow-mode test infrastructure
-- Cas de test Abidjan avec prix attendus pour calibrer l'agent IA (1 mois)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pricing_test_cases (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  label         text        NOT NULL,
  category      text        NOT NULL,
  metier        text        NOT NULL,
  quartier      text        NOT NULL,
  urgency       text        NOT NULL DEFAULT 'medium'
                            CHECK (urgency IN ('low','medium','high','emergency')),
  hours         numeric     NOT NULL,
  description   text        NOT NULL,
  items_needed  text[]      NOT NULL DEFAULT '{}',
  expected_min  int         NOT NULL,
  expected_max  int         NOT NULL,
  source_note   text,
  active        bool        NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- expected_min / expected_max dupliqués ici pour calcul sans JOIN
CREATE TABLE IF NOT EXISTS shadow_test_results (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  test_case_id    uuid        NOT NULL REFERENCES pricing_test_cases(id) ON DELETE CASCADE,
  run_at          timestamptz DEFAULT now(),
  agent_price     int         NOT NULL,
  agent_breakdown jsonb,
  expected_min    int         NOT NULL,
  expected_max    int         NOT NULL,
  deviation_pct   numeric     GENERATED ALWAYS AS (
    ROUND(
      (agent_price::numeric - ((expected_min + expected_max) / 2.0)) /
      ((expected_min + expected_max) / 2.0) * 100,
      1
    )
  ) STORED,
  within_range    bool        GENERATED ALWAYS AS (
    agent_price >= expected_min AND agent_price <= expected_max
  ) STORED,
  agent_raw       jsonb
);

CREATE INDEX IF NOT EXISTS idx_shadow_results_case
  ON shadow_test_results(test_case_id, run_at DESC);

ALTER TABLE pricing_test_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON pricing_test_cases
  USING (true) WITH CHECK (true);

ALTER TABLE shadow_test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON shadow_test_results
  USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEED — 15 missions représentatives Abidjan (enquête terrain juin 2026)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO pricing_test_cases (label, category, metier, quartier, urgency, hours, description, items_needed, expected_min, expected_max, source_note) VALUES

-- ── Plomberie ────────────────────────────────────────────────────────────────
(
  'Fuite robinet · Cocody · normal',
  'Plomberie', 'Plombier', 'Cocody', 'medium', 2,
  'Fuite au robinet de cuisine, joint à remplacer',
  '{"joint robinet","joint caoutchouc"}',
  9000, 16000,
  'Enquête terrain juin 2026 : 10k–15k courant à Cocody, déplacement inclus'
),
(
  'Fuite robinet · Yopougon · normal',
  'Plomberie', 'Plombier', 'Yopougon', 'medium', 2,
  'Fuite au robinet de cuisine, joint à remplacer',
  '{"joint robinet","joint caoutchouc"}',
  7000, 12000,
  'Yopougon 15–20 % sous Cocody ; artisans locaux moins chers'
),
(
  'Débouchage évier · Cocody · urgent',
  'Plomberie', 'Plombier', 'Cocody', 'high', 2,
  'Évier bouché, ne s''écoule plus',
  '{"déboucheur chimique"}',
  13000, 22000,
  'Urgence +25 % ; débouchage 1–2h, Cocody'
),
(
  'Installation WC · Cocody · normal',
  'Plomberie', 'Plombier', 'Cocody', 'medium', 4,
  'Installation WC suspendu complet, avec matériaux',
  '{"cuvette WC","visserie","joint wax"}',
  28000, 48000,
  'Cuvette 15–25k + main-d''œuvre 4h Cocody'
),
(
  'Fuite tuyau mur · Plateau · urgence',
  'Plomberie', 'Plombier', 'Plateau', 'emergency', 3,
  'Tuyau PVC cassé dans le mur, dégât des eaux actif',
  '{"tuyau PVC 25mm","colle PVC","coude PVC"}',
  26000, 42000,
  'Plateau premium + urgence max ; cassure dans cloison'
),

-- ── Électricité ──────────────────────────────────────────────────────────────
(
  'Prise HS · Yopougon · normal',
  'Électricité', 'Électricien', 'Yopougon', 'medium', 1,
  'Prise murale ne fonctionne plus',
  '{"prise électrique","câble souple"}',
  6000, 11000,
  '1h main-d''œuvre + petit matériel à Yopougon'
),
(
  'Prise HS · Cocody · normal',
  'Électricité', 'Électricien', 'Cocody', 'medium', 1,
  'Prise murale ne fonctionne plus',
  '{"prise électrique","câble souple"}',
  8000, 14000,
  'Même mission à Cocody : déplacement + taux horaire plus élevé'
),
(
  'Disjoncteur principal · Cocody · urgent',
  'Électricité', 'Électricien', 'Cocody', 'high', 3,
  'Disjoncteur général saute en permanence, courant instable',
  '{"disjoncteur différentiel 40A","gaine électrique"}',
  22000, 38000,
  'Matériel disjoncteur 8–15k + 3h électricien + urgence'
),
(
  'Spots LED salon · Marcory · normal',
  'Électricité', 'Électricien', 'Marcory', 'medium', 2,
  'Installation 3 spots LED encastrés au plafond',
  '{"spot LED x3","câble électrique 2.5mm","interrupteur"}',
  14000, 25000,
  'Spots 2–3k l''unité + 2h main-d''œuvre à Marcory'
),

-- ── Peinture ─────────────────────────────────────────────────────────────────
(
  'Peinture chambre · Yopougon · normal',
  'Peinture', 'Peintre', 'Yopougon', 'medium', 6,
  'Peinture chambre 15m², une couleur, deux mains',
  '{"peinture vinylique 5L","rouleau","bâche de protection"}',
  18000, 32000,
  'Matériaux 5–8k + 6h peintre Yopougon ; prix relevés juin 2026'
),
(
  'Peinture salon · Cocody · normal',
  'Peinture', 'Peintre', 'Cocody', 'medium', 8,
  'Peinture salon 25m², deux mains, couleur au choix',
  '{"peinture vinylique 10L","rouleau","bâche","scotch de masquage"}',
  30000, 50000,
  'Grande surface + Cocody : peintre facture 2 800/h ; matériaux ~10k'
),

-- ── Climatisation ────────────────────────────────────────────────────────────
(
  'Entretien clim · Cocody · normal',
  'Climatisation', 'Climaticien', 'Cocody', 'medium', 2,
  'Nettoyage et entretien climatiseur split 12 000 BTU',
  '{"spray nettoyant clim","filtre de rechange"}',
  16000, 28000,
  'Nettoyage 2h + Cocody ; prix moyens relevés marché Abidjan'
),
(
  'Installation clim split · Plateau · normal',
  'Climatisation', 'Climaticien', 'Plateau', 'medium', 6,
  'Installation climatiseur split neuf, tuyaux et fixations',
  '{"tuyau cuivre 3m","mousse isolante","support mural","visserie"}',
  42000, 68000,
  'Long chantier 6h + Plateau premium + matériaux pose ~15k'
),

-- ── Maçonnerie ───────────────────────────────────────────────────────────────
(
  'Fissure mur extérieur · Abobo · normal',
  'Maçonnerie', 'Maçon', 'Abobo', 'medium', 3,
  'Fissure de 2m dans mur extérieur, rebouchage et enduit finition',
  '{"ciment gris 5kg","enduit de rebouchage","truelle"}',
  12000, 22000,
  'Matériaux bon marché + main-d''œuvre Abobo (taux bas)'
),

-- ── Carrelage ────────────────────────────────────────────────────────────────
(
  'Carrelage salle de bain · Cocody · normal',
  'Carrelage', 'Carreleur', 'Cocody', 'medium', 8,
  'Pose carrelage 6m² en salle de bain, joints compris',
  '{"colle carrelage 5kg","joint de carrelage","croisillons"}',
  36000, 60000,
  'Matériaux pose 10–18k + 8h carreleur Cocody'
);
