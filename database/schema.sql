-- ============================================
-- AFRIONE — Schéma PostgreSQL Complet
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- Extension pgvector pour les embeddings IA
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SECTION 1 : PROFILING
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(20) NOT NULL CHECK (role IN ('client', 'artisan', 'admin')),
  avatar_url TEXT,
  quartier VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE artisan_pros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  bio TEXT,
  metier VARCHAR(100) NOT NULL,
  specialties TEXT[] DEFAULT '{}',
  zone_gps JSONB, -- { lat, lng }
  quartiers TEXT[] DEFAULT '{}',
  rating_avg DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  mission_count INTEGER DEFAULT 0,
  years_experience INTEGER DEFAULT 0,
  certifications TEXT[] DEFAULT '{}',
  portfolio TEXT[] DEFAULT '{}',
  kyc_status VARCHAR(20) DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected')),
  tarif_min INTEGER DEFAULT 0, -- en FCFA
  rayon_km INTEGER DEFAULT 10,
  is_available BOOLEAN DEFAULT true,
  response_time_min INTEGER DEFAULT 30,
  success_rate DECIMAL(5,2) DEFAULT 0,
  scoring_weight DECIMAL(5,4) DEFAULT 0, -- Score = α(Expertise) + β(Ponctualité) + γ(Réactivité)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE kyc_security (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artisan_id UUID REFERENCES artisan_pros(id) ON DELETE CASCADE,
  cni_front_url TEXT,
  cni_back_url TEXT,
  diploma_urls TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SECTION 2 : MARKET INTEL
-- ============================================

CREATE TABLE price_materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  price_market INTEGER NOT NULL, -- FCFA
  price_min INTEGER NOT NULL,
  price_max INTEGER NOT NULL,
  source VARCHAR(100) DEFAULT 'Adjamé', -- Adjamé | Treichville | Fournisseur
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE labor_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metier VARCHAR(100) NOT NULL,
  tarif_horaire INTEGER NOT NULL, -- FCFA/heure
  majoration_urgence INTEGER DEFAULT 50, -- %
  majoration_nuit INTEGER DEFAULT 30,    -- %
  majoration_weekend INTEGER DEFAULT 20, -- %
  zone VARCHAR(100) DEFAULT 'Abidjan',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE service_fees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category VARCHAR(100) NOT NULL,
  commission_pct DECIMAL(5,2) DEFAULT 10.00, -- %
  frais_fixe INTEGER DEFAULT 0,              -- FCFA fixe par transaction
  assurance_sav_pct DECIMAL(5,2) DEFAULT 2.00,
  artisan_share_pct DECIMAL(5,2) DEFAULT 88.00,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SECTION 3 : MISSION FLOW
-- ============================================

CREATE TABLE missions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES users(id),
  artisan_id UUID REFERENCES artisan_pros(id),
  status VARCHAR(30) DEFAULT 'diagnostic' CHECK (
    status IN ('diagnostic','matching','negotiation','payment','en_route','en_cours','completed','disputed','cancelled')
  ),
  category VARCHAR(100),
  quartier VARCHAR(100),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE diagnostics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  raw_text TEXT NOT NULL,
  ai_summary TEXT,
  category_detected VARCHAR(100),
  estimated_price_min INTEGER,
  estimated_price_max INTEGER,
  items_needed TEXT[] DEFAULT '{}',
  urgency_level VARCHAR(20) DEFAULT 'medium' CHECK (
    urgency_level IN ('low','medium','high','emergency')
  ),
  embedding vector(1536), -- OpenAI text-embedding-3-small
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  materials JSONB DEFAULT '[]', -- [{ name, qty, unit, unit_price, total }]
  labor_cost INTEGER NOT NULL DEFAULT 0,
  platform_fee INTEGER DEFAULT 0,
  assurance_fee INTEGER DEFAULT 0,
  total_price INTEGER NOT NULL,
  artisan_receives INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'proposed' CHECK (
    status IN ('proposed','accepted','rejected','renegotiation')
  ),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE proof_of_work (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  photo_before_urls TEXT[] DEFAULT '{}',
  photo_after_urls TEXT[] DEFAULT '{}',
  client_signature TEXT,
  artisan_notes TEXT,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SECTION 4 : COMM & GPS
-- ============================================

CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id),
  sender_role VARCHAR(20),
  text TEXT,
  media_urls TEXT[] DEFAULT '{}',
  type VARCHAR(20) DEFAULT 'text' CHECK (
    type IN ('text','image','video','system','quotation')
  ),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE gps_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  artisan_id UUID REFERENCES artisan_pros(id),
  lat DECIMAL(10,8) NOT NULL,
  lng DECIMAL(11,8) NOT NULL,
  eta_minutes INTEGER,
  speed_kmh DECIMAL(5,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SECTION 5 : FINANCE
-- ============================================

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID REFERENCES missions(id),
  wave_transaction_id VARCHAR(255),
  amount INTEGER NOT NULL, -- FCFA
  platform_fee INTEGER DEFAULT 0,
  artisan_amount INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (
    status IN ('pending','escrow','released','refunded')
  ),
  payment_method VARCHAR(30) DEFAULT 'wave',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ
);

CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artisan_id UUID REFERENCES artisan_pros(id) ON DELETE CASCADE UNIQUE,
  balance_available INTEGER DEFAULT 0, -- FCFA
  balance_escrow INTEGER DEFAULT 0,
  total_earned INTEGER DEFAULT 0,
  total_withdrawn INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SECTION 6 : IA / pgvector
-- ============================================

CREATE TABLE problem_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  diagnostic_id UUID REFERENCES diagnostics(id),
  category VARCHAR(100),
  embedding vector(1536) NOT NULL,
  resolution TEXT,
  avg_price INTEGER,
  avg_duration_min INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sentiment_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mission_id UUID REFERENCES missions(id),
  artisan_id UUID REFERENCES artisan_pros(id),
  source VARCHAR(20) CHECK (source IN ('review','chat','dispute')),
  sentiment_score DECIMAL(4,3), -- -1.000 à 1.000
  flags TEXT[] DEFAULT '{}',
  raw_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEX pour les performances
-- ============================================

CREATE INDEX idx_missions_client ON missions(client_id);
CREATE INDEX idx_missions_artisan ON missions(artisan_id);
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_artisan_pros_metier ON artisan_pros(metier);
CREATE INDEX idx_artisan_pros_kyc ON artisan_pros(kyc_status);
CREATE INDEX idx_artisan_pros_available ON artisan_pros(is_available);
CREATE INDEX idx_chat_mission ON chat_history(mission_id);
CREATE INDEX idx_gps_mission ON gps_tracking(mission_id);
CREATE INDEX idx_transactions_mission ON transactions(mission_id);
CREATE INDEX idx_diagnostics_embedding ON diagnostics USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_problem_embedding ON problem_embeddings USING ivfflat (embedding vector_cosine_ops);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE artisan_pros ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Users peuvent voir leur propre profil
CREATE POLICY "users_own" ON users FOR ALL USING (auth.uid()::text = id::text);

-- Artisans publics visibles par tous
CREATE POLICY "artisans_public_read" ON artisan_pros FOR SELECT USING (kyc_status = 'approved');
CREATE POLICY "artisans_own_write" ON artisan_pros FOR ALL USING (
  user_id = auth.uid()
);

-- Missions visibles par client ou artisan concerné
CREATE POLICY "missions_participants" ON missions FOR ALL USING (
  client_id = auth.uid() OR
  artisan_id IN (SELECT id FROM artisan_pros WHERE user_id = auth.uid())
);

-- Chat visible uniquement par les participants
CREATE POLICY "chat_participants" ON chat_history FOR ALL USING (
  mission_id IN (
    SELECT id FROM missions WHERE
    client_id = auth.uid() OR
    artisan_id IN (SELECT id FROM artisan_pros WHERE user_id = auth.uid())
  )
);

-- Wallet visible par l'artisan uniquement
CREATE POLICY "wallet_own" ON wallets FOR ALL USING (
  artisan_id IN (SELECT id FROM artisan_pros WHERE user_id = auth.uid())
);

-- ============================================
-- DONNÉES DE TEST (Seed)
-- ============================================

-- Tarifs de référence par métier
INSERT INTO labor_rates (metier, tarif_horaire, zone) VALUES
  ('Plombier', 3000, 'Abidjan'),
  ('Électricien', 3500, 'Abidjan'),
  ('Peintre', 2500, 'Abidjan'),
  ('Maçon', 2800, 'Abidjan'),
  ('Menuisier', 3000, 'Abidjan'),
  ('Climaticien', 4000, 'Abidjan'),
  ('Serrurier', 3000, 'Abidjan'),
  ('Carreleur', 2800, 'Abidjan');

-- Frais de service par défaut
INSERT INTO service_fees (category, commission_pct, assurance_sav_pct, artisan_share_pct) VALUES
  ('default', 10.00, 2.00, 88.00),
  ('urgence', 12.00, 3.00, 85.00),
  ('premium', 8.00, 2.00, 90.00);

-- Prix matériaux courants
INSERT INTO price_materials (name, category, unit, price_market, price_min, price_max, source) VALUES
  ('Câble électrique 2.5mm', 'Électricité', 'mètre', 800, 700, 1000, 'Adjamé'),
  ('Tuyau PVC 32mm', 'Plomberie', 'mètre', 600, 500, 800, 'Adjamé'),
  ('Peinture vinylique blanche', 'Peinture', 'litre', 2500, 2000, 3000, 'Treichville'),
  ('Ciment CPA 50kg', 'Maçonnerie', 'sac', 7000, 6500, 8000, 'Adjamé'),
  ('Carrelage standard 60x60', 'Carrelage', 'm²', 8000, 7000, 10000, 'Treichville'),
  ('Disjoncteur 16A', 'Électricité', 'unité', 3500, 3000, 4500, 'Adjamé'),
  ('Joint silicone', 'Plomberie', 'tube', 1500, 1200, 2000, 'Treichville'),
  ('Gaz climatiseur R32', 'Climatisation', 'kg', 15000, 12000, 18000, 'Adjamé');
