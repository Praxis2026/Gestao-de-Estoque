-- SQL Script to automatically delete a user from Supabase Auth 
-- when their profile is deleted from the public.users table.
-- Run this in your Supabase SQL Editor.

-- 1. Create the function that will perform the deletion
-- We use SECURITY DEFINER to allow the function to bypass RLS and access auth.users
CREATE OR REPLACE FUNCTION public.handle_delete_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete the user from the Supabase Auth table
  -- This requires the function to be owned by a superuser (default in SQL Editor)
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on the public.users table
DROP TRIGGER IF EXISTS on_public_user_deleted ON public.users;
CREATE TRIGGER on_public_user_deleted
  AFTER DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_delete_user();

-- 3. (Optional) Do the same for the 'User' table if you still use it
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
        DROP TRIGGER IF EXISTS on_public_User_singular_deleted ON public."User";
        CREATE TRIGGER on_public_User_singular_deleted
          AFTER DELETE ON public."User"
          FOR EACH ROW EXECUTE FUNCTION public.handle_delete_user();
    END IF;
END $$;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
