-- Arquivo: supabase/migrations/20250120000013_add_lead_id_to_reminders.sql
-- Adiciona campo lead_id na tabela reminders (tarefas) para vincular tarefas a leads

-- Adicionar coluna lead_id na tabela reminders
ALTER TABLE public.reminders
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_reminders_lead_id ON public.reminders(lead_id);

-- Comentário na coluna para documentação
COMMENT ON COLUMN public.reminders.lead_id IS 'Referência ao lead associado a esta tarefa. Permite vincular tarefas a leads específicos.';

