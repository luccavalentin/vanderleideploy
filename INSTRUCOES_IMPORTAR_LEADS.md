## Instruções para Cadastrar Leads em Massa

Este guia detalha como cadastrar os leads da tabela visualizada no sistema, tanto via banco de dados (SQL) quanto via frontend.

### Opção 1: Via Banco de Dados (Recomendado)

Execute a migration SQL no Supabase para cadastrar todos os leads de uma vez:

1. **Acesse seu projeto Supabase:**
   - Vá para o painel do seu projeto Supabase.
   - Navegue até a seção "SQL Editor".

2. **Abra um novo query:**
   - Clique em "New query" ou abra um editor de SQL.

3. **Copie e cole o conteúdo da migration:**
   - Abra o arquivo `supabase/migrations/20250120000014_insert_leads_data.sql` no seu ambiente de desenvolvimento.
   - Copie todo o conteúdo deste arquivo.
   - Cole o conteúdo no editor de SQL do Supabase.

4. **Execute a query:**
   - Clique no botão "Run" (ou similar) para executar a migration.
   - Confirme a execução se for solicitado.

**O que a migration faz:**
- Insere 18 leads na tabela `leads` com status "Inicial"
- Cria tarefas vinculadas para os leads "INGRED" e "Intercambio" com as informações da coluna "Tarefa"

### Opção 2: Via Frontend

1. **Acesse a página de Leads:**
   - Navegue até a página "Leads" no sistema.

2. **Clique no botão "Importar Dados":**
   - O botão está localizado na barra de filtros, ao lado dos botões de exportação.
   - Clique em "Importar Dados" (ou "Importar" no mobile).

3. **Aguarde a importação:**
   - O sistema irá cadastrar todos os 18 leads automaticamente.
   - As tarefas vinculadas para "INGRED" e "Intercambio" serão criadas automaticamente.
   - Uma mensagem de sucesso será exibida ao final.

**Leads que serão cadastrados:**
1. VIA CAMPOS
2. INTERCAMBIO
3. SILVIO FELIX
4. IND. DU FRASSON
5. EDUARDO - ALFA
6. ACORDO CORONEL
7. EMPRESA SUL
8. DANIEL BERTANHA
9. MOVEIS CASSIMIRO
10. CONTRATOS BANCOS
11. BIDS, LEILÕES ESC.
12. LICITAÇÕES
13. MAQTIVA
14. VENDA TERRENO PITA
15. EMPRESA DE AMERICANA
16. INGRED (com tarefa: "manaca, bancos, processos antigos, poupança")
17. Intercambio (com tarefa: "2 ações de cobrança")
18. contratos pj intercambio

**Nota:** Se algum lead já existir no banco de dados, ele será ignorado (não será duplicado).

### Verificação

Após a importação, você pode verificar:

1. **No Supabase:**
   - Vá para a seção "Table Editor".
   - Selecione a tabela `leads`. Você deve ver os 18 leads cadastrados.
   - Selecione a tabela `reminders` e filtre por `lead_id` para ver as tarefas vinculadas.

2. **No Frontend:**
   - Navegue para a página de "Leads". Você deve ver todos os leads cadastrados.
   - Clique em "Editar" em um lead que tenha tarefas (INGRED ou Intercambio) para ver as tarefas vinculadas.

### Arquivos Criados

- `supabase/migrations/20250120000014_insert_leads_data.sql` - Migration SQL para cadastrar os leads
- Funcionalidade de importação adicionada em `src/pages/Leads.tsx`

