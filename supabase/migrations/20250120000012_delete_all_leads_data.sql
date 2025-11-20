-- Arquivo: supabase/migrations/20250120000012_delete_all_leads_data.sql
-- ATENÇÃO: Esta migration remove TODOS os dados de leads
-- Execute apenas se tiver certeza que deseja limpar completamente os dados de leads

-- 1. Verificar se há outras tabelas que referenciam leads
-- (Atualmente, não há foreign keys apontando para a tabela leads)

-- 2. Deletar TODOS os leads cadastrados
DELETE FROM public.leads;

-- 3. Comentário final
DO $$
BEGIN
  RAISE NOTICE 'Todos os dados de leads foram removidos com sucesso!';
  RAISE NOTICE 'A tabela leads está agora vazia e pronta para novos registros.';
END $$;

