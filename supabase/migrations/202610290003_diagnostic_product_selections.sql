CREATE TABLE IF NOT EXISTS public.diagnostic_product_selections (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
 item text NOT NULL CHECK(length(item) BETWEEN 2 AND 150),
 query text NOT NULL CHECK(length(query) BETWEEN 2 AND 120),
 quantity integer NOT NULL DEFAULT 1 CHECK(quantity BETWEEN 1 AND 100000),
 offer jsonb NOT NULL CHECK(jsonb_typeof(offer)='object'),
 selected_by uuid NOT NULL REFERENCES public.users(id),
 selected_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(mission_id,item)
);
ALTER TABLE public.diagnostic_product_selections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.diagnostic_product_selections FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.diagnostic_product_selections TO service_role;
COMMENT ON TABLE public.diagnostic_product_selections IS 'Public product snapshots chosen by the mission client; not purchases or catalogue imports.';
