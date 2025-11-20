# Variáveis de Ambiente - Configuração para Deploy

## 🔐 Credenciais do Supabase (Projeto Original)

O projeto utiliza as mesmas credenciais do projeto original para manter o mesmo banco de dados:

### Variáveis para Configurar no Vercel:

```env
VITE_SUPABASE_URL=https://hwzzlyebdgbfstsaaohw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3enpseWViZGdiZnN0c2Fhb2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMTIxMzgsImV4cCI6MjA3ODc4ODEzOH0.3AmkknaGImBxOk09fAmXvR6T_Q-t70ohTPhDUTnG4Nk
```

## 📋 Como Configurar no Vercel:

1. Acesse o [Vercel Dashboard](https://vercel.com)
2. Selecione seu projeto
3. Vá em **Settings** → **Environment Variables**
4. Adicione as duas variáveis acima
5. Certifique-se de selecionar todos os ambientes (Production, Preview, Development)
6. Clique em **Save**

## ✅ Verificação:

Após configurar, o sistema usará automaticamente o mesmo banco de dados Supabase do projeto original.

**Nota:** O arquivo `src/integrations/supabase/client.ts` já está configurado com essas credenciais, mas para produção no Vercel, é recomendado usar variáveis de ambiente.

