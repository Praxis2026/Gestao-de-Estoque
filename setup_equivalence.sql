-- SQL Script for Product Equivalence
-- 1. Create a table for Equivalence Groups
CREATE TABLE IF NOT EXISTS "EquivalenceGroup" (
  "id" SERIAL PRIMARY KEY,
  "nome" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add equivalence_group_id to Material table
ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "equivalence_group_id" INTEGER REFERENCES "EquivalenceGroup"(id) ON DELETE SET NULL;

-- 3. Update v_materiais_detalhes view to include equivalence information
DROP VIEW IF EXISTS "v_materiais_detalhes";
CREATE OR REPLACE VIEW "v_materiais_detalhes" AS
SELECT 
  m.*,
  c.nome as categoria_nome,
  u.sigla as unidade_sigla,
  u.nome as unidade_nome,
  s.nome as fornecedor_nome,
  eg.nome as equivalence_group_name,
  (SELECT string_agg(COALESCE(referencia, 'S/R'), ', ') FROM "Material" m2 WHERE m2.equivalence_group_id = m.equivalence_group_id AND m2.id <> m.id) as equivalence_refs,
  (SELECT sum(estoque_atual) FROM "Material" m3 WHERE m3.equivalence_group_id = m.equivalence_group_id) as group_total_stock
FROM "Material" m
LEFT JOIN "Category" c ON m."categoriaId" = c.id
LEFT JOIN "UnitOfMeasure" u ON m."unidadeMedidaId" = u.id
LEFT JOIN "Supplier" s ON m."fornecedorId" = s.id
LEFT JOIN "EquivalenceGroup" eg ON m."equivalence_group_id" = eg.id;

-- 4. Set RLS and Permissions
ALTER TABLE "EquivalenceGroup" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for authenticated" ON "EquivalenceGroup";
CREATE POLICY "Allow all for authenticated" ON "EquivalenceGroup" FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON "EquivalenceGroup" TO authenticated;
GRANT SELECT ON "v_materiais_detalhes" TO authenticated;

-- Reload schema
NOTIFY pgrst, 'reload schema';
