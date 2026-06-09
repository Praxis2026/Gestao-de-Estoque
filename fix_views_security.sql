-- Script para recriar as views com 'security_invoker = true'
-- Isso garante que as views respeitem o RLS das tabelas base e não sejam acessíveis anonimamente
-- se as tabelas base estiverem protegidas.
-- NOTA: Usamos 'CASCADE' para garantir que dependências não bloqueiem a atualização.

-- 1. v_alerta_reposicao
DROP VIEW IF EXISTS "v_alerta_reposicao" CASCADE;
CREATE OR REPLACE VIEW "v_alerta_reposicao" 
WITH (security_invoker = true) AS
SELECT * FROM "Material" WHERE estoque_atual <= estoque_minimo;

-- 2. v_estoque_detalhado
DROP VIEW IF EXISTS "v_estoque_detalhado" CASCADE;
CREATE OR REPLACE VIEW "v_estoque_detalhado" 
WITH (security_invoker = true) AS
SELECT 
    m.*, 
    c.nome as categoria_nome, 
    u.sigla as unidade_sigla, 
    s.nome as fornecedor_nome
FROM "Material" m
LEFT JOIN "Category" c ON m."categoriaId" = c.id
LEFT JOIN "UnitOfMeasure" u ON m."unidadeMedidaId" = u.id
LEFT JOIN "Supplier" s ON m."fornecedorId" = s.id;

-- 3. v_financeiro_por_categoria
DROP VIEW IF EXISTS "v_financeiro_por_categoria" CASCADE;
CREATE OR REPLACE VIEW "v_financeiro_por_categoria" 
WITH (security_invoker = true) AS
SELECT 
    c.nome as categoria_nome,
    SUM(m.estoque_atual * m.valor_unitario) as valor_total_estoque,
    COUNT(m.id) as total_itens
FROM "Category" c
JOIN "Material" m ON m."categoriaId" = c.id
GROUP BY c.nome;

-- 4. v_movimentacoes_detalhadas (Solicitada pelo usuário)
DROP VIEW IF EXISTS "v_movimentacoes_detalhadas" CASCADE;
CREATE OR REPLACE VIEW "v_movimentacoes_detalhadas" 
WITH (security_invoker = true) AS
SELECT 
    mov.*,
    mat.nome as material_nome,
    mat.referencia as material_referencia,
    u.sigla as unidade_sigla
FROM "Movimentacao" mov
JOIN "Material" mat ON mov.material_id = mat.id
LEFT JOIN "UnitOfMeasure" u ON mat."unidadeMedidaId" = u.id;

-- 4.1 v_movimentacoes_detalhes (Usada no código do aplicativo)
DROP VIEW IF EXISTS "v_movimentacoes_detalhes" CASCADE;
CREATE OR REPLACE VIEW "v_movimentacoes_detalhes" 
WITH (security_invoker = true) AS
SELECT 
    mov.*,
    mat.nome as material_nome,
    mat.referencia as material_referencia,
    u.sigla as unidade_sigla,
    CASE 
      WHEN mov.tipo = 'ENTRADA' THEN 'Entrada - ' || mov.tipo_entrada
      ELSE 'Saída - ' || mov.tipo_entrada
    END as tipo_formatado,
    mov.paciente_ou_curso as destino_origem
FROM "Movimentacao" mov
JOIN "Material" mat ON mov.material_id = mat.id
LEFT JOIN "UnitOfMeasure" u ON mat."unidadeMedidaId" = u.id;


-- 5. v_materiais_detalhes (Já existente, mas garantindo segurança)
DROP VIEW IF EXISTS "v_materiais_detalhes" CASCADE;
CREATE OR REPLACE VIEW "v_materiais_detalhes" 
WITH (security_invoker = true) AS
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

-- Revogar acesso público e garantir apenas para usuários autenticados
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- Recarregar o cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- 6. v_estoque_critico
DROP VIEW IF EXISTS "v_estoque_critico" CASCADE;
CREATE OR REPLACE VIEW "v_estoque_critico" 
WITH (security_invoker = true) AS
SELECT * FROM "Material" WHERE estoque_atual <= estoque_minimo;

