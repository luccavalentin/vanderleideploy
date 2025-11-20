## Instruções para Cadastro de Processos e Funcionalidades

Este guia detalha como executar as migrations SQL necessárias e usar as novas funcionalidades implementadas.

### Passo 1: Executar as Migrations SQL no Supabase

Execute as seguintes migrations na ordem:

#### 1.1. Adicionar campo `contract` na tabela `legal_processes`

```sql
-- Arquivo: supabase/migrations/20250120000015_add_contract_to_legal_processes.sql
ALTER TABLE public.legal_processes
ADD COLUMN IF NOT EXISTS contract TEXT;

COMMENT ON COLUMN public.legal_processes.contract IS 'Número ou identificador do contrato relacionado ao processo jurídico';
```

#### 1.2. Adicionar campo `legal_process_id` na tabela `reminders` (para vincular tarefas a processos)

```sql
-- Arquivo: supabase/migrations/20250120000017_add_legal_process_id_to_reminders.sql
ALTER TABLE public.reminders
ADD COLUMN IF NOT EXISTS legal_process_id UUID REFERENCES public.legal_processes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reminders_legal_process_id ON public.reminders(legal_process_id);

COMMENT ON COLUMN public.reminders.legal_process_id IS 'Referência ao processo jurídico associado a esta tarefa. Permite vincular tarefas a processos específicos.';
```

#### 1.3. Importar processos em massa

```sql
-- Arquivo: supabase/migrations/20250120000016_insert_processes_data.sql
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
```

### Funcionalidades Implementadas

#### 1. **Campo "Contrato"**
- Adicionado ao formulário de processos
- Aplicação automática de capitalização (primeira letra maiúscula, demais minúsculas)
- Integrado na busca e filtros

#### 2. **Tarefas Vinculadas ao Processo**
- Botão "Nova Tarefa" no formulário de processos
- Lista de tarefas vinculadas com opções de editar e excluir
- Tarefas são salvas automaticamente ao salvar o processo
- Tarefas aparecem na página de Tarefas vinculadas ao processo

#### 3. **Busca de Cliente Melhorada**
- Campo de busca com sugestões
- Botão "Cadastrar Cliente" visível quando não há cliente selecionado
- Dialog rápido para cadastrar novo cliente sem sair do formulário

#### 4. **Importação em Massa**
- Botão "Importar Dados" na página de Processos
- Importa todos os processos das tabelas fornecidas
- Verifica duplicatas antes de inserir
- Aplica capitalização automática
- Mostra mensagem de sucesso com quantidade de processos importados

#### 5. **Formulário Reorganizado**
- Campos na ordem: Cliente, Contrato, Número do Processo, Sentença, Valor Estimado, Previsão de Pagamento, Status, Descrição
- Layout responsivo (1 coluna mobile, 2 tablet, 3 desktop)
- Seção de tarefas vinculadas
- Seção de parcelamento (quando há valor estimado)

### Como Usar

1. **Cadastrar Novo Processo:**
   - Clique em "Novo Processo"
   - Preencha os campos (Cliente, Contrato, etc.)
   - Adicione tarefas vinculadas se necessário (botão "Nova Tarefa")
   - Clique em "Cadastrar"

2. **Vincular Tarefa a Processo:**
   - Ao criar/editar um processo, clique em "Nova Tarefa"
   - Preencha os dados da tarefa
   - A tarefa será salva junto com o processo

3. **Importar Processos em Massa:**
   - Clique no botão "Importar Dados" na página de Processos
   - Aguarde a importação
   - Os processos serão cadastrados automaticamente

4. **Buscar/Cadastrar Cliente:**
   - No campo "Cliente", digite para buscar
   - Se não encontrar, clique em "Cadastrar Cliente"
   - Preencha os dados e salve
   - O cliente será vinculado automaticamente ao processo

### Observações

- Todas as migrations são idempotentes (podem ser executadas múltiplas vezes sem duplicar dados)
- A capitalização é aplicada automaticamente em todos os campos de texto
- As tarefas vinculadas são salvas apenas quando o processo é salvo
- A importação verifica duplicatas antes de inserir

