-- SQL Script to add an automatically generated unique code to Suppliers
-- Using a BIGSERIAL to ensure it's automatic and unique.

ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "codigo" SERIAL UNIQUE;

-- Explicitly granting permissions for the new column if needed (though usually covered by table grants)
GRANT SELECT (codigo) ON "Supplier" TO authenticated;

-- Notify schema change
NOTIFY pgrst, 'reload schema';
