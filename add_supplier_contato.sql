-- Adiciona o campo contato à tabela Supplier
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "contato" TEXT;
