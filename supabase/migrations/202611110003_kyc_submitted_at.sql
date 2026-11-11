-- Distinguer un artisan qui a envoyé ses documents de celui qui n'a rien envoyé.
-- Jusqu'ici, kyc_status = 'pending' voulait dire les deux.
alter table public.kyc_security add column if not exists submitted_at timestamptz;

-- Les dossiers déjà complets (CNI recto + verso) et en attente comptent comme envoyés.
update public.kyc_security
   set submitted_at = coalesce(created_at, now())
 where submitted_at is null
   and status = 'pending'
   and cni_front_url is not null
   and cni_back_url is not null;
