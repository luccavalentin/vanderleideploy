-- Tabela para Ideias de Redução de Custo
CREATE TABLE IF NOT EXISTS cost_reduction_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- Ex: Fornecedores, Processos, Tecnologia, Pessoal, etc.
  estimated_savings DECIMAL(10, 2), -- Economia estimada em R$
  implementation_effort TEXT, -- baixa, media, alta
  priority TEXT DEFAULT 'media', -- baixa, media, alta
  status TEXT DEFAULT 'pendente', -- pendente, em_analise, aprovada, em_implementacao, implementada, descartada
  implementation_date DATE,
  actual_savings DECIMAL(10, 2), -- Economia real após implementação
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para Ideias de Otimização de Receita
CREATE TABLE IF NOT EXISTS revenue_optimization_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- Ex: Novos Produtos, Upsell, Parcerias, Marketing, etc.
  estimated_revenue DECIMAL(10, 2), -- Receita adicional estimada em R$
  implementation_effort TEXT, -- baixa, media, alta
  priority TEXT DEFAULT 'media', -- baixa, media, alta
  status TEXT DEFAULT 'pendente', -- pendente, em_analise, aprovada, em_implementacao, implementada, descartada
  implementation_date DATE,
  actual_revenue DECIMAL(10, 2), -- Receita real após implementação
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para Planejamentos/Ações
CREATE TABLE IF NOT EXISTS business_growth_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL, -- 'cost_reduction' ou 'revenue_optimization'
  related_idea_id UUID, -- ID da ideia relacionada (pode ser NULL se for plano independente)
  target_value DECIMAL(10, 2), -- Meta de economia ou receita
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'planejamento', -- planejamento, em_andamento, concluido, pausado, cancelado
  progress_percentage INTEGER DEFAULT 0, -- 0 a 100
  responsible_person TEXT,
  milestones JSONB, -- Array de marcos/etapas
  resources_needed TEXT,
  risks TEXT,
  success_metrics TEXT,
  actual_value DECIMAL(10, 2), -- Valor real alcançado
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_cost_reduction_ideas_status ON cost_reduction_ideas(status);
CREATE INDEX IF NOT EXISTS idx_cost_reduction_ideas_priority ON cost_reduction_ideas(priority);
CREATE INDEX IF NOT EXISTS idx_revenue_optimization_ideas_status ON revenue_optimization_ideas(status);
CREATE INDEX IF NOT EXISTS idx_revenue_optimization_ideas_priority ON revenue_optimization_ideas(priority);
CREATE INDEX IF NOT EXISTS idx_business_growth_plans_type ON business_growth_plans(type);
CREATE INDEX IF NOT EXISTS idx_business_growth_plans_status ON business_growth_plans(status);
CREATE INDEX IF NOT EXISTS idx_business_growth_plans_related_idea ON business_growth_plans(related_idea_id);

-- Funções para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_cost_reduction_ideas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_revenue_optimization_ideas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_business_growth_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS trigger_update_cost_reduction_ideas_updated_at ON cost_reduction_ideas;
CREATE TRIGGER trigger_update_cost_reduction_ideas_updated_at
  BEFORE UPDATE ON cost_reduction_ideas
  FOR EACH ROW
  EXECUTE FUNCTION update_cost_reduction_ideas_updated_at();

DROP TRIGGER IF EXISTS trigger_update_revenue_optimization_ideas_updated_at ON revenue_optimization_ideas;
CREATE TRIGGER trigger_update_revenue_optimization_ideas_updated_at
  BEFORE UPDATE ON revenue_optimization_ideas
  FOR EACH ROW
  EXECUTE FUNCTION update_revenue_optimization_ideas_updated_at();

DROP TRIGGER IF EXISTS trigger_update_business_growth_plans_updated_at ON business_growth_plans;
CREATE TRIGGER trigger_update_business_growth_plans_updated_at
  BEFORE UPDATE ON business_growth_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_business_growth_plans_updated_at();

-- Habilitar RLS
ALTER TABLE cost_reduction_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_optimization_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_growth_plans ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can manage cost reduction ideas"
  ON cost_reduction_ideas
  FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage revenue optimization ideas"
  ON revenue_optimization_ideas
  FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage business growth plans"
  ON business_growth_plans
  FOR ALL
  USING (auth.role() = 'authenticated');

