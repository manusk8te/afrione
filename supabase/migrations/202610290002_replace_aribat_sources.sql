BEGIN;
ALTER TABLE public.price_sources ADD COLUMN IF NOT EXISTS archived_at timestamptz;
UPDATE public.price_sources SET archived_at=now() WHERE lower(coalesce(url,'')) ~ '^https?://(www\.)?aribat\.ci(/|$)' AND archived_at IS NULL;
INSERT INTO public.price_sources(name,type,url,verified,is_partner,scraper_type,notes,access_status,access_checked_at)
SELECT x.name,'website',x.url,false,false,'manual',x.notes,'available',now()
FROM (VALUES
('ProduitBat','https://produitbat.ci/','Site accessible ; relevé manuel requis, extraction de prix non validée.'),
('IvoirElite','https://ivoirelite.net/','Catalogue public. Retenir uniquement les fournitures pertinentes ; prix et unité à vérifier sur la fiche.'),
('Sogep Africa','https://sogep-africa.com/','Catalogue public électricité et plomberie ; relevé manuel avec fiche, prix et unité à contrôler.')
) AS x(name,url,notes)
WHERE NOT EXISTS (SELECT 1 FROM public.price_sources s WHERE s.url=x.url AND s.archived_at IS NULL);
COMMIT;
