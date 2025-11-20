-- Arquivo: supabase/migrations/20250120000017_add_legal_process_id_to_reminders.sql
-- Adiciona campo legal_process_id na tabela reminders (tarefas) para vincular tarefas a processos

-- Adicionar coluna legal_process_id na tabela reminders
ALTER TABLE public.reminders
ADD COLUMN IF NOT EXISTS legal_process_id UUID REFERENCES public.legal_processes(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_reminders_legal_process_id ON public.reminders(legal_process_id);

-- Comentário na coluna para documentação
COMMENT ON COLUMN public.reminders.legal_process_id IS 'Referência ao processo jurídico associado a esta tarefa. Permite vincular tarefas a processos específicos.';

