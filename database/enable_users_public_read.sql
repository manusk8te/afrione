-- ============================================
-- FIX : users_own bloque toute lecture croisée de la table users
-- ============================================
-- Diagnostic (2026-07-28, requête reproduite avec une session client réelle) :
-- matching/page.tsx (et artisan-space/dashboard pour les noms de clients dans
-- les conversations) font une jointure `users!...fkey(name, avatar_url, ...)`
-- depuis un autre compte que le propriétaire de la ligne. La policy
-- "users_own" (FOR ALL USING (auth.uid() = id)) bloque cette lecture sans
-- erreur — PostgREST renvoie simplement `users: null` pour la ressource
-- imbriquée. L'UI retombe alors sur un fallback générique (le métier au lieu
-- du nom), ce qui produit "plusieurs cartes identiques" au lieu d'une vraie
-- liste d'artisans nommés.
--
-- Deux policies additives (RLS OR les policies permissives entre elles,
-- users_own reste inchangée) :
-- 1. Un artisan approuvé est visible publiquement (nécessaire pour toute
--    page de sélection d'artisan).
-- 2. Un client est visible par l'artisan de sa mission (dashboard artisan,
--    listes de conversations, etc.).
--
-- Seuls les champs explicitement sélectionnés par chaque requête sont
-- retournés (name, avatar_url, quartier...) — RLS contrôle la visibilité de
-- la LIGNE, pas des colonnes ; aucune requête existante ne demande email/
-- phone dans ces embeds.
--
-- À exécuter dans Supabase SQL Editor.
-- ============================================

CREATE POLICY "users_public_artisan" ON users FOR SELECT USING (
  id IN (SELECT user_id FROM artisan_pros WHERE kyc_status = 'approved')
);

CREATE POLICY "users_client_visible_to_artisan" ON users FOR SELECT USING (
  id IN (
    SELECT client_id FROM missions
    WHERE artisan_id IN (SELECT id FROM artisan_pros WHERE user_id = auth.uid())
  )
);

-- Vérification — doit renvoyer 3 policies (users_own + les 2 nouvelles)
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'users';
