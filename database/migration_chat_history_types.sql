-- Migration : étendre le CHECK constraint de chat_history.type
-- À exécuter dans l'éditeur SQL de Supabase

ALTER TABLE chat_history
  DROP CONSTRAINT IF EXISTS chat_history_type_check;

ALTER TABLE chat_history
  ADD CONSTRAINT chat_history_type_check
  CHECK (type IN (
    'text',
    'image',
    'video',
    'system',
    'quotation',
    'devis',
    'brief',
    'material_suggest',
    'material_response',
    'material_update',
    'time_adjust',
    'price_proposal',
    'proof'
  ));
