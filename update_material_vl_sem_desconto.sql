-- SQL Script to add vl_sem_desconto column to Material table
ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "vl_sem_desconto" NUMERIC DEFAULT 0;

-- Recreate the view v_materiais_detalhes to include the new column
-- (Assuming the standard structure based on earlier implementation)
DROP VIEW IF EXISTS "v_materiais_detalhes";
CREATE OR REPLACE VIEW "v_materiais_detalhes" AS
SELECT 
  m.*,
  c.nome as categoria_nome,
  u.sigla as unidade_sigla,
  u.nome as unidade_nome,
  s.nome as fornecedor_nome
FROM "Material" m
LEFT JOIN "Category" c ON m."categoriaId" = c.id
LEFT JOIN "UnitOfMeasure" u ON m."unidadeMedidaId" = u.id
LEFT JOIN "Supplier" s ON m."fornecedorId" = s.id;

-- Ensure permissions
GRANT SELECT ON "v_materiais_detalhes" TO authenticated;

-- Reload schema
NOTIFY pgrst, 'reload schema';
