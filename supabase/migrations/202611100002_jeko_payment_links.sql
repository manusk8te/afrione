BEGIN;
ALTER TABLE public.jeko_checkouts
  ADD COLUMN payment_link_id text UNIQUE,
  ADD COLUMN urgent_before_matching boolean NOT NULL DEFAULT false;

CREATE FUNCTION public.reserve_jeko_link(mid uuid, actor uuid, store uuid, revision text, urgent boolean)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE m missions%ROWTYPE; checkout jeko_checkouts%ROWTYPE; quote jsonb;
BEGIN
  SELECT * INTO m FROM missions WHERE id = mid FOR UPDATE;
  IF NOT FOUND OR m.client_id IS DISTINCT FROM actor OR m.is_test OR m.logic_version < 2 THEN
    RAISE EXCEPTION 'mission_not_payable';
  END IF;
  SELECT * INTO checkout FROM jeko_checkouts WHERE mission_id = mid AND status <> 'error';
  IF FOUND THEN
    RETURN to_jsonb(checkout) || jsonb_build_object('created', false);
  END IF;
  IF EXISTS (SELECT 1 FROM transactions WHERE mission_id = mid AND status IN ('escrow','released'))
     OR (urgent AND (m.status NOT IN ('diagnostic','matching') OR m.artisan_id IS NOT NULL))
     OR (NOT urgent AND (m.status <> 'negotiation' OR m.provider_accepted_at IS NULL
       OR m.price_confirmed_version IS NULL OR EXISTS (SELECT 1 FROM payment_simulations WHERE mission_id = mid))) THEN
    RAISE EXCEPTION 'mission_not_payable';
  END IF;
  quote := get_client_quote(mid, actor);
  IF revision IS DISTINCT FROM quote->>'quote_revision'
     OR coalesce((quote->>'total')::integer, 0) NOT BETWEEN 5 AND 2000000 THEN
    RAISE EXCEPTION 'quote_changed';
  END IF;
  INSERT INTO jeko_checkouts(mission_id, store_id, quote_revision, amount, urgent_before_matching)
  VALUES (mid, store, revision, (quote->>'total')::integer, urgent) RETURNING * INTO checkout;
  RETURN to_jsonb(checkout) || jsonb_build_object('created', true);
END $$;

CREATE OR REPLACE FUNCTION public.confirm_jeko_checkout(checkout_id uuid, provider_id text)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE m missions%ROWTYPE; checkout jeko_checkouts%ROWTYPE; next_status text := 'review';
BEGIN
  SELECT * INTO checkout FROM jeko_checkouts WHERE id = checkout_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO m FROM missions WHERE id = checkout.mission_id FOR UPDATE;
  SELECT * INTO checkout FROM jeko_checkouts WHERE id = checkout_id FOR UPDATE;
  IF checkout.status IN ('paid', 'review') THEN RETURN checkout.status; END IF;
  IF coalesce(checkout.payment_link_id, checkout.request_id) IS NOT NULL
     AND coalesce(checkout.payment_link_id, checkout.request_id) <> provider_id THEN
    RAISE EXCEPTION 'jeko_request_mismatch';
  END IF;
  IF checkout.status <> 'error'
     AND ((checkout.urgent_before_matching AND m.status IN ('diagnostic','matching') AND m.artisan_id IS NULL)
       OR (NOT checkout.urgent_before_matching AND m.status = 'negotiation'))
     AND checkout.quote_revision = (get_client_quote(m.id, m.client_id)->>'quote_revision') THEN
    UPDATE missions SET status = 'payment',
      mode = CASE WHEN checkout.urgent_before_matching THEN 'urgent' ELSE m.mode END,
      workflow_revision = workflow_revision + 1, updated_at = now() WHERE id = m.id;
    INSERT INTO mission_events(mission_id, actor_id, action, previous_status, next_status, details)
    VALUES (m.id, m.client_id, 'pay_jeko', m.status, 'payment', jsonb_build_object('checkout_id', checkout_id, 'amount', checkout.amount));
    next_status := 'paid';
  END IF;
  UPDATE jeko_checkouts SET status = next_status, request_id = CASE WHEN checkout.payment_link_id IS NULL THEN provider_id ELSE checkout.request_id END WHERE id = checkout_id;
  RETURN next_status;
END $$;

REVOKE ALL ON FUNCTION public.reserve_jeko_link(uuid, uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_jeko_link(uuid, uuid, uuid, text, boolean) TO service_role;
COMMIT;
