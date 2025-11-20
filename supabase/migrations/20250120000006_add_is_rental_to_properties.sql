-- Adicionar coluna is_rental (Imóvel de Locação) na tabela properties
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS is_rental BOOLEAN DEFAULT false;

-- Comentário na coluna para documentação
COMMENT ON COLUMN public.properties.is_rental IS 'Indica se o imóvel é destinado para locação (true) ou não (false)';

