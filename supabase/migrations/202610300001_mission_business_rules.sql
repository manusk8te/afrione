BEGIN;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS logic_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.missions ALTER COLUMN logic_version SET DEFAULT 2;
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS booking_key uuid,
 ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false,
 ADD COLUMN IF NOT EXISTS provider_accepted_at timestamptz,
 ADD COLUMN IF NOT EXISTS artisan_arrived_at timestamptz,
 ADD COLUMN IF NOT EXISTS client_arrival_confirmed_at timestamptz,
 ADD COLUMN IF NOT EXISTS price_confirmed_version integer,
 ADD COLUMN IF NOT EXISTS workflow_revision integer NOT NULL DEFAULT 0;
ALTER TABLE public.artisan_pros ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS mission_booking_key ON missions(client_id,booking_key) WHERE booking_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS public.mission_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES public.users(id), action text NOT NULL, previous_status text, next_status text,
 details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.payment_instructions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),mission_id uuid NOT NULL REFERENCES public.missions(id),
 kind text NOT NULL CHECK(kind IN ('release','refund')),status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','succeeded','failed','simulated')),
 is_test boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(mission_id,kind)
);
ALTER TABLE public.mission_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_instructions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mission_events,public.payment_instructions FROM anon,authenticated;
GRANT ALL ON public.mission_events,public.payment_instructions TO service_role;

CREATE OR REPLACE FUNCTION public.trade_key(v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE translate(lower(trim(v)),'éèêëàâäîïôöùûüç','eeeeaaaiioouuuc')
 WHEN 'plombier' THEN 'plomberie' WHEN 'electricien' THEN 'electricite' WHEN 'macon' THEN 'maconnerie'
 WHEN 'peintre' THEN 'peinture' WHEN 'menuisier' THEN 'menuiserie' WHEN 'frigoriste' THEN 'climatisation'
 WHEN 'climaticien' THEN 'climatisation' WHEN 'serrurier' THEN 'serrurerie' WHEN 'carreleur' THEN 'carrelage'
 WHEN 'aide menagere' THEN 'menage' WHEN 'cuisinier' THEN 'cuisine' WHEN 'coiffeuse' THEN 'coiffure'
 ELSE translate(lower(trim(v)),'éèêëàâäîïôöùûüç','eeeeaaaiioouuuc') END
$$;
CREATE OR REPLACE FUNCTION public.guard_mission_business_rules() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE provider uuid; test_provider boolean; context_actor text:=nullif(current_setting('afrione.workflow_actor',true),'');
begin
 IF NEW.client_id IS NULL THEN RAISE EXCEPTION 'Client requis'; END IF;
 IF NEW.artisan_id IS NOT NULL THEN
  SELECT user_id,is_test INTO provider,test_provider FROM artisan_pros WHERE id=NEW.artisan_id;
  IF provider IS NULL THEN RAISE EXCEPTION 'Prestataire introuvable'; END IF;
  IF provider=NEW.client_id THEN RAISE EXCEPTION 'Impossible de réserver sa propre prestation'; END IF;
  IF NEW.logic_version>=2 AND test_provider IS DISTINCT FROM NEW.is_test THEN RAISE EXCEPTION 'Les missions de test et les prestataires réels sont séparés'; END IF;
 END IF;
 IF TG_OP='INSERT' THEN
  IF auth.uid() IS NOT NULL AND (NEW.is_test OR NEW.logic_version<>2 OR NEW.client_id<>auth.uid() OR NEW.artisan_id IS NOT NULL OR NEW.status NOT IN ('diagnostic','matching') OR NEW.total_price IS NOT NULL) THEN RAISE EXCEPTION 'Création de mission non autorisée'; END IF;
 ELSE
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN RAISE EXCEPTION 'Le client d’une mission ne change pas'; END IF;
  IF auth.uid() IS NOT NULL AND (NEW.is_test IS DISTINCT FROM OLD.is_test OR NEW.logic_version IS DISTINCT FROM OLD.logic_version OR NEW.artisan_id IS DISTINCT FROM OLD.artisan_id OR NEW.total_price IS DISTINCT FROM OLD.total_price OR (NEW.logic_version>=2 AND NEW.status IS DISTINCT FROM OLD.status) OR NEW.provider_accepted_at IS DISTINCT FROM OLD.provider_accepted_at OR NEW.price_confirmed_version IS DISTINCT FROM OLD.price_confirmed_version) THEN RAISE EXCEPTION 'Utilisez une action métier contrôlée'; END IF;
  IF NEW.logic_version>=2 AND context_actor IS NULL AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.artisan_id IS DISTINCT FROM OLD.artisan_id OR NEW.provider_accepted_at IS DISTINCT FROM OLD.provider_accepted_at OR NEW.price_confirmed_version IS DISTINCT FROM OLD.price_confirmed_version OR (NEW.total_price IS DISTINCT FROM OLD.total_price AND OLD.artisan_id IS NOT NULL)) THEN RAISE EXCEPTION 'Utilisez une action métier contrôlée'; END IF;
  IF OLD.status IN ('completed','cancelled') AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.artisan_id IS DISTINCT FROM OLD.artisan_id OR NEW.total_price IS DISTINCT FROM OLD.total_price) THEN RAISE EXCEPTION 'Mission close et immuable'; END IF;
 END IF;
 IF NEW.logic_version>=2 AND NEW.status IN ('payment','scheduled','en_route','en_cours','pending_validation','completed') THEN
  IF NEW.artisan_id IS NULL OR NEW.provider_accepted_at IS NULL OR coalesce(NEW.price_confirmed_version,0)<1 THEN RAISE EXCEPTION 'Prestataire et devis doivent être acceptés'; END IF;
  IF EXISTS(SELECT 1 FROM discussion_agreements WHERE mission_id=NEW.id AND pending IS NOT NULL) THEN RAISE EXCEPTION 'Rectificatif en attente'; END IF;
  IF NOT EXISTS(SELECT 1 FROM transactions WHERE mission_id=NEW.id AND status IN ('escrow','released')) AND NOT (NEW.is_test AND EXISTS(SELECT 1 FROM payment_simulations WHERE mission_id=NEW.id)) THEN RAISE EXCEPTION 'Paiement confirmé requis avant intervention'; END IF;
 END IF;
 RETURN NEW;
end $$;
DROP TRIGGER IF EXISTS aa_mission_business_rules ON public.missions;
CREATE TRIGGER aa_mission_business_rules BEFORE INSERT OR UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.guard_mission_business_rules();

-- Direct client writes cannot approve identity or turn a test provider into a real one.
CREATE OR REPLACE FUNCTION public.guard_artisan_business_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
begin
 IF auth.uid() IS NOT NULL THEN
  IF TG_OP='INSERT' THEN
   IF NEW.user_id<>auth.uid() OR NEW.is_test OR NEW.kyc_status IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'Profil prestataire non autorisé'; END IF;
  ELSIF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.is_test IS DISTINCT FROM OLD.is_test OR NEW.kyc_status IS DISTINCT FROM OLD.kyc_status OR NEW.entreprise_id IS DISTINCT FROM OLD.entreprise_id THEN RAISE EXCEPTION 'Validation du profil réservée au serveur'; END IF;
 END IF; RETURN NEW;
end $$;
DROP TRIGGER IF EXISTS artisan_business_identity ON public.artisan_pros;
CREATE TRIGGER artisan_business_identity BEFORE INSERT OR UPDATE ON public.artisan_pros FOR EACH ROW EXECUTE FUNCTION public.guard_artisan_business_identity();
DROP POLICY IF EXISTS artisans_public_read ON public.artisan_pros;
CREATE POLICY artisans_public_read ON public.artisan_pros FOR SELECT USING(kyc_status='approved' AND NOT is_test);

CREATE OR REPLACE FUNCTION public.mission_workflow_action(mid uuid,actor uuid,operation text,payload jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.missions; ap public.artisan_pros; prior text; provider uuid; result jsonb; q jsonb; new_id uuid:=mid; target text; when_at timestamptz;
begin
 PERFORM set_config('afrione.workflow_actor',actor::text,true);
 IF operation='request_provider' AND mid IS NULL THEN
  IF payload->>'request_id' IS NULL THEN RAISE EXCEPTION 'Référence de réservation requise'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||(payload->>'request_id'),0));
  SELECT id INTO new_id FROM missions WHERE client_id=actor AND booking_key=(payload->>'request_id')::uuid;
  IF new_id IS NULL THEN
   SELECT * INTO ap FROM artisan_pros WHERE id=(payload->>'artisan_id')::uuid;
   IF ap.id IS NULL OR ap.is_test THEN RAISE EXCEPTION 'Prestataire indisponible'; END IF;
   INSERT INTO missions(client_id,category,quartier,status,mode,booking_key) VALUES(actor,ap.metier,left(payload->>'quartier',100),'diagnostic','standard',(payload->>'request_id')::uuid) RETURNING id INTO new_id;
  END IF;
 END IF;
 SELECT * INTO m FROM missions WHERE id=new_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Mission introuvable'; END IF;
 SELECT user_id INTO provider FROM artisan_pros WHERE id=m.artisan_id;
 IF actor IS DISTINCT FROM m.client_id AND actor IS DISTINCT FROM provider AND NOT(operation='resolve_dispute' AND EXISTS(SELECT 1 FROM users WHERE id=actor AND role='admin')) THEN RAISE EXCEPTION 'Vous ne participez pas à cette mission'; END IF;
 IF provider=m.client_id THEN RAISE EXCEPTION 'Impossible de réserver sa propre prestation'; END IF;
 prior=m.status;
 IF m.logic_version<2 THEN
  IF m.status NOT IN ('diagnostic','matching','negotiation') OR EXISTS(SELECT 1 FROM transactions WHERE mission_id=m.id) OR EXISTS(SELECT 1 FROM payment_simulations WHERE mission_id=m.id) THEN RAISE EXCEPTION 'Ancienne mission : vérification administrative requise'; END IF;
  UPDATE missions SET logic_version=2 WHERE id=m.id;
 END IF;
 IF operation='request_provider' THEN
  IF actor=m.client_id AND m.status='negotiation' AND m.artisan_id=(payload->>'artisan_id')::uuid THEN RETURN to_jsonb(m); END IF;
  IF actor<>m.client_id OR m.status NOT IN ('diagnostic','matching') OR m.artisan_id IS NOT NULL THEN RAISE EXCEPTION 'Attribution impossible dans cet état'; END IF;
  SELECT * INTO ap FROM artisan_pros WHERE id=(payload->>'artisan_id')::uuid FOR UPDATE;
  IF ap.user_id=m.client_id THEN RAISE EXCEPTION 'Impossible de réserver sa propre prestation'; END IF;
  IF ap.id IS NULL OR ap.kyc_status<>'approved' OR NOT ap.is_available OR ap.is_test<>m.is_test THEN RAISE EXCEPTION 'Prestataire indisponible'; END IF;
  IF trade_key(ap.metier) IS DISTINCT FROM trade_key(m.category) THEN RAISE EXCEPTION 'Ce prestataire ne correspond pas au métier demandé'; END IF;
  UPDATE missions SET artisan_id=ap.id,status='negotiation',provider_accepted_at=null,price_confirmed_version=null WHERE id=m.id;
 ELSIF operation='accept_assignment' THEN
  IF actor IS DISTINCT FROM provider OR m.status<>'negotiation' THEN RAISE EXCEPTION 'Acceptation réservée au prestataire sollicité'; END IF;
  IF m.provider_accepted_at IS NULL THEN UPDATE missions SET provider_accepted_at=now() WHERE id=m.id; END IF;
 ELSIF operation='reject_assignment' THEN
  IF actor IS DISTINCT FROM provider OR m.status<>'negotiation' OR m.provider_accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Refus impossible dans cet état'; END IF;
  UPDATE missions SET status='matching',artisan_id=null,total_price=null,price_confirmed_version=null WHERE id=m.id;
 ELSIF operation='pay_test' THEN
  IF m.is_test AND actor=m.client_id AND m.status='payment' THEN RETURN to_jsonb(m); END IF;
  IF NOT m.is_test OR actor<>m.client_id OR m.status<>'negotiation' OR m.price_confirmed_version IS NULL THEN RAISE EXCEPTION 'Paiement de test non autorisé'; END IF;
  q:=get_client_quote(m.id,actor);
  result:=simulate_client_payment_v2(m.id,actor,(q->>'total')::integer,payload->>'quote_revision');
  UPDATE missions SET status='payment' WHERE id=m.id;
 ELSIF operation IN ('schedule','start_now') THEN
  IF actor<>m.client_id THEN RAISE EXCEPTION 'Programmation réservée au client'; END IF;
  IF m.status='scheduled' THEN RETURN to_jsonb(m); END IF;
  IF m.status<>'payment' THEN RAISE EXCEPTION 'Paiement confirmé requis avant programmation'; END IF;
  when_at:=CASE WHEN operation='start_now' THEN now() ELSE (payload->>'scheduled_at')::timestamptz END;
  IF when_at IS NULL OR when_at<now()-interval '1 minute' THEN RAISE EXCEPTION 'Choisissez une date future'; END IF;
  UPDATE missions SET status='scheduled',scheduled_at=when_at WHERE id=m.id;
 ELSIF operation='start_tracking' THEN
  IF actor IS DISTINCT FROM provider THEN RAISE EXCEPTION 'Départ réservé au prestataire'; END IF;
  IF m.status='en_route' THEN RETURN to_jsonb(m); END IF;
  IF m.status<>'scheduled' OR m.scheduled_at>now()+interval '2 hours' THEN RAISE EXCEPTION 'Départ impossible avant le créneau prévu'; END IF;
  UPDATE missions SET status='en_route' WHERE id=m.id;
 ELSIF operation='arrived' THEN
  IF actor IS DISTINCT FROM provider OR m.status<>'en_route' THEN RAISE EXCEPTION 'Arrivée réservée au prestataire en route'; END IF;
  UPDATE missions SET artisan_arrived_at=coalesce(artisan_arrived_at,now()) WHERE id=m.id;
 ELSIF operation='confirm_arrival' THEN
  IF actor=m.client_id AND m.status='en_cours' THEN RETURN to_jsonb(m); END IF;
  IF actor<>m.client_id OR m.status<>'en_route' OR m.artisan_arrived_at IS NULL THEN RAISE EXCEPTION 'Le client doit confirmer l’arrivée déclarée'; END IF;
  UPDATE missions SET status='en_cours',client_arrival_confirmed_at=now(),started_at=now() WHERE id=m.id;
 ELSIF operation='submit_proof' THEN
  IF actor IS DISTINCT FROM provider OR m.status<>'en_cours' OR jsonb_typeof(payload->'photos') IS DISTINCT FROM 'array' OR jsonb_array_length(payload->'photos') NOT BETWEEN 1 AND 10 OR coalesce(length(trim(payload->>'notes')),0)<10 THEN RAISE EXCEPTION 'Photo de fin et compte rendu requis du prestataire'; END IF;
  IF EXISTS(SELECT 1 FROM proof_of_work WHERE mission_id=m.id) THEN
   UPDATE proof_of_work SET photo_after_urls=ARRAY(SELECT jsonb_array_elements_text(payload->'photos')),artisan_notes=payload->>'notes' WHERE mission_id=m.id;
  ELSE
   INSERT INTO proof_of_work(mission_id,photo_after_urls,artisan_notes) VALUES(m.id,ARRAY(SELECT jsonb_array_elements_text(payload->'photos')),payload->>'notes');
  END IF;
 ELSIF operation='done' THEN
  IF actor IS DISTINCT FROM provider THEN RAISE EXCEPTION 'Fin des travaux réservée au prestataire'; END IF;
  IF m.status='pending_validation' THEN RETURN to_jsonb(m); END IF;
  IF m.status<>'en_cours' THEN RAISE EXCEPTION 'Les travaux ne sont pas commencés'; END IF;
  IF NOT EXISTS(SELECT 1 FROM proof_of_work WHERE mission_id=m.id AND cardinality(photo_after_urls)>0 AND length(trim(coalesce(artisan_notes,'')))>=10) THEN RAISE EXCEPTION 'Photo de fin et compte rendu requis'; END IF;
  UPDATE missions SET status='pending_validation',completed_at=now(),validation_deadline=null WHERE id=m.id;
 ELSIF operation='dispute' THEN
  IF actor<>m.client_id OR m.status NOT IN ('en_route','en_cours','pending_validation') OR length(trim(coalesce(payload->>'reason','')))<10 THEN RAISE EXCEPTION 'Décrivez le problème avant de signaler un litige'; END IF;
  UPDATE missions SET status='disputed',validation_deadline=null WHERE id=m.id;
 ELSIF operation='validate' THEN
  IF actor<>m.client_id THEN RAISE EXCEPTION 'Validation réservée au client'; END IF;
  IF m.status='completed' THEN RETURN to_jsonb(m); END IF;
  IF m.status<>'pending_validation' THEN RAISE EXCEPTION 'Validation impossible avant la fin des travaux ou pendant un litige'; END IF;
  INSERT INTO payment_instructions(mission_id,kind,is_test,status) VALUES(m.id,'release',m.is_test,CASE WHEN m.is_test THEN 'simulated' ELSE 'queued' END) ON CONFLICT DO NOTHING;
  UPDATE proof_of_work SET validated_at=now() WHERE mission_id=m.id;
  UPDATE missions SET status='completed' WHERE id=m.id;
 ELSIF operation='resolve_dispute' THEN
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND role='admin') OR m.status<>'disputed' OR coalesce(length(trim(payload->>'reason')),0)<10 OR coalesce(payload->>'resolution','') NOT IN ('release','refund') THEN RAISE EXCEPTION 'Décision administrative motivée requise'; END IF;
  INSERT INTO payment_instructions(mission_id,kind,is_test,status) VALUES(m.id,payload->>'resolution',m.is_test,CASE WHEN m.is_test THEN 'simulated' ELSE 'queued' END) ON CONFLICT DO NOTHING;
  UPDATE missions SET status=CASE WHEN payload->>'resolution'='release' THEN 'completed' ELSE 'cancelled' END,validation_deadline=null WHERE id=m.id;
 ELSIF operation='cancel' THEN
  IF actor=m.client_id AND m.status='cancelled' THEN RETURN to_jsonb(m); END IF;
  IF actor<>m.client_id OR m.status NOT IN ('diagnostic','matching','negotiation','payment','scheduled') THEN RAISE EXCEPTION 'Annulation impossible : utilisez le signalement si la mission a commencé'; END IF;
  IF EXISTS(SELECT 1 FROM transactions WHERE mission_id=m.id AND status='escrow') THEN INSERT INTO payment_instructions(mission_id,kind,is_test) VALUES(m.id,'refund',m.is_test) ON CONFLICT DO NOTHING; END IF;
  UPDATE missions SET status='cancelled' WHERE id=m.id;
 ELSE RAISE EXCEPTION 'Action inconnue'; END IF;
 UPDATE missions SET workflow_revision=workflow_revision+1,updated_at=now() WHERE id=m.id RETURNING * INTO m;
 INSERT INTO mission_events(mission_id,actor_id,action,previous_status,next_status,details) VALUES(m.id,actor,operation,prior,m.status,jsonb_build_object('is_test',m.is_test,'reason',left(payload->>'reason',2000),'resolution',payload->>'resolution'));
 RETURN to_jsonb(m);
end $$;
REVOKE ALL ON FUNCTION public.mission_workflow_action(uuid,uuid,text,jsonb) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mission_workflow_action(uuid,uuid,text,jsonb) TO service_role;
-- Also used for a controlled provider refusal; other backwards transitions are removed.
CREATE OR REPLACE FUNCTION public.validate_mission_transition() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE allowed jsonb:='{"diagnostic":["matching","dispatching","negotiation","payment","cancelled"],"matching":["negotiation","dispatching","payment","cancelled"],"dispatching":["en_route","payment","cancelled"],"negotiation":["matching","payment","cancelled"],"payment":["dispatching","scheduled","cancelled"],"scheduled":["en_route","cancelled"],"en_route":["en_cours","disputed"],"en_cours":["pending_validation","disputed"],"pending_validation":["completed","disputed"],"disputed":["completed","cancelled"],"completed":[],"cancelled":[]}';
begin
 IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 IF NOT coalesce(allowed->OLD.status @> to_jsonb(NEW.status),false) THEN RAISE EXCEPTION 'Transition interdite : % → %',OLD.status,NEW.status; END IF;
 RETURN NEW;
end $$;
CREATE OR REPLACE FUNCTION public.guard_user_business_role() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
begin
 IF auth.uid() IS NOT NULL THEN
  IF TG_OP='INSERT' AND (NEW.id<>auth.uid() OR NEW.role NOT IN ('client','artisan')) THEN RAISE EXCEPTION 'Rôle utilisateur non autorisé'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR (NEW.role IS DISTINCT FROM OLD.role AND (NEW.role='admin' OR OLD.role='admin'))) THEN RAISE EXCEPTION 'Rôle administrateur réservé au serveur'; END IF;
 END IF; RETURN NEW;
end $$;
DROP TRIGGER IF EXISTS user_business_role ON users;
CREATE TRIGGER user_business_role BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION guard_user_business_role();
COMMIT;
