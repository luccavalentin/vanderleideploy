# Instruções para Arquivamento Automático de Tarefas

## Migration Necessária

Execute a seguinte migration no Supabase para adicionar os campos de arquivamento:

**Arquivo:** `supabase/migrations/20250120000018_add_archived_to_reminders.sql`

### Como Executar:

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Cole o conteúdo do arquivo `20250120000018_add_archived_to_reminders.sql`
4. Execute o script

### O que a Migration Faz:

1. **Adiciona campos:**
   - `archived` (BOOLEAN): Indica se a tarefa foi arquivada
   - `archived_at` (TIMESTAMP): Data e hora do arquivamento

2. **Cria triggers automáticos:**
   - Quando uma tarefa é marcada como concluída (`completed = true`), ela é automaticamente arquivada
   - Quando uma tarefa é desmarcada como concluída, ela é desarquivada automaticamente

3. **Cria índice:**
   - Índice para melhorar performance de consultas de tarefas não arquivadas

### Funcionalidades Implementadas:

1. **Arquivamento Automático:**
   - Tarefas concluídas são arquivadas automaticamente pelo trigger do banco de dados
   - Não é necessário ação manual do usuário

2. **Campo de Busca:**
   - Busca por título, descrição ou categoria
   - Busca em tempo real enquanto o usuário digita

3. **Filtro de Arquivadas:**
   - Botão para mostrar/ocultar tarefas arquivadas
   - Por padrão, apenas tarefas não arquivadas são exibidas

4. **Otimizações de Performance:**
   - Removidos `refetchQueries` desnecessários
   - Adicionado loading state para evitar duplo clique
   - Cache otimizado com `staleTime`

### Notas Importantes:

- Tarefas arquivadas não aparecem na lista principal por padrão
- Para ver tarefas arquivadas, clique em "Mostrar Arquivadas"
- O arquivamento é automático e não pode ser desfeito manualmente (apenas desmarcando como concluída)

