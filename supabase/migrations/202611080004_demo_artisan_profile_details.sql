-- The public directory gets only display fields for the synthetic QA cohort.
CREATE OR REPLACE FUNCTION public.list_demo_artisans(profile_id uuid DEFAULT NULL)
RETURNS SETOF jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'id', a.id,
    'is_test', true,
    'metier', a.metier,
    'bio', a.bio,
    'years_experience', a.years_experience,
    'is_available', a.is_available,
    'response_time_min', a.response_time_min,
    'portfolio', jsonb_build_array(CASE public.trade_key(a.metier)
      WHEN 'plomberie' THEN '/metier-plomberie.jpg'
      WHEN 'electricite' THEN '/metier-electricite.jpg'
      WHEN 'maconnerie' THEN '/metier-maconnerie.jpg'
      WHEN 'peinture' THEN '/metier-peinture.jpg'
      WHEN 'menuiserie' THEN '/metier-menuiserie.jpg'
      WHEN 'climatisation' THEN '/metier-climatisation.jpg'
      WHEN 'serrurerie' THEN '/metier-serrurerie.jpg'
      WHEN 'carrelage' THEN '/metier-carrelage.jpg'
      ELSE '/afrione-services-4k.jpg'
    END),
    'users', jsonb_build_object('name', regexp_replace(u.name, '^\[TEST\] ', ''), 'quartier', u.quartier)
  )
  FROM public.artisan_pros a
  JOIN public.users u ON u.id = a.user_id
  WHERE a.is_test AND a.kyc_status = 'approved'
    AND u.email ~ '^qa-[0-9a-f]{10}-[0-9]+@afrione[.]test$'
    AND u.name LIKE '[TEST] %'
    AND (profile_id IS NULL OR a.id = profile_id)
  ORDER BY a.metier, u.name, a.id;
$$;

REVOKE ALL ON FUNCTION public.list_demo_artisans(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_demo_artisans(uuid) TO anon, authenticated;
