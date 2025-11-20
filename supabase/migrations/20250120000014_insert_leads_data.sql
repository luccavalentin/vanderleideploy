-- Arquivo: supabase/migrations/20250120000014_insert_leads_data.sql
-- Migration para cadastrar os leads da tabela visualizada
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

-- Inserir leads apenas se não existirem (verificação por nome case-insensitive)
-- Aplicar capitalização: primeira letra maiúscula, demais minúsculas
INSERT INTO public.leads (name, status, notes)
SELECT 
  capitalize_first_letter(v.name) as name,
  v.status,
  v.notes
FROM (VALUES
  ('VIA CAMPOS', 'Inicial', NULL),
  ('INTERCAMBIO', 'Inicial', NULL),
  ('SILVIO FELIX', 'Inicial', NULL),
  ('IND. DU FRASSON', 'Inicial', NULL),
  ('EDUARDO - ALFA', 'Inicial', NULL),
  ('ACORDO CORONEL', 'Inicial', NULL),
  ('EMPRESA SUL', 'Inicial', NULL),
  ('DANIEL BERTANHA', 'Inicial', NULL),
  ('MOVEIS CASSIMIRO', 'Inicial', NULL),
  ('CONTRATOS BANCOS', 'Inicial', NULL),
  ('BIDS, LEILÕES ESC.', 'Inicial', NULL),
  ('LICITAÇÕES', 'Inicial', NULL),
  ('MAQTIVA', 'Inicial', NULL),
  ('VENDA TERRENO PITA', 'Inicial', NULL),
  ('EMPRESA DE AMERICANA', 'Inicial', NULL),
  ('INGRED', 'Inicial', NULL),
  ('Intercambio', 'Inicial', NULL),
  ('contratos pj intercambio', 'Inicial', NULL)
) AS v(name, status, notes)
WHERE NOT EXISTS (
  SELECT 1 FROM public.leads 
  WHERE LOWER(TRIM(leads.name)) = LOWER(TRIM(capitalize_first_letter(v.name)))
);

-- Criar tarefas vinculadas para os leads que têm informações de tarefa
-- Para INGRED: "manaca, bancos, processos antigos, poupança"
DO $$
DECLARE
  lead_ingred_id UUID;
  lead_intercambio_id UUID;
BEGIN
  -- Buscar ID do lead INGRED (case-insensitive, usando capitalização padrão)
  SELECT id INTO lead_ingred_id FROM public.leads 
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(capitalize_first_letter('INGRED'))) 
  LIMIT 1;
  
  -- Criar tarefa para INGRED se o lead existir e a tarefa ainda não existir
  IF lead_ingred_id IS NOT NULL THEN
    INSERT INTO public.reminders (title, description, status, priority, lead_id, completed, due_date)
    SELECT 
      capitalize_first_letter('Tarefas INGRED'),
      'manaca, bancos, processos antigos, poupança',
      'pendente',
      'media',
      lead_ingred_id,
      false,
      CURRENT_DATE + INTERVAL '30 days' -- Data de vencimento padrão: 30 dias a partir de hoje
    WHERE NOT EXISTS (
      SELECT 1 FROM public.reminders 
      WHERE lead_id = lead_ingred_id 
      AND LOWER(TRIM(title)) = LOWER(TRIM(capitalize_first_letter('Tarefas INGRED')))
    );
  END IF;

  -- Buscar ID do lead Intercambio (case-insensitive, usando capitalização padrão)
  SELECT id INTO lead_intercambio_id FROM public.leads 
  WHERE LOWER(TRIM(name)) = LOWER(TRIM(capitalize_first_letter('Intercambio'))) 
  LIMIT 1;
  
  -- Criar tarefa para Intercambio se o lead existir e a tarefa ainda não existir
  IF lead_intercambio_id IS NOT NULL THEN
    INSERT INTO public.reminders (title, description, status, priority, lead_id, completed, due_date)
    SELECT 
      capitalize_first_letter('Ações de Cobrança'),
      '2 ações de cobrança',
      'pendente',
      'media',
      lead_intercambio_id,
      false,
      CURRENT_DATE + INTERVAL '30 days' -- Data de vencimento padrão: 30 dias a partir de hoje
    WHERE NOT EXISTS (
      SELECT 1 FROM public.reminders 
      WHERE lead_id = lead_intercambio_id 
      AND LOWER(TRIM(title)) = LOWER(TRIM(capitalize_first_letter('Ações de Cobrança')))
    );
  END IF;
END $$;

-- Comentário final
DO $$
BEGIN
  RAISE NOTICE 'Leads cadastrados com sucesso!';
  RAISE NOTICE 'Tarefas vinculadas criadas para INGRED e Intercambio.';
END $$;

