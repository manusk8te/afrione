-- Migration : table entreprises + FK artisan_pros
-- À exécuter dans Supabase SQL Editor

-- 1. Table principale
CREATE TABLE IF NOT EXISTS entreprises (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         VARCHAR(200) NOT NULL,
  logo_url     TEXT,
  banner_url   TEXT,
  description  TEXT,
  secteurs     TEXT[] DEFAULT '{}',
  quartiers    TEXT[] DEFAULT '{}',
  owner_id     UUID REFERENCES users(id),
  kyc_status   VARCHAR(20) DEFAULT 'pending'
               CHECK (kyc_status IN ('pending','approved','rejected')),
  is_active    BOOLEAN DEFAULT false,
  phone        VARCHAR(30),
  email        VARCHAR(200),
  website      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Rattachement artisan → entreprise (nullable = artisan indépendant)
ALTER TABLE artisan_pros
  ADD COLUMN IF NOT EXISTS entreprise_id UUID REFERENCES entreprises(id);

-- 3. RLS
ALTER TABLE entreprises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entreprises_public_read"
  ON entreprises FOR SELECT USING (true);

CREATE POLICY "entreprises_owner_write"
  ON entreprises FOR ALL USING (auth.uid() = owner_id);

-- 4. Index
CREATE INDEX IF NOT EXISTS idx_entreprises_owner   ON entreprises(owner_id);
CREATE INDEX IF NOT EXISTS idx_artisans_entreprise ON artisan_pros(entreprise_id);
