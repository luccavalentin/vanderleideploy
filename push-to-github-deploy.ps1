# Script para fazer push do projeto para o GitHub
# Repositório: https://github.com/luccavalentin/vanderleideploy

Write-Host "=== Preparando projeto para deploy no GitHub ===" -ForegroundColor Green

# Verificar se está no diretório correto
if (-not (Test-Path "package.json")) {
    Write-Host "ERRO: Execute este script na pasta raiz do projeto (backup2-main)" -ForegroundColor Red
    exit 1
}

# Verificar se git está instalado
try {
    git --version | Out-Null
} catch {
    Write-Host "ERRO: Git não está instalado. Instale o Git primeiro." -ForegroundColor Red
    exit 1
}

# Inicializar repositório se não existir
if (-not (Test-Path ".git")) {
    Write-Host "Inicializando repositório Git..." -ForegroundColor Yellow
    git init
    git branch -M main
}

# Adicionar remote se não existir
$remoteUrl = git remote get-url origin 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Adicionando remote origin..." -ForegroundColor Yellow
    git remote add origin https://github.com/luccavalentin/vanderleideploy.git
} else {
    Write-Host "Remote já configurado: $remoteUrl" -ForegroundColor Green
}

# Adicionar todos os arquivos
Write-Host "Adicionando arquivos ao Git..." -ForegroundColor Yellow
git add .

# Fazer commit
Write-Host "Fazendo commit..." -ForegroundColor Yellow
$commitMessage = "Deploy: Sistema completo de gestão financeira e patrimonial - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
git commit -m $commitMessage

# Push para o GitHub
Write-Host "Fazendo push para o GitHub..." -ForegroundColor Yellow
git push -u origin main --force

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n=== SUCESSO! Projeto enviado para o GitHub ===" -ForegroundColor Green
    Write-Host "Repositório: https://github.com/luccavalentin/vanderleideploy" -ForegroundColor Cyan
    Write-Host "`nPróximos passos:" -ForegroundColor Yellow
    Write-Host "1. Acesse https://vercel.com" -ForegroundColor White
    Write-Host "2. Conecte o repositório GitHub" -ForegroundColor White
    Write-Host "3. Configure as variáveis de ambiente:" -ForegroundColor White
    Write-Host "   - VITE_SUPABASE_URL" -ForegroundColor White
    Write-Host "   - VITE_SUPABASE_ANON_KEY" -ForegroundColor White
    Write-Host "4. Faça o deploy!" -ForegroundColor White
} else {
    Write-Host "`nERRO: Falha ao fazer push. Verifique suas credenciais do GitHub." -ForegroundColor Red
    Write-Host "Certifique-se de ter configurado o Git com:" -ForegroundColor Yellow
    Write-Host "  git config --global user.name 'Seu Nome'" -ForegroundColor White
    Write-Host "  git config --global user.email 'luccasantana88@gmail.com'" -ForegroundColor White
}

