-- SQL Script to fix permissions so the Login page can read settings (like the Logo) and support Test Mode logins.
-- Run this in your Supabase SQL Editor (SQL Editor > New Query > Paste > Run).

-- 1. Grant SELECT permission to anonymous (unauthenticated) users on "Setting" and "users" tables
GRANT SELECT ON public."Setting" TO anon;
GRANT SELECT ON public."users" TO anon;

-- 2. Create Row Level Security (RLS) policies for anonymous read access
-- This lets the Login page pull the logo URL and verify Test Mode accounts before the user logs in.

-- Enable SELECT for anon on "Setting"
DROP POLICY IF EXISTS "Allow select for anon" ON public."Setting";
CREATE POLICY "Allow select for anon" ON public."Setting"
  FOR SELECT TO anon USING (true);

-- Enable SELECT for anon on "users"
DROP POLICY IF EXISTS "Allow select for anon" ON public."users";
CREATE POLICY "Allow select for anon" ON public."users"
  FOR SELECT TO anon USING (true);

-- 3. Notify PostgREST to reload the schema cache immediately
NOTIFY pgrst, 'reload schema';
