-- Migração para adicionar campo de peso (weight) na tabela cattle
-- O peso será usado para calcular o valor baseado em @ (arroba)
-- 1 @ = 15 kg = R$ 310,00

-- Adicionar coluna weight (peso em kg)
ALTER TABLE public.cattle 
ADD COLUMN IF NOT EXISTS weight DECIMAL(10, 2);

-- Adicionar comentário na coluna para documentação
COMMENT ON COLUMN public.cattle.weight IS 'Peso do gado em quilogramas (kg). Usado para cálculo de valor por @ (arroba). 1 @ = 15 kg = R$ 310,00';

