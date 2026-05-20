-- Migration 004 — Mode System (Urgent / Standard / Libre) + War Room + Cas C
-- À exécuter dans Supabase SQL Editor

-- ── 1. Extension table missions ──────────────────────────────────────────────

ALTER TABLE missions ADD COLUMN IF NOT EXISTS mode VARCHAR(20)
  CHECK (mode IN ('urgent', 'standard', 'libre'));

ALTER TABLE missions ADD COLUMN IF NOT EXISTS sensitivity_coef DECIMAL(3,2);
ALTER TABLE missions ADD COLUMN IF NOT EXISTS temporal_coef DECIMAL(3,2);

ALTER TABLE missions ADD COLUMN IF NOT EXISTS insurance_taken BOOLEAN DEFAULT FALSE;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS insurance_amount INTEGER DEFAULT 0;

-- Cas de résolution : A = résolu proprement, B = partiel, C = litige grave
ALTER TABLE missions ADD COLUMN IF NOT EXISTS resolution_case VARCHAR(1)
  CHECK (resolution_case IN ('A', 'B', 'C'));

ALTER TABLE missions ADD COLUMN IF NOT EXISTS related_mission_id UUID REFERENCES missions(id);

ALTER TABLE missions ADD COLUMN IF NOT EXISTS final_amount_client INTEGER;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS amount_artisan INTEGER;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS amount_afrione INTEGER;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS refund_amount INTEGER DEFAULT 0;

-- ── 2. Statuts : ajout 'dispatching' pour le flow Urgent ─────────────────────
-- 'dispatching' = système cherche activement un artisan (Uber-style, 30-45s par tentative)
-- Distinct de 'matching' (Standard) où c'est le client qui choisit parmi 3

ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_status_check;
ALTER TABLE missions ADD CONSTRAINT missions_status_check
  CHECK (status IN (
    'diagnostic', 'matching', 'dispatching', 'negotiation', 'scheduled',
    'en_route', 'en_cours', 'payment',
    'pending_validation', 'completed', 'disputed', 'cancelled'
  ));

-- ── 3. Machine à états : mise à jour pour inclure 'dispatching' ───────────────

CREATE OR REPLACE FUNCTION validate_mission_transition()
RETURNS TRIGGER AS $$
DECLARE
  allowed JSONB := '{
    "diagnostic":         ["matching", "dispatching", "negotiation"],
    "matching":           ["negotiation", "payment", "cancelled"],
    "dispatching":        ["payment", "cancelled"],
    "negotiation":        ["scheduled", "en_route", "cancelled"],
    "scheduled":          ["en_route", "cancelled"],
    "en_route":           ["en_cours", "cancelled"],
    "en_cours":           ["payment", "disputed", "cancelled"],
    "payment":            ["pending_validation", "cancelled"],
    "pending_validation": ["completed", "disputed"],
    "disputed":           ["pending_validation", "completed", "cancelled"],
    "completed":          [],
    "cancelled":          []
  }';
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Transition interdite : la mission est déjà % (statut terminal)', OLD.status
      USING ERRCODE = 'check_violation';
  END IF;
  IF NOT (allowed->OLD.status @> to_jsonb(NEW.status)) THEN
    RAISE EXCEPTION 'Transition interdite : % → %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. Extension table artisan_pros ──────────────────────────────────────────

ALTER TABLE artisan_pros ADD COLUMN IF NOT EXISTS level VARCHAR(20)
  CHECK (level IN ('N1', 'N2', 'N3', 'N4'));

ALTER TABLE artisan_pros ADD COLUMN IF NOT EXISTS hourly_rate INTEGER;

-- Compteurs pour le ratio Cas C (calculé auto)
ALTER TABLE artisan_pros ADD COLUMN IF NOT EXISTS cas_c_count INTEGER DEFAULT 0;
ALTER TABLE artisan_pros ADD COLUMN IF NOT EXISTS total_missions INTEGER DEFAULT 0;
ALTER TABLE artisan_pros ADD COLUMN IF NOT EXISTS cas_c_ratio DECIMAL(5,2)
  GENERATED ALWAYS AS (
    CASE WHEN total_missions > 0
    THEN ROUND((cas_c_count::decimal / total_missions * 100), 2)
    ELSE 0
    END
  ) STORED;

-- Suspension temporaire (>10% Cas C déclenche review admin)
ALTER TABLE artisan_pros ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;

-- ── 5. Extension table chat_history ──────────────────────────────────────────
-- sender_type pilote le rendu War Room :
--   client        → droite, fond bleu clair
--   artisan       → gauche, fond gris clair
--   afrione_system → centré, fond orange, italique

ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS sender_type VARCHAR(20) DEFAULT 'client'
  CHECK (sender_type IN ('client', 'artisan', 'afrione_system'));

-- trigger_type identifie pourquoi le système a réagi (pour stats et analytics)
ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(50)
  CHECK (trigger_type IN (
    'price_alert_20', 'contact_share', 'off_platform_payment',
    'abusive_language', 'price_validated', NULL
  ));

ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS metadata JSONB;

-- ── 6. Nouvelle table : dispatch_attempts ────────────────────────────────────
-- Trace chaque tentative de dispatch en mode Urgent
-- Timeout = 30-45s par artisan avant de passer au suivant

CREATE TABLE IF NOT EXISTS dispatch_attempts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id     UUID REFERENCES missions(id) ON DELETE CASCADE,
  artisan_id     UUID REFERENCES artisan_pros(id),
  attempt_number INTEGER NOT NULL DEFAULT 1,
  notified_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at     TIMESTAMPTZ,                -- notified_at + 45s
  response       VARCHAR(20) CHECK (response IN ('accepted', 'refused', 'timeout')),
  responded_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dispatch_mission ON dispatch_attempts(mission_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_artisan ON dispatch_attempts(artisan_id);
-- Index partiel pour trouver les tentatives en attente rapidement
CREATE INDEX IF NOT EXISTS idx_dispatch_pending
  ON dispatch_attempts(mission_id, expires_at)
  WHERE response IS NULL;

-- ── 7. Nouvelle table : prestations_catalog ──────────────────────────────────

CREATE TABLE IF NOT EXISTS prestations_catalog (
  id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                       VARCHAR(50) UNIQUE NOT NULL,
  category                   VARCHAR(50) NOT NULL,
  label                      VARCHAR(255) NOT NULL,
  description                TEXT,
  base_price                 INTEGER NOT NULL,          -- FCFA
  estimated_duration_minutes INTEGER NOT NULL,
  required_level             VARCHAR(20) NOT NULL,
  default_sensitivity        VARCHAR(20),
  available_modes            VARCHAR(50) DEFAULT 'urgent,standard,libre',
  created_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. Nouvelle table : cas_c_reports ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cas_c_reports (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id        UUID REFERENCES missions(id),
  artisan_id        UUID REFERENCES artisan_pros(id),
  client_id         UUID REFERENCES users(id),
  video_url         TEXT,
  reason            TEXT,
  refund_decision   VARCHAR(20) CHECK (refund_decision IN ('full', 'partial', 'refused')),
  refund_amount     INTEGER,
  reviewed_by_admin BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. Nouvelle table : pricing_alerts ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS pricing_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id      UUID REFERENCES missions(id),
  proposed_price  INTEGER,
  market_low      INTEGER,
  market_high     INTEGER,
  alert_level     VARCHAR(20) CHECK (alert_level IN ('info', 'warning', 'critical')),
  client_response VARCHAR(20),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. Seed : catalogue des 20 prestations ───────────────────────────────────

INSERT INTO prestations_catalog
  (code, category, label, base_price, estimated_duration_minutes, required_level, default_sensitivity)
VALUES
  ('PLOMB_ROBINET_FUITE',   'plomberie',     'Robinet qui fuit',              5500,  45,  'N2', 'gênant'),
  ('PLOMB_WC_BOUCHE',       'plomberie',     'WC bouché',                     4500,  30,  'N2', 'urgent'),
  ('PLOMB_FUITE_TUYAU',     'plomberie',     'Fuite tuyau apparent',          8000,  60,  'N2', 'critique'),
  ('PLOMB_VIDANGE_CHAUFFE', 'plomberie',     'Vidange chauffe-eau',           6500,  90,  'N2', 'normal'),
  ('PLOMB_POMPE',           'plomberie',     'Remplacement pompe à eau',     12000, 120,  'N2', 'urgent'),
  ('ELEC_PRISE_HS',         'electricite',   'Prise qui ne marche pas',       4000,  30,  'N2', 'gênant'),
  ('ELEC_COURT_CIRCUIT',    'electricite',   'Court-circuit tableau',        10000,  90,  'N3', 'critique'),
  ('ELEC_POSE_PRISE',       'electricite',   'Pose prise supplémentaire',     5000,  45,  'N2', 'normal'),
  ('ELEC_DISJONCTEUR_HS',   'electricite',   'Disjoncteur sauté',             6000,  45,  'N2', 'urgent'),
  ('ELEC_POSE_VENTILO',     'electricite',   'Pose ventilateur plafond',      8500,  60,  'N2', 'normal'),
  ('CLIM_DIAGNOSTIC',       'climatisation', 'Diagnostic clim',               6000,  30,  'N3', 'gênant'),
  ('CLIM_NETTOYAGE_SPLIT',  'climatisation', 'Nettoyage clim split',          8000,  60,  'N2', 'normal'),
  ('CLIM_RECHARGE_GAZ',     'climatisation', 'Recharge gaz clim',            12000,  60,  'N3', 'urgent'),
  ('CLIM_INSTALLATION',     'climatisation', 'Installation clim split',      25000, 180,  'N3', 'normal'),
  ('CLIM_PANNE_TOTALE',     'climatisation', 'Diagnostic panne totale',       8000,  45,  'N3', 'urgent'),
  ('SERR_OUVERTURE_PORTE',  'serrurerie',    'Ouverture porte claquée',       8000,  30,  'N2', 'urgent'),
  ('SERR_CYLINDRE',         'serrurerie',    'Remplacement cylindre',        12000,  45,  'N2', 'normal'),
  ('SERR_REPARATION',       'serrurerie',    'Réparation serrure cassée',    10000,  60,  'N2', 'critique'),
  ('SERR_BLINDAGE',         'serrurerie',    'Pose blindage porte',          35000, 240,  'N3', 'normal'),
  ('SERR_VOITURE',          'serrurerie',    'Ouverture voiture sans clé',   10000,  30,  'N2', 'urgent')
ON CONFLICT (code) DO NOTHING;
