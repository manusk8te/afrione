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

ALTER PUBLICATION supabase_realtime ADD TABLE dispatch_attempts;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_history;
ALTER PUBLICATION supabase_realtime ADD TABLE missions;
ALTER PUBLICATION supabase_realtime ADD TABLE gps_tracking;

-- Vérification — doit lister les 4 tables ci-dessus
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('dispatch_attempts', 'chat_history', 'missions', 'gps_tracking');
