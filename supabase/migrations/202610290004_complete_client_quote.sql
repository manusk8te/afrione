ALTER TABLE public.diagnostic_product_selections
 ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'unresolved' CHECK(billing_mode IN ('unresolved','included','client_supplied','additional')),
 ADD COLUMN IF NOT EXISTS unit_confirmed boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS exclusion_confirmed boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS public.quote_requests(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),mission_id uuid NOT NULL UNIQUE REFERENCES public.missions(id),
 client_id uuid NOT NULL REFERENCES public.users(id),status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','resolved','cancelled')),
 notes text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_requests FROM anon,authenticated;
GRANT ALL ON public.quote_requests TO service_role;
CREATE OR REPLACE FUNCTION public.lock_diagnostic_selection() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE mid uuid;
BEGIN
 mid:=CASE WHEN TG_OP='DELETE' THEN OLD.mission_id ELSE NEW.mission_id END;
 PERFORM id FROM public.missions WHERE id=mid FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.payment_simulations WHERE mission_id=mid) THEN RAISE EXCEPTION 'quote_already_simulated'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lock_selection_quote ON public.diagnostic_product_selections;
CREATE TRIGGER lock_selection_quote BEFORE INSERT OR UPDATE OR DELETE ON public.diagnostic_product_selections FOR EACH ROW EXECUTE FUNCTION public.lock_diagnostic_selection();
CREATE OR REPLACE FUNCTION public.get_client_quote(p_mission_id uuid,p_client_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.missions%ROWTYPE; products jsonb; unresolved integer; extras bigint; result jsonb; raw jsonb;
BEGIN
 SELECT * INTO m FROM public.missions WHERE id=p_mission_id;
 IF NOT FOUND OR m.client_id IS DISTINCT FROM p_client_id THEN RAISE EXCEPTION 'mission_not_owned'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.item,s.id),'[]'::jsonb),
 count(*) FILTER(WHERE billing_mode='unresolved' OR (billing_mode='additional' AND (NOT unit_confirmed OR NOT exclusion_confirmed OR coalesce((offer->>'observed_at')::timestamptz,'epoch'::timestamptz)<now()-interval '24 hours'))),
 coalesce(sum(CASE WHEN billing_mode='additional' AND unit_confirmed AND exclusion_confirmed THEN (offer->>'price')::bigint*quantity ELSE 0 END),0)
 INTO products,unresolved,extras FROM public.diagnostic_product_selections s WHERE mission_id=m.id;
 IF extras>2147483647 OR coalesce(m.total_price,0)::bigint+extras>2147483647 THEN RAISE EXCEPTION 'quote_amount_out_of_range'; END IF;
 BEGIN SELECT raw_text::jsonb INTO raw FROM public.diagnostics WHERE mission_id=m.id ORDER BY created_at DESC LIMIT 1; EXCEPTION WHEN OTHERS THEN raw:='{}'::jsonb; END;
 result:=jsonb_build_object('category',m.category,'service_total',m.total_price,'materials_total',extras,'selected_products',products,'unresolved_products',unresolved,
 'total',CASE WHEN m.total_price>0 AND unresolved=0 THEN m.total_price::bigint+extras ELSE NULL END,
 'needs_quote',NOT(coalesce(m.total_price,0)>0 AND unresolved=0),'sources',coalesce(raw->'afrione_pricing'->'price_context'->'sources','[]'::jsonb),
 'coverage_basis','client_confirmation','indicative',true);
 RETURN result||jsonb_build_object('quote_revision',md5(result::text));
END $$;
REVOKE ALL ON FUNCTION public.get_client_quote(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_quote(uuid,uuid) TO service_role;
-- Preserve the existing three-argument entry point for older clients.
CREATE OR REPLACE FUNCTION public.simulate_client_payment(p_mission_id uuid,p_client_id uuid,p_expected_amount integer DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.missions%ROWTYPE; q jsonb; receipt public.payment_simulations%ROWTYPE; pricing jsonb;
BEGIN
 SELECT * INTO m FROM public.missions WHERE id=p_mission_id FOR UPDATE;
 IF NOT FOUND OR m.client_id IS DISTINCT FROM p_client_id THEN RAISE EXCEPTION 'mission_not_owned'; END IF;
 IF m.status NOT IN ('diagnostic','matching','negotiation') THEN RAISE EXCEPTION 'mission_not_payable'; END IF;
 q:=public.get_client_quote(m.id,p_client_id);
 IF (q->>'total') IS NULL THEN RAISE EXCEPTION 'quote_required'; END IF;
 IF p_expected_amount IS NOT NULL AND p_expected_amount<>(q->>'total')::integer THEN RAISE EXCEPTION 'quote_changed'; END IF;
 SELECT * INTO receipt FROM public.payment_simulations WHERE mission_id=m.id;
 IF FOUND THEN
  IF receipt.amount<>(q->>'total')::integer THEN RAISE EXCEPTION 'quote_changed'; END IF;
  IF receipt.quote_snapshot->'quote'->>'quote_revision' IS NOT NULL AND receipt.quote_snapshot->'quote'->>'quote_revision'<>q->>'quote_revision' THEN RAISE EXCEPTION 'quote_changed'; END IF;
  IF receipt.quote_snapshot->'quote' IS NULL AND jsonb_array_length(q->'selected_products')>0 THEN RAISE EXCEPTION 'quote_changed'; END IF;
 ELSE
  BEGIN SELECT raw_text::jsonb->'afrione_pricing' INTO pricing FROM public.diagnostics WHERE mission_id=m.id ORDER BY created_at DESC LIMIT 1; EXCEPTION WHEN OTHERS THEN pricing:='{}'::jsonb; END;
  INSERT INTO public.payment_simulations(mission_id,client_id,amount,quote_snapshot) VALUES(m.id,p_client_id,(q->>'total')::integer,coalesce(pricing,'{}'::jsonb)||jsonb_build_object('quote',q)) RETURNING * INTO receipt;
 END IF;
 RETURN to_jsonb(receipt)||jsonb_build_object('simulation',true,'category',m.category);
END $$;
REVOKE ALL ON FUNCTION public.simulate_client_payment(uuid,uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simulate_client_payment(uuid,uuid,integer) TO service_role;

CREATE OR REPLACE FUNCTION public.freeze_simulated_service_price() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.total_price IS DISTINCT FROM OLD.total_price AND EXISTS(SELECT 1 FROM public.payment_simulations WHERE mission_id=OLD.id) THEN RAISE EXCEPTION 'quote_already_simulated'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS freeze_simulated_price ON public.missions;
CREATE TRIGGER freeze_simulated_price BEFORE UPDATE OF total_price ON public.missions FOR EACH ROW EXECUTE FUNCTION public.freeze_simulated_service_price();
CREATE OR REPLACE FUNCTION public.simulate_client_payment_v2(p_mission_id uuid,p_client_id uuid,p_expected_amount integer,p_expected_revision text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE q jsonb;
BEGIN
 PERFORM id FROM public.missions WHERE id=p_mission_id FOR UPDATE;
 q:=public.get_client_quote(p_mission_id,p_client_id);
 IF p_expected_revision IS DISTINCT FROM q->>'quote_revision' THEN RAISE EXCEPTION 'quote_changed'; END IF;
 RETURN public.simulate_client_payment(p_mission_id,p_client_id,p_expected_amount);
END $$;
REVOKE ALL ON FUNCTION public.simulate_client_payment_v2(uuid,uuid,integer,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.simulate_client_payment_v2(uuid,uuid,integer,text) TO service_role;
