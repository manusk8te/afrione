-- Migration : validation client + escrow retenu jusqu'à validation
-- À exécuter dans Supabase SQL Editor

-- 1. Ajouter le statut 'pending_validation'
ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_status_check;
ALTER TABLE missions ADD CONSTRAINT missions_status_check CHECK (
  status IN (
    'diagnostic','matching','negotiation','payment',
    'en_route','en_cours',
    'pending_validation',
    'completed','disputed','cancelled'
  )
);

-- 2. Champ deadline de validation (24h après que l'artisan marque terminé)
ALTER TABLE missions ADD COLUMN IF NOT EXISTS validation_deadline TIMESTAMPTZ;

-- 3. Champ prix total sur la mission (si pas encore présent)
ALTER TABLE missions ADD COLUMN IF NOT EXISTS total_price INTEGER;
