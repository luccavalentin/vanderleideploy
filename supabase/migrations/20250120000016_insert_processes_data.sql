-- Arquivo: supabase/migrations/20250120000016_insert_processes_data.sql
-- Migration para cadastrar os processos das tabelas visualizadas
-- Este script é idempotente: pode ser executado múltiplas vezes sem duplicar dados
-- Padrão de capitalização: primeira letra maiúscula, demais minúsculas

-- Função auxiliar para capitalizar: primeira letra maiúscula, resto minúsculo
CREATE OR REPLACE FUNCTION capitalize_first_letter(text_value TEXT)
RETURNS TEXT AS $$
BEGIN
  IF text_value IS NULL OR text_value = '' THEN
    RETURN text_value;
  END IF;
  RETURN UPPER(LEFT(TRIM(text_value), 1)) || LOWER(SUBSTRING(TRIM(text_value) FROM 2));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Inserir processos apenas se não existirem (verificação por contract case-insensitive)
INSERT INTO public.legal_processes (contract, process_number, description, status, has_sentence, estimated_value, payment_forecast)
SELECT 
  capitalize_first_letter(v.contract) as contract,
  NULL as process_number,
  capitalize_first_letter(v.contract) as description,
  'active' as status,
  v.has_sentence,
  v.estimated_value,
  CASE 
    WHEN v.payment_forecast IS NOT NULL AND v.payment_forecast != '' THEN 
      (v.payment_forecast || '-01')::DATE
    ELSE NULL
  END as payment_forecast
FROM (VALUES
  ('DIVERSOS E MENSALIDADES', false, NULL, NULL),
  ('AQUALAX - MAFRE', true, 4000.00, '2025-12'),
  ('EDERSON', true, 18354.00, '2025-12'),
  ('MULHER DO GENERAL', true, 3000.00, '2025-12'),
  ('DAMIANA', false, NULL, NULL),
  ('CAKE', false, NULL, NULL),
  ('MASTER', true, NULL, '2026-07'),
  ('OTM', false, NULL, '2026-07'),
  ('SUCUMB. RODOTEC', true, 7800.00, '2025-12'),
  ('LUZIA', false, NULL, '2026-07'),
  ('RENATA ZACHARIAS', false, NULL, '2026-07'),
  ('ARI INDIC. ANTONIO', false, NULL, '2026-07'),
  ('ALEXANDRE WENZEL', false, NULL, NULL),
  ('JUNINHO JAGUARIUNA', false, NULL, NULL),
  ('MIRO', true, NULL, NULL),
  ('BAÚ', false, NULL, '2025-12'),
  ('INTERCAMBIO', false, NULL, NULL),
  ('ROBERTO MANARA', true, NULL, '2026-07'),
  ('BACOCHINA 2 ações', false, NULL, '2026-07'),
  ('DELARIVA J T', false, 3000.00, '2025-12'),
  ('SCAMA', true, NULL, '2026-07'),
  ('MARCO BUCK', true, NULL, '2026-07'),
  ('SIMONETTI', true, NULL, '2026-07'),
  ('EMILIANA', true, NULL, NULL),
  ('GENIL', true, NULL, '2026-07'),
  ('ROSEILDO', false, 13500.00, '2025-12'),
  ('NAZARE', false, NULL, NULL),
  ('VANTAME/DIMAS', false, NULL, '2026-07'),
  ('POUPANÇAS', false, NULL, '2026-07'),
  ('CAPELA', true, NULL, '2026-07'),
  ('NARCISO NICOLA', false, NULL, '2026-07'),
  ('REINALDO FUND. CASA. RPV', true, NULL, '2028-12'),
  ('CUMP. SENTENÇA H.STEFANI', true, NULL, '2026-07'),
  ('RUTH LEUSA', true, NULL, NULL),
  ('EUNICE SICOB', true, NULL, NULL)
) AS v(contract, has_sentence, estimated_value, payment_forecast)
WHERE NOT EXISTS (
  SELECT 1 FROM public.legal_processes 
  WHERE LOWER(TRIM(legal_processes.contract)) = LOWER(TRIM(capitalize_first_letter(v.contract)))
    OR (legal_processes.contract IS NULL AND LOWER(TRIM(legal_processes.description)) = LOWER(TRIM(capitalize_first_letter(v.contract))))
);

-- Comentário final
DO $$
BEGIN
  RAISE NOTICE 'Processos cadastrados com sucesso!';
END $$;

