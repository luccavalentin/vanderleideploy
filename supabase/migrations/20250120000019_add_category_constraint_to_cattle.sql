-- Arquivo: supabase/migrations/20250120000019_add_category_constraint_to_cattle.sql
-- Adiciona constraint CHECK na coluna category da tabela cattle para padronizar valores

-- Primeiro, vamos normalizar os valores existentes para "Fêmea" ou "Macho"
UPDATE public.cattle
SET category = CASE
  WHEN UPPER(TRIM(category)) IN ('FÊMEA', 'FEMEA', 'BEZERRA', 'NOVILHA') THEN 'Fêmea'
  WHEN UPPER(TRIM(category)) IN ('MACHO', 'BEZERRO', 'NOVILHO') THEN 'Macho'
  ELSE category
END
WHERE category IS NOT NULL;

-- Remover constraint antiga se existir (caso tenha sido criada anteriormente)
ALTER TABLE public.cattle
DROP CONSTRAINT IF EXISTS cattle_category_check;

-- Adicionar constraint CHECK para aceitar apenas "Fêmea" ou "Macho"
-- Nota: A constraint permite NULL também, caso o campo seja opcional
ALTER TABLE public.cattle
ADD CONSTRAINT cattle_category_check 
CHECK (category IS NULL OR category IN ('Fêmea', 'Macho'));

-- Criar índice para melhorar performance de consultas por categoria
CREATE INDEX IF NOT EXISTS idx_cattle_category ON public.cattle(category);

-- Comentário na coluna para documentação
COMMENT ON COLUMN public.cattle.category IS 'Categoria do gado: "Fêmea" ou "Macho". Valores são normalizados automaticamente no frontend.';

