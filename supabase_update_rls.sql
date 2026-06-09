-- Comprehensive SQL Script to verify and update Row Level Security (RLS)
-- This script ensures RLS is enabled and policies are correctly set for all tables.

-- 1. List of tables to process
-- Category, UnitOfMeasure, Supplier, Material, Patient, Course, Movimentacao, Setting, Perfil, users, User

-- 2. Dynamic RLS enforcement for all relevant tables
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Loop through all tables in the public schema that match our criteria
    FOR r IN (
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND (
            tablename IN ('Category', 'UnitOfMeasure', 'Supplier', 'Material', 'Patient', 'Course', 'Movimentacao', 'Setting', 'Perfil', 'users', 'User')
            OR tablename LIKE 'v_%'
        )
    ) LOOP
        -- Enable RLS
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
        
        -- Create/Update Policies (Allow all for authenticated users)
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated" ON public.%I', r.tablename);
        EXECUTE format('CREATE POLICY "Allow all for authenticated" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', r.tablename);
        
        RAISE NOTICE 'Updated RLS for table: %', r.tablename;
    END LOOP;
END $$;

-- 3. Ensure SELECT permissions for authenticated role on all entities (supports views)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 4. Reload PostgREST schema cache to apply changes immediately
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
    RAISE NOTICE 'RLS policies have been dynamically verified and updated for all project tables, including v_ entities.';
END $$;
