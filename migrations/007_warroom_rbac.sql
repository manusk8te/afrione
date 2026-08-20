-- Migration 007 — Autorisation par rôle dans la War Room
-- Idempotente : rejouable sans risque.
--
-- Appliquée et vérifiée le 2026-08-20 :
--   node scripts/sql.mjs -f migrations/007_warroom_rbac.sql
--
-- Trois tests joués en transaction annulée après application :
--   client → status 'pending_validation'  refusé  (42501, enforce_mission_actor)
--   artisan → status 'pending_validation' accepté
--   client → chat sender_role 'artisan'   refusé  (42501, enforce_chat_sender_role)
--
-- Contexte (audit du 2026-08-13) : toute la séparation client / artisan de la
-- War Room vivait dans le navigateur, sous la forme d'un booléen `isArtisan`
-- recopié dans une quarantaine de conditions JSX. Masquer un bouton n'a jamais
-- été une autorisation.
--
-- ⚠️ Cette migration a été réécrite le 2026-08-20 après lecture de la base.
-- La version initiale supposait une policy `missions_participants` en FOR ALL
-- à découper. Elle n'existait plus : le découpage lecture / écriture avait déjà
-- été fait, sous d'autres noms (`missions_read`, `missions_update`,
-- `clients_create_missions`, `chat_read`, `chat_insert`). Rejouer la version
-- initiale aurait créé un second jeu de policies faisant doublon — sans trou de
-- sécurité, les policies permissives se cumulant par OR, mais avec deux jeux de
-- règles à maintenir pour un seul effet.
--
-- État constaté avant application :
--   missions      RLS actif · SELECT/UPDATE/INSERT présents · aucune policy DELETE
--   chat_history  RLS actif · SELECT/INSERT présents        · aucune policy DELETE
--   triggers      mission_state_machine (006) uniquement
--
-- Ce qui manquait réellement : les deux gardes de rôle ci-dessous. Les policies
-- disent QUI touche la ligne ; elles ne disent pas QUEL RÔLE pose QUEL statut.
-- « negotiation → en_cours » est une transition légale (trigger 006), mais pas
-- pour le client — et rien ne l'empêchait.

-- ── 1. missions : qui a le droit de poser quel statut ────────────────────────
--
-- Le trigger 006 (validate_mission_transition) dit quelles transitions sont
-- possibles. Celui-ci dit QUI peut les déclencher. Les deux sont nécessaires.
--
-- auth.uid() IS NULL = contexte service_role (routes API), qui a déjà vérifié
-- le rôle applicativement via src/lib/mission-auth.ts.

CREATE OR REPLACE FUNCTION enforce_mission_actor()
RETURNS TRIGGER AS $$
DECLARE
  uid          uuid := auth.uid();
  est_client   boolean;
  est_artisan  boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- service_role : l'autorisation a déjà été faite côté API
  IF uid IS NULL THEN
    RETURN NEW;
  END IF;

  est_client  := (OLD.client_id = uid);
  est_artisan := EXISTS (
    SELECT 1 FROM artisan_pros
    WHERE id = OLD.artisan_id AND user_id = uid
  );

  IF NOT est_client AND NOT est_artisan THEN
    RAISE EXCEPTION 'Vous n''êtes pas partie prenante de cette mission'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Réservé à l'artisan assigné : présence sur place et fin des travaux.
  IF NEW.status IN ('en_cours', 'pending_validation') AND NOT est_artisan THEN
    RAISE EXCEPTION 'Statut % réservé à l''artisan de la mission', NEW.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Réservé au client : il paie, il programme, il valide, il conteste.
  IF NEW.status IN ('payment', 'scheduled', 'completed', 'disputed') AND NOT est_client THEN
    RAISE EXCEPTION 'Statut % réservé au client de la mission', NEW.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 'en_route' et 'cancelled' restent ouverts aux deux parties :
  -- le client déclenche « intervention maintenant », l'artisan « je pars ».

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS mission_actor_guard ON missions;

-- BEFORE UPDATE OF status, et APRÈS mission_state_machine dans l'ordre
-- alphabétique des noms de trigger — les deux s'exécutent, l'ordre importe peu
-- puisqu'aucun ne modifie NEW.
CREATE TRIGGER mission_actor_guard
  BEFORE UPDATE OF status ON missions
  FOR EACH ROW
  EXECUTE FUNCTION enforce_mission_actor();

-- ── 2. chat_history : on signe ce qu'on écrit ────────────────────────────────
-- `sender_id` et `sender_role` étaient déclarés par le navigateur. Le rendu des
-- devis dépend de `sender_role = 'client'` : un client pouvait donc afficher
-- chez l'artisan une carte « DEVIS ARTISAN » qu'il avait écrite lui-même.
--
-- La policy `chat_insert` vérifie déjà `sender_id = auth.uid()`. Elle ne dit
-- rien de `sender_role`, qui restait libre.

CREATE OR REPLACE FUNCTION enforce_chat_sender_role()
RETURNS TRIGGER AS $$
DECLARE
  uid         uuid := auth.uid();
  est_client  boolean;
  est_artisan boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN NEW;  -- service_role : messages système émis par les routes API
  END IF;

  SELECT
    (m.client_id = uid),
    EXISTS (SELECT 1 FROM artisan_pros ap WHERE ap.id = m.artisan_id AND ap.user_id = uid)
  INTO est_client, est_artisan
  FROM missions m WHERE m.id = NEW.mission_id;

  IF NEW.sender_role = 'client'  AND NOT est_client THEN
    RAISE EXCEPTION 'sender_role = client : vous n''êtes pas le client de cette mission'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.sender_role = 'artisan' AND NOT est_artisan THEN
    RAISE EXCEPTION 'sender_role = artisan : vous n''êtes pas l''artisan de cette mission'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS chat_sender_role_guard ON chat_history;
CREATE TRIGGER chat_sender_role_guard
  BEFORE INSERT ON chat_history
  FOR EACH ROW
  EXECUTE FUNCTION enforce_chat_sender_role();

-- ── Volontairement absent ────────────────────────────────────────────────────
--
-- Policy UPDATE sur chat_history : la version initiale en prévoyait une pour
-- l'accusé de lecture. Aucun UPDATE sur `chat_history` n'existe dans le code
-- (vérifié le 2026-08-20). L'ajouter ouvrirait une écriture dont rien n'a
-- besoin — le contenu d'un message reste immuable.
--
-- Policy DELETE : aucune, sur les deux tables. RLS étant actif, l'absence de
-- policy vaut refus. Une mission ne se supprime pas, elle s'annule.
