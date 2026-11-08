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
    'users', jsonb_build_object('name', u.name, 'quartier', u.quartier)
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
