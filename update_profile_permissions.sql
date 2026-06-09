-- SQL Script to update existing profiles with the new 'usuarios' and 'configuracoes' permissions.
-- Run this in your Supabase SQL Editor.

UPDATE "Perfil"
SET permissions = permissions || '{
  "usuarios": {"visualizar": true, "criar": true, "editar": true, "excluir": true},
  "configuracoes": {"visualizar": true, "criar": true, "editar": true, "excluir": true}
}'::jsonb
WHERE NOT (permissions ? 'usuarios');

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
