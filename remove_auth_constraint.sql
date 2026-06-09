-- SQL Script to remove the strict foreign key requirement for the users table
-- This allows creating "Profile" records without a corresponding Auth record,
-- which is useful for bypassing Supabase Auth rate limits during development/testing.

-- 1. Drop the existing foreign key constraint if it exists
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_id_fkey";

-- 2. (Optional) Re-add it as a soft reference or just leave it off
-- For this applet, we'll leave it off to allow "Mock" users.
