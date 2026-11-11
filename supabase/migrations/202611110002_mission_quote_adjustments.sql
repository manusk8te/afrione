BEGIN;

CREATE TABLE public.mission_quote_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('diagnostic','material','time')),
  label text NOT NULL CHECK (char_length(label) BETWEEN 3 AND 120),
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 600),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 100),
  minutes integer NOT NULL CHECK (minutes BETWEEN 0 AND 1440),
  amount integer NOT NULL CHECK (amount BETWEEN 0 AND 2000000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','included')),
  proposed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX mission_quote_adjustments_mission_idx ON public.mission_quote_adjustments(mission_id, created_at);
CREATE UNIQUE INDEX mission_quote_one_pending_adjustment ON public.mission_quote_adjustments(mission_id) WHERE status='pending';
ALTER TABLE public.mission_quote_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mission_quote_adjustments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mission_quote_adjustments TO service_role;

CREATE FUNCTION public.change_mission_quote(mid uuid, actor uuid, operation text, expected integer, payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  m missions%ROWTYPE;
  a discussion_agreements%ROWTYPE;
  provider uuid;
  item mission_quote_adjustments%ROWTYPE;
  result jsonb;
  kind text;
  quantity integer;
  minutes integer;
  amount integer;
  extra bigint;
  approved_ids uuid[];
BEGIN
  SELECT * INTO m FROM missions WHERE id=mid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mission introuvable'; END IF;
  SELECT user_id INTO provider FROM artisan_pros WHERE id=m.artisan_id;
  IF actor IS DISTINCT FROM m.client_id AND actor IS DISTINCT FROM provider THEN
    RAISE EXCEPTION 'Participant requis';
  END IF;
  IF EXISTS (SELECT 1 FROM jeko_checkouts WHERE mission_id=mid AND status IN ('creating','pending','paid','review')) THEN
    RAISE EXCEPTION 'Le devis est verrouillé pendant le paiement.';
  END IF;

  IF operation IN ('add_adjustment','approve_adjustment','reject_adjustment') THEN
    IF m.mode='urgent' OR m.status<>'negotiation' OR m.provider_accepted_at IS NULL THEN
      RAISE EXCEPTION 'Les ajustements sont disponibles après acceptation de la demande Standard.';
    END IF;
    SELECT * INTO a FROM discussion_agreements WHERE mission_id=mid;
    IF a.pending IS NOT NULL THEN RAISE EXCEPTION 'Répondez au devis en cours avant de modifier le diagnostic.'; END IF;
    IF operation='add_adjustment' THEN
      IF actor IS DISTINCT FROM provider THEN RAISE EXCEPTION 'Proposition réservée à l’artisan.'; END IF;
      IF EXISTS (SELECT 1 FROM mission_quote_adjustments WHERE mission_id=mid AND status='pending') THEN
        RAISE EXCEPTION 'Attendez la réponse du client avant d’envoyer un nouvel ajustement.';
      END IF;
      IF (SELECT count(*) FROM mission_quote_adjustments WHERE mission_id=mid AND created_at>now()-interval '1 hour')>=5 THEN
        RAISE EXCEPTION 'Cinq ajustements maximum par heure pour cette mission.';
      END IF;
      kind := payload->>'kind';
      quantity := coalesce((payload->>'quantity')::integer,1);
      minutes := coalesce((payload->>'minutes')::integer,0);
      amount := coalesce((payload->>'amount')::integer,0);
      IF kind NOT IN ('diagnostic','material','time') OR kind IS NULL
         OR (kind='diagnostic' AND (amount<>0 OR quantity<>1 OR minutes<>0))
         OR (kind='material' AND (amount<=0 OR minutes<>0))
         OR (kind='time' AND (amount<=0 OR quantity<>1 OR minutes<=0)) THEN
        RAISE EXCEPTION 'Vérifiez les données de l’ajustement.';
      END IF;
      INSERT INTO mission_quote_adjustments(mission_id,kind,label,reason,quantity,minutes,amount,proposed_by)
      VALUES(mid,kind,trim(payload->>'label'),trim(payload->>'reason'),quantity,minutes,amount,actor)
      RETURNING * INTO item;
    ELSE
      IF actor IS DISTINCT FROM m.client_id THEN RAISE EXCEPTION 'Décision réservée au client.'; END IF;
      UPDATE mission_quote_adjustments SET
        status=CASE WHEN operation='approve_adjustment' THEN 'approved' ELSE 'rejected' END,
        decided_at=now()
      WHERE id=(payload->>'adjustment_id')::uuid AND mission_id=mid AND status='pending'
      RETURNING * INTO item;
      IF NOT FOUND THEN RAISE EXCEPTION 'Cet ajustement a déjà reçu une réponse.'; END IF;
    END IF;
    RETURN to_jsonb(item);
  END IF;

  IF m.mode IS DISTINCT FROM 'urgent' AND operation IN ('propose','propose_adjusted','counter','accept','accept_counter') THEN
    SELECT * INTO a FROM discussion_agreements WHERE mission_id=mid;
    IF EXISTS (SELECT 1 FROM mission_quote_adjustments WHERE mission_id=mid AND status='pending') THEN
      RAISE EXCEPTION 'Le client doit répondre aux ajustements avant le devis final.';
    END IF;
    SELECT coalesce(sum(q.amount),0),array_agg(q.id ORDER BY q.created_at,q.id) INTO extra,approved_ids
      FROM mission_quote_adjustments q WHERE q.mission_id=mid AND q.status='approved';

    IF operation IN ('propose','propose_adjusted') THEN
      IF a.pending IS NOT NULL THEN RAISE EXCEPTION 'Une proposition attend déjà une réponse.'; END IF;
      IF operation='propose' AND (coalesce(m.total_price,0)>0 OR approved_ids IS NOT NULL) THEN
        RAISE EXCEPTION 'Utilisez le devis final calculé à partir des ajustements.';
      END IF;
      IF operation='propose_adjusted' THEN
        IF a.mission_id IS NULL THEN RAISE EXCEPTION 'Le client doit confirmer la demande dans Devis et suivi.'; END IF;
        IF coalesce(m.total_price,0)<=0 AND coalesce((payload->>'base_amount')::integer,0)<=0 THEN
          RAISE EXCEPTION 'Indiquez le montant de base pour ce diagnostic.';
        END IF;
        amount := coalesce(nullif(m.total_price,0),(payload->>'base_amount')::integer) + extra;
        IF amount IS DISTINCT FROM (payload->>'expected_total')::integer THEN
          RAISE EXCEPTION 'Le total a changé. Vérifiez le montant avant de renvoyer.';
        END IF;
        result := update_discussion_agreement(mid,actor,'propose',expected,jsonb_build_object(
          'scope',a.scope,'reason',payload->>'reason','amount',amount,'supplies','excluded'
        ));
        UPDATE discussion_agreements SET pending=pending||jsonb_build_object(
          'base_amount',amount-extra,'adjustment_ids',coalesce(to_jsonb(approved_ids),'[]'::jsonb),'adjustment_total',extra
        ) WHERE mission_id=mid RETURNING * INTO a;
        RETURN to_jsonb(a);
      END IF;
    END IF;

    IF operation IN ('counter','accept_counter') AND a.pending ? 'adjustment_ids' THEN
      RAISE EXCEPTION 'Refusez ce devis pour rouvrir la discussion sur les ajustements.';
    END IF;
    IF operation='accept' AND approved_ids IS NOT NULL
       AND a.pending->'adjustment_ids' IS DISTINCT FROM to_jsonb(approved_ids) THEN
      RAISE EXCEPTION 'Le devis doit inclure les ajustements déjà acceptés.';
    END IF;
    IF operation='accept' THEN
      result := update_discussion_agreement(mid,actor,operation,expected,payload);
      UPDATE mission_quote_adjustments SET status='included'
      WHERE mission_id=mid AND id=ANY(approved_ids) AND status='approved';
      RETURN result;
    END IF;
  END IF;
  RETURN update_discussion_agreement(mid,actor,operation,expected,payload);
END $$;
REVOKE ALL ON FUNCTION public.change_mission_quote(uuid,uuid,text,integer,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.change_mission_quote(uuid,uuid,text,integer,jsonb) TO service_role;

DO $migration$
DECLARE quote_function text := pg_get_functiondef('public.get_client_quote(uuid,uuid)'::regprocedure);
BEGIN
  IF strpos(quote_function,'IF m.price_confirmed_version IS NULL OR exists')=0 THEN
    RAISE EXCEPTION 'Unexpected client quote function';
  END IF;
  EXECUTE replace(quote_function,'IF m.price_confirmed_version IS NULL OR exists',
    'IF m.price_confirmed_version IS NULL OR exists(select 1 from mission_quote_adjustments where mission_id=m.id and status in (''pending'',''approved'')) OR exists');
END $migration$;
COMMIT;
