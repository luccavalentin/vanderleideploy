-- Arquivo: supabase/migrations/20250120000010_create_saved_reports_table.sql

-- Criar tabela para armazenar relatórios gerados
CREATE TABLE IF NOT EXISTS public.saved_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('completo', 'financeiro', 'personalizado')),
  period_filter TEXT,
  period_start DATE,
  period_end DATE,
  selected_modules JSONB,
  view_filters JSONB,
  report_data JSONB NOT NULL, -- Dados completos do relatório (resumo, tabelas, gráficos)
  orientation TEXT CHECK (orientation IN ('portrait', 'landscape')) DEFAULT 'portrait',
  include_dashboard BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Comentários para documentação
COMMENT ON TABLE public.saved_reports IS 'Armazena relatórios gerados pelo sistema para visualização posterior';
COMMENT ON COLUMN public.saved_reports.report_data IS 'JSON contendo todos os dados do relatório (resumo executivo, dados das tabelas, gráficos, etc.)';
COMMENT ON COLUMN public.saved_reports.selected_modules IS 'JSON contendo quais módulos foram incluídos no relatório';
COMMENT ON COLUMN public.saved_reports.view_filters IS 'JSON contendo os filtros de visualização aplicados';

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_saved_reports_created_at ON public.saved_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_reports_report_type ON public.saved_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_saved_reports_created_by ON public.saved_reports(created_by);

-- Habilitar RLS
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;

-- Remover policies existentes se houver
DROP POLICY IF EXISTS "Users can view their own reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can create their own reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can update their own reports" ON public.saved_reports;
DROP POLICY IF EXISTS "Users can delete their own reports" ON public.saved_reports;

-- Policy: Usuários podem ver apenas seus próprios relatórios
CREATE POLICY "Users can view their own reports"
  ON public.saved_reports
  FOR SELECT
  USING (auth.uid() = created_by);

-- Policy: Usuários podem criar seus próprios relatórios
CREATE POLICY "Users can create their own reports"
  ON public.saved_reports
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Policy: Usuários podem atualizar seus próprios relatórios
CREATE POLICY "Users can update their own reports"
  ON public.saved_reports
  FOR UPDATE
  USING (auth.uid() = created_by);

-- Policy: Usuários podem deletar seus próprios relatórios
CREATE POLICY "Users can delete their own reports"
  ON public.saved_reports
  FOR DELETE
  USING (auth.uid() = created_by);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_saved_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS update_saved_reports_updated_at ON public.saved_reports;

CREATE TRIGGER update_saved_reports_updated_at
  BEFORE UPDATE ON public.saved_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_reports_updated_at();

