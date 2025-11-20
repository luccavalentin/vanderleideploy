## Instruções para Limpeza Completa de Dados de Leads

Este guia detalha como remover completamente todos os dados de leads do seu sistema, tanto no backend (Supabase) quanto no frontend (cache do navegador).

**ATENÇÃO:** Esta operação é irreversível e removerá permanentemente todos os dados de leads. Certifique-se de ter um backup se necessário.

### Passo 1: Executar a Migration SQL no Supabase

A migration SQL foi criada para limpar os dados no seu banco de dados Supabase.

1.  **Acesse seu projeto Supabase:**
    *   Vá para o painel do seu projeto Supabase.
    *   Navegue até a seção "SQL Editor".

2.  **Abra um novo query:**
    *   Clique em "New query" ou abra um editor de SQL.

3.  **Copie e cole o conteúdo da migration:**
    *   Abra o arquivo `supabase/migrations/20250120000012_delete_all_leads_data.sql` no seu ambiente de desenvolvimento.
    *   Copie todo o conteúdo deste arquivo.
    *   Cole o conteúdo no editor de SQL do Supabase.

4.  **Execute a query:**
    *   Clique no botão "Run" (ou similar) para executar a migration.
    *   Confirme a execução se for solicitado.

**Conteúdo da Migration (`20250120000012_delete_all_leads_data.sql`):**

```sql
-- Arquivo: supabase/migrations/20250120000012_delete_all_leads_data.sql
-- ATENÇÃO: Esta migration remove TODOS os dados de leads
-- Execute apenas se tiver certeza que deseja limpar completamente os dados de leads

-- 1. Verificar se há outras tabelas que referenciam leads
-- (Atualmente, não há foreign keys apontando para a tabela leads)

-- 2. Deletar TODOS os leads cadastrados
DELETE FROM public.leads;

-- 3. Comentário final
DO $$
BEGIN
  RAISE NOTICE 'Todos os dados de leads foram removidos com sucesso!';
  RAISE NOTICE 'A tabela leads está agora vazia e pronta para novos registros.';
END $$;
```

### Passo 2: Limpar o Cache do Frontend

Para garantir que nenhum dado antigo de lead seja exibido no frontend, é crucial limpar o cache do navegador.

1.  **Recarregue a página:**
    *   Simplesmente recarregue a página do seu aplicativo (pressione `F5` ou o botão de recarregar no navegador). Na maioria dos casos, isso já invalida o cache.

2.  **Limpeza de cache mais profunda (se necessário):**
    *   Abra as ferramentas de desenvolvedor do seu navegador (geralmente `F12`).
    *   Vá para a aba "Application" (Aplicativo) ou "Storage" (Armazenamento).
    *   Procure por "Local Storage" e "Session Storage" e limpe os dados relacionados ao seu `localhost` ou domínio do aplicativo.
    *   Você também pode tentar um "Hard Reload" (Recarregar Forte) ou "Empty Cache and Hard Reload" (Esvaziar Cache e Recarregar Forte) clicando com o botão direito no botão de recarregar do navegador.

3.  **Executar comando no console (opcional):**
    *   Nas ferramentas de desenvolvedor (aba "Console"), você pode executar os seguintes comandos para limpar o cache programaticamente:
        ```javascript
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
        ```

### Passo 3: Verificação (Opcional)

Após a execução, você pode verificar se os dados foram removidos:

1.  **No Supabase:**
    *   Vá para a seção "Table Editor".
    *   Selecione a tabela `leads`. Ela deve estar vazia.

2.  **No Frontend:**
    *   Navegue para a página de "Leads" no seu aplicativo. Ela deve estar vazia.
    *   Verifique outras páginas que exibem dados de leads para confirmar que não há vestígios.

Ao seguir estes passos, você terá um sistema completamente limpo de dados de leads, pronto para ser organizado do zero.

