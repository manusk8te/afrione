CREATE POLICY artisans_test_read ON public.artisan_pros FOR SELECT TO authenticated
USING (
  is_test AND kyc_status = 'approved'
  AND (SELECT auth.jwt() -> 'app_metadata' -> 'afrione_test') = 'true'::jsonb
);
