-- Demandes de rattachement artisan → entreprise
CREATE TABLE IF NOT EXISTS entreprise_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artisan_id    UUID NOT NULL REFERENCES artisan_pros(id) ON DELETE CASCADE,
  entreprise_id UUID NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
  status        VARCHAR(20) DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at   TIMESTAMPTZ,
  UNIQUE(artisan_id, entreprise_id)
);

ALTER TABLE entreprise_requests ENABLE ROW LEVEL SECURITY;

-- L'artisan peut voir ses propres demandes
CREATE POLICY "requests_artisan_read"
  ON entreprise_requests FOR SELECT
  USING (
    artisan_id IN (
      SELECT id FROM artisan_pros WHERE user_id = auth.uid()
    )
  );

-- L'owner de l'entreprise peut tout voir/modifier
CREATE POLICY "requests_owner_all"
  ON entreprise_requests FOR ALL
  USING (
    entreprise_id IN (
      SELECT id FROM entreprises WHERE owner_id = auth.uid()
    )
  );

-- L'artisan peut insérer une demande
CREATE POLICY "requests_artisan_insert"
  ON entreprise_requests FOR INSERT
  WITH CHECK (
    artisan_id IN (
      SELECT id FROM artisan_pros WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_requests_artisan    ON entreprise_requests(artisan_id);
CREATE INDEX IF NOT EXISTS idx_requests_entreprise ON entreprise_requests(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_requests_status     ON entreprise_requests(status);
