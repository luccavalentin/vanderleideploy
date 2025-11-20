-- Migração para adicionar campo de descrição (description) na tabela cattle

-- Adicionar coluna description
ALTER TABLE public.cattle 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Adicionar comentário na coluna para documentação
COMMENT ON COLUMN public.cattle.description IS 'Descrição do lote de gado';

