-- Migration 007 — Autorisation par rôle dans la War Room
-- À exécuter dans Supabase SQL Editor. Idempotente : rejouable sans risque.
--
-- Contexte (audit du 2026-08-13) : toute la séparation client / artisan de la
-- War Room vivait dans le navigateur, sous la forme d'un booléen `isArtisan`
-- recopié dans une quarantaine de conditions JSX. Côté base, la seule policy
-- concernée était :
--
--     CREATE POLICY "missions_participants" ON missions FOR ALL USING (
--       client_id = auth.uid() OR
--       artisan_id IN (SELECT id FROM artisan_pros WHERE user_id = auth.uid())
--     );
--
-- `FOR ALL`, sans `WITH CHECK` différencié, et sans aucune notion de rôle : le
-- client pouvait écrire `status = 'en_route'`, `'en_cours'` ou
-- `'pending_validation'` sur sa propre mission, c'est-à-dire exécuter toutes
-- les actions réservées à l'artisan. Masquer un bouton n'a jamais été une
-- autorisation.
--
-- Cette migration ajoute la contrepartie serveur du modèle de permissions
-- défini dans src/lib/mission-roles.ts.

-- ── 1. missions : qui a le droit de poser quel statut ────────────────────────
--
-- Le trigger 006 (validate_mission_transition) dit quelles transitions sont
-- possibles. Celui-ci dit QUI peut les déclencher. Les deux sont nécessaires :
-- « negotiation → en_cours » est une transition légale, mais pas pour le
-- client.
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

-- ── 2. missions : lecture / écriture explicites ──────────────────────────────
-- La policy `FOR ALL` couvrait aussi DELETE : un client pouvait supprimer une
-- mission payée, et avec elle la trace de la transaction.

DROP POLICY IF EXISTS "missions_participants" ON missions;

CREATE POLICY "missions_participants_read" ON missions FOR SELECT USING (
  client_id = auth.uid() OR
  artisan_id IN (SELECT id FROM artisan_pros WHERE user_id = auth.uid())
);

CREATE POLICY "missions_participants_update" ON missions FOR UPDATE
  USING (
    client_id = auth.uid() OR
    artisan_id IN (SELECT id FROM artisan_pros WHERE user_id = auth.uid())
  )
  WITH CHECK (
    -- Le client d'une mission ne change pas, et on ne se l'attribue pas.
    client_id = auth.uid() OR
    artisan_id IN (SELECT id FROM artisan_pros WHERE user_id = auth.uid())
  );

CREATE POLICY "missions_client_insert" ON missions FOR INSERT
  WITH CHECK (client_id = auth.uid());

-- Pas de policy DELETE : une mission ne se supprime pas, elle s'annule.

-- ── 3. chat_history : on signe ce qu'on écrit ────────────────────────────────
-- `sender_id` et `sender_role` étaient déclarés par le navigateur. Le rendu
-- des devis dépend de `sender_role === 'client'` : un client pouvait donc
-- afficher chez l'artisan une carte « DEVIS ARTISAN » qu'il avait écrite
-- lui-même.

DROP POLICY IF EXISTS "chat_participants" ON chat_history;

CREATE POLICY "chat_participants_read" ON chat_history FOR SELECT USING (
  mission_id IN (
    SELECT id FROM missions WHERE
    client_id = auth.uid() OR
    artisan_id IN (SELECT id FROM artisan_pros WHERE user_id = auth.uid())
  )
);

CREATE POLICY "chat_participants_insert" ON chat_history FOR INSERT WITH CHECK (
  sender_id = auth.uid()
  AND mission_id IN (
    SELECT id FROM missions WHERE
    client_id = auth.uid() OR
    artisan_id IN (SELECT id FROM artisan_pros WHERE user_id = auth.uid())
  )
);

-- UPDATE limité à l'accusé de lecture : le contenu d'un message est immuable.
CREATE POLICY "chat_participants_update" ON chat_history FOR UPDATE
  USING (
    mission_id IN (
      SELECT id FROM missions WHERE
      client_id = auth.uid() OR
      artisan_id IN (SELECT id FROM artisan_pros WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    mission_id IN (
      SELECT id FROM missions WHERE
      client_id = auth.uid() OR
      artisan_id IN (SELECT id FROM artisan_pros WHERE user_id = auth.uid())
    )
  );

-- Cohérence sender_role ↔ relation réelle à la mission.
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

-- ── 4. Vérifications ─────────────────────────────────────────────────────────
-- missions : 3 policies (read / update / insert), plus aucune FOR ALL
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'missions' ORDER BY policyname;
-- chat_history : 3 policies
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'chat_history' ORDER BY policyname;
-- 2 triggers sur missions (state machine + actor guard), 1 sur chat_history
SELECT event_object_table, trigger_name FROM information_schema.triggers
WHERE event_object_table IN ('missions', 'chat_history') ORDER BY 1, 2;
