BEGIN;
CREATE OR REPLACE FUNCTION public.update_discussion_agreement(mid uuid,actor uuid,operation text,expected integer,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.missions; a public.discussion_agreements; provider uuid; proposal jsonb; actor_role text; event jsonb; n integer;
begin
 PERFORM set_config('afrione.workflow_actor',actor::text,true);
 SELECT * INTO m FROM missions WHERE id=mid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Mission introuvable'; END IF;
 SELECT user_id INTO provider FROM artisan_pros WHERE id=m.artisan_id;
 IF provider=m.client_id THEN RAISE EXCEPTION 'Impossible de négocier avec soi-même'; END IF;
 actor_role:=CASE WHEN actor=m.client_id THEN 'client' WHEN actor=provider THEN 'artisan' ELSE 'guest' END;
 IF actor_role='guest' THEN RAISE EXCEPTION 'Participant requis'; END IF;
 IF m.status NOT IN ('diagnostic','matching','negotiation') OR EXISTS(SELECT 1 FROM payment_simulations WHERE mission_id=mid) OR EXISTS(SELECT 1 FROM transactions WHERE mission_id=mid AND status IN ('escrow','released')) THEN RAISE EXCEPTION 'Accord verrouillé après confirmation ou paiement'; END IF;
 SELECT * INTO a FROM discussion_agreements WHERE mission_id=mid FOR UPDATE;
 IF coalesce(a.version,0)<>expected THEN RAISE EXCEPTION 'Accord modifié. Rechargez avant de confirmer'; END IF;
 IF operation='confirm' THEN
  IF actor_role<>'client' OR a.mission_id IS NOT NULL THEN RAISE EXCEPTION 'Le client confirme une seule fois le périmètre initial'; END IF;
  IF coalesce(length(trim(payload->>'scope')),0) NOT BETWEEN 10 AND 4000 OR jsonb_typeof(payload->'discussion') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Périmètre et choix de discussion requis'; END IF;
  INSERT INTO discussion_agreements(mission_id,scope,discussion) VALUES(mid,trim(payload->>'scope'),(payload->>'discussion')::boolean);
 ELSIF operation IN ('propose','counter') THEN
  IF (operation='propose' AND actor_role<>'artisan') OR (operation='counter' AND actor_role<>'client') THEN RAISE EXCEPTION 'Rôle incorrect pour cette proposition'; END IF;
  IF m.provider_accepted_at IS NULL THEN RAISE EXCEPTION 'Le prestataire doit accepter la demande'; END IF;
  IF a.mission_id IS NULL THEN RAISE EXCEPTION 'Le client doit confirmer le périmètre initial'; END IF;
  IF operation='counter' AND (a.pending IS NULL OR coalesce(a.pending->>'proposed_role','artisan')<>'artisan') THEN RAISE EXCEPTION 'Aucun devis prestataire à négocier'; END IF;
  IF coalesce(length(trim(payload->>'scope')),0) NOT BETWEEN 10 AND 4000 OR coalesce(length(trim(payload->>'reason')),0) NOT BETWEEN 10 AND 2000 THEN RAISE EXCEPTION 'Périmètre et justification requis'; END IF;
  IF coalesce((payload->>'amount')::numeric,0) NOT BETWEEN 1 AND 100000000 OR (payload->>'amount')::numeric<>trunc((payload->>'amount')::numeric) THEN RAISE EXCEPTION 'Montant entier FCFA invalide'; END IF;
  IF coalesce(payload->>'supplies','') NOT IN ('included','excluded') THEN RAISE EXCEPTION 'Précisez les fournitures'; END IF;
  SELECT count(*) INTO n FROM jsonb_array_elements(a.history) h WHERE h->>'action' IN ('propose','counter') AND (h->>'at')::timestamptz>now()-interval '1 hour';
  IF n>=20 THEN RAISE EXCEPTION 'Trop de propositions rapprochées'; END IF;
  proposal:=jsonb_build_object('scope',trim(payload->>'scope'),'reason',trim(payload->>'reason'),'amount',(payload->>'amount')::integer,'supplies',payload->>'supplies','proposed_by',actor,'proposed_role',actor_role,'proposed_at',now());
  UPDATE discussion_agreements SET pending=proposal WHERE mission_id=mid;
 ELSIF operation='accept_counter' THEN
  IF actor_role<>'artisan' OR a.pending->>'proposed_role' IS DISTINCT FROM 'client' THEN RAISE EXCEPTION 'Aucune contre-proposition client à accepter'; END IF;
  proposal:=a.pending||jsonb_build_object('proposed_by',actor,'proposed_role','artisan','proposed_at',now(),'counter_endorsed',true);
  UPDATE discussion_agreements SET pending=proposal WHERE mission_id=mid;
 ELSIF operation IN ('accept','reject') THEN
  IF a.pending IS NULL THEN RAISE EXCEPTION 'Aucun rectificatif à confirmer'; END IF;
  IF operation='accept' THEN
   IF actor_role<>'client' OR a.pending->>'proposed_role' IS DISTINCT FROM 'artisan' THEN RAISE EXCEPTION 'Le client confirme le devis du prestataire'; END IF;
   IF a.pending->>'supplies'='included' AND EXISTS(SELECT 1 FROM diagnostic_product_selections WHERE mission_id=mid AND billing_mode='additional') THEN RAISE EXCEPTION 'Retirez les fournitures supplémentaires pour éviter le double comptage'; END IF;
   proposal:=a.pending;
   UPDATE discussion_agreements SET scope=proposal->>'scope',pending=null WHERE mission_id=mid;
   UPDATE missions SET total_price=(proposal->>'amount')::integer,price_confirmed_version=expected+1,updated_at=now() WHERE id=mid;
  ELSE
   IF actor_role<>'client' AND NOT(actor_role='artisan' AND a.pending->>'proposed_role'='client') THEN RAISE EXCEPTION 'Refus non autorisé'; END IF;
   proposal:=a.pending;
   UPDATE discussion_agreements SET pending=null WHERE mission_id=mid;
  END IF;
 ELSE RAISE EXCEPTION 'Action inconnue'; END IF;
 event:=jsonb_build_object('action',operation,'actor',actor,'at',now(),'payload',coalesce(proposal,payload));
 UPDATE discussion_agreements SET version=expected+1,history=history||jsonb_build_array(event),updated_at=now() WHERE mission_id=mid RETURNING * INTO a;
 INSERT INTO mission_events(mission_id,actor_id,action,previous_status,next_status,details) VALUES(mid,actor,'quote_'||operation,m.status,m.status,jsonb_build_object('version',a.version,'amount',proposal->'amount','is_test',m.is_test));
 INSERT INTO chat_history(mission_id,sender_id,sender_role,type,text) VALUES(mid,actor,actor_role,'system',CASE operation WHEN 'accept' THEN 'Devis confirmé par le client : '||(proposal->>'amount')||' FCFA.' WHEN 'propose' THEN 'Nouveau devis du prestataire : '||(proposal->>'amount')||' FCFA. Confirmation du client nécessaire.' WHEN 'counter' THEN 'Contre-proposition client : '||(proposal->>'amount')||' FCFA. Réponse du prestataire nécessaire.' WHEN 'accept_counter' THEN 'Contre-proposition acceptée par le prestataire. Le client doit confirmer le devis final.' WHEN 'reject' THEN 'Proposition refusée. Aucun supplément appliqué.' ELSE 'Le client a confirmé le périmètre de sa demande.' END);
 RETURN to_jsonb(a);
end $$;
REVOKE ALL ON FUNCTION public.update_discussion_agreement(uuid,uuid,text,integer,jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_discussion_agreement(uuid,uuid,text,integer,jsonb) TO service_role;
-- Include the accepted version and scope in the quote hash: an equal-price scope change is still a new quote.
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('public.get_client_quote(uuid,uuid)'::regprocedure) INTO definition;
 IF position('agreement_version' in definition)=0 THEN
  definition:=replace(definition,'RETURN result||jsonb_build_object',E'IF m.logic_version>=2 AND m.artisan_id IS NOT NULL THEN\n result:=result||jsonb_build_object(''agreement_version'',m.price_confirmed_version,''scope'',(select scope from discussion_agreements where mission_id=m.id));\n IF m.price_confirmed_version IS NULL OR exists(select 1 from discussion_agreements where mission_id=m.id and pending is not null) THEN result:=result||jsonb_build_object(''total'',null,''needs_quote'',true); END IF; END IF;\n RETURN result||jsonb_build_object');
  EXECUTE definition;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.guard_pending_discussion_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.missions; a public.discussion_agreements;
begin
 SELECT * INTO m FROM missions WHERE id=NEW.mission_id FOR UPDATE;
 SELECT * INTO a FROM discussion_agreements WHERE mission_id=m.id;
 IF a.pending IS NOT NULL THEN RAISE EXCEPTION 'quote_changed: rectificatif en attente de réponse'; END IF;
 IF m.logic_version>=2 AND m.artisan_id IS NOT NULL AND (m.provider_accepted_at IS NULL OR m.price_confirmed_version IS NULL) THEN RAISE EXCEPTION 'quote_changed: prestataire et devis non confirmés'; END IF;
 NEW.quote_snapshot:=NEW.quote_snapshot||jsonb_build_object('agreement',to_jsonb(a));
 RETURN NEW;
end $$;
-- Private evidence and live location, with role/state checks even on direct Supabase writes.
CREATE OR REPLACE FUNCTION public.guard_mission_evidence() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.missions; provider uuid;
begin
 SELECT * INTO m FROM missions WHERE id=NEW.mission_id FOR UPDATE;
 SELECT user_id INTO provider FROM artisan_pros WHERE id=m.artisan_id;
 IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM provider THEN RAISE EXCEPTION 'Preuve ou position réservée au prestataire assigné'; END IF;
 IF TG_TABLE_NAME='gps_tracking' THEN
  IF NEW.artisan_id IS DISTINCT FROM m.artisan_id OR m.status NOT IN ('en_route','en_cours') OR NEW.lat IS NULL OR NEW.lng IS NULL OR NEW.lat NOT BETWEEN -90 AND 90 OR NEW.lng NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'Position refusée hors mission active'; END IF;
 ELSE
  IF auth.uid() IS NOT NULL AND (NEW.validated_at IS NOT NULL OR NEW.client_signature IS NOT NULL) THEN RAISE EXCEPTION 'Le prestataire ne peut pas valider ses propres travaux'; END IF;
  IF m.status NOT IN ('en_route','en_cours') AND nullif(current_setting('afrione.workflow_actor',true),'') IS NULL THEN RAISE EXCEPTION 'Preuves verrouillées dans cet état'; END IF;
  IF TG_OP='UPDATE' AND NEW.mission_id IS DISTINCT FROM OLD.mission_id THEN RAISE EXCEPTION 'La mission d’une preuve ne change pas'; END IF;
 END IF; RETURN NEW;
end $$;
DROP TRIGGER IF EXISTS mission_evidence_guard ON proof_of_work;
CREATE TRIGGER mission_evidence_guard BEFORE INSERT OR UPDATE ON proof_of_work FOR EACH ROW EXECUTE FUNCTION guard_mission_evidence();
DROP TRIGGER IF EXISTS mission_location_guard ON gps_tracking;
CREATE TRIGGER mission_location_guard BEFORE INSERT OR UPDATE ON gps_tracking FOR EACH ROW EXECUTE FUNCTION guard_mission_evidence();
ALTER TABLE proof_of_work ENABLE ROW LEVEL SECURITY;
ALTER TABLE gps_tracking ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON proof_of_work,gps_tracking FROM anon;
REVOKE INSERT,UPDATE,DELETE ON proof_of_work FROM authenticated;
GRANT SELECT ON proof_of_work TO authenticated;
GRANT SELECT,INSERT ON gps_tracking TO authenticated;
DO $$ DECLARE t text; p record; BEGIN
 FOREACH t IN ARRAY ARRAY['proof_of_work','gps_tracking'] LOOP
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t); END LOOP;
  EXECUTE format('CREATE POLICY evidence_participants_read ON public.%I FOR SELECT TO authenticated USING (exists(select 1 from public.missions m where m.id=mission_id and (m.client_id=auth.uid() or exists(select 1 from public.artisan_pros ap where ap.id=m.artisan_id and ap.user_id=auth.uid()))))',t);
  EXECUTE format('CREATE POLICY evidence_provider_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (exists(select 1 from public.missions m join public.artisan_pros ap on ap.id=m.artisan_id where m.id=mission_id and ap.user_id=auth.uid() and m.status in (''en_route'',''en_cours'')))',t);
 END LOOP;
END $$;
-- Evidence is written only after server-side storage checks.
DROP POLICY IF EXISTS evidence_provider_insert ON proof_of_work;
DROP POLICY IF EXISTS proof_upload_participant ON storage.objects;
CREATE POLICY proof_upload_participant ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(
 bucket_id<>'portfolio' OR split_part(name,'/',1)<>'proof' OR EXISTS(SELECT 1 FROM public.missions m JOIN public.artisan_pros ap ON ap.id=m.artisan_id WHERE m.id::text=split_part(name,'/',2) AND ap.user_id=auth.uid() AND m.status='en_cours')
);
-- Legacy financial RPCs must never be called directly from a browser.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('release_escrow','refund_escrow') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public,anon,authenticated',p.signature);
 END LOOP;
END $$;

COMMIT;
