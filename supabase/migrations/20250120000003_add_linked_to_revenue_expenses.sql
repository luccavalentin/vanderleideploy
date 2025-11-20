-- Migração para adicionar campo linked_to nas tabelas revenue e expenses
-- Este campo indica de qual tela/origem a receita/despesa foi cadastrada

-- Adicionar coluna linked_to na tabela revenue
ALTER TABLE public.revenue 
ADD COLUMN IF NOT EXISTS linked_to TEXT;

COMMENT ON COLUMN public.revenue.linked_to IS 'Indica a origem/tela de onde a receita foi cadastrada (ex: Escritório, Gado, etc.)';

-- Adicionar coluna linked_to na tabela expenses
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS linked_to TEXT;

COMMENT ON COLUMN public.expenses.linked_to IS 'Indica a origem/tela de onde a despesa foi cadastrada (ex: Escritório, Gado, etc.)';

