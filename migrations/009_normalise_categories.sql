-- Migration 009 — Une seule orthographe par catégorie et par source
-- Idempotente : rejouable sans risque.
--
-- `/api/materials` cherche les matériaux en égalité stricte
-- (`.eq('category', …)`). Toute variante d'orthographe crée donc une catégorie
-- fantôme, invisible depuis la catégorie officielle.
--
-- Constaté le 2026-08-21 :
--   price_materials  « Électricité » 155 articles · « Electricite »  6
--                    « Maçonnerie »   58 articles · « Maconnerie »   6
--   missions         « Carreleur » 2 · « Maçon » 1 · « Electricite » 2
--
-- Une mission taguée « Electricite » voyait 6 matériaux au lieu de 161. Une
-- mission « Carreleur » n'en voyait aucun : le catalogue dit « Carrelage ».
--
-- src/lib/metier.ts absorbe désormais ces variantes à la lecture (comparaison
-- désaccentuée). Cette migration règle la contrepartie : les données elles-mêmes.
-- Les deux sont nécessaires — la normalisation à la lecture ne rend pas
-- visibles les lignes stockées sous l'autre orthographe.

-- ── 1. Catalogue matériaux : catégories ──────────────────────────────────────
UPDATE price_materials SET category = 'Électricité' WHERE category = 'Electricite';
UPDATE price_materials SET category = 'Maçonnerie'  WHERE category = 'Maconnerie';

-- ── 2. Catalogue matériaux : sources ─────────────────────────────────────────
-- Le même marché d'Adjamé comptait comme deux fournisseurs distincts.
UPDATE price_materials SET source = 'Adjamé'          WHERE source = 'Adjame';
UPDATE price_materials SET source = 'Marché Koumassi' WHERE source = 'Marche Koumassi';

-- ── 3. Missions : métier écrit à la place de la catégorie ────────────────────
-- « Carreleur » est le métier, « Carrelage » la catégorie. artisan_pros.metier
-- suit déjà la taxonomie canonique (voir scripts/normalize-metier.js) : aligner
-- missions.category dessus répare aussi le matching du dispatch.
UPDATE missions SET category = 'Carrelage'   WHERE category = 'Carreleur';
UPDATE missions SET category = 'Maçonnerie'  WHERE category = 'Maçon';
UPDATE missions SET category = 'Électricité' WHERE category = 'Electricite';

-- ── Volontairement non traité ────────────────────────────────────────────────
-- `missions.category = 'N/A'` (1) et une mission dont la catégorie contient la
-- liste entière des métiers collée en une chaîne : ce ne sont pas des variantes
-- d'orthographe mais des écritures ratées en amont. Les renommer inventerait un
-- métier que le client n'a jamais choisi. Elles restent visibles en base pour
-- qu'on traite la cause — voir le diagnostic qui les a produites.
