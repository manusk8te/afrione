-- Migration 006 — Réparer le flux Urgent
-- À exécuter dans Supabase SQL Editor. Idempotente : rejouable sans risque.
--
-- Contexte : le trigger validate_mission_transition() (migration 004) refuse
-- des transitions que le code effectue en permanence. Vérifié en base le
-- 2026-08-10 sur une mission jetable :
--     payment → dispatching  BLOQUÉ : Transition interdite
-- Comme aucun de ces appels ne vérifiait `.error`, l'échec était invisible
-- côté serveur et remontait à l'artisan sous forme de « Mission expirée »
-- alors que la mission était bien vivante et libre.
--
-- Les sections 1 et 2 ci-dessous sont préventives : la vérification en base
-- montre que missions_status_check accepte déjà 'dispatching' et que
-- dispatch_attempts.response accepte déjà 'cancelled'. On les repose pour
-- que le schéma du dépôt corresponde à la base, quel que soit l'ordre dans
-- lequel les anciens fichiers SQL ont été rejoués.

-- ── 1. missions.status : réautoriser 'dispatching' et 'scheduled' ────────────
-- database/migration_validation_escrow.sql redéfinit missions_status_check SANS
-- 'dispatching' ni 'scheduled'. Si ce fichier a été rejoué après 004, tout
-- passage en dispatching échoue. On repose la liste complète.

ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_status_check;
ALTER TABLE missions ADD CONSTRAINT missions_status_check
  CHECK (status IN (
    'diagnostic', 'matching', 'dispatching', 'negotiation', 'scheduled',
    'en_route', 'en_cours', 'payment',
    'pending_validation', 'completed', 'disputed', 'cancelled'
  ));

-- ── 2. dispatch_attempts.response : autoriser 'cancelled' ────────────────────
-- Le broadcast urgent clôt les tentatives des artisans perdants avec
-- response='cancelled' (respond/route.ts, auto-assign/route.ts). Le CHECK de la
-- migration 004 ne connaît que accepted/refused/timeout → l'UPDATE échouait et
-- les tentatives restaient response=NULL indéfiniment : la carte urgente ne se
-- fermait jamais chez les autres artisans, qui cliquaient « Accepter » sur une
-- offre déjà remportée.

ALTER TABLE dispatch_attempts DROP CONSTRAINT IF EXISTS dispatch_attempts_response_check;
ALTER TABLE dispatch_attempts ADD CONSTRAINT dispatch_attempts_response_check
  CHECK (response IN ('accepted', 'refused', 'timeout', 'cancelled'));

-- ── 3. Machine à états : aligner sur les transitions réellement effectuées ───
-- Table dérivée des écritures de statut présentes dans le code :
--   mode-select            → diagnostic
--   matching / artisans    → negotiation
--   api/payment            → payment            (depuis negotiation)
--   simulate-pay / webhook → payment            (depuis diagnostic|matching)
--   startUrgentDispatch    → dispatching        (depuis payment)  ← manquait
--   respond / auto-assign  → en_route           (depuis dispatching) ← manquait
--   warroom confirmNow     → en_route           (depuis payment)  ← manquait
--   warroom confirmSched.  → scheduled          (depuis payment)  ← manquait
--   suivi                  → en_cours, pending_validation, disputed
--   validate-mission       → completed
--   cancelAndRefund        → cancelled          (depuis diagnostic aussi)

CREATE OR REPLACE FUNCTION validate_mission_transition()
RETURNS TRIGGER AS $$
DECLARE
  allowed JSONB := '{
    "diagnostic":         ["matching", "dispatching", "negotiation", "payment", "cancelled"],
    "matching":           ["negotiation", "dispatching", "payment", "cancelled"],
    "dispatching":        ["en_route", "payment", "cancelled"],
    "negotiation":        ["payment", "scheduled", "en_route", "cancelled"],
    "payment":            ["dispatching", "scheduled", "en_route", "pending_validation", "cancelled"],
    "scheduled":          ["en_route", "cancelled"],
    "en_route":           ["en_cours", "pending_validation", "cancelled"],
    "en_cours":           ["payment", "pending_validation", "disputed", "cancelled"],
    "pending_validation": ["completed", "disputed", "cancelled"],
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

DROP TRIGGER IF EXISTS mission_state_machine ON missions;
CREATE TRIGGER mission_state_machine
  BEFORE UPDATE OF status ON missions
  FOR EACH ROW
  EXECUTE FUNCTION validate_mission_transition();

-- ── 4. chat_history : une seule fiche technique par mission ──────────────────
-- Le brief est inséré par le premier arrivant sur un fil vide (warroom init).
-- Sans unicité, client et artisan qui ouvrent simultanément en créent deux.

DELETE FROM chat_history a
USING chat_history b
WHERE a.type = 'brief' AND b.type = 'brief'
  AND a.mission_id = b.mission_id
  AND a.created_at > b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_one_brief_per_mission
  ON chat_history (mission_id)
  WHERE type = 'brief';

-- ── 5. Rattrapage des données déjà corrompues par les bugs ci-dessus ─────────
-- Tentatives restées NULL sur des missions attribuées ou closes : elles
-- maintiennent la carte urgente ouverte chez des artisans qui ne peuvent plus
-- rien en faire.

UPDATE dispatch_attempts da
SET    response = 'cancelled', responded_at = NOW()
FROM   missions m
WHERE  da.mission_id = m.id
  AND  da.response IS NULL
  AND  m.status IN ('en_route', 'en_cours', 'pending_validation', 'completed', 'cancelled', 'disputed')
  AND  (m.artisan_id IS NULL OR m.artisan_id <> da.artisan_id);

UPDATE dispatch_attempts da
SET    response = 'accepted', responded_at = COALESCE(da.responded_at, NOW())
FROM   missions m
WHERE  da.mission_id = m.id
  AND  da.response IS NULL
  AND  m.artisan_id = da.artisan_id
  AND  m.status IN ('en_route', 'en_cours', 'pending_validation', 'completed');

-- Tentatives expirées depuis longtemps sur des missions encore en attente
UPDATE dispatch_attempts
SET    response = 'timeout', responded_at = NOW()
WHERE  response IS NULL
  AND  expires_at < NOW() - INTERVAL '5 minutes';
