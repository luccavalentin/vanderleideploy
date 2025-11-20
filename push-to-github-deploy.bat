@echo off
echo === Preparando projeto para deploy no GitHub ===

REM Verificar se está no diretório correto
if not exist "package.json" (
    echo ERRO: Execute este script na pasta raiz do projeto (backup2-main)
    pause
    exit /b 1
)

REM Verificar se git está instalado
git --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Git não está instalado. Instale o Git primeiro.
    pause
    exit /b 1
)

REM Inicializar repositório se não existir
if not exist ".git" (
    echo Inicializando repositório Git...
    git init
    git branch -M main
)

REM Adicionar remote se não existir
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo Adicionando remote origin...
    git remote add origin https://github.com/luccavalentin/vanderleideploy.git
) else (
    echo Remote já configurado
)

REM Adicionar todos os arquivos
echo Adicionando arquivos ao Git...
git add .

REM Fazer commit
echo Fazendo commit...
git commit -m "Deploy: Sistema completo de gestão financeira e patrimonial"

REM Push para o GitHub
echo Fazendo push para o GitHub...
git push -u origin main --force

if errorlevel 1 (
    echo.
    echo ERRO: Falha ao fazer push. Verifique suas credenciais do GitHub.
    echo Certifique-se de ter configurado o Git com:
    echo   git config --global user.name "Seu Nome"
    echo   git config --global user.email "luccasantana88@gmail.com"
    pause
    exit /b 1
) else (
    echo.
    echo === SUCESSO! Projeto enviado para o GitHub ===
    echo Repositório: https://github.com/luccavalentin/vanderleideploy
    echo.
    echo Próximos passos:
    echo 1. Acesse https://vercel.com
    echo 2. Conecte o repositório GitHub
    echo 3. Configure as variáveis de ambiente:
    echo    - VITE_SUPABASE_URL
    echo    - VITE_SUPABASE_ANON_KEY
    echo 4. Faça o deploy!
    pause
)

