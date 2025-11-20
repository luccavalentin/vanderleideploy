-- Atualizar imóveis que possuem "INQUILINO" (TERCEIROS) para is_rental = true
-- Isso inclui imóveis onde water_ownership = 'TERCEIROS' ou energy_ownership = 'TERCEIROS'

UPDATE public.properties
SET is_rental = true,
    updated_at = now()
WHERE (water_ownership = 'TERCEIROS' OR energy_ownership = 'TERCEIROS')
  AND (is_rental IS NULL OR is_rental = false);

-- Comentário explicativo
COMMENT ON COLUMN public.properties.is_rental IS 'Indica se o imóvel é destinado para locação (true) ou não (false). Automaticamente definido como true quando water_ownership ou energy_ownership é TERCEIROS (INQUILINO).';

