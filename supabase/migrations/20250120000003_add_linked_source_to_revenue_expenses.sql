-- Migração para adicionar campo linked_source nas tabelas revenue e expenses
-- Este campo marca de qual tela/módulo a receita/despesa foi criada (Escritório, Gado, etc)

-- Adicionar coluna linked_source na tabela revenue
ALTER TABLE public.revenue 
ADD COLUMN IF NOT EXISTS linked_source TEXT;

COMMENT ON COLUMN public.revenue.linked_source IS 'Indica de qual módulo/tela a receita foi criada (ex: Escritório, Gado, Imóveis, etc). Usado para rastreabilidade e indicadores visuais.';

-- Adicionar coluna linked_source na tabela expenses
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS linked_source TEXT;

COMMENT ON COLUMN public.expenses.linked_source IS 'Indica de qual módulo/tela a despesa foi criada (ex: Escritório, Gado, Imóveis, etc). Usado para rastreabilidade e indicadores visuais.';



