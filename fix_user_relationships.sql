-- SQL Script to fix the relationship between users and Perfil
-- Run this in your Supabase SQL Editor to ensure the foreign key exists.

-- 1. Ensure the perfil_id column exists in the 'users' table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'perfil_id') THEN
        ALTER TABLE "users" ADD COLUMN perfil_id BIGINT;
    END IF;
END $$;

-- 2. Ensure the foreign key relationship exists for 'users'
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_perfil_id_fkey";
ALTER TABLE "users" ADD CONSTRAINT "users_perfil_id_fkey" FOREIGN KEY (perfil_id) REFERENCES "Perfil"(id);

-- 3. Ensure the perfil_id column exists in the 'User' table (if it exists)
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'User') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'perfil_id') THEN
            ALTER TABLE "User" ADD COLUMN perfil_id BIGINT;
        END IF;
        
        -- Add foreign key for 'User' table
        ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_perfil_id_fkey";
        ALTER TABLE "User" ADD CONSTRAINT "User_perfil_id_fkey" FOREIGN KEY (perfil_id) REFERENCES "Perfil"(id);
    END IF;
END $$;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
