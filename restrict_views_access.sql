-- 1. Revogar todas as permissões de leitura das views para o usuário anônimo
-- Substitua 'nome_da_sua_view' pelos nomes reais das suas views.
-- Se quiser fazer para todas as views de uma vez:
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;

-- 2. Garantir que apenas o usuário autenticado tenha acesso
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- NOTA: Se você tiver tabelas que DEVEM ser públicas (como uma tabela de posts_publicos),
-- você precisará garantir o acesso individual a elas após o comando acima:
-- GRANT SELECT ON TABLE posts_publicos TO anon;

-- IMPORTANTE PARA VIEWS:
-- Para que as Views respeitem o Row Level Security (RLS) das tabelas base, 
-- elas devem ser criadas com a opção 'security_invoker'.
-- Exemplo de como recriar uma view segura:
/*
CREATE OR REPLACE VIEW minha_view_segura 
WITH (security_invoker = true) AS
SELECT * FROM minha_tabela_base;
*/
