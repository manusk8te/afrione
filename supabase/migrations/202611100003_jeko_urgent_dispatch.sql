BEGIN;

DO $migration$
DECLARE guard text := pg_get_functiondef('public.guard_mission_business_rules()'::regprocedure);
        confirm text := pg_get_functiondef('public.confirm_jeko_checkout(uuid,text)'::regprocedure);
BEGIN
  IF strpos(guard, 'IF NEW.artisan_id IS NULL OR NEW.provider_accepted_at IS NULL OR coalesce(NEW.price_confirmed_version,0)<1 THEN') = 0
     OR strpos(guard, 'AND NOT (NEW.is_test AND EXISTS(SELECT 1 FROM payment_simulations') = 0
     OR strpos(confirm, 'UPDATE missions SET status') = 0 THEN
    RAISE EXCEPTION 'Unexpected mission or checkout function';
  END IF;
  guard := replace(guard,
    'IF NEW.artisan_id IS NULL OR NEW.provider_accepted_at IS NULL OR coalesce(NEW.price_confirmed_version,0)<1 THEN',
    'IF NOT (NEW.status = ''payment'' AND NEW.mode = ''urgent'' AND NEW.artisan_id IS NULL AND EXISTS (SELECT 1 FROM jeko_checkouts WHERE mission_id=NEW.id AND urgent_before_matching AND status=''paid''))
        AND (NEW.artisan_id IS NULL OR NEW.provider_accepted_at IS NULL OR coalesce(NEW.price_confirmed_version,0)<1) THEN');
  guard := replace(guard, 'AND NOT (NEW.is_test AND EXISTS(SELECT 1 FROM payment_simulations',
    'AND NOT EXISTS(SELECT 1 FROM jeko_checkouts WHERE mission_id=NEW.id AND status=''paid'') AND NOT (NEW.is_test AND EXISTS(SELECT 1 FROM payment_simulations');
  EXECUTE guard;
  confirm := replace(confirm, 'UPDATE missions SET status',
    'PERFORM set_config(''afrione.workflow_actor'', m.client_id::text, true);
     UPDATE jeko_checkouts SET status=''paid'' WHERE id=checkout_id;
     UPDATE missions SET status');
  EXECUTE confirm;
END $migration$;

CREATE FUNCTION public.start_paid_urgent_dispatch(mid uuid, candidates uuid[], deadline timestamptz)
RETURNS uuid[] LANGUAGE plpgsql SET search_path = public AS $$
DECLARE m missions%ROWTYPE; recipients uuid[];
BEGIN
  SELECT * INTO m FROM missions WHERE id=mid FOR UPDATE;
  IF NOT FOUND OR m.status <> 'payment' OR m.mode <> 'urgent' OR m.artisan_id IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM jeko_checkouts WHERE mission_id=mid AND urgent_before_matching AND status='paid')
     OR EXISTS (SELECT 1 FROM dispatch_attempts WHERE mission_id=mid) THEN
    RETURN ARRAY[]::uuid[];
  END IF;
  SELECT array_agg(ap.id ORDER BY choice.rank) INTO recipients
  FROM unnest(candidates) WITH ORDINALITY AS choice(id,rank)
  JOIN artisan_pros ap ON ap.id=choice.id
  WHERE ap.is_available AND ap.kyc_status='approved' AND ap.is_test=m.is_test
    AND ap.user_id<>m.client_id AND ap.matching_trade=trade_key(m.category)
    AND NOT EXISTS (SELECT 1 FROM missions active WHERE active.artisan_id=ap.id AND active.status IN ('en_route','en_cours'));
  IF recipients IS NULL THEN RETURN ARRAY[]::uuid[]; END IF;
  PERFORM set_config('afrione.workflow_actor',m.client_id::text,true);
  UPDATE missions SET status='dispatching', workflow_revision=workflow_revision+1, updated_at=now() WHERE id=mid;
  INSERT INTO dispatch_attempts(mission_id,artisan_id,attempt_number,expires_at)
    SELECT mid, recipient.id, recipient.rank::integer, deadline
    FROM unnest(recipients) WITH ORDINALITY AS recipient(id,rank);
  RETURN recipients;
END $$;

CREATE FUNCTION public.claim_paid_urgent_dispatch(mid uuid, pro uuid, actor uuid, aid uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE m missions%ROWTYPE;
BEGIN
  SELECT * INTO m FROM missions WHERE id=mid FOR UPDATE;
  IF NOT FOUND OR m.status <> 'dispatching' OR m.artisan_id IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM jeko_checkouts WHERE mission_id=mid AND urgent_before_matching AND status='paid')
     OR NOT EXISTS (SELECT 1 FROM artisan_pros WHERE id=pro AND user_id=actor AND is_test=m.is_test AND kyc_status='approved')
     OR NOT EXISTS (SELECT 1 FROM dispatch_attempts WHERE id=aid AND mission_id=mid AND artisan_id=pro AND response IS NULL AND expires_at+interval '5 seconds'>=now() FOR UPDATE) THEN
    RETURN false;
  END IF;
  PERFORM set_config('afrione.workflow_actor',actor::text,true);
  UPDATE missions SET status='en_route',artisan_id=pro,provider_accepted_at=now(),
    price_confirmed_version=1,workflow_revision=workflow_revision+1,updated_at=now() WHERE id=mid;
  UPDATE dispatch_attempts SET response='accepted',responded_at=now() WHERE id=aid;
  UPDATE dispatch_attempts SET response='cancelled',responded_at=now() WHERE mission_id=mid AND response IS NULL;
  RETURN true;
END $$;

CREATE FUNCTION public.stop_paid_urgent_dispatch(mid uuid)
RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE m missions%ROWTYPE;
BEGIN
  SELECT * INTO m FROM missions WHERE id=mid FOR UPDATE;
  IF NOT FOUND OR m.status <> 'dispatching' OR m.artisan_id IS NOT NULL
     OR NOT EXISTS (SELECT 1 FROM jeko_checkouts WHERE mission_id=mid AND urgent_before_matching AND status='paid')
     OR EXISTS (SELECT 1 FROM dispatch_attempts WHERE mission_id=mid AND response IS NULL AND expires_at+interval '5 seconds'>now()) THEN
    RETURN false;
  END IF;
  PERFORM set_config('afrione.workflow_actor',m.client_id::text,true);
  UPDATE missions SET status='payment',workflow_revision=workflow_revision+1,updated_at=now() WHERE id=mid;
  UPDATE dispatch_attempts SET response='timeout',responded_at=now() WHERE mission_id=mid AND response IS NULL;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.start_paid_urgent_dispatch(uuid,uuid[],timestamptz),
  public.claim_paid_urgent_dispatch(uuid,uuid,uuid,uuid),public.stop_paid_urgent_dispatch(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.start_paid_urgent_dispatch(uuid,uuid[],timestamptz),
  public.claim_paid_urgent_dispatch(uuid,uuid,uuid,uuid),public.stop_paid_urgent_dispatch(uuid) TO service_role;
COMMIT;
