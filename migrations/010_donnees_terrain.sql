-- Migration 010 — Les deux tables d'apprentissage des prix
-- Idempotente : rejouable sans risque.
--
-- `/api/accepted-price` écrit dans `accepted_prices` et `pricing_reference`
-- depuis le début. Aucune des deux n'existait. La War Room appelle cette route
-- en `.catch(() => {})`, sans lire la réponse : chaque prix accepté depuis le
-- lancement est parti à la poubelle sans un message d'erreur.
--
-- Pire, `resolveHourlyRate` (src/lib/pricing-agent.ts) interroge
-- `pricing_reference` en priorité 2 et 3, avant le repli statique
-- `labor_rates` en priorité 4. La table étant absente, l'agent est TOUJOURS
-- tombé sur le repli. Toute la logique « données terrain réelles » n'a jamais
-- servi.
--
-- Ces tables accueillent deux sources : la plateforme (prix réellement
-- acceptés en mission) et la collecte manuelle (artisans interrogés à Abidjan,
-- devis reçus, factures). La colonne `source` les distingue — indispensable
-- pour pondérer plus tard, et pour ne pas confondre un prix observé sur le
-- terrain avec un prix que la plateforme a elle-même suggéré.

-- ── 1. pricing_reference — taux horaires observés ────────────────────────────
-- Lue par resolveHourlyRate, moyenne pondérée par `nb_observations`.
-- Une ligne = une observation (ou un agrégat, si nb_observations > 1).

CREATE TABLE IF NOT EXISTS pricing_reference (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ⚠️ NOM DU MÉTIER (« Menuisier »), pas la catégorie (« Menuiserie »).
  -- resolveHourlyRate compare à CATEGORY_TO_METIER[category]. Se tromper ici
  -- rend la ligne invisible — c'est le décalage qui privait déjà 6 missions de
  -- tout matériau (voir migration 009).
  metier            text    NOT NULL,
  zone              text    NOT NULL DEFAULT 'Abidjan',

  taux_horaire      integer NOT NULL CHECK (taux_horaire > 0),
  taux_journee      integer,
  niveau_experience text    DEFAULT 'confirme',

  -- 'plateforme' = déduit d'une mission réelle · 'terrain' = collecte manuelle
  -- · 'devis' = devis reçu d'un artisan · 'facture' = facture acquittée.
  source            text    NOT NULL DEFAULT 'terrain',
  date_collecte     date    NOT NULL DEFAULT CURRENT_DATE,

  -- Poids dans la moyenne. Un relevé auprès de 12 menuisiers vaut 12.
  nb_observations   integer NOT NULL DEFAULT 1 CHECK (nb_observations > 0),

  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- resolveHourlyRate filtre sur (metier, zone) puis sur metier seul.
CREATE INDEX IF NOT EXISTS idx_pricing_reference_metier_zone ON pricing_reference (metier, zone);
CREATE INDEX IF NOT EXISTS idx_pricing_reference_metier      ON pricing_reference (metier);

-- ── 2. accepted_prices — tâches observées, prix décomposé ────────────────────
-- Historique des prix réellement pratiqués. `mission_id` est NULL pour les
-- relevés de terrain, qui ne viennent d'aucune mission.

CREATE TABLE IF NOT EXISTS accepted_prices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id        uuid REFERENCES missions(id) ON DELETE SET NULL,

  -- CATÉGORIE (« Menuiserie »), cette fois — cohérent avec missions.category
  -- et price_materials.category.
  category          text    NOT NULL,
  quartier          text    NOT NULL DEFAULT 'Cocody',
  urgency           text    NOT NULL DEFAULT 'medium',

  -- Description courte de la tâche : « remplacer 2 charnières d'armoire ».
  -- C'est ce qui rend la ligne réutilisable pour une tâche comparable.
  description_short text,

  hours             numeric(6,2) CHECK (hours IS NULL OR hours > 0),
  materials_count   integer NOT NULL DEFAULT 0,

  -- Le cœur : séparer main-d'œuvre et matériaux. Sans cette séparation on ne
  -- peut pas remonter au taux horaire réel, et c'est le seul chiffre dont
  -- l'algorithme a besoin. `final_price` seul ne dit rien : deux chantiers au
  -- même total peuvent avoir des mains-d'œuvre du simple au triple.
  prix_main_oeuvre  integer CHECK (prix_main_oeuvre IS NULL OR prix_main_oeuvre >= 0),
  prix_materiaux    integer CHECK (prix_materiaux   IS NULL OR prix_materiaux   >= 0),
  final_price       integer NOT NULL CHECK (final_price > 0),
  artisan_percoit   integer,

  source            text    NOT NULL DEFAULT 'plateforme',
  date_observation  date    NOT NULL DEFAULT CURRENT_DATE,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accepted_prices_category ON accepted_prices (category, quartier);

-- ── 3. Taux horaire déduit, sans avoir à le calculer à la main ───────────────
-- Ce que l'artisan gagne réellement par heure, une fois les matériaux retirés.
-- C'est la vue à regarder pour juger si un prix collecté est cohérent.

CREATE OR REPLACE VIEW taux_horaire_observe AS
SELECT
  category,
  quartier,
  urgency,
  description_short,
  hours,
  prix_main_oeuvre,
  ROUND(prix_main_oeuvre / NULLIF(hours, 0))         AS taux_horaire_reel,
  final_price,
  source,
  date_observation
FROM accepted_prices
WHERE prix_main_oeuvre IS NOT NULL AND hours IS NOT NULL AND hours > 0;

-- ── 4. RLS — lecture seule pour les comptes connectés ────────────────────────
-- Ces tables alimentent le moteur de prix : elles s'écrivent par les routes API
-- (service_role) ou par import, jamais depuis un navigateur.

ALTER TABLE pricing_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE accepted_prices   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pricing_reference_read" ON pricing_reference;
CREATE POLICY "pricing_reference_read" ON pricing_reference FOR SELECT USING (true);

DROP POLICY IF EXISTS "accepted_prices_read" ON accepted_prices;
CREATE POLICY "accepted_prices_read" ON accepted_prices FOR SELECT USING (true);

-- Pas de policy INSERT/UPDATE/DELETE : RLS actif sans policy vaut refus.
-- Seul le service_role écrit ici.
