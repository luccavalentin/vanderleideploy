# 🗑️ INSTRUÇÕES PARA LIMPEZA COMPLETA DE CLIENTES

## ⚠️ ATENÇÃO
Esta operação é **IRREVERSÍVEL**. Todos os dados de clientes serão permanentemente removidos.

---

## 📋 O QUE SERÁ REMOVIDO

### Backend (Banco de Dados):
1. ✅ **Tabela `clients`** - Todos os clientes cadastrados
2. ✅ **Referências em `revenue`** - `client_id` será definido como NULL
3. ✅ **Referências em `expenses`** - `client_id` será definido como NULL
4. ✅ **Tabela `legal_processes`** - Todos os processos relacionados a clientes serão DELETADOS
5. ✅ **Tabela `loans`** - Todos os empréstimos relacionados a clientes serão DELETADOS

### Frontend (Cache):
- Cache do React Query relacionado a clientes será limpo automaticamente ao recarregar a página

---

## 🚀 PASSO A PASSO

### 1. Executar Migration no Supabase

Execute o seguinte SQL no **Supabase SQL Editor**:

```sql
-- Arquivo: supabase/migrations/20250120000011_delete_all_clients_data.sql

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
```

### 2. Limpar Cache do Frontend

Após executar a migration, faça o seguinte:

1. **Recarregue a página** do sistema (F5 ou Ctrl+R)
2. **Ou limpe o cache do navegador**:
   - Chrome/Edge: `Ctrl + Shift + Delete` → Marque "Imagens e arquivos em cache" → Limpar dados
   - Ou abra o DevTools (F12) → Application → Storage → Clear site data

3. **Ou execute no Console do Navegador** (F12 → Console):
```javascript
// Limpar cache do React Query
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

## ✅ VERIFICAÇÃO

Após executar a migration, verifique se tudo foi limpo:

```sql
-- Verificar se não há mais clientes
SELECT COUNT(*) FROM public.clients;
-- Deve retornar: 0

-- Verificar se não há mais referências em revenue
SELECT COUNT(*) FROM public.revenue WHERE client_id IS NOT NULL;
-- Deve retornar: 0

-- Verificar se não há mais referências em expenses
SELECT COUNT(*) FROM public.expenses WHERE client_id IS NOT NULL;
-- Deve retornar: 0

-- Verificar se não há mais processos relacionados
SELECT COUNT(*) FROM public.legal_processes;
-- Deve retornar: 0

-- Verificar se não há mais empréstimos relacionados
SELECT COUNT(*) FROM public.loans;
-- Deve retornar: 0
```

---

## 📝 OBSERVAÇÕES IMPORTANTES

1. **Receitas e Despesas**: Os registros de receitas e despesas **NÃO serão deletados**, apenas a referência ao cliente será removida (client_id = NULL). Os valores e dados financeiros serão preservados.

2. **Processos Legais e Empréstimos**: Estes registros **SERÃO DELETADOS** completamente, pois dependem diretamente dos clientes.

3. **Cache do Frontend**: O cache será limpo automaticamente quando você recarregar a página. Não é necessário fazer nada adicional.

4. **Backup**: Se desejar fazer backup antes de deletar, execute:
```sql
-- Backup da tabela clients
CREATE TABLE clients_backup AS SELECT * FROM public.clients;
```

---

## 🔄 APÓS A LIMPEZA

Após executar a migration e limpar o cache:

1. ✅ A página de Clientes estará vazia
2. ✅ Receitas e Despesas não mostrarão mais clientes associados
3. ✅ Processos Legais e Empréstimos relacionados serão removidos
4. ✅ Você poderá começar a cadastrar clientes do zero

---

## ⚠️ AVISO FINAL

Esta operação é **PERMANENTE** e **IRREVERSÍVEL**. Certifique-se de que realmente deseja limpar todos os dados de clientes antes de executar.

