-- ============================================
-- MIGRATION : Table agent_runs
-- Journal local de chaque exécution de l'agent IA (pricing) —
-- input, appels d'outils, output, durée. Observabilité indépendante
-- des traces OpenAI (platform.openai.com/traces, rétention limitée).
-- À exécuter dans Supabase SQL Editor.
-- ============================================

CREATE TABLE IF NOT EXISTS agent_runs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name  TEXT NOT NULL DEFAULT 'pricing',
  model       TEXT,
  input       JSONB,           -- paramètres + prompt envoyé
  steps       JSONB,           -- appels d'outils et leurs résultats, dans l'ordre
  output      JSONB,           -- JSON final parsé (ou { raw } si parse échoué)
  total_price NUMERIC,         -- extrait de l'output pour requêtes rapides
  parse_ok    BOOLEAN DEFAULT true,
  error       TEXT,            -- message si le run a échoué
  duration_ms INTEGER,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_runs_created ON agent_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent   ON agent_runs (agent_name, created_at DESC);

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

-- Écriture/lecture réservées au service role (les API server-side).
-- Aucune policy pour anon/authenticated → invisible côté client.
