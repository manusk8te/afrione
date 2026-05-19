-- Migration 001 — Idempotence webhook Wave
-- À exécuter dans Supabase SQL Editor

-- Contrainte unique sur wave_transaction_id (NULL exclus)
-- Empêche le double crédit si Wave livre l'event deux fois
CREATE UNIQUE INDEX IF NOT EXISTS transactions_wave_tx_id_unique
  ON transactions (wave_transaction_id)
  WHERE wave_transaction_id IS NOT NULL;
