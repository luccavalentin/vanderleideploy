-- Arquivo: supabase/migrations/20250120000011_delete_all_clients_data.sql
-- ATENÇÃO: Esta migration remove TODOS os dados de clientes e suas referências
-- Execute apenas se tiver certeza que deseja limpar completamente os dados de clientes

-- 1. Remover referências de client_id em todas as tabelas relacionadas
-- Definir client_id como NULL nas receitas
UPDATE public.revenue 
SET client_id = NULL 
WHERE client_id IS NOT NULL;

-- Definir client_id como NULL nas despesas
UPDATE public.expenses 
SET client_id = NULL 
WHERE client_id IS NOT NULL;

-- Deletar processos legais relacionados a clientes
DELETE FROM public.legal_processes 
WHERE client_id IS NOT NULL;

-- Deletar empréstimos relacionados a clientes
DELETE FROM public.loans 
WHERE client_id IS NOT NULL;

-- 2. Deletar TODOS os clientes cadastrados
DELETE FROM public.clients;

-- 3. Resetar a sequência (se houver alguma)
-- Nota: UUID não usa sequências, mas deixamos aqui caso mude no futuro

-- 4. Verificar se há outras tabelas que referenciam clients
-- Se houver leads ou outras tabelas com client_id, adicione aqui:
-- UPDATE public.leads SET client_id = NULL WHERE client_id IS NOT NULL;

-- Comentário final
DO $$
BEGIN
  RAISE NOTICE 'Todos os dados de clientes foram removidos com sucesso!';
  RAISE NOTICE 'Referências em revenue e expenses foram definidas como NULL';
  RAISE NOTICE 'Processos legais e empréstimos relacionados foram deletados';
END $$;

