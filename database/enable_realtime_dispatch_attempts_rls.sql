-- ============================================
-- FIX : RLS sur dispatch_attempts — requis pour que Realtime diffuse
-- ============================================
-- Diagnostic (2026-07-28, sonde live avec ALTER PUBLICATION déjà appliqué) :
-- dispatch_attempts ne délivre AUCUN événement INSERT/UPDATE via Realtime,
-- alors que la table est bien membre de la publication supabase_realtime,
-- que les GRANT de base fonctionnent (SELECT anonyme OK), et que le canal
-- se souscrit sans erreur. Seul DELETE passait — signature caractéristique
-- du comportement documenté de Supabase Realtime : postgres_changes exige
-- que Row Level Security soit ACTIVÉE sur la table pour autoriser la
-- diffusion, même si aucune restriction n'est nécessaire côté lecture REST
-- classique. dispatch_attempts est la seule table temps réel de l'app sans
-- RLS (missions, chat_history en ont déjà) — c'est la cause racine du bug
-- "l'offre urgente n'apparaît pas en direct".
--
-- La policy suit le même pattern que missions_participants /
-- chat_participants déjà en place : l'artisan voit ses propres offres,
-- le client voit les tentatives de sa propre mission (utilisé par
-- /dispatch/[missionId] pour synchroniser le countdown).
--
-- Aucun impact sur les écritures serveur (createDispatchAttempt,
-- /api/dispatch/respond, auto-assign…) — elles passent toutes par
-- supabaseAdmin (service role), qui contourne RLS.
--
-- À exécuter dans Supabase SQL Editor, après enable_realtime.sql.
-- ============================================

ALTER TABLE dispatch_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispatch_attempts_participants" ON dispatch_attempts FOR SELECT USING (
  artisan_id IN (SELECT id FROM artisan_pros WHERE user_id = auth.uid())
  OR mission_id IN (SELECT id FROM missions WHERE client_id = auth.uid())
);

-- Vérification — doit renvoyer 1 ligne (rowsecurity = true)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'dispatch_attempts';
