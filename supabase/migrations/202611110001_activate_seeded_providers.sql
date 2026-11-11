BEGIN;

CREATE TABLE IF NOT EXISTS public.seeded_provider_registry (
  artisan_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  original_name text,
  original_rating_avg numeric,
  original_rating_count integer,
  original_mission_count integer,
  activated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.seeded_provider_registry ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seeded_provider_registry FROM PUBLIC, anon, authenticated;

WITH eligible AS (
  SELECT p.id, p.user_id, u.name, p.rating_avg, p.rating_count, p.mission_count
  FROM public.artisan_pros p
  JOIN public.users u ON u.id=p.user_id
  JOIN auth.users au ON au.id=p.user_id
  WHERE p.is_test AND p.kyc_status='approved' AND p.is_available
    AND au.email ~ '^qa-[0-9a-f]{10}-[0-9]+@afrione[.]test$'
    AND au.raw_app_meta_data->>'afrione_test'='true'
    AND NOT EXISTS (
      SELECT 1 FROM public.missions m WHERE m.artisan_id=p.id
        AND m.status NOT IN ('completed','cancelled')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.dispatch_attempts d WHERE d.artisan_id=p.id
        AND d.response IS NULL AND d.expires_at>now()
    )
), recorded AS (
  INSERT INTO public.seeded_provider_registry
    (artisan_id,user_id,original_name,original_rating_avg,original_rating_count,original_mission_count)
  SELECT id,user_id,name,rating_avg,rating_count,mission_count FROM eligible
  ON CONFLICT (artisan_id) DO NOTHING
  RETURNING artisan_id,user_id
), activated AS (
  UPDATE public.artisan_pros p SET is_test=false, rating_avg=0, rating_count=0, mission_count=0
  FROM recorded r WHERE p.id=r.artisan_id
  RETURNING r.user_id
)
UPDATE public.users u SET name=regexp_replace(u.name,'^[[]TEST[]][[:space:]]*','')
FROM activated a WHERE u.id=a.user_id;

COMMIT;
