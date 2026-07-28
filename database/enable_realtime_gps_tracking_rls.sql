-- ============================================
-- FIX : RLS sur gps_tracking — même cause que dispatch_attempts
-- ============================================
-- Table jamais couverte par RLS. Contrairement à dispatch_attempts (lecture
-- seule côté client), l'artisan y écrit directement sa position GPS depuis
-- le navigateur (src/app/suivi/[id]/page.tsx, pas via une API serveur) —
-- il faut donc une policy SELECT (client + artisan de la mission) ET une
-- policy INSERT (artisan de la mission uniquement).
--
-- À exécuter dans Supabase SQL Editor.
-- ============================================

ALTER TABLE gps_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gps_tracking_participants_read" ON gps_tracking FOR SELECT USING (
  mission_id IN (
    SELECT id FROM missions WHERE
    client_id = auth.uid() OR
    artisan_id IN (SELECT id FROM artisan_pros WHERE user_id = auth.uid())
  )
);

CREATE POLICY "gps_tracking_artisan_insert" ON gps_tracking FOR INSERT WITH CHECK (
  mission_id IN (
    SELECT id FROM missions WHERE
    artisan_id IN (SELECT id FROM artisan_pros WHERE user_id = auth.uid())
  )
);

-- Vérification — doit renvoyer 1 ligne (rowsecurity = true)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'gps_tracking';
