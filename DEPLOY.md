# Instruções de Deploy

## Deploy no Vercel

### 1. Preparação do Repositório

O projeto já está configurado com:
- `vercel.json` - Configuração de rewrites para SPA
- `.gitignore` - Arquivos ignorados pelo Git
- `package.json` - Scripts de build

### 2. Variáveis de Ambiente

Configure as seguintes variáveis de ambiente no Vercel (mesmas do projeto original):

```
VITE_SUPABASE_URL=https://hwzzlyebdgbfstsaaohw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3enpseWViZGdiZnN0c2Fhb2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMTIxMzgsImV4cCI6MjA3ODc4ODEzOH0.3AmkknaGImBxOk09fAmXvR6T_Q-t70ohTPhDUTnG4Nk
```

**Nota:** Estas são as mesmas credenciais do projeto original, mantendo o mesmo banco de dados Supabase.

### 3. Deploy via Vercel Dashboard

1. Acesse [vercel.com](https://vercel.com)
2. Conecte seu repositório GitHub
3. Configure as variáveis de ambiente
4. Deploy automático será feito

### 4. Deploy via CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

## Configuração do GitHub

### Push para o Repositório

```bash
cd backup2-main
git init
git add .
git commit -m "Initial commit - Sistema completo"
git branch -M main
git remote add origin https://github.com/luccavalentin/vanderleideploy.git
git push -u origin main
```

## Estrutura do Projeto

- `/src` - Código fonte
- `/public` - Arquivos estáticos
- `/supabase/migrations` - Migrations do banco de dados
- `vercel.json` - Configuração do Vercel
- `vite.config.ts` - Configuração do Vite

## Build

```bash
npm run build
```

O build será gerado na pasta `dist/`

