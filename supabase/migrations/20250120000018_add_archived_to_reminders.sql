-- Arquivo: supabase/migrations/20250120000018_add_archived_to_reminders.sql
-- Adiciona campos archived e archived_at na tabela reminders para arquivamento automático de tarefas concluídas

-- Adicionar coluna archived (boolean) na tabela reminders
ALTER TABLE public.reminders
ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- Adicionar coluna archived_at (timestamp) na tabela reminders
ALTER TABLE public.reminders
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para melhorar performance de consultas de tarefas não arquivadas
CREATE INDEX IF NOT EXISTS idx_reminders_archived ON public.reminders(archived) WHERE archived = false;

-- Comentários nas colunas para documentação
COMMENT ON COLUMN public.reminders.archived IS 'Indica se a tarefa foi arquivada (automaticamente quando concluída)';
COMMENT ON COLUMN public.reminders.archived_at IS 'Data e hora em que a tarefa foi arquivada';

-- Trigger para arquivar automaticamente quando uma tarefa for marcada como concluída
CREATE OR REPLACE FUNCTION archive_completed_task()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a tarefa foi marcada como concluída e ainda não está arquivada
  IF NEW.completed = true AND (OLD.completed = false OR OLD.completed IS NULL) AND (NEW.archived = false OR NEW.archived IS NULL) THEN
    NEW.archived := true;
    NEW.archived_at := now();
  END IF;
  
  -- Se a tarefa foi desmarcada como concluída, desarquivar
  IF NEW.completed = false AND OLD.completed = true AND NEW.archived = true THEN
    NEW.archived := false;
    NEW.archived_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger antes de atualizar
DROP TRIGGER IF EXISTS trigger_archive_completed_task ON public.reminders;
CREATE TRIGGER trigger_archive_completed_task
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW
  EXECUTE FUNCTION archive_completed_task();

-- Trigger para arquivar na inserção se já vier como concluída
CREATE OR REPLACE FUNCTION archive_completed_task_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a tarefa foi criada já como concluída, arquivar automaticamente
  IF NEW.completed = true AND (NEW.archived = false OR NEW.archived IS NULL) THEN
    NEW.archived := true;
    NEW.archived_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger antes de inserir
DROP TRIGGER IF EXISTS trigger_archive_completed_task_on_insert ON public.reminders;
CREATE TRIGGER trigger_archive_completed_task_on_insert
  BEFORE INSERT ON public.reminders
  FOR EACH ROW
  EXECUTE FUNCTION archive_completed_task_on_insert();

