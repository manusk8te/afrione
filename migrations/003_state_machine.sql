-- Migration 003 — Machine à états missions + contrainte double réservation
-- À exécuter dans Supabase SQL Editor

-- ── 3a : Trigger de validation des transitions ────────────────────────────────

CREATE OR REPLACE FUNCTION validate_mission_transition()
RETURNS TRIGGER AS $$
DECLARE
  allowed JSONB := '{
    "diagnostic":         ["matching", "negotiation"],
    "matching":           ["negotiation", "cancelled"],
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
  -- Pas de changement de statut → rien à valider
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Statuts terminaux : aucune sortie possible
  IF OLD.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Transition interdite : la mission est déjà % (statut terminal)', OLD.status
      USING ERRCODE = 'check_violation';
  END IF;

  -- Vérifier que la transition est dans la liste autorisée
  IF NOT (allowed->OLD.status @> to_jsonb(NEW.status)) THEN
    RAISE EXCEPTION 'Transition interdite : % → %', OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe déjà (idempotent)
DROP TRIGGER IF EXISTS mission_state_machine ON missions;

CREATE TRIGGER mission_state_machine
  BEFORE UPDATE OF status ON missions
  FOR EACH ROW
  EXECUTE FUNCTION validate_mission_transition();

-- ── 3c : Contrainte double réservation artisan ───────────────────────────────
-- Un artisan ne peut pas avoir 2 missions actives simultanément

DROP INDEX IF EXISTS idx_artisan_single_active_mission;

CREATE UNIQUE INDEX idx_artisan_single_active_mission
  ON missions (artisan_id)
  WHERE status IN ('en_route', 'en_cours') AND artisan_id IS NOT NULL;
