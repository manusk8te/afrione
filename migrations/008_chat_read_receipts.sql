-- Migration 008 — Accusés de lecture du chat
-- Idempotente : rejouable sans risque.
--
-- `chat_history` a RLS actif, une policy SELECT et une policy INSERT, et
-- aucune policy UPDATE. Or la War Room pose `read_at` à deux endroits
-- (src/app/warroom/[id]/page.tsx, au montage puis à chaque message reçu en
-- Realtime).
--
-- Sans policy UPDATE, Postgres ne refuse pas : il ne modifie rien. La requête
-- réussit, `error` est null, et zéro ligne est touchée. Le navigateur croit
-- avoir marqué le message lu. Constaté le 2026-08-21 : 223 messages avec
-- `read_at IS NULL`, dont des messages ouverts depuis des semaines.
--
-- La 007 prévoyait cette policy, puis l'a retirée sur une vérification fausse
-- (« aucun UPDATE sur chat_history dans le code ») — la recherche ne couvrait
-- pas les appels où `.from()` et `.update()` sont sur deux lignes.

-- ── 1. UPDATE réservé aux deux parties de la mission ─────────────────────────

DROP POLICY IF EXISTS "chat_participants_update" ON chat_history;

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

-- ── 2. Un message reste immuable, sauf son accusé de lecture ─────────────────
--
-- La policy ci-dessus autorise l'UPDATE de la ligne entière : RLS raisonne par
-- ligne, pas par colonne. Sans ce garde, ouvrir l'accusé de lecture ouvrirait
-- aussi la réécriture du texte d'un devis déjà accepté, ou le changement de
-- `sender_role` après coup — exactement ce que la 007 verrouille à l'INSERT.

CREATE OR REPLACE FUNCTION enforce_chat_immutable()
RETURNS TRIGGER AS $$
BEGIN
  -- service_role : les routes API corrigent parfois un message système.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.text        IS DISTINCT FROM OLD.text
  OR NEW.sender_id   IS DISTINCT FROM OLD.sender_id
  OR NEW.sender_role IS DISTINCT FROM OLD.sender_role
  OR NEW.type        IS DISTINCT FROM OLD.type
  OR NEW.mission_id  IS DISTINCT FROM OLD.mission_id THEN
    RAISE EXCEPTION 'Un message envoyé ne se modifie pas'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS chat_immutable_guard ON chat_history;
CREATE TRIGGER chat_immutable_guard
  BEFORE UPDATE ON chat_history
  FOR EACH ROW
  EXECUTE FUNCTION enforce_chat_immutable();
