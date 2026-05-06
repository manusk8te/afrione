-- AfriOne — Pricing v4 : contrainte UNIQUE pour upsert Jumia
-- À exécuter dans Supabase SQL Editor

ALTER TABLE price_materials
  ADD CONSTRAINT IF NOT EXISTS price_materials_name_category_tier_key
  UNIQUE (name, category, tier);
