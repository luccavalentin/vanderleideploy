-- Migração para otimizar performance da tabela revenue
-- Adiciona coluna installments se não existir e cria índices

-- 1. Adicionar coluna installments se não existir
ALTER TABLE public.revenue 
ADD COLUMN IF NOT EXISTS installments INTEGER;

-- 2. Criar índice na coluna date para melhorar performance de ordenação e filtros
CREATE INDEX IF NOT EXISTS idx_revenue_date ON public.revenue(date);

-- 3. Criar índice na coluna category para melhorar performance de agrupamento
CREATE INDEX IF NOT EXISTS idx_revenue_category ON public.revenue(category) WHERE category IS NOT NULL;

-- 4. Criar índice na coluna frequency para melhorar performance de filtros
CREATE INDEX IF NOT EXISTS idx_revenue_frequency ON public.revenue(frequency) WHERE frequency IS NOT NULL;

-- 5. Criar índice composto para queries comuns (date + category)
CREATE INDEX IF NOT EXISTS idx_revenue_date_category ON public.revenue(date, category) WHERE category IS NOT NULL;

