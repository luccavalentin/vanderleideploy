## Instruções para Adicionar Campo "Contrato" em Processos

Este guia detalha como adicionar o campo "Contrato" na tabela `legal_processes` do banco de dados.

### Passo 1: Executar a Migration SQL no Supabase

A migration SQL foi criada para adicionar o campo `contract` na tabela `legal_processes`.

1. **Acesse seu projeto Supabase:**
   - Vá para o painel do seu projeto Supabase.
   - Navegue até a seção "SQL Editor".

2. **Abra um novo query:**
   - Clique em "New query" ou abra um editor de SQL.

3. **Copie e cole o conteúdo da migration:**
   - Abra o arquivo `supabase/migrations/20250120000015_add_contract_to_legal_processes.sql` no seu ambiente de desenvolvimento.
   - Copie todo o conteúdo deste arquivo.
   - Cole o conteúdo no editor de SQL do Supabase.

4. **Execute a query:**
   - Clique no botão "Run" (ou similar) para executar a migration.
   - Confirme a execução se for solicitado.

**Conteúdo da Migration (`20250120000015_add_contract_to_legal_processes.sql`):**

```sql
-- Arquivo: supabase/migrations/20250120000015_add_contract_to_legal_processes.sql
-- Adiciona campo contract (Contrato) na tabela legal_processes

-- Adicionar coluna contract na tabela legal_processes
ALTER TABLE public.legal_processes
ADD COLUMN IF NOT EXISTS contract TEXT;

-- Comentário na coluna para documentação
COMMENT ON COLUMN public.legal_processes.contract IS 'Número ou identificador do contrato relacionado ao processo jurídico';
```

### O que foi implementado:

1. **Campo "Contrato" adicionado:**
   - Campo de texto para número ou identificador do contrato
   - Integrado no formulário de criação/edição de processos
   - Aplicação automática de padronização de texto

2. **Formulário reorganizado:**
   - Campos organizados na ordem solicitada:
     1. Cliente
     2. Contrato
     3. Número do Processo
     4. Sentença
     5. Valor Estimado
     6. Previsão de Pagamento
     7. Status do Processo
     8. Descrição do Processo
   - Layout responsivo com grid adaptativo
   - Melhorias visuais e espaçamento

3. **Melhorias de estética:**
   - Dialog maior e mais espaçado (`max-w-4xl`)
   - Grid responsivo (1 coluna mobile, 2 colunas tablet, 3 colunas desktop)
   - Labels com fonte semibold
   - Melhor organização visual dos campos
   - Seção de parcelamento destacada com fundo diferenciado

### Verificação

Após a execução, você pode verificar:

1. **No Supabase:**
   - Vá para a seção "Table Editor".
   - Selecione a tabela `legal_processes`.
   - Verifique se a coluna `contract` foi adicionada.

2. **No Frontend:**
   - Navegue para a página de "Processos".
   - Clique em "Novo Processo".
   - Verifique se o campo "Contrato" aparece no formulário.

### Arquivos Modificados

- `supabase/migrations/20250120000015_add_contract_to_legal_processes.sql` - Migration SQL para adicionar o campo
- `src/pages/Processos.tsx` - Formulário atualizado com campo "Contrato" e melhorias de estética

