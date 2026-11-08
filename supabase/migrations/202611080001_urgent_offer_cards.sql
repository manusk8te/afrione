-- Expose the offer summary to its recipient before the mission is assigned.
CREATE OR REPLACE FUNCTION public.list_urgent_offers()
RETURNS TABLE (
  id uuid, mission_id uuid, artisan_id uuid, expires_at timestamptz,
  category varchar, quartier varchar, total_price integer, mode varchar
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT attempt.id, attempt.mission_id, attempt.artisan_id, attempt.expires_at,
         mission.category::varchar, mission.quartier::varchar, mission.total_price::integer, mission.mode::varchar
  FROM public.dispatch_attempts attempt
  JOIN public.artisan_pros artisan ON artisan.id = attempt.artisan_id
  JOIN public.missions mission ON mission.id = attempt.mission_id
  WHERE artisan.user_id = (SELECT auth.uid())
    AND attempt.response IS NULL
    AND attempt.expires_at > now()
    AND mission.status = 'dispatching'
    AND mission.mode = 'urgent'
  ORDER BY attempt.created_at DESC, attempt.id;
$$;
REVOKE ALL ON FUNCTION public.list_urgent_offers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_urgent_offers() TO authenticated;
