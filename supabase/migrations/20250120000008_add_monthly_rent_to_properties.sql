-- Adicionar coluna monthly_rent (Valor da Locação Mensal) na tabela properties
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS monthly_rent DECIMAL(15, 2);

-- Comentário na coluna para documentação
COMMENT ON COLUMN public.properties.monthly_rent IS 'Valor mensal do aluguel do imóvel. Usado para calcular a renda mensal total de imóveis para locação.';

