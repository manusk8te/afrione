-- Explicit scope, discussion choice and versioned provider rectifications.
create table if not exists public.discussion_agreements (
  mission_id uuid primary key references public.missions(id) on delete cascade,
  version integer not null default 0,
  discussion boolean not null,
  scope text not null,
  pending jsonb,
  history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.discussion_agreements enable row level security;
revoke all on public.discussion_agreements from anon, authenticated;
grant all on public.discussion_agreements to service_role;
create or replace function public.update_discussion_agreement(mid uuid, actor uuid, operation text, expected integer, payload jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m public.missions; a public.discussion_agreements; artisan_user uuid; event jsonb; proposal jsonb;
begin
  select * into m from public.missions where id=mid for update;
  if not found then raise exception 'Mission introuvable'; end if;
  select user_id into artisan_user from public.artisan_pros where id=m.artisan_id;
  if actor is distinct from m.client_id and actor is distinct from artisan_user then raise exception 'Participant requis'; end if;
  if m.status not in ('diagnostic','matching','negotiation') or exists(select 1 from public.payment_simulations where mission_id=mid) then
    raise exception 'Accord verrouillé : mission déjà confirmée ou payée';
  end if;
  select * into a from public.discussion_agreements where mission_id=mid for update;
  if coalesce(a.version,0) <> expected then raise exception 'Accord modifié. Rechargez avant de confirmer'; end if;
  if operation='confirm' then
    if actor is distinct from m.client_id then raise exception 'Confirmation réservée au client'; end if;
    if a.mission_id is not null then raise exception 'Périmètre déjà confirmé : demandez un rectificatif'; end if;
    if coalesce(length(trim(payload->>'scope')),0) not between 10 and 4000 or jsonb_typeof(payload->'discussion') is distinct from 'boolean' then raise exception 'Périmètre et choix de discussion requis'; end if;
    insert into public.discussion_agreements(mission_id,discussion,scope) values(mid,(payload->>'discussion')::boolean,trim(payload->>'scope'));
  elsif operation='propose' then
    if actor is distinct from artisan_user or actor=m.client_id then raise exception 'Rectificatif réservé au prestataire'; end if;
    if a.mission_id is null then raise exception 'Le client doit confirmer le périmètre initial'; end if;
    if coalesce(length(trim(payload->>'scope')),0) not between 10 and 4000 or coalesce(length(trim(payload->>'reason')),0) not between 10 and 2000 then raise exception 'Périmètre et justification détaillés requis'; end if;
    if coalesce((payload->>'amount')::numeric,0) not between 1 and 100000000 or (payload->>'amount')::numeric <> trunc((payload->>'amount')::numeric) then raise exception 'Montant entier FCFA invalide'; end if;
    if coalesce(payload->>'supplies','') not in ('included','excluded') then raise exception 'Précisez si les fournitures sont comprises'; end if;
    proposal=jsonb_build_object('scope',trim(payload->>'scope'),'reason',trim(payload->>'reason'),'amount',(payload->>'amount')::integer,'supplies',payload->>'supplies','proposed_by',actor,'proposed_at',now());
    update public.discussion_agreements set pending=proposal where mission_id=mid;
  elsif operation in ('accept','reject') then
    if actor is distinct from m.client_id then raise exception 'Réponse réservée au client'; end if;
    if a.pending is null then raise exception 'Aucun rectificatif à confirmer'; end if;
    if operation='accept' then
      if a.pending->>'supplies'='included' and exists(select 1 from public.diagnostic_product_selections where mission_id=mid and billing_mode='additional') then raise exception 'Fournitures comprises : retirez les produits facturés séparément pour éviter un double comptage'; end if;
      -- This is the service quote, before separately selected additional supplies.
      update public.missions set total_price=(a.pending->>'amount')::integer, updated_at=now() where id=mid;
      update public.discussion_agreements set scope=a.pending->>'scope',pending=null where mission_id=mid;
    else update public.discussion_agreements set pending=null where mission_id=mid;
    end if;
    proposal=a.pending;
  else raise exception 'Action inconnue'; end if;
  event=jsonb_build_object('action',operation,'actor',actor,'at',now(),'payload',case when operation in ('accept','reject','propose') then proposal else payload end);
  update public.discussion_agreements set version=expected+1, history=history||jsonb_build_array(event),updated_at=now() where mission_id=mid returning * into a;
  return to_jsonb(a);
end $$;
revoke all on function public.update_discussion_agreement(uuid,uuid,text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.update_discussion_agreement(uuid,uuid,text,integer,jsonb) to service_role;

-- Receipt creation and agreement updates both lock the mission first.
create or replace function public.guard_pending_discussion_payment()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform 1 from public.missions where id=new.mission_id for update;
  if exists(select 1 from public.discussion_agreements where mission_id=new.mission_id and pending is not null) then
    raise exception 'quote_changed: rectificatif en attente de réponse';
  end if;
  return new;
end $$;
drop trigger if exists guard_pending_discussion_payment on public.payment_simulations;
create trigger guard_pending_discussion_payment before insert on public.payment_simulations for each row execute function public.guard_pending_discussion_payment();

create or replace function public.guard_discussion_message()
returns trigger language plpgsql security definer set search_path=public as $$
declare m public.missions; provider uuid; actual_role text;
begin
  select * into m from public.missions where id=new.mission_id for update;
  select user_id into provider from public.artisan_pros where id=m.artisan_id;
  actual_role=case when new.sender_id=m.client_id then 'client' when new.sender_id=provider then 'artisan' else 'guest' end;
  if new.type in ('text','devis','quotation','price_proposal','time_adjust','material_suggest','material_response') then
    if auth.uid() is not null and new.sender_id is distinct from auth.uid() then raise exception 'Émetteur invalide'; end if;
    if actual_role='guest' or new.sender_role is distinct from actual_role then raise exception 'Rôle de conversation invalide'; end if;
    if m.status in ('completed','cancelled') then raise exception 'Conversation close'; end if;
  end if;
  if new.type in ('price_proposal','time_adjust','material_suggest') and actual_role <> 'artisan' then raise exception 'Action réservée au prestataire'; end if;
  if new.type='material_response' and actual_role <> 'client' then raise exception 'Accord réservé au client'; end if;
  if new.type='text' then
    if exists(select 1 from public.discussion_agreements where mission_id=new.mission_id and discussion=false) then raise exception 'Discussion libre désactivée'; end if;
    if length(trim(new.text)) not between 1 and 4000 then raise exception 'Message invalide'; end if;
    if (select count(*) from public.chat_history where mission_id=new.mission_id and sender_id=new.sender_id and type='text' and created_at>now()-interval '1 minute') >=12 then raise exception 'Trop de messages rapprochés'; end if;
  end if;
  return new;
end $$;
drop trigger if exists guard_discussion_message on public.chat_history;
create trigger guard_discussion_message before insert on public.chat_history for each row execute function public.guard_discussion_message();
