ALTER TABLE public.artisan_pros
  ADD COLUMN IF NOT EXISTS matching_trade text GENERATED ALWAYS AS (public.trade_key(translate(metier, 'ÉÈÊËÀÂÄÎÏÔÖÙÛÜÇ', 'éèêëàâäîïôöùûüç'))) STORED;

CREATE INDEX IF NOT EXISTS artisan_pros_available_matching_trade
  ON public.artisan_pros (matching_trade, is_test, id)
  WHERE kyc_status = 'approved' AND is_available;
