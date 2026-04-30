-- ============================================
-- MIGRATION : Trigger auth.users → public.users
-- À exécuter dans Supabase SQL Editor
-- ============================================

-- 1. Rendre phone nullable (les inscriptions se font par email, pas par téléphone)
ALTER TABLE public.users ALTER COLUMN phone DROP NOT NULL;

-- 2. Fonction déclenchée après chaque inscription Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Utilisateur'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    NEW.phone  -- NULL pour les inscriptions email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Attacher le trigger sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Politique RLS : les utilisateurs peuvent lire leur propre ligne
--    (remplace l'ancienne politique si elle bloquait les nouveaux inscrits)
DROP POLICY IF EXISTS "users_own" ON public.users;
CREATE POLICY "users_own" ON public.users
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 5. Rétrocompatibilité : créer les lignes manquantes pour les auth.users existants
INSERT INTO public.users (id, name, email, role)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', 'Utilisateur'),
  au.email,
  COALESCE(au.raw_user_meta_data->>'role', 'client')
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id);
