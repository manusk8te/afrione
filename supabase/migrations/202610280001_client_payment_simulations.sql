-- Les simulations restent distinctes des transactions et des portefeuilles réels.
CREATE TABLE IF NOT EXISTS public.payment_simulations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mission_id uuid NOT NULL UNIQUE REFERENCES public.missions(id),
 client_id uuid NOT NULL REFERENCES public.users(id),
 amount integer NOT NULL CHECK (amount > 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_simulations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_simulations FROM anon, authenticated;
GRANT ALL ON public.payment_simulations TO service_role;
CREATE OR REPLACE FUNCTION public.simulate_client_payment(p_mission_id uuid, p_client_id uuid, p_expected_amount integer DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.missions%ROWTYPE; receipt public.payment_simulations%ROWTYPE;
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
   INSERT INTO public.payment_simulations(mission_id,client_id,amount) VALUES(m.id,m.client_id,m.total_price) RETURNING * INTO receipt;
 END IF;
 RETURN to_jsonb(receipt) || jsonb_build_object('simulation',true,'category',m.category);
END $$;
REVOKE ALL ON FUNCTION public.simulate_client_payment(uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.simulate_client_payment(uuid,uuid,integer) TO service_role;
