-- Migration: Automatic Profile Creation via Trigger (Force Admin Role)
-- Timestamp: 20260626184500

-- 1. Update all existing profiles to be Admin (role_id = 1)
UPDATE public.profiles SET role_id = 1;

-- 2. Create/Replace the function to handle new user registration, forcing Admin role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert profile forcing role_id = 1 (Admin)
  INSERT INTO public.profiles (id, full_name, email, is_active, role_id)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1),
      'Usuario Nuevo'
    ),
    new.email,
    true,
    1 -- Force Admin role
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    role_id = 1; -- Force Admin role on conflict/update
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Create the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill any existing users in auth.users that are missing a profile (with role_id = 1)
INSERT INTO public.profiles (id, full_name, email, is_active, role_id)
SELECT 
  u.id,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1),
    'Usuario'
  ) AS full_name,
  u.email,
  true AS is_active,
  1 AS role_id
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
