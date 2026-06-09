-- SQL Script to fix the role check constraint in the users table
-- This error occurs when the database has a strict list of allowed roles that doesn't match the app.

-- 1. Remove the existing check constraint from the 'users' table
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_check";

-- 2. Add the correct check constraint matching the app's UserRole type
-- This ensures 'OPERADOR', 'VISUALIZADOR' and 'ADMINISTRADOR' are allowed.
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" 
CHECK (role IN ('OPERADOR', 'VISUALIZADOR', 'ADMINISTRADOR', 'ADMIN', 'USER'));

-- 3. (Optional) Do the same for the 'User' table if it exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
        ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_role_check";
        ALTER TABLE "User" ADD CONSTRAINT "User_role_check" 
        CHECK (role IN ('OPERADOR', 'VISUALIZADOR', 'ADMINISTRADOR', 'ADMIN', 'USER'));
    END IF;
END $$;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
