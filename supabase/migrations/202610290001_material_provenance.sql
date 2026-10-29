ALTER TABLE public.price_materials
 ADD COLUMN IF NOT EXISTS price_provenance text NOT NULL DEFAULT 'unknown',
 ADD COLUMN IF NOT EXISTS observed_at timestamptz,
 ADD COLUMN IF NOT EXISTS observed_price_total integer,
 ADD COLUMN IF NOT EXISTS observed_quantity numeric NOT NULL DEFAULT 1 CHECK(observed_quantity > 0),
 ADD COLUMN IF NOT EXISTS evidence_url text,
 ADD COLUMN IF NOT EXISTS stock_status text NOT NULL DEFAULT 'unknown',
 ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES public.users(id);
ALTER TABLE public.price_sources
 ADD COLUMN IF NOT EXISTS is_partner boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS partnership_reference text,
 ADD COLUMN IF NOT EXISTS access_status text NOT NULL DEFAULT 'not_checked',
 ADD COLUMN IF NOT EXISTS access_checked_at timestamptz;
-- La saisie et la modération passent par le serveur authentifié.
REVOKE INSERT, UPDATE, DELETE ON public.price_materials, public.price_sources FROM anon, authenticated;
INSERT INTO public.price_sources(name,type,url,verified,scraper_type,notes,access_status,access_checked_at)
 SELECT 'leroymerlin.ci','website','https://leroymerlin.ci/',false,'manual','Source proposée par le propriétaire. Domaine non résolu lors du contrôle ; aucun prix importé, aucun partenariat présumé.','unreachable',now()
 WHERE NOT EXISTS(SELECT 1 FROM price_sources WHERE url IN ('https://leroymerlin.ci','https://leroymerlin.ci/'));
INSERT INTO public.price_sources(name,type,url,verified,scraper_type,notes,access_status,access_checked_at)
 SELECT 'aribat.ci','website','https://aribat.ci/',false,'manual','Source proposée par le propriétaire. Domaine non résolu lors du contrôle ; aucun prix importé, aucun partenariat présumé.','unreachable',now()
 WHERE NOT EXISTS(SELECT 1 FROM price_sources WHERE url IN ('https://aribat.ci','https://aribat.ci/'));
UPDATE public.price_sources SET access_status='blocked',access_checked_at=now() WHERE url IN ('https://www.jumia.ci/','https://www.jumia.ci','https://jumia.ci/','https://jumia.ci');

ALTER TABLE public.payment_simulations ADD COLUMN IF NOT EXISTS quote_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE OR REPLACE FUNCTION public.simulate_client_payment(p_mission_id uuid, p_client_id uuid, p_expected_amount integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.missions%ROWTYPE; receipt public.payment_simulations%ROWTYPE; raw text; snapshot jsonb;
BEGIN
 SELECT * INTO m FROM public.missions WHERE id=p_mission_id FOR UPDATE;
 IF NOT FOUND OR m.client_id IS DISTINCT FROM p_client_id THEN RAISE EXCEPTION 'mission_not_owned'; END IF;
 IF m.status NOT IN ('diagnostic','matching','negotiation') THEN RAISE EXCEPTION 'mission_not_payable'; END IF;
 IF m.total_price IS NULL OR m.total_price <= 0 THEN RAISE EXCEPTION 'quote_required'; END IF;
 IF p_expected_amount IS NOT NULL AND p_expected_amount <> m.total_price THEN RAISE EXCEPTION 'quote_changed'; END IF;
 SELECT * INTO receipt FROM public.payment_simulations WHERE mission_id=m.id;
 IF FOUND THEN
   IF receipt.amount <> m.total_price THEN RAISE EXCEPTION 'quote_changed'; END IF;
 ELSE
   SELECT raw_text INTO raw FROM public.diagnostics WHERE mission_id=m.id ORDER BY created_at DESC LIMIT 1;
   BEGIN snapshot := (raw::jsonb)->'afrione_pricing'; EXCEPTION WHEN OTHERS THEN snapshot := '{}'::jsonb; END;
   INSERT INTO public.payment_simulations(mission_id,client_id,amount,quote_snapshot) VALUES(m.id,m.client_id,m.total_price,COALESCE(snapshot,'{}'::jsonb)) RETURNING * INTO receipt;
 END IF;
 RETURN to_jsonb(receipt) || jsonb_build_object('simulation',true,'category',m.category);
END $$;
REVOKE ALL ON FUNCTION public.simulate_client_payment(uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.simulate_client_payment(uuid,uuid,integer) TO service_role;
