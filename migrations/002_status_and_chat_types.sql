-- Migration 002 — Aligner DB et code
-- À exécuter dans Supabase SQL Editor

-- 2a : Ajouter 'scheduled' à l'enum missions
ALTER TABLE missions DROP CONSTRAINT missions_status_check;
ALTER TABLE missions ADD CONSTRAINT missions_status_check
  CHECK (status IN (
    'diagnostic', 'matching', 'negotiation', 'scheduled',
    'en_route', 'en_cours', 'payment',
    'pending_validation', 'completed', 'disputed', 'cancelled'
  ));

-- 2b : Étendre les types valides de chat_history
ALTER TABLE chat_history DROP CONSTRAINT chat_history_type_check;
ALTER TABLE chat_history ADD CONSTRAINT chat_history_type_check
  CHECK (type IN (
    'text', 'devis', 'system', 'image',
    'material_suggest', 'material_response', 'material_update', 'time_adjust'
  ));
