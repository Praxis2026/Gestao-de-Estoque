-- SQL Script to fix the "Database error saving new user" error.
-- This error usually happens when a trigger on auth.users fails.
-- Run this in your Supabase SQL Editor.

-- 1. Ensure the 'users' table has the correct structure
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'OPERADOR',
  perfil_id BIGINT REFERENCES public."Perfil"(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create a robust trigger function to sync auth.users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, role, perfil_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'Novo Usuário'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'OPERADOR'),
    (NEW.raw_user_meta_data->>'perfil_id')::BIGINT
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    perfil_id = EXCLUDED.perfil_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Set up the trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Ensure RLS is enabled and policies are set
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated" ON public.users;
CREATE POLICY "Allow all for authenticated" ON public.users
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
