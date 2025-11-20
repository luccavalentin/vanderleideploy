-- Arquivo: supabase/migrations/20250120000015_add_contract_to_legal_processes.sql
-- Adiciona campo contract (Contrato) na tabela legal_processes

-- Adicionar coluna contract na tabela legal_processes
ALTER TABLE public.legal_processes
ADD COLUMN IF NOT EXISTS contract TEXT;

-- Comentário na coluna para documentação
COMMENT ON COLUMN public.legal_processes.contract IS 'Número ou identificador do contrato relacionado ao processo jurídico';

