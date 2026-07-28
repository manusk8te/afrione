-- ============================================
-- FIX : Activer Supabase Realtime sur les tables utilisées par l'app
-- Sans ceci, tous les .channel().on('postgres_changes', ...) du code
-- restent silencieux — aucun événement n'est jamais poussé, il faut
-- rafraîchir manuellement pour voir un changement (messages warroom,
-- offre mission urgente, statut mission, position GPS).
--
-- Vérifié le 2026-07-28 par sonde live : INSERT sur dispatch_attempts,
-- chat_history et UPDATE sur missions ne déclenchent aucun événement
-- côté client malgré un abonnement souscrit avec succès.
--
-- À exécuter dans Supabase SQL Editor.
-- ============================================

-- ALTER PUBLICATION ... ADD TABLE ne supporte pas IF NOT EXISTS en Postgres.
-- Un bloc DO + exception par table évite qu'une table déjà membre
-- (duplicate_object, SQLSTATE 42710) ne fasse échouer tout le batch —
-- sans ça, les 4 ALTER tournent dans une seule transaction implicite et un
-- échec annule tout, y compris les ADD TABLE pas encore traités.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_attempts;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'dispatch_attempts déjà membre — ignoré';
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_history;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'chat_history déjà membre — ignoré';
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE missions;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'missions déjà membre — ignoré';
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE gps_tracking;
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'gps_tracking déjà membre — ignoré';
  END;
END $$;

-- Vérification — doit lister les 4 tables ci-dessus
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('dispatch_attempts', 'chat_history', 'missions', 'gps_tracking');
