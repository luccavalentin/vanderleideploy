-- Criar tabela para itens de checklist das tarefas
CREATE TABLE IF NOT EXISTS task_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_task_checklist_items_reminder_id ON task_checklist_items(reminder_id);

-- Adicionar coluna use_checklist na tabela reminders se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'reminders' AND column_name = 'use_checklist'
  ) THEN
    ALTER TABLE reminders ADD COLUMN use_checklist BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_task_checklist_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar updated_at
DROP TRIGGER IF EXISTS trigger_update_task_checklist_items_updated_at ON task_checklist_items;
CREATE TRIGGER trigger_update_task_checklist_items_updated_at
  BEFORE UPDATE ON task_checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION update_task_checklist_items_updated_at();

-- Habilitar RLS (Row Level Security)
ALTER TABLE task_checklist_items ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir acesso autenticado
CREATE POLICY "Users can manage their own task checklist items"
  ON task_checklist_items
  FOR ALL
  USING (auth.role() = 'authenticated');

